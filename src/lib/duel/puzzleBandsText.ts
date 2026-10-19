/**
 * Score text for the puzzles on the score bands (puzzleScoreRev 2, 19 Oct 2026; docs/scoring-targets.md): what
 * counts as progress in each game, and the numbers its own knots give (half done, a finish as time runs out, a
 * finish with a third of the clock left). The intro SCORE line and the "?" help both come from here, so they
 * always state the knots rooms deal.
 */
import { rev2KnotsFor, rev2Points, REV2_UNFINISHED_TOP } from "./puzzleScoreRev2";
import type { PuzzleType } from "./types";

/** Each finish game's progress measure (the "?" help and docs/scoring-targets.md). */
export const PROGRESS_MEASURE: Partial<Record<PuzzleType, string>> = {
  tilegrid: "tiles inside a real word",
  wordslide: "rows you made into words (wasted moves cost)",
  wordsearch: "words found (wrong picks after the first 5 cost a little)",
  letterwheel: "words found (misses after the first 5 cost a little)",
  strikeout: "words solved, plus letters found in the current word",
  codeword: "numbers decoded right (a wrong letter costs)",
  swapword: "tiles you placed (tiles you moved out of place cost)",
  target: "how close the closest number you made is",
  equation: "equations solved, 3 tries each",
  balance: "scales balanced (bigger scales count more)",
  numpyramid: "pyramids finished, plus right bricks on the next one",
  trail: "tiles in their right cell (tiles in a wrong cell cost)",
  measure: "puzzles solved in order",
  checkout: "boards checked out (bigger boards count more)",
  numhunt: "numbers reached in order (wrong taps cost)",
  chain: "links tapped",
  symscan: "eagles found (wrong taps cost)",
  spotdiff: "differences found (wrong taps cost)",
  countup: "trays counted right (one off still counts a little)",
  maze: "how far along the route you got (wandering costs)",
  pairmatch: "pairs found (lots of mismatched tries cost)",
  unblock: "the gold block's lane cleared (wasted moves cost)",
  blockparty: "pieces in their solution spot (pieces elsewhere cost)",
  iceslide: "the distance to the exit you closed (wasted moves cost)",
  gravity: "balls you parked (wasted tilts cost)",
  tiles: "tiles you put in place (wasted moves cost)",
  rings: "spokes you lined up (wasted moves cost)",
  laser: "gems lit by your last shot",
  pipes: "tiles you joined to the source",
  lightsout: "lights turned off (a few left on counts most)",
  sudoku: "right cells (a wrong digit costs)",
  flow: "pairs joined on their route (other joined pairs cost)",
  push: "crates you brought home (wasted pushes cost)",
  tower: "rings you stacked on the gold post (wasted moves cost)",
  tubes: "flasks you corked (wasted pours cost)",
  safe: "dials right on your best try, or as they stand when time runs out (one lucky dial is free)",
  bomb: "correct steps before a strike",
  nonogram: "right cells (a wrong cell costs)",
  flood: "cells flooded, within the par moves",
  tents: "right tents (a wrong tent costs)",
  shikaku: "cells in the solution's rectangles (other rectangles cost)",
  lightup: "bulbs on the solution (other bulbs cost)",
};

/** The intro's short form of the measure (the intro line stays within two phone lines). */
export const PROGRESS_SHORT: Partial<Record<PuzzleType, string>> = {
  tilegrid: "each tile in a word", wordslide: "each row made a word", wordsearch: "each word found",
  letterwheel: "each word found", strikeout: "each word and letter", codeword: "each number decoded",
  swapword: "each tile placed", target: "getting close", equation: "each equation solved", balance: "each scale balanced",
  numpyramid: "each pyramid", trail: "each tile in place", measure: "each puzzle solved", checkout: "each board",
  numhunt: "each number reached", chain: "each link", symscan: "each eagle found", spotdiff: "each difference found",
  countup: "each tray counted", maze: "how far you get", pairmatch: "each pair", unblock: "clearing the lane",
  blockparty: "each piece in place", iceslide: "getting closer", gravity: "each ball parked", tiles: "each tile in place",
  rings: "each spoke lined up", laser: "each gem lit", pipes: "each tile joined", lightsout: "lights turned off",
  sudoku: "each right cell", flow: "each pair joined", push: "each crate home", tower: "each ring stacked",
  tubes: "each flask corked", safe: "each dial right", bomb: "each right step", nonogram: "each right cell",
  flood: "cells flooded", tents: "each right tent", shikaku: "each right rectangle", lightup: "each right bulb",
};

/** What the efficiency part counts, on games that measure one (fewer is better). */
export const EFFICIENCY_WORD: Partial<Record<PuzzleType, string>> = {
  wordslide: "moves", letterwheel: "misses", strikeout: "strikes", swapword: "swaps", measure: "moves", checkout: "darts",
  unblock: "moves", iceslide: "moves", gravity: "tilts", tiles: "moves", rings: "moves", laser: "shots",
  lightsout: "moves", push: "pushes", tower: "moves", tubes: "pours", safe: "tries", flood: "moves",
};

/** The points a game's knots give: half done, a finish as time runs out, a finish with a third of the clock left. */
export function bandsFigures(type: PuzzleType): { half: number; buzzer: number; third: number } {
  const knots = rev2KnotsFor(type);
  const eff = EFFICIENCY_WORD[type] !== undefined;
  return {
    half: rev2Points(knots, REV2_UNFINISHED_TOP / 2),
    buzzer: rev2Points(knots, 100),
    // A third of the clock left (and, where efficiency counts, none wasted).
    third: rev2Points(knots, eff ? 100 + 100 * (0.5 / 3 + 0.5) : 100 + 100 / 3),
  };
}

/** The "?" help SCORE text for a score-bands puzzle. */
export function bandsHelp(type: PuzzleType): string {
  const f = bandsFigures(type);
  const eff = EFFICIENCY_WORD[type];
  return `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Any finish beats every unfinished run, and the faster you finish${eff ? ` and the fewer ${eff}` : ""}, the more it scores. About ${f.half} for half done, ${f.buzzer} for a finish as time runs out, ${f.third} for a finish with a third of the time left${eff ? ` and none wasted` : ""}; 150 only for a perfect run.`;
}

/** The round intro SCORE line for a score-bands puzzle (at most two phone lines, no scoring terms). */
export function bandsIntro(type: PuzzleType): string {
  return `Points for ${PROGRESS_SHORT[type] ?? "progress"}. Finish for more, quicker for more still; 150 is perfect.`;
}

/* ============ Open games (Nucleus, Forage, Flash, Bang On, Ballpark): the rev-1 score mapped ============ */

/** The fewest of `xs` (ascending search) whose open-game score reaches `points`, by `scoreOf`. */
function firstReaching(xs: readonly number[], scoreOf: (x: number) => number, points: number): number | null {
  for (const x of xs) if (scoreOf(x) >= points) return x;
  return null;
}

/** "N ≈ 70, … , 150 at M" for an open game whose result is `rev1(x)`, x rising with skill. */
export function openBandsLine(type: PuzzleType, xs: readonly number[], rev1: (x: number) => number, unit: (x: number) => string): string {
  const knots = rev2KnotsFor(type);
  const score = (x: number) => rev2Points(knots, rev1(x));
  const parts = [70, 100, 120, 140].map((p) => {
    const x = firstReaching(xs, score, p);
    return x === null ? null : `${unit(x)} ≈ ${score(x)}`;
  }).filter(Boolean);
  const top = firstReaching(xs, score, 150);
  return `${parts.join(", ")}${top === null ? "" : `, 150 at ${unit(top)}`}`;
}
