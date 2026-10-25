/**
 * Skid's ice gems (slideRev 1): placing them on a banked board. Server-only, run once when a round is dealt.
 *
 * The board's whole state graph (cell, broken ice) is built once from the start. Candidate cells are ice
 * the ball can cross on some reachable slide, never on the stored shortest route, the start, the exit, a
 * hole, thin ice, an arrow or a portal. Three candidates are drawn (spread apart), and a breadth-first
 * search over (state, gems collected) proves a route that collects all three and reaches the exit, taking
 * 2–8 slides more than the minimum: off the direct route, but on the way. Fewer gems only when a board has
 * no such triple (two, then one); every board keeps at least one.
 */
import { pick, shuffled } from "../random";
import { SLIDE_DIRS, slideBoard, slideOutcome, type SlideBoard } from "../slide";
import { SLIDE_CELLS, SLIDE_COLS, type SlideDir, type SlidePuzzleData } from "../types";
import { gemBits } from "./iceGems";

export const ICE_GEMS = 3;
export const ICE_GEM_MIN_DETOUR = 2;
export const ICE_GEM_MAX_DETOUR = 8;
const ATTEMPTS = 120;

interface Edge {
  to: number;
  path: number[];
  dir: SlideDir;
}

interface Graph {
  edges: Edge[][];
  start: number;
  exits: Set<number>;
}

function buildGraph(board: SlideBoard): Graph {
  const key = (cell: number, mask: number) => mask * SLIDE_CELLS + cell;
  const index = new Map<number, number>();
  const states: { cell: number; mask: number }[] = [];
  const add = (cell: number, mask: number) => {
    const k = key(cell, mask);
    let i = index.get(k);
    if (i === undefined) {
      i = states.length;
      index.set(k, i);
      states.push({ cell, mask });
    }
    return i;
  };
  add(board.start, 0);
  const edges: Edge[][] = [];
  const exits = new Set<number>();
  for (let i = 0; i < states.length; i++) {
    const s = states[i]!;
    edges[i] = [];
    if (s.cell === board.exit) {
      exits.add(i);
      continue;
    }
    for (const dir of SLIDE_DIRS) {
      const out = slideOutcome(board, s.cell, s.mask, dir);
      if (!out.path.length) continue;
      edges[i]!.push({ to: add(out.cell, out.mask), path: out.path, dir });
    }
  }
  return { edges, start: 0, exits };
}

/** Fewest slides to the exit collecting every gem in `gems` (null if impossible). */
export function gemRouteLength(graph: Graph, gems: readonly number[]): number | null {
  const full = (1 << gems.length) - 1;
  const n = graph.edges.length;
  const seen = new Uint8Array(n << gems.length);
  let frontier: [number, number][] = [[graph.start, 0]];
  seen[graph.start << gems.length] = 1;
  for (let depth = 0; frontier.length && depth < 200; depth++) {
    const next: [number, number][] = [];
    for (const [s, m] of frontier) {
      if (graph.exits.has(s) && m === full) return depth;
      for (const e of graph.edges[s]!) {
        const nm = m | gemBits(gems, e.path);
        const id = (e.to << gems.length) | nm;
        if (seen[id]) continue;
        seen[id] = 1;
        next.push([e.to, nm]);
      }
    }
    frontier = next;
  }
  return null;
}

/** Cells a stored route crosses. */
function routeCells(board: SlideBoard, route: string): Set<number> {
  const cells = new Set<number>([board.start]);
  let cell = board.start;
  let mask = 0;
  for (const dir of route.split("") as SlideDir[]) {
    const out = slideOutcome(board, cell, mask, dir);
    for (const c of out.path) cells.add(c);
    cell = out.cell;
    mask = out.mask;
  }
  return cells;
}

function spread(cells: number[]): boolean {
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]!;
      const b = cells[j]!;
      const d = Math.abs(Math.floor(a / SLIDE_COLS) - Math.floor(b / SLIDE_COLS)) + Math.abs((a % SLIDE_COLS) - (b % SLIDE_COLS));
      if (d < 3) return false;
    }
  return true;
}

export interface GemPlan {
  gems: number[];
  /** Fewest slides collecting every gem. */
  allGems: number;
  min: number;
}

/** Picks the gems for a board (see the header), or null if not even one gem fits. */
export function planIceGems(puzzle: SlidePuzzleData): GemPlan | null {
  const board = slideBoard(puzzle);
  const graph = buildGraph(board);
  const min = puzzle.minMoves ?? gemRouteLength(graph, []) ?? 0;
  const banned = new Set<number>([
    ...routeCells(board, puzzle.solution ?? ""),
    board.start,
    board.exit,
    ...board.holes,
    ...board.thin.keys(),
    ...board.arrows.keys(),
    ...board.portals.keys(),
  ]);
  const candidates = new Set<number>();
  for (const list of graph.edges) for (const e of list ?? []) for (const c of e.path) if (!banned.has(c) && !board.walls.has(c)) candidates.add(c);
  const pool = [...candidates].sort((a, b) => a - b);
  for (let count = ICE_GEMS; count >= 1; count--) {
    if (pool.length < count) continue;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const gems = count === 1 ? [pick(pool)] : shuffled(pool).slice(0, count).sort((a, b) => a - b);
      if (!spread(gems)) continue;
      const all = gemRouteLength(graph, gems);
      if (all === null) continue;
      if (all < min + ICE_GEM_MIN_DETOUR || all > min + ICE_GEM_MAX_DETOUR) continue;
      return { gems, allGems: all, min };
    }
  }
  return null;
}

/** The banked board with its gems (slideRev 1). */
export function addIceGems(puzzle: SlidePuzzleData): SlidePuzzleData {
  const plan = planIceGems(puzzle);
  return { ...puzzle, gems: plan?.gems ?? [] };
}

/** One shortest route that collects every gem and ends at the exit (checks and the tuning players). */
export function gemRoute(puzzle: SlidePuzzleData): SlideDir[] | null {
  const board = slideBoard(puzzle);
  const graph = buildGraph(board);
  const gems = puzzle.gems ?? [];
  const full = (1 << gems.length) - 1;
  const g = gems.length;
  const parent = new Map<number, [number, SlideDir]>();
  const startId = graph.start << g;
  const seen = new Set<number>([startId]);
  let frontier = [startId];
  while (frontier.length) {
    const next: number[] = [];
    for (const id of frontier) {
      const s = id >> g;
      const m = id & full;
      if (graph.exits.has(s) && m === full) {
        const route: SlideDir[] = [];
        for (let at = id; at !== startId; ) {
          const [from, dir] = parent.get(at)!;
          route.unshift(dir);
          at = from;
        }
        return route;
      }
      for (const e of graph.edges[s]!) {
        const nid = (e.to << g) | m | gemBits(gems, e.path);
        if (seen.has(nid)) continue;
        seen.add(nid);
        parent.set(nid, [id, e.dir]);
        next.push(nid);
      }
    }
    frontier = next;
  }
  return null;
}

/** Fewest slides that reach the exit collecting these gems (the grader's yardstick for a gem finish). */
export function gemMinMoves(puzzle: SlidePuzzleData, gems: readonly number[]): number | null {
  return gemRouteLength(buildGraph(slideBoard(puzzle)), gems);
}
