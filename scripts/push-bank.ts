/**
 * Builds the curated Push bank in src/lib/duel/pushBank.server.ts.
 *
 * Layouts are grown backwards from the solved position by "pulling" crates, so
 * every entry is solvable and its depth in that breadth-first search IS the
 * minimum push count. Only hard layouts are kept: 16–30 pushes, every crate
 * pushed at least three times, and at least one crate taken away from its own
 * final target somewhere in the optimal solution (the detour rule). The stored
 * solution is then replayed and confirmed.
 *
 *   bun scripts/push-bank.ts
 */

import { writeFileSync } from "node:fs";

import {
  PUSH_BANK_SIZE,
  PUSH_CELLS,
  PUSH_COLS as N,
  PUSH_MAX_CRATES,
  PUSH_MAX_PUSHES,
  PUSH_MIN_CRATES,
  PUSH_MIN_MOVES_PER_CRATE,
  PUSH_MIN_PUSHES,
  type SlideDir,
} from "../src/lib/duel/types";

const DIRS: SlideDir[] = ["U", "D", "L", "R"];
const DELTA: Record<SlideDir, number> = { U: -N, D: N, L: -1, R: 1 };
const OPPOSITE: Record<SlideDir, SlideDir> = { U: "D", D: "U", L: "R", R: "L" };
/** How many backward states one layout may explore before it is abandoned. */
const NODE_CAP = 250_000;

interface Entry {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  minPushes: number;
  minMoves: number;
  detour: boolean;
  solution: string;
}

function row(cell: number) {
  return Math.floor(cell / N);
}
function col(cell: number) {
  return cell % N;
}

