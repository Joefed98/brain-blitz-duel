/**
 * The scoring standard's numbers for the four grid puzzles born on it (1 Nov 2026, docs/scoring-standard.md "New grid
 * puzzles"): Fences, Fillomino and Bridges (Logic) and Kakuro (Number). They follow the Logic rows exactly (Box Six,
 * Tents and Trees, Shikaku): a finish is 150 + up to 40 for speed + a clean bonus of 10, 2.5 less per mistake ever made;
 * unfinished is up to 120 by the share of the solution placed, plus up to 10 for how early, at most 130. Shared by the
 * server's grade (grid.server.ts) and the help texts (gridText.ts), pure.
 */
import type { PuzzleType } from "../types";

export type GridStandardType = "fences" | "fillomino" | "bridges" | "kakuro";

export const GRID_STANDARD_TYPES: readonly GridStandardType[] = ["fences", "fillomino", "bridges", "kakuro"];

export interface GridStandardRule {
  /** Speed points, in full when solved by `fullByS` seconds of play, shrinking evenly to 0 at the buzzer. */
  speed: number;
  fullByS: number;
  /** The clean bonus and the points off it per mistake. */
  bonus: number;
  per: number;
  /** What the clean bonus is called. */
  word: string;
}

export const GRID_STANDARD: Readonly<Record<GridStandardType, GridStandardRule>> = {
  fences: { speed: 40, fullByS: 45, bonus: 10, per: 2.5, word: "clean loop" },
  fillomino: { speed: 40, fullByS: 45, bonus: 10, per: 2.5, word: "clean fill" },
  bridges: { speed: 40, fullByS: 45, bonus: 10, per: 2.5, word: "clean build" },
  kakuro: { speed: 40, fullByS: 60, bonus: 10, per: 2.5, word: "clean grid" },
};

/** Unfinished: up to this many points by the share of the solution placed (wrong placements count against it)… */
export const GRID_SHARE_POINTS = 120;
/** …plus up to this many for how early, split evenly across the solution's items. */
export const GRID_EARLY_POINTS = 10;

export function isGridStandardType(type: PuzzleType | string): type is GridStandardType {
  return (GRID_STANDARD_TYPES as readonly string[]).includes(type);
}

/**
 * The share an unfinished board earns: items on the solution less items off it, never below 0, so guessing never
 * pays (filling every cell or edge places more wrong items than right ones).
 */
export function gridNetPlaced(right: number, wrong: number): number {
  return Math.max(0, right - wrong);
}
