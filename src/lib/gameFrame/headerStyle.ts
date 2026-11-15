import { createContext, useContext, useSyncExternalStore } from "react";

import { DEFAULT_GAME_TIMER, GAME_TIMERS, type GameTimer } from "@/config/gameFrameConfig";
import { checkOverride } from "@/lib/checkOverride";

/**
 * The game timer the player chose (Settings → Appearance → Game timer; src/config/gameFrameConfig.ts), kept on this
 * device like the other appearance settings. A check can stand one in (window.__DUELZ_GAME_TIMER__); a production
 * build reads only the stored choice and the default.
 */
export const GAME_TIMER_KEY = "duelz-game-timer:v1";
const EVENT = "duelz-game-timer-change";

const isTimer = (v: unknown): v is GameTimer => typeof v === "string" && (GAME_TIMERS as readonly string[]).includes(v);

export function gameTimerNow(): GameTimer {
  const forced = checkOverride<string>("__DUELZ_GAME_TIMER__");
  if (isTimer(forced)) return forced;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(GAME_TIMER_KEY);
      if (isTimer(stored)) return stored;
    } catch {
      /* the default */
    }
  }
  return DEFAULT_GAME_TIMER;
}

export function setGameTimer(choice: GameTimer): void {
  if (!isTimer(choice)) return;
  try {
    window.localStorage.setItem(GAME_TIMER_KEY, choice);
  } catch {
    /* this visit only */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const storage = (e: StorageEvent) => e.key === GAME_TIMER_KEY && fn();
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", storage);
  };
}

/** The player's game timer, kept current as Settings changes it. */
export function useGameTimer(): GameTimer {
  return useSyncExternalStore(subscribe, gameTimerNow, () => DEFAULT_GAME_TIMER);
}

/** Where a TimerBar draws: the header, or the arena's side panel (larger). */
export type TimerPlace = "header" | "panel";
export interface TimerLook {
  kind: GameTimer;
  place: TimerPlace;
}

/** Set by GameLayout (the header) and the arena panel; a TimerBar outside either draws the ring. */
export const TimerLookContext = createContext<TimerLook>({ kind: "ring", place: "header" });
export const useTimerLook = () => useContext(TimerLookContext);

/** The bar shows its seconds only in the last ten (the red end); the ring and chip always show them. */
export const BAR_SECONDS_FROM_MS = 10_000;

/** m:ss for the chip. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
