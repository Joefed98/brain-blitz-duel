/**
 * Kakuro's generator and solver (1 Nov 2026), server only. Every board is built from the room seed (salted by type in
 * generate.server.ts) and kept only when the solver proves exactly one solution; the solution stays server-side until
 * the reveal (secrets.ts).
 *
 * Board: 6 × 6, row 0 and column 0 black (clue cells), 4–6 more black cells in the 5 × 5 interior so there are
 * KAKURO_WHITE_MIN–KAKURO_WHITE_MAX white cells, every white cell in an across run and a down run of 2 or more, the
 * white cells joined and at most KAKURO_MAX_BLOCKS white 2 × 2 blocks. The digits come from a fill with no digit twice in
 * a run, changed a digit at a time until the clue sums allow exactly one solution (generateKakuro).
 *
 * Solver: depth-first search over cells with candidate bitmasks; after every placement each run's open cells are cut
 * to the digits that appear in some set of distinct digits completing the run's remaining sum (precomputed per
 * remaining length, sum and used digits), and a cell left with one digit is placed (deduction). The grade is the number
 * of branch points the search needs beyond that deduction when counting solutions (0 = deduction alone solves it).
 * Deterministic: a seeded PRNG, bounded retries, no Math.random.
 */
import { seededRng, type SeededRng } from "./seededRng";
import { kakuroRuns, kakuroSolvedGrid, type KakuroRun } from "./kakuro";
import { KAKURO_SIZE, type KakuroClue, type KakuroPuzzleData } from "./types";

export const KAKURO_WHITE_MIN = 19;
export const KAKURO_WHITE_MAX = 21;
/** The grade band dealt (branch points beyond deduction): a fair 120 s board, never pure guesswork. */
export const KAKURO_GRADE_MAX = 10;

const FULL = 0b1111111110; // digits 1–9 as bits 1–9

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

/** All subsets of 1–9 by (size, sum): their masks. */
const SUBSETS: Map<number, number[]> = (() => {
  const out = new Map<number, number[]>();
  for (let m = 0; m < 512; m++) {
    let size = 0;
    let sum = 0;
    for (let d = 1; d <= 9; d++)
      if (m & (1 << (d - 1))) {
        size++;
        sum += d;
      }
    const key = size * 64 + sum;
    const list = out.get(key) ?? [];
    list.push(m << 1);
    out.set(key, list);
  }
  return out;
})();

const allowedCache = new Map<number, number>();
/** The digits that can fill `len` open cells adding to `sum` without using `used` (bitmask, digits as bits 1–9). */
function allowedMask(len: number, sum: number, used: number): number {
  if (len <= 0) return 0;
  if (sum <= 0 || sum > 45) return 0;
  const key = (len * 64 + sum) * 1024 + used;
  const hit = allowedCache.get(key);
  if (hit !== undefined) return hit;
  let mask = 0;
  for (const m of SUBSETS.get(len * 64 + sum) ?? []) if (!(m & used)) mask |= m;
  allowedCache.set(key, mask);
  return mask;
}

interface Solver {
  runs: KakuroRun[];
  /** Per cell, the indices of its runs. */
  cellRuns: Map<number, number[]>;
  white: number[];
}

function solverOf(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">): Solver {
  const runs = kakuroRuns(puzzle);
  const cellRuns = new Map<number, number[]>();
  runs.forEach((run, i) => {
    for (const c of run.cells) cellRuns.set(c, [...(cellRuns.get(c) ?? []), i]);
  });
  return { runs, cellRuns, white: [...puzzle.white] };
}

/** Cuts every open cell to what its runs allow and places singles; false on a contradiction. */
function propagate(s: Solver, values: number[], masks: Map<number, number>): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of s.runs) {
      let used = 0;
      let sum = 0;
      let open = 0;
      for (const c of run.cells) {
        const v = values[c]!;
        if (v) {
          if (used & (1 << v)) return false;
          used |= 1 << v;
          sum += v;
        } else open++;
      }
      const rest = run.sum - sum;
      if (open === 0) {
        if (rest !== 0) return false;
        continue;
      }
      const allow = allowedMask(open, rest, used);
      if (!allow) return false;
      for (const c of run.cells) {
        if (values[c]) continue;
        const m = masks.get(c)! & allow;
        if (!m) return false;
        if (m !== masks.get(c)) {
          masks.set(c, m);
          changed = true;
        }
        if (popcount(m) === 1) {
          values[c] = 31 - Math.clz32(m);
          changed = true;
        }
      }
    }
  }
  return true;
}

export interface KakuroSearch {
  /** Solutions found, up to the limit. */
  count: number;
  /** Branch points beyond deduction. */
  branches: number;
  /** The first solution found. */
  first: number[] | null;
  /** A solution other than the first, when one was found. */
  second: number[] | null;
}

