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
/** Locked rows needed before the last row's tiles can be swapped (on Normal's 5 × 5; a level grid's: its size − 1). */
export const WS_SWAP_LOCKED = WS_SIZE - 1;

/**
 * Slider's levels (D1, 21 Nov 2026; wordSlideRev 7, level deals only): the grid size is the ladder (Easy 4 × 4, Normal
 * 5 × 5, Hard 6 × 6, Expert 7 × 7), stored on the puzzle as `size`; every rule reads it through `wordSlideSize`, so a
 * puzzle without the stamp (Normal and every older round) is 5 × 5 exactly as before.
 */
export const WORD_SLIDE_REV_SIZED = 7;
export const WS_LEVEL_SIZES = [4, 5, 6, 7] as const;
export function wordSlideSize(puzzle: { wordSlideRev?: number; size?: number } | null | undefined): number {
  if (wordSlideRevOf(puzzle) < WORD_SLIDE_REV_SIZED) return WS_SIZE;
  const n = puzzle?.size;
  return typeof n === "number" && (WS_LEVEL_SIZES as readonly number[]).includes(n) ? n : WS_SIZE;
}
/** A drawn grid's side from its tiles (16, 25, 36 or 49); anything else is Normal's 5 (display only). */
export function slideGridSide(grid: readonly unknown[] | null | undefined): number {
  const n = grid?.length ?? 0;
  return n === 16 ? 4 : n === 36 ? 6 : n === 49 ? 7 : WS_SIZE;
}
/** The rows of a grid of `size` (Normal's WS_MARKED_ROWS at 5). */
export function wsRows(size: number = WS_SIZE): readonly number[] {
  return size === WS_SIZE ? WS_MARKED_ROWS : Array.from({ length: size }, (_, r) => r);
}

export interface SlideReplayRules {
  /** wordSlideRev 4: swap tokens apply (with four rows locked). */
  swaps?: boolean;
  /** wordSlideRev 7: the grid's size (Normal's 5 when absent). */
  size?: number;
  /**
   * The server's dictionary: a swap applies only while every locked row reads as a word (the phone only lets a
   * word row lock, so an honest log always passes). Without it (the phone's own replay), the four locks suffice.
   */
  isWord?: (word: string) => boolean;
}

/** The one row a swap moves tiles in, or null when swaps are not open (fewer or more than four rows locked). */
export function slideSwapRow(locked: ReadonlySet<number>, size: number = WS_SIZE): number | null {
  if (locked.size !== size - 1) return null;
  for (let r = 0; r < size; r++) if (!locked.has(r)) return r;
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

/** A token on a grid of `size` (Normal's 5: rows and columns 0–4; a level grid's up to 0–6); anything else is null. */
export function parseToken(token: string, size: number = WS_SIZE): SlideToken | null {
  if (token === "U" || token === "X") return token;
  const fits = (d: string) => Number(d) < size;
  const swap = /^S([0-6])([0-6])$/.exec(token);
  if (swap) return swap[1] === swap[2] || !fits(swap[1]!) || !fits(swap[2]!) ? null : { swap: [Number(swap[1]), Number(swap[2])] };
  const lock = /^L([0-6])$/.exec(token);
  if (lock) return fits(lock[1]!) ? { lock: Number(lock[1]) } : null;
  const match = /^([rc])([0-6])([+-])$/.exec(token);
  if (!match || !fits(match[2]!)) return null;
  return { axis: match[1] as "r" | "c", index: Number(match[2]), dir: match[3] === "+" ? 1 : -1 };
}

export function decodeSlideTokens(raw: string, size: number = WS_SIZE): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(",")
    .slice(0, 600)
    .filter((t) => parseToken(t, size) !== null);
}

/** Shift one row (right = +1) or column (down = +1) by one, with wrap-around.
 * Locked rows never move; a column cycles only its unlocked cells. */
export function applyShift(grid: string[], shift: SlideShift, locked: ReadonlySet<number> = new Set(), size: number = WS_SIZE): string[] {
  const next = [...grid];
  if (shift.axis === "r" && locked.has(shift.index)) return next;
  if (shift.axis === "c" && locked.size) {
    const rows = Array.from({ length: size }, (_, r) => r).filter((r) => !locked.has(r));
    const n = rows.length;
    rows.forEach((r, k) => {
      const from = rows[(k - shift.dir + n) % n]!;
      next[r * size + shift.index] = grid[from * size + shift.index]!;
    });
    return next;
  }
  for (let k = 0; k < size; k++) {
    const from = (k - shift.dir + size) % size;
    if (shift.axis === "r") next[shift.index * size + k] = grid[shift.index * size + from]!;
    else next[k * size + shift.index] = grid[from * size + shift.index]!;
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
  const size = rules.size ?? WS_SIZE;
  const dropChanged = (before: string[], after: string[]) => {
    for (const r of [...locked]) if (markedRowWord(before, r, size) !== markedRowWord(after, r, size)) locked.delete(r);
  };
  for (const token of tokens) {
    const parsed = parseToken(token, size);
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
      const row = rules.swaps ? slideSwapRow(locked, size) : null;
      if (row === null) continue;
      if (rules.isWord && [...locked].some((r) => !rules.isWord!(markedRowWord(current, r, size)))) continue;
      const next = [...current];
      const [a, b] = parsed.swap;
      next[row * size + a] = current[row * size + b]!;
      next[row * size + b] = current[row * size + a]!;
      history.push(next);
      moves++;
      continue;
    }
    if (parsed.axis === "r" && locked.has(parsed.index)) continue;
    history.push(applyShift(current, parsed, locked, size));
    moves++;
  }
  return { grid: history[history.length - 1]!, moves, locked: [...locked].sort() };
}

export function markedRowWord(grid: string[], row: number, size: number = WS_SIZE): string {
  return grid.slice(row * size, row * size + size).join("");
}
