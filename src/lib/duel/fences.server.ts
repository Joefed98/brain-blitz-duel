/**
 * Fences generator and solver (1 Nov 2026), server only. Every board is built from the room seed (salted by type in
 * generate.server.ts), so a room's players all get the same grid.
 *
 * Build: grow a random region of cells, one neighbour at a time, keeping its outline one single closed loop (no holes,
 * no corner pinches); that outline is the solution. Every cell's count is computed, then clues are removed in seeded
 * order while `countFencesSolutions` still finds exactly one loop. The board is kept only when its difficulty grade
 * (the solver's branch points when counting to two solutions) sits in FENCES_GRADE_BAND and it keeps at least
 * FENCES_MIN_CLUES numbers; otherwise the next region is drawn (bounded, deterministic).
 *
 * The solver: edges are unknown / line / no line; propagation applies the clue counts (all remaining sides on or off
 * when forced), dot degrees (0 or 2), and the loop rule (a line that would close a loop is allowed only when that loop
 * is the whole answer and every clue holds; otherwise it is ruled out). It then branches on an edge at a loose end.
 * Integers only; no Math.random.
 */
import { seededRng, type SeededRng } from "./seededRng";
import { FENCES_SIZE, type FencesPuzzleData } from "./types";
import { cellEdges, dotEdges, edgeDots, fencesEdgeCount, isSingleLoop } from "./fences";

/** Difficulty band: solver branch points (0 = deduction alone). */
export const FENCES_GRADE_BAND: readonly [number, number] = [0, 6];
/** Fewest numbers a board keeps (a bare board is a guessing game in 90 s). */
export const FENCES_MIN_CLUES = 15;
/** Region sizes drawn for the loop's inside. */
const REGION_MIN = 11;
const REGION_MAX = 22;
const MAX_TRIES = 60;

interface Geometry {
  size: number;
  edges: number;
  dots: number;
  cellEdges: number[][];
  dotEdges: number[][];
  edgeDots: [number, number][];
  /** Cells each edge borders (1 or 2). */
  edgeCells: number[][];
}

const GEO = new Map<number, Geometry>();

function geometry(size: number): Geometry {
  let g = GEO.get(size);
  if (g) return g;
  const edges = fencesEdgeCount(size);
  const dots = (size + 1) * (size + 1);
  const ce = Array.from({ length: size * size }, (_, c) => [...cellEdges(size, c)]);
  const edgeCells: number[][] = Array.from({ length: edges }, () => []);
  ce.forEach((list, c) => list.forEach((e) => edgeCells[e]!.push(c)));
  g = {
    size,
    edges,
    dots,
    cellEdges: ce,
    dotEdges: Array.from({ length: dots }, (_, d) => dotEdges(size, d)),
    edgeDots: Array.from({ length: edges }, (_, e) => edgeDots(size, e)),
    edgeCells,
  };
  GEO.set(size, g);
  return g;
}

const UNK = -1;
const OFF = 0;
const ON = 1;

/** The other end of the line chain starting at dot `d` (which has exactly one line), and the chain's length. */
function chainEnd(g: Geometry, st: Int8Array, d: number): { end: number; length: number } {
  let prevEdge = -1;
  let dot = d;
  let length = 0;
  for (;;) {
    let next = -1;
    for (const e of g.dotEdges[dot]!) if (st[e] === ON && e !== prevEdge) { next = e; break; }
    if (next < 0) return { end: dot, length };
    length++;
    const [a, b] = g.edgeDots[next]!;
    dot = a === dot ? b : a;
    prevEdge = next;
    if (dot === d) return { end: d, length }; // a closed loop (should not happen from a loose end)
  }
}

/** True when turning `e` on closes a loop that is a valid whole answer (every other edge off, every clue met). */
function closingIsFinal(g: Geometry, st: Int8Array, clues: readonly number[], e: number, loopLen: number): boolean {
  let on = 0;
  for (let i = 0; i < g.edges; i++) if (st[i] === ON) on++;
  if (on !== loopLen) return false; // other lines exist outside this chain
  for (let c = 0; c < clues.length; c++) {
    const n = clues[c]!;
    if (n < 0) continue;
    let k = 0;
    for (const x of g.cellEdges[c]!) if (st[x] === ON || x === e) k++;
    if (k !== n) return false;
  }
  return true;
}

