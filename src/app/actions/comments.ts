"use server";

import { db } from "@/index";
import { commentsTable } from "@/db/schema";

// Get all comments
export async function getComments() {
  const allComments = await db.select().from(commentsTable);
  return allComments;
}

// Create a comment
// export async function createComment(content: string) {
//   if (!content) throw new Error("Content is required");

//   const newComment = await db.insert(comments).values({ content }).returning();

//   return newComment[0];
// }
