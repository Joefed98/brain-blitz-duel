/**
 * The first-time explanation of difficulty levels (Joe, 15 Nov 2026): shown once, the first time a player sees a level
 * selector (the Games catalogue's difficulty switch, a game's page or the room settings sheet), wherever that is. Device
 * storage only (`duelz-level-intro:v1`): marked seen as soon as it is drawn, so it never shows again (it stays up for
 * that visit until "Got it"). Without storage it is still shown only once per visit.
 */
import { useEffect, useState } from "react";

export const LEVEL_INTRO_KEY = "duelz-level-intro:v1";

/** The explanation's words (one place, so the screens and the check read the same). */
export const LEVEL_INTRO_TITLE = "Difficulty levels";
export const LEVEL_INTRO_TEXT =
  "Pick Easy, Normal, Hard or Expert. Each level keeps its own best and stars. Rated matches and the Daily are always Normal.";

/** This visit: null until read; "show" while one screen is showing it. */
let memory: "unseen" | "seen" | null = null;
let owner: symbol | null = null;

/** Whether the explanation has been shown on this device. */
export function levelIntroSeen(): boolean {
  if (memory) return memory === "seen";
  try {
    memory = typeof localStorage !== "undefined" && localStorage.getItem(LEVEL_INTRO_KEY) ? "seen" : "unseen";
  } catch {
    memory = "unseen";
  }
  return memory === "seen";
}

/** Marks it shown (on this device for good). */
export function markLevelIntroSeen(): void {
  memory = "seen";
  try {
    localStorage.setItem(LEVEL_INTRO_KEY, new Date().toISOString());
  } catch {
    /* this visit only */
  }
}

/** Checks only: forget this visit's memory (after changing storage under it). */
export function resetLevelIntroMemory(): void {
  memory = null;
  owner = null;
}

/**
 * Claims the explanation for one screen: true the first time any selector asks on a device that hasn't seen it (that
 * screen keeps it until dismissed), false everywhere else. The claim marks it seen at once.
 */
export function claimLevelIntro(who: symbol): boolean {
  if (owner === who) return true;
  if (owner !== null || levelIntroSeen()) return false;
  owner = who;
  markLevelIntroSeen();
  return true;
}

/** Hands the explanation back when its screen dismisses it (it is still seen). */
export function releaseLevelIntro(who: symbol): void {
  if (owner === who) owner = null;
}

/** For a selector's screen: whether to show the explanation (read after the first paint), and dismiss. */
export function useLevelIntro(): { show: boolean; dismiss: () => void } {
  const [who] = useState(() => Symbol("level-intro"));
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (claimLevelIntro(who)) setShow(true);
  }, [who]);
  return {
    show,
    dismiss: () => {
      releaseLevelIntro(who);
      setShow(false);
    },
  };
}
