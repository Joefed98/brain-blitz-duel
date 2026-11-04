/**
 * Score text for the scoring standard's Number games (docs/scoring-standard.md, "Number decisions"): the "?" help and
 * the round intro SCORE line for the rounds rooms deal today. Every figure comes from number.ts (Tenfall: tenDrop.ts);
 * the maximum is the game's own (roundMaxFor).
 */
import { operatorGapsDealt } from "../operatorGaps";
import {
  TD_REV3_FREE_RESETS,
  TD_REV3_RESET_COST,
  TD_RUN_TICKS,
  TD_STD_FULL_BY_TICKS,
  TD_STD_GOLD_MAX,
  TD_STD_GOLD_POINTS,
  TD_STD_SPEED_POINTS,
  TD_STD_TARGET_POINTS,
  TD_STD_UNFINISHED_CAP,
} from "../../arcade/tenDrop";
import { EXACT_ELEGANT_TILES } from "../numberDepth";
import { roundMaxFor } from "../roundMax";
import type { PuzzleType } from "../types";
import {
  BALLPARK_STD_BULL_MAX,
  BALLPARK_STD_BULL_POINTS,
  BALLPARK_STD_BULLSEYE,
  BALLPARK_STD_FULL,
  BALLPARK_STD_ITEM,
  BALLPARK_STD_WILD,
  BALLPARK_STD_ZERO,
  CHECKOUT_STD_BIG,
  CHECKOUT_STD_BIG_TARGET,
  CHECKOUT_STD_BOARD,
  CHECKOUT_STD_FEWEST,
  EXACT_STD_ELEGANCE,
  EXACT_STD_ELEGANCE_PER,
  NUMBER_CLEAN_EACH,
  NUMBER_PART_POINTS,
  NUMBER_STANDARD,
  exactCloseCredit,
} from "./number";
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";
import { scoreList, speedLine, type ScoreLine } from "../scoreList";

const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

/** The speed line (scoreList.ts). */
function speed(type: PuzzleType): ScoreLine {
  const g = NUMBER_STANDARD[type]!;
  return speedLine(g.speed, g.fullByS);
}

/** "Finish: …, 150." */
const finish = (how: string): ScoreLine => ({ label: "Finish", how, fixed: STANDARD_FINISH });
/** A part game's unfinished line: so much a part, more for how early. */
const parts = (each: number, what: string): ScoreLine => ({ label: "Not finished", how: `${each} for each ${what}, more for doing it early`, max: STANDARD_UNFINISHED_CAP });

