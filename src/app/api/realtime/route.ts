import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/index";
import { member as memberTable } from "@/db/schema";
import { auth } from "@/app/lib/auth";
import { subscribe } from "@/app/lib/realtime-bus";
import { groupTopic, userTopic, type RealtimeEvent } from "@/lib/realtime";

// Proxies and browsers will drop a silent stream; a comment line every 25s
// keeps it open without waking any application code.
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  // Reading the session pulls in request headers, which is also what tells
  // Cache Components this route can never be prerendered.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Topics are derived server-side from membership rather than accepted from
  // the client, so a connection can only ever receive events for groups its
  // owner belongs to. The trade-off is that joining a group mid-session, or
  // reading a public group you're not a member of, won't push until the next
  // reconnect.
  const memberships = await db
    .select({ organizationId: memberTable.organizationId })
    .from(memberTable)
    .where(eq(memberTable.userId, userId));

  const topics = [
    userTopic(userId),
    ...memberships.map((m) => groupTopic(m.organizationId)),
  ];

  const encoder = new TextEncoder();

  // Held outside `start` so `cancel` can tear the subscription down too: a
  // client that goes away can surface as either an aborted request or a
  // cancelled stream, and leaking a listener plus an interval on the other path
  // would keep a dead connection alive for the life of the process.
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribes: Array<() => void> = [];
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        for (const unsubscribe of unsubscribes) unsubscribe();
        unsubscribes = [];
        try {
          controller.close();
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      };

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client vanished between the abort event and this write.
          cleanup();
        }
      };

      // Flush headers immediately so the browser reports the connection open
      // rather than waiting for the first real event.
      write(": connected\n\n");

      const send = (event: RealtimeEvent) => {
        write(`data: ${JSON.stringify(event)}\n\n`);
      };

      unsubscribes = topics.map((topic) => subscribe(topic, send));
      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      if (request.signal.aborted) cleanup();
      else request.signal.addEventListener("abort", () => cleanup());
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells nginx-style proxies not to buffer the stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}
