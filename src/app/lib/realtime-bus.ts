import type { RealtimeEvent } from "@/lib/realtime";

type Listener = (event: RealtimeEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __groupssRealtimeBus: Map<string, Set<Listener>> | undefined;
}

// Parked on globalThis so Next's dev-time module reloading doesn't hand a
// server action a fresh, empty registry while SSE connections are still parked
// on the previous module instance.
const registry = (globalThis.__groupssRealtimeBus ??= new Map<
  string,
  Set<Listener>
>());

/**
 * This bus is in-process: it fans out only to SSE connections held by *this*
 * Node process. That is the whole realtime story on a single server, and the
 * only file that has to change to outgrow it — swap the two functions below for
 * Redis pub/sub, or Postgres LISTEN/NOTIFY on a session-mode connection (the
 * pooler on :6543 is transaction-mode and won't carry notifications), and
 * everything upstream keeps working unchanged.
 */
export function subscribe(topic: string, listener: Listener): () => void {
  let listeners = registry.get(topic);
  if (!listeners) {
    listeners = new Set();
    registry.set(topic, listeners);
  }
  listeners.add(listener);

  return () => {
    const current = registry.get(topic);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) registry.delete(topic);
  };
}

export function publish(topic: string, event: RealtimeEvent): void {
  const listeners = registry.get(topic);
  if (!listeners) return;

  for (const listener of listeners) {
    // A dead or wedged connection must never take down the mutation that
    // produced the event — delivery is best-effort by design.
    try {
      listener(event);
    } catch (error) {
      console.error("realtime delivery failed for topic", topic, error);
    }
  }
}
