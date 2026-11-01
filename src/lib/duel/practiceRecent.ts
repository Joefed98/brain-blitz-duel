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
  notePracticeDay();
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

/**
 * Practice games opened per UK day on this device (the computer layout's "Your week" panel, 31 Oct
 * 2026; device storage only, never read by grading or rooms). Kept for the last 14 days.
 */
const DAYS_KEY = "duelz-practice-days:v1";

function dayKeyUk(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function readPracticeDays(): Record<string, number> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DAYS_KEY) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, number] => Number.isFinite(e[1])));
  } catch {
    return {};
  }
}

export function notePracticeDay(now: number = Date.now()): void {
  const days = readPracticeDays();
  const today = dayKeyUk(now);
  days[today] = (days[today] ?? 0) + 1;
  const keep = new Set(Array.from({ length: 14 }, (_, i) => dayKeyUk(now - i * 86_400_000)));
  try {
    window.localStorage.setItem(DAYS_KEY, JSON.stringify(Object.fromEntries(Object.entries(days).filter(([d]) => keep.has(d)))));
  } catch {
    /* session-only when storage is blocked */
  }
}

/** Practice games opened in the last seven UK days, today included. */
export function practiceThisWeek(now: number = Date.now()): number {
  const days = readPracticeDays();
  let n = 0;
  for (let i = 0; i < 7; i++) n += days[dayKeyUk(now - i * 86_400_000)] ?? 0;
  return n;
}
