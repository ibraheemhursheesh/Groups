/**
 * Creates the notification aggregation tables.
 *
 * A notification is a *group*, not an event: every like on one post folds into
 * a single row for the post's author, with the people who liked it hanging off
 * `notification_actors`. Five likes while the author is away leave one row
 * behind, which is what lets the app say "B, C and 3 others liked your post"
 * instead of listing five separate notifications.
 *
 * The partial unique index is the load-bearing piece. Scoping uniqueness to
 * `read_at is null` means concurrent likes contend on one open row and merge,
 * while a group the author has already read stays closed — later likes open a
 * fresh group rather than reviving a dismissed one.
 *
 * Run with: npx tsx scripts/create-notification-tables.ts
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
      create table if not exists public.notifications (
        id text primary key,
        recipient_id text not null
          references public."user"(id) on delete cascade,
        type text not null,
        target_id text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        read_at timestamptz
      )
    `);

    await client.query(`
      create table if not exists public.notification_actors (
        id text primary key,
        notification_id text not null
          references public.notifications(id) on delete cascade,
        actor_id text not null
          references public."user"(id) on delete cascade,
        created_at timestamptz not null
      )
    `);

    // At most one *open* group per (recipient, type, target).
    await client.query(`
      create unique index if not exists notifications_open_group_unique
        on public.notifications (recipient_id, type, target_id)
        where read_at is null
    `);

    // Feed order: newest activity first for one recipient.
    await client.query(`
      create index if not exists notifications_recipient_updated_idx
        on public.notifications (recipient_id, updated_at desc)
    `);

    // One row per person per group — re-liking moves you to the front of the
    // group rather than counting you twice.
    await client.query(`
      create unique index if not exists notification_actors_notification_actor_unique
        on public.notification_actors (notification_id, actor_id)
    `);

    // Serves both the "who to name" ranking and the group size count.
    await client.query(`
      create index if not exists notification_actors_notification_created_idx
        on public.notification_actors (notification_id, created_at desc)
    `);

    await client.query("commit");
    console.log("notification tables ready");
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
