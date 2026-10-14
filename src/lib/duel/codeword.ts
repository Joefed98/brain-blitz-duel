/**
 * Cryptogrid (codeword) rules, shared by the phone (board, reveal) and the
 * server (live check, grading, bank build).
 *
 * The answer is the action list: "12E" puts E on number 12 (taking E off any
 * other number), "12-" clears number 12. Given numbers never change, and a
 * given letter cannot be put on another number.
 */

import { partialParts, scoreRev1 } from "./puzzleScoreRev";
import { standardComplete } from "./scoring";

/**
 * Rules revision stamped on new boards. Rev 1: the bank entry's four givens.
 * Rev 2 (14 Oct 2026): a fifth given, picked from the same bank entry
 * (codewordFromEntry); grading, the live check and the reveal read the stored
 * givens, so rev-1 rounds replay exactly as before.
 */
export const CODEWORD_REV = 2;
export const CW_SIZE = 7;
/** Givens in every bank entry (and on rev-1 boards). */
export const CW_GIVENS = 4;

/** Numbers that start decoded on a board of this revision. */
export function codewordGivensFor(rev: number): number {
  return rev >= 2 ? CW_GIVENS + 1 : CW_GIVENS;
}
export const CW_MIN_LETTERS = 14;
export const CW_MAX_LETTERS = 18;
/** Answer strings stay well inside the grader's 4,000-character cap; the phone compacts longer lists. */
export const CW_MAX_ACTIONS = 900;

export type CwAction = { n: number; letter: string | null };

export function encodeCwAction(action: CwAction): string {
  return `${action.n}${action.letter ?? "-"}`;
}

export function encodeCodeword(actions: readonly CwAction[]): string {
  return actions.map(encodeCwAction).join(",");
}

export function decodeCodeword(answer: string, numbers: number): CwAction[] {
  const out: CwAction[] = [];
  for (const raw of String(answer ?? "").split(",").slice(0, CW_MAX_ACTIONS)) {
    const m = /^(\d{1,2})([A-Z]|-)$/.exec(raw.trim().toUpperCase());
    if (!m) continue;
    const n = Number(m[1]);
    if (n < 1 || n > numbers) continue;
    out.push({ n, letter: m[2] === "-" ? null : m[2]! });
  }
  return out;
}

/** Letter on each number (index n − 1), "" when empty. Givens are always set. */
export function replayCodeword(
  numbers: number,
  givens: readonly { n: number; letter: string }[],
  actions: readonly CwAction[],
): string[] {
  const letters = Array.from({ length: numbers }, () => "");
  const givenNumbers = new Set<number>();
  const givenLetters = new Set<string>();
  for (const g of givens) {
    letters[g.n - 1] = g.letter;
    givenNumbers.add(g.n);
    givenLetters.add(g.letter);
  }
  for (const { n, letter } of actions) {
    if (givenNumbers.has(n)) continue;
    if (letter === null) {
      letters[n - 1] = "";
      continue;
    }
    if (givenLetters.has(letter)) continue;
    const other = letters.indexOf(letter);
    if (other >= 0) letters[other] = "";
    letters[n - 1] = letter;
  }
  return letters;
}

/** The shortest action list that rebuilds this assignment (the phone's compaction). */
export function compactCodeword(letters: readonly string[], givens: readonly { n: number }[]): CwAction[] {
  const given = new Set(givens.map((g) => g.n));
  return letters.flatMap((letter, i) => (letter && !given.has(i + 1) ? [{ n: i + 1, letter }] : []));
}

export interface CwTally {
  /** Hidden (not given) numbers carrying their right letter. */
  correct: number;
  hidden: number;
  /** Hidden numbers carrying a wrong letter. */
  wrong?: number;
  /** Every number filled. */
  complete: boolean;
  solved: boolean;
}

export function codewordTally(
  letters: readonly string[],
  solution: string,
  givens: readonly { n: number }[],
): CwTally {
  const given = new Set(givens.map((g) => g.n));
  let correct = 0;
  let hidden = 0;
  let wrong = 0;
  for (let i = 0; i < solution.length; i++) {
    if (given.has(i + 1)) continue;
    hidden++;
    if (letters[i] === solution[i]) correct++;
    else if (letters[i]) wrong++;
  }
  return {
    correct,
    hidden,
    wrong,
    complete: letters.every((l) => l !== ""),
    solved: solution.length > 0 && letters.every((l, i) => l === solution[i]),
  };
}

/** Cryptogrid rev 1: cost of each wrong letter left on a number (unfinished credit only). */
export const CODEWORD_REV1_WRONG_PENALTY = 5;

/** Solved: 130 + SPEED(20) (Shape A). Otherwise round(110 × correct ÷ hidden); wrong letters cost nothing. */
export function scoreCodeword(tally: CwTally, msRemaining: number, timeLimitMs: number): number {
  if (tally.solved) return standardComplete(msRemaining, timeLimitMs);
  if (tally.hidden <= 0) return 0;
  // Rev 1: every number but one right is the 110 top; each wrong letter still standing costs 5 (as in Mosaic).
  if (scoreRev1()) return partialParts((110 * tally.correct) / Math.max(1, tally.hidden - 1) - CODEWORD_REV1_WRONG_PENALTY * (tally.wrong ?? 0));
  return Math.min(110, Math.round((110 * tally.correct) / tally.hidden));
}

export interface CwRun {
  across: boolean;
  /** Grid cells, in reading order. */
  cells: number[];
}

/** Every across and down run of two or more white cells. */
export function codewordRuns(cells: readonly number[], size: number): CwRun[] {
  const runs: CwRun[] = [];
  for (const across of [true, false]) {
    for (let line = 0; line < size; line++) {
      let run: number[] = [];
      for (let k = 0; k <= size; k++) {
        const cell = k < size ? (across ? line * size + k : k * size + line) : -1;
        if (cell >= 0 && cells[cell]! > 0) run.push(cell);
        else {
          if (run.length >= 2) runs.push({ across, cells: run });
          run = [];
        }
      }
    }
  }
  return runs;
}

/** The phone's view after it fills the last number: solved or not, nothing more. */
export interface CwView {
  complete: boolean;
  solved: boolean;
  count: number;
}
