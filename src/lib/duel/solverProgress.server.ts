/**
 * Solver-distance progress for Topsy-Turvy (gravityRev 2) and Polypotions (tubesRev 2), 19 Oct 2026
 * (docs/scoring-targets.md). Server-only: it runs exact searches on the stored board.
 *
 * Balls parked and flasks corked were reached about as often by random tilts and pours at the limit as by an
 * average player, so the score bands held both games' unfinished credit near 0. Progress is now how much closer
 * the board the player holds is to solved: `closer` = the stored minimum less the fewest moves that board still
 * needs. Every move beyond `closer` (a tilt or pour that did not bring the board nearer, Undo and Reset never
 * giving one back) cancels some of them: one per wasted tilt, three per wasted pour (random pours do far more real
 * sorting than random tilts: pouring only onto a matching colour or into an empty flask mostly merges runs, so a
 * random pour list at the limit ends a few pours from solved; at two per pour, random pours' 90th percentile on
 * 200 room seeds was 13 % of the board against the average player's 36 %, at three it is 0 % against 24 %). So
 * wandering, even into a nearly sorted board, earns little.
 *
 * A board that can no longer be solved (a locked ball in the way, a dead end) keeps the best `closer` of the
 * boards the player stood on before (Joe's ruling, 20 Oct 2026), less the same waste.
 *
 * Every search is exact and bounded by a node budget per round (GRADE_NODE_BUDGET), so grading can never stall: a
 * board the budget cannot settle scores no `closer` (counted as still a minimum away), which only happens far from
 * solved. Polypotions searches with A* on a lower bound that never overestimates and drops by at most one per pour
 * (tubesLowerBound), so its answer is the breadth-first minimum; Topsy-Turvy keeps breadth-first search (one tilt
 * moves every ball, so no simple bound is safe).
 *
 * Measured on the puzzle-fairness kits (200 room seeds, 7001–7200): average players keep about 0.4 of the board in
 * Topsy-Turvy and 0.2 in Polypotions; random input's 90th percentile is 0 in both games.
 */
import { GRAVITY_DIRS, gravityKey, gravitySolved, type GravityBalls } from "./gravity";
import { pour, pourAmount, tubesSolved, type TubeState } from "./tubes";
import { GRAV_COLS, TUBES_COLOURS, type GravityDir, type GravityPuzzleData, type TubesPuzzleData } from "./types";

/** Each tilt that did not bring the board nearer cancels this many that did. */
export const GRAVITY_WASTE_WEIGHT = 1;
/** Each pour that did not bring the flasks nearer cancels this many that did. */
export const TUBES_WASTE_WEIGHT = 3;
/**
 * Search nodes one round's grading may use, all boards together (Topsy-Turvy: boards expanded; Polypotions: boards
 * made), so a round grades in about 25 ms at worst on one core and can never stall. Measured on the kits (200 room
 * seeds, 108,692 Topsy-Turvy boards that every level and random strategy stood on): 99 % of searches settle within
 * 6,300 nodes, and every board that needed more than 12,000 was no closer than the start (no progress either way).
 * A board the budget cannot settle is counted as no closer.
 */
export const GRADE_NODE_BUDGET = 12_000;

/** A search's answer: the fewest moves left, "dead" (cannot be solved) or "unknown" (the budget ran out). */
export type Distance = number | "dead" | "unknown";

/** 0–1: the share of the stored minimum closed, net of waste. */
export function solverProgress(minMoves: number, closer: number, moves: number, wasteWeight: number): number {
  if (!(minMoves > 0)) return 0;
  const gained = Math.max(0, Math.min(minMoves, closer));
  const waste = Math.max(0, moves - gained);
  return Math.max(0, gained - wasteWeight * waste) / minMoves;
}

/** One round's search allowance, and every state a finished search proved dead (never expanded again). */
interface Budget {
  left: number;
  dead: Set<string | number>;
}

/**
 * `closer` for the final board, or (dead final board) the best of the boards before it within the budget. The
 * board at position i of the list was reached in at most i moves, so it is at most i closer: boards are tried
 * newest first and the walk stops once no earlier board could beat the best found. A search that proves a board
 * dead marks every state it reached dead, so the boards just before a dead end cost little.
 */
