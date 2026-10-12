/**
 * Cryptogrid (codeword) generation, uniqueness proof, bank draw and live check
 * (server only: the letters never leave it before the reveal).
 *
 * A board is a 7 × 7 crossword with 180° symmetric black squares, every run of
 * white cells either a single cell or a word of 3+ letters from the common-word
 * list, 14–18 different letters and 4 numbers given. The constraint solver below
 * proves that the grid plus its givens has exactly one solution when every run
 * may be ANY word of the full dictionary. Generation is too slow to run live,
 * so rooms and practice draw from a committed bank of 1,000 boards
 * (scripts/codeword-bank.ts), picked by the room seed.
 */

import { CODEWORD_BANK } from "./codewordBank.server";
import {
  CODEWORD_REV,
  CW_GIVENS,
  CW_MAX_LETTERS,
  CW_MIN_LETTERS,
  CW_SIZE,
  codewordRuns,
  codewordTally,
  decodeCodeword,
  replayCodeword,
  type CwView,
} from "./codeword";
import { answerWords, dictionaryWords } from "./dictionary.server";
import type { CodewordPuzzleData } from "./types";
import { fmix32, rngBelow, rngShuffle, saltOf, seededRng } from "./wordSeed.server";

const N = CW_SIZE;
const CELLS = N * N;

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

