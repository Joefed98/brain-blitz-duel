/**
 * Server-only Wordsmith logic: board generation, word checking and scoring.
 * The dictionary and the board's word list never reach a device.
 */

import { EIGHT_LETTER_WORDS, SEVEN_LETTER_WORDS } from "@/puzzles/words";

import { buildableFrom, isWord, wordsFrom } from "./dictionary.server";
import { pick, shuffled } from "./random";
import type { Graded } from "./grade";
import {
  WORDSMITH_MAX_PAR,
  WORDSMITH_MIN_LENGTH,
  WORDSMITH_MIN_PAR,
  WORDSMITH_MIN_WORDS,
  WORDSMITH_PAR_SHARE,
  WORDSMITH_TIME_MS,
  wordsmithPoints,
  type WordsmithPuzzleData,
} from "./types";

/** Source words: every seven- and eight-letter word in the shared bank. */
const SOURCE_BANK = [...SEVEN_LETTER_WORDS, ...EIGHT_LETTER_WORDS];

/** A word and the same word with an -S count once. */
export function wordKey(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith("s") && lower.length - 1 >= WORDSMITH_MIN_LENGTH) {
    const base = lower.slice(0, -1);
    if (isWord(base)) return base;
  }
  return lower;
}

function collapse(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    const key = wordKey(word);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}

function shuffleLetters(source: string): string[] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const letters = shuffled(source.toUpperCase().split(""));
    if (letters.join("") !== source.toUpperCase()) return letters;
  }
  return source.toUpperCase().split("").reverse();
}

/** Builds a board whose letters yield at least 20 everyday words of 4+ letters. */
export function generateWordsmith(): WordsmithPuzzleData {
  for (let attempt = 0; attempt < 200; attempt++) {
    const source = pick(SOURCE_BANK).toLowerCase();
    const found = collapse(wordsFrom(source, WORDSMITH_MIN_LENGTH));
    if (found.length < WORDSMITH_MIN_WORDS) continue;
    const words = found
      .map((word) => ({ word: word.toUpperCase(), points: wordsmithPoints(word) }))
      .sort((a, b) => b.points - a.points || a.word.localeCompare(b.word));
    const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
    const par = Math.max(1, Math.round(totalPoints * WORDSMITH_PAR_SHARE));
    // Boards with a wildly high or low par make for unfair rounds; keep the
    // target reachable but worth working for.
    if (attempt < 150 && (par < WORDSMITH_MIN_PAR || par > WORDSMITH_MAX_PAR)) continue;
    return {
      type: "wordsmith",
      letters: shuffleLetters(source),
      words,
      totalPoints,
      par,
      source: source.toUpperCase(),
    };
  }
  // Every bank word is checked above; this is only a safety net.
  const source = "planets";
  const words = collapse(wordsFrom(source, WORDSMITH_MIN_LENGTH)).map((word) => ({
    word: word.toUpperCase(),
    points: wordsmithPoints(word),
  }));
  const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
  return {
    type: "wordsmith",
    letters: shuffleLetters(source),
    words,
    totalPoints,
    par: Math.max(1, Math.round(totalPoints * WORDSMITH_PAR_SHARE)),
    source: source.toUpperCase(),
  };
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
  if (!isWord(word)) return { ...base, reason: "Not a word" };
  const keys = new Set(already.map((entry) => wordKey(entry)));
  if (keys.has(wordKey(word))) return { ...base, reason: "Already found" };
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
  const letters = puzzle.letters;
  const par = puzzle.par ?? 1;
  const accepted: { word: string; points: number }[] = [];
  const keys = new Set<string>();

  for (const candidate of rawAnswer.slice(0, 2_000).split(",")) {
    const verdict = checkWordsmithWord(letters, candidate, [...keys]);
    if (!verdict.valid) continue;
    keys.add(verdict.word);
    accepted.push({ word: verdict.word, points: verdict.points });
  }

  const points = accepted.reduce((sum, entry) => sum + entry.points, 0);
  const score = points <= 0 ? 0 : Math.min(150, Math.round((150 * points) / par));
  const ms = Math.min(WORDSMITH_TIME_MS, Math.max(0, Math.round(msRemaining)));

  return {
    answer: accepted.map((entry) => entry.word).join(","),
    isCorrect: points >= par,
    score,
    reactionAvgMs: null,
    correctCount: accepted.length,
    errors: null,
    extra: { points, par, words: accepted.map((entry) => entry.word) },
    storedMs: ms,
  };
}
