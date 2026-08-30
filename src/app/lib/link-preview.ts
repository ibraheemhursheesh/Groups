import { lookup } from "node:dns/promises";
import {
  type LinkPreview,
  contentContainsUrl,
  extractFirstUrl,
  normalizeUrl,
} from "@/lib/links";

const FETCH_TIMEOUT_MS = 5000;
// Big enough for pages that bury their og tags behind a few hundred KB of
// inline script - YouTube's watch page carries them about 700KB in, and it is
// far from the only site that does this. This stays a backstop: the end-of-head
// exit below is what ends an ordinary page's read after a few KB.
const MAX_HTML_BYTES = 2 * 1024 * 1024;
// Enough of a rewind to catch a closing head tag split across two chunks.
const HEAD_TAG_LENGTH = 7;
const MAX_REDIRECTS = 3;
// An oEmbed reply is a few hundred bytes; anything near this is not one.
const OEMBED_MAX_BYTES = 64 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const USER_AGENT =
  "Mozilla/5.0 (compatible; GroupssBot/1.0; +https://groupss.app/bot)";

// Pasting a link previews it, then posting it fetches the same link again a
// second later. One short-lived cache serves both, and remembering the misses
// too keeps a dead link from being re-fetched on every lookup.
const cache = new Map<string, { expires: number; preview: LinkPreview | null }>();

function readCache(url: string): { preview: LinkPreview | null } | null {
  const hit = cache.get(url);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(url);
    return null;
  }
  return hit;
}

function writeCache(url: string, preview: LinkPreview | null) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Insertion-ordered, so the first key is the oldest write.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, preview });
}

function isPrivateAddress(address: string, family: number): boolean {
  if (family === 6) {
    const ip = address.toLowerCase();
    if (ip === "::1" || ip === "::") return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(ip) || /^fe[89ab]/.test(ip)) return true;
    // IPv4-mapped, e.g. ::ffff:127.0.0.1 — check the embedded address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    return mapped ? isPrivateAddress(mapped[1], 4) : false;
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/**
 * Keeps the fetcher pointed at the public internet. Without this, anyone could
 * paste `http://169.254.169.254/...` into a post and have the server fetch a
 * cloud metadata endpoint on their behalf.
 *
 * Resolving the name first catches a public hostname that points at a private
 * address. A name that resolves differently between this check and the fetch
 * could still slip through — closing that needs a pinned-IP dispatcher, which
 * is more machinery than this is worth.
 */
async function isPublicUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return false;
    return !addresses.some((a) => isPrivateAddress(a.address, a.family));
  } catch {
    return false;
  }
}

/** Reads at most `MAX_HTML_BYTES`, and stops early once the head is complete. */
async function readCappedText(
  response: Response,
  limit = MAX_HTML_BYTES,
  stopAtHeadEnd = true,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder("utf-8");
  let text = "";
  let bytes = 0;
  let scanned = 0;

  try {
    while (bytes < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });

      // Scan only what just arrived. Re-testing the whole buffer on every
      // chunk is quadratic, which at megabyte sizes is real work.
      const from = Math.max(0, scanned - HEAD_TAG_LENGTH);
      if (stopAtHeadEnd && text.slice(from).toLowerCase().includes("</head>")) {
        break;
      }
      scanned = text.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text;
}

async function fetchDocument(
  start: URL,
): Promise<{ finalUrl: URL; html: string } | null> {
  let url = start;

  // Redirects are followed by hand so every hop gets the same host check —
  // `redirect: "follow"` would happily land on an internal address.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicUrl(url))) return null;

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) return null;
      try {
        url = new URL(location, url);
      } catch {
        return null;
      }
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(contentType)) {
      await response.body?.cancel().catch(() => {});
      return null;
    }

    return { finalUrl: url, html: await readCappedText(response) };
  }

  return null;
}

/**
 * Sites that answer oEmbed: a few hundred bytes of JSON in place of a page that
 * can run to megabytes. YouTube's watch page is 1.3MB and hides its og tags
 * 700KB in; the same title and thumbnail come back from oEmbed in 806 bytes.
 *
 * Matched by host rather than through oEmbed's own discovery step, because
 * discovery means fetching the page first - the very thing this avoids. The
 * endpoints are fixed here and never come from user input, so the url being
 * asked about travels as a query parameter to a host we chose.
 */
const OEMBED_PROVIDERS: ReadonlyArray<{
  hosts: readonly string[];
  endpoint: string;
}> = [
  {
    hosts: ["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"],
    endpoint: "https://www.youtube.com/oembed",
  },
  {
    hosts: ["vimeo.com", "player.vimeo.com"],
    endpoint: "https://vimeo.com/api/oembed.json",
  },
  { hosts: ["open.spotify.com"], endpoint: "https://open.spotify.com/oembed" },
  {
    hosts: ["soundcloud.com", "m.soundcloud.com"],
    endpoint: "https://soundcloud.com/oembed",
  },
  { hosts: ["tiktok.com"], endpoint: "https://www.tiktok.com/oembed" },
];

function oembedEndpointFor(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www[.]/, "");
  return OEMBED_PROVIDERS.find((p) => p.hosts.includes(host))?.endpoint ?? null;
}

/**
 * oEmbed hands back YouTube's 480x360 thumbnail, which is 4:3 and soft on a
 * card this wide. The 1280x720 one exists for most videos but not all, so it is
 * checked rather than assumed - guessing wrong would leave the card showing no
 * picture at all.
 */