export function searchKakuro(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">, limit = 2): KakuroSearch {
  const s = solverOf(puzzle);
  const out: KakuroSearch = { count: 0, branches: 0, first: null, second: null };
  const values = new Array<number>(puzzle.size * puzzle.size).fill(0);
  const masks = new Map<number, number>(s.white.map((c) => [c, FULL]));
  const walk = (vals: number[], ms: Map<number, number>): void => {
    if (out.count >= limit) return;
    if (!propagate(s, vals, ms)) return;
    let best = -1;
    let bestN = 10;
    for (const c of s.white) {
      if (vals[c]) continue;
      const n = popcount(ms.get(c)!);
      if (n < bestN) {
        bestN = n;
        best = c;
      }
    }
    if (best < 0) {
      if (kakuroSolvedGrid(puzzle, vals)) {
        out.count++;
        if (!out.first) out.first = [...vals];
        else out.second ??= [...vals];
      }
      return;
    }
    out.branches++;
    const m = ms.get(best)!;
    for (let d = 1; d <= 9; d++) {
      if (!(m & (1 << d))) continue;
      const v2 = [...vals];
      v2[best] = d;
      walk(v2, new Map(ms));
      if (out.count >= limit) return;
    }
  };
  walk(values, masks);
  return out;
}

/** Solutions up to `limit` (2 proves uniqueness). */
export function countKakuroSolutions(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">, limit = 2): number {
  return searchKakuro(puzzle, limit).count;
}

/** The board's grade: branch points beyond deduction in a full uniqueness search. */
export function gradeKakuro(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">): number {
  return searchKakuro(puzzle, 2).branches;
}

/* ------------------------------------------------------------------ layout */

/** Runs ≥ 2 everywhere, whites joined, the count in band: the white cells, or null. */
export function kakuroLayoutWhite(size: number, black: ReadonlySet<number>): number[] | null {
  const isWhite = (r: number, c: number) => r > 0 && c > 0 && r < size && c < size && !black.has(r * size + c);
  const white: number[] = [];
  for (let r = 1; r < size; r++)
    for (let c = 1; c < size; c++) {
      if (!isWhite(r, c)) continue;
      const across = (isWhite(r, c - 1) ? 1 : 0) + (isWhite(r, c + 1) ? 1 : 0);
      const down = (isWhite(r - 1, c) ? 1 : 0) + (isWhite(r + 1, c) ? 1 : 0);
      if (!across || !down) return null;
      white.push(r * size + c);
    }
  if (white.length < KAKURO_WHITE_MIN || white.length > KAKURO_WHITE_MAX) return null;
  const set = new Set(white);
  const seen = new Set([white[0]!]);
  const stack = [white[0]!];
  while (stack.length) {
    const c = stack.pop()!;
    for (const n of [c - 1, c + 1, c - size, c + size])
      if (set.has(n) && !seen.has(n) && (Math.abs(n - c) === size || Math.floor(n / size) === Math.floor(c / size))) {
        seen.add(n);
        stack.push(n);
      }
  }
  return seen.size === white.length ? white : null;
}

/** The clue cells for a layout: every black cell with a white cell to its right or below. */
export function kakuroClueCells(size: number, white: readonly number[], values: readonly number[]): KakuroClue[] {
  const set = new Set(white);
  const clues: KakuroClue[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    if (set.has(cell)) continue;
    const r = Math.floor(cell / size);
    const c = cell % size;
    let right = 0;
    for (let cc = c + 1; cc < size && set.has(r * size + cc); cc++) right += values[r * size + cc]!;
    let down = 0;
    for (let rr = r + 1; rr < size && set.has(rr * size + c); rr++) down += values[rr * size + c]!;
    if (right || down) clues.push({ cell, down, right });
  }
  return clues;
}

/** White 2 × 2 blocks in a layout: each is a place digits can trade without changing a sum, so few make unique boards. */
export function kakuroBlocks(size: number, white: readonly number[]): number {
  const set = new Set(white);
  let n = 0;
  for (const c of white) if (set.has(c + 1) && set.has(c + size) && set.has(c + size + 1) && (c % size) < size - 1) n++;
  return n;
}

/** The most 2 × 2 white blocks a dealt layout may hold (layouts with more almost never give a unique board). */
export const KAKURO_MAX_BLOCKS = 7;

let layoutsCache: number[][] | null = null;
/**
 * Every layout dealt, in a fixed order: 4–6 interior black cells, the white rules of kakuroLayoutWhite and at most
 * KAKURO_MAX_BLOCKS white 2 × 2 blocks (136 layouts). Built once per process (about 0.2 s).
 */
