import { useEffect, useRef } from "react";

import { soundCue as dispatchSoundCue } from "@/lib/fx/soundCues";
import { prefersReducedMotion } from "@/lib/motion";
import { demoHushed } from "@/lib/sound";

import "./wordPolish.css";

/**
 * Word games' completion effects (Puzzle polish, 13 Oct 2026). Presentation
 * only: each runs on the board already on screen, from the moment the game is
 * solved (or, for Nucleus, Forage and Letterfall, at the end of a run whose
 * local score is 120 or more), lasts at most 1.2 s, and never touches the
 * answer, the submission, the clock or the reveal. The shared signature beat
 * (Rotation and shared screens) follows about 1.0 s after the solve, so these
 * stay on the board and leave the screen around it alone.
 *
 * Every effect names a sound cue (no audio yet): docs/sound-cues/word.md.
 */

/** Longest any effect may run, delays included. */
export const WORD_FINISH_MAX_MS = 1200;
/** End-of-run effects play from this local round score. */
export const WORD_FINISH_SCORE = 120;

export type WordGameId =
  | "wordsmith"
  | "wordhunt"
  | "tilegrid"
  | "wordslide"
  | "wordsearch"
  | "letterwheel"
  | "strikeout"
  | "codeword"
  | "swapword"
  | "wordfall";

/**
 * Dispatches a named sound cue ("<gameId>.<event>") through the shared
 * soundCue helper; silent while an intro demo is hushed. No audio is played.
 */
export function wordCue(cue: string): void {
  if (demoHushed()) return;
  dispatchSoundCue(cue);
}

/** One animated element: its keyframes and when it starts (ms from the solve). */
export interface FinishStep {
  el: Element | null | undefined;
  keyframes: Keyframe[];
  delay: number;
  duration: number;
  easing?: string;
}

/** A warm gold tint plus glow; filters only, so the shared tile paint (box-shadow !important) is left alone. */
const GOLD_GLOW = "sepia(0.85) saturate(2.4) brightness(1.25) drop-shadow(0 0 6px color-mix(in oklab, var(--primary) 80%, transparent))";

/** A gold lift that ends exactly where it started. */
export function goldPulse(scale = 1.08): Keyframe[] {
  return [
    { transform: "scale(1)", filter: "none" },
    { transform: `scale(${scale})`, filter: GOLD_GLOW, offset: 0.4 },
    { transform: "scale(1)", filter: "none" },
  ];
}

/** A tile turning over (about its horizontal or vertical axis) and landing gold-lit. */
export function goldFlip(axis: "X" | "Y" = "X"): Keyframe[] {
  return [
    { transform: `perspective(400px) rotate${axis}(0deg)`, filter: "none" },
    { transform: `perspective(400px) rotate${axis}(90deg)`, filter: "brightness(1.1)", offset: 0.45 },
    { transform: `perspective(400px) rotate${axis}(0deg)`, filter: GOLD_GLOW, offset: 0.75 },
    { transform: `perspective(400px) rotate${axis}(0deg)`, filter: "none" },
  ];
}

/**
 * Plays the steps, clamped so nothing runs past WORD_FINISH_MAX_MS. With
 * reduced motion every step becomes one brief glow in place (no movement,
 * no stagger). Returns a cancel function.
 */
export function playFinish(steps: readonly FinishStep[]): () => void {
  if (typeof window === "undefined") return () => {};
  const reduced = prefersReducedMotion();
  const animations: Animation[] = [];
  for (const step of steps) {
    const el = step.el;
    if (!el || !(el instanceof HTMLElement || el instanceof SVGElement) || typeof el.animate !== "function") continue;
    if (reduced) {
      animations.push(el.animate([{ filter: "none" }, { filter: "brightness(1.2)" }, { filter: "none" }], { duration: 420, easing: "ease-in-out" }));
      continue;
    }
    const delay = Math.max(0, Math.min(step.delay, WORD_FINISH_MAX_MS - 120));
    const duration = Math.max(80, Math.min(step.duration, WORD_FINISH_MAX_MS - delay));
    animations.push(el.animate(step.keyframes, { delay, duration, easing: step.easing ?? "ease-in-out", fill: "none" }));
  }
  return () => animations.forEach((a) => a.cancel());
}

/**
 * Runs `play` once when `active` turns true (the solve moment, or the end of
 * a high-scoring run). In dev builds the `duelz-dev-word-finish` window event
 * plays it on the board as it stands, for the screenshot tool.
 */
export function useWordFinish(active: boolean, play: () => (() => void) | void): void {
  const playRef = useRef(play);
  playRef.current = play;
  const played = useRef(false);
  const cancel = useRef<(() => void) | void>(undefined);
  useEffect(() => {
    if (!active || played.current) return;
    played.current = true;
    // The board's last state paints first; the effect starts on the next frame.
    requestAnimationFrame(() => {
      cancel.current = playRef.current();
    });
  }, [active]);
  useEffect(() => () => cancel.current?.(), []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onDev = () => void playRef.current();
    window.addEventListener("duelz-dev-word-finish", onDev);
    return () => window.removeEventListener("duelz-dev-word-finish", onDev);
  }, []);
}

/** Orders cells by distance from a point (row, col): a ripple's delay per cell. */
export function rippleDelay(cell: number, cols: number, fromRow: number, fromCol: number, stepMs: number): number {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  return Math.round(Math.hypot(r - fromRow, c - fromCol) * stepMs);
}