async function preferLargerThumbnail(thumbnail: string): Promise<string> {
  if (!thumbnail.startsWith("https://i.ytimg.com/")) return thumbnail;
  if (!thumbnail.endsWith("/hqdefault.jpg")) return thumbnail;

  const candidate = thumbnail.replace("/hqdefault.jpg", "/maxresdefault.jpg");
  try {
    const response = await fetch(candidate, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT },
    });
    await response.body?.cancel().catch(() => {});
    return response.ok ? candidate : thumbnail;
  } catch {
    return thumbnail;
  }
}

/**
 * The card as the site itself describes it. Null when the host does not speak
 * oEmbed, or when it declines to answer - a private video, say - which leaves
 * the caller to fall back to reading the page.
 */
async function fetchViaOembed(url: URL): Promise<LinkPreview | null> {
  const endpoint = oembedEndpointFor(url);
  if (!endpoint) return null;

  const request = new URL(endpoint);
  request.searchParams.set("url", url.toString());
  request.searchParams.set("format", "json");

  let data: Record<string, unknown>;
  try {
    const response = await fetch(request, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    data = JSON.parse(await readCappedText(response, OEMBED_MAX_BYTES, false));
  } catch {
    return null;
  }

  const asText = (value: unknown) => (typeof value === "string" ? value : null);
  const title = asText(data.title);
  const thumbnail = resolveImage(asText(data.thumbnail_url), url);
  if (!title && !thumbnail) return null;

  return {
    url: url.toString(),
    title: truncate(title, 160),
    // oEmbed carries no description. For a video or a track the author is what
    // belongs on that line anyway: the channel, or the artist.
    description: truncate(asText(data.author_name), 300),
    image: thumbnail ? await preferLargerThumbnail(thumbnail) : null,
    siteName: truncate(asText(data.provider_name), 60),
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** `og:title` and friends, keyed by their property/name attribute. */
function parseMetaTags(html: string): Map<string, string> {
  const head = html.split(/<\/head>/i)[0] ?? html;
  const tags = head.match(/<meta\s[^>]*>/gi) ?? [];
  const meta = new Map<string, string>();

  for (const tag of tags) {
    const attributes = new Map<string, string>();
    const attributePattern =
      /([a-z][a-z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
    let match: RegExpExecArray | null;
    while ((match = attributePattern.exec(tag)) !== null) {
      attributes.set(
        match[1].toLowerCase(),
        match[2] ?? match[3] ?? match[4] ?? "",
      );
    }

    const key = attributes.get("property") ?? attributes.get("name");
    const content = attributes.get("content");
    // First tag wins: pages that repeat a property mean the first one.
    if (key && content && !meta.has(key.toLowerCase())) {
      meta.set(key.toLowerCase(), decodeEntities(content).trim());
    }
  }

  return meta;
}

function firstOf(meta: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = meta.get(key);
    if (value) return value;
  }
  return null;
}

function resolveImage(raw: string | null, base: URL): string | null {
  if (!raw) return null;
  let image: URL;
  try {
    image = new URL(raw, base);
  } catch {
    return null;
  }
  // The reader's browser loads this one directly, so keep it to https and off
  // private hosts — a card should not be able to point a browser at a lan.
  if (image.protocol !== "https:") return null;
  const host = image.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(10|127|0)\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return image.toString();
}

function truncate(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * The Open Graph card for a url, or null when there is nothing worth showing.
 * Never throws: a link that cannot be fetched simply has no card.
 */
export async function fetchLinkPreview(
  rawUrl: string,
): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(normalizeUrl(rawUrl.trim()));
  } catch {
    return null;
  }

  const key = url.toString();
  const cached = readCache(key);
  if (cached) return cached.preview;

  let preview: LinkPreview | null = null;
  try {
    // Ask the site directly when it offers oEmbed, and read the whole page
    // only when it does not, or will not answer.
    preview = await fetchViaOembed(url);

    const document = preview ? null : await fetchDocument(url);
    if (document) {
      const meta = parseMetaTags(document.html);
      const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(document.html);

      const title =
        firstOf(meta, ["og:title", "twitter:title"]) ??
        (titleTag ? decodeEntities(titleTag[1]) : null);
      const image = resolveImage(
        firstOf(meta, [
          "og:image",
          "og:image:url",
          "og:image:secure_url",
          "twitter:image",
          "twitter:image:src",
        ]),
        document.finalUrl,
      );

      // A card with neither a headline nor a picture is just a link.
      if (title || image) {
        preview = {
          url: document.finalUrl.toString(),
          title: truncate(title, 160),
          description: truncate(
            firstOf(meta, [
              "og:description",
              "twitter:description",
              "description",
            ]),
            300,
          ),
          image,
          siteName: truncate(firstOf(meta, ["og:site_name"]), 60),
        };
      }
    }
  } catch (error) {
    console.error("link preview failed", key, error);
  }

  writeCache(key, preview);
  return preview;
}

/**
 * The card to store on a post, as the JSON that goes in `posts.link_preview`.
 *
 * The card is fetched here rather than accepted from the client: a composer may
 * say *which* link to preview (or ask for none by sending an empty value), but
 * the title, image and description always come from the server's own fetch of a
 * url the post actually contains. Otherwise a post could carry a card claiming
 * to be any site at all.
 */
export async function resolvePostLinkPreview(
  content: string,
  requested?: string | null,
): Promise<string | null> {
  const wanted =
    requested === undefined || requested === null
      ? extractFirstUrl(content)
      : requested.trim() || null;

  if (!wanted) return null;
  if (!contentContainsUrl(content, wanted)) return null;

  const preview = await fetchLinkPreview(wanted);
  return preview ? JSON.stringify(preview) : null;
}
