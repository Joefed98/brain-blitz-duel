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
  TD_STD_FINISH,
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
  BALLPARK_STD_EARLY,
  BALLPARK_STD_FULL,
  BALLPARK_STD_ITEM,
  BALLPARK_STD_WILD,
  BALLPARK_STD_ZERO,
  CHECKOUT_STD_BIG,
  CHECKOUT_STD_BIG_TARGET,
  CHECKOUT_STD_BOARD,
  CHECKOUT_STD_EARLY,
  CHECKOUT_STD_FEWEST,
  EXACT_STD_ELEGANCE,
  EXACT_STD_ELEGANCE_PER,
  NUMBER_CLEAN_EACH,
  NUMBER_PART_EARLY,
  NUMBER_PART_POINTS,
  NUMBER_SHARE_EARLY,
  NUMBER_SHARE_POINTS,
  NUMBER_STANDARD,
  exactCloseCredit,
} from "./number";
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";

const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

/** "plus up to 40 for speed (all of it if you finish within 60 s, then less until time runs out)". */
function speedLine(type: PuzzleType): string {
  const g = NUMBER_STANDARD[type]!;
  return `up to ${g.speed} for speed (all of it if you finish within ${g.fullByS} s, then less until time runs out)`;
}

/** The "?" help SCORE text. */
export function standardNumberHelp(type: PuzzleType): string {
  const max = roundMaxFor(type);
  const g = NUMBER_STANDARD[type];
  switch (type) {
    case "target":
      return `Hit the target: ${STANDARD_FINISH}, plus ${speedLine(type)} and up to ${EXACT_STD_ELEGANCE} for elegance: hit it with the fewest numbers it needs (${EXACT_ELEGANT_TILES} on these targets), ${EXACT_STD_ELEGANCE_PER} less for each number more. Not exact: up to ${STANDARD_UNFINISHED_CAP} for the closest number you made, about ${Math.round(exactCloseCredit(1))} one away, ${Math.round(exactCloseCredit(5))} five away, ${Math.round(exactCloseCredit(10))} ten away and ${Math.round(exactCloseCredit(20))} twenty away, falling to nothing far off. ${max} is perfect.`;
    case "equation":
      return `Each equation right: ${NUMBER_PART_POINTS}, plus up to ${NUMBER_PART_EARLY} for how early you solved it, and ${NUMBER_CLEAN_EACH} more when its first ${operatorGapsDealt() ? "full fill" : "full set of signs"} was right (no wrong try), up to ${g!.bonus}. All four: ${STANDARD_FINISH}, plus ${speedLine(type)} and those first-try points. ${max} is perfect.`;
    case "balance":
      return `Each scale balanced: ${NUMBER_PART_POINTS}, plus up to ${NUMBER_PART_EARLY} for how early. All four: ${STANDARD_FINISH}, plus ${speedLine(type)} and up to ${g!.bonus} for hangs: all of it when every weight is hung once (the fewest hangs), falling evenly to 0 at twice that, over the four scales together. ${max} is perfect.`;
    case "numpyramid":
      return `Unfinished: up to ${NUMBER_SHARE_POINTS} for the pyramids done and the share right of the one you are on, up to ${NUMBER_SHARE_EARLY} more for how early each was done, and ${NUMBER_CLEAN_EACH} for each pyramid done with no wrong number ever placed in it (up to ${g!.bonus}). All four: ${STANDARD_FINISH}, plus ${speedLine(type)} and those clean-pyramid points. ${max} is perfect.`;
    case "trail":
      return `Unfinished: up to ${NUMBER_SHARE_POINTS} by the share of numbers in their right squares (wrong ones count against them), plus up to ${NUMBER_SHARE_EARLY} for how early. The whole trail: ${STANDARD_FINISH}, plus ${speedLine(type)} and ${g!.bonus} for a clean path, never taking a placed number back. ${max} is perfect.`;
    case "measure":
      return `Each puzzle solved: ${NUMBER_PART_POINTS}, plus up to ${NUMBER_PART_EARLY} for how early. All four: ${STANDARD_FINISH}, plus ${speedLine(type)} and up to ${g!.bonus} for pours: all of it at the par shown on each puzzle (its fewest moves), falling evenly to 0 at twice that, over the four puzzles together. ${max} is perfect.`;
    case "checkout":
      return `Each board checked out: ${CHECKOUT_STD_BOARD}, plus up to ${CHECKOUT_STD_EARLY} for how early. Big finish (the Bull, or a treble where the board asks for a double) on a board of ${CHECKOUT_STD_BIG_TARGET} or more: those boards share ${CHECKOUT_STD_BIG} points, finished or not. All five: ${STANDARD_FINISH}, plus ${speedLine(type)}, up to ${CHECKOUT_STD_FEWEST} for darts (all of it at the fewest darts in all, 0 at twice) and the big finishes. ${max} is perfect.`;
    case "numline":
      return `Accuracy per number: full within ${pct(BALLPARK_STD_FULL)} of the line's length, falling evenly to 0 at ${pct(BALLPARK_STD_ZERO)} away; ${pct(BALLPARK_STD_WILD)} or more away costs 1. Place all 15: up to ${STANDARD_FINISH} by your average accuracy, plus ${speedLine(type)}, times your accuracy, and ${BALLPARK_STD_BULL_POINTS} per bullseye (within ${pct(BALLPARK_STD_BULLSEYE)}, up to ${BALLPARK_STD_BULL_MAX}). Unfinished: up to ${BALLPARK_STD_ITEM} per number by accuracy, up to ${BALLPARK_STD_EARLY} more for placing them early (close ones), plus the bullseyes. ${max} is perfect.`;
    case "tendrop":
      return `Unfinished: ${TD_STD_TARGET_POINTS} per target hit, plus up to 1 each for how early, and ${TD_STD_GOLD_POINTS} per target hit with a gold tile (−${TD_REV3_RESET_COST} per reset after the first ${TD_REV3_FREE_RESETS}), up to ${TD_STD_UNFINISHED_CAP}. All ten: ${TD_STD_FINISH}, plus up to ${TD_STD_SPEED_POINTS} for speed (all of it if the last clears within ${TD_STD_FULL_BY_TICKS / 60} s, then less until the ${TD_RUN_TICKS / 60} s run ends) and ${TD_STD_GOLD_POINTS} per gold target (up to ${TD_STD_GOLD_MAX}). ${max} is perfect.`;
    default:
      return "";
  }
}

