/**
 * Cryptogrid (codeword) generation, uniqueness proof, bank draw and live check
 * (server only: the letters never leave it before the reveal).
 *
 * A board is a 7 × 7 crossword with 180° symmetric black squares, every run of
 * white cells either a single cell or a word of 3+ letters from the common-word
 * list, 14–18 different letters and 4 numbers given (5 from codewordRev 2: one
 * more picked from the entry by codewordFifthGiven; 6 from codewordRev 3, the sixth
 * by codewordSixthGiven). The constraint solver below
 * proves that the grid plus its givens has exactly one solution when every run
 * may be ANY word of the full dictionary (a fifth or sixth given only removes
 * solutions; codeword-check re-proves all three). Generation is too slow to run live,
 * so rooms and practice draw from a committed bank of 1,000 boards
 * (scripts/codeword-bank.ts), picked by the room seed.
 */

import { dealtDepthRev } from "./wordDepth";
import { CODEWORD_REV_NAMES } from "./wordOverhaul";
import { CODEWORD_BANK } from "./codewordBank.server";
import {
  CODEWORD_REV,
  CODEWORD_DEPTH_REV,
  CW_GIVENS,
  CW_MAX_LETTERS,
  CW_MIN_LETTERS,
  CW_SIZE,
  codewordGivensFor,
  codewordRuns,
  codewordTally,
  decodeCodeword,
  replayCodeword,
  type CwView,
} from "./codeword";
import { answerWords, dictionaryWords, isWord } from "./dictionary.server";
import type { CodewordPuzzleData } from "./types";
import { fmix32, rngBelow, rngShuffle, saltOf, seededRng } from "./wordSeed.server";

const N = CW_SIZE;
const CELLS = N * N;

/** A square grid's side from its cell count (7 for today's 49 cells; Easy's 5). */
export function codewordSideOf(cells: { length: number }): number {
  return Math.round(Math.sqrt(cells.length));
}

/**
 * A grid's columns and rows (D1, 21 Nov 2026): with `cols` given, the rows its cell count leaves (a level's wider grid,
 * Hard 8 × 7 and Expert 9 × 7); without, the square side (today's 7 × 7, Easy's 5 × 5).
 */
export function codewordDimsOf(cells: { length: number }, cols?: number): { cols: number; rows: number } {
  if (typeof cols === "number" && cols > 0 && cells.length % cols === 0) return { cols, rows: cells.length / cols };
  const side = codewordSideOf(cells);
  return { cols: side, rows: side };
}

/**
 * The shape of a level's templates (D1, 21 Nov 2026; src/lib/levels/word/codeword.ts): the side, how many symmetric pairs of
 * black squares to drop (min + up to `pairsSpan − 1` more), the white-cell range, the share of white cells that must be
 * crossed, the longest run (the answer list stops at seven letters) and the fill's search budget. `lattice`: no random
 * squares, rows and columns 1, 3, 5 … are words (Easy's 5 × 5).
 */
export interface CodewordShape {
  /** The grid's width (columns). */
  size: number;
  /** Its height (rows); absent = `size`, square. */
  rows?: number;
  pairsMin: number;
  pairsSpan: number;
  whiteMin: number;
  whiteMax: number;
  checked: number;
  maxRun: number;
  fillBudget: number;
  lattice?: boolean;
}

/** Today's 7 × 7 shape (randomTemplate's own numbers; the bank rebuilds byte for byte from it). */
export const CODEWORD_SHAPE_7: CodewordShape = { size: 7, pairsMin: 6, pairsSpan: 5, whiteMin: 30, whiteMax: 38, checked: 0.5, maxRun: 7, fillBudget: 4_000 };

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

