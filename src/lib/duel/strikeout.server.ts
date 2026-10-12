/**
 * Strikeout generation and live checks (server only: the words never leave it
 * before the reveal).
 */

import { answerWords, isWord } from "./dictionary.server";
import {
  SO_LEN,
  SO_ROWS,
  STRIKEOUT_REV,
  decodeStrikeout,
  replayStrikeout,
  soView,
  type SoView,
} from "./strikeout";
import type { StrikeoutPuzzleData } from "./types";
import { rngBelow, seededRng } from "./wordSeed.server";

/** At least one row carries one of these. */
export const SO_RARE_LETTERS = "JKQVWXYZ";
export const SO_MIN_LETTERS = 14;
export const SO_MAX_LETTERS = 18;
/** With A, E, I, O and U all guessed, at most this many of the 25 tiles show. */
export const SO_MAX_VOWEL_TILES = 10;

const VOWELS = "AEIOU";

/** Null when the five words meet every generator rule, else the rule broken. */
export function strikeoutRuleBreak(words: readonly string[]): string | null {
  if (words.length !== SO_ROWS) return "not five words";
  if (new Set(words).size !== SO_ROWS) return "repeated word";
  const common = new Set(answerWords(SO_LEN));
  for (const w of words) if (!common.has(w)) return `${w} is not a common answer word`;
  const letters = new Set(words.join(""));
  if (letters.size < SO_MIN_LETTERS || letters.size > SO_MAX_LETTERS) return `${letters.size} distinct letters`;
  if (!words.some((w) => [...w].some((ch) => SO_RARE_LETTERS.includes(ch)))) return "no less common letter";
  let vowelTiles = 0;
  for (const w of words) {
    const shown = [...w].filter((ch) => VOWELS.includes(ch)).length;
    if (shown === w.length) return `${w} is solved by vowels alone`;
    vowelTiles += shown;
  }
  if (vowelTiles > SO_MAX_VOWEL_TILES) return `${vowelTiles} tiles show after the five vowels`;
  return null;
}

/** Five different common five-letter words from the game's seed. */
export function generateStrikeout(seed: number): StrikeoutPuzzleData {
  const rng = seededRng(seed);
  const pool = answerWords(SO_LEN);
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const words: string[] = [];
    while (words.length < SO_ROWS) {
      const w = pool[rngBelow(rng, pool.length)]!;
      if (!words.includes(w)) words.push(w);
    }
    if (strikeoutRuleBreak(words) === null) {
      return { type: "strikeout", strikeoutRev: STRIKEOUT_REV, rows: SO_ROWS, length: SO_LEN, words };
    }
  }
  throw new Error("Strikeout: no word set found");
}

/** Live check: replays the whole list and returns only what the player has earned. */
export function checkStrikeoutMoves(words: readonly string[], moves: string): SoView {
  const actions = decodeStrikeout(moves);
  return soView(words, replayStrikeout(words, actions, isWord), actions.length);
}
