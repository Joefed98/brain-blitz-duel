import { useEffect, useRef, useState } from "react";

/**
 * Logic polish (presentation only): named sound cues and the per-game completion
 * effect window. Nothing here reads or writes answers, timing or grading.
 */

/** The longest any Logic completion effect runs, from the solve moment. */
export const LOGIC_SOLVE_FX_MS = 1200;

/** Dispatches a named sound cue ("<gameId>.<event>"); no audio is attached yet. */
export function soundCue(cue: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue } }));
}

/**
 * True for LOGIC_SOLVE_FX_MS from the render where `solved` first turns true (the
 * same render that submits), then false for good. Fires `<game>.solve` once.
 * The effect is CSS keyed off this flag; submission and the clock never wait on it.
 */
export function useSolveFx(game: string, solved: boolean): boolean {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const cued = useRef(false);
  useEffect(() => {
    if (!solved || phase !== "idle") return;
    setPhase("playing");
    if (!cued.current) soundCue(`${game}.solve`);
    cued.current = true;
  }, [game, solved, phase]);
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(() => setPhase("done"), LOGIC_SOLVE_FX_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return phase === "playing";
}

/** Remembers the previous value of a render-time quantity (for move animations). */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
