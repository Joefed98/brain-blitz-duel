import { useEffect, useRef, useState } from "react";

/**
 * Number polish (13 Oct 2026): shared presentation helpers for the Number games.
 * Drawing, animation and sound cues only; nothing here reads or changes an answer.
 */

/** Names a sound moment. No audio is attached yet: listeners pick cues up by name. */
export function soundCue(cue: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue } }));
}

/**
 * One game's stylesheet, hoisted once into <head> by React (href + precedence dedupe it),
 * so the games carry their own art without touching the shared styles.css.
 */
export function PolishStyle({ id, css }: { id: string; css: string }) {
  return (
    <style href={`number-polish-${id}`} precedence="default">
      {css}
    </style>
  );
}

/** The completion effect's lifetime: true from the solve moment for at most `ms` (1.2 s cap). */
export const SOLVE_FX_MAX_MS = 1200;

/**
 * Starts a completion effect the moment `solved` turns true (never before, never twice),
 * dispatches its cue, and ends it after `ms`. Purely visual: the caller has already submitted.
 */
export function useSolveFx(solved: boolean, cue: string, ms = SOLVE_FX_MAX_MS): boolean {
  const [on, setOn] = useState(false);
  const fired = useRef(false);
  useEffect(() => {
    if (!solved || fired.current) return;
    fired.current = true;
    soundCue(cue);
    setOn(true);
  }, [solved, cue]);
  useEffect(() => {
    if (!on) return;
    const timer = window.setTimeout(() => setOn(false), Math.min(ms, SOLVE_FX_MAX_MS));
    return () => window.clearTimeout(timer);
  }, [on, ms]);
  return on;
}
