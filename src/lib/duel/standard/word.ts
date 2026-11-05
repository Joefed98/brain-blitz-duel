/**
 * The scoring standard's Word games (27 Oct 2026, docs/scoring-standard.md "Word"): each game's numbers and its
 * score texts (the "?" help and the round intro's SCORE line). Shared by the phone and the server, pure: the grader
 * (word.server.ts) scores with these numbers and the texts quote them.
 *
 *   finished   = 150 + speed (full by `fullByS` seconds used, 0 at the buzzer) + the game's bonus, at most 200
 *   unfinished = the game's credit + "how early" extras + mid-puzzle bonuses, at most 130
 */
import { puzzleScoreList } from "../scoreList";

/** Interlock (`tilegrid`, tileGridRev 3). */
export const STD_INTERLOCK = {
  /** Unfinished: per tile inside a real word, plus up to `early` each for how early. */
  tile: 8,
  early: 1,
  speed: 20,
  fullByS: 33,
  /** Big words: each valid word of 5 / 6 / 7 letters in the grid (unfinished too), at most `bigMax`. */
  big: { 5: 6, 6: 10, 7: 15 } as Readonly<Record<number, number>>,
  bigMax: 30,
} as const;

/** Slider (`wordslide`, wordSlideRev 3). */
export const STD_SLIDER = { row: 24, early: 2, speed: 35, fullByS: 33, par: 15 } as const;

/** Lookout (`wordsearch`, wordSearchRev 4). */
export const STD_LOOKOUT = { word: 20, early: 1.5, freeWrong: 5, wrongCost: 2, speed: 20, fullByS: 40, bonus: 30 } as const;

/** Roundabout (`letterwheel`, wheelRev 4). */
export const STD_ROUNDABOUT = { share: 120, early: 10, freeMisses: 5, missCost: 3, speed: 20, fullByS: 40, jar: 30 } as const;

/** Strikeout (`strikeout`, strikeoutRev 7). */
export const STD_STRIKEOUT = {
  word: 28,
  /** Per tile the player revealed in the current, unsolved word (starting letters earn nothing). */
  tile: 2,
  /** Up to this much per solved word for how early. */
  early: 2,
  speed: 20,
  fullByS: 40,
  /** Early solve: this much per word solved with Solve while at least `earlyHidden` of its tiles were still hidden. */
  earlySolve: 4,
  earlyHidden: 3,
  earlySolveMax: 20,
  /** Per strike left at the finish. */
  strikeLeft: 1,
  strikeMax: 10,
} as const;

/** Cryptogrid (`codeword`, codewordRev 5). */
export const STD_CRYPTOGRID = { share: 120, early: 10, wrongCost: 5, speed: 40, fullByS: 60, clean: 10 } as const;

/** Swapword (`swapword`, swapwordRev 7). */
export const STD_SWAPWORD = { share: 120, early: 10, speed: 20, fullByS: 60, par: 30 } as const;

/** Interlock's big-word points for one valid word of `len` letters (0 under 5). */
export function interlockBigWordPoints(len: number): number {
  return STD_INTERLOCK.big[Math.min(7, len)] ?? 0;
}

/** Strikeout's early-solve points for the hidden tiles each word still had when it was solved with Solve. */
export function strikeoutEarlySolvePoints(hiddenAtSolve: readonly number[]): number {
  const words = hiddenAtSolve.filter((h) => h >= STD_STRIKEOUT.earlyHidden).length;
  return Math.min(STD_STRIKEOUT.earlySolveMax, STD_STRIKEOUT.earlySolve * words);
}

/**
 * Swapword's blind swaps: swaps (of those the replay counted) that left neither of their two tiles in place. Every swap
 * of a solving line puts at least one tile in place, so a player loses nothing to them; random swaps are nearly all
 * blind. The standard's unfinished credit counts tiles placed less those moved out of place and less blind swaps.
 */
export function swapwordBlindSwaps(start: string, swaps: readonly (readonly [number, number])[], counted: number, solution: string): number {
  const board = [...start];
  let blind = 0;
  for (const [a, b] of swaps.slice(0, Math.max(0, counted))) {
    [board[a], board[b]] = [board[b]!, board[a]!];
    if (board[a] !== solution[a] && board[b] !== solution[b]) blind++;
  }
  return blind;
}

/* ------------------------------------------------------------------------------------------------ texts */

const TOTAL = "{max}" as unknown as number;

