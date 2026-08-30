import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookup } from "node:dns/promises";
import {
  fetchLinkPreview,
  resolvePostLinkPreview,
} from "@/app/lib/link-preview";

const mockLookupFn = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({
  lookup: mockLookupFn,
  default: { lookup: mockLookupFn },
}));

const mockLookup = vi.mocked(lookup);
const mockFetch = vi.fn();

/** A Response shaped just enough for the streaming reader in the fetcher. */
function response(
  body: string,
  init: { status?: number; contentType?: string; location?: string } = {},
) {
  const status = init.status ?? 200;
  const headers = new Headers();
  headers.set("content-type", init.contentType ?? "text/html; charset=utf-8");
  if (init.location) headers.set("location", init.location);

  const bytes = new TextEncoder().encode(body);
  let sent = false;

  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    body: {
      getReader: () => ({
        read: async () =>
          sent
            ? { done: true, value: undefined }
            : ((sent = true), { done: false, value: bytes }),
        cancel: async () => {},
      }),
      cancel: async () => {},
    },
  } as unknown as Response;
}

function page(head: string) {
  return `<html><head>${head}</head><body>ignored</body></html>`;
}

/**
 * Same as `response`, but handed over in network-sized chunks rather than one
 * piece, so the reader's byte cap is actually exercised.
 */
function chunkedResponse(body: string, chunkSize = 64 * 1024) {
  const headers = new Headers();
  headers.set("content-type", "text/html; charset=utf-8");

  const bytes = new TextEncoder().encode(body);
  let offset = 0;

  return {
    status: 200,
    ok: true,
    headers,
    body: {
      getReader: () => ({
        read: async () => {
          if (offset >= bytes.length) return { done: true, value: undefined };
          const value = bytes.slice(offset, offset + chunkSize);
          offset += chunkSize;
          return { done: false, value };
        },
        cancel: async () => {},
      }),
      cancel: async () => {},
    },
  } as unknown as Response;
}

