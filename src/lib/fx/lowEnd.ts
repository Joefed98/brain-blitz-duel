/**
 * Low-end performance governor for the arcade stage (16 Oct 2026, presentation only).
 *
 * Every arena (ArcadeArenaSlot: the arcade games and the five engine games on the arcade stage)
 * measures how long each of its frames' own work takes while it is mounted: from the frame's start
 * (the requestAnimationFrame timestamp) to the end of that frame's work on the main thread (a
 * message posted from the frame's callback runs once the frame's callbacks, the game's update and
 * draw, and the browser's rendering of that frame are done). The wait between frames is not work,
 * so a screen capped at 30 Hz (iPhone Low Power Mode, Android battery savers) whose frames finish in
 * a few ms is never slow. The rule (workRunsLong):
 *
 *  - a frame is slow when its work exceeds SLOW_WORK_MS (20 ms: it cannot keep 50 fps);
 *  - ignored: every frame in the first SETTLE_MS (1 s) after the arena mounts, after the page
 *    becomes visible again (visibilitychange, pageshow) and after a step down; any single frame
 *    whose work exceeds STALL_MS (100 ms: a stall, a GC, a cache build); frames while hidden;
 *  - the stage steps down one level when, over the last WINDOW_MS (2 s) of counted frames, at least
 *    SLOW_SHARE (70 %) were slow and at least MIN_FRAMES (20) were counted, and that window covers
 *    a full 2 s of play since judging (re)started.
 *
 *  - level 1: canvases render at a device pixel ratio of at most 1 (arcadeCanvasRatio), and the
 *    shared success layer and the heaviest renderers skip or simplify decorative passes
 *    (arcadeReducedEffects): fewer particles, no additive light glows;
 *  - level 2 (still slow at level 1): canvases render at 0.75 of a CSS pixel as well.
 *
 * It never steps back within a tab session (no flicker between looks; the level is kept in
 * sessionStorage, so the next round starts where the last one ended), and it never switches on
 * when frames finish in time: a phone whose frames take under 20 ms of work (at 30, 60, 90 or
 * 120 Hz) never has a slow frame counted, so on such a phone nothing here changes a single pixel. Nothing here reads or writes a sim, an
 * input, a score or a replay: it only changes how big the canvases' backing stores are and which
 * purely decorative layers are painted.
 *
 * Tests and the profiler can pin a level before the page loads with `window.__duelzEffects`
 * ("full": never reduce; 1 or 2: start at that level). The level shows on <html
 * data-reduced-effects>.
 */

export type ReducedLevel = 0 | 1 | 2;

/** A frame whose own work exceeds this is slow (it cannot keep 50 fps). */
export const SLOW_WORK_MS = 20;
/** A single frame over this is a stall (a GC, a cache build, a dialog), not a slow device: not counted. */
export const STALL_MS = 100;
/** Slow work must persist over this much play before the stage steps down. */
export const WINDOW_MS = 2000;
/** The share of counted frames in the window that must be slow, and the fewest frames counted. */
export const SLOW_SHARE = 0.7;
export const MIN_FRAMES = 20;
/** No frame counts for this long after an arena mounts, the page becomes visible again, or a step down. */
export const SETTLE_MS = 1000;

/** One counted frame: when it started (ms) and how long its own work took (ms). */
export interface FrameWork {
  at: number;
  workMs: number;
}

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
 * The pure decision (exported for checks). `frames` are the frames counted since judging last
 * (re)started, oldest first; `now` the latest frame's start. Stalls (work over STALL_MS) are dropped
 * here too, so callers may pass every frame. True when slow work has persisted for WINDOW_MS.
 */
export function workRunsLong(frames: readonly FrameWork[], now: number): boolean {
  const counted = frames.filter((f) => f.workMs <= STALL_MS);
  if (!counted.length || now - counted[0]!.at < WINDOW_MS) return false;
  const recent = counted.filter((f) => f.at > now - WINDOW_MS);
  if (recent.length < MIN_FRAMES) return false;
  return recent.filter((f) => f.workMs > SLOW_WORK_MS).length >= SLOW_SHARE * recent.length;
}

/** Watches frame work while an arena is mounted; returns the stop function. */
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
  let judgeFrom = performance.now() + SETTLE_MS;
  let frames: FrameWork[] = [];
  const restart = () => {
    frames = [];
    judgeFrom = performance.now() + SETTLE_MS;
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") restart();
    else frames = [];
  };
  // A message posted from the frame's callback runs after the frame's work: its callbacks and the
  // rendering of the frame (MessageChannel tasks are not throttled the way timers are).
  const channel = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
  const settle = (start: number) => {
    const workMs = performance.now() - start;
    if (level >= 2 || document.visibilityState !== "visible" || start < judgeFrom) return;
    if (workMs > STALL_MS) return;
    frames.push({ at: start, workMs });
    while (frames.length && frames[0]!.at <= start - WINDOW_MS * 2) frames.shift();
    if (workRunsLong(frames, start)) {
      setLevel((level + 1) as ReducedLevel);
      try {
        window.sessionStorage.setItem(STORE_KEY, String(level));
      } catch {
        /* storage blocked: the level holds for this page only */
      }
      restart();
    }
  };
  if (channel) channel.port1.onmessage = (event: MessageEvent<number>) => settle(event.data);
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    if (channel) channel.port2.postMessage(t);
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pageshow", restart);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pageshow", restart);
    if (channel) channel.port1.onmessage = null;
    unmount();
  };
}
