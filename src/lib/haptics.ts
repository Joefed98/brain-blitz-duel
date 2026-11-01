/**
 * Haptics (31 Oct 2026): main moments only, presentation only. Nothing here reads or writes a
 * sim, a timer, an answer or a score.
 *
 * Named patterns, played through one adapter:
 *  - `tick`      light: the countdown's 3, 2, 1 (and the between-rounds chat toast)
 *  - `go`        firmer: GO
 *  - `success`   a puzzle's correct answer or completion; a goal, a home run, a pot
 *  - `error`     a soft double: a puzzle's wrong answer; a foul
 *  - `impact`    a life lost or a crash; the arcade round's buzzer
 *  - `celebrate` the podium, for the winner
 *
 * The adapter today is the web Vibration API (Android browsers). iPhone Safari has no
 * `navigator.vibrate`, so nothing happens there, with no workaround. A native wrapper (Capacitor's
 * Haptics plugin) can plug in later with `setHapticsAdapter` without touching a call site.
 *
 * In-game moments (`haptic(p, { inGame: true })`) fire only while a live round's board is on
 * screen (`[data-game-stage]`, GameLayout) and never in an intro demo (demoHushed), a replay
 * (quietForReplay) or an answer reveal (holdHaptics): those screens draw real stages and sims.
 * The "Haptics" switch in Settings (on by default, `duelz-haptics:v1` on the device) stops all of it.
 * haptics-check proves it.
 */
import { useSyncExternalStore } from "react";

import { demoHushed, replayOnScreen } from "@/lib/sound";

export type HapticPattern = "tick" | "go" | "success" | "error" | "impact" | "celebrate";

/** Vibration API patterns (ms on, off, on…), short and soft. */
export const HAPTIC_PATTERNS: Readonly<Record<HapticPattern, number | readonly number[]>> = {
  tick: 10,
  go: 35,
  success: [14, 40, 22],
  error: [10, 70, 10],
  impact: 45,
  celebrate: [25, 50, 25, 50, 60],
};

/** Where patterns go: the web Vibration API today, a native plugin later. */
export interface HapticsAdapter {
  /** Whether this device can play haptics at all (the Settings note reads it). */
  supported(): boolean;
  /** Plays one pattern. May be fire-and-forget (a native bridge is async). */
  play(pattern: HapticPattern): void;
}

/** The web Vibration API (Android Chrome, Firefox, Samsung Internet). */
export const webVibrationAdapter: HapticsAdapter = {
  supported: () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
  play(pattern) {
    try {
      const p = HAPTIC_PATTERNS[pattern];
      navigator.vibrate(typeof p === "number" ? p : [...p]);
    } catch {
      /* a nicety: never let it break anything */
    }
  },
};

let adapter: HapticsAdapter = webVibrationAdapter;

/** Installs another adapter (a native wrapper's haptics plugin); null restores the web one. */
export function setHapticsAdapter(next: HapticsAdapter | null): void {
  adapter = next ?? webVibrationAdapter;
  notify();
}

export function hapticsSupported(): boolean {
  try {
    return adapter.supported();
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- the setting */

export const HAPTICS_KEY = "duelz-haptics:v1";
let cached: boolean | null = null;
const listeners = new Set<() => void>();
function notify(): void {
  for (const fn of listeners) fn();
}

/** The device's Haptics switch: on unless turned off ("0"). */
export function hapticsOn(): boolean {
  if (cached === null) {
    try {
      cached = typeof window === "undefined" || window.localStorage.getItem(HAPTICS_KEY) !== "0";
    } catch {
      cached = true;
    }
  }
  return cached;
}

export function setHapticsOn(on: boolean): void {
  cached = on;
  try {
    if (on) window.localStorage.removeItem(HAPTICS_KEY);
    else window.localStorage.setItem(HAPTICS_KEY, "0");
  } catch {
    /* storage is a nicety; the choice holds for this visit */
  }
  notify();
}

export function onHapticsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useHapticsOn(): boolean {
  return useSyncExternalStore(onHapticsChange, hapticsOn, () => true);
}

export function useHapticsSupported(): boolean {
  return useSyncExternalStore(onHapticsChange, hapticsSupported, () => true);
}

/* ------------------------------------------------------------- the gates */

let held = 0;
/** An answer reveal (or anything else that replays play) holds in-game haptics while it is up. */
export function holdHaptics(): () => void {
  held += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held = Math.max(0, held - 1);
  };
}

function liveBoardOnScreen(): boolean {
  return typeof document !== "undefined" && document.querySelector("[data-game-stage]") !== null;
}

/** Two moments this close together play once (a life lost that also ends the run). */
export const HAPTIC_GAP_MS = 150;
/** A step's success and the completion's success just after it play once. */
export const SUCCESS_GAP_MS = 1000;
let lastAt = -Infinity;
let lastSuccessAt = -Infinity;

/**
 * Plays a named pattern if the setting is on and the device supports it. `inGame` moments also need
 * a live board on screen and no demo, replay or reveal. Returns whether it played.
 */
export function haptic(pattern: HapticPattern, options: { inGame?: boolean } = {}): boolean {
  if (!hapticsOn() || !hapticsSupported()) return false;
  if (options.inGame && (held > 0 || demoHushed() || replayOnScreen() || !liveBoardOnScreen())) return false;
  const now = Date.now();
  if (now - lastAt < HAPTIC_GAP_MS) return false;
  if (pattern === "success" && now - lastSuccessAt < SUCCESS_GAP_MS) return false;
  lastAt = now;
  if (pattern === "success") lastSuccessAt = now;
  adapter.play(pattern);
  return true;
}

/** Test hook: forget the setting cache and the gaps. */
export function resetHapticsForTest(): void {
  cached = null;
  held = 0;
  lastAt = -Infinity;
  lastSuccessAt = -Infinity;
  adapter = webVibrationAdapter;
}
