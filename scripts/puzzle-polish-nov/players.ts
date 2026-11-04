/**
 * Operator's players for the puzzle polish (3 Nov 2026): the fairness kit (scripts/puzzle-fairness/kits-number.ts, which
 * plays both the signs-only stamp and the gaps stamp) at a weak level, the kit's four and a flawless one, plus its spam
 * answers at the buzzer. Script-only.
 */
import { generatePuzzle, gradeAnswer } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import { KITS } from "../puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Skill } from "../puzzle-fairness/kit";
import { gradeSteps } from "../standard-lib";
import type { PuzzleData } from "../../src/lib/duel/types";

export const BAND_LEVELS = ["weak", "average", "good", "great", "near", "flawless"] as const;
export type BandLevel = (typeof BAND_LEVELS)[number];

export const EQ_SKILLS: Record<BandLevel, Skill> = {
  weak: { level: "average", pace: 2.4, err: 0.33, reactionMs: 340, reactionSd: 60 },
  average: SKILLS.average,
  good: SKILLS.good,
  great: SKILLS.great,
  near: SKILLS.near,
  flawless: { level: "near", pace: 0.35, err: 0, reactionMs: 150, reactionSd: 10 },
};

/** A room deal of Operator from `seed`. */
export function dealEquation(seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle("equation", { bankSeed: seed }));
}

export function playEquation(p: PuzzleData, level: BandLevel, seed: number) {
  return KITS.equation!.play(p, makeRng(hashText(`polish-nov:equation:${seed}:${level}`)), EQ_SKILLS[level], puzzleTimeLimitMs(p));
}

/** One seed's scores at every level and its random (spam) answers. */
export function equationBandRow(seed: number): Record<BandLevel | "random", number[]> {
  const p = dealEquation(seed);
  const row: Record<BandLevel | "random", number[]> = { random: [], weak: [], average: [], good: [], great: [], near: [], flawless: [] };
  for (const level of BAND_LEVELS) {
    const play = playEquation(p, level, seed);
    row[level].push(gradeSteps(p, play.steps, play.timed).score);
  }
  for (const sp of KITS.equation!.spam(p, makeRng(hashText(`polish-nov:equation:spam:${seed}`)), puzzleTimeLimitMs(p))) row.random.push(gradeAnswer(p, sp.answer, 0).score);
  return row;
}
