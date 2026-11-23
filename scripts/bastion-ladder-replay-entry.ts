/**
 * Prints the one run replay-check needs on bastionRev 5 (D5's ladder, 23 Nov 2026), for appending once at the end of
 * scripts/fixtures/replay-runs.json's `runs` (never rebuilding the file): the great skill-band bot (under the human limits,
 * scripts/d5-ladder-lib.ts `playDealt`) on the Normal deal level-tune deals as n = 0, graded by gradeAnswer. Deterministic.
 *
 *   bun scripts/bastion-ladder-replay-entry.ts
 */
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

const puzzle = dealAt("bastion", "normal", 0);
const run = await playDealt("bastion", puzzle, "great");
const graded = gradeAnswer(puzzle, run.raw, 0);
const p = puzzle as unknown as { type: string; seed: number; bastionRev: number; speedPar?: number; puzzleScoreRev?: number };
const entry = { type: "bastion", label: "great bot, today's revision (added 2026-11-23)", puzzle: { type: "bastion", seed: p.seed, bastionRev: p.bastionRev, speedPar: p.speedPar ?? 1, puzzleScoreRev: p.puzzleScoreRev ?? 3 }, answer: run.raw, score: graded.score };
console.log(JSON.stringify(entry));
