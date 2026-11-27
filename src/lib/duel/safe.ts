/**
 * Safe Cracker: the clue grammar and how a set of dials is checked against it.
 * The clues themselves are public — they are printed on the card — while the
 * combination stays in the private half of the puzzle until the reveal.
 */

import { SAFE_DIALS, SAFE_TRIES } from "./types";

/**
 * A card's shape (the Logic overhaul's levels, 15 Nov 2026): how many dials, the highest number a dial shows and the
 * tries allowed. A puzzle without its own (every round before levels, and Normal) is today's: four dials of 0–9,
 * three tries. A dial that goes past 9 is written with two digits in an answer ("07"), so tries stay one string each.
 */
export interface SafeShape {
  dials: number;
  max: number;
  tries: number;
}
export const SAFE_SHAPE_TODAY: SafeShape = { dials: SAFE_DIALS, max: 9, tries: SAFE_TRIES };

/** A stored puzzle's card shape. */
export function safeShapeOf(puzzle: { dialCount?: number; dialMax?: number; tries?: number } | null | undefined): SafeShape {
  if (!puzzle || (puzzle.dialCount === undefined && puzzle.dialMax === undefined && puzzle.tries === undefined)) return SAFE_SHAPE_TODAY;
  return { dials: puzzle.dialCount ?? SAFE_DIALS, max: puzzle.dialMax ?? 9, tries: puzzle.tries ?? SAFE_TRIES };
}

const widthOf = (shape: SafeShape) => (shape.max > 9 ? 2 : 1);

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
export const DIAL_MARKS = ["①", "②", "③", "④", "⑤", "⑥"];

/** Up to 20 (Expert's highest dial); on 0–9 dials these are today's sets. */
const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19]);
const SQUARES = new Set([0, 1, 4, 9, 16]);

export function clueText(clue: Omit<SafeClue, "text">, shape: SafeShape = SAFE_SHAPE_TODAY): string {
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
      return shape.max >= 16 ? `${a} is a square number (0, 1, 4, 9, 16)` : `${a} is a square number (0, 1, 4, 9)`;
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
export function safeSolutions(clues: SafeClue[], limit = 2, shape: SafeShape = SAFE_SHAPE_TODAY): number[][] {
  if (shape !== SAFE_SHAPE_TODAY && (shape.dials !== SAFE_DIALS || shape.max !== 9)) return safeSearch(clues, limit, shape);
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

/**
 * Every combination on a level's card, by depth-first search over the dials in order: a clue is tested as soon as
 * every dial it names is set (a sum of all, or all different, once the last is), so the search stays small even on
 * Expert's 21^5 codes. Finds the same set as a full sweep (logic-1-levels-check compares them).
 */
function safeSearch(clues: SafeClue[], limit: number, shape: SafeShape): number[][] {
  const found: number[][] = [];
  const dials = new Array<number>(shape.dials).fill(0);
  const ready = (clue: SafeClue): number => {
    if (clue.kind === "alldiff" || clue.kind === "sumall") return shape.dials - 1;
    return Math.max(clue.a ?? 0, clue.b ?? 0);
  };
  const byDial: SafeClue[][] = Array.from({ length: shape.dials }, () => []);
  for (const clue of clues) byDial[ready(clue)]!.push(clue);
  const walk = (i: number): void => {
    if (found.length >= limit) return;
    if (i === shape.dials) {
      found.push([...dials]);
      return;
    }
    for (let v = 0; v <= shape.max; v++) {
      dials[i] = v;
      if (byDial[i]!.every((clue) => clueHolds(clue, dials))) walk(i + 1);
      if (found.length >= limit) return;
    }
  };
  walk(0);
  return found;
}

function dialText(digit: number, shape: SafeShape): string {
  return widthOf(shape) === 2 ? String(digit).padStart(2, "0") : String(digit);
}

export function encodeSafeTries(tries: number[][], shape: SafeShape = SAFE_SHAPE_TODAY): string {
  return tries.map((dials) => dials.map((d) => dialText(d, shape)).join("")).join(",");
}

function readDials(part: string, shape: SafeShape): number[] | null {
  const w = widthOf(shape);
  if (part.length !== shape.dials * w || !/^\d+$/.test(part)) return null;
  const out: number[] = [];
  for (let i = 0; i < shape.dials; i++) {
    const v = Number.parseInt(part.slice(i * w, i * w + w), 10);
    if (v > shape.max) return null;
    out.push(v);
  }
  return out;
}

/**
 * puzzleScoreRev 2 drafts (score bands, 19 Oct 2026): the tries, then ";" and the dials as they stand when the
 * clock ran out (never a try: they cannot open the safe, but their right dials count as progress).
 */
export function encodeSafeDraft(tries: number[][], dials: number[], shape: SafeShape = SAFE_SHAPE_TODAY): string {
  return `${encodeSafeTries(tries, shape)};${dials.map((d) => dialText(d, shape)).join("")}`;
}

/** The dials left standing in a rev-2 draft (null when the answer has none). */
export function decodeSafePending(raw: string, shape: SafeShape = SAFE_SHAPE_TODAY): number[] | null {
  const at = (raw ?? "").indexOf(";");
  if (at < 0) return null;
  const part = raw.slice(at + 1).trim();
  if (shape !== SAFE_SHAPE_TODAY) return readDials(part, shape);
  return part.length === SAFE_DIALS && /^\d+$/.test(part) ? part.split("").map((d) => Number.parseInt(d, 10)) : null;
}

export function decodeSafeTries(raw: string, shape: SafeShape = SAFE_SHAPE_TODAY): number[][] {
  if (shape !== SAFE_SHAPE_TODAY)
    return (raw ?? "").split(";")[0]!
      .split(",")
      .map((part) => readDials(part.trim(), shape))
      .filter((dials): dials is number[] => dials !== null)
      .slice(0, shape.tries);
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

/**
 * Safe Cracker after a wrong try (Logic overhaul 1, display only): the clues that try's code broke, by index. Shown only
 * after a Try, never live while the dials turn; an opening try breaks none.
 */
export function brokenClues(clues: readonly SafeClue[], tried: readonly number[] | undefined): number[] {
  if (!tried) return [];
  return clues.flatMap((clue, index) => (clueHolds(clue, tried as number[]) ? [] : [index]));
}
