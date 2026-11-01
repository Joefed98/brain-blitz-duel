/**
 * Bridges' generator and solver (1 Nov 2026), server only. A board is built from its seed alone (the room seed salted
 * by type, generate.server.ts), so every player in a room gets the identical grid.
 *
 * The generator grows a connected bridge network on the 7 × 7 grid: from a first island, each new island is placed
 * along a row or column from an existing one, the cells between clear of islands and bridges, joined by one or two
 * bridges; a few extra bridges may then join islands that already see each other. The islands' numbers are the
 * bridges at each. A board is kept only when it has 10–14 islands, `countBridgesSolutions` proves it has exactly one
 * solution, and its grade (search beyond deduction) sits in GRADE band. Every draw comes from the seeded PRNG, so the
 * same seed always gives the same board.
 */
import { bridgePairs, bridgesProgressCounts, crossingTable, encodeBridges, islandDegrees, type BridgePair } from "./bridges";
import { seededRng, type SeededRng } from "./seededRng";
import { BRIDGES_SIZE, type BridgesIsland, type BridgesPuzzleData } from "./types";

export const BRIDGES_MIN_ISLANDS = 10;
export const BRIDGES_MAX_ISLANDS = 14;
/** The grades a dealt board may have (branch points the solver needed beyond its deductions). */
export const BRIDGES_GRADE_MIN = 0;
export const BRIDGES_GRADE_MAX = 4;
/** Bounded retries; the fallback board below is proved unique by bridges-check. */
const MAX_ATTEMPTS = 400;

/* ------------------------------------------------------------------------------------------------ the solver */

export interface BridgesSolveResult {
  /** Solutions found, up to the limit. */
  count: number;
  /** The first solution (per candidate pair), or null. */
  first: number[] | null;
  /** Branch points: search nodes where deduction alone could not decide (0 = solved by deduction). */
  branches: number;
}

/** Domains are bitmasks: bit v set = v bridges still possible (v = 0, 1, 2). */
const MIN_OF = [9, 0, 1, 0, 2, 0, 1, 0];
const MAX_OF = [-1, 0, 1, 1, 2, 2, 2, 2];
const BITS = [0, 1, 1, 2, 1, 2, 2, 3];

/**
 * Counts the solutions of a board up to `limit` (default 2: enough to prove uniqueness). Backtracking over the
 * candidate pairs with propagation: crossing pairs exclude each other, each island's sum bounds every pair at it, and a
 * group of islands joined by bridges whose numbers are all used up must be every island.
 */
export function solveBridges(size: number, islands: readonly BridgesIsland[], limit = 2): BridgesSolveResult {
  const pairs = bridgePairs(islands, size);
  const crosses = crossingTable(pairs);
  const at: number[][] = islands.map(() => []);
  pairs.forEach((p, i) => {
    at[p.a]!.push(i);
    at[p.b]!.push(i);
  });
  const result: BridgesSolveResult = { count: 0, first: null, branches: 0 };
  if (islands.length === 0) return result;
  // A lone island can never be connected to the rest.
  if (islands.length > 1 && at.some((list) => list.length === 0)) return result;

  const propagate = (dom: number[]): boolean => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < pairs.length; i++) {
        if (dom[i] === 0) return false;
        if (MIN_OF[dom[i]!]! > 0) {
          for (const j of crosses[i]!) {
            if (!(dom[j]! & 1)) return false;
            if (dom[j] !== 1) {
              dom[j] = 1;
              changed = true;
            }
          }
        }
      }
      for (let k = 0; k < islands.length; k++) {
        const n = islands[k]!.n;
        let lo = 0;
        let hi = 0;
        for (const i of at[k]!) {
          lo += MIN_OF[dom[i]!]!;
          hi += MAX_OF[dom[i]!]!;
        }
        if (lo > n || hi < n) return false;
        for (const i of at[k]!) {
          const d = dom[i]!;
          const vmin = n - (hi - MAX_OF[d]!);
          const vmax = n - (lo - MIN_OF[d]!);
          let nd = d;
          for (let v = 0; v <= 2; v++) if ((nd & (1 << v)) && (v < vmin || v > vmax)) nd &= ~(1 << v);
          if (nd !== d) {
            if (nd === 0) return false;
            dom[i] = nd;
            changed = true;
          }
        }
      }
    }
    // Connectivity: the possible bridges must join every island, and a closed group (every number used up) must be all.
    const parent = islands.map((_, k) => k);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
    const sureParent = islands.map((_, k) => k);
    const findSure = (x: number): number => (sureParent[x] === x ? x : (sureParent[x] = findSure(sureParent[x]!)));
    pairs.forEach((p, i) => {
      if (MAX_OF[dom[i]!]! > 0) parent[find(p.a)] = find(p.b);
      if (MIN_OF[dom[i]!]! > 0) sureParent[findSure(p.a)] = findSure(p.b);
    });
    const root = find(0);
    for (let k = 1; k < islands.length; k++) if (find(k) !== root) return false;
    // Closed groups: a sure group where every pair touching it is decided.
    const open = new Set<number>();
    pairs.forEach((p, i) => {
      if (BITS[dom[i]!]! > 1) {
        open.add(findSure(p.a));
        open.add(findSure(p.b));
      }
    });
    const groupSize = new Map<number, number>();
    for (let k = 0; k < islands.length; k++) groupSize.set(findSure(k), (groupSize.get(findSure(k)) ?? 0) + 1);
    for (const [g, n] of groupSize) if (!open.has(g) && n < islands.length) return false;
    return true;
  };

  const search = (dom: number[]): void => {
    if (result.count >= limit) return;
    if (!propagate(dom)) return;
    let best = -1;
    let bestBits = 9;
    for (let i = 0; i < pairs.length; i++) {
      const b = BITS[dom[i]!]!;
      if (b > 1 && b < bestBits) {
        best = i;
        bestBits = b;
      }
    }
    if (best < 0) {
      result.count += 1;
      if (!result.first) result.first = dom.map((d) => MIN_OF[d]!);
      return;
    }
    result.branches += 1;
    for (let v = 2; v >= 0; v--) {
      if (!(dom[best]! & (1 << v))) continue;
      const next = dom.slice();
      next[best] = 1 << v;
      search(next);
      if (result.count >= limit) return;
    }
  };
  search(pairs.map(() => 7));
  return result;
}

