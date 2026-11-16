/**
 * Exact's levels (Number overhaul stage 3, 15 Nov 2026; GAME_LEVELS `target`). Normal is today's deal exactly
 * (generateTargetPuzzle, never called with a level); Easy, Hard and Expert are dealt here, 75 s as today. Server only.
 *
 * Each level's rule is proved by exhaustive search before the board is dealt:
 *   - Easy: one or two large numbers, a target of 101–300 whose fewest numbers is 3 or 4 (exactMinTiles).
 *   - Hard: exactly one large number, a target of 300–999 no four or five of the numbers reach, reached with all six.
 *   - Expert: small numbers only (1–10), a target of 500–999 needing all six, and a person-like solver
 *     (`personSolveTarget`) finds a route, so every Expert board can be worked out by a person.
 * Any route that hits the target counts (the graders are today's); the stored solution is a shortest one.
 */
import { exactMinTiles } from "./standard/number.server";
import { randInt, shuffled } from "./random";
import { applyOperation, hasSolutionWithAtMostFourTiles, LARGE_TILES, solveTarget, solveWithAllSixTiles, TARGET_OPERATORS, TARGET_TILE_COUNT } from "./target";
import type { TargetNumberPuzzleData, TargetStep } from "./types";

export interface TargetLevelSettings {
  /** How many large numbers (25, 50, 75, 100), lowest and highest. */
  large: readonly [number, number];
  /** The target's range. */
  target: readonly [number, number];
  /** The fewest numbers an answer needs, lowest and highest. */
  tiles: readonly [number, number];
  /** Expert: keep only targets the person-like solver reaches. */
  person?: boolean;
}

/** States the person-like solver may look at before it gives up. */
export const TARGET_PERSON_BUDGET = 4000;
/** Pools it keeps after each step (a person keeps a few promising lines in mind). */
export const TARGET_PERSON_BEAM = 12;

/**
 * A person-like solver: works forward a step at a time from the numbers on screen, keeping only the few most
 * promising pools (the ones whose closest number is nearest the target, then the ones with something left to adjust
 * with), never more than `TARGET_PERSON_BEAM`, and stops after `budget` pools looked at. Returns the route and the
 * pools it looked at, or null.
 */
export function personSolveTarget(tiles: readonly number[], target: number, budget = TARGET_PERSON_BUDGET): { steps: TargetStep[]; looked: number } | null {
  type State = { pool: number[]; steps: TargetStep[] };
  const near = (pool: number[]) => Math.min(...pool.map((v) => Math.abs(v - target)));
  let beam: State[] = [{ pool: [...tiles], steps: [] }];
  let looked = 0;
  const seen = new Set<string>();
  while (beam.length) {
    const next: State[] = [];
    for (const state of beam) {
      const { pool } = state;
      for (let i = 0; i < pool.length; i++)
        for (let j = 0; j < pool.length; j++) {
          if (i === j) continue;
          for (const operator of TARGET_OPERATORS) {
            if ((operator === "+" || operator === "×") && j < i) continue;
            const a = pool[i]!;
            const b = pool[j]!;
            // A person never multiplies or divides by 1.
            if ((operator === "×" || operator === "÷") && (b === 1 || a === 1)) continue;
            const result = applyOperation(a, b, operator);
            if (result === null) continue;
            const rest = pool.filter((_, k) => k !== i && k !== j);
            const made = [...rest, result];
            const key = [...made].sort((x, y) => x - y).join(",");
            if (seen.has(key)) continue;
            seen.add(key);
            looked++;
            const steps = [...state.steps, { a, b, operator, result }];
            if (result === target) return { steps, looked };
            if (looked >= budget) return null;
            if (made.length >= 2) next.push({ pool: made, steps });
          }
        }
    }
    next.sort((x, y) => near(x.pool) - near(y.pool) || y.pool.length - x.pool.length);
    beam = next.slice(0, TARGET_PERSON_BEAM);
  }
  return null;
}

function rollLevelTiles(large: readonly [number, number]): number[] {
  const count = randInt(large[0], large[1]);
  const big = shuffled(LARGE_TILES).slice(0, count);
  const small = Array.from({ length: TARGET_TILE_COUNT - count }, () => randInt(1, 10));
  return shuffled([...big, ...small]);
}

/** A shortest route for a target whose fewest numbers is `min`. */
function shortestRoute(tiles: number[], target: number, min: number): TargetStep[] | null {
  if (min >= TARGET_TILE_COUNT) return solveWithAllSixTiles(tiles, target);
  const subsets = (n: number, k: number): number[][] => {
    if (k === 0) return [[]];
    if (n < k) return [];
    return [...subsets(n - 1, k), ...subsets(n - 1, k - 1).map((s) => [...s, n - 1])];
  };
  for (const s of subsets(tiles.length, min)) {
    const route = solveTarget(s.map((i) => tiles[i]!), target);
    if (route) return route;
  }
  return null;
}

/** Whether this target obeys the level's rule (exhaustive), and its shortest route. */
export function targetLevelRoute(tiles: number[], target: number, settings: TargetLevelSettings, person: boolean): TargetStep[] | null {
  const [lo, hi] = settings.tiles;
  if (hi >= TARGET_TILE_COUNT && lo >= TARGET_TILE_COUNT) {
    // All six needed: nothing from four or fewer, nothing from any five, and a route from all six.
    if (hasSolutionWithAtMostFourTiles(tiles, target)) return null;
    if (exactMinTiles(tiles, target) !== TARGET_TILE_COUNT) return null;
    const six = solveWithAllSixTiles(tiles, target);
    if (!six) return null;
    if (person && !personSolveTarget(tiles, target)) return null;
    return six;
  }
  const min = exactMinTiles(tiles, target);
  if (min < lo || min > hi) return null;
  // exactMinTiles answers 6 when nothing is found with fewer; make sure the target is reachable at all.
  const route = shortestRoute(tiles, target, min);
  if (!route) return null;
  if (person && !personSolveTarget(tiles, target)) return null;
  return route;
}

export function generateTargetLevel(settings: TargetLevelSettings): TargetNumberPuzzleData {
  const person = settings.person === true;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const tiles = rollLevelTiles(settings.large);
    for (let tries = 0; tries < 15; tries++) {
      const target = randInt(settings.target[0], settings.target[1]);
      const solution = targetLevelRoute(tiles, target, settings, person);
      if (solution) return { type: "target", tiles, target, solution };
    }
  }
  throw new Error("Exact: no level board found");
}
