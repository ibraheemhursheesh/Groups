import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publish } from "@/app/lib/realtime-bus";
import { groupTopic, userTopic, type RealtimeEvent } from "@/lib/realtime";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-1" } } as { user: { id: string } } | null,
  memberships: [{ organizationId: "group-1" }] as { organizationId: string }[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/app/lib/auth", () => ({
  auth: { api: { getSession: async () => mocks.session } },
}));

/* Only the membership lookup touches the database, so a chain stub that ends
   in the rows is enough — the real schema and operators still run. */
vi.mock("@/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => mocks.memberships,
      }),
    }),
  },
}));

const { GET } = await import("@/app/api/realtime/route");

function open() {
  const controller = new AbortController();
  const request = new Request("http://localhost/api/realtime", {
    signal: controller.signal,
  });
  return { controller, response: GET(request) };
}

async function readerFor(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  return {
    next: async () => {
      const { value, done } = await reader.read();
      return done ? null : decoder.decode(value);
    },
    cancel: () => reader.cancel(),
  };
}

beforeEach(() => {
  mocks.session = { user: { id: "user-1" } };
  mocks.memberships = [{ organizationId: "group-1" }];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/realtime", () => {
  it("refuses an unauthenticated connection", async () => {
    mocks.session = null;

    const response = await GET(new Request("http://localhost/api/realtime"));

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).not.toContain("event-stream");
  });

  it("answers with an unbuffered event stream", async () => {
    const { response, controller } = open();
    const res = await response;

    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");

    controller.abort();
  });

  it("opens with a comment so the browser sees the connection immediately", async () => {
    const { response, controller } = open();
    const reader = await readerFor(await response);

    expect(await reader.next()).toBe(": connected\n\n");

    controller.abort();
  });

  it("forwards an event published to the user's own topic", async () => {
    const { response, controller } = open();
    const reader = await readerFor(await response);
    await reader.next();

    const event: RealtimeEvent = { kind: "notifications-changed" };
    publish(userTopic("user-1"), event);

    expect(await reader.next()).toBe(`data: ${JSON.stringify(event)}\n\n`);

    controller.abort();
  });

  it("forwards an event for a group the user belongs to", async () => {
    const { response, controller } = open();
    const reader = await readerFor(await response);
    await reader.next();

    const event: RealtimeEvent = {
      kind: "post-like",
      postId: "post-1",
      groupId: "group-1",
      likeCount: 5,
      actorId: "user-2",
    };
    publish(groupTopic("group-1"), event);

    expect(await reader.next()).toBe(`data: ${JSON.stringify(event)}\n\n`);

    controller.abort();
  });

  /* Topics come from membership, never from the client, so a group the user is
     not in must not reach this connection. */
  it("stays silent for a group the user does not belong to", async () => {
    const { response, controller } = open();
    const reader = await readerFor(await response);
    await reader.next();

    publish(groupTopic("group-someone-else"), {
      kind: "post-like",
      postId: "post-9",
      groupId: "group-someone-else",
      likeCount: 1,
      actorId: "user-2",
    });
    // The next frame is the one from a topic that *is* subscribed, proving
    // nothing was queued ahead of it.
    publish(userTopic("user-1"), { kind: "notifications-changed" });

    expect(await reader.next()).toBe(
      `data: ${JSON.stringify({ kind: "notifications-changed" })}\n\n`,
    );

    controller.abort();
  });

  it("stops delivering once the client disconnects", async () => {
    const { response, controller } = open();
    const reader = await readerFor(await response);
    await reader.next();

    controller.abort();
    // The subscription is gone, so this has nowhere to land and the stream ends.
    publish(userTopic("user-1"), { kind: "notifications-changed" });

    expect(await reader.next()).toBeNull();
  });

  it("subscribes to nothing but the user's own topic when they have no groups", async () => {
    mocks.memberships = [];

    const { response, controller } = open();
    const reader = await readerFor(await response);
    await reader.next();

    publish(groupTopic("group-1"), {
      kind: "post-like",
      postId: "post-1",
      groupId: "group-1",
      likeCount: 5,
      actorId: "user-2",
    });
    publish(userTopic("user-1"), { kind: "notifications-changed" });

    expect(await reader.next()).toBe(
      `data: ${JSON.stringify({ kind: "notifications-changed" })}\n\n`,
    );

    controller.abort();
  });
});
