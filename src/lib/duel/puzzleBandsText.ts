/**
 * Score text for the puzzles (puzzleScoreRev 3's helper since 20 Oct 2026, the score bands before; docs/scoring-targets.md): what
 * counts as progress in each game, and the numbers its own knots give (half done, a finish as time runs out, a
 * finish with a third of the clock left). The intro SCORE line and the "?" help both come from here, so they
 * always state the knots rooms deal.
 */
import { rev2KnotsFor, rev2Points, REV2_UNFINISHED_TOP } from "./puzzleScoreRev2";
import { rev3Applies, rev3FastFinishSeconds, rev3UnfinishedScore } from "./puzzleScoreRev3";
import { roundMaxFor } from "./roundMax";
import type { PuzzleType } from "./types";

/** Each finish game's progress measure (the "?" help and docs/scoring-targets.md). */
export const PROGRESS_MEASURE: Partial<Record<PuzzleType, string>> = {
  tilegrid: "tiles inside a real word",
  wordslide: "rows you made into words: 1 row 30, 2 rows 70, 3 rows 90, 4 rows 110",
  wordsearch: "words found (wrong picks after the first 5 cost a little)",
  letterwheel: "words found (misses after the first 5 cost a little)",
  strikeout: "words solved, plus letters found in the current word",
  codeword: "numbers decoded right (a wrong letter costs)",
  swapword: "tiles you placed (tiles you moved out of place cost)",
  target: "how close the closest number you made is (off by 1 is 110)",
  equation: "equations solved (3 tries each), plus operators right from the left in the one you are on",
  balance: "scales balanced in order, plus weights on their right notches on the one you are on",
  numpyramid: "pyramids finished, plus right bricks on the next one",
  trail: "tiles on the right path from 1 (or right tiles less wrong ones, if more)",
  measure: "puzzles solved in order, plus how much nearer solved the jugs you are on came",
  checkout: "boards checked out (bigger boards count more)",
  numhunt: "numbers reached in order (wrong taps cost)",
  chain: "links tapped",
  symscan: "eagles found (wrong taps cost)",
  spotdiff: "differences found (wrong taps cost)",
  countup: "trays counted right (one off still counts a little)",
  maze: "how far along the route you got (wandering costs)",
  pairmatch: "pairs found, the first ones a little more (lots of mismatched tries cost)",
  unblock: "how much nearer the gold block is to getting out (wasted moves cost)",
  blockparty: "pieces in their solution spot (pieces elsewhere cost)",
  iceslide: "the distance to the exit you closed (wasted moves cost)",
  gravity: "how much closer your balls are to all parked (tilts that don't help cost)",
  tiles: "how much nearer the tiles are to in order (wasted moves cost)",
  rings: "how much nearer the rings are to lined up (wasted turns cost)",
  laser: "the most gems any layout of yours lit",
  pipes: "tiles you joined to the source",
  lightsout: "how many of the presses needed you have made (wasted presses cost)",
  sudoku: "right cells (a wrong digit costs)",
  flow: "pairs joined on their route (other joined pairs cost)",
  push: "how much nearer the crates are to their spots (pushes beyond the fewest cost)",
  tower: "how much nearer the rings are to stacked on the gold post (wasted moves cost)",
  tubes: "how much closer your flasks are to all sorted (pours that don't help cost triple)",
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
  countup: "each tray counted", maze: "how far you get", pairmatch: "each pair", unblock: "getting closer",
  blockparty: "each piece in place", iceslide: "getting closer", gravity: "getting closer", tiles: "getting closer",
  rings: "getting closer", laser: "each gem lit", pipes: "each tile joined", lightsout: "each right press",
  sudoku: "each right cell", flow: "each pair joined", push: "getting closer", tower: "getting closer",
  tubes: "getting closer", safe: "each dial right", bomb: "each right step", nonogram: "each right cell",
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

/* ============ puzzleScoreRev 3 (20 Oct 2026): the shared helper (puzzleScoreRev3.ts) ============ */

/**
 * The round's clock (seconds) as rooms deal it today. A plain table (the registry imports the puzzles, which
 * import this text); scoring-rev3-check compares it with the clock of freshly dealt puzzles.
 */
export const DEALT_LIMIT_S: Partial<Record<PuzzleType, number>> = {
  tilegrid: 100, wordslide: 100, wordsearch: 120, letterwheel: 100, strikeout: 100, codeword: 120, swapword: 120, target: 75, equation: 90, balance: 120, numpyramid: 120, trail: 120, measure: 120, checkout: 90, numhunt: 60, chain: 45, symscan: 30, spotdiff: 60, countup: 60, maze: 60, pairmatch: 90, unblock: 60, blockparty: 60, iceslide: 90, gravity: 90, tiles: 90, rings: 60, laser: 60, pipes: 120, lightsout: 75, sudoku: 90, flow: 75, push: 120, tower: 90, tubes: 90, safe: 75, bomb: 90, nonogram: 120, flood: 60, tents: 90, shikaku: 90, lightup: 90,
};

/** The round's clock as rooms deal it today (ms). */
export function dealtLimitMs(type: PuzzleType): number {
  return (DEALT_LIMIT_S[type] ?? 90) * 1000;
}

/** Seconds of play a finish with no mistakes may take and still score the maximum (150 today). */
export function fastFinishSeconds(type: PuzzleType): number {
  return rev3FastFinishSeconds(type, dealtLimitMs(type));
}

/** The rev-3 numbers the help states: half done, one short, the buzzer finish and the top finish time. */
export function rev3Figures(type: PuzzleType): { half: number; oneShort: number; buzzer: number; fastSeconds: number } {
  return { half: rev3UnfinishedScore(type, 0.5), oneShort: 110, buzzer: 120, fastSeconds: fastFinishSeconds(type) };
}

/** The "?" help SCORE text for a helper puzzle. */
export function rev3Help(type: PuzzleType): string {
  const f = rev3Figures(type);
  const eff = EFFICIENCY_WORD[type];
  return `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Unfinished scores up to 110: about ${f.half} half done, 110 one step short. Any finish scores 120 to ${roundMaxFor(type)}: 120 as time runs out, ${roundMaxFor(type)} if you finish in about ${f.fastSeconds} s with no mistakes${eff ? ` (extra ${eff} only cut the speed points)` : ""}.`;
}

/** The round intro SCORE line for a helper puzzle (at most two phone lines, no scoring terms). */
export function rev3Intro(type: PuzzleType): string {
  const short = PROGRESS_SHORT[type] ?? "progress";
  return `${short[0]!.toUpperCase()}${short.slice(1)}: up to 110. Finish: 120+, or ${roundMaxFor(type)} in about ${fastFinishSeconds(type)} s, no mistakes.`;
}

/** The "?" help SCORE text for a score-bands puzzle (rev 3's helper text for the helper games). */
export function bandsHelp(type: PuzzleType): string {
  if (rev3Applies(type)) return rev3Help(type);
  const f = bandsFigures(type);
  const eff = EFFICIENCY_WORD[type];
  return `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Any finish beats every unfinished run, and the faster you finish${eff ? ` and the fewer ${eff}` : ""}, the more it scores. About ${f.half} for half done, ${f.buzzer} for a finish as time runs out, ${f.third} for a finish with a third of the time left${eff ? ` and none wasted` : ""}; ${roundMaxFor(type)} only for a perfect run.`;
}

/** The round intro SCORE line for a score-bands puzzle (at most two phone lines, no scoring terms). */
export function bandsIntro(type: PuzzleType): string {
  if (rev3Applies(type)) return rev3Intro(type);
  return `Points for ${PROGRESS_SHORT[type] ?? "progress"}. Finish for more, quicker for more still; ${roundMaxFor(type)} is perfect.`;
}

/* ============ Open games (Nucleus, Forage, Flash, Bang On, Ballpark): the rev-1 score mapped ============ */

/** The fewest of `xs` (ascending search) whose open-game score reaches `points`, by `scoreOf`. */
function firstReaching(xs: readonly number[], scoreOf: (x: number) => number, points: number): number | null {
  for (const x of xs) if (scoreOf(x) >= points) return x;
  return null;
}

/** "N ≈ 70, … , 150 at M" (the game's maximum at M) for an open game whose result is `rev1(x)`, x rising with skill. */
export function openBandsLine(type: PuzzleType, xs: readonly number[], rev1: (x: number) => number, unit: (x: number) => string): string {
  const knots = rev2KnotsFor(type);
  const score = (x: number) => rev2Points(knots, rev1(x));
  const parts = [70, 100, 120, 140].map((p) => {
    const x = firstReaching(xs, score, p);
    return x === null ? null : `${unit(x)} ≈ ${score(x)}`;
  }).filter(Boolean);
  const max = roundMaxFor(type);
  const top = firstReaching(xs, score, max);
  return `${parts.join(", ")}${top === null ? "" : `, ${max} at ${unit(top)}`}`;
}
