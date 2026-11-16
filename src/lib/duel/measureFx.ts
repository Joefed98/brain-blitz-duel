/**
 * Brimful's effects (the Number overhaul, stage 2, 15 Nov 2026): pure helpers the phone's effects read. Display only:
 * nothing here grades, counts a move or changes a board.
 */
import { measureActions, measureApply, measureSolved } from "./measure";
import type { MeasureBoardData } from "./types";

/** Litres each jug's target line marks: the target on every jug that can hold it, or each jug's share of a split. */
export function measureTargetLines(board: MeasureBoardData): (number | null)[] {
  if (board.goal === "split") return board.caps.map((_, jug) => board.split?.[jug] ?? null);
  return board.caps.map((cap) => (board.target !== undefined && board.target <= cap ? board.target : null));
}

/**
 * "One move from the target": the jugs one legal move (fill, empty or pour) would bring onto their target line and
 * solve the board with. Empty when the board is already solved or no single move solves it.
 */
export function measureNearJugs(board: MeasureBoardData, amounts: readonly number[]): number[] {
  if (measureSolved(board, amounts)) return [];
  const lines = measureTargetLines(board);
  const out = new Set<number>();
  for (const action of measureActions(board)) {
    const next = measureApply(board, amounts, action);
    if (!next || !measureSolved(board, next)) continue;
    next.forEach((v, jug) => {
      if (v !== amounts[jug] && lines[jug] !== null && v === lines[jug]) out.add(jug);
    });
  }
  return [...out].sort((a, b) => a - b);
}

/** The jugs a move just brought onto their target line (the line's glow and plink). */
export function measureLinesReached(board: MeasureBoardData, before: readonly number[], after: readonly number[]): number[] {
  const lines = measureTargetLines(board);
  return after.flatMap((v, jug) => (v !== before[jug] && lines[jug] !== null && v === lines[jug] ? [jug] : []));
}

/** The tap's running water, sized to the amount: one play for up to 4 litres, two up to 8, three beyond. */
export function measureFillPlays(litres: number): number {
  return Math.max(1, Math.min(3, Math.ceil(Math.max(0, litres) / 4)));
}

/** The gap between the running water's plays (ms): each play overlaps the last a little. */
export const MEASURE_FILL_GAP_MS = 300;
