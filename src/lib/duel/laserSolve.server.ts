/**
 * Lightbender's two solvers (the Pattern overhaul, levels, 16 Nov 2026). Server-only, pure: no randomness, no clock.
 *
 * Both follow the beam from the emitter exactly as the shared tracer (laser.ts `traceBeam`) does: straight on through
 * empty squares and gems, turned by a mirror, split by a splitter crossed along its marked axis (the first branch
 * followed to its end, then the second), stopped by a wall or the board's edge, ended by a bomb. Each square the beam
 * crosses with nothing on it is decided there and then (a piece put there later would have turned the beam the first
 * time too), so a layout is found exactly once: by the pieces the beam meets.
 *
 *   countLaserSolutions  every piece the tray allows on every square the beam reaches (the exhaustive search): how many
 *                        layouts light every gem without a bomb, with at most `mirrors` mirrors. Lightbender takes any
 *                        such layout, so this is a measure (how open a board is), never a rule.
 *
 *   solveLaserLikeAPerson  the person-like solver (Expert's "humanly possible" proof). A person aims at the gems they
 *                        can see: on the square the beam is crossing they consider a turn only when the new line holds a
 *                        gem still dark, or a square from which one more turn reaches one (one step of "turn here, then
 *                        there", never deeper), never a turn whose line runs into a bomb before any gem, and a splitter
 *                        only where both of its lines do the same. They try the nearest gem first and back up one
 *                        decision at a time. `turns` counts the pieces tried (each a "what if" held in mind); a board is
 *                        humanly solvable when this finds a lighting layout within a level's `humanTurns`.
 */
import { laserStep, reflect, isSplitter } from "./laser";
import { LASER_CELLS, type BeamDir, type MirrorKind, type MirrorPlacement } from "./types";

export interface LaserBoardForSolve {
  source: number;
  dir: BeamDir;
  gems: number[];
  bombs: number[];
  blocks: number[];
  splitters?: number[];
  directionalGems?: { cell: number; from: BeamDir }[];
  /** Mirrors in the tray. */
  mirrors: number;
  splitterPieces?: number;
}

/** The pieces a person may try on one board before giving up (the person-like solver's default budget). */
export const LASER_HUMAN_BUDGET = 1000;

/** Turns a person looks ahead past the one being made: "turn here, then there, then there" (see the head). */
export const LASER_HUMAN_LOOKAHEAD = 2;
const LOOK = LASER_HUMAN_LOOKAHEAD;
const PERP: Record<BeamDir, [BeamDir, BeamDir]> = { U: ["L", "R"], D: ["L", "R"], L: ["U", "D"], R: ["U", "D"] };
/** The mirror that turns a beam heading `from` onto `to`. */
function turnKind(from: BeamDir, to: BeamDir): MirrorKind {
  return reflect(from, "/") === to ? "/" : "\\";
}

interface Search {
  board: LaserBoardForSolve;
  blocked: Uint8Array;
  bomb: Uint8Array;
  gemIndex: Int16Array;
  gemFrom: (BeamDir | null)[];
  fixed: Uint8Array;
  /** 0 undecided, 1 decided empty, 2 a piece (kind in `kind`). */
  state: Uint8Array;
  kind: (MirrorKind | null)[];
  lit: Uint8Array;
  litCount: number;
  seen: Set<number>;
  mirrorsLeft: number;
  splittersLeft: number;
  /** The second branches still to follow (cell, heading). */
  pending: { cell: number; heading: BeamDir }[];
  human: boolean;
  steps: number;
  /** Pieces tried (each turn or split considered on a square: the person's "what ifs"). */
  turns: number;
  budget: number;
  found: MirrorPlacement[][];
  limit: number;
  out: boolean;
  /** The budget ran out (the search is incomplete). */
  spent: boolean;
}