function closerOf<S>(minMoves: number, boards: S[], key: (s: S) => string | number, distance: (s: S, budget: Budget, maxDepth: number) => Distance): number {
  // Back at the start (or never left it): the start is the stored minimum away, so nothing is closer.
  if (key(boards[boards.length - 1]!) === key(boards[0]!)) return 0;
  const budget: Budget = { left: GRADE_NODE_BUDGET, dead: new Set() };
  const end = distance(boards[boards.length - 1]!, budget, Infinity);
  if (typeof end === "number") return minMoves - end;
  if (end === "unknown") return 0;
  let best = 0;
  const tried = new Set<string | number>();
  for (let i = boards.length - 2; i > best && budget.left > 0; i--) {
    const k = key(boards[i]!);
    if (tried.has(k) || budget.dead.has(k)) continue;
    tried.add(k);
    // Only a board fewer than (minimum − best) moves from solved can beat the best.
    const d = distance(boards[i]!, budget, minMoves - best - 1);
    if (typeof d === "number") best = Math.max(best, minMoves - d);
  }
  return best;
}

/* ------------------------------- Topsy-Turvy ------------------------------- */

/** Fewest tilts from `start` to every ball locked, by breadth-first search within the budget. */
export function gravityDistance(wallGrid: Uint8Array, start: GravityBalls, targets: number[], budget: Budget, maxDepth = Infinity): Distance {
  if (gravitySolved(start, targets)) return 0;
  let frontier: GravityBalls[] = [start];
  const seen = new Set<number>([gravityKey(start)]);
  for (let depth = 1; frontier.length; depth++) {
    if (depth > maxDepth) return "unknown";
    const next: GravityBalls[] = [];
    for (const balls of frontier) {
      if (budget.left-- <= 0) return "unknown";
      for (const dir of GRAVITY_DIRS) {
        const out = packTilt(wallGrid, balls, targets, dir);
        if (!out) continue;
        const id = gravityKey(out);
        if (seen.has(id) || budget.dead.has(id)) continue;
        if (gravitySolved(out, targets)) return depth;
        seen.add(id);
        next.push(out);
      }
    }
    frontier = next;
  }
  for (const id of seen) budget.dead.add(id);
  return "dead";
}

const STEP: Record<"U" | "D" | "L" | "R", number> = { U: -GRAV_COLS, D: GRAV_COLS, L: -1, R: 1 };
const CELLS = GRAV_COLS * GRAV_COLS;

/** A cell's distance along a tilt (larger = further ahead), for moving the leading ball of each line first. */
function ahead(cell: number, dir: "U" | "D" | "L" | "R"): number {
  const r = (cell / GRAV_COLS) | 0, c = cell % GRAV_COLS;
  return dir === "U" ? -r : dir === "D" ? r : dir === "L" ? -c : c;
}

/**
 * The search's tilt: the same board `tilt` (gravity.ts) reaches, or null when nothing moves. A tilt repeats
 * one-square steps until nothing can move, so every free ball ends packed against the first wall, edge or resting
 * ball ahead of it, in line order; moving the leading ball of each line first gets there in one pass.
 * `wallGrid` marks walls (1) by cell. solver-progress-check compares the two on every board the kits stand on.
 */
export function packTilt(wallGrid: Uint8Array, balls: GravityBalls, targets: number[], dir: GravityDir): GravityBalls | null {
  if (dir === "X" || dir === "Y") return null;
  const step = STEP[dir];
  const n = balls.length;
  const pos = balls.slice();
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    let j = order.length;
    while (j > 0 && ahead(pos[order[j - 1]!]!, dir) < ahead(pos[i]!, dir)) j--;
    order.splice(j, 0, i);
  }
  let moved = false;
  for (const i of order) {
    if (pos[i] === targets[i]) continue;
    let cell = pos[i]!;
    for (;;) {
      const col = cell % GRAV_COLS;
      if ((step === -1 && col === 0) || (step === 1 && col === GRAV_COLS - 1)) break;
      const next = cell + step;
      if (next < 0 || next >= CELLS || wallGrid[next] === 1) break;
      let taken = false;
      for (let k = 0; k < n; k++) if (pos[k] === next) taken = true;
      if (taken) break;
      cell = next;
    }
    if (cell !== pos[i]) {
      pos[i] = cell;
      moved = true;
    }
  }
  return moved ? pos : null;
}

