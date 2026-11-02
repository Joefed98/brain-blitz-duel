/**
 * Fillomino's generator and solver (1 Nov 2026), server only. Every board is built from the room seed (salted by type)
 * and proved to have exactly one solution before it is dealt.
 *
 * Generation: a seeded partition of the 7 × 7 grid into regions of 1–FILLOMINO_GEN_MAX squares where no two regions of
 * the same size touch side by side (a valid filled board), then every square's number is given and givens are taken
 * away in a seeded order while the solver still proves exactly one solution (within its node budget; a board it cannot
 * settle inside the budget keeps the given). The last board the solver proved unique is the one dealt.
 *
 * Solver (`countFillominoSolutions`): region placement. The first square (row by row) not yet in a placed region must
 * be the first square of some region; the solver tries every number N (the square's given, or 1–9 on a blank) and every
 * connected set of N free squares from it onward (each set once, Redelmeier's enumeration) whose squares are blank or
 * already hold N, that touches no other N (a region of the same size or an N not in it), then recurses. A cheap check
 * prunes boards where a given N can no longer reach N squares. Numbers are 1–9: the answer encoding holds nothing
 * larger, so this proves uniqueness over every board a player can enter.
 *
 * Grade: the branching nodes of the full search (nodes with two or more ways on), a measure of the guessing a
 * row-by-row search needs beyond forced placements. Boards are kept within FILLOMINO_GRADE_BAND.
 */
import { seededRng, type SeededRng } from "./seededRng";
import { FILLOMINO_MAX_N, fillominoGroups, fillominoNeighbours, fillominoSolvedGrid } from "./fillomino";
import { FILLOMINO_SIZE, type FillominoPuzzleData } from "./types";

/** The largest region the generator builds (the solver still allows up to FILLOMINO_MAX_N). */
export const FILLOMINO_GEN_MAX = 7;
/** Branching nodes the dealt boards stay within (inclusive). */
export const FILLOMINO_GRADE_BAND: readonly [number, number] = [8, 120];
/** Givens the dealt boards keep (inclusive): enough to read, few enough to need thought. */
export const FILLOMINO_GIVENS_BAND: readonly [number, number] = [14, 26];
/** Regions this size or smaller may be left with no clue. */
export const FILLOMINO_UNCLUED_MAX = 2;
/** The solver's node budget for one uniqueness proof while removing givens. */
const PROOF_BUDGET = 150;
/** The node budget while adding givens. */
const ADD_BUDGET = 400;
/** The final proof's node budget (a board it cannot settle is not dealt). */
const FINAL_BUDGET = 4_000;
/** Whole-board attempts before the fallback board. */
const MAX_ATTEMPTS = 12;

/** How often each region size is drawn (index = size). */
const SIZE_WEIGHTS = [0, 6, 16, 22, 22, 17, 11, 6];

export interface FillominoSolveResult {
  /** Solutions found, at most `limit`. */
  count: number;
  /** The first solution found (every square's number), or null. */
  solution: number[] | null;
  /** Every solution found (at most `limit`). */
  solutions: number[][];
  /** Search nodes visited. */
  nodes: number;
  /** Nodes with two or more ways on. */
  branches: number;
  /** True when the search stopped at its node budget (the count is then a lower bound). */
  exhausted: boolean;
}

