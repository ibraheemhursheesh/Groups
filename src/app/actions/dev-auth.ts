"use server";

import { db } from "@/index";
import { user, session } from "@/db/schema";
import { cookies } from "next/headers";

const TEST_USERS = [
  { id: "test-admin-001", name: "Alex (Admin)", email: "admin@test.local", image: null as string | null },
  { id: "test-member-001", name: "Jordan (Member)", email: "member@test.local", image: null as string | null },
  { id: "test-member-002", name: "Casey (Member)", email: "member2@test.local", image: null as string | null },
];

export async function switchToTestUser(userId: string) {
  const testUser = TEST_USERS.find((u) => u.id === userId);
  if (!testUser) throw new Error("Unknown test user");

  const now = new Date();

  await db
    .insert(user)
    .values({
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      emailVerified: true,
      image: testUser.image,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: user.id,
      set: { name: testUser.name, email: testUser.email, updatedAt: now },
    });

  const sessionToken = crypto.randomUUID();

  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId: testUser.id,
    token: sessionToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });

  (await cookies()).set("better-auth.session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}
