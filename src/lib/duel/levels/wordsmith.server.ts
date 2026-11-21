import type { GenerateContext } from "../generate.server";
import type { PuzzleData, WordsmithPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { WordsmithLevelSettings } from "@/lib/levels/word/wordsmith";
import { dealtTopupRev } from "../depthTopup";
import { isEverydayWord, wordsFrom } from "../dictionary.server";
import { pick } from "../random";
import { scoreWordsmith, WORDSMITH_REV_DEPTH, WORDSMITH_REV_TARGET, WORDSMITH_REV_TOPUP } from "../scoring";
import { WORDSMITH_CENTRE_INDEX, WORDSMITH_PAR_SHARE, wordsmithMinLength, wordsmithPointsAt } from "../types";
import { dealtDepthRev } from "../wordDepth";
import { WORDSMITH_REV_STAR } from "../wordStar";
import { generateWordsmithBand, isPluralForm } from "../wordsmith.server";
import { limitEntryMs } from "./humanLimits";

/** The everyday words a board allows (the ones it counts and lists from wordsmithRev 5), at its shortest length. */
export function wordsmithEverydayCount(puzzle: WordsmithPuzzleData): number {
  const min = wordsmithMinLength(puzzle);
  return (puzzle.words ?? []).filter((entry) => entry.word.length >= min && isEverydayWord(entry.word)).length;
}

/** Every word a board accepts (the whole dictionary: centre letter, no plurals, at least `minLength` letters), upper case. */
export function nucleusAcceptedWords(letters: readonly string[], minLength: number): string[] {
  const centre = letters[WORDSMITH_CENTRE_INDEX]!.toLowerCase();
  return wordsFrom(letters.join(""), minLength, true)
    .filter((w) => w.includes(centre) && !isPluralForm(w))
    .map((w) => w.toUpperCase());
}

/**
 * A board rebuilt at a level's shortest word (D1, 21 Nov 2026): the same letters and centre, the word list, points and
 * par counted from `minLength` letters on the level's points table (wordsmithPointsAt: Easy's step-up table at 3).
 */
export function nucleusAtMinLength(made: WordsmithPuzzleData, minLength: number): WordsmithPuzzleData {
  const words = nucleusAcceptedWords(made.letters, minLength)
    .map((word) => ({ word, points: wordsmithPointsAt(word, minLength) }))
    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
  const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
  return { ...made, words, wordCount: words.length, totalPoints, par: Math.max(1, Math.round(totalPoints * WORDSMITH_PAR_SHARE)), minLength };
}

/**
 * The typed witness (D1, 21 Nov 2026; the proof a level's 200 is reachable by the best humans): a player who knows every
 * word the board accepts types them best points a second first, the every-tile word counted at its bonus, at the human
 * limits (humanLimits.ts: 0.25 s a word and 0.15 s a tap, the letters and Enter), and the board passes when the refit's
 * score (wordsmithRev 6) reaches 200 inside `limitMs`. Returns the time it took, or null.
 */
export function nucleusWitnessMs(letters: readonly string[], minLength: number, limitMs: number, wordsFullAt?: number): number | null {
  const words = nucleusAcceptedWords(letters, minLength);
  const value = (w: string) => wordsmithPointsAt(w, minLength) + (w.length >= letters.length ? 40 : 0);
  const order = [...words].sort((a, b) => value(b) / limitEntryMs(b.length + 1) - value(a) / limitEntryMs(a.length + 1));
  let points = 0;
  let pangram = false;
  let at = 0;
  for (const w of order) {
    const ms = limitEntryMs(w.length + 1);
    if (at + ms > limitMs) continue;
    at += ms;
    points += wordsmithPointsAt(w, minLength);
    if (w.length >= letters.length) pangram = true;
    if (scoreWordsmith(points, WORDSMITH_REV_STAR, pangram, wordsFullAt) >= 200) return at;
  }
  return null;
}

/**
 * Nucleus dealt at a level beyond Normal (D1, 21 Nov 2026; settings in src/lib/levels/word/wordsmith.ts): a board of one
 * of the level's sizes counted from the level's shortest word (Easy 3, Hard 5, Expert 6), whose everyday words of that
 * length fall in the level's band, on the level's clock, stamped as Normal's deal is (the deal's layers then move it to
 * today's stamp and keep the everyday words). Where the level asks (`witness`), only a board the typed witness takes to
 * 200 inside the clock is kept. Never called at Normal, so Normal is exactly today's deal.
 */
export function dealNucleusLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<WordsmithLevelSettings>("wordsmith", level);
  if (!settings) return null;
  const want = settings.everyday;
  let best: WordsmithPuzzleData | null = null;
  let bestGap = Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const made = { ...nucleusAtMinLength(generateWordsmithBand(pick(settings.sizes), settings.words), settings.minLength), ...(settings.wordsFullAt ? { wordsFullAt: settings.wordsFullAt } : {}) };
    const n = wordsmithEverydayCount(made);
    const witness = settings.witness ? nucleusWitnessMs(made.letters, settings.minLength, settings.timeLimitMs, settings.wordsFullAt) : 0;
    const gap = (n < want.min ? want.min - n : n > want.max ? n - want.max : 0) + (witness === null ? 1000 : 0);
    if (gap < bestGap) {
      best = made;
      bestGap = gap;
    }
    if (gap === 0) break;
  }
  return {
    ...best!,
    wordsmithRev: dealtDepthRev(dealtTopupRev(WORDSMITH_REV_TOPUP, WORDSMITH_REV_DEPTH), WORDSMITH_REV_TARGET),
    timeLimitMs: settings.timeLimitMs,
  };
}
