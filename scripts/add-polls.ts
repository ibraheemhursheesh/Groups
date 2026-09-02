/**
 * Adds polls: `posts.poll` for the choices, and `poll_votes` for who picked
 * what.
 *
 * The choices ride on the post as JSON, the same way `images` and
 * `link_preview` do, so a poll is an ordinary post with an extra column rather
 * than a second kind of row. The question is the post's own `content`.
 *
 * The unique index on (post_id, user_id) is the load-bearing piece: one vote
 * per person per poll, enforced by the database. Changing your mind updates
 * that row, so a tally is a plain `count(*)` and two fast clicks cannot count
 * one voter twice.
 *
 * Run with: npx tsx scripts/add-polls.ts
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

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    await client.query(`
      alter table public.posts
        add column if not exists poll text
    `);

    await client.query(`
      create table if not exists public.poll_votes (
        id text primary key,
        post_id text not null
          references public.posts(id) on delete cascade,
        option_id text not null,
        user_id text not null
          references public."user"(id) on delete cascade,
        created_at timestamptz not null,
        updated_at timestamptz not null
      )
    `);

    // One vote per person per poll.
    await client.query(`
      create unique index if not exists poll_votes_post_id_user_id_unique
        on public.poll_votes (post_id, user_id)
    `);

    // Serves the per-option tally for a feed's worth of polls.
    await client.query(`
      create index if not exists poll_votes_post_id_option_id_idx
        on public.poll_votes (post_id, option_id)
    `);

    await client.query("commit");
    console.log("polls ready");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
