"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import styles from "./chrome-tabs.module.css";

/* A tab's element width includes a CURVE gutter on each side, so the horizontal
   pitch between two tabs is (width - 2 * CURVE) and their painted pills touch. */
const CURVE = 10;
const OVERLAP = CURVE * 2;
const MAX_WIDTH = 240;
const MIN_WIDTH = 58;
/* Space kept clear on the right so the + button stays reachable. */
const NEW_TAB_SLOT = 44;
/* Below these tab widths the close button, then the title, drop out. */
const CLOSE_ALWAYS_AT = 130;
const TITLE_HIDE_AT = 74;
const ANIM_MS = 160;

const PALETTE = [
  "#4285f4",
  "#ea4335",
  "#34a853",
  "#a142f4",
  "#f9ab00",
  "#00acc1",
  "#e8710a",
  "#ec407a",
];

type Tab = {
  id: string;
  title: string;
  url: string;
  color: string;
  /* Set for one frame after creation so the tab can grow in from zero. */
  entering?: boolean;
  /* Set while the tab collapses to zero before it is removed. */
  closing?: boolean;
};

/* Keyboard Lock is Chromium-only and absent from lib.dom. */
type KeyboardLock = {
  lock?: (keyCodes?: string[]) => Promise<void>;
  unlock?: () => void;
};

function keyboardLock(): KeyboardLock | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
}

let seq = 0;

function createTab(): Tab {
  seq += 1;
  return {
    id: `tab-${seq}`,
    title: "New Tab",
    url: "New.com/new-tab",
    color: PALETTE[(seq - 1) % PALETTE.length],
  };
}

