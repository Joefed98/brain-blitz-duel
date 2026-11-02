/**
 * Battery (31 Oct 2026; presentation, sound and network timing only: no sim, input, score, stamp or
 * replay is read or written here). One shared place for:
 *
 *  - page visibility (`pageHidden`, `onPageVisibility`): visibilitychange, pagehide and pageshow;
 *  - the pixel-ratio cap (`canvasRatio`): every canvas renders at a device pixel ratio of at most 2
 *    (an iPhone 11 is 2×; 3× phones render at 2×);
 *  - the battery saver setting (`batterySaverOn`, off by default, device storage only): fewer particles,
 *    glows and bloom (it turns on the arcade's decorative "reduced effects", lib/fx/lowEnd.ts, without
 *    lowering the pixel ratio), and puzzle screens' animation frames capped at 30 a second (arcade stays
 *    at 60; Speed puzzles are never capped, since their stimulus timing is what they measure);
 *  - the arena frame gate (`arenaFrame`): an arcade loop's next frame. Once its run is over or its stage
 *    is locked (a room's "Waiting for other players") for PARK_AFTER_MS, the loop draws once a second
 *    instead of 60 times; while the page is hidden it draws nothing and resumes on return, exactly where
 *    a browser's own requestAnimationFrame would. A loop never steps its sim while over or locked, so
 *    parking changes no tick, input, draft or answer.
 */
import { useSyncExternalStore } from "react";

import { arcadeClockEnded } from "./arcade/clock";

/* ------------------------------------------------------------------ visibility */

const visibilityListeners = new Set<(hidden: boolean) => void>();
let visibilityBound = false;
let lastHidden = false;

/** True while the app is in the background (or the page is being put away). */
export function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function bindVisibility(): void {
  if (visibilityBound || typeof window === "undefined") return;
  visibilityBound = true;
  lastHidden = pageHidden();
  const announce = (hidden: boolean) => {
    if (hidden === lastHidden) return;
    lastHidden = hidden;
    for (const fn of [...visibilityListeners]) fn(hidden);
  };
  document.addEventListener("visibilitychange", () => announce(pageHidden()));
  window.addEventListener("pagehide", () => announce(true));
  window.addEventListener("pageshow", () => announce(pageHidden()));
}

/** Called with `true` when the app goes to the background and `false` when it returns. */
export function onPageVisibility(fn: (hidden: boolean) => void): () => void {
  bindVisibility();
  visibilityListeners.add(fn);
  return () => visibilityListeners.delete(fn);
}

/* ----------------------------------------------------------------- pixel ratio */

/** The most device pixels a canvas draws per CSS pixel. */
export const MAX_CANVAS_RATIO = 2;

/** The device pixel ratio a canvas renders at: the screen's, at most MAX_CANVAS_RATIO. */
export function canvasRatio(): number {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  return Math.min(dpr, MAX_CANVAS_RATIO);
}

/* --------------------------------------------------------------- battery saver */

export const BATTERY_SAVER_KEY = "duelz-battery-saver:v1";
const saverListeners = new Set<() => void>();
let saver: boolean | null = null;

/** The battery saver setting (Profile → settings); off unless this device turned it on. */
export function batterySaverOn(): boolean {
  if (saver === null) {
    saver = false;
    try {
      saver = typeof window !== "undefined" && window.localStorage.getItem(BATTERY_SAVER_KEY) === "1";
    } catch {
      /* storage blocked: off */
    }
    markSaver();
  }
  return saver;
}

function markSaver(): void {
  if (typeof document === "undefined") return;
  if (saver) document.documentElement.dataset["batterySaver"] = "1";
  else delete document.documentElement.dataset["batterySaver"];
}

export function setBatterySaver(on: boolean): void {
  saver = on;
  try {
    if (on) window.localStorage.setItem(BATTERY_SAVER_KEY, "1");
    else window.localStorage.removeItem(BATTERY_SAVER_KEY);
  } catch {
    /* kept for this visit only */
  }
  markSaver();
  for (const fn of [...saverListeners]) fn();
}

export function onBatterySaverChange(fn: () => void): () => void {
  saverListeners.add(fn);
  return () => saverListeners.delete(fn);
}

/** React: the battery saver setting, live. */
export function useBatterySaver(): boolean {
  return useSyncExternalStore(onBatterySaverChange, batterySaverOn, () => false);
}

/* ------------------------------------------------------------ arena frame gate */

/** An over or locked arena keeps drawing at full rate this long (its finishing effects), then parks. */
export const PARK_AFTER_MS = 2000;
/** A parked arena draws once this often (a resize or late effect still shows). */
export const PARKED_FRAME_MS = 1000;

