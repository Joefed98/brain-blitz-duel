/**
 * Colour Flood's levels (the Logic overhaul, session 1, 15 Nov 2026; logicLevels.ts). Server-only.
 *
 * A level's board is `cols` wide and `rows` tall (grown downwards past today's 14 wide, so squares stay tappable on a
 * phone), painted in `colours` blobs, with `blocked` stones on Expert (never flooded, never needed; placed so every
 * other square stays connected to the corner). Its par is the exact minimum number of taps, proved by an IDA* search
 * over the board's colour regions with an admissible bound: the larger of the colours still outside the flood and the
 * farthest region's distance (in regions) from it, since one tap takes at most one more ring of regions. A board is
 * kept only when its par lands in the level's band. (Today's board also refuses any board a blind colour cycle floods
 * within its allowance; on six colours and these sizes almost every board allows one a few taps over par, so the
 * levels rely on the par bonus instead: a cycle scores well under a planned flood. See logic-1-levels-check.)
 */
import { FLOOD_BLOCKED, floodApply, floodSolved, replayFlood } from "./flood";
import type { FloodLevel } from "./logicLevels";
import { randomBelow, shuffled } from "./random";
import type { FloodPuzzleData } from "./types";

/** The move allowance over par (today's standard, floodSpareMoves). */
export const FLOOD_LEVEL_SPARE = 6;
/** Nodes the search may visit before a board is dropped as too slow to prove. */
const SEARCH_CAP = 1_500_000;

/** A blobby board of the level's size and colours (today's painting: seeds, then two smoothing passes). */
function randomGrid(cols: number, rows: number, colours: number, passes: number): number[] {
  const cells = cols * rows;
  const grid = Array.from({ length: cells }, () => randomBelow(colours));
  const nbrs = (cell: number) => {
    const row = Math.floor(cell / cols);
    const col = cell % cols;
    return [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1, row > 0 ? cell - cols : -1, row < rows - 1 ? cell + cols : -1].filter((i) => i >= 0);
  };
  for (let pass = 0; pass < passes; pass++) {
    for (const cell of shuffled(Array.from({ length: cells }, (_, i) => i))) {
      if (randomBelow(100) >= 45) continue;
      const ns = nbrs(cell);
      const from = ns[randomBelow(ns.length)];
      if (from !== undefined) grid[cell] = grid[from]!;
    }
  }
  for (let colour = 0; colour < colours; colour++) if (!grid.includes(colour)) grid[1 + randomBelow(cells - 1)] = colour;
  return grid;
}

/** Places `count` stones away from the corner, keeping every open square connected to it. */
function placeBlocked(grid: number[], cols: number, rows: number, count: number): boolean {
  const cells = cols * rows;
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 40; tries++) {
    const cell = randomBelow(cells);
    const row = Math.floor(cell / cols);
    const col = cell % cols;
    if (row + col < 3 || grid[cell] === FLOOD_BLOCKED) continue;
    const kept = grid[cell]!;
    grid[cell] = FLOOD_BLOCKED;
    if (openConnected(grid, cols)) placed++;
    else grid[cell] = kept;
  }
  return placed === count;
}

function openConnected(grid: readonly number[], cols: number): boolean {
  const seen = new Uint8Array(grid.length);
  const stack = [0];
  seen[0] = 1;
  let n = 1;
  while (stack.length) {
    const cell = stack.pop()!;
    const col = cell % cols;
    for (const next of [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1, cell - cols, cell + cols]) {
      if (next < 0 || next >= grid.length || seen[next] || grid[next] === FLOOD_BLOCKED) continue;
      seen[next] = 1;
      n++;
      stack.push(next);
    }
  }
  let open = 0;
  for (const v of grid) if (v !== FLOOD_BLOCKED) open++;
  return n === open;
}

interface Regions {
  colour: number[];
  adj: number[][];
}

/** The board as colour regions (blocked squares belong to none) and which regions touch. */
function regionsOf(grid: readonly number[], cols: number): Regions {
  const id = new Int32Array(grid.length).fill(-1);
  const colour: number[] = [];
  for (let start = 0; start < grid.length; start++) {
    if (id[start] !== -1 || grid[start] === FLOOD_BLOCKED) continue;
    const r = colour.length;
    colour.push(grid[start]!);
    const stack = [start];
    id[start] = r;
    while (stack.length) {
      const cell = stack.pop()!;
      const col = cell % cols;
      for (const next of [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1, cell - cols, cell + cols]) {
        if (next < 0 || next >= grid.length || id[next] !== -1 || grid[next] !== grid[start]) continue;
        id[next] = r;
        stack.push(next);
      }
    }
  }
  const sets = colour.map(() => new Set<number>());
  for (let cell = 0; cell < grid.length; cell++) {
    const a = id[cell]!;
    if (a < 0) continue;
    const col = cell % cols;
    for (const next of [col < cols - 1 ? cell + 1 : -1, cell + cols]) {
      if (next < 0 || next >= grid.length) continue;
      const b = id[next]!;
      if (b >= 0 && b !== a) {
        sets[a]!.add(b);
        sets[b]!.add(a);
      }
    }
  }
  return { colour, adj: sets.map((s) => [...s]) };
}

/**
 * The exact fewest taps, with one route (null past the search cap or the depth `maxDepth`). Moves are the colours of
 * regions touching the flood; the bound is admissible, so the first route found at a depth is the minimum.
 */
