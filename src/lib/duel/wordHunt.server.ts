/**
 * Server-only Word Hunt logic: board building, path checking and scoring. The
 * dictionary and the board's word list never reach a device.
 */

import { commonWords, isCommonPrefix, isWord } from "./dictionary.server";
import type { Graded } from "./grade";
import { scoreWordHunt, wordHuntMissKeptPct, WORDHUNT_MAX_MISSES, WORDHUNT_MISS_MARK, WORDHUNT_REV_MISSES } from "./scoring";
import { pick, randInt, shuffled } from "./random";
import {
  WORDHUNT_CELLS,
  WORDHUNT_COLS as N,
  WORDHUNT_COLS_DEPTH,
  wordHuntCols,
  WORDHUNT_MIN_LENGTH,
  WORDHUNT_MIN_WORDS,
  WORDHUNT_PAR_SHARE,
  WORDHUNT_TIME_MS,
  wordHuntPoints,
  type WordHuntPuzzleData,
  type WordHuntWord,
} from "./types";
import { scoreWordHuntDepth, wordHuntDepth, wordHuntValue, WORDHUNT_REV_DEPTH } from "./wordHunt";

/** Letters weighted roughly by how often they turn up in English. */
const WEIGHTED =
  "EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOOIIIIIIINNNNNNNSSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMWWFFGGYYPPBBVKJXZQ";

/** A cell's neighbours on a `cols`-wide square board (5 for every board before wordHuntRev 3). */
function neighbours(cell: number, cols = N): number[] {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= cols || nc < 0 || nc >= cols) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

export function areAdjacent(a: number, b: number, cols = N): boolean {
  return neighbours(a, cols).includes(b);
}