/** The "?" help SCORE text for each Word game on the standard (`{max}` is the round maximum): one line a part. */
export const WORD_STANDARD_HELP = {
  tilegrid: puzzleScoreList({
    finish: "place all 15 tiles in one connected grid, every run a real word",
    speed: { max: STD_INTERLOCK.speed, fullByS: STD_INTERLOCK.fullByS },
    bonuses: [{ label: "Big words", how: `${STD_INTERLOCK.big[5]} for each 5-letter word, ${STD_INTERLOCK.big[6]} for 6 letters, ${STD_INTERLOCK.big[7]} for 7, finished or not`, max: STD_INTERLOCK.bigMax }],
    unfinished: `${STD_INTERLOCK.tile} for each tile inside a real word, more for placing it early`,
    total: TOTAL,
  }),
  wordslide: puzzleScoreList({
    finish: "make all five rows words",
    speed: { max: STD_SLIDER.speed, fullByS: STD_SLIDER.fullByS },
    bonuses: [{ label: "Moves", how: "finish within par (shown beside your moves; Undo and Reset count) for all of it, nothing at twice par", max: STD_SLIDER.par }],
    unfinished: `${STD_SLIDER.row} for each row you make a word, more for making it early`,
    total: TOTAL,
  }),
  wordsearch: puzzleScoreList({
    finish: "find all six listed words",
    speed: { max: STD_LOOKOUT.speed, fullByS: STD_LOOKOUT.fullByS },
    bonuses: [{ label: "Bonus word", how: "find the hidden bonus word before the sixth word (the sixth ends the round), finished or not", fixed: STD_LOOKOUT.bonus }],
    unfinished: `${STD_LOOKOUT.word} for each word found, more for finding it early`,
    penalties: [`The first ${STD_LOOKOUT.freeWrong} wrong drags are free, then each costs ${STD_LOOKOUT.wrongCost}`],
    total: TOTAL,
  }),
  letterwheel: puzzleScoreList({
    finish: "fill every crossword slot",
    speed: { max: STD_ROUNDABOUT.speed, fullByS: STD_ROUNDABOUT.fullByS },
    bonuses: [{ label: "Bonus jar", how: "real words not in the crossword fill it (longer words more), finished or not", max: STD_ROUNDABOUT.jar }],
    unfinished: "the share of slots filled, more for filling them early",
    penalties: [`A trace that is not a word is a miss: the first ${STD_ROUNDABOUT.freeMisses} are free, then each costs ${STD_ROUNDABOUT.missCost} and spills a drop from the jar`],
    total: TOTAL,
  }),
  strikeout: puzzleScoreList({
    finish: "solve all five words",
    speed: { max: STD_STRIKEOUT.speed, fullByS: STD_STRIKEOUT.fullByS },
    bonuses: [
      { label: "Early solves", how: `${STD_STRIKEOUT.earlySolve} for each word you Solve with ${STD_STRIKEOUT.earlyHidden} or more letters still hidden`, max: STD_STRIKEOUT.earlySolveMax },
      { label: "Strikes left", how: `${STD_STRIKEOUT.strikeLeft} for each strike you have left`, max: STD_STRIKEOUT.strikeMax },
    ],
    unfinished: `${STD_STRIKEOUT.word} for each word solved, ${STD_STRIKEOUT.tile} for each letter found in the current one, more for solving early`,
    total: TOTAL,
  }),
  codeword: puzzleScoreList({
    finish: "decode every number",
    speed: { max: STD_CRYPTOGRID.speed, fullByS: STD_CRYPTOGRID.fullByS },
    bonuses: [{ label: "Clean crack", how: "no wrong letter ever entered", fixed: STD_CRYPTOGRID.clean }],
    unfinished: "the share of the code decoded, more for decoding it early",
    penalties: [`When not finished, each wrong letter left standing costs ${STD_CRYPTOGRID.wrongCost}`],
    total: TOTAL,
  }),
  swapword: puzzleScoreList({
    finish: "make all six words right",
    speed: { max: STD_SWAPWORD.speed, fullByS: STD_SWAPWORD.fullByS },
    bonuses: [{ label: "Swaps", how: "solve it in the fewest swaps (par) for all of it, nothing at twice par", max: STD_SWAPWORD.par }],
    unfinished: "the share of tiles you put in place, more for placing them early",
    total: TOTAL,
  }),
} as const;

/** The round intro SCORE line for each Word game on the standard (at most two phone lines, no scoring terms). */
export const WORD_STANDARD_INTRO = {
  tilegrid: "Use every tile in real words; bonuses for speed and long words. Up to {max}.",
  wordslide: "Make every row a word; bonuses for speed and few moves. Up to {max}.",
  wordsearch: "Find every word; bonuses for speed and the hidden bonus word. Up to {max}.",
  letterwheel: "Fill every slot; bonuses for speed and a full bonus jar. Up to {max}.",
  strikeout: "Solve every word; bonuses for speed, early solves and strikes left. Up to {max}.",
  codeword: "Crack the code; bonuses for speed and no wrong letters. Up to {max}.",
  swapword: "Put every tile in place; bonuses for speed and the fewest swaps. Up to {max}.",
} as const;