function makeSearch(board: LaserBoardForSolve, human: boolean, budget: number, limit: number): Search {
  const blocked = new Uint8Array(LASER_CELLS);
  for (const c of board.blocks) blocked[c] = 1;
  const bomb = new Uint8Array(LASER_CELLS);
  for (const c of board.bombs) bomb[c] = 1;
  const gemIndex = new Int16Array(LASER_CELLS).fill(-1);
  board.gems.forEach((c, i) => (gemIndex[c] = i));
  const gemFrom: (BeamDir | null)[] = board.gems.map((c) => board.directionalGems?.find((g) => g.cell === c)?.from ?? null);
  const fixed = new Uint8Array(LASER_CELLS);
  for (const c of [board.source, ...board.gems, ...board.bombs, ...board.blocks, ...(board.splitters ?? [])]) fixed[c] = 1;
  return {
    board, blocked, bomb, gemIndex, gemFrom, fixed,
    state: new Uint8Array(LASER_CELLS), kind: Array<MirrorKind | null>(LASER_CELLS).fill(null),
    lit: new Uint8Array(board.gems.length), litCount: 0, seen: new Set(),
    mirrorsLeft: board.mirrors, splittersLeft: board.splitterPieces ?? 0, pending: [],
    human, steps: 0, turns: 0, budget, found: [], limit, out: false, spent: false,
  };
}

function layoutOf(s: Search): MirrorPlacement[] {
  const out: MirrorPlacement[] = [];
  for (let c = 0; c < LASER_CELLS; c++) if (s.state[c] === 2) out.push({ cell: c, kind: s.kind[c]! });
  return out;
}

/** Would a beam at `cell` heading `h` light a dark gem before a bomb, a wall or the edge (pieces turn it, `depth` more
 * turns of its own allowed on undecided squares)? The person's look along a line. */
function lineReaches(s: Search, cell: number, h: BeamDir, depth: number): number {
  let c = cell;
  let heading = h;
  for (let guard = 0; guard < LASER_CELLS; guard++) {
    const next = laserStep(c, heading);
    if (next === null || s.blocked[next]) return -1;
    c = next;
    if (s.bomb[c]) return -1;
    const g = s.gemIndex[c]!;
    if (g >= 0 && !s.lit[g] && (s.gemFrom[g] === null || s.gemFrom[g] === heading)) return guard + 1;
    if (s.state[c] === 2) {
      const k = s.kind[c]!;
      if (isSplitter(k)) return -1;
      heading = reflect(heading, k);
      continue;
    }
    if (depth > 0 && s.state[c] === 0 && !s.fixed[c] && s.mirrorsLeft > 1) {
      for (const turn of PERP[heading]) {
        const d = lineReaches(s, c, turn, depth - 1);
        if (d >= 0) return guard + 1 + d;
      }
    }
  }
  return -1;
}

/** Follows the beam from (cell, heading); calls `done` when every branch has ended. */
function walk(s: Search, cell: number, heading: BeamDir): void {
  if (s.out) return;
  let c = cell;
  let h = heading;
  const lightened: number[] = [];
  const decided: number[] = [];
  const seenAdded: number[] = [];
  const undo = () => {
    for (const g of lightened) { s.lit[g] = 0; s.litCount--; }
    for (const d of decided) s.state[d] = 0;
    for (const k of seenAdded) s.seen.delete(k);
  };
  for (let guard = 0; guard < LASER_CELLS * 4; guard++) {
    const key = c * 4 + "UDLR".indexOf(h);
    if (s.seen.has(key)) break;
    s.seen.add(key); seenAdded.push(key);
    if (s.state[c] === 2 && c !== s.board.source) {
      const k = s.kind[c]!;
      if (!isSplitter(k)) h = reflect(h, k);
    }
    const next = laserStep(c, h);
    if (next === null || s.blocked[next]) break;
    c = next;
    if (s.bomb[c]) { undo(); return; }
    const g = s.gemIndex[c]!;
    if (g >= 0 && !s.lit[g] && (s.gemFrom[g] === null || s.gemFrom[g] === h)) { s.lit[g] = 1; s.litCount++; lightened.push(g); }
    if (s.state[c] === 2) {
      const k = s.kind[c]!;
      if (isSplitter(k)) {
        const vertical = h === "U" || h === "D";
        if ((k === "S|") !== vertical) break;
        s.pending.push({ cell: c, heading: vertical ? "R" : "D" });
        walk(s, c, vertical ? "L" : "U");
        s.pending.pop();
        undo();
        return;
      }
      // A mirror turns the beam on the next loop.
      continue;
    }
    if (s.state[c] === 1 || s.fixed[c]) continue;
    // An undecided square: the choices here, then the beam goes on.
    choose(s, c, h);
    undo();
    return;
  }
  // This branch ended (a wall, the edge or a loop).
  const branch = s.pending.length ? s.pending[s.pending.length - 1]! : null;
  if (branch) {
    const rest = s.pending.pop()!;
    walk(s, rest.cell, rest.heading);
    s.pending.push(rest);
  } else if (s.litCount === s.board.gems.length) {
    s.found.push(layoutOf(s));
    if (s.found.length >= s.limit) s.out = true;
  }
  undo();
}

