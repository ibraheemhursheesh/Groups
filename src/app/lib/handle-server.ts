import { eq } from "drizzle-orm";
import { db } from "@/index";
import { user } from "@/db/schema";
import {
  HANDLE_MAX_LENGTH,
  normalizeHandle,
  suggestHandleBase,
} from "@/lib/handle";

/**
 * Handles are always persisted in their normalized (lowercase) form, so a
 * direct equality check is both correct and index-backed.
 */
export async function isHandleTaken(
  handle: string,
  exceptUserId?: string,
): Promise<boolean> {
  const normalized = normalizeHandle(handle);
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.handle, normalized))
    .limit(2);

  if (exceptUserId) {
    return rows.some((row) => row.id !== exceptUserId);
  }
  return rows.length > 0;
}

/**
 * Derives a free handle for a brand-new account. Every provider path (Google,
 * email/password, anonymous) goes through this so `handle` is never null.
 *
 * The unique index on `user.handle` remains the source of truth — this only
 * narrows the odds of a collision, it does not replace the constraint.
 */
export async function generateUniqueHandle(input: {
  email?: string | null;
  name?: string | null;
  isAnonymous?: boolean | null;
}): Promise<string> {
  const base = suggestHandleBase(input);

  for (const candidate of candidateHandles(base)) {
    if (!(await isHandleTaken(candidate))) return candidate;
  }

  // Effectively unreachable: 12 random-suffixed attempts all collided.
  return `${truncateBase(base, 12)}_${randomSuffix(8)}`;
}

function* candidateHandles(base: string): Generator<string> {
  yield base;

  for (let n = 2; n <= 9; n++) {
    yield `${truncateBase(base, HANDLE_MAX_LENGTH - 1)}${n}`;
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    yield `${truncateBase(base, HANDLE_MAX_LENGTH - 5)}_${randomSuffix(4)}`;
  }
}

function truncateBase(base: string, maxLength: number): string {
  return base.slice(0, maxLength).replace(/_+$/, "") || "member";
}

function randomSuffix(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
