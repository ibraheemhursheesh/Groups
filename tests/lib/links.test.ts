import { describe, it, expect } from "vitest";
import {
  contentContainsUrl,
  displayUrl,
  extractFirstUrl,
  hostOf,
  normalizeUrl,
  parseLinkPreview,
} from "@/lib/links";

describe("extractFirstUrl", () => {
  it("takes the first link in the text", () => {
    expect(
      extractFirstUrl("read https://example.com and then https://other.com"),
    ).toBe("https://example.com");
  });

  it("gives a bare www link a scheme", () => {
    expect(extractFirstUrl("see www.example.com/post")).toBe(
      "https://www.example.com/post",
    );
  });

  it("leaves sentence punctuation out of the url", () => {
    // "example.com/page." would 404 where "example.com/page" resolves.
    expect(extractFirstUrl("look at https://example.com/page.")).toBe(
      "https://example.com/page",
    );
    expect(extractFirstUrl("(https://example.com/a)")).toBe(
      "https://example.com/a",
    );
  });

  it("keeps a path that legitimately ends in punctuation-free segments", () => {
    expect(extractFirstUrl("https://example.com/a/b?c=1&d=2")).toBe(
      "https://example.com/a/b?c=1&d=2",
    );
  });

  it("returns null when there is no link", () => {
    expect(extractFirstUrl("just a thought, no links here")).toBeNull();
    expect(extractFirstUrl("")).toBeNull();
  });
});

describe("contentContainsUrl", () => {
  it("matches a link the post really contains, however it was typed", () => {
    expect(
      contentContainsUrl("see www.example.com/x", "https://www.example.com/x"),
    ).toBe(true);
    expect(
      contentContainsUrl("see https://example.com/x", "https://example.com/x"),
    ).toBe(true);
  });

  it("rejects a link the post does not contain", () => {
    // This is the check that stops a card for one site riding on a post that
    // links somewhere else.
    expect(
      contentContainsUrl("see https://example.com", "https://evil.test/page"),
    ).toBe(false);
  });
});

describe("url formatting", () => {
  it("normalizes and displays", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(displayUrl("https://example.com/")).toBe("example.com");
  });

  it("reduces a url to its bare host", () => {
    expect(hostOf("https://www.example.com/deep/path")).toBe("example.com");
    expect(hostOf("not a url at all")).toBe("not a url at all");
  });
});

describe("parseLinkPreview", () => {
  const preview = {
    url: "https://example.com",
    title: "Title",
    description: null,
    image: null,
    siteName: null,
  };

  it("reads the stored json", () => {
    expect(parseLinkPreview(JSON.stringify(preview))).toEqual(preview);
  });

  it("passes an already-parsed object through", () => {
    expect(parseLinkPreview(preview)).toEqual(preview);
  });

  it("returns null for empty, malformed, or url-less values", () => {
    expect(parseLinkPreview(null)).toBeNull();
    expect(parseLinkPreview("")).toBeNull();
    expect(parseLinkPreview("{not json")).toBeNull();
    expect(parseLinkPreview('{"title":"no url"}')).toBeNull();
  });
});
