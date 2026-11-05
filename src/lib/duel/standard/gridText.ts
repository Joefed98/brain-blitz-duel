/**
 * Score text for the four grid puzzles on the scoring standard (gridRules.ts): the "?" help SCORE text and the round
 * intro's SCORE line, from the numbers the server grades with, written with the game's maximum (roundMax.ts). The intro
 * stays within two phone lines with no scoring terms (intro-score-text-check). Shared and pure.
 */
import { roundMaxFor } from "../roundMax";
import { GRID_STANDARD, type GridStandardType } from "./gridRules";
import { puzzleScoreList } from "../scoreList";

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** What counts unfinished (plain words). */
const UNFINISHED: Record<GridStandardType, string> = {
  fences: "the share of the loop you draw, less lines drawn off it, more for drawing it early",
  fillomino: "the share of blank squares numbered right, less those numbered wrong, more for doing it early",
  bridges: "the share of the solution's bridges you build, less wrong ones, more for building them early",
  kakuro: "the share of white squares filled right, less those filled wrong, more for doing it early",
};

/** What a mistake is, for the clean bonus. */
const MISTAKE: Record<GridStandardType, string> = {
  fences: "no line ever drawn off the loop",
  fillomino: "no wrong number ever entered (erased ones too)",
  bridges: "no wrong bridge ever built",
  kakuro: "no wrong digit ever entered (erased ones too)",
};

const FINISH: Record<GridStandardType, string> = {
  fences: "draw the whole loop",
  fillomino: "fill every region correctly",
  bridges: "link every island correctly",
  kakuro: "fill the grid correctly",
};

/** The "?" help SCORE text: one line a part (scoreList.ts). */
export function gridStandardHelp(type: GridStandardType): string {
  const r = GRID_STANDARD[type];
  const word = r.word.charAt(0).toUpperCase() + r.word.slice(1);
  return puzzleScoreList({
    finish: FINISH[type],
    speed: { max: r.speed, fullByS: r.fullByS },
    bonuses: [{ label: word, how: `${MISTAKE[type]}, ${fmt(r.per)} less for each`, max: r.bonus }],
    unfinished: UNFINISHED[type],
    total: roundMaxFor(type),
  });
}

/** The round intro SCORE line (at most 90 characters, no scoring terms). */
const INTRO: Record<GridStandardType, string> = {
  fences: "Draw the whole loop; bonuses for speed and no wrong lines.",
  fillomino: "Fill every region; bonuses for speed and no wrong numbers.",
  bridges: "Link every island; bonuses for speed and no wrong bridges.",
  kakuro: "Fill the grid; bonuses for speed and no wrong digits.",
};

export function gridStandardIntro(type: GridStandardType): string {
  return `${INTRO[type]} Up to ${roundMaxFor(type)}.`;
}
