const { Pool } = require("pg");
require("dotenv/config");
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
p.query(
  "CREATE TABLE IF NOT EXISTS public.likes (id text PRIMARY KEY, post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES public.user(id) ON DELETE CASCADE, created_at timestamptz NOT NULL)"
)
  .then(() => {
    console.log("done");
    p.end();
  })
  .catch((e) => {
    console.error(e);
    p.end();
  });
