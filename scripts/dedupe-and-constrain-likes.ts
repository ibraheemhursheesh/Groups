/**
 * Closes the like/unlike TOCTOU race at the database level.
 *
 * `toggleLikePost` / `toggleLikeComment` used to SELECT then conditionally
 * INSERT with no transaction and no uniqueness guarantee, so two concurrent
 * clicks could both observe "not liked" and both insert — permanently
 * inflating the count and requiring N clicks to undo.
 *
 * Collapses any duplicates that already leaked in (keeping the earliest row),
 * then adds the unique indexes that make the state unrepresentable.
 *
 * Run with: npx tsx scripts/dedupe-and-constrain-likes.ts
 * Idempotent — safe to re-run per environment.
 */
import "dotenv/config";
import { Client } from "pg";

const url = process.env.DATABASE_URL!;
const needsSsl = /supabase|amazonaws|neon\.tech/.test(url);

const client = new Client({
  connectionString: url,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

type Target = {
  table: string;
  ownerColumn: string;
  indexName: string;
};

const TARGETS: Target[] = [
  {
    table: "likes",
    ownerColumn: "post_id",
    indexName: "likes_post_id_user_id_unique",
  },
  {
    table: "comment_likes",
    ownerColumn: "comment_id",
    indexName: "comment_likes_comment_id_user_id_unique",
  },
];

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    for (const { table, ownerColumn, indexName } of TARGETS) {
      const { rows: dupes } = await client.query<{ n: number }>(
        `select count(*)::int as n from (
           select 1 from "${table}"
           group by "${ownerColumn}", user_id
           having count(*) > 1
         ) d`,
      );
      console.log(
        `${table}: ${dupes[0].n} (${ownerColumn}, user_id) pair(s) with duplicates`,
      );

      // Keep the earliest row per pair; created_at then id for a stable tiebreak.
      const deleted = await client.query(
        `delete from "${table}" where id in (
           select id from (
             select id, row_number() over (
               partition by "${ownerColumn}", user_id
               order by created_at, id
             ) as rn
             from "${table}"
           ) ranked
           where ranked.rn > 1
         )`,
      );
      console.log(`  removed ${deleted.rowCount} duplicate row(s)`);

      await client.query(
        `create unique index if not exists "${indexName}"
         on "${table}" ("${ownerColumn}", user_id)`,
      );
      console.log(`  unique index "${indexName}" in place`);
    }

    await client.query("commit");
    console.log("\nDone. Duplicate likes are now unrepresentable.");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed, rolled back:", e.message);
  process.exit(1);
});