function place(s: Search, c: number, h: BeamDir, k: MirrorKind): void {
  if (s.out) return;
  s.steps++;
  // The budget counts pieces tried for the person (their "what ifs"), every decision for the exhaustive search.
  if ((s.human ? ++s.turns : (s.turns++, s.steps)) > s.budget) { s.out = true; s.spent = true; return; }
  s.state[c] = 2; s.kind[c] = k;
  if (isSplitter(k)) s.splittersLeft--; else s.mirrorsLeft--;
  // Re-enter the square: the piece turns or splits the beam there.
  if (isSplitter(k)) {
    const vertical = h === "U" || h === "D";
    s.pending.push({ cell: c, heading: vertical ? "R" : "D" });
    walk(s, c, vertical ? "L" : "U");
    s.pending.pop();
  } else walk(s, c, h); // walk turns the beam on the square's new mirror, as the tracer does.
  if (isSplitter(k)) s.splittersLeft++; else s.mirrorsLeft++;
  s.state[c] = 0; s.kind[c] = null;
}

const DIR_INDEX: Record<BeamDir, number> = { U: 0, D: 1, L: 2, R: 3 };
const DIRS: BeamDir[] = ["U", "D", "L", "R"];

/**
 * "Can the beam still get to every dark gem?" From the beam's head here and every branch still to follow, with a piece
 * allowed on any square not yet decided: if some dark gem can't be reached that way, no layout from here lights it, so
 * the search backs up at once (a person's "that gem is cut off now"). Exact as a cut: it never drops a layout that
 * lights every gem.
 */
function gemsStillReachable(s: Search, c: number, h: BeamDir): boolean {
  if (s.litCount === s.board.gems.length) return true;
  const seen = new Uint8Array(LASER_CELLS * 4);
  const reached = new Uint8Array(s.board.gems.length);
  let need = s.board.gems.length - s.litCount;
  const canTurn = s.mirrorsLeft > 0 || s.splittersLeft > 0;
  const stack: number[] = [];
  /** The beam leaves `cell` heading `out`: the square it arrives on. */
  const advance = (cell: number, out: BeamDir) => {
    const next = laserStep(cell, out);
    if (next === null || s.blocked[next] || s.bomb[next]) return;
    const g = s.gemIndex[next]!;
    if (g >= 0 && !s.lit[g] && !reached[g] && (s.gemFrom[g] === null || s.gemFrom[g] === out)) { reached[g] = 1; need--; }
    const key = next * 4 + DIR_INDEX[out];
    if (!seen[key]) { seen[key] = 1; stack.push(key); }
  };
  seen[c * 4 + DIR_INDEX[h]] = 1;
  stack.push(c * 4 + DIR_INDEX[h]);
  for (const p of s.pending) advance(p.cell, p.heading);
  while (stack.length && need > 0) {
    const key = stack.pop()!;
    const cell = key >> 2;
    const heading = DIRS[key & 3]!;
    let outs: readonly BeamDir[];
    if (s.state[cell] === 2 && cell !== s.board.source) {
      const k = s.kind[cell]!;
      if (isSplitter(k)) {
        const vertical = heading === "U" || heading === "D";
        // Crossed along its marked axis a splitter sends both ways; along the other it stops the beam.
        outs = (k === "S|") === vertical ? PERP[heading] : [];
      } else outs = [reflect(heading, k)];
    } else if (s.state[cell] === 0 && !s.fixed[cell] && canTurn) outs = [heading, ...PERP[heading]];
    else outs = [heading];
    for (const out of outs) advance(cell, out);
  }
  return need <= 0;
}

