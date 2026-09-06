"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";

const BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

/**
 * Makes the Android/browser Back button (and back-swipe gesture) close an open
 * drawer instead of navigating the page. While `open`, a throwaway history entry
 * is pushed; pressing Back pops it and we fire `onClose` rather than leaving the
 * page. Closing the drawer any other way (tap-outside, swipe, selecting an item)
 * pops that entry back off so history stays balanced.
 */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  // Kept in a ref so the effect depends only on `open`; an inline onClose that
  // changes identity every render must not tear the history entry down and
  // rebuild it while the drawer is still open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Spread the existing state so Next's router internals survive the push.
    window.history.pushState({ ...window.history.state, __drawerOpen: true }, "");

    const onPopState = () => onCloseRef.current();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Back already popped our entry (state no longer carries the flag), so only
      // pop it ourselves when the drawer was closed by some other means.
      if (window.history.state?.__drawerOpen) {
        window.history.back();
      }
    };
  }, [open]);
}

type VaulDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  children: React.ReactNode;
};

export function VaulDrawer({ open, onOpenChange, trigger, children }: VaulDrawerProps) {
  useBackButtonClose(open, () => onOpenChange(false));

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex max-h-[90dvh] flex-col rounded-t-[10px] bg-background outline-none">
          <Drawer.Handle className="mt-4 shrink-0 bg-muted" />
          {/* flex-1 + min-h-0 makes this the scroll boundary only once content
              exceeds the sheet's max height. While it fits, scrollTop stays 0 so
              vaul lets a drag anywhere on the body move the sheet (see its
              shouldDrag); tall content scrolls, and still drags from the top. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