/** Null when the black-square pattern is usable, else why not (`cols`: a wider grid's width; square without). */
export function templateRuleBreak(white: readonly boolean[], cols?: number): string | null {
  const { cols: N, rows: R } = codewordDimsOf(white, cols);
  const CELLS = N * R;
  const cells = white.map((w) => (w ? 1 : 0));
  const runs = codewordRuns(cells, N, R);
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
      if (rr < 0 || rr >= R || kk < 0 || kk >= N) continue;
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

/** Easy's lattice: rows and columns 0, 2, 4 … white, the squares between them black. */
function latticeTemplate(size: number): boolean[] {
  return Array.from({ length: size * size }, (_, i) => Math.floor(i / size) % 2 === 0 || (i % size) % 2 === 0);
}

function randomTemplate(rng: () => number, shape: CodewordShape = CODEWORD_SHAPE_7): boolean[] | null {
  if (shape.lattice) return latticeTemplate(shape.size);
  const N = shape.size;
  const R = shape.rows ?? N;
  const CELLS = N * R;
  for (let tries = 0; tries < 400; tries++) {
    const white = Array.from({ length: CELLS }, () => true);
    const pairs = shape.pairsMin + rngBelow(rng, shape.pairsSpan);
    for (let p = 0; p < pairs; p++) {
      const c = rngBelow(rng, CELLS);
      white[c] = false;
      white[CELLS - 1 - c] = false;
    }
    const count = white.filter(Boolean).length;
    if (count < shape.whiteMin || count > shape.whiteMax) continue;
    if (templateRuleBreak(white, R === N ? undefined : N) !== null) continue;
    // Enough crossings that the code can be cracked: most white cells are checked.
    const runs = codewordRuns(white.map((w) => (w ? 1 : 0)), N, R);
    if (runs.some((r) => r.cells.length > shape.maxRun)) continue;
    const cover = new Map<number, number>();
    for (const r of runs) for (const c of r.cells) cover.set(c, (cover.get(c) ?? 0) + 1);
    const checked = [...cover.values()].filter((v) => v === 2).length;
    if (checked < count * shape.checked) continue;
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
function fillTemplate(white: readonly boolean[], rng: () => number, fillBudget = 4_000, cols?: number): string[] | null {
  const { cols: N, rows: R } = codewordDimsOf(white, cols);
  const runs = codewordRuns(white.map((w) => (w ? 1 : 0)), N, R);
  const letters: (string | undefined)[] = Array.from({ length: N * R }, () => undefined);
  const used = new Set<string>();
  let budget = fillBudget;
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
  cols?: number,
): number {
  const dims = codewordDimsOf(cells, cols);
  const runs = codewordRuns(cells, dims.cols, dims.rows).map((r) => r.cells.map((c) => cells[c]!));
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

/**
 * Rev 2's fifth given for a bank entry: one of the hidden numbers that fills at
 * least two squares (any hidden number if none does), chosen by a hash of the
 * whole entry, so the same board always gains the same number.
 */
export function codewordFifthGiven(entry: string): number {
  const [grid = "", order = "", given = ""] = entry.split("|");
  const four = new Set(given.split(".").map(Number));
  const uses = new Map<number, number>();
  for (const ch of grid) {
    if (ch === "#") continue;
    const n = order.indexOf(ch) + 1;
    uses.set(n, (uses.get(n) ?? 0) + 1);
  }
  const hidden = Array.from({ length: order.length }, (_, i) => i + 1).filter((n) => !four.has(n));
  const repeated = hidden.filter((n) => (uses.get(n) ?? 0) >= 2);
  const pool = repeated.length ? repeated : hidden;
  return pool[fmix32(saltOf(entry) ^ saltOf("codeword-fifth-given")) % pool.length]!;
}

/**
 * How easy the next guesses are with these numbers known: `guessable` = how many
 * different hidden numbers are the only unknown left in some word (3+ letters),
 * `words` = how many words have exactly one unknown number left.
 */
export function codewordNextGuesses(cells: readonly number[], known: ReadonlySet<number>, cols?: number): { guessable: number; words: number } {
  const next = new Set<number>();
  let words = 0;
  const dims = codewordDimsOf(cells, cols);
  for (const run of codewordRuns(cells, dims.cols, dims.rows)) {
    if (run.cells.length < 3) continue;
    const unknown = new Set(run.cells.map((c) => cells[c]!).filter((n) => !known.has(n)));
    if (unknown.size !== 1) continue;
    words++;
    next.add([...unknown][0]!);
  }
  return { guessable: next.size, words };
}

/**
 * Rev 3's sixth given for a bank entry (from the board alone, no seed): of the
 * numbers still hidden after rev 2's five givens, the one that, added to them,
 * makes the most different hidden numbers the only unknown left in some word
 * (codewordNextGuesses' `guessable`); ties go to the most such words, then to
 * the number filling the most squares, then to the lowest number.
 */
export function codewordSixthGiven(entry: string): number {
  const [grid = "", order = "", given = ""] = entry.split("|");
  const cells = [...grid].map((ch) => (ch === "#" ? 0 : order.indexOf(ch) + 1));
  const five = new Set([...given.split(".").map(Number), codewordFifthGiven(entry)]);
  const uses = new Map<number, number>();
  for (const n of cells) if (n > 0) uses.set(n, (uses.get(n) ?? 0) + 1);
  let best = -1;
  let bestKey: number[] = [];
  for (let n = 1; n <= order.length; n++) {
    if (five.has(n)) continue;
    const g = codewordNextGuesses(cells, new Set([...five, n]));
    const key = [g.guessable, g.words, uses.get(n) ?? 0];
    // Lexicographic: the first differing figure decides; equal keys keep the lower number.
    const at = key.findIndex((v, i) => v !== bestKey[i]);
    if (best < 0 || (at >= 0 && key[at]! > bestKey[at]!)) {
      best = n;
      bestKey = key;
    }
  }
  return best;
}

/** The board for a bank entry under a rules revision (rev 1: the entry's four givens; rev 2: plus the fifth; rev 3: plus the sixth). */
export function codewordFromEntry(entry: string, rev: number = CODEWORD_REV): CodewordPuzzleData {
  const [grid = "", order = "", given = ""] = entry.split("|");
  const cells = [...grid].map((ch) => (ch === "#" ? 0 : order.indexOf(ch) + 1));
  const numbers = given.split(".").map(Number);
  if (rev >= 2) numbers.push(codewordFifthGiven(entry));
  if (rev >= 3) numbers.push(codewordSixthGiven(entry));
  numbers.sort((a, b) => a - b);
  return {
    type: "codeword",
    codewordRev: rev,
    size: codewordSideOf(cells),
    cells,
    numbers: order.length,
    givens: numbers.map((n) => ({ n, letter: order[n - 1]! })),
    solution: order,
  };
}

/** Null when an entry meets every rule (including the uniqueness proof), else the rule broken. */
export function codewordEntryRuleBreak(entry: string): string | null {
  const p = codewordFromEntry(entry, 1);
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
  // Rev 2: the fifth given is a different, hidden number and the board stays unique.
  const p2 = codewordFromEntry(entry, 2);
  const want = codewordGivensFor(2);
  if (p2.givens.length !== want || new Set(p2.givens.map((g) => g.n)).size !== want) return "rev 2: not five different givens";
  if (!p.givens.every((g) => p2.givens.some((x) => x.n === g.n && x.letter === g.letter))) return "rev 2: lost a rev-1 given";
  if (countCodewordSolutions(p2.cells, p2.numbers, p2.givens, 2) !== 1) return "rev 2: not exactly one solution";
  // Rev 3: the sixth given is another hidden number and the board stays unique.
  const p3 = codewordFromEntry(entry, 3);
  const want3 = codewordGivensFor(3);
  if (p3.givens.length !== want3 || new Set(p3.givens.map((g) => g.n)).size !== want3) return "rev 3: not six different givens";
  if (!p2.givens.every((g) => p3.givens.some((x) => x.n === g.n && x.letter === g.letter))) return "rev 3: lost a rev-2 given";
  if (countCodewordSolutions(p3.cells, p3.numbers, p3.givens, 2) !== 1) return "rev 3: not exactly one solution";
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
  // Word depth (25 Oct 2026): new rounds deal codewordRev 4, rev 3's board (codewordFromEntry treats 4 as 3).
  return codewordFromEntry(CODEWORD_BANK[codewordBankIndex(seed)]!, dealtDepthRev(CODEWORD_DEPTH_REV, CODEWORD_REV));
}

/** Live check: answers only once every number has a letter, and then only solved or not. */
export function checkCodewordMoves(puzzle: CodewordPuzzleData, moves: string): CwView {
  const actions = decodeCodeword(moves, puzzle.numbers);
  const letters = replayCodeword(puzzle.numbers, puzzle.givens, actions);
  const tally = codewordTally(letters, puzzle.solution ?? "", puzzle.givens);
  const solved = tally.complete && tally.solved;
  const view: CwView = { complete: tally.complete, solved, count: actions.length };
  // codewordRev 7: a full grid that isn't cracked names the words on it that aren't real words (the board's own
  // letters only; nothing about the solution).
  if (tally.complete && !solved && (puzzle.codewordRev ?? 0) >= CODEWORD_REV_NAMES) {
    view.nonWords = codewordRuns(puzzle.cells, puzzle.size ?? N, puzzle.rows ?? puzzle.size ?? N)
      .map((run, i) => ({ i, word: run.cells.map((c) => letters[puzzle.cells[c]! - 1] ?? "").join("") }))
      .filter((r) => !isWord(r.word))
      .map((r) => r.i);
  }
  return view;
}

/* ------------------------------------------------------------------ */
/*  Level boards (D1, 21 Nov 2026)                                     */
/* ------------------------------------------------------------------ */

/** What a level's bank entry must meet (src/lib/levels/word/codeword.ts `CodewordLevelSettings`). */
export interface CodewordLevelRules {
  shape: CodewordShape;
  letters: { readonly min: number; readonly max: number };
  /** Numbers that start decoded; the entry stores exactly these, proven to leave one decoding. */
  givens: number;
  /** Keep only boards the person-like solver (levels/codewordHuman.server.ts) decodes from the givens alone. */
  human?: boolean;
  /**
   * Keep only boards whose person-like line at the human limits reaches 200 (D1, 21 Nov 2026), asked of the finished
   * entry; the bank script deals it as the level does and passes the timed line (scripts/word-human-solvers.ts codewordLine).
   */
  line200?: (entry: string) => boolean;
}

/**
 * One level bank entry: "<size × size grid letters, # for black>|<letter of each number>|<given numbers>", the givens the
 * level deals (not today's four plus the fifth and sixth rules), proven to leave exactly one decoding against the full
 * dictionary (countCodewordSolutions); with `human`, also decoded by `cracks` (the person-like solver) from them alone.
 * Null when the seed's tries run out.
 */
export function buildCodewordLevelEntry(
  seed: number,
  rules: CodewordLevelRules,
  cracks?: (cells: number[], numbers: number, givens: { n: number; letter: string }[], solution: string, cols?: number) => boolean,
): string | null {
  const rng = seededRng(seed);
  const cols = rules.shape.rows && rules.shape.rows !== rules.shape.size ? rules.shape.size : undefined;
  for (let attempt = 0; attempt < 30; attempt++) {
    const white = randomTemplate(rng, rules.shape);
    if (!white) continue;
    const grid = fillTemplate(white, rng, rules.shape.fillBudget, cols);
    if (!grid) continue;
    const distinct = [...new Set(grid.filter((ch) => ch !== "#"))];
    if (distinct.length < rules.letters.min || distinct.length > rules.letters.max) continue;
    const order = rngShuffle(rng, distinct).join("");
    const cells = grid.map((ch) => (ch === "#" ? 0 : order.indexOf(ch) + 1));
    for (let tries = 0; tries < 12; tries++) {
      const given = rngShuffle(rng, Array.from({ length: order.length }, (_, i) => i + 1)).slice(0, rules.givens).sort((a, b) => a - b);
      const givens = given.map((n) => ({ n, letter: order[n - 1]! }));
      if (countCodewordSolutions(cells, order.length, givens, 2, cols) !== 1) continue;
      if (rules.human && cracks && !cracks(cells, order.length, givens, order, cols)) continue;
      const entry = `${grid.join("")}|${order}|${given.join(".")}`;
      if (rules.line200 && !rules.line200(entry)) continue;
      return entry;
    }
  }
  return null;
}

/**
 * A level bank entry as a board (its own stored givens; the rules stamp of today's deal). `cols`: a wider grid's width
 * (the level's settings), stored with its `rows`; without it the board is square, as Easy's 5 × 5.
 */
export function codewordFromLevelEntry(entry: string, rev: number, cols?: number): CodewordPuzzleData {
  const [grid = "", order = "", given = ""] = entry.split("|");
  const cells = [...grid].map((ch) => (ch === "#" ? 0 : order.indexOf(ch) + 1));
  const numbers = given.split(".").map(Number).sort((a, b) => a - b);
  const dims = codewordDimsOf(cells, cols);
  return {
    type: "codeword",
    codewordRev: rev,
    size: dims.cols,
    ...(dims.rows !== dims.cols ? { rows: dims.rows } : {}),
    cells,
    numbers: order.length,
    givens: numbers.map((n) => ({ n, letter: order[n - 1]! })),
    solution: order,
  };
}

/** Null when a level bank entry meets its level's rules (the uniqueness proof included), else the rule broken. */
export function codewordLevelEntryRuleBreak(entry: string, rules: CodewordLevelRules): string | null {
  const rows = rules.shape.rows ?? rules.shape.size;
  const cols = rows !== rules.shape.size ? rules.shape.size : undefined;
  const p = codewordFromLevelEntry(entry, 1, cols);
  const grid = entry.split("|")[0] ?? "";
  if (grid.length !== rules.shape.size * rows) return `grid is not ${rules.shape.size} × ${rows}`;
  if (p.size !== rules.shape.size || (p.rows ?? p.size) !== rows) return `board is not ${rules.shape.size} × ${rows}`;
  const broken = templateRuleBreak(p.cells.map((n) => n > 0), cols);
  if (broken) return broken;
  const runs = codewordRuns(p.cells, p.size, p.rows ?? p.size);
  if (runs.some((r) => r.cells.length > rules.shape.maxRun)) return "a run longer than the answer list";
  const solution = p.solution ?? "";
  if (new Set(solution).size !== solution.length) return "a letter has two numbers";
  if (p.numbers < rules.letters.min || p.numbers > rules.letters.max) return `${p.numbers} letters`;
  if (p.givens.length !== rules.givens || new Set(p.givens.map((g) => g.n)).size !== rules.givens) return `not ${rules.givens} givens`;
  const words = runs.map((r) => r.cells.map((c) => grid[c]).join(""));
  if (new Set(words).size !== words.length) return "repeated word";
  for (const w of words) if (!answerWords(w.length).includes(w)) return `${w} is not a common answer word`;
  if (countCodewordSolutions(p.cells, p.numbers, p.givens, 2, cols) !== 1) return "not exactly one solution";
  return null;
}