function choose(s: Search, c: number, h: BeamDir): void {
  if (!gemsStillReachable(s, c, h)) return;
  if (s.human) {
    // The person's options here, nearest gem first: go on, or turn either way, or split.
    const options: { d: number; act: () => void }[] = [];
    const straight = lineReaches(s, c, h, LOOK);
    options.push({ d: straight < 0 ? 1e6 : straight, act: () => passOn(s, c, h) });
    if (s.mirrorsLeft > 0) {
      for (const turn of PERP[h]) {
        const d = lineReaches(s, c, turn, LOOK);
        if (d >= 0) options.push({ d, act: () => place(s, c, h, turnKind(h, turn)) });
      }
    }
    if (s.splittersLeft > 0) {
      const [a, b] = PERP[h];
      const da = lineReaches(s, c, a, LOOK);
      const db = lineReaches(s, c, b, LOOK);
      if (da >= 0 && db >= 0) options.push({ d: Math.min(da, db), act: () => place(s, c, h, h === "U" || h === "D" ? "S|" : "S-") });
    }
    options.sort((x, y) => x.d - y.d);
    for (const o of options) { if (s.out) return; o.act(); }
    return;
  }
  passOn(s, c, h);
  if (s.mirrorsLeft > 0) for (const turn of PERP[h]) place(s, c, h, turnKind(h, turn));
  if (s.splittersLeft > 0) place(s, c, h, h === "U" || h === "D" ? "S|" : "S-");
}

function passOn(s: Search, c: number, h: BeamDir): void {
  if (s.out) return;
  if (++s.steps > s.budget && !s.human) { s.out = true; s.spent = true; return; }
  s.state[c] = 1;
  // Decided empty: carry on from this square in the same heading.
  walk(s, c, h);
  s.state[c] = 0;
}

export interface LaserCount {
  /** Lighting layouts found (stops at `limit`). */
  solutions: number;
  /** The search ran to its end (false: the budget ran out first). */
  complete: boolean;
  steps: number;
  layouts: MirrorPlacement[][];
}

/** Every lighting layout with at most `board.mirrors` mirrors and the tray's splitters (stops at `limit`). */
export function countLaserSolutions(board: LaserBoardForSolve, limit = 2, budget = 2_000_000): LaserCount {
  const s = makeSearch(board, false, budget, limit);
  walk(s, board.source, board.dir);
  return { solutions: s.found.length, complete: !s.spent, steps: s.steps, layouts: s.found };
}

export interface LaserHumanResult {
  solved: boolean;
  /** The decisions tried before the layout was found (or the budget ran out). */
  steps: number;
  turns: number;
  layout: MirrorPlacement[] | null;
}

/** The person-like solver (see the file's head). */
export function solveLaserLikeAPerson(board: LaserBoardForSolve, budget = LASER_HUMAN_BUDGET): LaserHumanResult {
  const s = makeSearch(board, true, budget, 1);
  walk(s, board.source, board.dir);
  const layout = s.found[0] ?? null;
  return { solved: layout !== null, steps: s.steps, turns: s.turns, layout };
}
