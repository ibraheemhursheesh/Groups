"use server";

import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { fetchLinkPreview } from "@/app/lib/link-preview";
import type { LinkPreview } from "@/lib/links";

/**
 * The card a composer shows while you are still typing. Signed in only — this
 * makes the server fetch a url of the caller's choosing, which is not something
 * to leave open to anyone who can reach the app.
 */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  return fetchLinkPreview(url);
}
