/**
 * Kakuro's effects (the Number overhaul, stage 2, 15 Nov 2026; display and sound only, nothing here reads or changes a
 * grade): the run-complete two-note's pitch and the solve sweep's order. Pure, so the checks prove them.
 */
import type { KakuroRun } from "@/lib/duel/kakuro";

/** The two-note's playback rate for a run of `length` squares: two semitones a square above a 2-square run, capped. */
export function kakuroRunRate(length: number): number {
  const steps = Math.max(0, Math.min(7, length - 2));
  return Math.round(2 ** ((steps * 2) / 12) * 1000) / 1000;
}

/** The solve sweep's whole length (it stays inside the Logic solve window, LOGIC_SOLVE_FX_MS 1,200 ms). */
export const KAKURO_SWEEP_MS = 1_000;
/** One run's light (ms). */
export const KAKURO_SWEEP_RUN_MS = 320;

/**
 * The solve sweep: the runs light across, then down. Each white cell gets its across run's turn (`a`) and its down
 * run's turn (`d`), counted over all runs in that order (across runs first, in reading order, then down runs), and
 * `step` spaces the turns so the last run's light ends by KAKURO_SWEEP_MS.
 */
export function kakuroSolveOrder(runs: readonly KakuroRun[]): { step: number; turns: Map<number, { a: number; d: number }> } {
  const across = runs.filter((r) => r.across);
  const down = runs.filter((r) => !r.across);
  const total = across.length + down.length;
  const step = total > 1 ? Math.floor((KAKURO_SWEEP_MS - KAKURO_SWEEP_RUN_MS) / (total - 1)) : 0;
  const turns = new Map<number, { a: number; d: number }>();
  const at = (cell: number) => turns.get(cell) ?? { a: 0, d: across.length };
  across.forEach((run, i) => run.cells.forEach((c) => turns.set(c, { ...at(c), a: i })));
  down.forEach((run, i) => run.cells.forEach((c) => turns.set(c, { ...at(c), d: across.length + i })));
  return { step, turns };
}
