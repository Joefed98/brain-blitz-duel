import { gameDisplayName } from "./gameNames";
import { pick, randInt, shuffled } from "./random";
import type { Operator, TargetNumberPuzzleData, TargetStep } from "./types";

/* -------------------------------------------------------------------------- */
/*  Target Number: six tiles, one three-digit target.                          */
/*                                                                             */
/*  Everything here is pure so the same code can generate a puzzle, check a    */
/*  player's steps on the server, and refuse an illegal tap on the phone.       */
/* -------------------------------------------------------------------------- */

export const TARGET_OPERATORS: Operator[] = ["+", "-", "×", "÷"];
export const TARGET_TILE_COUNT = 6;
export const LARGE_TILES = [25, 50, 75, 100];

/**
 * Applies one step, or returns null when it is not allowed: fractions,
 * negatives and zero are all refused.
 */
export function applyOperation(a: number, b: number, operator: Operator): number | null {
  let result: number;
  switch (operator) {
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    case "×":
      result = a * b;
      break;
    case "÷":
      if (b === 0 || a % b !== 0) return null;
      result = a / b;
      break;
    default:
      return null;
  }
  if (!Number.isInteger(result) || result <= 0) return null;
  return result;
}

export function isOperator(value: unknown): value is Operator {
  return typeof value === "string" && (TARGET_OPERATORS as string[]).includes(value);
}

/** Removes one occurrence of each of two values from a pool. */
function without(pool: number[], firstIndex: number, secondIndex: number): number[] {
  return pool.filter((_, index) => index !== firstIndex && index !== secondIndex);
}

/** Depth-first search for an exact solution. Returns the steps, or null. */
export function solveTarget(tiles: number[], target: number): TargetStep[] | null {
  const seen = new Set<string>();

  function search(pool: number[], steps: TargetStep[]): TargetStep[] | null {
    if (pool.includes(target)) return steps;
    if (pool.length < 2) return null;
    const key = [...pool].sort((a, b) => a - b).join(",");
    if (seen.has(key)) return null;
    seen.add(key);

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i]!;
        const b = pool[j]!;
        const pairs: [number, number][] = [
          [a, b],
          [b, a],
        ];
        for (const operator of TARGET_OPERATORS) {
          // + and × give the same result either way round.
          const ordered = operator === "+" || operator === "×" ? pairs.slice(0, 1) : pairs;
          for (const [left, right] of ordered) {
            const result = applyOperation(left!, right!, operator);
            if (result === null) continue;
            const next = [...without(pool, i, j), result];
            const found = search(next, [...steps, { a: left!, b: right!, operator, result }]);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  return search([...tiles], []);
}

function rollTiles(): number[] {
  const largeCount = pick([1, 2]);
  const large = shuffled(LARGE_TILES).slice(0, largeCount);
  const small = Array.from({ length: TARGET_TILE_COUNT - largeCount }, () => randInt(1, 10));
  return shuffled([...large, ...small]);
}

function popcount(mask: number): number {
  let count = 0;
  for (let m = mask; m !== 0; m >>= 1) count += m & 1;
  return count;
}

/**
 * Same depth-first search as `solveTarget`, but every pooled value carries a
 * bitmask of which original tiles fed into it, so the caller can insist the
 * solution it finally lands on used a particular number of tiles — not just
 * that a chain of steps happens to reach the target.
 */
function solveTargetWithUsage(
  tiles: number[],
  target: number,
  accept: (tilesUsed: number) => boolean,
): TargetStep[] | null {
  const seen = new Set<string>();

  function search(
    pool: { value: number; mask: number }[],
    steps: TargetStep[],
  ): TargetStep[] | null {
    const hit = pool.find((p) => p.value === target && accept(popcount(p.mask)));
    if (hit) return steps;
    if (pool.length < 2) return null;
    const key = pool
      .map((p) => `${p.value}:${p.mask}`)
      .sort()
      .join(",");
    if (seen.has(key)) return null;
    seen.add(key);

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i]!;
        const b = pool[j]!;
        const pairs: [typeof a, typeof b][] = [
          [a, b],
          [b, a],
        ];
        for (const operator of TARGET_OPERATORS) {
          // + and × give the same result either way round.
          const ordered = operator === "+" || operator === "×" ? pairs.slice(0, 1) : pairs;
          for (const [left, right] of ordered) {
            const result = applyOperation(left.value, right.value, operator);
            if (result === null) continue;
            const rest = pool.filter((_, index) => index !== i && index !== j);
            const next = [...rest, { value: result, mask: left.mask | right.mask }];
            const found = search(next, [
              ...steps,
              { a: left.value, b: right.value, operator, result },
            ]);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  return search(
    tiles.map((value, index) => ({ value, mask: 1 << index })),
    [],
  );
}

function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];
  function rec(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      rec(i + 1);
      combo.pop();
    }
  }
  rec(0);
  return result;
}

/**
 * True when the target is reachable using four or fewer of the tiles.
 * Checked exhaustively over every subset of size one to four — cheap enough
 * for six tiles, and it means we never have to trust that a full-pool search
 * happened to spread itself across five or six tiles.
 */
export function hasSolutionWithAtMostFourTiles(tiles: number[], target: number): boolean {
  for (let k = 1; k <= 4; k++) {
    for (const indices of combinations(tiles.length, k)) {
      const subset = indices.map((i) => tiles[i]!);
      if (solveTarget(subset, target)) return true;
    }
  }
  return false;
}

/** Finds a solution that genuinely consumes at least five of the six original tiles. */
export function solveWithAtLeastFiveTiles(tiles: number[], target: number): TargetStep[] | null {
  return solveTargetWithUsage(tiles, target, (used) => used >= 5);
}

/** A target only counts as good when it needs five or six tiles and cannot be shortcut with four or fewer. */
function findFiveTileTarget(tiles: number[], target: number): TargetStep[] | null {
  if (hasSolutionWithAtMostFourTiles(tiles, target)) return null;
  return solveWithAtLeastFiveTiles(tiles, target);
}

/**
 * A safety net for the rare case the main search below runs out of attempts:
 * keep rolling fresh tiles and targets (with a wider range) rather than ever
 * shipping a fixed fallback that might not actually obey the five-tile rule.
 */
function buildFallbackPuzzle(): TargetNumberPuzzleData {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const tiles = rollTiles();
    const target = randInt(100, 999);
    const solution = findFiveTileTarget(tiles, target);
    if (solution) return { type: "target", tiles, target, solution };
  }
  throw new Error(`Unable to construct a valid ${gameDisplayName("target")} puzzle`);
}

