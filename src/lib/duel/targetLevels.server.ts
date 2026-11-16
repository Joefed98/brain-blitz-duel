/**
 * Exact's levels (Number overhaul stage 3, 15 Nov 2026; GAME_LEVELS `target`). Normal is today's deal exactly
 * (generateTargetPuzzle, never called with a level); Easy, Hard and Expert are dealt here, 75 s as today. Server only.
 *
 * Each level's rule is proved by exhaustive search before the board is dealt:
 *   - Easy: one or two large numbers, a target of 101–300 whose fewest numbers is 3 or 4 (exactMinTiles).
 *   - Hard: exactly one large number, a target of 300–999 no four or five of the numbers reach, reached with all six.
 *   - Expert: small numbers only (1–10), a target of 500–999 needing all six, and a person-like solver
 *     (`personSolveTarget`) finds a route, so every Expert board can be worked out by a person. Since 16 Nov 2026
 *     (Joe) Expert deals from a bank of boards made by this same rule (`TARGET_EXPERT_BANK`, built by
 *     scripts/target-expert-bank.ts), not a live search.
 * Any route that hits the target counts (the graders are today's); the stored solution is a shortest one.
 */
import { exactMinTiles } from "./standard/number.server";
import { randInt, randomBelow, shuffled } from "./random";
import { TARGET_EXPERT_BANK } from "./targetExpertBank.server";
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

/** Lines of thought the person-like solver may try before it gives up. */
export const TARGET_PERSON_BUDGET = 20000;

type Made = { value: number; steps: TargetStep[] };

/** Every number a person can make from up to `max` of these tiles exactly, with its steps (small pools only). */
function makeable(pool: readonly number[], max: number): Map<number, TargetStep[]> {
  const out = new Map<number, TargetStep[]>();
  const rec = (items: Made[]) => {
    for (const m of items) if (!out.has(m.value)) out.set(m.value, m.steps);
    if (items.length < 2) return;
    for (let i = 0; i < items.length; i++)
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        for (const operator of TARGET_OPERATORS) {
          if ((operator === "+" || operator === "×") && j < i) continue;
          const a = items[i]!;
          const b = items[j]!;
          const result = applyOperation(a.value, b.value, operator);
          if (result === null) continue;
          const rest = items.filter((_, k) => k !== i && k !== j);
          rec([...rest, { value: result, steps: [...a.steps, ...b.steps, { a: a.value, b: b.value, operator, result }] }]);
        }
      }
  };
  rec(pool.slice(0, max).map((value) => ({ value, steps: [] })));
  return out;
}

/**
 * A person-like solver (Joe's rule: every Expert board can be worked out by a person). It thinks the way people do at
 * this game, backwards from the target: "the target is something near it, adjusted by a small number I can make from
 * one or two tiles" (T = X ± v, or X × v, or X ÷ v), then the same for X with the tiles left; when three or fewer
 * tiles are left it tries every way to make X from them (a person can check three numbers by hand). At most three
 * adjustments deep, and it stops after `budget` lines of thought. Returns the route and the lines it tried, or null.
 */
export function personSolveTarget(tiles: readonly number[], target: number, budget = TARGET_PERSON_BUDGET): { steps: TargetStep[]; looked: number } | null {
  let looked = 0;
  const pairs = (n: number): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i < n; i++) out.push([i]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
    return out;
  };
  const solve = (pool: number[], goal: number, depth: number): TargetStep[] | null => {
    if (looked >= budget) return null;
    if (pool.length <= 3) {
      looked++;
      const all = new Map<number, TargetStep[]>();
      // Every subset of the few tiles left.
      for (let mask = 1; mask < 1 << pool.length; mask++) {
        const sub = pool.filter((_, k) => mask & (1 << k));
        for (const [v, st] of makeable(sub, sub.length)) if (!all.has(v)) all.set(v, st);
      }
      return all.get(goal) ?? null;
    }
    if (pool.includes(goal)) return [];
    if (depth === 0) return null;
    for (const idx of pairs(pool.length)) {
      const sub = idx.map((k) => pool[k]!);
      const rest = pool.filter((_, k) => !idx.includes(k));
      for (const [v, vSteps] of makeable(sub, 2)) {
        const options: { x: number; operator: TargetStep["operator"]; xFirst: boolean }[] = [
          { x: goal - v, operator: "+", xFirst: true },
          { x: goal + v, operator: "-", xFirst: true },
          { x: v - goal, operator: "-", xFirst: false },
        ];
        if (v > 1 && goal % v === 0) options.push({ x: goal / v, operator: "×", xFirst: true });
        if (v > 1) options.push({ x: goal * v, operator: "÷", xFirst: true });
        for (const { x, operator, xFirst } of options) {
          if (x <= 0) continue;
          looked++;
          if (looked >= budget) return null;
          const xSteps = solve(rest, x, depth - 1);
          if (!xSteps) continue;
          const [a, b] = xFirst ? [x, v] : [v, x];
          const result = applyOperation(a, b, operator);
          if (result !== goal) continue;
          return [...xSteps, ...vSteps, { a, b, operator, result }];
        }
      }
    }
    return null;
  };
  const steps = solve([...tiles], target, 3);
  return steps ? { steps, looked } : null;
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

/** Exact's Expert: one board from the proved bank, drawn with the deal's own random source (seeded in rooms). */
export function dealTargetExpert(): TargetNumberPuzzleData {
  const entry = TARGET_EXPERT_BANK[randomBelow(TARGET_EXPERT_BANK.length)]!;
  return { type: "target", tiles: [...entry.tiles], target: entry.target, solution: entry.solution.map((s) => ({ ...s })) };
}
