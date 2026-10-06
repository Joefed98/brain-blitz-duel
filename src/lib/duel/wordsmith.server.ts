/**
 * Server-only Wordsmith logic: board generation, word checking and scoring.
 * Eight to eleven letters in a ring; every word must use the centre letter. The
 * dictionary and the board's word list never reach a device.
 */

import { buildableFrom, commonWords, isWord, wordsFrom } from "./dictionary.server";
import { pick, shuffled } from "./random";
import type { Graded } from "./grade";
import { scoreWordsmith } from "./scoring";
import {
  WORDSMITH_CENTRE_INDEX,
  WORDSMITH_SIZES,
  WORDSMITH_WORD_RANGES,
  WORDSMITH_MIN_LENGTH,
  WORDSMITH_PAR_SHARE,
  WORDSMITH_TIME_MS,
  wordsmithPoints,
  type WordsmithPuzzleData,
} from "./types";

/** S-ending words that are not plurals or -s verb forms, never rejected. */
const PLURAL_EXCEPTIONS = new Set([
  "news", "lens", "bus", "gas", "yes", "plus", "thus", "this", "always", "perhaps", "series", "species",
  "means", "physics", "maths", "mathematics", "politics", "economics", "ethics", "athletics", "measles",
  "mumps", "crisis", "basis", "bonus", "focus", "virus", "status", "census", "campus", "chaos", "canvas",
  "atlas", "iris", "tennis", "lotus", "cactus", "circus", "corps", "pants", "scissors", "trousers",
]);

/** True for a plural or -s verb form: the word minus "s" or "es" is itself a word. */
export function isPluralForm(raw: string): boolean {
  const word = raw.trim().toLowerCase();
  if (!word.endsWith("s") || PLURAL_EXCEPTIONS.has(word)) return false;
  if (word.endsWith("ss")) return false;
  const stem = word.slice(0, -1);
  if (stem.length >= 3 && isWord(stem)) return true;
  if (word.endsWith("es")) {
    const short = word.slice(0, -2);
    if (short.length >= 3 && isWord(short)) return true;
  }
  if (word.endsWith("ies")) {
    const y = `${word.slice(0, -3)}y`;
    if (y.length >= 3 && isWord(y)) return true;
  }
  return false;
}

const sources = new Map<number, string[]>();
/** Everyday pangrams of the chosen size, with no letter used more than twice. */
function sourceWords(size: number): string[] {
  const cached = sources.get(size);
  if (cached) return cached;
  const words = commonWords().filter((word) => {
    if (word.length !== size) return false;
    const counts = new Map<string, number>();
    for (const letter of word) counts.set(letter, (counts.get(letter) ?? 0) + 1);
    return [...counts.values()].every((n) => n <= 2);
  });
  sources.set(size, words);
  return words;
}

function build(source: string, centre: string, valid: string[]): WordsmithPuzzleData {
  const upper = source.toUpperCase().split("");
  const centreAt = upper.indexOf(centre.toUpperCase());
  const outer = upper.filter((_, i) => i !== centreAt);
  let ring = shuffled(outer);
  for (let attempt = 0; attempt < 20 && ring.join("") === outer.join(""); attempt++) ring = shuffled(outer);
  const letters = [...ring.slice(0, WORDSMITH_CENTRE_INDEX), centre.toUpperCase(), ...ring.slice(WORDSMITH_CENTRE_INDEX)];
  const words = valid
    .map((word) => ({ word: word.toUpperCase(), points: wordsmithPoints(word) }))
    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
  const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
  return {
    type: "wordsmith",
    letters,
    wordCount: words.length,
    words,
    totalPoints,
    par: Math.max(1, Math.round(totalPoints * WORDSMITH_PAR_SHARE)),
    source: source.toUpperCase(),
  };
}

/** Valid words for one source and centre (whole dictionary, centre letter included). */
function validWords(source: string, centre: string): string[] {
  return wordsFrom(source, WORDSMITH_MIN_LENGTH, true).filter((word) => word.includes(centre) && !isPluralForm(word));
}

