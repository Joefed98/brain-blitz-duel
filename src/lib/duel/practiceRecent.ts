/**
 * The games this device last opened in practice, newest first (the Play tab's "Warm up" tiles).
 * Device storage only, like practiceBest.ts; never read by grading or rooms.
 */
import { isLiveType } from "./registry";
import type { PuzzleType } from "./types";

const KEY = "duelz-practice-recent:v1";
const KEEP = 12;
let memory: string[] | null = null;

export function recentPracticeTypes(): string[] {
  if (memory) return memory;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    memory = Array.isArray(raw) ? raw.filter((t): t is string => typeof t === "string") : [];
  } catch {
    memory = [];
  }
  return memory;
}

export function notePracticePlayed(type: string): void {
  memory = [type, ...recentPracticeTypes().filter((t) => t !== type)].slice(0, KEEP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* session-only when storage is blocked */
  }
}

/** Warm up's three tiles before this device has played anything in practice. */
export const WARM_UP_DEFAULTS: PuzzleType[] = ["unblock", "hover", "lightsout"];

/** This device's three most recently played practice games, filled from the fixed three. */
export function warmUpTypes(recent: readonly string[]): PuzzleType[] {
  const out: PuzzleType[] = [];
  for (const type of [...recent, ...WARM_UP_DEFAULTS]) {
    if (out.length === 3) break;
    if (isLiveType(type) && !out.includes(type)) out.push(type);
  }
  return out;
}
