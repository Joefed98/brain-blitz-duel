/**
 * Pipeline's solvers (difficulty levels, 15 Nov 2026; docs/design/difficulty/README.md). Server-only and pure: no
 * randomness, no clock. A Pipeline board is solved when every tile is joined to the network with no open end; the
 * grader accepts any such layout (`gradePipesBoard`), so a board has one answer only when exactly one layout of its
 * tiles does that. Two solvers prove it:
 *
 * - `deducePipes`: reasons the way a person does, with no guessing, one tile and its neighbours at a time (the rules
 *   of Simon Tatham's "Net", the classic form of this puzzle): a tile's open sides must match its neighbours' and the
 *   walls; a pipe never joins two tiles already joined (the network has no loops, since the tiles' openings add up to
 *   exactly a tree); and no tile may be turned so a group of joined pipes is sealed off from the rest of the board. If
 *   it fixes every tile, that layout is the board's only solution (every rule only rules out impossible turns).
 * - `countPipesSolutions`: the same rules plus trying each turn of the tile with fewest left, counting layouts up to a
 *   limit (2 is enough to prove one). Independent of the first in what it can find, so the checks run both.
 */
import { PIPE_BITS, PIPE_E, PIPE_N, PIPE_S, PIPE_W, rotateMask } from "./logic";

const DIRS = [PIPE_N, PIPE_E, PIPE_S, PIPE_W] as const;

interface Board {
  cols: number;
  rows: number;
  /** Per cell, its edge id in each direction (N, E, S, W), or -1 at a wall. */
  edgeOf: Int32Array;
  /** Per edge, its two cells. */
  ends: Int32Array;
  edges: number;
  /**
   * True when the tiles' openings add up to exactly a tree's (every board the deal builds): then a solution has no
   * loops, so the loop rules apply. A board with more openings (only the checks' brute-force boards) skips them.
   */
  tree: boolean;
}

function board(cols: number, rows: number): Board {
  const n = cols * rows;
  const edgeOf = new Int32Array(n * 4).fill(-1);
  const ends: number[] = [];
  let id = 0;
  for (let cell = 0; cell < n; cell++) {
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    if (c < cols - 1) {
      edgeOf[cell * 4 + 1] = id;
      edgeOf[(cell + 1) * 4 + 3] = id;
      ends.push(cell, cell + 1);
      id++;
    }
    if (r < rows - 1) {
      edgeOf[cell * 4 + 2] = id;
      edgeOf[(cell + cols) * 4 + 0] = id;
      ends.push(cell, cell + cols);
      id++;
    }
  }
  return { cols, rows, edgeOf, ends: Int32Array.from(ends), edges: id, tree: false };
}

