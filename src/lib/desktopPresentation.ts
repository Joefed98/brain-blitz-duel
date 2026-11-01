import { createContext, useContext } from "react";

import type { DesktopMode, RotatedKeys } from "@/lib/duel/desktopModes";

/**
 * The game's desktop presentation (31 Oct 2026, presentation and input mapping only;
 * docs/desktop-layout.md): set by PhoneShell on a game screen at the desktop breakpoint, null
 * everywhere else (phones, tablets, pages). `rotate` is true on a rotate game's live round only: its
 * ArcadeArenaSlot draws the world turned 90° clockwise, pointer positions map back through
 * tapMapping.ts `arenaPointer`, swipes through `arenaDelta`, and `keys` names the keys useGameKeys turns.
 */
export interface DesktopPresentationValue {
  mode: DesktopMode | null;
  rotate: boolean;
  keys: RotatedKeys | null;
}

export const DesktopPresentation = createContext<DesktopPresentationValue>({ mode: null, rotate: false, keys: null });

export function useDesktopPresentation(): DesktopPresentationValue {
  return useContext(DesktopPresentation);
}

/**
 * A key on a rotated screen, as the world sees it. The world is turned 90° clockwise, so the world's
 * up points right on screen, its right points down, its down left and its left up: a key pressed for
 * a screen direction becomes the world direction that moves that way on screen. Other keys pass as
 * they are. `keys` "arrows" turns only the arrow keys, "all" WASD too.
 */
export function rotatedKey(key: string, keys: RotatedKeys | null): string {
  if (!keys) return key;
  const arrows: Record<string, string> = { ArrowRight: "ArrowUp", ArrowDown: "ArrowRight", ArrowLeft: "ArrowDown", ArrowUp: "ArrowLeft" };
  if (arrows[key]) return arrows[key]!;
  if (keys === "all") {
    const letters: Record<string, string> = { d: "w", s: "d", a: "s", w: "a" };
    if (letters[key]) return letters[key]!;
  }
  return key;
}