/** Uniform size draw, then an answer-first pangram within the size's word-count band. */
export function generateWordsmith(size: number = pick(WORDSMITH_SIZES)): WordsmithPuzzleData {
  const supported = WORDSMITH_SIZES.find((value) => value === size);
  if (supported === undefined) throw new Error("Unsupported Wordsmith size");
  return generateWithinRange(supported, WORDSMITH_WORD_RANGES[supported]);
}

/** Preserve the exact seeded nine-letter practice/intro board under its original band. */
export function generateWordsmithExample(): WordsmithPuzzleData {
  return generateWithinRange(9, { min: 25, max: 60 });
}

function generateWithinRange(size: number, range: { readonly min: number; readonly max: number }): WordsmithPuzzleData {
  const bank = sourceWords(size);
  for (let attempt = 0; attempt < 200 && bank.length; attempt++) {
    const source = pick(bank);
    if (isPluralForm(source)) continue;
    const all = wordsFrom(source, WORDSMITH_MIN_LENGTH, true).filter((word) => !isPluralForm(word));
    const centres = shuffled([...new Set(source.split(""))]).filter((centre) => {
      const n = all.filter((word) => word.includes(centre)).length;
      return n >= range.min && n <= range.max;
    });
    const centre = centres[0];
    if (!centre) continue;
    return build(source, centre, all.filter((word) => word.includes(centre)));
  }
  // Never silently change size or bypass the count requirement on a retry limit.
  for (const source of bank) {
    if (isPluralForm(source)) continue;
    for (const centre of new Set(source)) {
      const valid = validWords(source, centre);
      if (valid.length >= range.min && valid.length <= range.max) return build(source, centre, valid);
    }
  }
  throw new Error(`No qualifying Wordsmith pangram for ${size} letters`);
}

export interface WordVerdict {
  valid: boolean;
  points: number;
  word: string;
  reason?: string;
}

/** Checks one submitted word live, during play. */
export function checkWordsmithWord(letters: string[], raw: string, already: string[]): WordVerdict {
  const word = raw.trim().toUpperCase();
  const base = { valid: false, points: 0, word };
  if (!/^[A-Z]+$/.test(word)) return { ...base, reason: "Letters only" };
  if (word.length < WORDSMITH_MIN_LENGTH) return { ...base, reason: "Too short" };
  if (!buildableFrom(word, letters)) return { ...base, reason: "Not on the board" };
  const centre = WORDSMITH_SIZES.some((size) => size === letters.length) ? letters[WORDSMITH_CENTRE_INDEX] : undefined;
  if (centre && !word.includes(centre.toUpperCase())) return { ...base, reason: "Must use the centre letter" };
  if (!isWord(word)) return { ...base, reason: "Not in the dictionary" };
  if (isPluralForm(word)) return { ...base, reason: "No plurals" };
  if (already.some((entry) => entry.toUpperCase() === word)) return { ...base, reason: "Already found" };
  return { valid: true, points: wordsmithPoints(word), word };
}

/**
 * Re-validates every word the client sent and scores the round. The client's
 * own point count is never trusted.
 */
export function gradeWordsmith(
  puzzle: WordsmithPuzzleData,
  rawAnswer: string,
  msRemaining: number,
): Graded {
  const par = puzzle.par ?? 1;
  const accepted: { word: string; points: number }[] = [];
  const seen: string[] = [];

  for (const candidate of rawAnswer.slice(0, 3_000).split(",")) {
    const verdict = checkWordsmithWord(puzzle.letters, candidate, seen);
    if (!verdict.valid) continue;
    seen.push(verdict.word);
    accepted.push({ word: verdict.word, points: verdict.points });
  }

  const points = accepted.reduce((sum, entry) => sum + entry.points, 0);
  const ms = Math.min(WORDSMITH_TIME_MS, Math.max(0, Math.round(msRemaining)));

  return {
    answer: accepted.map((entry) => entry.word).join(","),
    isCorrect: points >= par,
    score: scoreWordsmith(points),
    reactionAvgMs: null,
    correctCount: accepted.length,
    errors: null,
    extra: { points, par, words: accepted.map((entry) => entry.word) },
    storedMs: ms,
  };
}
