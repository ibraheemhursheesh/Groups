/**
 * Adds `user.handle` / `user.handle_confirmed`, backfills every existing row,
 * then locks in NOT NULL + UNIQUE. Idempotent — safe to re-run per environment.
 *
 * Run with: npx tsx scripts/add-user-handles.ts
 * (drizzle-kit push is unusable on Node 24 in this project, hence raw SQL.)
 */
import "dotenv/config";
import { Client } from "pg";
import { suggestHandleBase, HANDLE_MAX_LENGTH } from "../src/lib/handle";

const url = process.env.DATABASE_URL!;
const needsSsl = /supabase|amazonaws|neon\.tech/.test(url);

const client = new Client({
  connectionString: url,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

function randomSuffix(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function truncateBase(base: string, maxLength: number): string {
  return base.slice(0, maxLength).replace(/_+$/, "") || "member";
}

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    // 1. Add columns as nullable so existing rows survive the ALTER.
    await client.query(`
      alter table "user"
        add column if not exists "handle" varchar(20),
        add column if not exists "handle_confirmed" boolean not null default false
    `);

    // 2. Backfill every row that has no handle yet.
    const { rows } = await client.query<{
      id: string;
      name: string | null;
      email: string | null;
      is_anonymous: boolean | null;
    }>(
      `select id, name, email, is_anonymous
       from "user"
       where handle is null
       order by created_at`,
    );

    const taken = new Set<string>(
      (
        await client.query<{ handle: string }>(
          `select handle from "user" where handle is not null`,
        )
      ).rows.map((r) => r.handle),
    );

    for (const row of rows) {
      const base = suggestHandleBase({
        email: row.email,
        name: row.name,
        isAnonymous: row.is_anonymous,
      });

      let handle = base;
      let n = 2;
      while (taken.has(handle)) {
        if (n <= 9) {
          handle = `${truncateBase(base, HANDLE_MAX_LENGTH - 1)}${n}`;
          n++;
        } else {
          handle = `${truncateBase(base, HANDLE_MAX_LENGTH - 5)}_${randomSuffix(4)}`;
        }
      }
      taken.add(handle);

      await client.query(`update "user" set handle = $1 where id = $2`, [
        handle,
        row.id,
      ]);
      console.log(`  ${row.email ?? row.id} -> @${handle}`);
    }

    // 3. Lock the invariant in: never null, never duplicated.
    await client.query(`alter table "user" alter column "handle" set not null`);
    await client.query(
      `create unique index if not exists "user_handle_unique" on "user" ("handle")`,
    );

    await client.query("commit");
    console.log(`\nBackfilled ${rows.length} handle(s). Constraints applied.`);
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
