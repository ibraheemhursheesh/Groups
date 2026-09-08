"use client";

import { Suspense } from "react";
import { useSession } from "@/app/lib/auth-client";
import { BottomNav } from "@/components/bottom-nav";

/**
 * Wraps the page content so the mobile {@link BottomNav} has somewhere to live
 * and the content clears it. The bottom padding is added only when signed in
 * (matching when the nav actually renders), so the signed-out sign-in screen
 * keeps its full-height centered layout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const signedIn = !!session?.user;

  return (
    <>
      <div
        className={
          signedIn
            ? "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
            : undefined
        }
      >
        {children}
      </div>
      {/* BottomNav reads usePathname(), which is request-time data. With Cache
          Components enabled that blocks prerendering unless it sits under a
          Suspense boundary; null fallback matches its existing behavior (the
          nav is session-driven and only appears after hydration anyway). */}
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </>
  );
}
