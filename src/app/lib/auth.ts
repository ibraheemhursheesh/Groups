import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/index"; // your drizzle instance

// const databaseUrl = process.env.DATABASE_URL;

// if (!databaseUrl) {
//   throw new Error("DATABASE_URL is required to initialize Better Auth");
// }

// export const auth = betterAuth({
//   database: new Pool({
//     connectionString: databaseUrl,
//     ssl: { rejectUnauthorized: false }, // required for Supabase
//   }),
//   baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
//   secret: process.env.BETTER_AUTH_SECRET,
//   socialProviders: {
//     google: {
//       clientId: process.env.GOOGLE_CLIENT_ID || "",
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
//     },
//   },
// });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
});