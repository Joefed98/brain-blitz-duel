/**
 * The direction-controls choice (arrows or joystick) kept on the device, one store for every place that sets or
 * reads it: Settings → Game controls, the game menu and GridDrag's ArrowPad (Pattern overhaul, 15 Nov 2026: Skid,
 * Heave and Topsy-Turvy no longer draw an unlabelled switch beside the pad; the choice lives in the menu and
 * Settings). Presentation and device storage only: the moves a pad sends are the same either way.
 */
import { useEffect, useState } from "react";

export type ArrowControl = "arrows" | "joystick";

/** The device key (unchanged since the pad's own switch wrote it). */
export const ARROW_CONTROL_KEY = "duelz-arrow-control";
const EVENT = "duelz-arrow-control-change";

/** The games that move with GridDrag's ArrowPad; the game menu offers Direction controls for these. */
export const ARROW_PAD_GAMES: ReadonlySet<string> = new Set(["iceslide", "push", "gravity", "maze"]);

export function readArrowControl(): ArrowControl {
  try {
    return window.localStorage.getItem(ARROW_CONTROL_KEY) === "joystick" ? "joystick" : "arrows";
  } catch {
    return "arrows";
  }
}

export function setArrowControl(value: ArrowControl): void {
  try {
    window.localStorage.setItem(ARROW_CONTROL_KEY, value);
  } catch {
    /* storage is a nicety: the choice stays for this page */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  } catch {
    /* presentation only */
  }
}

/** Calls `fn` with the new choice whenever any place changes it. */
export function onArrowControlChange(fn: (value: ArrowControl) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const v = (event as CustomEvent<ArrowControl>).detail;
    fn(v === "joystick" ? "joystick" : "arrows");
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** The current choice, kept up to date (arrows on the server and first render). */
export function useArrowControl(): ArrowControl {
  const [value, setValue] = useState<ArrowControl>("arrows");
  useEffect(() => {
    setValue(readArrowControl());
    return onArrowControlChange(setValue);
  }, []);
  return value;
}
