/**
 * Reduce Motion and the decoration clock for animated looks (wave 2, E1). Kept apart from look.ts, which is game code
 * under desktop-fairness-check's separation rule (no sim, replay or grader may read the screen): only renderers read
 * the device's prefers-reduced-motion here. Display only.
 */

/* ------------------------------------------------------------ motion (Legendaries only) */

let reducedOverride: boolean | null = null;
let clockOverride: (() => number) | null = null;

/** Checks only: force Reduce Motion on or off (null: the device's setting). */
export function setSkinReducedMotion(on: boolean | null): void {
  reducedOverride = on;
}
/** Checks only: the clock animated looks read (ms), null for the page's own. */
export function setSkinClock(fn: (() => number) | null): void {
  clockOverride = fn;
}

export function skinReducedMotion(): boolean {
  if (reducedOverride !== null) return reducedOverride;
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Seconds of decoration time for an animated look: the page's clock, or 0 (the still, the PNG's frame) under Reduce
 * Motion. Display only; never a sim's tick.
 */
export function skinTime(): number {
  if (skinReducedMotion()) return 0;
  const ms = clockOverride ? clockOverride() : typeof performance !== "undefined" ? performance.now() : 0;
  return ms / 1000;
}
