import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  pickPagerTarget,
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";

const WIDTH = 300;

/* pickPagerTarget owns the whole velocity-vs-distance decision, so the swipe
   physics can be pinned down here without a real gesture — which jsdom can't
   produce anyway (it lays nothing out and has no pointer velocity). */
describe("pickPagerTarget", () => {
  const base = { activeIndex: 1, width: WIDTH, count: 3 };

  it("advances one slide on a fast leftward flick, however short the drag", () => {
    // Barely moved, but thrown hard left (negative) -> next slide.
    expect(
      pickPagerTarget({ ...base, offset: -8, velocity: -900 }),
    ).toBe(2);
  });

  it("advances one slide on a fast rightward flick", () => {
    expect(pickPagerTarget({ ...base, offset: 8, velocity: 900 })).toBe(0);
  });

  it("falls back to distance when the flick is too slow to count", () => {
    // Slow finger, but dragged past halfway left -> next slide.
    expect(
      pickPagerTarget({ ...base, offset: -WIDTH * 0.6, velocity: -50 }),
    ).toBe(2);
  });

  it("snaps back when a slow drag never crosses halfway", () => {
    expect(
      pickPagerTarget({ ...base, offset: -WIDTH * 0.3, velocity: -50 }),
    ).toBe(1);
  });

  it("never steps beyond the first or last slide", () => {
    expect(
      pickPagerTarget({ ...base, activeIndex: 0, offset: 40, velocity: 900 }),
    ).toBe(0);
    expect(
      pickPagerTarget({ ...base, activeIndex: 2, offset: -40, velocity: -900 }),
    ).toBe(2);
  });

  it("stays put when there is nowhere to go", () => {
    expect(
      pickPagerTarget({ activeIndex: 0, width: WIDTH, count: 1, offset: -999, velocity: -999 }),
    ).toBe(0);
    // No measured width yet -> no move.
    expect(
      pickPagerTarget({ ...base, width: 0, offset: -999, velocity: -999 }),
    ).toBe(0);
  });
});

const realMatchMedia = window.matchMedia;

function mockMatchMedia(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width") ? isMobile : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

function Harness() {
  return (
    <Tabs defaultValue="posts">
      <TabsList>
        <TabsTrigger value="posts">Posts</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="requests">Requests</TabsTrigger>
      </TabsList>
      <TabsPanels>
        <TabsContent value="posts">first panel</TabsContent>
        <TabsContent value="pending">second panel</TabsContent>
        <TabsContent value="requests">third panel</TabsContent>
      </TabsPanels>
    </Tabs>
  );
}

const selected = () =>
  screen.getAllByRole("tab").find((tab) => tab.dataset.state === "active")
    ?.textContent;

describe("swipeable tabs", () => {
  it("keeps every panel mounted, so a swipe has something to drag in", () => {
    mockMatchMedia(true);
    render(<Harness />);

    // All three panels are in the DOM at once, not just the active one.
    expect(screen.getByText("first panel")).toBeDefined();
    expect(screen.getByText("second panel")).toBeDefined();
    expect(screen.getByText("third panel")).toBeDefined();
  });

  it("still switches tabs by press", async () => {
    mockMatchMedia(true);
    render(<Harness />);

    await act(async () => {
      // Radix presses a tab on mousedown, not click.
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Requests" }));
    });

    expect(selected()).toBe("Requests");
  });

  it("leaves the panels untransformed above the mobile breakpoint", async () => {
    mockMatchMedia(false);
    render(<Harness />);

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="tabs-panels"]',
    )!;

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Pending" }));
    });

    expect(selected()).toBe("Pending");
    // Desktop never drives the pager, so no interpolated height is pinned on.
    expect(viewport.style.height).toBe("");
  });
});