/**
 * Only ever returns a puzzle whose stored solution needs at least five of the
 * six tiles, with no shortcut using four or fewer — otherwise it re-rolls.
 */
export function generateTargetPuzzle(): TargetNumberPuzzleData {
  for (let attempt = 0; attempt < 40; attempt++) {
    const tiles = rollTiles();
    for (let tries = 0; tries < 15; tries++) {
      const target = randInt(101, 999);
      const solution = findFiveTileTarget(tiles, target);
      if (solution) {
        return { type: "target", tiles, target, solution };
      }
    }
  }
  return buildFallbackPuzzle();
}

export interface RawStep {
  a: number;
  b: number;
  operator: string;
}

export interface Replay {
  /** The tiles still available after the legal steps were applied. */
  pool: number[];
  steps: TargetStep[];
  /** The value the player ends on: whichever tile is closest to the target. */
  value: number | null;
  distance: number | null;
}

function takeIndex(pool: number[], value: number): number {
  return pool.indexOf(value);
}

/**
 * Replays the steps a client reports against the stored tiles. Every step is
 * re-checked here, and the final value is worked out from the pool — a client's
 * own idea of the result is never trusted.
 */
export function replayTargetSteps(tiles: number[], target: number, rawSteps: unknown): Replay {
  let pool = [...tiles];
  const steps: TargetStep[] = [];
  const list = Array.isArray(rawSteps) ? rawSteps.slice(0, 20) : [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") break;
    const raw = entry as Partial<RawStep>;
    const a = Number(raw.a);
    const b = Number(raw.b);
    if (!Number.isInteger(a) || !Number.isInteger(b) || !isOperator(raw.operator)) break;
    const first = takeIndex(pool, a);
    if (first < 0) break;
    const rest = pool.filter((_, index) => index !== first);
    const second = takeIndex(rest, b);
    if (second < 0) break;
    const result = applyOperation(a, b, raw.operator);
    if (result === null) break;
    pool = [...rest.filter((_, index) => index !== second), result];
    steps.push({ a, b, operator: raw.operator, result });
  }

  let value: number | null = null;
  let distance: number | null = null;
  for (const candidate of pool) {
    const gap = Math.abs(candidate - target);
    if (distance === null || gap < distance) {
      distance = gap;
      value = candidate;
    }
  }
  return { pool, steps, value, distance };
}

/** Wire format: one step per ";", written "a|operator|b". */
export function encodeSteps(steps: { a: number; b: number; operator: Operator }[]): string {
  return steps.map((s) => `${s.a}|${s.operator}|${s.b}`).join(";");
}

export function decodeSteps(answer: string): RawStep[] {
  return (answer ?? "")
    .split(";")
    .filter((part) => part.length > 0)
    .map((part) => {
      const [a, operator, b] = part.split("|");
      return { a: Number(a), b: Number(b), operator: operator ?? "" };
    });
}

/** Written with a proper minus sign for the screen. */
export function formatStep(step: TargetStep): string {
  const symbol = step.operator === "-" ? "\u2212" : step.operator;
  return `${step.a} ${symbol} ${step.b} = ${step.result}`;
}