/** The distinct turns of a tile's open sides. */
function turnsOf(mask: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < 4; t++) {
    const m = rotateMask(mask & 15, t);
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

interface State {
  /** Per cell, the open-side sets still possible. */
  cand: number[][];
  /** Per edge: -1 unknown, 0 closed, 1 open. */
  edge: Int8Array;
}

const clone = (s: State): State => ({ cand: s.cand.map((c) => [...c]), edge: Int8Array.from(s.edge) });

/** Union-find over the open edges: each cell's group root. */
function groups(b: Board, s: State, n: number): Int32Array {
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  for (let e = 0; e < b.edges; e++) {
    if (s.edge[e] !== 1) continue;
    const a = find(b.ends[e * 2]!);
    const c = find(b.ends[e * 2 + 1]!);
    if (a !== c) parent[a] = c;
  }
  for (let i = 0; i < n; i++) parent[i] = find(i);
  return parent;
}

/**
 * Applies the person-like rules until nothing changes. Returns false on a contradiction (no layout fits).
 * `cycle` is set when an open edge joins two cells already joined (also a contradiction).
 */
function propagate(b: Board, s: State): boolean {
  const n = b.cols * b.rows;
  for (let guard = 0; guard < 10_000; guard++) {
    let changed = false;
    // 1. Each tile: its turns that fit the known edges and walls; edges every remaining turn agrees on.
    for (let cell = 0; cell < n; cell++) {
      const before = s.cand[cell]!.length;
      const fits = s.cand[cell]!.filter((m) =>
        DIRS.every((bit, d) => {
          const e = b.edgeOf[cell * 4 + d]!;
          const open = (m & bit) !== 0;
          if (e < 0) return !open;
          const st = s.edge[e]!;
          return st === -1 || (st === 1) === open;
        }),
      );
      if (!fits.length) return false;
      if (fits.length !== before) {
        s.cand[cell] = fits;
        changed = true;
      }
      for (let d = 0; d < 4; d++) {
        const e = b.edgeOf[cell * 4 + d]!;
        if (e < 0 || s.edge[e] !== -1) continue;
        const bit = DIRS[d]!;
        const opens = fits.filter((m) => m & bit).length;
        if (opens === 0) {
          s.edge[e] = 0;
          changed = true;
        } else if (opens === fits.length) {
          s.edge[e] = 1;
          changed = true;
        }
      }
    }
    if (changed) continue;
    // 2. Loops and sealed groups, on the groups of tiles joined by open edges.
    const g = groups(b, s, n);
    const size = new Map<number, number>();
    const exits = new Map<number, number>();
    for (let cell = 0; cell < n; cell++) size.set(g[cell]!, (size.get(g[cell]!) ?? 0) + 1);
    for (let e = 0; e < b.edges; e++) {
      const a = g[b.ends[e * 2]!]!;
      const c = g[b.ends[e * 2 + 1]!]!;
      if (s.edge[e] !== -1) continue;
      if (a === c && b.tree) {
        // A pipe here would close a loop.
        s.edge[e] = 0;
        changed = true;
        continue;
      }
      if (a === c) continue;
      exits.set(a, (exits.get(a) ?? 0) + 1);
      exits.set(c, (exits.get(c) ?? 0) + 1);
    }
    if (changed) continue;
    // A group holding a loop has as many open edges as tiles or more (a tree has one fewer).
    const openIn = new Map<number, number>();
    for (let e = 0; e < b.edges; e++) if (s.edge[e] === 1) openIn.set(g[b.ends[e * 2]!]!, (openIn.get(g[b.ends[e * 2]!]!) ?? 0) + 1);
    if (b.tree) for (const [root, k] of openIn) if (k !== (size.get(root) ?? 0) - 1) return false;
    for (const [root, k] of size) {
      if (k === n) continue;
      const x = exits.get(root) ?? 0;
      if (x === 0) return false;
    }
    if (n > 0 && size.size === 1) return true;
    // 3. Per tile, a turn that would seal its group (with whatever it joins) off from the rest is ruled out.
    for (let cell = 0; cell < n; cell++) {
      const cands = s.cand[cell]!;
      if (cands.length < 2) continue;
      const root = g[cell]!;
      const keep = cands.filter((m) => {
        let merged = size.get(root)!;
        let out = exits.get(root) ?? 0;
        const joined = new Set<number>([root]);
        for (let d = 0; d < 4; d++) {
          const e = b.edgeOf[cell * 4 + d]!;
          if (e < 0 || s.edge[e] !== -1) continue;
          const other = b.ends[e * 2]! === cell ? b.ends[e * 2 + 1]! : b.ends[e * 2]!;
          const og = g[other]!;
          if (m & DIRS[d]!) {
            if (joined.has(og)) {
              if (b.tree) return false; // a loop
              continue;
            }
            joined.add(og);
            merged += size.get(og)!;
            out += (exits.get(og) ?? 0) - 2;
          } else {
            out -= 1;
          }
        }
        return merged === n || out > 0;
      });
      if (!keep.length) return false;
      if (keep.length !== cands.length) {
        s.cand[cell] = keep;
        changed = true;
      }
    }
    if (!changed) return true;
  }
  return true;
}

function start(masks: readonly number[], cols: number, rows: number): { b: Board; s: State } {
  const b = board(cols, rows);
  const openings = masks.reduce((sum, m) => sum + [1, 2, 4, 8].filter((bit) => m & bit).length, 0);
  b.tree = openings === 2 * (cols * rows - 1);
  return { b, s: { cand: masks.map((m) => turnsOf(m)), edge: new Int8Array(b.edges).fill(-1) } };
}

const settled = (s: State) => s.cand.every((c) => c.length === 1);

/**
 * The person-like solver: the board's one layout when the rules alone fix every tile, else null (a person would have
 * to guess, or the board has more than one answer).
 */
export function deducePipes(masks: readonly number[], cols: number, rows: number): number[] | null {
  if (masks.length !== cols * rows) return null;
  const { b, s } = start(masks, cols, rows);
  if (!propagate(b, s) || !settled(s)) return null;
  const out = s.cand.map((c) => c[0]!);
  return validLayout(out, cols, rows) ? out : null;
}

/** How many layouts of the tiles join every pipe with no open end, counting up to `limit`. */
export function countPipesSolutions(masks: readonly number[], cols: number, rows: number, limit = 2): number {
  return pipesSolutions(masks, cols, rows, limit).length;
}

/** Up to `limit` distinct layouts of the tiles that join every pipe with no open end (the searching solver). */
export function pipesSolutions(masks: readonly number[], cols: number, rows: number, limit = 2): number[][] {
  if (masks.length !== cols * rows) return [];
  const { b, s } = start(masks, cols, rows);
  const found: number[][] = [];
  const search = (st: State) => {
    if (found.length >= limit) return;
    if (!propagate(b, st)) return;
    if (settled(st)) {
      const layout = st.cand.map((c) => c[0]!);
      if (validLayout(layout, cols, rows)) found.push(layout);
      return;
    }
    let best = -1;
    for (let cell = 0; cell < st.cand.length; cell++) {
      const k = st.cand[cell]!.length;
      if (k > 1 && (best < 0 || k < st.cand[best]!.length)) best = cell;
    }
    for (const m of st.cand[best]!) {
      const next = clone(st);
      next.cand[best] = [m];
      search(next);
      if (found.length >= limit) return;
    }
  };
  search(s);
  return found;
}

/** A full layout: no open end at a wall or an unmatched neighbour, and every tile in one network. */
export function validLayout(layout: readonly number[], cols: number, rows: number): boolean {
  const n = cols * rows;
  if (layout.length !== n) return false;
  const seen = new Uint8Array(n);
  const stack = [0];
  seen[0] = 1;
  let count = 1;
  for (let cell = 0; cell < n; cell++) {
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    for (const bit of PIPE_BITS) {
      if (!(layout[cell]! & bit)) continue;
      const next = bit === PIPE_N ? (r > 0 ? cell - cols : -1) : bit === PIPE_S ? (r < rows - 1 ? cell + cols : -1) : bit === PIPE_W ? (c > 0 ? cell - 1 : -1) : c < cols - 1 ? cell + 1 : -1;
      if (next < 0 || !(layout[next]! & rotateMask(bit, 2))) return false;
    }
  }
  while (stack.length) {
    const cell = stack.pop()!;
    for (const bit of PIPE_BITS) {
      if (!(layout[cell]! & bit)) continue;
      const next = bit === PIPE_N ? cell - cols : bit === PIPE_S ? cell + cols : bit === PIPE_W ? cell - 1 : cell + 1;
      if (!seen[next]) {
        seen[next] = 1;
        count++;
        stack.push(next);
      }
    }
  }
  return count === n;
}