/** Lays a word along a snaking path, reusing cells that already match. */
function placeWord(grid: (string | null)[], word: string, cols = N): boolean {
  const letters = word.toUpperCase().split("");
  const starts = shuffled(Array.from({ length: cols * cols }, (_, i) => i));

  const walk = (index: number, cell: number, used: number[]): boolean => {
    const letter = letters[index]!;
    const current = grid[cell];
    if (current !== null && current !== letter) return false;
    const previous = current;
    grid[cell] = letter;
    used.push(cell);
    if (index === letters.length - 1) return true;
    for (const next of shuffled(neighbours(cell, cols))) {
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

/**
 * Every everyday word the grid spells out, with one path each. With `golden` (wordHuntRev 3) a word's path runs
 * through the golden tile whenever one can.
 */
function solveBoard(grid: string[], golden: number | null = null): WordHuntWord[] {
  const dictionary = new Set(commonWords());
  const found = new Map<string, number[]>();
  const cols = wordHuntCols(grid);

  const walk = (cell: number, prefix: string, path: number[]) => {
    const next = prefix + grid[cell]!.toLowerCase();
    if (!isCommonPrefix(next)) return;
    const trail = [...path, cell];
    if (next.length >= WORDHUNT_MIN_LENGTH && dictionary.has(next)) {
      const had = found.get(next);
      if (!had || (golden !== null && !had.includes(golden) && trail.includes(golden))) found.set(next, trail);
    }
    for (const neighbour of neighbours(cell, cols)) {
      if (trail.includes(neighbour)) continue;
      walk(neighbour, next, trail);
    }
  };

  for (let cell = 0; cell < grid.length; cell++) walk(cell, "", []);

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

/** wordHuntRev 3: the 6×6 board needs this many findable everyday words (the 5×5 board's 40, scaled up). */
export const WORDHUNT_DEPTH_MIN_WORDS = 120;

/**
 * wordHuntRev 3: a 6×6 board (three or four 6–9 letter seed words, then filler) with at least
 * WORDHUNT_DEPTH_MIN_WORDS words, and a golden tile: drawn from the six tiles (no Qu) that sit on the most words.
 */
export function generateWordHuntDepth(): WordHuntPuzzleData {
  const cols = WORDHUNT_COLS_DEPTH;
  const seeds = commonWords().filter((word) => word.length >= 6 && word.length <= 9);
  let best: { letters: string[]; words: WordHuntWord[] } | null = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const grid: (string | null)[] = Array.from({ length: cols * cols }, () => null);
    const wanted = randInt(3, 4);
    let placed = 0;
    for (let i = 0; i < wanted * 4 && placed < wanted; i++) {
      if (placeWord(grid, pick(seeds), cols)) placed += 1;
    }
    if (placed < 3) continue;
    const letters = fill(grid);
    const words = solveBoard(letters);
    if (!best || words.length > best.words.length) best = { letters, words };
    if (words.length >= WORDHUNT_DEPTH_MIN_WORDS) break;
  }
  if (!best) {
    const letters = fill(Array.from({ length: cols * cols }, () => null));
    best = { letters, words: solveBoard(letters) };
  }
  const letters = best.letters;
  // Tiles by how many words can pass through them (any path), the golden one drawn from the top six.
  const through = letters.map(() => 0);
  for (const entry of best.words) for (const cell of new Set(entry.path)) through[cell]! += 1;
  const ranked = letters
    .map((letter, cell) => ({ cell, n: through[cell]!, qu: letter === "QU" }))
    .filter((t) => !t.qu)
    .sort((a, b) => b.n - a.n || a.cell - b.cell);
  const golden = pick(ranked.slice(0, 6)).cell;
  const words = solveBoard(letters, golden);
  const totalPoints = words.reduce((sum, entry) => sum + entry.points, 0);
  return {
    type: "wordhunt",
    grid: letters,
    words,
    totalPoints,
    par: Math.max(1, Math.round(totalPoints * WORDHUNT_PAR_SHARE)),
    golden,
    wordHuntRev: WORDHUNT_REV_DEPTH,
  };
}

/** Builds a 5×5 board with at least forty findable words. */
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
  const letters = "TAPLENSROIEMCKUGBEAHWYTRS".split("");
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
  const cols = wordHuntCols(grid);
  const seen = new Set<number>();
  let word = "";
  let previous: number | null = null;
  for (const cell of path) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= (cols === N ? WORDHUNT_CELLS : cols * cols)) return null;
    if (seen.has(cell)) return null;
    if (previous !== null && !areAdjacent(previous, cell, cols)) return null;
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

/** Answer length the server reads (words first, then misses). */
export const WORDHUNT_ANSWER_CAP = 4_000;

/** wordHuntRev 2: a real path of 4+ letters that spells no word. Short, broken or word paths never count. */
export function isWordHuntMiss(grid: string[], path: number[]): boolean {
  const word = wordFromPath(grid, path);
  return word !== null && word.length >= WORDHUNT_MIN_LENGTH && !isWord(word);
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
  const accepted: { word: string; points: number; path: number[] }[] = [];
  const seen: string[] = [];

  const missPaths: number[][] = [];
  const cells = (raw: string | undefined) =>
    (raw ?? "")
      .split("-")
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isFinite);
  for (const entry of rawAnswer.slice(0, WORDHUNT_ANSWER_CAP).split(",")) {
    // wordHuntRev 2: "!cells" is a trace the phone rejected; it is judged after every word (below).
    if (entry.startsWith(WORDHUNT_MISS_MARK)) {
      if (missPaths.length < WORDHUNT_MAX_MISSES) missPaths.push(cells(entry.slice(WORDHUNT_MISS_MARK.length)));
      continue;
    }
    const [, rawPath] = entry.split(":");
    const verdict = checkWordHuntPath(puzzle.grid, cells(rawPath), seen);
    if (!verdict.valid) continue;
    seen.push(verdict.word);
    accepted.push({ word: verdict.word, points: verdict.points, path: cells(rawPath) });
  }

  const points = accepted.reduce((sum, entry) => sum + entry.points, 0);
  // wordHuntRev 2: a miss is a real path of 4+ letters that spells no word (a word, even one found already, never is).
  const usesMisses = (puzzle.wordHuntRev ?? 0) >= WORDHUNT_REV_MISSES;
  const misses = usesMisses ? missPaths.filter((path) => isWordHuntMiss(puzzle.grid, path)).length : 0;
  const missCutPct = usesMisses ? 100 - wordHuntMissKeptPct(misses, accepted.length) : 0;
  const ms = Math.min(WORDHUNT_TIME_MS, Math.max(0, Math.round(msRemaining)));
  if (wordHuntDepth(puzzle)) {
    // wordHuntRev 3: base points to 150 plus what long words and the golden tile add, to 50 (wordHunt.ts).
    const values = accepted.map((entry) => wordHuntValue(entry.word, entry.path, puzzle.golden));
    const extraPoints = values.reduce((sum, v) => sum + v.extra, 0);
    const value = values.reduce((sum, v) => sum + v.value, 0);
    const depth = scoreWordHuntDepth(points, extraPoints, 100 - missCutPct);
    return {
      answer: accepted.map((entry) => entry.word).join(","),
      isCorrect: points >= par,
      score: depth.score,
      reactionAvgMs: null,
      correctCount: accepted.length,
      errors: null,
      extra: {
        points,
        par,
        words: accepted.map((entry) => entry.word),
        misses,
        missCutPct,
        value,
        extraPoints,
        longWords: values.filter((v) => v.long).length,
        goldWords: accepted.filter((_, i) => values[i]!.gold).map((entry) => entry.word),
        basePart: Math.min(150, depth.basePart),
        bonusPart: Math.min(50, depth.bonusPart),
      },
      storedMs: ms,
    };
  }
  const score = scoreWordHunt(points, puzzle.wordHuntRev, misses, accepted.length);

  return {
    answer: accepted.map((entry) => entry.word).join(","),
    isCorrect: points >= par,
    score,
    reactionAvgMs: null,
    correctCount: accepted.length,
    errors: null,
    extra: { points, par, words: accepted.map((entry) => entry.word), ...(usesMisses ? { misses, missCutPct } : {}) },
    storedMs: ms,
  };
}