/** The round intro SCORE line (at most two phone lines; `{max}` is filled by introScore.ts). */
export function standardNumberIntro(type: PuzzleType): string {
  switch (type) {
    case "target":
      return `Hit it: ${STANDARD_FINISH}, up to {max} if quick using ${EXACT_ELEGANT_TILES} numbers. Close: up to ${STANDARD_UNFINISHED_CAP}.`;
    case "equation":
      return `${NUMBER_PART_POINTS} per equation. All four: ${STANDARD_FINISH}, up to {max} if quick and right first time.`;
    case "balance":
      return `${NUMBER_PART_POINTS} per scale. All four: ${STANDARD_FINISH}, up to {max} if quick, each weight hung once.`;
    case "numpyramid":
      return `Up to ${NUMBER_SHARE_POINTS} by pyramids done. All four: ${STANDARD_FINISH}, up to {max} if quick and clean.`;
    case "trail":
      return `Up to ${NUMBER_SHARE_POINTS} by squares right. Done: ${STANDARD_FINISH}, up to {max} if quick, never undoing.`;
    case "measure":
      return `${NUMBER_PART_POINTS} per puzzle. All four: ${STANDARD_FINISH}, up to {max} if quick in the fewest pours.`;
    case "checkout":
      return `${CHECKOUT_STD_BOARD} per board. All five: ${STANDARD_FINISH}, up to {max} if quick, few darts, big finishes.`;
    case "numline":
      return `Up to ${STANDARD_FINISH} by how close. Quick, with bullseyes: up to {max}.`;
    default:
      return "";
  }
}
