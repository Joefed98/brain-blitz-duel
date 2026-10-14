/**
 * Strikeout generation and live checks (server only: the words never leave it
 * before the reveal).
 */

import { answerWords, isWord } from "./dictionary.server";
import {
  SO2_MAX_LEN,
  SO2_MIN_LEN,
  SO2_VOWELS,
  SO2_WORDS,
  SO_LEN,
  SO_ROWS,
  STRIKEOUT_REV,
  STRIKEOUT_REV2,
  decodeStrikeout,
  decodeStrikeout2,
  replayStrikeout,
  replayStrikeout2,
  so2View,
  soView,
  strikeoutRevOf,
  type SoView,
} from "./strikeout";
import { STRIKEOUT_WORDS_8_RAW } from "./strikeoutWords.server";
import type { StrikeoutPuzzleData } from "./types";
import { rngBelow, rngShuffle, seededRng } from "./wordSeed.server";

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

/** Rev 1 (stored rounds only): five different common five-letter words from the game's seed. */
export function generateStrikeoutRev1(seed: number): StrikeoutPuzzleData {
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

// ───────────────────────── Rev 2 ─────────────────────────

let words8: string[] | null = null;

/**
 * Rev 2 answer words of one length: seven letters from the shared common-word
 * list (answerWords(7)); eight letters from Strikeout's own list built with the
 * same rules (strikeoutWords.server.ts, since the shared list stops at seven).
 */
export function strikeoutAnswerWords(length: number): string[] {
  if (length === 8) {
    words8 ??= STRIKEOUT_WORDS_8_RAW.split(/\s+/)
      .filter((w) => w.length === 8 && isWord(w))
      .map((w) => w.toUpperCase());
    return words8;
  }
  return answerWords(length);
}

/** Endings that make a word guessable from its tail; at most one word in a set may carry each. */
export const SO2_TAILS = ["ING", "ED", "LY", "ER", "ION", "NESS", "MENT", "ITY", "OUS", "IVE", "AL", "IC"];
/** Each word keeps at least (its length − this) different letters hidden after its starting letters (7 → 5, 8 → 6)... */
export const SO2_HIDDEN_SLACK = 2;
/** ...of which at least this many are consonants, so the two vowel guesses never finish a word. */
export const SO2_MIN_HIDDEN_CONSONANTS = 3;
/**
 * Starting letters per word: two on a seven-letter word, one on an eight-letter
 * word (tuned with scripts/puzzle-fairness.ts: one on a seven-letter word costs
 * even a near-perfect solver too many strikes; two everywhere lets a good one
 * finish most boards).
 */
export function so2GivenCount(length: number): number {
  return length <= SO2_MIN_LEN ? 2 : 1;
}
/** Starting letters show at most this many tiles. */
export const SO2_MAX_GIVEN_TILES = 3;

const tailOf = (w: string) => SO2_TAILS.find((t) => w.endsWith(t)) ?? null;

/** Null when one word and its starting pattern meet the rev-2 rules, else the rule broken. */
export function strikeoutWordRuleBreak(word: string, pattern: string): string | null {
  if (word.length < SO2_MIN_LEN || word.length > SO2_MAX_LEN) return `${word} is ${word.length} letters`;
  if (!strikeoutAnswerWords(word.length).includes(word)) return `${word} is not a common answer word`;
  if (pattern.length !== word.length) return `${word}: pattern length`;
  const givens = new Set<string>();
  let givenTiles = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = pattern[i]!;
    if (ch === "_") continue;
    if (ch !== word[i]) return `${word}: pattern letter ${ch} at ${i}`;
    givens.add(ch);
    givenTiles++;
  }
  if (givens.size !== so2GivenCount(word.length)) return `${word}: ${givens.size} starting letters`;
  for (const g of givens) {
    if (SO2_VOWELS.includes(g)) return `${word}: starting vowel ${g}`;
    for (let i = 0; i < word.length; i++) if (word[i] === g && pattern[i] !== g) return `${word}: only some copies of ${g} show`;
  }
  if (givenTiles > SO2_MAX_GIVEN_TILES) return `${word}: ${givenTiles} starting tiles`;
  const hidden = new Set([...word].filter((ch) => !givens.has(ch)));
  if (hidden.size < word.length - SO2_HIDDEN_SLACK) return `${word}: ${hidden.size} hidden letters`;
  if ([...hidden].filter((ch) => !SO2_VOWELS.includes(ch)).length < SO2_MIN_HIDDEN_CONSONANTS) return `${word}: vowels nearly finish it`;
  return null;
}