/** Walls (1) by cell, for packTilt. */
export function gravityWallGrid(walls: Iterable<number>): Uint8Array {
  const grid = new Uint8Array(CELLS);
  for (const w of walls) grid[w] = 1;
  return grid;
}

/** Topsy-Turvy: progress over the boards the player stood on (start first), after `tilts` counted tilts. */
export function gravitySolverProgress(puzzle: GravityPuzzleData, boards: GravityBalls[], tilts: number): number {
  const wallGrid = gravityWallGrid(puzzle.walls);
  const min = puzzle.minMoves ?? 0;
  const closer = closerOf(min, boards, gravityKey, (b, budget, maxDepth) => gravityDistance(wallGrid, b, puzzle.targets, budget, maxDepth));
  return solverProgress(min, closer, tilts, GRAVITY_WASTE_WEIGHT);
}

/* ------------------------------- Polypotions ------------------------------- */

/**
 * A lower bound on the pours left: every run of balls sitting on another colour must be poured at least once, and
 * of a colour's runs sitting on flask bottoms all but one must. A pour is the first move of at most one such run,
 * and lowers the bound by at most one, so A* on it is exact.
 */
export function tubesLowerBound(state: TubeState): number {
  let bound = 0;
  const bottoms = new Array<number>(TUBES_COLOURS).fill(0);
  for (const tube of state) {
    if (!tube.length) continue;
    bottoms[tube[0]!] = (bottoms[tube[0]!] ?? 0) + 1;
    for (let i = 1; i < tube.length; i++) if (tube[i] !== tube[i - 1]) bound++;
  }
  for (const n of bottoms) if (n > 1) bound += n - 1;
  return bound;
}

/** A set of flasks as one key, flask order ignored (as tubesKey in tubes.ts, cheaper: a number per flask). */
export function flasksKey(state: TubeState): string {
  const codes = state.map((tube) => {
    let code = 0;
    for (const ball of tube) code = code * 9 + ball + 1;
    return code;
  });
  return codes.sort((a, b) => a - b).join(",");
}

/** Fewest pours from `start` to sorted, by A* within the budget (the same minimum breadth-first search finds). */
export function tubesDistance(start: TubeState, budget: Budget, maxDepth = Infinity): Distance {
  if (tubesSolved(start)) return 0;
  // Binary heap on (g + h, then deeper first).
  const heap: { f: number; g: number; s: TubeState }[] = [];
  const push = (n: (typeof heap)[number]) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!less(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  const best = new Map<string, number>([[flasksKey(start), 0]]);
  push({ f: tubesLowerBound(start), g: 0, s: start });
  while (heap.length) {
    const node = pop();
    if (tubesSolved(node.s)) return node.g;
    // The lower bound (f) only rises, so nothing within maxDepth is left.
    if (node.f > maxDepth) return "unknown";
    if ((best.get(flasksKey(node.s)) ?? Infinity) < node.g) continue;
    for (let from = 0; from < node.s.length; from++) {
      for (let to = 0; to < node.s.length; to++) {
        if (pourAmount(node.s, from, to) <= 0) continue;
        // Each board made costs a node (a set of flasks has up to 90 pours, so counting expansions would not bound it).
        if (budget.left-- <= 0) return "unknown";
        const next = pour(node.s, from, to);
        const k = flasksKey(next);
        const g = node.g + 1;
        if ((best.get(k) ?? Infinity) <= g || budget.dead.has(k)) continue;
        best.set(k, g);
        push({ f: g + tubesLowerBound(next), g, s: next });
      }
    }
  }
  for (const k of best.keys()) budget.dead.add(k);
  return "dead";
}

function less(a: { f: number; g: number }, b: { f: number; g: number }): boolean {
  return a.f < b.f || (a.f === b.f && a.g > b.g);
}

/** Polypotions: progress over the boards the player stood on (start first), after `pours` counted pours. */
export function tubesSolverProgress(puzzle: TubesPuzzleData, boards: TubeState[], pours: number): number {
  const min = puzzle.minMoves ?? 0;
  const closer = closerOf(min, boards, flasksKey, (s, budget, maxDepth) => tubesDistance(s, budget, maxDepth));
  return solverProgress(min, closer, pours, TUBES_WASTE_WEIGHT);
}