export function floodLevelMinimum(grid: readonly number[], cols: number, maxDepth: number): { par: number; solution: number[] } | null {
  const { colour, adj } = regionsOf(grid, cols);
  const n = colour.length;
  const bound = (inside: Uint8Array): number => {
    // Ring distance from the flood to every region, and the colours left outside.
    const dist = new Int32Array(n).fill(-1);
    const queue: number[] = [];
    for (let r = 0; r < n; r++) if (inside[r]) { dist[r] = 0; queue.push(r); }
    let far = 0;
    const left = new Set<number>();
    for (let q = 0; q < queue.length; q++) {
      const r = queue[q]!;
      for (const b of adj[r]!) {
        if (dist[b] !== -1) continue;
        dist[b] = dist[r]! + 1;
        if (dist[b]! > far) far = dist[b]!;
        left.add(colour[b]!);
        queue.push(b);
      }
    }
    return Math.max(far, left.size);
  };
  const keyOf = (inside: Uint8Array) => {
    let k = "";
    for (let r = 0; r < n; r += 16) {
      let v = 0;
      for (let b = 0; b < 16 && r + b < n; b++) if (inside[r + b]) v |= 1 << b;
      k += String.fromCharCode(v + 1);
    }
    return k;
  };
  // A* with a closed set on the flooded regions (the same minimum IDA* finds; far fewer repeated states).
  interface N { f: number; g: number; inside: Uint8Array; parent: N | null; move: number }
  const heap: N[] = [];
  const better = (a: N, b: N) => a.f < b.f || (a.f === b.f && a.g > b.g);
  const push = (x: N) => {
    heap.push(x);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!better(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const pop = (): N => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && better(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && better(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  const start = new Uint8Array(n);
  start[0] = 1; // the corner's region is region 0 (the first square scanned)
  const seen = new Map<string, number>([[keyOf(start), 0]]);
  push({ f: bound(start), g: 0, inside: start, parent: null, move: -1 });
  let nodes = 0;
  while (heap.length) {
    const node = pop();
    if (node.f > maxDepth) return null;
    if (node.f === node.g) {
      // h = 0: everything flooded.
      const path: number[] = [];
      for (let w: N | null = node; w && w.move >= 0; w = w.parent) path.unshift(w.move);
      return { par: path.length, solution: path };
    }
    if ((seen.get(keyOf(node.inside)) ?? Infinity) < node.g) continue;
    if (++nodes > SEARCH_CAP) return null;
    const touching = new Set<number>();
    for (let r = 0; r < n; r++) if (node.inside[r]) for (const b of adj[r]!) if (!node.inside[b]) touching.add(colour[b]!);
    for (const c of touching) {
      const next = node.inside.slice();
      for (let r = 0; r < n; r++) {
        if (!node.inside[r]) continue;
        for (const b of adj[r]!) if (colour[b] === c) next[b] = 1;
      }
      const g = node.g + 1;
      const k = keyOf(next);
      if ((seen.get(k) ?? Infinity) <= g) continue;
      seen.set(k, g);
      push({ f: g + bound(next), g, inside: next, parent: node, move: c });
    }
  }
  return null;
}

/** Fewest taps any blind cycling order (2+ distinct colours, round and round) needs, within `limit`, or null. */
export function floodLevelCycleBest(grid: readonly number[], cols: number, colours: number, limit: number): number | null {
  let best: number | null = null;
  const orders: number[][] = [];
  const build = (prefix: number[]) => {
    if (prefix.length >= 2) orders.push(prefix);
    if (prefix.length === colours) return;
    for (let c = 0; c < colours; c++) if (!prefix.includes(c)) build([...prefix, c]);
  };
  build([]);
  for (const order of orders) {
    let g = [...grid];
    let made = 0;
    for (let i = 0; made < (best === null ? limit : best - 1) && !floodSolved(g); i++) {
      const c = order[i % order.length]!;
      if (c === g[0]) continue;
      g = floodApply(g, c, cols, colours);
      made++;
    }
    if (floodSolved(g) && (best === null || made < best)) best = made;
  }
  return best;
}

/** One candidate board for a level (one painting), or null when it is rejected. The bank builder draws these. */
export function floodLevelCandidate(level: FloodLevel): FloodPuzzleData | null {
  const [lo, hi] = level.par;
  const grid = randomGrid(level.cols, level.rows, level.colours, level.smooth);
  if (level.blocked && !placeBlocked(grid, level.cols, level.rows, level.blocked)) return null;
  const solved = floodLevelMinimum(grid, level.cols, hi);
  if (!solved || solved.par < lo || solved.par > hi) return null;
  const replay = replayFlood(grid, solved.solution, level.cols, null, level.colours);
  if (!replay.solved || replay.moves !== solved.par) return null;
  return { type: "flood", grid, par: solved.par, solution: solved.solution, cols: level.cols, colours: level.colours, timeLimitMs: level.timeMs, moveSpare: level.spare };
}

/** A level's board (logicLevels.ts FloodLevel), proved as above (live: Easy; Hard and Expert deal from the bank). */
export function generateFloodLevel(level: FloodLevel): FloodPuzzleData {
  for (let attempt = 0; attempt < 3000; attempt++) {
    const made = floodLevelCandidate(level);
    if (made) return made;
  }
  throw new Error("Colour Flood generator could not build a proven board for the level");
}
