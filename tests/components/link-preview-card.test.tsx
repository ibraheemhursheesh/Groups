import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkPreviewCard } from "@/components/link-preview-card";
import type { LinkPreview } from "@/lib/links";

const preview: LinkPreview = {
  url: "https://example.com/an-article",
  title: "An article worth reading",
  description: "A short summary of the article.",
  image: "https://cdn.example.com/cover.jpg",
  siteName: "Example",
};

function renderCard(
  overrides: Partial<LinkPreview> = {},
  onDismiss?: () => void,
) {
  return render(
    <LinkPreviewCard preview={{ ...preview, ...overrides }} onDismiss={onDismiss} />,
  );
}

describe("LinkPreviewCard", () => {
  it("shows the site, headline, summary and picture", () => {
    renderCard();

    expect(screen.getByText("Example")).toBeTruthy();
    expect(screen.getByText("An article worth reading")).toBeTruthy();
    expect(screen.getByText("A short summary of the article.")).toBeTruthy();

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image.src).toBe(preview.image);
  });

  it("opens the link in a new tab without leaking the referrer", () => {
    renderCard();

    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.href).toBe(preview.url);
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("falls back to the host when the page names no site", () => {
    renderCard({ siteName: null });
    expect(screen.getByText("example.com")).toBeTruthy();
  });

  it("renders without a picture or a summary", () => {
    renderCard({ image: null, description: null });

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("An article worth reading")).toBeTruthy();
  });

  it("drops a picture that fails to load rather than showing a broken frame", () => {
    renderCard();

    fireEvent.error(document.querySelector("img")!);

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("An article worth reading")).toBeTruthy();
  });

  it("offers a remove button only where one is wanted", () => {
    const { unmount } = renderCard();
    expect(screen.queryByLabelText("Remove link preview")).toBeNull();
    unmount();

    const onDismiss = vi.fn();
    renderCard({}, onDismiss);
    fireEvent.click(screen.getByLabelText("Remove link preview"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps a click on the card from reaching the post behind it", () => {
    const onCardClick = vi.fn();
    render(
      // Post cards navigate to the post page on click; the link is its own
      // destination.
      <div onClick={onCardClick}>
        <LinkPreviewCard preview={preview} />
      </div>,
    );

    fireEvent.click(screen.getByRole("link"));

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
