/**
 * Puzzle polish (3 Nov 2026, docs/puzzle-polish-nov-2026.md): medians weak → flawless, before → after, on room seeds.
 * Labyrinth, Topsy-Turvy and Skid: the puzzle batch's stamps (before) and the stricter-par stamps (after), played by the
 * puzzle batch's players. Operator: the standard's signs-only stamp (before) and the gaps stamp (after), played by the
 * fairness kit at a weak level, the kit's four and a flawless one. Random = the kits' spam answers (and random tilting),
 * at the buzzer. A tool, not a check: puzzle-polish-nov-check runs the same rows on fewer seeds.
 *
 *   bun scripts/puzzle-polish-bands.ts [--seeds=60] [maze gravity iceslide equation]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreParStrict } from "../src/lib/duel/parMoves";
import { pinPreOperatorGaps } from "../src/lib/duel/operatorGaps";
import { BATCH_LEVELS, dealBatch, playBatch, spamBatch, type BatchType } from "./puzzle-batch-nov/players";
import { equationBandRow, type BandLevel, BAND_LEVELS } from "./puzzle-polish-nov/players";
import { gradeSteps, median } from "./standard-lib";

const args = process.argv.slice(2);
const SEEDS_N = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 60);
const SEEDS = Array.from({ length: SEEDS_N }, (_, i) => 20_000 + i * 37);
const only = args.filter((a) => !a.startsWith("--"));
const types = (only.length ? only : ["maze", "gravity", "iceslide", "equation"]) as (BatchType | "equation")[];

export type Row = Record<BandLevel | "random", number[]>;
const emptyRow = (): Row => ({ random: [], weak: [], average: [], good: [], great: [], near: [], flawless: [] });

function batchRows(type: BatchType, seeds: readonly number[]): { before: Row; after: Row } {
  const out = { before: emptyRow(), after: emptyRow() };
  for (const seed of seeds) {
    for (const which of ["before", "after"] as const) {
      const prev = pinPreParStrict(which === "before");
      try {
        const p = dealBatch(type, seed);
        for (const level of BATCH_LEVELS) {
          const play = playBatch(type, p, level, seed);
          out[which][level].push(gradeSteps(p, play.steps, play.timed).score);
        }
        for (const sp of spamBatch(type, p, seed)) out[which].random.push(gradeAnswer(p, sp.answer, sp.msLeft).score);
      } finally {
        pinPreParStrict(prev);
      }
    }
  }
  return out;
}

export function polishRows(type: BatchType | "equation", seeds: readonly number[]): { before: Row; after: Row } {
  if (type !== "equation") return batchRows(type, seeds);
  const out = { before: emptyRow(), after: emptyRow() };
  for (const seed of seeds) {
    for (const which of ["before", "after"] as const) {
      const prev = pinPreOperatorGaps(which === "before");
      try {
        const row = equationBandRow(seed);
        for (const k of Object.keys(row) as (keyof Row)[]) out[which][k].push(...row[k]);
      } finally {
        pinPreOperatorGaps(prev);
      }
    }
  }
  return out;
}

export function formatRows(type: string, rows: { before: Row; after: Row }): string[] {
  const cols: (keyof Row)[] = ["random", ...BAND_LEVELS];
  return [
    `${type.padEnd(9)} ${cols.map((c) => c.padStart(9)).join("")}`,
    `  before  ${cols.map((c) => String(median(rows.before[c])).padStart(9)).join("")}`,
    `  after   ${cols.map((c) => String(median(rows.after[c])).padStart(9)).join("")}`,
  ];
}

if (import.meta.main) {
  console.log(`Medians on ${SEEDS_N} room seeds, before → after:`);
  for (const type of types) {
    const t0 = performance.now();
    const rows = polishRows(type, SEEDS);
    for (const line of formatRows(type, rows)) console.log(line);
    console.log(`  (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
