/**
 * The nine Word games' levels (the Word overhaul, stage 3, 15 Nov 2026): each game's entry lives in its own file, so
 * GAME_LEVELS (gameLevels.ts) takes them all from here. Plain data only.
 */
import type { GameLevels } from "../gameLevels";
import type { Level } from "../levels";
import { WORDSMITH_LEVELS, WORDSMITH_LEVEL_ABOUT } from "./wordsmith";
import { TILEGRID_LEVELS, TILEGRID_LEVEL_ABOUT } from "./tilegrid";
import { WORDSLIDE_LEVELS, WORDSLIDE_LEVEL_ABOUT } from "./wordslide";
import { WORDHUNT_LEVELS, WORDHUNT_LEVEL_ABOUT } from "./wordhunt";
import { WORDSEARCH_LEVELS, WORDSEARCH_LEVEL_ABOUT } from "./wordsearch";
import { LETTERWHEEL_LEVELS, LETTERWHEEL_LEVEL_ABOUT } from "./letterwheel";
import { STRIKEOUT_LEVELS, STRIKEOUT_LEVEL_ABOUT } from "./strikeout";
import { CODEWORD_LEVELS, CODEWORD_LEVEL_ABOUT } from "./codeword";
import { SWAPWORD_LEVELS, SWAPWORD_LEVEL_ABOUT } from "./swapword";

export const WORD_LEVELS: Readonly<Record<string, GameLevels>> = {
  ...(WORDSMITH_LEVELS ? { wordsmith: WORDSMITH_LEVELS } : {}),
  ...(TILEGRID_LEVELS ? { tilegrid: TILEGRID_LEVELS } : {}),
  ...(WORDSLIDE_LEVELS ? { wordslide: WORDSLIDE_LEVELS } : {}),
  ...(WORDHUNT_LEVELS ? { wordhunt: WORDHUNT_LEVELS } : {}),
  ...(WORDSEARCH_LEVELS ? { wordsearch: WORDSEARCH_LEVELS } : {}),
  ...(LETTERWHEEL_LEVELS ? { letterwheel: LETTERWHEEL_LEVELS } : {}),
  ...(STRIKEOUT_LEVELS ? { strikeout: STRIKEOUT_LEVELS } : {}),
  ...(CODEWORD_LEVELS ? { codeword: CODEWORD_LEVELS } : {}),
  ...(SWAPWORD_LEVELS ? { swapword: SWAPWORD_LEVELS } : {}),
};

/** Each Word game's one line per level beyond Normal (the game page, the round intro and the help). */
export const WORD_LEVEL_ABOUT: Readonly<Record<string, Partial<Record<Exclude<Level, "normal">, string>>>> = {
  wordsmith: WORDSMITH_LEVEL_ABOUT,
  tilegrid: TILEGRID_LEVEL_ABOUT,
  wordslide: WORDSLIDE_LEVEL_ABOUT,
  wordhunt: WORDHUNT_LEVEL_ABOUT,
  wordsearch: WORDSEARCH_LEVEL_ABOUT,
  letterwheel: LETTERWHEEL_LEVEL_ABOUT,
  strikeout: STRIKEOUT_LEVEL_ABOUT,
  codeword: CODEWORD_LEVEL_ABOUT,
  swapword: SWAPWORD_LEVEL_ABOUT,
};
