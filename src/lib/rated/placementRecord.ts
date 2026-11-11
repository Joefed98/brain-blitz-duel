/**
 * The placement boxes' wins and losses (mockups 11 and 12). W3a's `PlacementStatus` says how many placement matches
 * were played, not how each went, so this device remembers the result of each placement match it settled (by match
 * id, from W3a's own answer on W3b's settlement). A match played on another device shows as played with no tick or
 * cross; nothing is ever guessed. Device storage only; never read by matching, rating or scoring.
 */
import type { PlacementResult } from "./backend";

const KEY = "duelz-rated-placement:v1:";

type Stored = { id: string; r: "won" | "lost" | "drawn" }[];

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read(userId: string): Stored {
  try {
    const raw = store()?.getItem(KEY + userId);
    const list = raw ? (JSON.parse(raw) as Stored) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.id === "string" && ["won", "lost", "drawn"].includes(e.r)) : [];
  } catch {
    return [];
  }
}

/** Notes a settled placement match's result (once per match). */
export function notePlacementResult(userId: string, matchId: string, result: "won" | "lost" | "drawn"): void {
  const list = read(userId);
  if (list.some((e) => e.id === matchId)) return;
  list.push({ id: matchId, r: result });
  try {
    store()?.setItem(KEY + userId, JSON.stringify(list.slice(-5)));
  } catch {
    /* storage blocked */
  }
}

/**
 * One entry per placement match played: the remembered results, oldest first, laid on the last `played` matches; the
 * rest (played elsewhere) are null.
 */
export function placementResults(userId: string, played: number): PlacementResult[] {
  const known = read(userId).slice(-played).map((e) => e.r);
  const unknown = Math.max(0, played - known.length);
  return [...Array.from({ length: unknown }, () => null), ...known];
}

/** Placement is done: the record is no longer needed. */
export function clearPlacementRecord(userId: string): void {
  try {
    store()?.removeItem(KEY + userId);
  } catch {
    /* storage blocked */
  }
}
