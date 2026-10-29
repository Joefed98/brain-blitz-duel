/**
 * Word Slide rules, shared by the phone and the server. The answer is a comma
 * list of tokens: "r2+" shifts row 2 right, "c1-" shifts column 1 up, "U" is
 * Undo and "X" is Reset. Undo and Reset never reduce the move count. "L2" locks row 2; on wordSlideRev 4 "S13"
 * swaps two tiles of the last unlocked row.
 */

import type { ParBonusCurve } from "./parBonus";

export const WS_SIZE = 5;
export const WS_MARKED_ROWS = [0, 1, 2, 3, 4] as const;
export const WS_TIME_MS = 100_000;
export const WS_REVEAL_MS = 6_000;
export const WS_SHIFT_MS = 120;

/**
 * Par moves (25 Oct 2026, word depth d1; parBonus.ts): `wordSlideRev 1` puzzles score up to 200, the extra 50 only
 * for a finish in at most `par` moves (the stored scramble's shift count; Undo and Reset count as moves).
 */
export const WORD_SLIDE_REV_PAR = 1;
export const SLIDE_PAR_BONUS: ParBonusCurve = { base: 6, fast: 0.75, elite: 0.95, power: 6 };
/**
 * The puzzle top-up (26 Oct 2026, wordSlideRev 2; docs/depth/topup-oct-2026.md): the same boards and par; making par
 * pays a little more at any pace, so today's near-perfect player lands about 165–175.
 */
export const WORD_SLIDE_REV_TOPUP = 2;
export const SLIDE_PAR_BONUS_TOPUP: ParBonusCurve = { base: 9, fast: 0.75, elite: 0.95, power: 6 };
/** The par bonus a stored round's stamp scores on. */
export function slideParBonusFor(rev: number): ParBonusCurve {
  return rev >= WORD_SLIDE_REV_TOPUP ? SLIDE_PAR_BONUS_TOPUP : SLIDE_PAR_BONUS;
}

/**
 * Joe's phone notes (28 Oct 2026, wordSlideRev 4; src/lib/duel/puzzleNotes.ts): once four rows are made into words
 * and locked, the last row's tiles can be swapped with each other ("S13" swaps columns 1 and 3 of the one unlocked
 * row; a move, undone like any other). Earlier stamps ignore swap tokens, so stored rounds replay as before.
 */
export const WORD_SLIDE_REV_SWAP = 4;
export function slideSwapsOn(puzzle: { wordSlideRev?: number } | null | undefined): boolean {
  return wordSlideRevOf(puzzle) >= WORD_SLIDE_REV_SWAP;
}
/** Locked rows needed before the last row's tiles can be swapped. */
export const WS_SWAP_LOCKED = WS_SIZE - 1;

export interface SlideReplayRules {
  /** wordSlideRev 4: swap tokens apply (with four rows locked). */
  swaps?: boolean;
  /**
   * The server's dictionary: a swap applies only while every locked row reads as a word (the phone only lets a
   * word row lock, so an honest log always passes). Without it (the phone's own replay), the four locks suffice.
   */
  isWord?: (word: string) => boolean;
}

/** The one row a swap moves tiles in, or null when swaps are not open (fewer or more than four rows locked). */
export function slideSwapRow(locked: ReadonlySet<number>): number | null {
  if (locked.size !== WS_SWAP_LOCKED) return null;
  for (let r = 0; r < WS_SIZE; r++) if (!locked.has(r)) return r;
  return null;
}

export function swapToken(a: number, b: number): string {
  return `S${Math.min(a, b)}${Math.max(a, b)}`;
}

/** The puzzle's par-moves stamp (0 = before par moves). */
export function wordSlideRevOf(puzzle: { wordSlideRev?: number } | null | undefined): number {
  const rev = puzzle?.wordSlideRev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}

export interface SlideShift {
  axis: "r" | "c";
  index: number;
  dir: 1 | -1;
}

export function shiftToken(shift: SlideShift): string {
  return `${shift.axis}${shift.index}${shift.dir > 0 ? "+" : "-"}`;
}

