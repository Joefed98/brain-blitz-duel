/**
 * The direction-controls choice (arrows or joystick) for games played with the arrow pad (GridDrag's ArrowPad), kept
 * on the device under `duelz-arrow-control`. The Attention overhaul (15 Nov 2026) moved Labyrinth's switch off the
 * pad and into the game menu and Settings → Game controls: every change goes through `setDirectionControls`, which
 * tells every pad on screen at once. Device storage only.
 */
import { useEffect, useState } from "react";

export type DirectionControls = "arrows" | "joystick";
export const DIRECTION_CONTROLS_KEY = "duelz-arrow-control";
const EVENT = "duelz-direction-controls";

/** Games whose arrow-pad switch lives in the game menu (and Settings), not beside the pad. */
export const MENU_DIRECTION_GAMES: readonly string[] = ["maze"];

export function readDirectionControls(): DirectionControls {
  try {
    return window.localStorage.getItem(DIRECTION_CONTROLS_KEY) === "joystick" ? "joystick" : "arrows";
  } catch {
    return "arrows";
  }
}

export function setDirectionControls(value: DirectionControls): void {
  try {
    window.localStorage.setItem(DIRECTION_CONTROLS_KEY, value);
  } catch {
    /* storage is a nicety: the choice stays for this screen */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** Calls `fn` with the new choice whenever it changes (the menu, Settings, or another pad). */
export function onDirectionControls(fn: (value: DirectionControls) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => fn((event as CustomEvent<DirectionControls>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function useDirectionControls(): [DirectionControls, (value: DirectionControls) => void] {
  const [value, setValue] = useState<DirectionControls>("arrows");
  useEffect(() => {
    setValue(readDirectionControls());
    return onDirectionControls(setValue);
  }, []);
  return [value, setDirectionControls];
}
