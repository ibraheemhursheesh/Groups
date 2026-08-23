import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeTabs } from "@/app/experiments/tabs/chrome-tabs";

const STRIP_WIDTH = 1000;
/* Mirrors the constants in chrome-tabs.tsx. */
const NEW_TAB_SLOT = 44;
const OVERLAP = 20;
const MAX_WIDTH = 240;
const MIN_WIDTH = 58;

function expectedWidth(count: number) {
  const available = STRIP_WIDTH - NEW_TAB_SLOT;
  const fitted = Math.floor((available - OVERLAP) / count) + OVERLAP;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, fitted));
}

/* The shared setup stubs ResizeObserver into a no-op, so the strip would never
   report a width. Report a fixed one instead. */
beforeEach(() => {
  global.ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {}
    observe(target: Element) {
      this.cb(
        [
          {
            target,
            contentRect: { width: STRIP_WIDTH },
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const tabs = () => screen.getAllByRole("tab");
const widthOf = (el: HTMLElement) => parseFloat(el.style.width);
const addTab = () =>
  fireEvent.click(screen.getByRole("button", { name: "New tab" }));

/* Tabs render at width 0 for one frame before growing in. */
const settled = async (count: number) =>
  waitFor(() => {
    expect(tabs()).toHaveLength(count);
    expect(widthOf(tabs()[count - 1])).toBeGreaterThan(0);
  });

describe("ChromeTabs", () => {
  it("opens with a single tab at full width", async () => {
    render(<ChromeTabs />);
    await settled(1);
    expect(widthOf(tabs()[0])).toBe(MAX_WIDTH);
  });

  it("shrinks every tab as new ones are opened", async () => {
    render(<ChromeTabs />);
    await settled(1);

    for (const count of [2, 3, 5, 9]) {
      while (tabs().length < count) addTab();
      await settled(count);

      const widths = tabs().map(widthOf);
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBe(expectedWidth(count));
    }

    /* Strictly decreasing on the way up. */
    expect(expectedWidth(9)).toBeLessThan(expectedWidth(5));
  });

  it("stops shrinking at the minimum width and lets the strip scroll", async () => {
    render(<ChromeTabs />);
    await settled(1);

    while (tabs().length < 30) addTab();
    await settled(30);

    expect(widthOf(tabs()[0])).toBe(MIN_WIDTH);
    /* 30 tabs no longer fit, so the track is wider than the strip. */
    const track = screen.getByRole("tablist").firstElementChild as HTMLElement;
    expect(parseFloat(track.style.width)).toBeGreaterThan(STRIP_WIDTH);
  });

  it("drops the title once tabs get narrow, keeping the favicon", async () => {
    render(<ChromeTabs />);
    await settled(1);
    expect(screen.getAllByText("New Tab").length).toBeGreaterThan(0);

    while (tabs().length < 30) addTab();
    await settled(30);

    /* Only the fake page below the strip still names the tab. */
    expect(tabs()[0].textContent).toBe("N");
  });

  it("pins the width after a mouse close and releases it on pointer leave", async () => {
    render(<ChromeTabs />);
    await settled(1);

    while (tabs().length < 5) addTab();
    await settled(5);
    const pinned = expectedWidth(5);
    expect(widthOf(tabs()[0])).toBe(pinned);

    fireEvent.click(screen.getAllByRole("button", { name: /^Close/ })[4]);
    await waitFor(() => expect(tabs()).toHaveLength(4));

    /* Four tabs would fit at 240px, but the pin holds them where they were. */
    expect(expectedWidth(4)).toBeGreaterThan(pinned);
    expect(widthOf(tabs()[0])).toBe(pinned);

    fireEvent.pointerLeave(screen.getByRole("tablist"));
    await waitFor(() => expect(widthOf(tabs()[0])).toBe(expectedWidth(4)));
  });

  it("grows tabs back when closing without the mouse", async () => {
    render(<ChromeTabs />);
    await settled(1);

    while (tabs().length < 4) addTab();
    await settled(4);

    fireEvent.keyDown(window, { key: "w", altKey: true });
    await waitFor(() => expect(tabs()).toHaveLength(3));
    expect(widthOf(tabs()[0])).toBe(expectedWidth(3));
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["alt", { altKey: true }],
  ])("opens and closes tabs with %s+T / %s+W", async (_name, modifier) => {
    render(<ChromeTabs />);
    await settled(1);

    fireEvent.keyDown(window, { key: "t", ...modifier });
    fireEvent.keyDown(window, { key: "t", ...modifier });
    await settled(3);

    fireEvent.keyDown(window, { key: "w", ...modifier });
    await waitFor(() => expect(tabs()).toHaveLength(2));
  });

  it("closes the focused tab, not merely the last one", async () => {
    render(<ChromeTabs />);
    await settled(1);

    while (tabs().length < 3) addTab();
    await settled(3);

    /* Focus the first tab, then close it with Ctrl+W. */
    fireEvent.pointerDown(tabs()[0], { button: 0, pointerId: 1 });
    const focused = tabs()[0].dataset.tabId;
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(window, { key: "w", ctrlKey: true });
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(tabs().map((t) => t.dataset.tabId)).not.toContain(focused);
  });

  it("ignores shortcuts with no modifier, and Ctrl+Shift+T", async () => {
    render(<ChromeTabs />);
    await settled(1);

    fireEvent.keyDown(window, { key: "t" });
    fireEvent.keyDown(window, { key: "t", ctrlKey: true, shiftKey: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(tabs()).toHaveLength(1);
  });

  it("moves selection to the right-hand neighbour when the active tab closes", async () => {
    render(<ChromeTabs />);
    await settled(1);

    while (tabs().length < 3) addTab();
    await settled(3);

    /* The newest tab is active; select the middle one and close it. */
    fireEvent.pointerDown(tabs()[1], { button: 0, pointerId: 1 });
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getAllByRole("button", { name: /^Close/ })[1]);
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
  });
});