/** Applies every forced deduction; false on a contradiction. */
function propagate(g: Geometry, st: Int8Array, clues: readonly number[]): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    // Clues.
    for (let c = 0; c < clues.length; c++) {
      const n = clues[c]!;
      if (n < 0) continue;
      let on = 0;
      let unk = 0;
      for (const e of g.cellEdges[c]!) {
        if (st[e] === ON) on++;
        else if (st[e] === UNK) unk++;
      }
      if (on > n || on + unk < n) return false;
      if (unk === 0) continue;
      if (on === n) {
        for (const e of g.cellEdges[c]!) if (st[e] === UNK) st[e] = OFF;
        changed = true;
      } else if (on + unk === n) {
        for (const e of g.cellEdges[c]!) if (st[e] === UNK) st[e] = ON;
        changed = true;
      }
    }
    // Dots.
    for (let d = 0; d < g.dots; d++) {
      let on = 0;
      let unk = 0;
      let lastUnk = -1;
      for (const e of g.dotEdges[d]!) {
        if (st[e] === ON) on++;
        else if (st[e] === UNK) (unk++, (lastUnk = e));
      }
      if (on > 2) return false;
      if (on === 1 && unk === 0) return false;
      if (unk === 0) continue;
      if (on === 2) {
        for (const e of g.dotEdges[d]!) if (st[e] === UNK) st[e] = OFF;
        changed = true;
      } else if (on === 1 && unk === 1) {
        st[lastUnk] = ON;
        changed = true;
      } else if (on === 0 && unk === 1) {
        st[lastUnk] = OFF;
        changed = true;
      }
    }
    if (changed) continue;
    // Loops: a line that would join the two ends of one chain closes a loop.
    for (let d = 0; d < g.dots; d++) {
      let on = 0;
      for (const e of g.dotEdges[d]!) if (st[e] === ON) on++;
      if (on !== 1) continue;
      const { end, length } = chainEnd(g, st, d);
      if (end === d) continue;
      for (const e of g.dotEdges[d]!) {
        if (st[e] !== UNK) continue;
        const [a, b] = g.edgeDots[e]!;
        const other = a === d ? b : a;
        if (other !== end) continue;
        if (!closingIsFinal(g, st, clues, e, length)) {
          st[e] = OFF;
          changed = true;
        }
      }
    }
    // A closed loop on the board can only be the whole answer (closing is allowed only then): everything else is off.
    if (!changed && hasClosedSubLoop(g, st, true)) {
      for (let e = 0; e < g.edges; e++) if (st[e] === UNK) (st[e] = OFF), (changed = true);
    }
  }
  return true;
}

/** The leaf test: one loop meeting every clue. */
function leafValid(g: Geometry, st: Int8Array, clues: readonly number[]): boolean {
  const lines: number[] = [];
  for (let i = 0; i < g.edges; i++) if (st[i] === ON) lines.push(i);
  if (!isSingleLoop(g.size, lines)) return false;
  for (let c = 0; c < clues.length; c++) {
    const n = clues[c]!;
    if (n < 0) continue;
    let k = 0;
    for (const e of g.cellEdges[c]!) if (st[e] === ON) k++;
    if (k !== n) return false;
  }
  return true;
}

/** A closed loop already on the board that is not the whole answer: dead branch. */
function hasClosedSubLoop(g: Geometry, st: Int8Array, anyClosed = false): boolean {
  // Any line whose chain closes on itself, while other lines or loose ends exist elsewhere.
  const seen = new Uint8Array(g.edges);
  let comps = 0;
  let closed = false;
  for (let s = 0; s < g.edges; s++) {
    if (st[s] !== ON || seen[s]) continue;
    comps++;
    const stack = [s];
    seen[s] = 1;
    let looseEnds = 0;
    const dotsSeen = new Set<number>();
    while (stack.length) {
      const e = stack.pop()!;
      for (const d of g.edgeDots[e]!) {
        if (!dotsSeen.has(d)) {
          dotsSeen.add(d);
          let on = 0;
          for (const f of g.dotEdges[d]!) if (st[f] === ON) on++;
          if (on === 1) looseEnds++;
        }
        for (const f of g.dotEdges[d]!) if (st[f] === ON && !seen[f]) (seen[f] = 1), stack.push(f);
      }
    }
    if (looseEnds === 0) closed = true;
  }
  return anyClosed ? closed : closed && comps > 1;
}

export interface FencesSolveStats {
  solutions: number;
  /** Branch points visited (0 = solved by deduction alone). */
  nodes: number;
  /** The first solution found (edge states), if any. */
  first: Int8Array | null;
}