/** In-grid neighbour, refusing wrap-around at the edges. */
function step(cell: number, dir: SlideDir): number | null {
  if (dir === "U") return row(cell) > 0 ? cell + DELTA.U : null;
  if (dir === "D") return row(cell) < N - 1 ? cell + DELTA.D : null;
  if (dir === "L") return col(cell) > 0 ? cell + DELTA.L : null;
  return col(cell) < N - 1 ? cell + DELTA.R : null;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Every cell the pusher can walk to, crates blocking the way. */
function region(walls: Set<number>, crates: number[], from: number): number[] {
  const blocked = new Set(crates);
  const seen = new Set<number>([from]);
  const stack = [from];
  while (stack.length) {
    const cell = stack.pop()!;
    for (const dir of DIRS) {
      const next = step(cell, dir);
      if (next === null || walls.has(next) || blocked.has(next) || seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/** Fewest pusher steps between two cells, crates in the way. */
function walkDistance(
  walls: Set<number>,
  crates: number[],
  from: number,
  to: number,
): number | null {
  if (from === to) return 0;
  const blocked = new Set(crates);
  const seen = new Set<number>([from]);
  let frontier = [from];
  for (let depth = 1; depth <= PUSH_CELLS; depth++) {
    const next: number[] = [];
    for (const cell of frontier) {
      for (const dir of DIRS) {
        const ahead = step(cell, dir);
        if (ahead === null || walls.has(ahead) || blocked.has(ahead) || seen.has(ahead)) continue;
        if (ahead === to) return depth;
        seen.add(ahead);
        next.push(ahead);
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

function key(crates: number[], regionCells: number[]): string {
  return `${[...crates].sort((a, b) => a - b).join(",")}|${regionCells[0]}`;
}

interface Node {
  crates: number[];
  pusher: number;
  depth: number;
  /** The forward push that leads from this state towards the solved one. */
  push?: { cell: number; dir: SlideDir };
  parent?: string;
}

/** Backward search from the solved position, pulling crates one cell at a time. */
function backwardSearch(walls: Set<number>, targets: number[], maxDepth: number) {
  const nodes = new Map<string, Node>();
  let frontier: string[] = [];

  // Every distinct pusher region around the solved crate layout is a root.
  for (let cell = 0; cell < PUSH_CELLS; cell++) {
    if (walls.has(cell) || targets.includes(cell)) continue;
    const reach = region(walls, targets, cell);
    const id = key(targets, reach);
    if (nodes.has(id)) continue;
    nodes.set(id, { crates: [...targets], pusher: reach[0]!, depth: 0 });
    frontier.push(id);
  }

  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = nodes.get(id)!;
      const reach = new Set(region(walls, node.crates, node.pusher));
      for (let index = 0; index < node.crates.length; index++) {
        const crate = node.crates[index]!;
        for (const dir of DIRS) {
          // Undo a push that moved a crate in `dir` onto its current cell.
          const back = step(crate, OPPOSITE[dir]);
          if (back === null || walls.has(back) || node.crates.includes(back)) continue;
          if (!reach.has(back)) continue;
          const pusherCell = step(back, OPPOSITE[dir]);
          if (pusherCell === null || walls.has(pusherCell)) continue;
          const crates = [...node.crates];
          crates[index] = back;
          if (crates.includes(pusherCell)) continue;
          const reachPre = region(walls, crates, pusherCell);
          const preId = key(crates, reachPre);
          if (nodes.has(preId)) continue;
          nodes.set(preId, {
            crates,
            pusher: reachPre[0]!,
            depth,
            push: { cell: back, dir },
            parent: id,
          });
          next.push(preId);
        }
      }
    }
    // Whole levels only, so every depth already recorded is exact.
    if (nodes.size > NODE_CAP) return nodes;
    frontier = next;
  }

  return nodes;
}

/** Replays a stored push list, checking the pusher could reach each side. */
function replaySolution(
  walls: Set<number>,
  targets: number[],
  startCrates: number[],
  startPusher: number,
  solution: { cell: number; dir: SlideDir }[],
): { ok: boolean; moves: number } {
  let crates = [...startCrates];
  let pusher = startPusher;
  let moves = 0;
  for (const move of solution) {
    const index = crates.indexOf(move.cell);
    if (index === -1) return { ok: false, moves };
    const from = step(move.cell, OPPOSITE[move.dir]);
    const to = step(move.cell, move.dir);
    if (from === null || to === null) return { ok: false, moves };
    if (walls.has(from) || walls.has(to)) return { ok: false, moves };
    if (crates.includes(to)) return { ok: false, moves };
    const walk = walkDistance(walls, crates, pusher, from);
    if (walk === null) return { ok: false, moves };
    moves += walk + 1;
    crates = [...crates];
    crates[index] = to;
    pusher = move.cell;
  }
  const ok = crates.every((cell) => targets.includes(cell)) && crates.length === targets.length;
  return { ok, moves };
}

function interior(): number[] {
  const cells: number[] = [];
  for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) cells.push(r * N + c);
  return cells;
}

function randomLayout() {
  const floor = interior();
  const wallCount = 5 + Math.floor(Math.random() * 8);
  const inner = shuffle(floor).slice(0, wallCount);
  const walls = new Set<number>();
  for (let cell = 0; cell < PUSH_CELLS; cell++) {
    const r = row(cell);
    const c = col(cell);
    if (r === 0 || c === 0 || r === N - 1 || c === N - 1) walls.add(cell);
  }
  for (const cell of inner) walls.add(cell);

  const open = floor.filter((cell) => !walls.has(cell));
  const crateCount =
    PUSH_MIN_CRATES + Math.floor(Math.random() * (PUSH_MAX_CRATES - PUSH_MIN_CRATES + 1));
  const targets = shuffle(open).slice(0, crateCount);
  if (targets.length < crateCount) return null;
  return { walls, targets };
}

/** How many pushes each crate takes over the whole solution. */
function pushesPerCrate(startCrates: number[], solution: { cell: number; dir: SlideDir }[]) {
  const crates = [...startCrates];
  const counts = new Array<number>(startCrates.length).fill(0);
  for (const move of solution) {
    const index = crates.indexOf(move.cell);
    const to = step(move.cell, move.dir);
    if (index === -1 || to === null) return null;
    crates[index] = to;
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

function distance(a: number, b: number) {
  return Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b));
}

/**
 * The detour rule: somewhere in the optimal solution a crate is pushed further
 * away from the target it ends on, so the route is never a straight shove.
 */
function hasDetour(startCrates: number[], solution: { cell: number; dir: SlideDir }[]): boolean {
  const crates = [...startCrates];
  const finals = [...startCrates];
  for (const move of solution) {
    const index = finals.indexOf(move.cell);
    const to = step(move.cell, move.dir);
    if (index === -1 || to === null) return false;
    finals[index] = to;
  }
  for (const move of solution) {
    const index = crates.indexOf(move.cell);
    const to = step(move.cell, move.dir);
    if (index === -1 || to === null) return false;
    const home = finals[index]!;
    if (distance(to, home) > distance(move.cell, home)) return true;
    crates[index] = to;
  }
  return false;
}

const bank: Entry[] = [];
const seen = new Set<string>();
let guard = 0;
const startedAt = Date.now();

while (bank.length < PUSH_BANK_SIZE && guard < 200_000) {
  guard += 1;
  const layout = randomLayout();
  if (!layout) continue;
  const { walls, targets } = layout;
  const nodes = backwardSearch(walls, targets, PUSH_MAX_PUSHES);
  const candidates = shuffle(
    [...nodes.entries()].filter(
      ([, node]) => node.depth >= PUSH_MIN_PUSHES && node.depth <= PUSH_MAX_PUSHES,
    ),
  ).slice(0, 40);
  if (!candidates.length) continue;

  for (const [id, node] of candidates) {
    if (bank.length >= PUSH_BANK_SIZE) break;
    // No crate may start on a target, and the pusher must stand on free floor.
    if (node.crates.some((cell) => targets.includes(cell))) continue;
    if (node.crates.includes(node.pusher)) continue;

    // Walk the parent chain to collect the forward pushes.
    const solution: { cell: number; dir: SlideDir }[] = [];
    let cursor: string | undefined = id;
    while (cursor) {
      const current: Node | undefined = nodes.get(cursor);
      if (!current?.push) break;
      solution.push(current.push);
      cursor = current.parent;
    }
    if (solution.length !== node.depth) continue;

    // Every crate has to be a real part of the puzzle, not scenery.
    const counts = pushesPerCrate(node.crates, solution);
    if (!counts) continue;
    if (counts.some((count) => count < PUSH_MIN_MOVES_PER_CRATE)) continue;
    if (!hasDetour(node.crates, solution)) continue;

    const replay = replaySolution(walls, targets, node.crates, node.pusher, solution);
    if (!replay.ok) continue;

    const wallList = [...walls].sort((a, b) => a - b);
    const fingerprint = `${wallList.join(".")}/${[...targets].sort((a, b) => a - b).join(".")}/${[...node.crates].sort((a, b) => a - b).join(".")}/${node.pusher}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    bank.push({
      walls: wallList,
      targets: [...targets].sort((a, b) => a - b),
      crates: [...node.crates].sort((a, b) => a - b),
      pusher: node.pusher,
      minPushes: node.depth,
      minMoves: replay.moves,
      detour: true,
      solution: solution.map((move) => `${move.cell}:${move.dir}`).join(","),
    });
    if (bank.length % 10 === 0) {
      console.log(`  ${bank.length} / ${PUSH_BANK_SIZE}  (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    }
    // Two entries per layout at most, so the bank stays varied.
    if (bank.filter((entry) => entry.walls.join(".") === wallList.join(".")).length >= 2) break;
  }
}

if (bank.length < PUSH_BANK_SIZE) {
  throw new Error(`Only found ${bank.length} layouts of ${PUSH_BANK_SIZE}`);
}

const lines = bank
  .map(
    (entry) =>
      `  { walls: [${entry.walls.join(",")}], targets: [${entry.targets.join(",")}], crates: [${entry.crates.join(",")}], pusher: ${entry.pusher}, minPushes: ${entry.minPushes}, minMoves: ${entry.minMoves}, detour: ${entry.detour}, solution: "${entry.solution}" },`,
  )
  .join("\n");

const file = `/**
 * Curated Push layouts. Generated by scripts/push-bank.ts — every entry was
 * grown backwards from its solved position, so its depth is the exact minimum
 * push count; every crate is pushed at least three times, and every optimal
 * solution takes a crate away from its own target at some point. Do not edit
 * by hand.
 */

export interface PushBankEntry {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  minPushes: number;
  minMoves: number;
  detour: boolean;
  solution: string;
}

export const PUSH_BANK: PushBankEntry[] = [
${lines}
];
`;

writeFileSync("src/lib/duel/pushBank.server.ts", file);
console.log(`${bank.length} layouts written`);
const mins = bank.map((entry) => entry.minPushes);
console.log(`  minimum pushes ${Math.min(...mins)}–${Math.max(...mins)}`);