/** Null when the black-square pattern is usable, else why not. */
export function templateRuleBreak(white: readonly boolean[]): string | null {
  const cells = white.map((w) => (w ? 1 : 0));
  const runs = codewordRuns(cells, N);
  if (runs.some((r) => r.cells.length === 2)) return "two-letter run";
  const inWord = new Set(runs.flatMap((r) => r.cells));
  const whites = white.flatMap((w, i) => (w ? [i] : []));
  if (whites.some((c) => !inWord.has(c))) return "white cell outside every word";
  for (let i = 0; i < CELLS; i++) if (white[i] !== white[CELLS - 1 - i]) return "not symmetric";
  // One connected block of white cells.
  const seen = new Set<number>([whites[0]!]);
  const queue = [whites[0]!];
  while (queue.length) {
    const c = queue.pop()!;
    const r = Math.floor(c / N), k = c % N;
    for (const [dr, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const rr = r + dr, kk = k + dk;
      if (rr < 0 || rr >= N || kk < 0 || kk >= N) continue;
      const nb = rr * N + kk;
      if (white[nb] && !seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  if (seen.size !== whites.length) return "white cells not connected";
  return null;
}

function randomTemplate(rng: () => number): boolean[] | null {
  for (let tries = 0; tries < 400; tries++) {
    const white = Array.from({ length: CELLS }, () => true);
    const pairs = 6 + rngBelow(rng, 5);
    for (let p = 0; p < pairs; p++) {
      const c = rngBelow(rng, CELLS);
      white[c] = false;
      white[CELLS - 1 - c] = false;
    }
    const count = white.filter(Boolean).length;
    if (count < 30 || count > 38) continue;
    if (templateRuleBreak(white) !== null) continue;
    // Enough crossings that the code can be cracked: most white cells are checked.
    const runs = codewordRuns(white.map((w) => (w ? 1 : 0)), N);
    const cover = new Map<number, number>();
    for (const r of runs) for (const c of r.cells) cover.set(c, (cover.get(c) ?? 0) + 1);
    const checked = [...cover.values()].filter((v) => v === 2).length;
    if (checked < count * 0.5) continue;
    return white;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Fill                                                               */
/* ------------------------------------------------------------------ */

interface WordIndex {
  words: string[];
  /** byPos[i][letter] = word indices with that letter at i. */
  byPos: number[][][];
}
const fillIndex = new Map<number, WordIndex>();
function indexFor(length: number): WordIndex {
  const known = fillIndex.get(length);
  if (known) return known;
  const words = answerWords(length);
  const byPos = Array.from({ length }, () => Array.from({ length: 26 }, () => [] as number[]));
  words.forEach((w, wi) => {
    for (let i = 0; i < length; i++) byPos[i]![w.charCodeAt(i) - 65]!.push(wi);
  });
  const made = { words, byPos };
  fillIndex.set(length, made);
  return made;
}

function candidates(pattern: readonly (string | undefined)[]): number[] {
  const idx = indexFor(pattern.length);
  let best: number[] | null = null;
  const fixed: [number, number][] = [];
  pattern.forEach((ch, i) => {
    if (ch) fixed.push([i, ch.charCodeAt(0) - 65]);
  });
  if (fixed.length === 0) return idx.words.map((_, i) => i);
  for (const [i, c] of fixed) {
    const list = idx.byPos[i]![c]!;
    if (!best || list.length < best.length) best = list;
  }
  return best!.filter((wi) => fixed.every(([i, c]) => idx.words[wi]!.charCodeAt(i) - 65 === c));
}

/** Fills a template with different common words; null when the search budget runs out. */
function fillTemplate(white: readonly boolean[], rng: () => number): string[] | null {
  const runs = codewordRuns(white.map((w) => (w ? 1 : 0)), N);
  const letters: (string | undefined)[] = Array.from({ length: CELLS }, () => undefined);
  const used = new Set<string>();
  let budget = 4_000;
  const open = new Set(runs.map((_, i) => i));
  const solve = (): boolean => {
    if (open.size === 0) return true;
    if (--budget < 0) return false;
    let pick = -1;
    let pickList: number[] = [];
    for (const s of open) {
      const list = candidates(runs[s]!.cells.map((c) => letters[c]));
      if (pick < 0 || list.length < pickList.length) {
        pick = s;
        pickList = list;
        if (list.length === 0) return false;
      }
    }
    const run = runs[pick]!;
    const idx = indexFor(run.cells.length);
    open.delete(pick);
    for (const wi of rngShuffle(rng, pickList).slice(0, 12)) {
      const w = idx.words[wi]!;
      if (used.has(w)) continue;
      const before = run.cells.map((c) => letters[c]);
      run.cells.forEach((c, i) => (letters[c] = w[i]));
      used.add(w);
      if (solve()) return true;
      used.delete(w);
      run.cells.forEach((c, i) => (letters[c] = before[i]));
      if (budget < 0) break;
    }
    open.add(pick);
    return false;
  };
  if (!solve()) return null;
  return letters.map((ch) => ch ?? "#");
}

/* ------------------------------------------------------------------ */
/*  Uniqueness against the full dictionary                             */
/* ------------------------------------------------------------------ */

/** Repeat pattern of a sequence: "LEVEL" and [3,1,9,1,3] both give "0.1.2.1.0". */
function signature(items: readonly (string | number)[]): string {
  const first = new Map<string | number, number>();
  return items.map((x) => {
    if (!first.has(x)) first.set(x, first.size);
    return first.get(x);
  }).join(".");
}

const bySignature = new Map<number, Map<string, string[]>>();
function dictionaryBySignature(length: number): Map<string, string[]> {
  const known = bySignature.get(length);
  if (known) return known;
  const map = new Map<string, string[]>();
  for (const w of dictionaryWords(length)) {
    const sig = signature([...w]);
    const list = map.get(sig);
    if (list) list.push(w);
    else map.set(sig, [w]);
  }
  bySignature.set(length, map);
  return map;
}

/**
 * How many letter codes (number → letter, one letter per number, different
 * numbers different letters) make every run a dictionary word, with the given
 * numbers fixed. Stops counting at `limit`.
 */
export function countCodewordSolutions(
  cells: readonly number[],
  numbers: number,
  givens: readonly { n: number; letter: string }[],
  limit = 2,
): number {
  const runs = codewordRuns(cells, N).map((r) => r.cells.map((c) => cells[c]!));
  const assign: string[] = Array.from({ length: numbers + 1 }, () => "");
  const owner = new Map<string, number>();
  for (const g of givens) {
    assign[g.n] = g.letter;
    owner.set(g.letter, g.n);
  }
  const fits = (word: string, nums: readonly number[]) => {
    for (let i = 0; i < nums.length; i++) {
      const n = nums[i]!, ch = word[i]!;
      const a = assign[n]!;
      if (a) {
        if (a !== ch) return false;
      } else if (owner.has(ch)) return false;
    }
    return true;
  };
  let lists = runs.map((nums) => (dictionaryBySignature(nums.length).get(signature(nums)) ?? []).filter((w) => fits(w, nums)));
  let found = 0;
  const search = (current: string[][]) => {
    if (found >= limit) return;
    let pick = -1;
    for (let s = 0; s < runs.length; s++) {
      const list = current[s]!;
      if (list.length === 0) return;
      if (runs[s]!.every((n) => assign[n])) continue;
      if (pick < 0 || list.length < current[pick]!.length) pick = s;
    }
    if (pick < 0) {
      found++;
      return;
    }
    const nums = runs[pick]!;
    for (const w of current[pick]!) {
      const added: number[] = [];
      nums.forEach((n, i) => {
        if (!assign[n]) {
          assign[n] = w[i]!;
          owner.set(w[i]!, n);
          added.push(n);
        }
      });
      const next = current.map((list, s) => (s === pick ? [w] : list.filter((x) => fits(x, runs[s]!))));
      search(next);
      for (const n of added) {
        owner.delete(assign[n]!);
        assign[n] = "";
      }
      if (found >= limit) return;
    }
  };
  search(lists);
  lists = [];
  return found;
}

/* ------------------------------------------------------------------ */
/*  Bank entries                                                       */
/* ------------------------------------------------------------------ */

/**
 * One bank entry: "<49 grid letters, # for black>|<letter of each number>|<given numbers>",
 * e.g. "CRANE#T…|QZEB…|3.7.11.15".
 */
export function buildCodewordEntry(seed: number): string | null {
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < 30; attempt++) {
    const white = randomTemplate(rng);
    if (!white) continue;
    const grid = fillTemplate(white, rng);
    if (!grid) continue;
    const distinct = [...new Set(grid.filter((ch) => ch !== "#"))];
    if (distinct.length < CW_MIN_LETTERS || distinct.length > CW_MAX_LETTERS) continue;
    const order = rngShuffle(rng, distinct).join("");
    const cells = grid.map((ch) => (ch === "#" ? 0 : order.indexOf(ch) + 1));
    for (let tries = 0; tries < 12; tries++) {
      const given = rngShuffle(rng, Array.from({ length: order.length }, (_, i) => i + 1)).slice(0, CW_GIVENS).sort((a, b) => a - b);
      const givens = given.map((n) => ({ n, letter: order[n - 1]! }));
      if (countCodewordSolutions(cells, order.length, givens, 2) === 1) {
        return `${grid.join("")}|${order}|${given.join(".")}`;
      }
    }
  }
  return null;
}

export function codewordFromEntry(entry: string): CodewordPuzzleData {
  const [grid = "", order = "", given = ""] = entry.split("|");
  const cells = [...grid].map((ch) => (ch === "#" ? 0 : order.indexOf(ch) + 1));
  return {
    type: "codeword",
    codewordRev: CODEWORD_REV,
    size: N,
    cells,
    numbers: order.length,
    givens: given.split(".").map(Number).map((n) => ({ n, letter: order[n - 1]! })),
    solution: order,
  };
}

/** Null when an entry meets every rule (including the uniqueness proof), else the rule broken. */
export function codewordEntryRuleBreak(entry: string): string | null {
  const p = codewordFromEntry(entry);
  const grid = entry.split("|")[0] ?? "";
  if (grid.length !== CELLS) return "grid is not 7 × 7";
  const broken = templateRuleBreak(p.cells.map((n) => n > 0));
  if (broken) return broken;
  const solution = p.solution ?? "";
  if (new Set(solution).size !== solution.length) return "a letter has two numbers";
  if (p.numbers < CW_MIN_LETTERS || p.numbers > CW_MAX_LETTERS) return `${p.numbers} letters`;
  if (p.givens.length !== CW_GIVENS || new Set(p.givens.map((g) => g.n)).size !== CW_GIVENS) return "not four givens";
  const words = codewordRuns(p.cells, N).map((r) => r.cells.map((c) => grid[c]).join(""));
  if (new Set(words).size !== words.length) return "repeated word";
  for (const w of words) if (!answerWords(w.length).includes(w)) return `${w} is not a common answer word`;
  if (countCodewordSolutions(p.cells, p.numbers, p.givens, 2) !== 1) return "not exactly one solution";
  return null;
}

/** Bank index for a seed. */
export function codewordBankIndex(seed: number, size = CODEWORD_BANK.length): number {
  return size <= 0 ? 0 : fmix32((seed >>> 0) ^ saltOf("codeword-bank")) % size;
}

/** Draws the board for this game seed from the committed bank. */
export function generateCodeword(seed: number): CodewordPuzzleData {
  if (CODEWORD_BANK.length === 0) {
    // Only before the first bank build; capped live generation.
    for (let retry = 0; retry < 20; retry++) {
      const entry = buildCodewordEntry(fmix32(seed + retry));
      if (entry) return codewordFromEntry(entry);
    }
    throw new Error("Cryptogrid: no board found");
  }
  return codewordFromEntry(CODEWORD_BANK[codewordBankIndex(seed)]!);
}

/** Live check: answers only once every number has a letter, and then only solved or not. */
export function checkCodewordMoves(puzzle: CodewordPuzzleData, moves: string): CwView {
  const actions = decodeCodeword(moves, puzzle.numbers);
  const letters = replayCodeword(puzzle.numbers, puzzle.givens, actions);
  const tally = codewordTally(letters, puzzle.solution ?? "", puzzle.givens);
  return { complete: tally.complete, solved: tally.complete && tally.solved, count: actions.length };
}
