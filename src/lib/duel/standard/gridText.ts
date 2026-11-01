/**
 * Score text for the four grid puzzles on the scoring standard (gridRules.ts): the "?" help SCORE text and the round
 * intro's SCORE line, from the numbers the server grades with, written with the game's maximum (roundMax.ts). The intro
 * stays within two phone lines with no scoring terms (intro-score-text-check). Shared and pure.
 */
import { roundMaxFor } from "../roundMax";
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";
import { GRID_EARLY_POINTS, GRID_SHARE_POINTS, GRID_STANDARD, type GridStandardType } from "./gridRules";

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** What the unfinished share counts. */
const UNFINISHED: Record<GridStandardType, string> = {
  fences: "by the share of the loop's edges you draw, less the share of lines drawn off it",
  fillomino: "by the share of blank squares numbered right, less the share numbered wrong",
  bridges: "by the share of the solution's bridges you build, less the share of extra bridges",
  kakuro: "by the share of white squares filled right, less the share filled wrong",
};

/** What a mistake is, for the clean bonus. */
const MISTAKE: Record<GridStandardType, string> = {
  fences: "line ever drawn off the loop",
  fillomino: "wrong number ever entered (erased ones too)",
  bridges: "wrong bridge ever built",
  kakuro: "wrong digit ever entered (erased ones too)",
};

/** The "?" help SCORE text. */
export function gridStandardHelp(type: GridStandardType): string {
  const r = GRID_STANDARD[type];
  const max = roundMaxFor(type);
  const unfinished = `Unfinished: up to ${GRID_SHARE_POINTS} ${UNFINISHED[type]}, plus up to ${GRID_EARLY_POINTS} for placing them early; at most ${STANDARD_UNFINISHED_CAP}, so any finish beats it.`;
  const finish = `Finish: ${STANDARD_FINISH}, plus up to ${r.speed} for speed (all of it within ${r.fullByS} s, shrinking evenly to none at the buzzer) and a ${r.word} ${r.bonus}, ${fmt(r.per)} less for each ${MISTAKE[type]}, so ${max} is a ${r.word} within ${r.fullByS} s.`;
  return `${unfinished} ${finish}`;
}

/** What the intro counts unfinished, and what a perfect finish needs (no scoring terms). */
const INTRO: Record<GridStandardType, [string, string]> = {
  fences: ["Loop drawn", "with no wrong line"],
  fillomino: ["Squares right", "with no wrong number"],
  bridges: ["Bridges right", "with no wrong bridge"],
  kakuro: ["Squares right", "with no wrong digit"],
};

/** The round intro SCORE line (at most two phone lines, no scoring terms). */
export function gridStandardIntro(type: GridStandardType): string {
  const [lead, top] = INTRO[type];
  return `${lead}: up to ${STANDARD_UNFINISHED_CAP}. Finish: ${STANDARD_FINISH}+, ${roundMaxFor(type)} ${top} within ${GRID_STANDARD[type].fullByS} s.`;
}