export function countBridgesSolutions(size: number, islands: readonly BridgesIsland[], limit = 2): number {
  return solveBridges(size, islands, limit).count;
}

/* ------------------------------------------------------------------------------------------------ the generator */

/** Growth odds: a bridge is double this often; a free pair gets an extra bridge this often. */
const DOUBLE_CHANCE = 0.5;
const EXTRA_CHANCE = 0.15;
/**
 * Guessing must never pay: the most a blanket guess (every pair doubled or single, crossings refused as the phone
 * does, in either order) nets under bridgesProgress (right − wrong) as a share of the solution's bridges. A board
 * above it is dealt again.
 */
export const BRIDGES_GUESS_SHARE_MAX = 0.1;
/**
 * …and random dragging must expect to lose: a pair dragged at random ends at 0, 1 or 2 bridges alike, so it nets −1 on
 * a pair the solution leaves empty, −1/3 on a single and +1/3 on a double (bridgesProgress). Over the board that
 * expectation, as a share of the solution's bridges, must be at most this.
 */
export const BRIDGES_RANDOM_SHARE_MAX = -0.25;

/** The expected net share of dragging every pair at random (see BRIDGES_RANDOM_SHARE_MAX). */
export function bridgesRandomShare(solution: readonly number[]): number {
  const total = solution.reduce((a, b) => a + b, 0);
  if (!total) return 1;
  let e = 0;
  for (const want of solution) e += want === 0 ? -1 : want === 1 ? -1 / 3 : 1 / 3;
  return e / total;
}

/** The best net share any blanket guess earns on a board (bridgesProgress's right − wrong, over the solution's bridges). */
export function bridgesGuessShare(pairs: readonly BridgePair[], solution: readonly number[]): number {
  const crosses = crossingTable(pairs);
  const total = solution.reduce((a, b) => a + b, 0);
  if (!total) return 1;
  let best = 0;
  for (const k of [1, 2]) {
    for (const reverse of [false, true]) {
      const order = pairs.map((_, i) => i);
      if (reverse) order.reverse();
      const guess = new Array<number>(pairs.length).fill(0);
      for (const i of order) if (!crosses[i]!.some((j) => guess[j])) guess[i] = k;
      const g = bridgesProgressCounts(solution, guess);
      best = Math.max(best, (g.right - g.wrong) / total);
    }
  }
  return best;
}

