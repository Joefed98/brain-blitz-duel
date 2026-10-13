/**
 * Word Search rules, shared by the phone (line snapping) and the server
 * (live checks and grading). A selection is a straight line in one of eight
 * directions; it counts only when its cells exactly match a stored placement,
 * forwards or backwards. The client's idea of which words it found is never used.
 */

import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { WordSearchPlacement } from "./types";

export const WS_SIZE = 10;
export const WS_WORDS = 6;
const MAX_SELECTIONS = 300;

/** Cells of the straight line start → end, or null if it is not one of the eight directions. */
export function wsLine(start: number, end: number, size: number): number[] | null {
  const r0 = Math.floor(start / size);
  const c0 = start % size;
  const r1 = Math.floor(end / size);
  const c1 = end % size;
  if ([r0, c0, r1, c1].some((v) => v < 0 || v >= size)) return null;
  const dr = r1 - r0;
  const dc = c1 - c0;
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  return Array.from({ length: len + 1 }, (_, i) => (r0 + sr * i) * size + (c0 + sc * i));
}

/** The phone's drag: snaps the finger to the nearest of the eight directions. */
export function wsSnapLine(start: number, current: number, size: number): number[] {
  const r0 = Math.floor(start / size);
  const c0 = start % size;
  const dr = Math.floor(current / size) - r0;
  const dc = (current % size) - c0;
  if (dr === 0 && dc === 0) return [start];
  const octant = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  const angle = (octant * Math.PI) / 4;
  const sr = Math.round(Math.sin(angle));
  const sc = Math.round(Math.cos(angle));
  let len = Math.max(Math.abs(dr), Math.abs(dc));
  while (len > 0) {
    const r = r0 + sr * len;
    const c = c0 + sc * len;
    if (r >= 0 && r < size && c >= 0 && c < size) break;
    len--;
  }
  return Array.from({ length: len + 1 }, (_, i) => (r0 + sr * i) * size + (c0 + sc * i));
}

/** Index of the placement these cells exactly cover (either way round), or -1. */
export function wsMatch(placements: readonly WordSearchPlacement[], cells: readonly number[]): number {
  const key = cells.join(".");
  const back = [...cells].reverse().join(".");
  return placements.findIndex((p) => {
    const k = p.cells.join(".");
    return k === key || k === back;
  });
}

/** "start.end,start.end" — one pair per selection. */
export function wsEncode(selections: readonly number[][]): string {
  return selections.map((cells) => `${cells[0]}.${cells[cells.length - 1]}`).join(",");
}

export function wsDecode(answer: string, size: number): number[][] {
  const out: number[][] = [];
  for (const part of String(answer ?? "").split(",").slice(0, MAX_SELECTIONS)) {
    const m = /^(\d{1,3})\.(\d{1,3})$/.exec(part);
    if (!m) continue;
    const line = wsLine(Number(m[1]), Number(m[2]), size);
    if (line && line.length >= 2) out.push(line);
  }
  return out;
}

/** Found placement indices and selections that matched no hidden word. */
export function wsGrade(
  placements: readonly WordSearchPlacement[],
  selections: readonly number[][],
): { found: number[]; wrong: number } {
  const found = new Set<number>();
  let wrong = 0;
  for (const cells of selections) {
    const i = wsMatch(placements, cells);
    if (i < 0) wrong++;
    else found.add(i);
  }
  return { found: [...found].sort((a, b) => a - b), wrong };
}

/** Live check of one drag, against the private placements. */
export function checkWordSearchPath(
  placements: readonly WordSearchPlacement[],
  size: number,
  path: readonly number[],
  already: readonly string[],
): { valid: boolean; points: number; word: string; reason?: string } {
  const line = path.length >= 2 ? wsLine(path[0]!, path[path.length - 1]!, size) : null;
  if (!line || line.join(".") !== path.join(".")) return { valid: false, points: 0, word: "", reason: "Not a line" };
  const i = wsMatch(placements, line);
  if (i < 0) return { valid: false, points: 0, word: "", reason: "Not a hidden word" };
  const word = placements[i]!.word;
  if (already.map((w) => w.toUpperCase()).includes(word)) {
    return { valid: false, points: 0, word, reason: "Already found" };
  }
  return { valid: true, points: 0, word };
}

/**
 * All six found: 130 + round(20 × ms left ÷ registry limit), capped at 150.
 * Otherwise: 20 per word. Wrong selections never affect the score.
 */
/** Lookout rev 1: wrong selections beyond this many cost WS_REV1_WRONG_PENALTY each (unfinished credit only). */
export const WS_REV1_FREE_WRONG = 5;
export const WS_REV1_WRONG_PENALTY = 2;

export function scoreWordSearch(
  found: number,
  total: number,
  wrong: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (scoreRev1()) {
    // Rev 1: 120 + PAR(30); unfinished 22 per word (five of six = 110), less 2 per wrong selection beyond the first 5.
    if (found >= total && total > 0) return finishParts(timeLimitMs > 0 ? speedBonusCurve(30, msRemaining, timeLimitMs) : 0);
    return partialParts((110 * Math.max(0, found)) / Math.max(1, total - 1) - WS_REV1_WRONG_PENALTY * Math.max(0, wrong - WS_REV1_FREE_WRONG));
  }
  if (found >= total && total > 0) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 130 + (timeLimitMs > 0 ? speedBonusCurve(20, ms, timeLimitMs) : 0));
  }
  return Math.min(120, 20 * Math.max(0, found));
}
