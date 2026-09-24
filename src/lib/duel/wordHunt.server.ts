/**
 * Server-only Word Hunt logic: board building, path checking and scoring. The
 * dictionary and the board's word list never reach a device.
 */

import { commonWords, isCommonPrefix, isWord } from "./dictionary.server";
import type { Graded } from "./grade";
import { scoreWordHunt } from "./scoring";
import { pick, randInt, shuffled } from "./random";
import {
  WORDHUNT_CELLS,
  WORDHUNT_COLS as N,
  WORDHUNT_MIN_LENGTH,
  WORDHUNT_MIN_WORDS,
  WORDHUNT_PAR_SHARE,
  WORDHUNT_TIME_MS,
  wordHuntPoints,
  type WordHuntPuzzleData,
  type WordHuntWord,
} from "./types";

/** Letters weighted roughly by how often they turn up in English. */
const WEIGHTED =
  "EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOOIIIIIIINNNNNNNSSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMWWFFGGYYPPBBVKJXZQ";

function neighbours(cell: number): number[] {
  const r = Math.floor(cell / N);
  const c = cell % N;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      out.push(nr * N + nc);
    }
  }
  return out;
}

export function areAdjacent(a: number, b: number): boolean {
  return neighbours(a).includes(b);
}

/** Lays a word along a snaking path, reusing cells that already match. */
function placeWord(grid: (string | null)[], word: string): boolean {
  const letters = word.toUpperCase().split("");
  const starts = shuffled(Array.from({ length: WORDHUNT_CELLS }, (_, i) => i));

  const walk = (index: number, cell: number, used: number[]): boolean => {
    const letter = letters[index]!;
    const current = grid[cell];
    if (current !== null && current !== letter) return false;
    const previous = current;
    grid[cell] = letter;
    used.push(cell);
    if (index === letters.length - 1) return true;
    for (const next of shuffled(neighbours(cell))) {
      if (used.includes(next)) continue;
      if (walk(index + 1, next, used)) return true;
    }
    grid[cell] = previous;
    used.pop();
    return false;
  };

  for (const start of starts) {
    if (walk(0, start, [])) return true;
  }
  return false;
}

/** Every everyday word the grid spells out, with one path each. */
function solveBoard(grid: string[]): WordHuntWord[] {
  const dictionary = new Set(commonWords());
  const found = new Map<string, number[]>();

  const walk = (cell: number, prefix: string, path: number[]) => {
    const next = prefix + grid[cell]!.toLowerCase();
    if (!isCommonPrefix(next)) return;
    const trail = [...path, cell];
    if (next.length >= WORDHUNT_MIN_LENGTH && dictionary.has(next) && !found.has(next)) {
      found.set(next, trail);
    }
    for (const neighbour of neighbours(cell)) {
      if (trail.includes(neighbour)) continue;
      walk(neighbour, next, trail);
    }
  };

  for (let cell = 0; cell < WORDHUNT_CELLS; cell++) walk(cell, "", []);

  return [...found.entries()]
    .map(([word, path]) => ({ word: word.toUpperCase(), points: wordHuntPoints(word), path }))
    .sort((a, b) => b.points - a.points || a.word.localeCompare(b.word));
}

function fill(grid: (string | null)[]): string[] {
  let hasQ = grid.some((letter) => letter === "Q" || letter === "QU");
  const out = grid.map((letter) => {
    if (letter === "Q") return "QU";
    if (letter !== null) return letter;
    for (let attempt = 0; attempt < 40; attempt++) {
      const letter = pick(WEIGHTED.split(""));
      if (letter === "Q") {
        if (hasQ) continue;
        hasQ = true;
        return "QU";
      }
      return letter;
    }
    return "E";
  });
  return out;
}

/** Builds a 4x4 board with at least forty findable words. */
export function generateWordHunt(): WordHuntPuzzleData {
  const seeds = commonWords().filter((word) => word.length >= 6 && word.length <= 8);

  for (let attempt = 0; attempt < 300; attempt++) {
    const grid: (string | null)[] = Array.from({ length: WORDHUNT_CELLS }, () => null);
    const wanted = randInt(2, 3);
    let placed = 0;
    for (let i = 0; i < wanted * 4 && placed < wanted; i++) {
      if (placeWord(grid, pick(seeds))) placed += 1;
    }
    if (placed < 2) continue;

    const letters = fill(grid);
    const words = solveBoard(letters);
    if (words.length < WORDHUNT_MIN_WORDS) continue;

    const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
    return {
      type: "wordhunt",
      grid: letters,
      words,
      totalPoints,
      par: Math.max(1, Math.round(totalPoints * WORDHUNT_PAR_SHARE)),
    };
  }

  // Safety net: a board known to be rich in words.
  const letters = "TAPLENSROIDMCKUG".split("");
  const words = solveBoard(letters);
  const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
  return {
    type: "wordhunt",
    grid: letters,
    words,
    totalPoints,
    par: Math.max(1, Math.round(totalPoints * WORDHUNT_PAR_SHARE)),
  };
}

export interface WordHuntVerdict {
  valid: boolean;
  points: number;
  word: string;
  reason?: string;
}

/** Walks a path over the grid and returns the word it spells, or null. */
export function wordFromPath(grid: string[], path: number[]): string | null {
  if (!Array.isArray(path) || path.length < 2) return null;
  const seen = new Set<number>();
  let word = "";
  let previous: number | null = null;
  for (const cell of path) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= WORDHUNT_CELLS) return null;
    if (seen.has(cell)) return null;
    if (previous !== null && !areAdjacent(previous, cell)) return null;
    seen.add(cell);
    word += grid[cell] ?? "";
    previous = cell;
  }
  return word.toUpperCase();
}

/** Checks one traced word live, during play. */
export function checkWordHuntPath(
  grid: string[],
  path: number[],
  already: string[],
): WordHuntVerdict {
  const word = wordFromPath(grid, path);
  const base = { valid: false, points: 0, word: word ?? "" };
  if (!word) return { ...base, reason: "Not a path" };
  if (word.length < WORDHUNT_MIN_LENGTH) return { ...base, reason: "Too short" };
  if (already.map((entry) => entry.toUpperCase()).includes(word)) {
    return { ...base, reason: "Already found" };
  }
  if (!isWord(word)) return { ...base, reason: "Not a word" };
  return { valid: true, points: wordHuntPoints(word), word };
}

/**
 * Re-walks every path the phone sent and scores the round. Nothing the client
 * reports about its own points is trusted.
 */
export function gradeWordHunt(
  puzzle: WordHuntPuzzleData,
  rawAnswer: string,
  msRemaining: number,
): Graded {
  const par = puzzle.par ?? 1;
  const accepted: { word: string; points: number }[] = [];
  const seen: string[] = [];

  for (const entry of rawAnswer.slice(0, 4_000).split(",")) {
    const [, rawPath] = entry.split(":");
    const path = (rawPath ?? "")
      .split("-")
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isFinite);
    const verdict = checkWordHuntPath(puzzle.grid, path, seen);
    if (!verdict.valid) continue;
    seen.push(verdict.word);
    accepted.push({ word: verdict.word, points: verdict.points });
  }

  const points = accepted.reduce((sum, entry) => sum + entry.points, 0);
  const score = scoreWordHunt(points);
  const ms = Math.min(WORDHUNT_TIME_MS, Math.max(0, Math.round(msRemaining)));

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