/** The "?" help SCORE text: one line a part (scoreList.ts). */
export function standardNumberHelp(type: PuzzleType): string {
  const max = roundMaxFor(type);
  const g = NUMBER_STANDARD[type];
  switch (type) {
    case "target":
      return scoreList([
        finish("make the target exactly"),
        speed(type),
        { label: "Elegance", how: `use the fewest numbers it needs (${EXACT_ELEGANT_TILES} here), ${EXACT_STD_ELEGANCE_PER} less for each number more`, max: EXACT_STD_ELEGANCE },
        { label: "Not exact", how: `the closer your best number, the more (about ${Math.round(exactCloseCredit(1))} one away, ${Math.round(exactCloseCredit(10))} ten away, nothing far off)`, max: STANDARD_UNFINISHED_CAP },
      ], { total: max });
    case "equation":
      return scoreList([
        finish("make all four equations true"),
        speed(type),
        { label: "First try", how: `${NUMBER_CLEAN_EACH} for each equation right on its first ${operatorGapsDealt() ? "full fill" : "full set of signs"}`, max: g!.bonus },
        parts(NUMBER_PART_POINTS, "equation right"),
      ], { total: max });
    case "balance":
      return scoreList([
        finish("balance all four scales"),
        speed(type),
        { label: "Hangs", how: "hang every weight once (the fewest hangs) for all of it, nothing at twice that", max: g!.bonus },
        parts(NUMBER_PART_POINTS, "scale balanced"),
      ], { total: max });
    case "numpyramid":
      return scoreList([
        finish("complete all four pyramids"),
        speed(type),
        { label: "Clean pyramids", how: `${NUMBER_CLEAN_EACH} for each pyramid done with no wrong number ever placed, finished or not`, max: g!.bonus },
        { label: "Not finished", how: "the pyramids done and the share right of the one you are on, more for doing them early", max: STANDARD_UNFINISHED_CAP },
      ], { total: max });
    case "trail":
      return scoreList([
        finish("complete the whole trail"),
        speed(type),
        { label: "Clean path", how: "never take a placed number back", max: g!.bonus },
        { label: "Not finished", how: "the share of numbers in their right squares (wrong ones count against them), more for doing it early", max: STANDARD_UNFINISHED_CAP },
      ], { total: max });
    case "measure":
      return scoreList([
        finish("solve all four puzzles"),
        speed(type),
        { label: "Pours", how: "solve each in the fewest pours (par, shown) for all of it, nothing at twice that", max: g!.bonus },
        parts(NUMBER_PART_POINTS, "puzzle solved"),
      ], { total: max });
    case "checkout":
      return scoreList([
        finish("check out all five boards"),
        speed(type),
        { label: "Darts", how: "use the fewest darts in all for all of it, nothing at twice that", max: CHECKOUT_STD_FEWEST },
        { label: "Big finishes", how: `finish a board of ${CHECKOUT_STD_BIG_TARGET} or more on the Bull, or a treble where it asks for a double, finished or not`, max: CHECKOUT_STD_BIG },
        parts(CHECKOUT_STD_BOARD, "board checked out"),
      ], { total: max });
    case "numline":
      return scoreList([
        { label: "Accuracy", how: `place all 15 numbers; each scores in full within ${pct(BALLPARK_STD_FULL)} of the line's length, nothing at ${pct(BALLPARK_STD_ZERO)} away`, max: STANDARD_FINISH },
        { label: "Speed", how: `place them all within ${g!.fullByS} s for all of it, falling to 0 at the buzzer, times your accuracy`, max: g!.speed },
        { label: "Bullseyes", how: `${BALLPARK_STD_BULL_POINTS} for each number within ${pct(BALLPARK_STD_BULLSEYE)}, finished or not`, max: BALLPARK_STD_BULL_MAX },
        { label: "Not finished", how: `up to ${BALLPARK_STD_ITEM} for each number by how close, more for placing close ones early`, max: STANDARD_UNFINISHED_CAP },
      ], { penalties: [`A number ${pct(BALLPARK_STD_WILD)} or more away costs 1`], total: max });
    case "tendrop":
      return scoreList([
        finish("hit all ten targets"),
        { label: "Speed", how: `clear the last within ${TD_STD_FULL_BY_TICKS / 60} s for all of it, falling to 0 when the ${TD_RUN_TICKS / 60} s run ends`, max: TD_STD_SPEED_POINTS },
        { label: "Gold tiles", how: `${TD_STD_GOLD_POINTS} for each target hit with a gold tile, finished or not`, max: TD_STD_GOLD_MAX },
        { label: "Not finished", how: `${TD_STD_TARGET_POINTS} for each target hit, more for hitting it early`, max: TD_STD_UNFINISHED_CAP },
      ], { penalties: [`After the first ${TD_REV3_FREE_RESETS} resets, each costs ${TD_REV3_RESET_COST}`], total: max });
    default:
      return "";
  }
}

/** The round intro SCORE line (at most two phone lines; `{max}` is filled by introScore.ts). */
export function standardNumberIntro(type: PuzzleType): string {
  switch (type) {
    case "target":
      return "Make the target; bonuses for speed and using fewer numbers. Up to {max}.";
    case "equation":
      return "Make every equation true; bonuses for speed and right first time. Up to {max}.";
    case "balance":
      return "Balance every scale; bonuses for speed and hanging each weight once. Up to {max}.";
    case "numpyramid":
      return "Complete every pyramid; bonuses for speed and no wrong numbers. Up to {max}.";
    case "trail":
      return "Complete the trail; bonuses for speed and never undoing. Up to {max}.";
    case "measure":
      return "Solve every puzzle; bonuses for speed and the fewest pours. Up to {max}.";
    case "checkout":
      return "Check out every board; bonuses for speed, few darts and big finishes. Up to {max}.";
    case "numline":
      return "Place each number close; bonuses for speed and bullseyes. Up to {max}.";
    default:
      return "";
  }
}