const DIRS: readonly [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

interface Built {
  islands: BridgesIsland[];
  solution: number[];
  pairs: BridgePair[];
}

/** One growth attempt: a connected network of `target` islands, or null when it got stuck. */
export function grow(rng: SeededRng, size: number, target: number): Built | null {
  const island = new Set<number>();
  const bridgeCell = new Set<number>();
  const edges: { a: number; b: number; k: number; cells: number[] }[] = [];
  const start = rng.below(size * size);
  island.add(start);
  const orthAdjacent = (cell: number) => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    return (r > 0 && island.has(cell - size)) || (r < size - 1 && island.has(cell + size)) || (c > 0 && island.has(cell - 1)) || (c < size - 1 && island.has(cell + 1));
  };
  /** Islands seen from a cell along clear lines (no island between), not counting `except`. */
  const seen = (cell: number, except: number) => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    let n = 0;
    for (const [dr, dc] of DIRS) {
      for (let s = 1; ; s++) {
        const rr = r + dr * s;
        const cc = c + dc * s;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) break;
        const at = rr * size + cc;
        if (island.has(at)) {
          if (at !== except && s > 1) n++;
          break;
        }
      }
    }
    return n;
  };
  while (island.size < target) {
    // Every legal placement: along a row or column from an island, the cells between clear, never beside an island.
    const options: { from: number; to: number; cells: number[]; view: number }[] = [];
    for (const from of island) {
      const r0 = Math.floor(from / size);
      const c0 = from % size;
      for (const [dr, dc] of DIRS) {
        const cells: number[] = [];
        for (let dist = 1; dist < size; dist++) {
          const r1 = r0 + dr * dist;
          const c1 = c0 + dc * dist;
          if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) break;
          const to = r1 * size + c1;
          if (island.has(to) || bridgeCell.has(to)) break;
          if (dist >= 2 && !orthAdjacent(to)) options.push({ from, to, cells: [...cells], view: seen(to, from) });
          cells.push(to);
        }
      }
    }
    if (!options.length) return null;
    // Prefer placements that line up with other islands (more pairs the solution leaves empty, so guessing can't pay).
    const best = Math.max(...options.map((o) => o.view));
    const pool = rng.next() < 0.8 ? options.filter((o) => o.view === best) : options;
    const pick = rng.pick(pool);
    island.add(pick.to);
    for (const cell of pick.cells) bridgeCell.add(cell);
    edges.push({ a: pick.from, b: pick.to, k: rng.next() < DOUBLE_CHANCE ? 2 : 1, cells: pick.cells });
  }
  if (island.size < target) return null;
  const islands = [...island].sort((a, b) => a - b).map((cell) => ({ cell, n: 0 }));
  const index = new Map(islands.map((isl, i) => [isl.cell, i]));
  const pairs = bridgePairs(islands, size);
  const counts = new Array<number>(pairs.length).fill(0);
  const pairOf = (x: number, y: number) => {
    const a = Math.min(index.get(x)!, index.get(y)!);
    const b = Math.max(index.get(x)!, index.get(y)!);
    return pairs.findIndex((p) => p.a === a && p.b === b);
  };
  for (const e of edges) {
    const i = pairOf(e.a, e.b);
    if (i < 0) return null;
    counts[i] = e.k;
  }
  // A few extra bridges between islands that already see each other (never crossing a bridge).
  const crosses = crossingTable(pairs);
  for (const i of rng.shuffle(pairs.map((_, j) => j))) {
    if (counts[i] || rng.next() > EXTRA_CHANCE) continue;
    if (crosses[i]!.some((j) => counts[j])) continue;
    counts[i] = rng.next() < DOUBLE_CHANCE ? 2 : 1;
  }
  const deg = islandDegrees(islands, pairs, counts);
  islands.forEach((isl, i) => (isl.n = deg[i]!));
  return { islands, solution: counts, pairs };
}

/** A board proved unique by bridges-check, used only if every seeded attempt failed (never seen in practice). */
const FALLBACK: { islands: BridgesIsland[]; solution: number[] } = (() => {
  // generateBridges(20261101)'s board, kept fixed.
  const islands: BridgesIsland[] = [
    { cell: 6, n: 1 }, { cell: 8, n: 4 }, { cell: 12, n: 2 }, { cell: 22, n: 5 }, { cell: 25, n: 5 }, { cell: 27, n: 5 },
    { cell: 37, n: 1 }, { cell: 39, n: 3 }, { cell: 41, n: 2 }, { cell: 43, n: 3 }, { cell: 47, n: 1 },
  ];
  return { islands, solution: solveBridges(BRIDGES_SIZE, islands, 1).first ?? [] };
})();

export function generateBridges(seed: number): BridgesPuzzleData {
  const rng = seededRng(seed);
  const size = BRIDGES_SIZE;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const target = rng.int(BRIDGES_MIN_ISLANDS, BRIDGES_MAX_ISLANDS);
    const built = grow(rng, size, target);
    if (!built) continue;
    if (built.islands.some((isl) => isl.n < 1 || isl.n > 8)) continue;
    if (bridgesGuessShare(built.pairs, built.solution) > BRIDGES_GUESS_SHARE_MAX) continue;
    if (bridgesRandomShare(built.solution) > BRIDGES_RANDOM_SHARE_MAX) continue;
    const solved = solveBridges(size, built.islands, 2);
    if (solved.count !== 1) continue;
    if (solved.branches < BRIDGES_GRADE_MIN || solved.branches > BRIDGES_GRADE_MAX) continue;
    return { type: "bridges", bridgesRev: 1, size, islands: built.islands, grade: solved.branches, solution: built.solution };
  }
  return { type: "bridges", bridgesRev: 1, size, islands: FALLBACK.islands.map((i) => ({ ...i })), grade: 0, solution: [...FALLBACK.solution] };
}

/** The fallback board, for the check. */
export const BRIDGES_FALLBACK = FALLBACK;
/** The solution string of a board (for checks and kits). */
export function bridgesSolutionAnswer(puzzle: BridgesPuzzleData): string {
  return encodeBridges(puzzle.solution ?? []);
}
