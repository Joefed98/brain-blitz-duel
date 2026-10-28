/**
 * The scoring standard's Word games (27 Oct 2026, docs/scoring-standard.md "Word"): each game's numbers and its
 * score texts (the "?" help and the round intro's SCORE line). Shared by the phone and the server, pure: the grader
 * (word.server.ts) scores with these numbers and the texts quote them.
 *
 *   finished   = 150 + speed (full by `fullByS` seconds used, 0 at the buzzer) + the game's bonus, at most 200
 *   unfinished = the game's credit + "how early" extras + mid-puzzle bonuses, at most 130
 */
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";

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

const FIN = STANDARD_FINISH;
const CAP = STANDARD_UNFINISHED_CAP;
const speedLine = (points: number, s: number) => `up to ${points} for speed (all ${points} if you finish within ${s} s, falling evenly to 0 at the buzzer)`;
const unfinishedCap = `An unfinished round scores at most ${CAP}, so any finish beats it.`;

/** The "?" help SCORE text for each Word game on the standard (`{max}` is the round maximum). */
export const WORD_STANDARD_HELP = {
  tilegrid:
    `Finish (all 15 tiles in one connected grid, every run a real word): ${FIN}, plus ${speedLine(STD_INTERLOCK.speed, STD_INTERLOCK.fullByS)}, plus big words: each 5-letter word +${STD_INTERLOCK.big[5]}, 6 letters +${STD_INTERLOCK.big[6]}, 7 letters +${STD_INTERLOCK.big[7]}, up to ${STD_INTERLOCK.bigMax}; {max} needs both. ` +
    `Unfinished: ${STD_INTERLOCK.tile} per tile inside a real word, plus up to ${STD_INTERLOCK.early} each for placing it early, plus big words already made. ${unfinishedCap}`,
  wordslide:
    `Finish (all five rows words): ${FIN}, plus ${speedLine(STD_SLIDER.speed, STD_SLIDER.fullByS)}, plus up to ${STD_SLIDER.par} for moves: all ${STD_SLIDER.par} within par (the slides that scrambled the board, shown beside your moves), falling evenly to 0 at twice par; Undo and Reset count as moves. ` +
    `Unfinished: ${STD_SLIDER.row} per row you turned into a word, plus up to ${STD_SLIDER.early} each for making it early. ${unfinishedCap}`,
  wordsearch:
    `Finish (all six listed words): ${FIN}, plus ${speedLine(STD_LOOKOUT.speed, STD_LOOKOUT.fullByS)}, plus ${STD_LOOKOUT.bonus} for the hidden bonus word (find it before the sixth word: the sixth ends the round); {max} needs both. ` +
    `Unfinished: ${STD_LOOKOUT.word} per word, plus up to ${STD_LOOKOUT.early} each for finding it early, plus ${STD_LOOKOUT.bonus} for the bonus word; the first ${STD_LOOKOUT.freeWrong} wrong drags are free, then each costs ${STD_LOOKOUT.wrongCost}. ${unfinishedCap}`,
  letterwheel:
    `Finish (every crossword slot filled): ${FIN}, plus ${speedLine(STD_ROUNDABOUT.speed, STD_ROUNDABOUT.fullByS)} (cut by misses after the first ${STD_ROUNDABOUT.freeMisses}), plus the bonus jar: real words that are not in the crossword fill it (3 letters 1 drop, 4 letters 2, 5 letters 3, 6+ letters 4; each word once) and each miss after the first ${STD_ROUNDABOUT.freeMisses} spills a drop; it adds up to ${STD_ROUNDABOUT.jar} by how full it is. {max} needs a fast finish and a full jar. ` +
    `Unfinished: up to ${STD_ROUNDABOUT.share} by the share of slots filled, plus up to ${STD_ROUNDABOUT.early} for filling them early, plus the jar; a trace that is not a word is a miss, the first ${STD_ROUNDABOUT.freeMisses} free, then each costs ${STD_ROUNDABOUT.missCost}. ${unfinishedCap}`,
  strikeout:
    `Finish (all five words): ${FIN}, plus ${speedLine(STD_STRIKEOUT.speed, STD_STRIKEOUT.fullByS)}, plus early solves: ${STD_STRIKEOUT.earlySolve} for each word you Solve while ${STD_STRIKEOUT.earlyHidden} or more of its letters are still hidden (up to ${STD_STRIKEOUT.earlySolveMax}), plus ${STD_STRIKEOUT.strikeLeft} per strike left (up to ${STD_STRIKEOUT.strikeMax}). ` +
    `Unfinished: ${STD_STRIKEOUT.word} per word solved, plus ${STD_STRIKEOUT.tile} per letter you found in the current word, plus up to ${STD_STRIKEOUT.early} per word for solving it early, plus early solves so far. ${unfinishedCap}`,
  codeword:
    `Finish (every number decoded): ${FIN}, plus ${speedLine(STD_CRYPTOGRID.speed, STD_CRYPTOGRID.fullByS)}, plus ${STD_CRYPTOGRID.clean} for a clean crack: no wrong letter ever entered. ` +
    `Unfinished: up to ${STD_CRYPTOGRID.share} by the share of the code decoded, plus up to ${STD_CRYPTOGRID.early} for decoding it early; each wrong letter left standing costs ${STD_CRYPTOGRID.wrongCost}. ${unfinishedCap}`,
  swapword:
    `Finish (all six words right): ${FIN}, plus ${speedLine(STD_SWAPWORD.speed, STD_SWAPWORD.fullByS)}, plus up to ${STD_SWAPWORD.par} for swaps: all ${STD_SWAPWORD.par} in par (the fewest swaps that solve the board), falling evenly to 0 at twice par. ` +
    `Unfinished: up to ${STD_SWAPWORD.share} by the share of tiles you put in place (a tile that started in place and was moved out takes one back), plus up to ${STD_SWAPWORD.early} for placing them early. ${unfinishedCap}`,
} as const;

/** The round intro SCORE line for each Word game on the standard (at most two phone lines, no scoring terms). */
export const WORD_STANDARD_INTRO = {
  tilegrid: `${STD_INTERLOCK.tile} per tile in a word. Finish ${FIN}; fast, with long words, up to {max}.`,
  wordslide: `${STD_SLIDER.row} per word row you make. Finish ${FIN}; fast, in few moves, up to {max}.`,
  wordsearch: `${STD_LOOKOUT.word} per word. Finish ${FIN}; fast, with the hidden bonus word, up to {max}.`,
  letterwheel: `Points for slots filled. Finish ${FIN}; fast, with a full bonus jar, up to {max}.`,
  strikeout: `${STD_STRIKEOUT.word} per word. Finish ${FIN}; fast, early solves and strikes left: {max}.`,
  codeword: `Points for the code decoded. Finish ${FIN}; fast, with no wrong letter: {max}.`,
  swapword: `Points for tiles in place. Finish ${FIN}; fast, in the fewest swaps: {max}.`,
} as const;
