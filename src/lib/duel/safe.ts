/**
 * Safe Cracker: the clue grammar and how a set of dials is checked against it.
 * The clues themselves are public — they are printed on the card — while the
 * combination stays in the private half of the puzzle until the reveal.
 */

import { SAFE_DIALS } from "./types";

export type SafeClueKind =
  | "even"
  | "odd"
  | "greater"
  | "less"
  | "sum2"
  | "diff2"
  | "double"
  | "alldiff"
  | "prime"
  | "square"
  | "sumall"
  | "differby";

export interface SafeClue {
  kind: SafeClueKind;
  /** First dial the clue talks about, 0-indexed. */
  a?: number;
  /** Second dial, where the clue uses one. */
  b?: number;
  /** The number in the clue, where it has one. */
  value?: number;
  /** The exact line shown on the clue card. */
  text: string;
}

/** ①②③④ — how the clue card names each dial. */
export const DIAL_MARKS = ["①", "②", "③", "④"];

const PRIMES = new Set([2, 3, 5, 7]);
const SQUARES = new Set([0, 1, 4, 9]);

export function clueText(clue: Omit<SafeClue, "text">): string {
  const a = DIAL_MARKS[clue.a ?? 0];
  const b = DIAL_MARKS[clue.b ?? 0];
  switch (clue.kind) {
    case "even":
      return `${a} is even`;
    case "odd":
      return `${a} is odd`;
    case "greater":
      return `${a} is greater than ${b}`;
    case "less":
      return `${a} is less than ${b}`;
    case "sum2":
      return `${a} + ${b} = ${clue.value}`;
    case "diff2":
      return `${a} − ${b} = ${clue.value}`;
    case "double":
      return `${b} is double ${a}`;
    case "alldiff":
      return "No two dials show the same digit";
    case "prime":
      return `${a} is a prime`;
    case "square":
      return `${a} is a square number (0, 1, 4, 9)`;
    case "sumall":
      return `The dials add up to ${clue.value}`;
    case "differby":
      return `${a} and ${b} differ by exactly ${clue.value}`;
  }
}

/** Does this set of dials satisfy the clue? */
export function clueHolds(clue: SafeClue, dials: number[]): boolean {
  const a = dials[clue.a ?? 0] ?? 0;
  const b = dials[clue.b ?? 0] ?? 0;
  switch (clue.kind) {
    case "even":
      return a % 2 === 0;
    case "odd":
      return a % 2 === 1;
    case "greater":
      return a > b;
    case "less":
      return a < b;
    case "sum2":
      return a + b === clue.value;
    case "diff2":
      return a - b === clue.value;
    case "double":
      return b === a * 2;
    case "alldiff":
      return new Set(dials).size === dials.length;
    case "prime":
      return PRIMES.has(a);
    case "square":
      return SQUARES.has(a);
    case "sumall":
      return dials.reduce((sum, digit) => sum + digit, 0) === clue.value;
    case "differby":
      return Math.abs(a - b) === clue.value;
  }
}

function digitsOf(value: number): number[] {
  const dials: number[] = [];
  let left = value;
  for (let dial = SAFE_DIALS - 1; dial >= 0; dial--) {
    dials[dial] = left % 10;
    left = Math.floor(left / 10);
  }
  return dials;
}

/** Every combination the clue set allows, stopping once `limit` are found. */
export function safeSolutions(clues: SafeClue[], limit = 2): number[][] {
  const found: number[][] = [];
  const total = 10 ** SAFE_DIALS;
  for (let value = 0; value < total; value++) {
    const dials = digitsOf(value);
    if (clues.every((clue) => clueHolds(clue, dials))) {
      found.push(dials);
      if (found.length >= limit) return found;
    }
  }
  return found;
}

export function encodeSafeTries(tries: number[][]): string {
  return tries.map((dials) => dials.join("")).join(",");
}

/**
 * puzzleScoreRev 2 drafts (score bands, 19 Oct 2026): the tries, then ";" and the dials as they stand when the
 * clock ran out (never a try: they cannot open the safe, but their right dials count as progress).
 */
export function encodeSafeDraft(tries: number[][], dials: number[]): string {
  return `${encodeSafeTries(tries)};${dials.join("")}`;
}

/** The dials left standing in a rev-2 draft (null when the answer has none). */
export function decodeSafePending(raw: string): number[] | null {
  const at = (raw ?? "").indexOf(";");
  if (at < 0) return null;
  const part = raw.slice(at + 1).trim();
  return part.length === SAFE_DIALS && /^\d+$/.test(part) ? part.split("").map((d) => Number.parseInt(d, 10)) : null;
}

export function decodeSafeTries(raw: string): number[][] {
  return (raw ?? "").split(";")[0]!
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length === SAFE_DIALS && /^\d+$/.test(part))
    .map((part) => part.split("").map((digit) => Number.parseInt(digit, 10)))
    .slice(0, 3);
}

export function dialsCorrect(dials: number[], combination: number[]): number {
  return combination.filter((digit, index) => dials[index] === digit).length;
}

/** Which try opened the safe (1-based), or 0 when none did. */
export function safeOpenedOn(tries: number[][], combination: number[]): number {
  for (let index = 0; index < tries.length; index++) {
    if (dialsCorrect(tries[index]!, combination) === combination.length) return index + 1;
  }
  return 0;
}
