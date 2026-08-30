/**
 * Adds `posts.link_preview`: the Open Graph card for the first link in a post,
 * stored as JSON the same way `images` is.
 *
 * The card is a snapshot taken when the post is written, not a live lookup, so
 * a feed renders without fetching anything and a post keeps the headline it was
 * published with even after the linked page changes.
 *
 * Run with: npx tsx scripts/add-post-link-preview.ts
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

  try {
    await client.query(`
      alter table public.posts
        add column if not exists link_preview text
    `);
    console.log("posts.link_preview ready");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