export function kakuroLayouts(size = KAKURO_SIZE): number[][] {
  if (layoutsCache && size === KAKURO_SIZE) return layoutsCache;
  const interior: number[] = [];
  for (let r = 1; r < size; r++) for (let c = 1; c < size; c++) interior.push(r * size + c);
  const out: number[][] = [];
  const chosen: number[] = [];
  const walk = (from: number) => {
    if (chosen.length >= 4) {
      const white = kakuroLayoutWhite(size, new Set(chosen));
      if (white && kakuroBlocks(size, white) <= KAKURO_MAX_BLOCKS) out.push(white);
    }
    if (chosen.length === 6) return;
    for (let i = from; i < interior.length; i++) {
      chosen.push(interior[i]!);
      walk(i + 1);
      chosen.pop();
    }
  };
  walk(0);
  if (size === KAKURO_SIZE) layoutsCache = out;
  return out;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Low and high runs lean to small and large digits: their sums have few ways to make them, so boards come out unique more often. */
const LOW = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5];
const HIGH = [9, 9, 9, 8, 8, 8, 7, 7, 6, 5];

/** Digits already in a cell's runs (bitmask, digits as bits 1–9), the cell itself left out. */
function usedAround(s: Solver, values: readonly number[], cell: number): number {
  let used = 0;
  for (const ri of s.cellRuns.get(cell) ?? []) for (const c of s.runs[ri]!.cells) if (c !== cell && values[c]) used |= 1 << values[c]!;
  return used;
}

/** A fill with no digit twice in any run, each run leaning low or high at random; null after a dead end. */
function leaningFill(rng: SeededRng, s: Solver, size: number): number[] | null {
  const lean = s.runs.map(() => rng.below(2));
  const values = new Array<number>(size * size).fill(0);
  for (const cell of s.white) {
    const runs = s.cellRuns.get(cell) ?? [];
    const a = lean[runs[0]!];
    const b = lean[runs[1] ?? runs[0]!];
    const pool = a === b ? (a ? HIGH : LOW) : DIGITS;
    const used = usedAround(s, values, cell);
    const options = rng.shuffle(pool).filter((d) => !(used & (1 << d)));
    const fallback = options.length ? options : DIGITS.filter((d) => !(used & (1 << d)));
    if (!fallback.length) return null;
    values[cell] = fallback[0]!;
  }
  return values;
}

/** Runs read from the layout alone (every run, sums unknown), for filling before the clues exist. */
function layoutPuzzle(size: number, white: number[]): Pick<KakuroPuzzleData, "size" | "white" | "clues"> {
  const ones = new Array<number>(size * size).fill(1);
  return { size, white, clues: kakuroClueCells(size, white, ones) };
}

/** Solutions counted while climbing (enough to tell better from worse). */
const CLIMB_LIMIT = 4;
/** Single-digit changes tried on one fill before starting a new one. */
const CLIMB_STEPS = 60;

/**
 * A unique board from the seed: a layout from kakuroLayouts, a leaning fill, then single-digit changes (each keeping
 * every run free of repeats) kept whenever the clue sums it makes allow no more solutions than before, until exactly one
 * remains and the grade is in band. Deterministic: everything is drawn from the seed's PRNG.
 */
export function generateKakuro(seed: number): KakuroPuzzleData {
  const size = KAKURO_SIZE;
  const rng = seededRng(seed ^ 0x6b616b75);
  const layouts = kakuroLayouts(size);
  for (;;) {
    const white = layouts[rng.below(layouts.length)]!;
    const s = solverOf(layoutPuzzle(size, white));
    const values = leaningFill(rng, s, size);
    if (!values) continue;
    const boardOf = () => ({ size, white, clues: kakuroClueCells(size, white, values) });
    let search = searchKakuro(boardOf(), CLIMB_LIMIT);
    for (let step = 0; search.count > 1 && step < CLIMB_STEPS; step++) {
      // Change a digit where two of the solutions disagree: that is where the sums leave room.
      const a = search.first!;
      const b = search.second!;
      const differ = white.filter((c) => a[c] !== b[c]);
      const cell = differ.length ? differ[rng.below(differ.length)]! : white[rng.below(white.length)]!;
      const used = usedAround(s, values, cell);
      const options = DIGITS.filter((d) => d !== values[cell] && !(used & (1 << d)));
      if (!options.length) continue;
      const old = values[cell]!;
      values[cell] = options[rng.below(options.length)]!;
      const next = searchKakuro(boardOf(), CLIMB_LIMIT);
      if (next.count <= search.count) search = next;
      else values[cell] = old;
    }
    const count = search.count;
    if (count !== 1) continue;
    const board = boardOf();
    const proof = searchKakuro(board, 2);
    if (proof.count !== 1 || proof.branches > KAKURO_GRADE_MAX) continue;
    const solution = values.map((v, cell) => (white.includes(cell) ? v : 0));
    return { type: "kakuro", kakuroRev: 1, size, white: [...white], clues: board.clues, grade: proof.branches, solution };
  }
}
