// Shared vocabulary for the realtime channel. Deliberately free of server
// imports so both the SSE route and the browser can use it.

export type RealtimeEvent =
  // Deliberately payload-free: the server only says "your notifications moved",
  // and the client re-reads them through an authenticated server action. That
  // keeps notification content off the push channel entirely.
  | { kind: "notifications-changed" }
  | {
      kind: "post-like";
      postId: string;
      groupId: string;
      // Authoritative total at commit time, not a delta — a client that missed
      // an event still lands on the right number from the next one.
      likeCount: number;
      actorId: string;
    };

export const userTopic = (userId: string) => `user:${userId}`;
export const groupTopic = (groupId: string) => `group:${groupId}`;