// Each test uses its own host: the fetcher keeps a short-lived cache, and
// sharing a url across tests would serve a previous test's answer.
let hostCounter = 0;
function freshUrl(path = "/") {
  hostCounter += 1;
  return `https://site${hostCounter}.example${path}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  mockLookup.mockResolvedValue([
    { address: "93.184.216.34", family: 4 },
  ] as never);
});

describe("fetchLinkPreview", () => {
  it("reads the Open Graph tags", async () => {
    const url = freshUrl("/article");
    mockFetch.mockResolvedValue(
      response(
        page(`
          <meta property="og:title" content="A headline" />
          <meta property="og:description" content="What it is about" />
          <meta property="og:image" content="https://cdn.example/cover.jpg" />
          <meta property="og:site_name" content="Example" />
        `),
      ),
    );

    expect(await fetchLinkPreview(url)).toEqual({
      url,
      title: "A headline",
      description: "What it is about",
      image: "https://cdn.example/cover.jpg",
      siteName: "Example",
    });
  });

  it("falls back to twitter tags and the title element", async () => {
    const url = freshUrl();
    mockFetch.mockResolvedValue(
      response(
        page(`
          <title>Plain &amp; simple</title>
          <meta name="twitter:image" content="/relative/cover.png" />
        `),
      ),
    );

    const preview = await fetchLinkPreview(url);

    expect(preview?.title).toBe("Plain & simple");
    // Relative image urls resolve against the page they came from.
    expect(preview?.image).toBe(`${new URL(url).origin}/relative/cover.png`);
  });

  it("has no card for a page with neither a headline nor a picture", async () => {
    mockFetch.mockResolvedValue(response(page("<meta name='robots' content='noindex'>")));
    expect(await fetchLinkPreview(freshUrl())).toBeNull();
  });

  it("ignores responses that are not html", async () => {
    mockFetch.mockResolvedValue(
      response("binary", { contentType: "application/pdf" }),
    );
    expect(await fetchLinkPreview(freshUrl("/doc.pdf"))).toBeNull();
  });

  it("ignores an error response", async () => {
    mockFetch.mockResolvedValue(response("nope", { status: 404 }));
    expect(await fetchLinkPreview(freshUrl())).toBeNull();
  });

  it("survives a network failure", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"));
    expect(await fetchLinkPreview(freshUrl())).toBeNull();
  });

  it("drops an og:image that is not https", async () => {
    mockFetch.mockResolvedValue(
      response(
        page(`
          <meta property="og:title" content="Has a title" />
          <meta property="og:image" content="http://cdn.example/insecure.jpg" />
        `),
      ),
    );

    const preview = await fetchLinkPreview(freshUrl());
    expect(preview?.title).toBe("Has a title");
    expect(preview?.image).toBeNull();
  });

  it("follows a redirect and reports the destination url", async () => {
    const start = freshUrl("/short");
    const target = freshUrl("/full-article");
    mockFetch
      .mockResolvedValueOnce(response("", { status: 301, location: target }))
      .mockResolvedValueOnce(
        response(page('<meta property="og:title" content="Moved here" />')),
      );

    const preview = await fetchLinkPreview(start);

    expect(preview?.url).toBe(target);
    expect(preview?.title).toBe("Moved here");
  });

  describe("ssrf guards", () => {
    it("refuses localhost without even resolving it", async () => {
      expect(await fetchLinkPreview("http://localhost:3000/admin")).toBeNull();
      expect(mockLookup).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("refuses a public name that resolves to a private address", async () => {
      mockLookup.mockResolvedValue([
        { address: "169.254.169.254", family: 4 },
      ] as never);

      expect(await fetchLinkPreview(freshUrl())).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("refuses a redirect that lands on a private address", async () => {
      mockFetch.mockResolvedValueOnce(
        response("", { status: 302, location: "http://10.0.0.1/metadata" }),
      );
      mockLookup
        .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never)
        .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }] as never);

      expect(await fetchLinkPreview(freshUrl())).toBeNull();
      // The first hop was fetched; the second never was.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("refuses a non-http scheme", async () => {
      expect(await fetchLinkPreview("ftp://files.example/x")).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("pages that bury their tags", () => {
    // YouTube carries its og tags around 700KB into the watch page, behind a
    // wall of inline script. A reader that stops before then finds no card at
    // all, which is exactly what used to happen.
    it("finds tags sitting far into a very large head", async () => {
      const url = freshUrl("/heavy");
      const filler = "<script>" + "x".repeat(700 * 1024) + "</script>";
      mockFetch.mockResolvedValue(
        chunkedResponse(
          page(filler + '<meta property="og:title" content="Buried headline" />'),
        ),
      );

      expect((await fetchLinkPreview(url))?.title).toBe("Buried headline");
    });

    it("still stops at the byte cap rather than reading forever", async () => {
      const url = freshUrl("/endless");
      const filler = "<script>" + "x".repeat(3 * 1024 * 1024) + "</script>";
      mockFetch.mockResolvedValue(
        chunkedResponse(
          page(filler + '<meta property="og:title" content="Too far in" />'),
        ),
      );

      expect(await fetchLinkPreview(url)).toBeNull();
    });
  });

  it("serves a repeat lookup from cache", async () => {
    const url = freshUrl("/cached");
    mockFetch.mockResolvedValue(
      response(page('<meta property="og:title" content="Once only" />')),
    );

    const first = await fetchLinkPreview(url);
    const second = await fetchLinkPreview(url);

    expect(second).toEqual(first);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetchLinkPreview via oEmbed", () => {
  function jsonResponse(payload: Record<string, unknown>) {
    return response(JSON.stringify(payload), {
      contentType: "application/json",
    });
  }

  it("asks a provider that speaks oEmbed rather than downloading its page", async () => {
    mockFetch.mockImplementation(async (input: unknown) => {
      const target = String(input);
      if (target.startsWith("https://vimeo.com/api/oembed.json")) {
        return jsonResponse({
          title: "the Scared is scared",
          author_name: "Bianca Giaever",
          provider_name: "Vimeo",
          thumbnail_url: "https://i.vimeocdn.com/video/410748961.jpg",
        });
      }
      throw new Error("should not have fetched " + target);
    });

    expect(await fetchLinkPreview("https://vimeo.com/58659769")).toEqual({
      url: "https://vimeo.com/58659769",
      title: "the Scared is scared",
      // oEmbed has no description, so the author takes that line.
      description: "Bianca Giaever",
      image: "https://i.vimeocdn.com/video/410748961.jpg",
      siteName: "Vimeo",
    });
    // One request, and the page host was never even resolved.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  const youtubeReturning = (thumbnail: string, headStatus: number) =>
    async (input: unknown, init?: { method?: string }) => {
      const target = String(input);
      if (target.startsWith("https://www.youtube.com/oembed")) {
        return jsonResponse({
          title: "A talk",
          provider_name: "YouTube",
          thumbnail_url: thumbnail,
        });
      }
      if (init?.method === "HEAD") return response("", { status: headStatus });
      throw new Error("should not have fetched " + target);
    };

  it("takes youtube's larger thumbnail when that one exists", async () => {
    mockFetch.mockImplementation(
      youtubeReturning("https://i.ytimg.com/vi/hd1/hqdefault.jpg", 200),
    );

    const preview = await fetchLinkPreview("https://www.youtube.com/watch?v=hd1");
    expect(preview?.image).toBe("https://i.ytimg.com/vi/hd1/maxresdefault.jpg");
  });

  it("keeps the smaller thumbnail when there is no larger one", async () => {
    mockFetch.mockImplementation(
      youtubeReturning("https://i.ytimg.com/vi/sd1/hqdefault.jpg", 404),
    );

    const preview = await fetchLinkPreview("https://www.youtube.com/watch?v=sd1");
    expect(preview?.image).toBe("https://i.ytimg.com/vi/sd1/hqdefault.jpg");
  });

  it("reads the page when the provider will not answer", async () => {
    mockFetch.mockImplementation(async (input: unknown) => {
      const target = String(input);
      if (target.startsWith("https://www.youtube.com/oembed")) {
        return response("denied", { status: 401 });
      }
      return response(
        page('<meta property="og:title" content="From the page" />'),
      );
    });

    const preview = await fetchLinkPreview(
      "https://www.youtube.com/watch?v=private1",
    );
    expect(preview?.title).toBe("From the page");
  });

  it("leaves a site that does not speak oEmbed to the page reader", async () => {
    const url = freshUrl("/ordinary");
    mockFetch.mockResolvedValue(
      response(page('<meta property="og:title" content="Scraped" />')),
    );

    expect((await fetchLinkPreview(url))?.title).toBe("Scraped");
  });
});

describe("resolvePostLinkPreview", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(
      response(page('<meta property="og:title" content="Stored card" />')),
    );
  });

  it("stores the card for the link the composer chose", async () => {
    const url = freshUrl("/chosen");
    const stored = await resolvePostLinkPreview(`look at ${url} today`, url);

    expect(JSON.parse(stored!)).toMatchObject({ url, title: "Stored card" });
  });

  it("finds the link itself when the caller names none", async () => {
    const url = freshUrl("/auto");
    const stored = await resolvePostLinkPreview(`no field, just ${url}`);

    expect(JSON.parse(stored!)).toMatchObject({ url });
  });

  it("stores nothing when the composer dismissed the card", async () => {
    const url = freshUrl("/dismissed");

    expect(await resolvePostLinkPreview(`text with ${url}`, "")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refuses a card for a link the post does not contain", async () => {
    const url = freshUrl("/elsewhere");

    expect(
      await resolvePostLinkPreview("a post about nothing", url),
    ).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("stores nothing when the page has no card to give", async () => {
    const url = freshUrl("/bare");
    mockFetch.mockResolvedValue(response(page("")));

    expect(await resolvePostLinkPreview(`see ${url}`, url)).toBeNull();
  });
});