let arenaLocked = false;
/** Each live loop's parking: since when it has been over or locked (-1: playing). */
const parking = new WeakMap<FrameRequestCallback, { since: number; timer: ReturnType<typeof setTimeout> | null }>();
/** Loops stopped by cancelArenaFrame: a frame already scheduled for one never runs it. */
const stopped = new WeakSet<FrameRequestCallback>();
/** Loops waiting for the page to be visible again. */
const waiting = new Set<FrameRequestCallback>();
let gateBound = false;

/** The live stage's `locked` (SteadyOrPlain): its answer is stored and nothing more is recorded. */
export function setArenaLocked(locked: boolean): void {
  arenaLocked = locked;
}

/** A frame for `loop` that never runs it once the loop was stopped. */
function frameFor(loop: FrameRequestCallback): number {
  return requestAnimationFrame((time) => {
    if (!stopped.has(loop)) loop(time);
  });
}

function bindGate(): void {
  if (gateBound) return;
  gateBound = true;
  onPageVisibility((hidden) => {
    if (hidden) return;
    const loops = [...waiting];
    waiting.clear();
    for (const loop of loops) frameFor(loop);
  });
}

/**
 * An arcade loop's next frame, in place of `requestAnimationFrame(loop)` at the top of the loop.
 * Returns the frame id for cancelArenaFrame (0 while parked or hidden).
 */
export function arenaFrame(loop: FrameRequestCallback): number {
  if (typeof window === "undefined" || stopped.has(loop)) return 0;
  bindGate();
  let park = parking.get(loop);
  if (!park) parking.set(loop, (park = { since: -1, timer: null }));
  if (pageHidden()) {
    waiting.add(loop);
    return 0;
  }
  const now = performance.now();
  // Over: the arcade clock's last report from the live loop (lib/arcade/clock.ts reportArcadeTick).
  if (arenaLocked || arcadeClockEnded()) {
    if (park.since < 0) park.since = now;
  } else park.since = -1;
  if (park.since >= 0 && now - park.since >= PARK_AFTER_MS) {
    const state = park;
    state.timer = setTimeout(() => {
      state.timer = null;
      frameFor(loop);
    }, PARKED_FRAME_MS);
    return 0;
  }
  return requestAnimationFrame(loop);
}

/** Stops a loop started through arenaFrame (with its last frame id). */
export function cancelArenaFrame(loop: FrameRequestCallback, frame: number): void {
  if (frame) cancelAnimationFrame(frame);
  stopped.add(loop);
  waiting.delete(loop);
  const park = parking.get(loop);
  if (park?.timer) clearTimeout(park.timer);
}

/* ------------------------------------------------- puzzle frame cap (saver only) */

/** A puzzle screen's animation frames with the battery saver on: at most this many a second. */
export const SAVER_PUZZLE_FPS = 30;
let capInstalled = false;
let capOn = false;

/**
 * With the battery saver on, a puzzle's live round (GameLayout, not an arcade play screen or a Speed
 * puzzle) runs its requestAnimationFrame callbacks on every other display frame (30 a second at 60 Hz).
 * Callbacks get the timestamp of the frame they run in, as before.
 */
export function capPuzzleFrames(on: boolean): void {
  capOn = on;
  if (!on || capInstalled || typeof window === "undefined") return;
  capInstalled = true;
  const real = window.requestAnimationFrame.bind(window);
  const cancelReal = window.cancelAnimationFrame.bind(window);
  const queued = new Map<number, FrameRequestCallback>();
  let nextId = -1;
  let pump = 0;
  let lastRun = -Infinity;
  const run = (time: number) => {
    pump = 0;
    if (capOn && time - lastRun < 1000 / SAVER_PUZZLE_FPS - 2) {
      pump = real(run);
      return;
    }
    lastRun = time;
    const due = [...queued.values()];
    queued.clear();
    for (const cb of due) cb(time);
  };
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    if (!capOn) return real(cb);
    const id = nextId--;
    queued.set(id, cb);
    if (!pump) pump = real(run);
    return id;
  };
  window.cancelAnimationFrame = (id: number) => {
    if (id < 0) queued.delete(id);
    else cancelReal(id);
  };
}

/* ------------------------------------------------------------------- network */

/** React: true while the app is hidden (visibilitychange, pagehide, pageshow). */
export function usePageHidden(): boolean {
  return useSyncExternalStore(
    (fn) => onPageVisibility(() => fn()),
    () => lastHiddenOrNow(),
    () => false,
  );
}

function lastHiddenOrNow(): boolean {
  bindVisibility();
  return lastHidden;
}

/** Refreshes are batched to at most one per this many ms. */
export const BATCH_MS = 1000;

/**
 * `run` at most once per `ms`: the first call runs at once, calls inside the window run once at its end.
 * `cancel` drops a pending run.
 */
export function batched(run: () => void, ms = BATCH_MS): { call: () => void; cancel: () => void } {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    timer = null;
    last = Date.now();
    run();
  };
  return {
    call: () => {
      if (timer) return;
      const wait = last + ms - Date.now();
      if (wait <= 0) fire();
      else timer = setTimeout(fire, wait);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
