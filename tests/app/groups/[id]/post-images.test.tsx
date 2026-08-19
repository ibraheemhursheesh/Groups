import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostImages } from "@/app/groups/[id]/post-images";

const img = (n: number) => `https://cdn.example.com/${n}.jpg`;
const imageList = (count: number) =>
  Array.from({ length: count }, (_, i) => img(i + 1));

function renderImages(count: number) {
  const utils = render(<PostImages images={imageList(count)} />);

  /** The clickable grid tiles, in display order. */
  const thumbnails = () =>
    Array.from(utils.container.querySelectorAll<HTMLImageElement>("img"));

  /** The blown-up image, distinguishable from thumbnails by object-contain. */
  const zoomed = () =>
    document.querySelector<HTMLImageElement>("img.object-contain");

  /**
   * Only the carousel renders buttons, in DOM order: close, prev, next.
   * Prev/next carry no accessible name, so they can't be queried by role name.
   */
  const controls = () => {
    const buttons = screen.getAllByRole("button");
    return { close: buttons[0], prev: buttons[1], next: buttons[2] };
  };

  return { ...utils, thumbnails, zoomed, controls };
}

describe("PostImages", () => {
  it("renders nothing for a post with no images", () => {
    const { container } = render(<PostImages images={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a tile per image", () => {
    const { thumbnails } = renderImages(3);
    expect(thumbnails().map((i) => i.src)).toEqual([img(1), img(2), img(3)]);
  });

  it("caps the grid at four tiles and counts the overflow", () => {
    const { thumbnails } = renderImages(7);
    expect(thumbnails()).toHaveLength(4);
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("shows no overflow badge at exactly four images", () => {
    renderImages(4);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("stays closed until a tile is clicked", () => {
    const { zoomed } = renderImages(3);
    expect(zoomed()).toBeNull();
    expect(screen.queryByText("1 / 3")).toBeNull();
  });

  it("opens the carousel on the image that was clicked", () => {
    const { thumbnails, zoomed } = renderImages(3);

    fireEvent.click(thumbnails()[1]);

    expect(zoomed()?.src).toBe(img(2));
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("steps forward and back through the images", () => {
    const { thumbnails, zoomed, controls } = renderImages(3);
    fireEvent.click(thumbnails()[0]);

    fireEvent.click(controls().next);
    expect(zoomed()?.src).toBe(img(2));
    expect(screen.getByText("2 / 3")).toBeTruthy();

    fireEvent.click(controls().next);
    expect(zoomed()?.src).toBe(img(3));

    fireEvent.click(controls().prev);
    expect(zoomed()?.src).toBe(img(2));
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("disables paging past either end", () => {
    const { thumbnails, controls } = renderImages(3);
    fireEvent.click(thumbnails()[0]);

    expect((controls().prev as HTMLButtonElement).disabled).toBe(true);
    expect((controls().next as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(controls().next);
    fireEvent.click(controls().next);

    expect((controls().prev as HTMLButtonElement).disabled).toBe(false);
    expect((controls().next as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables both controls for a single image", () => {
    const { thumbnails, zoomed, controls } = renderImages(1);
    fireEvent.click(thumbnails()[0]);

    expect(zoomed()?.src).toBe(img(1));
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect((controls().prev as HTMLButtonElement).disabled).toBe(true);
    expect((controls().next as HTMLButtonElement).disabled).toBe(true);
  });

  it("reaches images hidden behind the overflow badge", () => {
    const { thumbnails, zoomed, controls } = renderImages(6);

    // The 4th tile is the "+2" one; it opens at image 4, not at image 6.
    fireEvent.click(thumbnails()[3]);
    expect(zoomed()?.src).toBe(img(4));
    expect(screen.getByText("4 / 6")).toBeTruthy();

    fireEvent.click(controls().next);
    fireEvent.click(controls().next);

    expect(zoomed()?.src).toBe(img(6));
    expect(screen.getByText("6 / 6")).toBeTruthy();
    expect((controls().next as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes the carousel and leaves the grid intact", () => {
    const { thumbnails, zoomed } = renderImages(3);
    fireEvent.click(thumbnails()[0]);
    expect(zoomed()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(zoomed()).toBeNull();
    expect(screen.queryByText("1 / 3")).toBeNull();
    expect(thumbnails()).toHaveLength(3);
  });

  it("reopens on a different image after closing", () => {
    const { thumbnails, zoomed } = renderImages(3);

    fireEvent.click(thumbnails()[0]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(thumbnails()[2]);

    expect(zoomed()?.src).toBe(img(3));
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });
});