/** Counts solutions up to `limit`. `givens`: one per square, 0 = blank. */
export function solveFillomino(size: number, givens: readonly number[], limit = 2, budget = Infinity): FillominoSolveResult {
  const n = size * size;
  const nbs: number[][] = Array.from({ length: n }, (_, c) => fillominoNeighbours(size, c));
  const res: FillominoSolveResult = { count: 0, solution: null, solutions: [], nodes: 0, branches: 0, exhausted: false };
  const ALL = (1 << (FILLOMINO_MAX_N + 1)) - 2; // bits 1…9

  /** Groups of equal set numbers: id per square (−1 blank), each group's size and number. */
  const groupsOf = (vals: number[]) => {
    const id = new Int16Array(n).fill(-1);
    const sizes: number[] = [];
    const nums: number[] = [];
    const stack: number[] = [];
    for (let s0 = 0; s0 < n; s0++) {
      if (!vals[s0] || id[s0] !== -1) continue;
      const g = sizes.length;
      let count = 0;
      id[s0] = g;
      stack.push(s0);
      while (stack.length) {
        const c = stack.pop()!;
        count++;
        for (const nb of nbs[c]!) if (id[nb] === -1 && vals[nb] === vals[s0]) (id[nb] = g), stack.push(nb);
      }
      sizes.push(count);
      nums.push(vals[s0]!);
    }
    return { id, sizes, nums };
  };

  /**
   * For each number v, the size of every square's component of squares a v region could use: blanks that may still be v,
   * and v squares in groups not yet full. `reach[v * n + c]`.
   */
  const reachOf = (vals: number[], excl: Int32Array, gr: ReturnType<typeof groupsOf>): Int16Array => {
    const reach = new Int16Array((FILLOMINO_MAX_N + 1) * n);
    const comp = new Int16Array(n);
    const stack: number[] = [];
    const members: number[] = [];
    for (let v = 1; v <= FILLOMINO_MAX_N; v++) {
      const open = (c: number) => {
        const w = vals[c]!;
        if (w === 0) return !(excl[c]! & (1 << v));
        return w === v && gr.sizes[gr.id[c]!]! < v;
      };
      comp.fill(0);
      for (let s0 = 0; s0 < n; s0++) {
        if (comp[s0] || !open(s0)) continue;
        members.length = 0;
        comp[s0] = 1;
        stack.push(s0);
        while (stack.length) {
          const c = stack.pop()!;
          members.push(c);
          for (const nb of nbs[c]!) if (!comp[nb] && open(nb)) (comp[nb] = 1), stack.push(nb);
        }
        for (const c of members) reach[v * n + c] = members.length;
      }
    }
    return reach;
  };

  /**
   * Can square c (blank) take v? The groups it would join must total at most v (so it touches no full v group), and the
   * squares a v region could use from it must number at least v.
   */
  const canTake = (excl: Int32Array, gr: ReturnType<typeof groupsOf>, reach: Int16Array, c: number, v: number): boolean => {
    if (excl[c]! & (1 << v)) return false;
    let total = 1;
    let j0 = -1;
    let j1 = -1;
    let j2 = -1;
    for (const nb of nbs[c]!) {
      const g = gr.id[nb]!;
      if (g < 0 || gr.nums[g] !== v || g === j0 || g === j1 || g === j2) continue;
      if (j0 < 0) j0 = g;
      else if (j1 < 0) j1 = g;
      else j2 = g;
      total += gr.sizes[g]!;
    }
    if (total > v) return false;
    return total === v || reach[v * n + c]! >= v;
  };

  /** Propagates to a fixed point; returns the candidate masks, or null on a contradiction. */
  const propagate = (vals: number[], excl: Int32Array): { cand: Int32Array; gr: ReturnType<typeof groupsOf> } | null => {
    for (let round = 0; round < 200; round++) {
      const gr = groupsOf(vals);
      // Groups over their number are dead.
      for (let g = 0; g < gr.sizes.length; g++) if (gr.sizes[g]! > gr.nums[g]!) return null;
      const cand = new Int32Array(n);
      const reach = reachOf(vals, excl, gr);
      let changed = false;
      for (let c = 0; c < n; c++) {
        if (vals[c]) continue;
        let m = 0;
        for (let v = 1; v <= FILLOMINO_MAX_N; v++) if (canTake(excl, gr, reach, c, v)) m |= 1 << v;
        if (!m) return null;
        cand[c] = m;
        if ((m & (m - 1)) === 0) {
          vals[c] = 31 - Math.clz32(m);
          changed = true;
        }
      }
      if (changed) continue;
      // An unfinished group must grow: with one way on, it takes it; with none, dead.
      for (let g = 0; g < gr.sizes.length; g++) {
        const v = gr.nums[g]!;
        if (gr.sizes[g]! >= v) continue;
        let only = -1;
        let ways = 0;
        for (let c = 0; c < n && ways < 2; c++) {
          if (gr.id[c] !== g) continue;
          for (const nb of nbs[c]!) if (!vals[nb] && cand[nb]! & (1 << v) && nb !== only) (ways++, (only = nb));
        }
        if (ways === 0) return null;
        if (ways === 1) {
          vals[only] = v;
          changed = true;
          break;
        }
      }
      if (!changed) return { cand, gr };
    }
    return null;
  };

  const walk = (vals: number[], excl: Int32Array): void => {
    if (res.count >= limit || res.exhausted) return;
    res.nodes++;
    if (res.nodes > budget) {
      res.exhausted = true;
      return;
    }
    const state = propagate(vals, excl);
    if (!state) return;
    const { cand, gr } = state;
    // Branch on an unfinished region's growth (the one with fewest ways on), else on the blank with fewest candidates.
    let pick = -1;
    let pv = 0;
    let best = 99;
    for (let g = 0; g < gr.sizes.length; g++) {
      const v = gr.nums[g]!;
      if (gr.sizes[g]! >= v) continue;
      const ways: number[] = [];
      for (let c = 0; c < n; c++) {
        if (gr.id[c] !== g) continue;
        for (const nb of nbs[c]!) if (!vals[nb] && cand[nb]! & (1 << v) && !ways.includes(nb)) ways.push(nb);
      }
      if (ways.length < best) (best = ways.length), (pick = ways[0]!), (pv = v);
    }
    if (pick < 0) {
      for (let c = 0; c < n; c++) {
        if (vals[c]) continue;
        let k = 0;
        for (let m = cand[c]!; m; m &= m - 1) k++;
        if (k < best) (best = k), (pick = c);
      }
      if (pick >= 0) pv = 31 - Math.clz32(cand[pick]! & -cand[pick]!);
    }
    if (pick < 0) {
      if (fillominoSolvedGrid(size, vals)) {
        res.count++;
        if (!res.solution) res.solution = [...vals];
        res.solutions.push([...vals]);
      }
      return;
    }
    res.branches++;
    const take = [...vals];
    take[pick] = pv;
    walk(take, Int32Array.from(excl));
    if (res.count >= limit || res.exhausted) return;
    const other = Int32Array.from(excl);
    other[pick] = other[pick]! | (1 << pv);
    walk([...vals], other);
  };
  void ALL;
  walk(givens.map((v) => (v > 0 && v <= FILLOMINO_MAX_N ? v : 0)), new Int32Array(n));
  return res;
}

