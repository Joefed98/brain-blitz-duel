/**
 * Records Mixed Signals runs on the stamps before clashRev 8 (run once on unmodified main, 25 Oct 2026), for
 * depth-mixedsignals-check's legacy identity: each run's answer, stored score, verdict and final checkpoint.
 *
 *   bun scripts/depth-mixedsignals-record.ts   # writes scripts/fixtures/depth-mixedsignals-legacy.json.gz
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { clashCheckpoint, clashVariantOf, CLASH_QUEUE, CLASH_QUEUE_V1 } from "../src/lib/arcade/colourClash";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import type { PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/depth-mixedsignals-legacy.json.gz";
const LEVELS: Record<string, Skill> = {
  average: { level: "average", pace: 1.7, err: 0.2, reactionMs: 300, reactionSd: 55 },
  good: { level: "good", pace: 1.0, err: 0.1, reactionMs: 230, reactionSd: 40 },
  near: { level: "near", pace: 0.5, err: 0.015, reactionMs: 160, reactionSd: 20 },
};
const STAMPS: Record<string, unknown>[] = [
  { queue: CLASH_QUEUE, clashRev: 7 }, { queue: CLASH_QUEUE, clashRev: 6 }, { queue: CLASH_QUEUE, clashRev: 5 },
  { queue: CLASH_QUEUE, clashRev: 4 }, { queue: CLASH_QUEUE, clashRev: 3 }, { queue: CLASH_QUEUE }, { queue: CLASH_QUEUE_V1 }, {},
];
const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)["stroop"]!;
const runs: unknown[] = [];
const err = console.error;
console.error = () => {};
for (const stamp of STAMPS) {
  for (let n = 0; n < 6; n++) {
    const seed = 777_001 + n * 131;
    const p = { type: "stroop", seed, ...stamp, speedPar: 1, puzzleScoreRev: 3 } as unknown as PuzzleData;
    const limit = puzzleTimeLimitMs(p);
    const answers: [string, string][] = Object.entries(LEVELS).map(([lv, skill]) => {
      const steps = kit.play(p, makeRng(hashText(`stroop:legacy:${seed}:${lv}`)), skill, limit).steps;
      return [lv, steps.at(-1)?.answer ?? kit.nothing(p)];
    });
    for (const s of kit.spam(p, makeRng(hashText(`stroop:legacy-spam:${seed}`)), limit).slice(0, 1)) answers.push([`spam:${s.label}`, s.answer]);
    for (const [label, answer] of answers) {
      const g = gradeAnswer(p, answer, 0);
      const r = replayColourClashRun(seed, answer, clashVariantOf(p as never));
      runs.push({ stamp, seed, label, answer, score: g.score, isCorrect: g.isCorrect, storedMs: g.storedMs, checkpoint: clashCheckpoint(r.state), extra: g.extra });
    }
  }
}
console.error = err;
writeFileSync(out, gzipSync(JSON.stringify({ recordedOn: "main 37aab99, 25 Oct 2026 (before clashRev 8)", runs })));
console.log(`recorded ${runs.length} runs → ${out}`);