export function ChromeTabs() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [stripWidth, setStripWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [resizing, setResizing] = useState(false);
  /* Chrome pins the tab width after a mouse close so the next close button lands
     under the cursor; it releases once the pointer leaves the strip. */
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollToEndRef = useRef(false);

  useEffect(() => {
    if (activeId === null && tabs.length > 0) setActiveId(tabs[0].id);
  }, [activeId, tabs]);

  /* ---------- measurement ---------- */

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;

    const observer = new ResizeObserver(([entry]) => {
      setStripWidth(entry.contentRect.width);
      if (first) {
        first = false;
        setReady(true);
        return;
      }
      setResizing(true);
      clearTimeout(timer);
      timer = setTimeout(() => setResizing(false), 120);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  /* ---------- width + layout ---------- */

  const liveCount = tabs.filter((t) => !t.closing).length;

  const naturalWidth = useMemo(() => {
    if (liveCount === 0 || stripWidth === 0) return MAX_WIDTH;
    const available = Math.max(0, stripWidth - NEW_TAB_SLOT);
    /* Largest w satisfying liveCount * (w - OVERLAP) + OVERLAP <= available. */
    const fitted = Math.floor((available - OVERLAP) / liveCount) + OVERLAP;
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, fitted));
  }, [liveCount, stripWidth]);

  /* The pin can only hold tabs narrower, never wider than they would naturally be. */
  const tabWidth =
    lockedWidth === null ? naturalWidth : Math.min(lockedWidth, naturalWidth);
  const pitch = tabWidth - OVERLAP;

  const layout = useMemo(() => {
    const offsets: number[] = [];
    let x = 0;
    for (const tab of tabs) {
      offsets.push(x);
      /* Entering and closing tabs take up no space, so their neighbours (and the
         + button) slide while the tab itself animates its own width. */
      if (!tab.closing && !tab.entering) x += pitch;
    }
    return { offsets, end: x > 0 ? x + OVERLAP : 0 };
  }, [tabs, pitch]);

  const activeIndex = tabs.findIndex((t) => t.id === activeId);
  const activeTab = activeIndex === -1 ? null : tabs[activeIndex];

  /* ---------- mutations ---------- */

  const addTab = useCallback(() => {
    const tab: Tab = { ...createTab(), entering: true };
    setLockedWidth(null);
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    scrollToEndRef.current = true;
  }, []);

  /* Clear the entering flag on the next frame so the width transition runs. */
  useEffect(() => {
    if (!tabs.some((t) => t.entering)) return;
    const frame = requestAnimationFrame(() => {
      setTabs((prev) =>
        prev.map((t) => (t.entering ? { ...t, entering: false } : t)),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [tabs]);

  useEffect(() => {
    if (!scrollToEndRef.current) return;
    scrollToEndRef.current = false;
    const el = stripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [tabs]);

  const closeTab = useCallback(
    (id: string, { pin }: { pin: boolean }) => {
      if (pin) setLockedWidth(tabWidth);

      setTabs((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1 || prev[index].closing) return prev;

        /* Chrome activates the next tab to the right, falling back to the left. */
        setActiveId((current) => {
          if (current !== id) return current;
          const right = prev
            .slice(index + 1)
            .find((t) => !t.closing && t.id !== id);
          if (right) return right.id;
          const left = prev
            .slice(0, index)
            .filter((t) => !t.closing)
            .pop();
          return left ? left.id : null;
        });

        return prev.map((t) => (t.id === id ? { ...t, closing: true } : t));
      });

      setTimeout(() => {
        setTabs((prev) => prev.filter((t) => t.id !== id));
      }, ANIM_MS);
    },
    [tabWidth],
  );

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey || event.altKey;
      if (!mod || event.shiftKey) return;
      const key = event.key.toLowerCase();

      if (key === "t") {
        event.preventDefault();
        addTab();
      } else if (key === "w") {
        event.preventDefault();
        /* Keyboard closes don't pin the width — pinning is a mouse affordance. */
        if (activeId) closeTab(activeId, { pin: false });
      } else if (
        event.altKey &&
        (key === "arrowright" || key === "arrowleft")
      ) {
        event.preventDefault();
        const live = tabs.filter((t) => !t.closing);
        if (live.length === 0) return;
        const at = live.findIndex((t) => t.id === activeId);
        const step = key === "arrowright" ? 1 : -1;
        setActiveId(live[(at + step + live.length) % live.length].id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, addTab, closeTab, tabs]);

  /* ---------- keyboard capture ---------- */

  /* Browsers reserve Ctrl+T and Ctrl+W and never dispatch them to a page. The
     only way to receive them is keyboard lock, which requires fullscreen. */
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === rootRef.current;
      setCapturing(on);
      if (!on) keyboardLock()?.unlock?.();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleCapture = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen({
        navigationUI: "hide",
        keyboardLock: "browser",
      } as FullscreenOptions);
    } catch {
      return;
    }
    /* Older Chromium only exposes the lock through the Keyboard API. */
    try {
      await keyboardLock()?.lock?.(["KeyT", "KeyW"]);
    } catch {
      /* Locking is best-effort; the fullscreen request already succeeded. */
    }
  }, []);

  /* ---------- render ---------- */

  const showTitle = tabWidth >= TITLE_HIDE_AT;
  const overflowing =
    naturalWidth === MIN_WIDTH && layout.end > stripWidth - NEW_TAB_SLOT;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-ready={ready}
      data-resizing={resizing}
    >
      <div
        ref={stripRef}
        className={styles.strip}
        role="tablist"
        aria-label="Browser tabs"
        onPointerLeave={() => {
          setHoveredId(null);
          setLockedWidth(null);
        }}
      >
        <div
          className={styles.track}
          style={{ width: layout.end + NEW_TAB_SLOT }}
          onDoubleClick={(event) => {
            if (event.target === event.currentTarget) addTab();
          }}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeId;
            const isHovered = tab.id === hoveredId;
            const collapsed = Boolean(tab.closing || tab.entering);
            const lit = isActive || isHovered;

            /* Chrome hides the divider next to whichever tab is lit up. */
            const prev = tabs[index - 1];
            const showSeparator =
              index > 0 &&
              !collapsed &&
              !lit &&
              prev !== undefined &&
              !prev.closing &&
              !prev.entering &&
              prev.id !== activeId &&
              prev.id !== hoveredId;

            const showClose =
              !collapsed &&
              (tabWidth >= CLOSE_ALWAYS_AT || isActive || isHovered);

            return (
              <div
                key={tab.id}
                className={styles.tab}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                title={tab.title}
                data-tab-id={tab.id}
                data-active={isActive}
                data-collapsed={collapsed}
                style={{
                  width: collapsed ? 0 : tabWidth,
                  transform: `translateX(${layout.offsets[index]}px)`,
                  ["--tab-bg" as string]: isActive
                    ? "var(--chrome-bg)"
                    : isHovered
                      ? "var(--hover-bg)"
                      : "transparent",
                }}
                /* Chrome activates on press, not on click. */
                onPointerDown={(event) => {
                  if (event.button === 0 && !tab.closing) setActiveId(tab.id);
                }}
                onPointerEnter={() => setHoveredId(tab.id)}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault();
                    closeTab(tab.id, { pin: true });
                  }
                }}
              >
                {showSeparator && <span className={styles.separator} />}
                {lit && !collapsed && (
                  <>
                    <span className={styles.curveLeft} />
                    <span className={styles.bg} />
                    <span className={styles.curveRight} />
                  </>
                )}
                <span className={styles.content}>
                  {(showTitle || !showClose) && (
                    <span
                      className={styles.favicon}
                      style={{ background: tab.color }}
                      aria-hidden
                    >
                      {tab.title.charAt(0)}
                    </span>
                  )}
                  {showTitle && (
                    <span className={styles.title}>{tab.title}</span>
                  )}
                  {showClose && (
                    <button
                      type="button"
                      className={styles.close}
                      aria-label={`Close ${tab.title}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(tab.id, { pin: true });
                      }}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}

          <button
            type="button"
            className={styles.newTab}
            aria-label="New tab"
            onClick={addTab}
            style={{
              transform: `translateX(${Math.max(0, layout.end - CURVE + 2)}px)`,
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.toolbarBtn}>
          <ArrowLeft size={16} />
        </span>
        <span className={styles.toolbarBtn}>
          <ArrowRight size={16} />
        </span>
        <span className={styles.toolbarBtn}>
          <RotateCw size={14} />
        </span>
        <span className={styles.omnibox}>
          <Search size={13} />
          {activeTab ? activeTab.url : "Search Google or type a URL"}
        </span>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={toggleCapture}
          aria-pressed={capturing}
          aria-label={
            capturing
              ? "Release keyboard shortcuts"
              : "Capture keyboard shortcuts"
          }
          title={
            capturing
              ? "Ctrl+T and Ctrl+W are captured. Long-press Esc to release."
              : "Go fullscreen to capture Ctrl+T and Ctrl+W"
          }
        >
          {capturing ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      <div className={styles.page}>
        {activeTab ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="grid size-9 place-items-center rounded-lg text-sm font-bold text-white"
                style={{ background: activeTab.color }}
              >
                {activeTab.title.charAt(0)}
              </span>
              <div>
                <p className="text-base font-semibold">{activeTab.title}</p>
                <p className="text-xs opacity-60">{activeTab.id}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Stat label="Open tabs" value={liveCount} />
              <Stat label="Tab width" value={`${tabWidth}px`} />
              <Stat label="Natural width" value={`${naturalWidth}px`} />
              <Stat
                label="State"
                value={
                  lockedWidth !== null
                    ? "width pinned"
                    : overflowing
                      ? "scrolling"
                      : tabWidth === MAX_WIDTH
                        ? "at max"
                        : "shrinking"
                }
              />
            </dl>
          </div>
        ) : (
          <p className="text-sm opacity-60">
            No tabs open. Press the + button or Alt+T.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs opacity-55">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}