/** Solutions up to `limit` (2 proves uniqueness: 1 means exactly one). */
export function countFillominoSolutions(size: number, givens: readonly number[], limit = 2): number {
  return solveFillomino(size, givens, limit).count;
}

/** The grade of a board: branching nodes of the full uniqueness search. */
export function gradeFillomino(size: number, givens: readonly number[]): number {
  return solveFillomino(size, givens, 2).branches;
}

function drawSize(rng: SeededRng): number {
  const total = SIZE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rng.below(total);
  for (let s = 1; s < SIZE_WEIGHTS.length; s++) {
    r -= SIZE_WEIGHTS[s]!;
    if (r < 0) return s;
  }
  return 1;
}

/** A seeded valid filled board: regions of 1–FILLOMINO_GEN_MAX, no equal sizes touching. Null when stuck. */
export function fillominoPartition(rng: SeededRng, size = FILLOMINO_SIZE): number[] | null {
  const n = size * size;
  const vals = new Array<number>(n).fill(0);
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  for (const start of order) {
    if (vals[start]) continue;
    let placed = false;
    for (let tries = 0; tries < 8 && !placed; tries++) {
      const want = Math.min(FILLOMINO_GEN_MAX, drawSize(rng));
      const cells = [start];
      const inR = new Set(cells);
      while (cells.length < want) {
        const frontier: number[] = [];
        for (const c of cells) for (const nb of fillominoNeighbours(size, c)) if (!vals[nb] && !inR.has(nb) && !frontier.includes(nb)) frontier.push(nb);
        if (!frontier.length) break;
        const pick = rng.pick(frontier);
        cells.push(pick);
        inR.add(pick);
      }
      const N = cells.length;
      // No neighbour already holds N.
      let clash = false;
      for (const c of cells) for (const nb of fillominoNeighbours(size, c)) if (!inR.has(nb) && vals[nb] === N) clash = true;
      if (clash) continue;
      for (const c of cells) vals[c] = N;
      placed = true;
    }
    if (!placed) return null;
  }
  return fillominoSolvedGrid(size, vals) ? vals : null;
}

/**
 * The givens for a filled board: one seeded square per region, then, while the solver finds a second solution, the
 * square of a seeded difference is given too; finally givens are taken away in a seeded order while the solver still
 * proves one solution. Null when the board cannot be settled inside the budgets.
 */
