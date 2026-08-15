export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;

/**
 * Route segments and identifiers a handle must never shadow. Handles are
 * user-facing identifiers we may later expose as `/@handle` or `/handle`, so
 * anything that collides with an app route or an impersonable role is blocked.
 */
const RESERVED_HANDLES = new Set([
  "about",
  "admin",
  "administrator",
  "all",
  "anonymous",
  "api",
  "assets",
  "auth",
  "everyone",
  "explore",
  "groups",
  "help",
  "here",
  "home",
  "login",
  "logout",
  "me",
  "mod",
  "moderator",
  "new",
  "notifications",
  "null",
  "official",
  "onboarding",
  "privacy",
  "public",
  "root",
  "search",
  "seed",
  "settings",
  "signin",
  "signout",
  "signup",
  "staff",
  "static",
  "support",
  "system",
  "terms",
  "undefined",
  "user",
  "groupss",
]);

/**
 * Canonical form of a handle. Uniqueness is enforced on this value, so
 * `@Ibrahim` and `@ibrahim` are the same account.
 */
export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

export type HandleValidation =
  | { ok: true; handle: string }
  | { ok: false; error: string };

export function validateHandle(input: string): HandleValidation {
  const handle = normalizeHandle(input);

  if (handle.length === 0) {
    return { ok: false, error: "Handle is required." };
  }
  if (handle.length < HANDLE_MIN_LENGTH) {
    return {
      ok: false,
      error: `Handle must be at least ${HANDLE_MIN_LENGTH} characters.`,
    };
  }
  if (handle.length > HANDLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Handle must be at most ${HANDLE_MAX_LENGTH} characters.`,
    };
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return {
      ok: false,
      error: "Only letters, numbers, and underscores are allowed.",
    };
  }
  if (!/[a-z0-9]/.test(handle)) {
    return { ok: false, error: "Handle needs at least one letter or number." };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: "That handle is reserved." };
  }

  return { ok: true, handle };
}

export function isReservedHandle(input: string): boolean {
  return RESERVED_HANDLES.has(normalizeHandle(input));
}

/**
 * Best-effort handle stem derived from whatever the provider gave us. The
 * result is not guaranteed to be unique or even valid — callers must run it
 * through the uniqueness loop before persisting.
 */
export function suggestHandleBase(input: {
  email?: string | null;
  name?: string | null;
  isAnonymous?: boolean | null;
}): string {
  if (input.isAnonymous) return "guest";

  const emailLocalPart = input.email?.split("@")[0] ?? "";
  for (const raw of [emailLocalPart, input.name ?? ""]) {
    const cleaned = sanitizeToHandleChars(raw);
    if (cleaned.length >= HANDLE_MIN_LENGTH && !RESERVED_HANDLES.has(cleaned)) {
      return cleaned;
    }
  }
  return "member";
}

function sanitizeToHandleChars(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s.\-+]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX_LENGTH);
}
