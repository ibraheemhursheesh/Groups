"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"

import { cn } from "@/lib/utils"

// Phones and narrow windows get the swipeable row of panels. Anything wider
// keeps plain click-only tabs, so a mouse never ends up inside a pager.
const MOBILE_QUERY = "(max-width: 767px)"

// --- Swipe feel. These are the knobs. ------------------------------------
// A flick faster than this (pixels/second at the moment the finger lifts)
// pages one slide in its direction however short the drag was. Below it, the
// gesture only counts if the finger dragged past DISTANCE_FRACTION of a slide.
const FLICK_VELOCITY = 400
const DISTANCE_FRACTION = 0.5
// The settle after release is a spring handed the flick's velocity as its
// starting velocity, so the motion continues at the speed the finger left off
// rather than restarting. Stiffer = snappier; more damping = less overshoot.
const SETTLE_SPRING = { stiffness: 400, damping: 40 } as const
// How far a drag may stretch past the first/last slide before resisting, as a
// fraction of a full drag. 0 pins the edges hard; higher rubber-bands more.
const EDGE_ELASTIC = 0.18
// -------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/**
 * Which slide a released swipe should land on. Pure, so the velocity-vs-
 * distance decision can be tested without a real gesture.
 *
 * Dragging left uncovers the next slide: content moves left, so both `offset`
 * and `velocity` are negative in that direction.
 */
export function pickPagerTarget({
  activeIndex,
  offset,
  velocity,
  width,
  count,
}: {
  activeIndex: number
  offset: number
  velocity: number
  width: number
  count: number
}): number {
  if (count <= 1 || width <= 0) return 0
  const step = (sign: number) => clamp(activeIndex + sign, 0, count - 1)
  // A decisive flick advances one slide the way it was thrown.
  if (Math.abs(velocity) > FLICK_VELOCITY) return step(velocity < 0 ? 1 : -1)
  // Otherwise it only moves if the finger dragged most of a slide across.
  if (Math.abs(offset) > width * DISTANCE_FRACTION)
    return step(offset < 0 ? 1 : -1)
  return activeIndex
}