/** Null when the five words and patterns meet every rev-2 generator rule, else the rule broken. */
export function strikeout2RuleBreak(words: readonly string[], givens: readonly string[]): string | null {
  if (words.length !== SO2_WORDS || givens.length !== SO2_WORDS) return "not five words";
  if (new Set(words).size !== SO2_WORDS) return "repeated word";
  const lengths = words.map((w) => w.length);
  if (!lengths.includes(7) || !lengths.includes(8)) return "no mix of 7 and 8 letters";
  for (let i = 0; i < SO2_WORDS; i++) {
    const broken = strikeoutWordRuleBreak(words[i]!, givens[i]!);
    if (broken) return broken;
    for (let j = 0; j < i; j++) {
      if (words[i]!.slice(0, 4) === words[j]!.slice(0, 4)) return `${words[j]} and ${words[i]} start alike`;
      const t = tailOf(words[i]!);
      if (t && t === tailOf(words[j]!)) return `${words[j]} and ${words[i]} both end -${t}`;
    }
  }
  return null;
}

/**
 * Rev 2: five different common 7–8 letter words (two or three of each length,
 * in seeded order), each with its starting consonants showing (so2GivenCount;
 * chosen by the seed). A starting letter shows every copy of itself in that
 * word, so its key is already used; starting letters are never vowels, so the
 * two vowel guesses stay the player's.
 */
export function generateStrikeout(seed: number): StrikeoutPuzzleData {
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const sevens = 2 + rngBelow(rng, 2);
    const lengths = rngShuffle(rng, Array.from({ length: SO2_WORDS }, (_, i) => (i < sevens ? 7 : 8)));
    const words: string[] = [];
    const givens: string[] = [];
    let ok = true;
    for (const len of lengths) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const pool = strikeoutAnswerWords(len);
        const w = pool[rngBelow(rng, pool.length)]!;
        if (words.includes(w)) continue;
        const consonants = rngShuffle(rng, [...new Set([...w].filter((ch) => !SO2_VOWELS.includes(ch)))]);
        const shown = new Set(consonants.slice(0, so2GivenCount(len)));
        const pattern = [...w].map((ch) => (shown.has(ch) ? ch : "_")).join("");
        if (strikeoutWordRuleBreak(w, pattern) !== null) continue;
        const trial = [...words, w];
        const clash = trial.some((a, i) => trial.some((b, j) => j < i && (a.slice(0, 4) === b.slice(0, 4) || (tailOf(a) !== null && tailOf(a) === tailOf(b)))));
        if (clash) continue;
        words.push(w);
        givens.push(pattern);
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok && strikeout2RuleBreak(words, givens) === null) {
      return { type: "strikeout", strikeoutRev: STRIKEOUT_REV2, rows: SO2_WORDS, length: SO2_MAX_LEN, givens, words };
    }
  }
  throw new Error("Strikeout: no word set found");
}

/** Live check: replays the whole list and returns only what the player has earned. */
export function checkStrikeoutMoves(puzzle: StrikeoutPuzzleData, moves: string): SoView {
  const words = puzzle.words ?? [];
  if (strikeoutRevOf(puzzle) >= STRIKEOUT_REV2) {
    const actions = decodeStrikeout2(moves);
    return so2View(words, replayStrikeout2(words, puzzle.givens ?? [], actions, isWord), actions.length);
  }
  const actions = decodeStrikeout(moves);
  return soView(words, replayStrikeout(words, actions, isWord), actions.length);
}
