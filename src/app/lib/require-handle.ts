import { redirect } from "next/navigation";

type SessionUserWithHandle = {
  handle?: string | null;
  handleConfirmed?: boolean | null;
  isAnonymous?: boolean | null;
};

/**
 * Sends a signed-in user to handle onboarding until they have explicitly
 * claimed one. Takes an already-fetched session so authenticated pages don't
 * pay for a second `getSession` round trip.
 *
 * Guests are exempt: their auto-generated handle stands, since making a
 * throwaway account pick an identity is friction with no payoff.
 */
export function requireConfirmedHandle(session: {
  user: SessionUserWithHandle;
} | null): void {
  if (!session) return;
  if (session.user.isAnonymous) return;
  if (session.user.handleConfirmed) return;

  redirect("/onboarding/handle");
}
