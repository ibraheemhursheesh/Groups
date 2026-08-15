"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/index";
import { user } from "@/db/schema";
import { auth } from "@/app/lib/auth";
import { isHandleTaken } from "@/app/lib/handle-server";
import { validateHandle } from "@/lib/handle";

const UNIQUE_VIOLATION = "23505";

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

export type HandleCheckResult = {
  available: boolean;
  /** Present when the handle is unusable — either malformed or already taken. */
  error?: string;
};

/**
 * Advisory availability check for live feedback while typing. The unique index
 * on `user.handle` is what actually guarantees uniqueness — see `setHandle`.
 */
export async function checkHandleAvailability(
  input: string,
): Promise<HandleCheckResult> {
  const userId = await requireUserId();

  const validation = validateHandle(input);
  if (!validation.ok) {
    return { available: false, error: validation.error };
  }

  if (await isHandleTaken(validation.handle, userId)) {
    return { available: false, error: "That handle is already taken." };
  }

  return { available: true };
}

export type SetHandleResult = { ok: true } | { ok: false; error: string };

export async function setHandle(input: string): Promise<SetHandleResult> {
  const userId = await requireUserId();

  const validation = validateHandle(input);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  try {
    await db
      .update(user)
      .set({
        handle: validation.handle,
        handleConfirmed: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  } catch (e) {
    // Two people can pass the availability check and race to the same handle.
    // The unique index rejects the loser, which surfaces here.
    if (
      typeof e === "object" &&
      e !== null &&
      (e as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return { ok: false, error: "That handle was just taken. Try another." };
    }
    throw e;
  }

  return { ok: true };
}
