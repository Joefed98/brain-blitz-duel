/**
 * Builds the curated Push bank in src/lib/duel/pushBank.server.ts.
 *
 * Layouts are grown backwards from the solved position by "pulling" crates, so
 * every entry is solvable. The minimum push count from that backward search is
 * then confirmed by an independent forward search, and the stored solution is
 * replayed before the entry is accepted.
 *
 *   bun scripts/push-bank.ts
 */

import { writeFileSync } from "node:fs";

import { PUSH_CELLS, PUSH_COLS as N, type SlideDir } from "../src/lib/duel/types";

const DIRS: SlideDir[] = ["U", "D", "L", "R"];
const DELTA: Record<SlideDir, number> = { U: -N, D: N, L: -1, R: 1 };

const BUCKETS = [
  { min: 4, max: 8, count: 30 },
  { min: 9, max: 14, count: 30 },
  { min: 15, max: 20, count: 30 },
];

interface Entry {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  minPushes: number;
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
          const back = step(crate, dir === "U" ? "D" : dir === "D" ? "U" : dir === "L" ? "R" : "L");
          if (back === null || walls.has(back) || node.crates.includes(back)) continue;
          if (!reach.has(back)) continue;
          const pusherCell = step(
            back,
            dir === "U" ? "D" : dir === "D" ? "U" : dir === "L" ? "R" : "L",
          );
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
    frontier = next;
  }

  return nodes;
}

/** Independent forward check of the minimum push count. */
function forwardMinPushes(
  walls: Set<number>,
  targets: number[],
  crates: number[],
  pusher: number,
  cap: number,
): number | null {
  const solved = (cells: number[]) => cells.every((cell) => targets.includes(cell));
  if (solved(crates)) return 0;
  const seen = new Set<string>();
  let frontier = [{ crates, pusher }];
  seen.add(key(crates, region(walls, crates, pusher)));

  for (let depth = 1; depth <= cap; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const reach = region(walls, node.crates, node.pusher);
      const reachable = new Set(reach);
      for (let index = 0; index < node.crates.length; index++) {
        const crate = node.crates[index]!;
        for (const dir of DIRS) {
          const from = step(crate, dir === "U" ? "D" : dir === "D" ? "U" : dir === "L" ? "R" : "L");
          const to = step(crate, dir);
          if (from === null || to === null) continue;
          if (!reachable.has(from)) continue;
          if (walls.has(to) || node.crates.includes(to)) continue;
          const moved = [...node.crates];
          moved[index] = to;
          if (solved(moved)) return depth;
          const id = key(moved, region(walls, moved, crate));
          if (seen.has(id)) continue;
          seen.add(id);
          next.push({ crates: moved, pusher: crate });
        }
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

/** Replays a stored push list, checking the pusher could reach each side. */
function replaySolution(
  walls: Set<number>,
  targets: number[],
  startCrates: number[],
  startPusher: number,
  solution: { cell: number; dir: SlideDir }[],
): boolean {
  let crates = [...startCrates];
  let pusher = startPusher;
  for (const move of solution) {
    const index = crates.indexOf(move.cell);
    if (index === -1) return false;
    const from = step(
      move.cell,
      move.dir === "U" ? "D" : move.dir === "D" ? "U" : move.dir === "L" ? "R" : "L",
    );
    const to = step(move.cell, move.dir);
    if (from === null || to === null) return false;
    if (walls.has(from) || walls.has(to)) return false;
    if (crates.includes(to)) return false;
    if (!region(walls, crates, pusher).includes(from)) return false;
    crates = [...crates];
    crates[index] = to;
    pusher = move.cell;
  }
  return crates.every((cell) => targets.includes(cell)) && crates.length === targets.length;
}

function interior(): number[] {
  const cells: number[] = [];
  for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) cells.push(r * N + c);
  return cells;
}

function randomLayout() {
  const floor = interior();
  const wallCount = 2 + Math.floor(Math.random() * 4);
  const shuffled = shuffle(floor);
  const inner = shuffled.slice(0, wallCount);
  const walls = new Set<number>();
  for (let cell = 0; cell < PUSH_CELLS; cell++) {
    const r = row(cell);
    const c = col(cell);
    if (r === 0 || c === 0 || r === N - 1 || c === N - 1) walls.add(cell);
  }
  for (const cell of inner) walls.add(cell);

  const open = floor.filter((cell) => !walls.has(cell));
  const crateCount = Math.random() < 0.5 ? 2 : 3;
  const targets = shuffle(open).slice(0, crateCount);
  if (targets.length < crateCount) return null;
  return { walls, targets };
}

const bank: Entry[] = [];
const seen = new Set<string>();

for (const bucket of BUCKETS) {
  let found = 0;
  let guard = 0;
  while (found < bucket.count && guard < 60_000) {
    guard += 1;
    const layout = randomLayout();
    if (!layout) continue;
    const { walls, targets } = layout;
    const nodes = backwardSearch(walls, targets, bucket.max);
    const candidates = [...nodes.entries()].filter(
      ([, node]) => node.depth >= bucket.min && node.depth <= bucket.max,
    );
    if (!candidates.length) continue;
    const [id, node] = shuffle(candidates)[0]!;

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
    if (!replaySolution(walls, targets, node.crates, node.pusher, solution)) continue;

    const forward = forwardMinPushes(walls, targets, node.crates, node.pusher, bucket.max + 2);
    if (forward !== node.depth) continue;

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
      solution: solution.map((move) => `${move.cell}:${move.dir}`).join(","),
    });
    found += 1;
  }
  if (found < bucket.count) {
    throw new Error(`Only found ${found} layouts for depth ${bucket.min}-${bucket.max}`);
  }
}

const lines = bank
  .map(
    (entry) =>
      `  { walls: [${entry.walls.join(",")}], targets: [${entry.targets.join(",")}], crates: [${entry.crates.join(",")}], pusher: ${entry.pusher}, minPushes: ${entry.minPushes}, solution: "${entry.solution}" },`,
  )
  .join("\n");

const file = `/**
 * Curated Push layouts. Generated by scripts/push-bank.ts — every entry was
 * grown backwards from its solved position and its minimum push count was
 * confirmed by an independent forward search. Do not edit by hand.
 */

export interface PushBankEntry {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  minPushes: number;
  solution: string;
}

export const PUSH_BANK: PushBankEntry[] = [
${lines}
];
`;

writeFileSync("src/lib/duel/pushBank.server.ts", file);
console.log(`${bank.length} layouts written`);
for (const bucket of BUCKETS) {
  const count = bank.filter((e) => e.minPushes >= bucket.min && e.minPushes <= bucket.max).length;
  console.log(`  depth ${bucket.min}-${bucket.max}: ${count}`);
}
