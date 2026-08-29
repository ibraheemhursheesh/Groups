"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useSession } from "@/app/lib/auth-client";
import type { RealtimeEvent } from "@/lib/realtime";

type Handler = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<{
  addHandler: (handler: Handler) => () => void;
} | null>(null);

const MAX_BACKOFF_MS = 30_000;

/**
 * Owns the single EventSource for the session. It belongs in the root layout:
 * layouts survive client-side navigation, so the connection is opened once and
 * outlives every route change instead of being torn down and re-established.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const handlers = useRef(new Set<Handler>());

  useEffect(() => {
    // Signed out there is nothing to listen to, and the endpoint would only
    // answer 401 in a loop.
    if (!userId) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      source = new EventSource("/api/realtime");

      source.onopen = () => {
        attempt = 0;
      };

      source.onmessage = (message) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        // Copy first: a handler may unsubscribe itself while we iterate.
        for (const handler of [...handlers.current]) handler(event);
      };

      source.onerror = () => {
        // Closing suppresses EventSource's built-in retry, which has no backoff
        // and would hammer the server through a restart or an expired session.
        source?.close();
        source = null;
        if (stopped) return;
        const delay = Math.min(1000 * 2 ** attempt++, MAX_BACKOFF_MS);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [userId]);

  const value = useMemo(
    () => ({
      addHandler: (handler: Handler) => {
        handlers.current.add(handler);
        return () => {
          handlers.current.delete(handler);
        };
      },
    }),
    [],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Runs `handler` for every event on the connection; callers match on
 * `event.kind`. Nothing happens outside a provider, which keeps components
 * using this renderable in isolation (tests, storybook) without extra setup.
 */
export function useRealtimeEvents(handler: Handler) {
  const context = useContext(RealtimeContext);
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!context) return;
    return context.addHandler((event) => latest.current(event));
  }, [context]);
}
