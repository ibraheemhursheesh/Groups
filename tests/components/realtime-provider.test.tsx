import { render, screen, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeProvider, useRealtimeEvents } from "@/components/realtime-provider";
import type { RealtimeEvent } from "@/lib/realtime";

const mocks = vi.hoisted(() => ({
  session: { data: { user: { id: "user-1" } } } as {
    data: { user: { id: string } } | null;
  },
}));

vi.mock("@/app/lib/auth-client", () => ({
  useSession: () => mocks.session,
}));

/* jsdom has no EventSource, which is convenient — a fake gives the test direct
   control over opens, messages and failures. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  deliver(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  deliverRaw(data: string) {
    this.onmessage?.({ data });
  }

  fail() {
    this.onerror?.();
  }
}

const latest = () =>
  FakeEventSource.instances[FakeEventSource.instances.length - 1];

function Listener({ onEvent }: { onEvent: (event: RealtimeEvent) => void }) {
  useRealtimeEvents(onEvent);
  return <span>listening</span>;
}

beforeEach(() => {
  FakeEventSource.instances = [];
  mocks.session = { data: { user: { id: "user-1" } } };
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("RealtimeProvider", () => {
  it("opens one connection to the stream when signed in", () => {
    render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(latest().url).toBe("/api/realtime");
  });

  it("stays disconnected when signed out", () => {
    mocks.session = { data: null };

    render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(screen.getByText("listening")).toBeTruthy();
  });

  it("hands parsed events to every subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <RealtimeProvider>
        <Listener onEvent={first} />
        <Listener onEvent={second} />
      </RealtimeProvider>,
    );

    const event: RealtimeEvent = { kind: "notifications-changed" };
    act(() => latest().deliver(event));

    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
  });

  it("ignores a malformed frame rather than throwing", () => {
    const onEvent = vi.fn();
    render(
      <RealtimeProvider>
        <Listener onEvent={onEvent} />
      </RealtimeProvider>,
    );

    expect(() => act(() => latest().deliverRaw("not json"))).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });

  /* EventSource's own retry has no backoff, so the provider closes the source
     and schedules its own — the reconnect must not fire early. */
  it("reconnects with a backoff after a failure", async () => {
    vi.useFakeTimers();
    render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    const first = latest();
    act(() => first.fail());

    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(FakeEventSource.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("lengthens the delay while failures keep coming", async () => {
    vi.useFakeTimers();
    render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    act(() => latest().fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeEventSource.instances).toHaveLength(2);

    // Second failure waits twice as long.
    act(() => latest().fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeEventSource.instances).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeEventSource.instances).toHaveLength(3);
  });

  it("resets the backoff once a connection opens", async () => {
    vi.useFakeTimers();
    render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    act(() => latest().fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    act(() => latest().onopen?.());
    act(() => latest().fail());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeEventSource.instances).toHaveLength(3);
  });

  it("closes the connection when it unmounts", () => {
    const { unmount } = render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    const source = latest();
    unmount();

    expect(source.closed).toBe(true);
  });

  it("does not reconnect after unmounting mid-backoff", async () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <RealtimeProvider>
        <Listener onEvent={vi.fn()} />
      </RealtimeProvider>,
    );

    act(() => latest().fail());
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("stops delivering to a listener that has unmounted", async () => {
    const onEvent = vi.fn();
    function Host({ show }: { show: boolean }) {
      return (
        <RealtimeProvider>{show && <Listener onEvent={onEvent} />}</RealtimeProvider>
      );
    }

    const { rerender } = render(<Host show />);
    rerender(<Host show={false} />);

    await waitFor(() => expect(screen.queryByText("listening")).toBeNull());
    act(() => latest().deliver({ kind: "notifications-changed" }));

    expect(onEvent).not.toHaveBeenCalled();
  });
});
