/**
 * The direction-controls choice (arrows or joystick) for games played with the arrow pad (GridDrag's ArrowPad), kept
 * on the device under `duelz-arrow-control`. The Attention overhaul (15 Nov 2026) moved Labyrinth's switch off the
 * pad and into the game menu and Settings → Game controls: every change goes through `setDirectionControls`, which
 * tells every pad on screen at once. Device storage only.
 *
 * The Pattern overhaul built the same store at the same time (lib/arrowControl.ts, the same key); since the puzzle
 * train combine (16 Nov 2026) these names are that store's, so the game menu, Settings and every pad share one key and
 * one change event.
 */
import { ARROW_CONTROL_KEY, onArrowControlChange, readArrowControl, setArrowControl, useArrowControl, type ArrowControl } from "./arrowControl";

export type DirectionControls = ArrowControl;
export const DIRECTION_CONTROLS_KEY = ARROW_CONTROL_KEY;

/** Games whose arrow-pad switch lives in the game menu (and Settings), not beside the pad. */
export const MENU_DIRECTION_GAMES: readonly string[] = ["maze"];

export function readDirectionControls(): DirectionControls {
  return readArrowControl();
}

export function setDirectionControls(value: DirectionControls): void {
  setArrowControl(value);
}

/** Calls `fn` with the new choice whenever it changes (the menu, Settings, or another pad). */
export function onDirectionControls(fn: (value: DirectionControls) => void): () => void {
  return onArrowControlChange(fn);
}

export function useDirectionControls(): [DirectionControls, (value: DirectionControls) => void] {
  return [useArrowControl(), setDirectionControls];
}
