/**
 * Low-end performance governor for the arcade stage (16 Oct 2026, presentation only).
 *
 * Every arena (ArcadeArenaSlot: the arcade games and the five engine games on the arcade stage)
 * watches its own frame gaps while it is mounted. When frames run long for a sustained stretch
 * (SLOW_NEEDED of the last WINDOW gaps over SLOW_GAP_MS, after a settling period), the stage steps
 * into "reduced effects", one level at a time, at most once every SETTLE_MS:
 *
 *  - level 1: canvases render at a device pixel ratio of at most 1 (arcadeCanvasRatio), and the
 *    shared success layer and the heaviest renderers skip or simplify decorative passes
 *    (arcadeReducedEffects): fewer particles, no additive light glows;
 *  - level 2 (still slow at level 1): canvases render at 0.75 of a CSS pixel as well.
 *
 * It never steps back within a tab session (no flicker between looks; the level is kept in
 * sessionStorage, so the next round starts where the last one ended), and it never switches on
 * when frames keep pace: a phone drawing at 60 fps (or 90 / 120) never has a slow gap counted, so
 * on a modern phone nothing here changes a single pixel. Nothing here reads or writes a sim, an
 * input, a score or a replay: it only changes how big the canvases' backing stores are and which
 * purely decorative layers are painted.
 *
 * Tests and the profiler can pin a level before the page loads with `window.__duelzEffects`
 * ("full": never reduce; 1 or 2: start at that level). The level shows on <html
 * data-reduced-effects>.
 */

export type ReducedLevel = 0 | 1 | 2;

/** A frame gap over this counts as slow (under about 40 fps). */
export const SLOW_GAP_MS = 25;
/** Gaps judged at a time, and how many of them must be slow to step down. */
export const WINDOW = 30;
export const SLOW_NEEDED = 22;
/** No judging for this long after an arena mounts or a level changes (start-up, resized canvases, new caches). */
export const SETTLE_MS = 1000;
/** A gap this long is a hidden tab, a dialog or a page load, not a slow frame: the window restarts. */
const PAUSE_GAP_MS = 400;

let level: ReducedLevel = 0;
let pinned = false;
/** Arenas mounted now (watchArcadeFrames); the screen clock slows only while one is live. */
let arenas = 0;
const listeners = new Set<(level: ReducedLevel) => void>();

const STORE_KEY = "duelz-reduced-effects";

function readPin(): void {
  if (pinned || typeof window === "undefined") return;
  pinned = true;
  const pin = (window as { __duelzEffects?: unknown }).__duelzEffects;
  if (pin === 1 || pin === 2) setLevel(pin);
  else if (pin !== "full") {
    let kept: string | null = null;
    try {
      kept = window.sessionStorage.getItem(STORE_KEY);
    } catch {
      /* storage blocked: start at full effects */
    }
    if (kept === "1" || kept === "2") setLevel(Number(kept) as ReducedLevel);
  }
}

function setLevel(next: ReducedLevel): void {
  if (next === level) return;
  level = next;
  if (typeof document !== "undefined") {
    if (level) document.documentElement.dataset["reducedEffects"] = String(level);
    else delete document.documentElement.dataset["reducedEffects"];
  }
  for (const fn of listeners) fn(level);
}

/** The current reduced-effects level (0: full effects). */
export function arcadeReducedLevel(): ReducedLevel {
  readPin();
  return level;
}

/** True once frames have run long: skip or simplify purely decorative passes. */
export function arcadeReducedEffects(): boolean {
  return arcadeReducedLevel() > 0;
}

/**
 * The device pixel ratio an arcade-stage canvas renders at: the screen's, capped at 2 as before;
 * at most 1 in reduced effects, and 0.75 at level 2.
 */
export function arcadeCanvasRatio(): number {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const l = arcadeReducedLevel();
  return l === 0 ? Math.min(dpr, 2) : l === 1 ? Math.min(dpr, 1) : Math.min(dpr, 1) * 0.75;
}

/** Called when the level changes or an arena mounts or unmounts. */
export function onArcadeReducedChange(fn: (level: ReducedLevel) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The practice and room screens' clock tick while reduced effects are on and an arena is live, ms. */
export const SLOW_CLOCK_MS = 250;

/**
 * The tick the practice and room screens' clocks should use for a wanted `ms`: unchanged, except
 * while reduced effects are on and an arena is live, when it is at least SLOW_CLOCK_MS. Those
 * screens re-render on every tick (their timer ring and deadlines); on a slow phone ten re-renders
 * a second cost the arena about a third of its frame time. The timer ring then steps four times a
 * second; the seconds shown and every deadline are read from the same server clock as before.
 */
export function arcadeScreenTickMs(ms: number): number {
  return level > 0 && arenas > 0 ? Math.max(ms, SLOW_CLOCK_MS) : ms;
}

/**
 * The pure decision (exported for checks): given the recent gaps (ms, oldest first), should the
 * stage step down a level?
 */
export function framesRunLong(gaps: readonly number[]): boolean {
  if (gaps.length < WINDOW) return false;
  let slow = 0;
  for (let i = gaps.length - WINDOW; i < gaps.length; i++) if (gaps[i]! > SLOW_GAP_MS) slow++;
  return slow >= SLOW_NEEDED;
}

/** Watches frame gaps while an arena is mounted; returns the stop function. */
export function watchArcadeFrames(): () => void {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return () => {};
  readPin();
  arenas++;
  for (const fn of listeners) fn(level);
  const unmount = () => {
    arenas--;
    for (const fn of listeners) fn(level);
  };
  if ((window as { __duelzEffects?: unknown }).__duelzEffects === "full") return unmount;
  let raf = 0;
  let last = 0;
  let judgeFrom = performance.now() + SETTLE_MS;
  const gaps: number[] = [];
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const gap = last ? t - last : 0;
    last = t;
    if (!gap || level >= 2) return;
    if (gap > PAUSE_GAP_MS) {
      gaps.length = 0;
      judgeFrom = Math.max(judgeFrom, t + 500);
      return;
    }
    if (t < judgeFrom) return;
    gaps.push(gap);
    if (gaps.length > WINDOW) gaps.shift();
    if (framesRunLong(gaps)) {
      setLevel((level + 1) as ReducedLevel);
      try {
        window.sessionStorage.setItem(STORE_KEY, String(level));
      } catch {
        /* storage blocked: the level holds for this page only */
      }
      gaps.length = 0;
      judgeFrom = t + SETTLE_MS;
    }
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    unmount();
  };
}
