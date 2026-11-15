import { createContext, useContext, useState } from "react";

import { GAME_HEADER_STYLE, HEADER_STYLES, type HeaderStyle } from "@/config/gameFrameConfig";
import { checkOverride } from "@/lib/checkOverride";

/** Development only: /dev-design's picker stores a style here so Joe can play every game in it. */
export const DEV_HEADER_STYLE_KEY = "duelz-dev-header-style";

/**
 * The header style in force: GAME_HEADER_STYLE, except a check's stand-in (window.__DUELZ_HEADER_STYLE__) or, in a
 * development build only, /dev-design's choice. A production build reads only the config.
 */
export function headerStyleNow(): HeaderStyle {
  const forced = checkOverride<string>("__DUELZ_HEADER_STYLE__");
  if (forced && (HEADER_STYLES as readonly string[]).includes(forced)) return forced as HeaderStyle;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    try {
      const dev = window.localStorage.getItem(DEV_HEADER_STYLE_KEY);
      if (dev && (HEADER_STYLES as readonly string[]).includes(dev)) return dev as HeaderStyle;
    } catch {
      /* the config's */
    }
  }
  return GAME_HEADER_STYLE;
}

/** Read once per mount (the header never changes style while it is up). */
export function useHeaderStyle(): HeaderStyle {
  return useState(headerStyleNow)[0];
}

/** How a TimerBar draws: one of the header styles, or "panel" (the arena's side panel). */
export type TimerLook = "bar" | "ring" | "digital" | "chip" | "panel";

export const TIMER_LOOK: Record<HeaderStyle, TimerLook> = { mockup: "bar", ring: "ring", digital: "digital", chip: "chip" };

/** Set by GameLayout (the header) and the arena panel; a TimerBar outside either draws the ring. */
export const TimerLookContext = createContext<TimerLook>("ring");
export const useTimerLook = () => useContext(TimerLookContext);

/** m:ss for the digital looks. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
