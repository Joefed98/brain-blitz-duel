import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";

/**
 * Slider's levels (the Word overhaul, stage 3, 15 Nov 2026; redesigned by D1, 21 Nov 2026,
 * docs/polish-plan-final/difficulty-spec.md "Slider"). Plain data only: the phone reads it to draw the level switch, the
 * server to deal (src/lib/duel/levels/wordslide.server.ts). Normal is today's game (five common words on a 5 × 5 grid,
 * scrambled 5–8 slides, par the proven fewest, 100 s).
 *
 * The grid's size is the ladder, 16, 25, 36 and 49 tiles: each row a common answer of the grid's length (answerWords),
 * every level on Normal's 100 s. A level board carries wordSlideRev 7 and its `size` (wordSlide.ts `wordSlideSize`), so
 * every rule, the grader and the stage read the size from the stored puzzle. Joe (21 Nov 2026): Easy and Hard deal
 * unfiltered from the room seed; Expert deals only from its proved bank (scripts/slider-level-bank.ts): boards whose
 * elite person-like line at the human limits (scripts/slider-human.ts, never reading the words) reaches 200 on Expert's
 * own looser par line, stored on the board. The par stays at 7 or under on the bigger grids (Joe, 21 Nov 2026, option A:
 * Hard 6 or 7, Expert 6), so proving it, and grading an unfinished board, costs no more than Normal's depth 8.
 * Any real words in the rows finish the board, so the game is open by design.
 */
export interface WordSlideLevelSettings {
  /** The grid's side (4, Normal's 5, 6, 7), stored on the puzzle as `size`. */
  size: number;
  /** The scramble's slides, inclusive. */
  shifts: readonly [number, number];
  /** The proven fewest slides back to the words (the par), inclusive. */
  par: readonly [number, number];
  /** The level's clock, when it isn't Normal's 100 s. */
  timeLimitMs?: number;
  /** Deal from the level's proved bank (scripts/slider-level-bank.ts), not from the seed. */
  bank?: boolean;
  /**
   * The level's own par line (Joe, 21 Nov 2026: Expert's looser par), stored on the board as `parFullAt` / `parZeroAt`:
   * the whole par bonus within `full` slides, nothing from `zero`; absent = the proven par and twice it (Normal's).
   */
  parLine?: { readonly full: number; readonly zero: number };
}

const OPEN = { open: "Any real words in the rows finish the board, so there is no single answer to prove." } as const;

export const WORDSLIDE_LEVEL_SETTINGS: Readonly<Record<Exclude<Level, "normal">, WordSlideLevelSettings>> = {
  // Joe (21 Nov 2026): Hard is dealt unfiltered from the room seed; Expert only from boards the elite's line at the
  // human limits takes to 200, on its own looser par line (scripts/slider-level-bank.ts).
  easy: { size: 4, shifts: [3, 3], par: [2, 3] },
  hard: { size: 6, shifts: [6, 7], par: [6, 7] },
  // Joe (21 Nov 2026, option A): 6 slides, so the strong player steps down from Hard (about 35) to Expert (about 24,
  // solving one board in nine) while every dealt board keeps its proof; Hard 6 or 7 slides.
  expert: { size: 7, shifts: [6, 6], par: [6, 6], bank: true, parLine: { full: 21, zero: 42 } },
};

export const WORDSLIDE_LEVELS: GameLevels | null = {
  levels: {
    easy: { settings: { ...WORDSLIDE_LEVEL_SETTINGS.easy }, oneSolution: OPEN },
    hard: { settings: { ...WORDSLIDE_LEVEL_SETTINGS.hard }, oneSolution: OPEN },
    expert: { settings: { ...WORDSLIDE_LEVEL_SETTINGS.expert }, oneSolution: OPEN },
  },
};

/** One plain line per level beyond Normal: what changes (the game page, the intro and the help say it). */
export const WORDSLIDE_LEVEL_ABOUT: Partial<Record<Exclude<Level, "normal">, string>> = {
  easy: "A small 4 by 4 grid of four-letter words, only 2 or 3 slides away.",
  hard: "A 6 by 6 grid of six-letter words, 6 or 7 slides away.",
  expert: "A 7 by 7 grid of seven-letter words, 6 slides away, and a looser move bonus.",
};
