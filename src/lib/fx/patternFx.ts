/**
 * Pattern polish (13 Oct 2026): presentation-only helpers for the Pattern
 * games' moves and completion effects. Nothing here reads or writes puzzle
 * state, answers, timing or submission; effects only observe what the stage
 * already decided. Sound cues are named events with no audio attached yet
 * (docs/sound-cues/pattern.md lists every cue).
 */
import { useEffect, useRef, useState } from "react";

/** Longest a Pattern completion effect may run, from the solve moment. */
export const SOLVE_FX_MS = 1200;

/** Names a sound moment; listeners may attach audio later. Never throws. */
export function soundCue(cue: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue } }));
  } catch {
    /* presentation only */
  }
}

/**
 * True for SOLVE_FX_MS from the render where `solved` first turns true, and
 * dispatches `cue` at that moment. A stage that mounts already solved (a
 * re-mount after the solve) does not replay the effect. Purely visual: the
 * caller's submission must never wait on it.
 */
export function useSolveMoment(solved: boolean, cue?: string): boolean {
  const wasSolved = useRef(solved);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!solved) {
      wasSolved.current = false;
      return;
    }
    if (wasSolved.current) return;
    wasSolved.current = true;
    setActive(true);
    if (cue) soundCue(cue);
  }, [solved, cue]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(false), SOLVE_FX_MS);
    return () => clearTimeout(timer);
  }, [active]);
  return active;
}