export type SlideToken = SlideShift | "U" | "X" | { lock: number } | { swap: [number, number] };

export function parseToken(token: string): SlideToken | null {
  if (token === "U" || token === "X") return token;
  const swap = /^S([0-4])([0-4])$/.exec(token);
  if (swap) return swap[1] === swap[2] ? null : { swap: [Number(swap[1]), Number(swap[2])] };
  const lock = /^L([0-4])$/.exec(token);
  if (lock) return { lock: Number(lock[1]) };
  const match = /^([rc])([0-4])([+-])$/.exec(token);
  if (!match) return null;
  return { axis: match[1] as "r" | "c", index: Number(match[2]), dir: match[3] === "+" ? 1 : -1 };
}

export function decodeSlideTokens(raw: string): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(",")
    .slice(0, 600)
    .filter((t) => parseToken(t) !== null);
}

/** Shift one row (right = +1) or column (down = +1) by one, with wrap-around.
 * Locked rows never move; a column cycles only its unlocked cells. */
export function applyShift(grid: string[], shift: SlideShift, locked: ReadonlySet<number> = new Set()): string[] {
  const next = [...grid];
  if (shift.axis === "r" && locked.has(shift.index)) return next;
  if (shift.axis === "c" && locked.size) {
    const rows = Array.from({ length: WS_SIZE }, (_, r) => r).filter((r) => !locked.has(r));
    const n = rows.length;
    rows.forEach((r, k) => {
      const from = rows[(k - shift.dir + n) % n]!;
      next[r * WS_SIZE + shift.index] = grid[from * WS_SIZE + shift.index]!;
    });
    return next;
  }
  for (let k = 0; k < WS_SIZE; k++) {
    const from = (k - shift.dir + WS_SIZE) % WS_SIZE;
    if (shift.axis === "r") next[shift.index * WS_SIZE + k] = grid[shift.index * WS_SIZE + from]!;
    else next[k * WS_SIZE + shift.index] = grid[from * WS_SIZE + shift.index]!;
  }
  return next;
}

/** "L2" toggles the lock on row 2 (free). Undo/Reset unlock any row whose letters change. */
export function replayWordSlide(
  start: string[],
  tokens: string[],
  rules: SlideReplayRules = {},
): { grid: string[]; moves: number; locked: number[] } {
  const history: string[][] = [start];
  const locked = new Set<number>();
  let moves = 0;
  const dropChanged = (before: string[], after: string[]) => {
    for (const r of [...locked]) if (markedRowWord(before, r) !== markedRowWord(after, r)) locked.delete(r);
  };
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) continue;
    const current = history[history.length - 1]!;
    if (parsed === "U") {
      if (history.length > 1) history.pop();
      dropChanged(current, history[history.length - 1]!);
      moves++;
      continue;
    }
    if (parsed === "X") {
      history.length = 1;
      dropChanged(current, history[0]!);
      moves++;
      continue;
    }
    if ("lock" in parsed) {
      if (locked.has(parsed.lock)) locked.delete(parsed.lock);
      else locked.add(parsed.lock);
      continue;
    }
    if ("swap" in parsed) {
      // wordSlideRev 4 only; anything else (an older stamp, swaps not open, a locked row that is not a word) is ignored.
      const row = rules.swaps ? slideSwapRow(locked) : null;
      if (row === null) continue;
      if (rules.isWord && [...locked].some((r) => !rules.isWord!(markedRowWord(current, r)))) continue;
      const next = [...current];
      const [a, b] = parsed.swap;
      next[row * WS_SIZE + a] = current[row * WS_SIZE + b]!;
      next[row * WS_SIZE + b] = current[row * WS_SIZE + a]!;
      history.push(next);
      moves++;
      continue;
    }
    if (parsed.axis === "r" && locked.has(parsed.index)) continue;
    history.push(applyShift(current, parsed, locked));
    moves++;
  }
  return { grid: history[history.length - 1]!, moves, locked: [...locked].sort() };
}

export function markedRowWord(grid: string[], row: number): string {
  return grid.slice(row * WS_SIZE, row * WS_SIZE + WS_SIZE).join("");
}
