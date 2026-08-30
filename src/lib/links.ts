// One definition of what counts as a url inside post text, shared by the
// renderer that links them, the composer that previews the first one, and the
// server that fetches the card. Keeping it in one place is what stops a post
// from linking one url while previewing another.
const URL_REGEX = /https?:\/\/[^\s<>"']+|(?:www\.)[^\s<>"']+\.[a-z]{2,}[^\s<>"']*/i;

export const URL_REGEX_SOURCE = URL_REGEX.source;

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

export function normalizeUrl(raw: string): string {
  // Any explicit scheme is left alone — including one this app will not
  // fetch, so that `ftp://host/x` stays an ftp url to be rejected rather than
  // being bent into an https url pointing at the host `ftp`.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && raw.includes("://")) return raw;
  return `https://${raw}`;
}

export function displayUrl(raw: string): string {
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** The bare host, for the label above a card's title. */
export function hostOf(raw: string): string {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "");
  } catch {
    return displayUrl(raw).split("/")[0];
  }
}

/**
 * The url a post's card is built from: the first one in the text, the way
 * Bluesky and Twitter pick it.
 */
export function extractFirstUrl(content: string): string | null {
  const match = new RegExp(URL_REGEX_SOURCE, "i").exec(content);
  if (!match) return null;
  // A url that ends a sentence swallows the punctuation; fetching
  // "example.com/page." would 404 where "example.com/page" resolves.
  return normalizeUrl(match[0].replace(/[.,;:!?)\]]+$/, ""));
}

/**
 * Whether `content` really contains `url`. The server checks this before
 * storing a card, so a client cannot attach a preview of one site to a post
 * that links somewhere else entirely.
 */
export function contentContainsUrl(content: string, url: string): boolean {
  return content.toLowerCase().includes(displayUrl(url).toLowerCase());
}

export function parseLinkPreview(value: unknown): LinkPreview | null {
  if (!value) return null;
  if (typeof value === "object") return value as LinkPreview;
  try {
    const parsed = JSON.parse(value as string);
    return parsed && typeof parsed.url === "string" ? parsed : null;
  } catch {
    return null;
  }
}