function chooseGivens(rng: SeededRng, size: number, solution: readonly number[]): number[] | null {
  const n = size * size;
  const givens = new Array<number>(n).fill(0);
  for (const members of fillominoGroups(size, solution).cells) {
    const c = rng.pick(members);
    givens[c] = solution[c]!;
  }
  for (let added = 0; added < n; added++) {
    const r = solveFillomino(size, givens, 2, ADD_BUDGET);
    if (!r.exhausted && r.count === 1) break;
    let options: number[];
    if (r.exhausted || r.count === 0) options = Array.from({ length: n }, (_, c) => c).filter((c) => !givens[c]);
    else {
      const other = r.solutions.find((sol) => sol.some((v, c) => v !== solution[c])) ?? r.solutions[0]!;
      options = Array.from({ length: n }, (_, c) => c).filter((c) => !givens[c] && other[c] !== solution[c]);
    }
    if (!options.length) return null;
    const c = rng.pick(options);
    givens[c] = solution[c]!;
  }
  // Thin: drop givens the proof no longer needs, keeping a clue in every region of three or more squares (only the
  // small regions may be left unclued, so the board stays readable in 90 s).
  const groups = fillominoGroups(size, solution);
  const cluesIn = (c: number) => groups.cells[groups.group[c]!]!.filter((x) => givens[x]).length;
  for (const c of rng.shuffle(Array.from({ length: n }, (_, i) => i))) {
    if (!givens[c] || givens.filter(Boolean).length <= FILLOMINO_GIVENS_BAND[0]) continue;
    if (solution[c]! >= FILLOMINO_UNCLUED_MAX + 1 && cluesIn(c) <= 1) continue;
    const keep = givens[c]!;
    givens[c] = 0;
    const r = solveFillomino(size, givens, 2, PROOF_BUDGET);
    if (r.exhausted || r.count !== 1) givens[c] = keep;
  }
  return givens;
}

function inBand(v: number, band: readonly [number, number]): boolean {
  return v >= band[0] && v <= band[1];
}

/** A fixed, hand-checked fallback board (only if every seeded attempt misses its bands; never seen in the checks). */
const FALLBACK_SOLUTION = [
  3, 3, 1, 4, 4, 4, 4,
  3, 2, 2, 5, 5, 5, 1,
  1, 4, 4, 4, 4, 5, 5,
  6, 6, 6, 3, 3, 3, 2,
  6, 1, 6, 6, 2, 1, 2,
  5, 5, 5, 4, 2, 3, 3,
  5, 5, 4, 4, 4, 1, 3,
];

/** Builds the board for a seed: identical everywhere for the same seed. */
export function generateFillomino(seed: number): FillominoPuzzleData {
  const size = FILLOMINO_SIZE;
  const rng = seededRng(seed);
  let best: { givens: number[]; solution: number[]; grade: number } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // A partition attempt fails about four times in five (a region with no size left that fits); each is cheap.
    let solution: number[] | null = null;
    for (let tries = 0; tries < 200 && !solution; tries++) solution = fillominoPartition(rng, size);
    if (!solution) continue;
    const givens = chooseGivens(rng, size, solution);
    if (!givens) continue;
    const proof = solveFillomino(size, givens, 2, FINAL_BUDGET);
    if (proof.exhausted || proof.count !== 1) continue;
    const grade = proof.branches;
    const candidate = { givens, solution, grade };
    if (inBand(grade, FILLOMINO_GRADE_BAND) && inBand(givens.filter(Boolean).length, FILLOMINO_GIVENS_BAND)) {
      best = candidate;
      break;
    }
    best ??= candidate;
  }
  if (!best) {
    const solution = [...FALLBACK_SOLUTION];
    const givens = chooseGivens(seededRng(seed ^ 0x5bd1e995), size, solution) ?? [...solution];
    best = { givens, solution, grade: gradeFillomino(size, givens) };
  }
  return { type: "fillomino", fillominoRev: 1, size, givens: best.givens, grade: best.grade, solution: best.solution };
}

/** True when no two regions of the same size touch (every touching group of equal numbers is one region). */
export function fillominoEqualRegionsApart(size: number, values: readonly number[]): boolean {
  return fillominoGroups(size, values).cells.every((members) => members.length === values[members[0]!]);
}
