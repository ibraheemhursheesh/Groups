import { describe, expect, it, vi } from "vitest";
import { publish, subscribe } from "@/app/lib/realtime-bus";
import type { RealtimeEvent } from "@/lib/realtime";

const event: RealtimeEvent = { kind: "notifications-changed" };

/* The registry is shared process-wide, so every case uses its own topic. */
let counter = 0;
const freshTopic = () => `test-topic-${counter++}`;

describe("realtime bus", () => {
  it("delivers an event to every subscriber of the topic", () => {
    const topic = freshTopic();
    const first = vi.fn();
    const second = vi.fn();
    subscribe(topic, first);
    subscribe(topic, second);

    publish(topic, event);

    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
  });

  it("keeps topics isolated from each other", () => {
    const listener = vi.fn();
    subscribe(freshTopic(), listener);

    publish(freshTopic(), event);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", () => {
    const topic = freshTopic();
    const listener = vi.fn();
    const unsubscribe = subscribe(topic, listener);

    unsubscribe();
    publish(topic, event);

    expect(listener).not.toHaveBeenCalled();
  });

  it("tolerates unsubscribing twice", () => {
    const topic = freshTopic();
    const unsubscribe = subscribe(topic, vi.fn());
    unsubscribe();

    expect(() => unsubscribe()).not.toThrow();
  });

  it("publishes to a topic nobody listens to without complaint", () => {
    expect(() => publish(freshTopic(), event)).not.toThrow();
  });

  /* A wedged SSE connection must never turn a successful like into a failed
     server action, so delivery is isolated per listener. */
  it("keeps delivering when one listener throws", () => {
    const topic = freshTopic();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const healthy = vi.fn();

    subscribe(topic, () => {
      throw new Error("connection is gone");
    });
    subscribe(topic, healthy);

    expect(() => publish(topic, event)).not.toThrow();
    expect(healthy).toHaveBeenCalledWith(event);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("carries a post-like event's payload through untouched", () => {
    const topic = freshTopic();
    const listener = vi.fn();
    subscribe(topic, listener);

    const likeEvent: RealtimeEvent = {
      kind: "post-like",
      postId: "post-1",
      groupId: "group-1",
      likeCount: 5,
      actorId: "user-2",
    };
    publish(topic, likeEvent);

    expect(listener).toHaveBeenCalledWith(likeEvent);
  });
});