function useIsMobile() {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(MOBILE_QUERY)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

type TabsContextValue = {
  value: string | undefined
  // How a swipe reports the tab it landed on. Unlike a trigger press this must
  // not move the row, because the finger has already put it where it goes.
  setValue: (value: string) => void
  // TabsPanels hangs its pager here, so pressing a trigger travels the row
  // across instead of cutting to it.
  scrollToValue: React.RefObject<((value: string) => void) | null>
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

// True for panels rendered as slides of a TabsPanels pager.
const SlideContext = React.createContext(false)

function Tabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [ownValue, setOwnValue] = React.useState(defaultValue)
  const value = valueProp ?? ownValue
  const scrollToValue = React.useRef<((value: string) => void) | null>(null)

  const setValue = React.useCallback(
    (next: string) => {
      if (valueProp === undefined) setOwnValue(next)
      onValueChange?.(next)
    },
    [valueProp, onValueChange],
  )

  // Radix only reports trigger presses and keyboard moves here, never swipes,
  // so this is exactly the set of changes the row still has to travel for.
  const handleValueChange = React.useCallback(
    (next: string) => {
      setValue(next)
      scrollToValue.current?.(next)
    },
    [setValue],
  )

  const context = React.useMemo(
    () => ({ value, setValue, scrollToValue }),
    [value, setValue],
  )

  return (
    <TabsContext.Provider value={context}>
      <TabsPrimitive.Root
        data-slot="tabs"
        value={value}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsContext.Provider>
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * Lays its TabsContent children out as a row of full-width slides a finger can
 * drag between, like a native pager. Motion owns the drag — the panel tracks
 * the finger 1:1 — and on release the flick's velocity is fed straight into a
 * spring that carries it to the chosen slide, so a hard throw settles fast and
 * a gentle one drifts. See the knobs at the top of the file.
 *
 * Above the mobile breakpoint the pager collapses back to one panel at a time
 * and the dragging is switched off entirely.
 */
function TabsPanels({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof motion.div>, "children"> & {
  children?: React.ReactNode
}) {
  const context = React.useContext(TabsContext)
  const isMobile = useIsMobile()
  const prefersReduced = useReducedMotion()

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const rowRef = React.useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  // Slide width drives every conversion between pixels and slide index. Kept
  // in a ref for the handlers and in state for the drag constraints.
  const [width, setWidth] = React.useState(0)
  const widthRef = React.useRef(0)
  const heightsRef = React.useRef<number[]>([])
  // Target index of a press-driven travel, so the frames it emits aren't read
  // back as a swipe. Null while idle or while a finger is in control.
  const animatingToRef = React.useRef<number | null>(null)
  const draggingRef = React.useRef(false)
  const controlsRef = React.useRef<ReturnType<typeof animate> | null>(null)

  const values = React.Children.toArray(children)
    .filter((child) => React.isValidElement(child))
    .map((child) => (child.props as { value?: string }).value)
    .filter((value): value is string => typeof value === "string")

  const valuesRef = React.useRef(values)
  valuesRef.current = values
  const valuesKey = values.join(" ")
  const count = values.length

  const activeRef = React.useRef(context?.value)
  activeRef.current = context?.value

  const setValue = context?.setValue
  const scrollToValue = context?.scrollToValue

  const indexOfActive = React.useCallback(
    () => Math.max(0, valuesRef.current.indexOf(activeRef.current ?? "")),
    [],
  )

  // The row is only ever as tall as the slide under the finger; mid-swipe the
  // height is interpolated between the two it sits between, so a taller panel
  // grows in as it arrives instead of snapping at the halfway mark.
  const applyHeight = React.useCallback(() => {
    const viewport = viewportRef.current
    const w = widthRef.current
    const heights = heightsRef.current
    if (!viewport || !isMobile || !w || heights.length === 0) return
    const position = clamp(-x.get() / w, 0, heights.length - 1)
    const index = Math.min(Math.floor(position), heights.length - 1)
    const from = heights[index]
    const to = heights[index + 1] ?? from
    viewport.style.height = `${Math.round(from + (to - from) * (position - index))}px`
  }, [isMobile, x])

  const settleTo = React.useCallback(
    (index: number, velocity: number) => {
      const w = widthRef.current
      if (!w) return
      controlsRef.current?.stop()
      const target = -index * w
      if (prefersReduced) {
        x.set(target)
        animatingToRef.current = null
        return
      }
      animatingToRef.current = index
      const controls = animate(x, target, {
        type: "spring",
        velocity,
        ...SETTLE_SPRING,
      })
      controlsRef.current = controls
      controls.then(() => {
        if (animatingToRef.current === index) animatingToRef.current = null
      })
    },
    [prefersReduced, x],
  )

  // A single stream off the motion value: keep the height following the pager,
  // and — only while a finger is actually dragging — let the highlighted tab
  // cross over at the halfway point, the way a native pager's header does. A
  // press-driven travel is skipped here; its tab was already set on press.
  useMotionValueEvent(x, "change", () => {
    applyHeight()
    if (!draggingRef.current || animatingToRef.current !== null) return
    const w = widthRef.current
    if (!w) return
    const nearest = clamp(Math.round(-x.get() / w), 0, valuesRef.current.length - 1)
    const landed = valuesRef.current[nearest]
    if (landed && landed !== activeRef.current) setValue?.(landed)
  })

  // A tab can vanish under the user — approving the last pending post takes
  // its slide with it. Fall back to the first rather than point the pager at
  // a panel that no longer exists.
  React.useEffect(() => {
    if (!setValue || count === 0) return
    if (!valuesRef.current.includes(activeRef.current ?? "")) {
      setValue(valuesRef.current[0])
    }
  }, [setValue, valuesKey, count])

  // Pressing a trigger travels the row across instead of cutting to it.
  React.useEffect(() => {
    if (!scrollToValue) return
    scrollToValue.current = (value) => {
      if (!isMobile) return
      const index = valuesRef.current.indexOf(value)
      if (index >= 0) settleTo(index, 0)
    }
    return () => {
      scrollToValue.current = null
    }
  }, [scrollToValue, isMobile, settleTo])

  // Measure the slides, keep the pager pinned to the active slide across
  // resizes and tab changes, and switch it all off above the breakpoint.
  React.useEffect(() => {
    const viewport = viewportRef.current
    const row = rowRef.current
    if (!viewport || !row) return

    if (!isMobile) {
      viewport.style.height = ""
      widthRef.current = 0
      controlsRef.current?.stop()
      animatingToRef.current = null
      x.set(0)
      return
    }

    const slides = Array.from(row.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    )
    if (slides.length === 0) return

    const measureWidth = () => {
      const w = viewport.clientWidth
      widthRef.current = w
      setWidth(w)
    }
    const measureHeights = () => {
      heightsRef.current = slides.map((slide) =>
        Math.ceil(slide.getBoundingClientRect().height),
      )
    }
    // Don't yank the row out from under a finger or a running settle.
    const pin = () => {
      if (draggingRef.current || animatingToRef.current !== null) return
      const w = widthRef.current
      if (w) x.set(-indexOfActive() * w)
    }

    measureWidth()
    measureHeights()
    pin()
    applyHeight()

    const observer = new ResizeObserver(() => {
      measureHeights()
      applyHeight()
    })
    for (const slide of slides) observer.observe(slide)

    const onResize = () => {
      measureWidth()
      measureHeights()
      pin()
      applyHeight()
    }
    window.addEventListener("resize", onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", onResize)
    }
  }, [isMobile, valuesKey, indexOfActive, applyHeight, x])

  const dragConstraints = React.useMemo(
    () => ({ left: -Math.max(0, count - 1) * width, right: 0 }),
    [count, width],
  )

  return (
    <SlideContext.Provider value={true}>
      <div
        ref={viewportRef}
        data-slot="tabs-panels"
        className={cn("mt-2 overflow-hidden md:overflow-visible", className)}
      >
        <motion.div
          ref={rowRef}
          className="flex items-start touch-pan-y md:block md:touch-auto"
          style={{ x }}
          drag={isMobile ? "x" : false}
          dragDirectionLock
          dragElastic={EDGE_ELASTIC}
          dragMomentum={false}
          dragConstraints={dragConstraints}
          onDragStart={() => {
            draggingRef.current = true
            // A finger landing mid-travel takes the row over from it.
            controlsRef.current?.stop()
            animatingToRef.current = null
          }}
          onDragEnd={(_, info) => {
            draggingRef.current = false
            const target = pickPagerTarget({
              activeIndex: indexOfActive(),
              offset: info.offset.x,
              velocity: info.velocity.x,
              width: widthRef.current,
              count: valuesRef.current.length,
            })
            const landed = valuesRef.current[target]
            if (landed) setValue?.(landed)
            settleTo(target, info.velocity.x)
          }}
          {...props}
        >
          {children}
        </motion.div>
      </div>
    </SlideContext.Provider>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const isSlide = React.useContext(SlideContext)

  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      // Every slide stays mounted: the panel a finger is dragging in has to
      // already be there when it arrives.
      forceMount={isSlide ? true : undefined}
      className={cn(
        isSlide
          ? // One slide per screenful on mobile; above the breakpoint the row
            // is block-flow and only the active panel shows.
            "w-full shrink-0 outline-none md:data-[state=inactive]:hidden"
          : "mt-2 outline-none",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsPanels, TabsContent }
