import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { commentsTable } from "./db/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});
export const db = drizzle({ client: pool });

// async function main() {
//   const user: typeof commentsTable.$inferInsert = {
//     name: "hisham",
//     age: 30,
//     email: "hisham@example.com",
//   };

//   await db.insert(commentsTable).values(user);
//   console.log("New user created!");

//   const users = await db.select().from(commentsTable);
//   console.log("Getting all users from the database: ", users);
//   /*
//   const users: {
//     id: number;
//     name: string;
//     age: number;
//     email: string;
//   }[]
//   */

//   await db
//     .update(commentsTable)
//     .set({
//       age: 31,
//     })
//     .where(eq(commentsTable.email, user.email));
//   console.log("User info updated!");

//   //   await db.delete(commentsTable).where(eq(commentsTable.email, user.email));
//   //   console.log("User deleted!");
// }

// main();