function solve(size: number, clues: readonly number[], limit: number, nodeCap = 200_000): FencesSolveStats {
  const g = geometry(size);
  const out: FencesSolveStats = { solutions: 0, nodes: 0, first: null };
  const rec = (st: Int8Array): void => {
    if (out.solutions >= limit || out.nodes > nodeCap) return;
    if (!propagate(g, st, clues)) return;
    if (hasClosedSubLoop(g, st)) return;
    // Pick a branching edge: an unknown edge at a loose end, else any unknown edge next to a clue, else any.
    let pick = -1;
    for (let d = 0; d < g.dots && pick < 0; d++) {
      let on = 0;
      for (const e of g.dotEdges[d]!) if (st[e] === ON) on++;
      if (on !== 1) continue;
      for (const e of g.dotEdges[d]!) if (st[e] === UNK) { pick = e; break; }
    }
    if (pick < 0) for (let e = 0; e < g.edges; e++) if (st[e] === UNK) { pick = e; break; }
    if (pick < 0) {
      if (leafValid(g, st, clues)) {
        out.solutions++;
        if (!out.first) out.first = st.slice();
      }
      return;
    }
    out.nodes++;
    const on = st.slice();
    on[pick] = ON;
    rec(on);
    const off = st.slice();
    off[pick] = OFF;
    rec(off);
  };
  rec(new Int8Array(g.edges).fill(UNK));
  return out;
}

/** Counts loops meeting the clues, up to `limit` (2 proves uniqueness). */
export function countFencesSolutions(size: number, clues: readonly number[], limit = 2): number {
  return solve(size, clues, limit).solutions;
}

/** The difficulty grade: branch points the solver visits proving uniqueness (0 = pure deduction). */
export function gradeFences(size: number, clues: readonly number[]): number {
  return solve(size, clues, 2).nodes;
}

/** The unique loop's edges, sorted, or null when the clues allow none or several. */
export function solveFences(size: number, clues: readonly number[]): number[] | null {
  const r = solve(size, clues, 2);
  if (r.solutions !== 1 || !r.first) return null;
  const out: number[] = [];
  r.first.forEach((v, e) => {
    if (v === ON) out.push(e);
  });
  return out;
}

function neighbours(size: number, cell: number): number[] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

/** The outline of a set of cells: edges bordering exactly one of them. */
function outline(g: Geometry, inside: Uint8Array): number[] {
  const out: number[] = [];
  for (let e = 0; e < g.edges; e++) {
    let k = 0;
    for (const c of g.edgeCells[e]!) if (inside[c]) k++;
    if (k === 1) out.push(e);
  }
  return out;
}

/** A random region whose outline is one loop. */
function randomRegion(rng: SeededRng, g: Geometry): Uint8Array {
  const n = g.size * g.size;
  const target = rng.int(REGION_MIN, REGION_MAX);
  const inside = new Uint8Array(n);
  inside[rng.below(n)] = 1;
  let count = 1;
  let stuck = 0;
  while (count < target && stuck < 200) {
    const frontier: number[] = [];
    for (let c = 0; c < n; c++) if (!inside[c] && neighbours(g.size, c).some((x) => inside[x])) frontier.push(c);
    const c = rng.pick(frontier);
    inside[c] = 1;
    if (isSingleLoop(g.size, outline(g, inside))) count++;
    else (inside[c] = 0), stuck++;
  }
  return inside;
}

/** A board from a seed: deterministic, unique, graded. */
export function generateFences(seed: number): FencesPuzzleData {
  const size = FENCES_SIZE;
  const g = geometry(size);
  const rng = seededRng(seed);
  let fallback: FencesPuzzleData | null = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const inside = randomRegion(rng, g);
    const loop = outline(g, inside);
    const on = new Set(loop);
    const full = Array.from({ length: size * size }, (_, c) => g.cellEdges[c]!.filter((e) => on.has(e)).length);
    const clues = [...full];
    for (const c of rng.shuffle(Array.from({ length: size * size }, (_, i) => i))) {
      if (clues.filter((v) => v >= 0).length <= FENCES_MIN_CLUES) break;
      const keep = clues[c]!;
      clues[c] = -1;
      if (countFencesSolutions(size, clues, 2) !== 1) clues[c] = keep;
    }
    const grade = gradeFences(size, clues);
    const board: FencesPuzzleData = { type: "fences", fencesRev: 1, size, clues, grade, solution: [...loop].sort((a, b) => a - b) };
    if (grade >= FENCES_GRADE_BAND[0] && grade <= FENCES_GRADE_BAND[1]) return board;
    fallback ??= board;
  }
  // Never reached in practice (fences-check measures it); a unique board is still returned.
  return fallback!;
}
