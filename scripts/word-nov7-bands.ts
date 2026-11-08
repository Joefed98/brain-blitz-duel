/**
 * The Word scoring fix's report (7 Nov 2026, docs/word-scoring-nov-2026.md), not a check: Interlock, Slider and
 * Lookout on the stamps rooms deal, graded as phones send them.
 *
 *  - the kit bands (nothing, spam, average, good, great, near-perfect) and a flawless player (no mistakes, the
 *    quickest pace), medians with p10 / p90;
 *  - the prefix curve along the flawless line: every prefix graded at the buzzer (unfinished), how many seeds have a
 *    prefix scoring below the one before it (a drop), the largest drop and the median curve at a quarter, half and
 *    three quarters of the line.
 *
 *   bun scripts/word-nov7-bands.ts [types…] [--seeds=60] [--from=6100] [--pin]   (--pin: the stamps before the fix)
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreWordNov7 } from "../src/lib/duel/wordNov7";
import type { PuzzleType } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { bandLine, gradeSteps, kitBands, median, quantile, sentAnswer } from "./standard-lib";

const args = process.argv.slice(2);
const n = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 60);
const from = Number(args.find((a) => a.startsWith("--from="))?.slice(7) ?? 6100);
if (args.includes("--pin")) pinPreWordNov7(true);
const types = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
const list: PuzzleType[] = types.length ? types : ["tilegrid", "wordslide", "wordsearch"];
const seeds = Array.from({ length: n }, (_, i) => from + i * 7);
export const FLAWLESS: Skill = { level: "near", pace: 0.35, err: 0, reactionMs: 150, reactionSd: 10 };

for (const type of list) {
  const kit = KITS[type]!;
  console.log(`\n${type} (${seeds.length} seeds)`);
  for (const r of kitBands(type, seeds)) console.log("  " + bandLine(r));
  const flawless: number[] = [];
  let dropSeeds = 0;
  let worstDrop = 0;
  const at: number[][] = [[], [], []];
  for (const seed of seeds) {
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    const steps = kit.play(p, makeRng(hashText(`std:${type}:${seed}:flawless`)), FLAWLESS, limit).steps;
    flawless.push(gradeSteps(p, steps).score);
    const curve: number[] = [];
    for (let i = 1; i < steps.length; i++) {
      const g = gradeAnswer(p, sentAnswer(p, steps.slice(0, i)), 0);
      curve.push(g.isCorrect ? 150 : g.score);
    }
    let dropped = false;
    for (let i = 1; i < curve.length; i++) {
      const d = curve[i - 1]! - curve[i]!;
      if (d > 0) {
        dropped = true;
        worstDrop = Math.max(worstDrop, d);
      }
    }
    if (dropped) dropSeeds++;
    [0.25, 0.5, 0.75].forEach((q, k) => curve.length && at[k]!.push(curve[Math.min(curve.length - 1, Math.floor(q * curve.length))]!));
  }
  console.log(`  flawless median ${String(median(flawless)).padStart(3)}  p10 ${String(quantile(flawless, 0.1)).padStart(3)}  min ${Math.min(...flawless)}  at 200: ${flawless.filter((s) => s === 200).length}/${flawless.length}`);
  console.log(`  prefix curve (unfinished, at the buzzer): drops on ${dropSeeds}/${seeds.length} seeds, largest ${worstDrop}; median at 1/4 ${median(at[0]!)}, 1/2 ${median(at[1]!)}, 3/4 ${median(at[2]!)}`);
}
