/**
 * Why: Surfaces live inside resizable panels whose widths are independent of the viewport;
 *      we need both viewport-level and container-level breakpoints so every surface adapts
 *      when docked, railed, or windowed at any width.
 * What: useViewportBreakpoint tracks the window size; useContainerBreakpoint tracks an
 *       element via ResizeObserver; both return a T-shirt size from xs → 2xl.
 * How: matchMedia listener for viewport; ResizeObserver callback for container; both debounce
 *      via rAF to avoid layout thrashing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Breakpoint scale (px) ─────────────────────────────────────────── */

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Viewport thresholds aligned with Tailwind defaults.
 * Container thresholds are intentionally narrower because surfaces
 * never span the full viewport.
 */
const VIEWPORT_THRESHOLDS: [number, Breakpoint][] = [
  [1536, "2xl"],
  [1280, "xl"],
  [1024, "lg"],
  [768, "md"],
  [640, "sm"],
  [0, "xs"],
];

const CONTAINER_THRESHOLDS: [number, Breakpoint][] = [
  [960, "2xl"],
  [768, "xl"],
  [640, "lg"],
  [480, "md"],
  [320, "sm"],
  [0, "xs"],
];

function resolve(width: number, thresholds: [number, Breakpoint][]): Breakpoint {
  for (const [min, bp] of thresholds) {
    if (width >= min) return bp;
  }
  return "xs";
}

/* ── Viewport hook ─────────────────────────────────────────────────── */

export function useViewportBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window !== "undefined"
      ? resolve(window.innerWidth, VIEWPORT_THRESHOLDS)
      : "lg",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf: number;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setBp(resolve(window.innerWidth, VIEWPORT_THRESHOLDS)),
      );
    };
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("resize", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return bp;
}

/* ── Container hook ────────────────────────────────────────────────── */

export function useContainerBreakpoint<T extends HTMLElement>(): [
  React.RefCallback<T>,
  Breakpoint,
  number,
] {
  const [bp, setBp] = useState<Breakpoint>("md");
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const refCallback = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;

    let raf: number;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setWidth(w);
        setBp(resolve(w, CONTAINER_THRESHOLDS));
      });
    });
    observer.observe(node);
    observerRef.current = observer;

    // Measure immediately
    const initial = node.getBoundingClientRect().width;
    setWidth(initial);
    setBp(resolve(initial, CONTAINER_THRESHOLDS));
  }, []);

  return [refCallback, bp, width];
}

/* ── Comparison helpers ────────────────────────────────────────────── */

const BP_ORDER: Record<Breakpoint, number> = {
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  "2xl": 5,
};

export function bpGte(current: Breakpoint, min: Breakpoint): boolean {
  return BP_ORDER[current] >= BP_ORDER[min];
}

export function bpLte(current: Breakpoint, max: Breakpoint): boolean {
  return BP_ORDER[current] <= BP_ORDER[max];
}
