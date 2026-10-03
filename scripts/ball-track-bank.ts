/**
 * Ball Track bank: 400 answer-first courses.
 *   bun scripts/ball-track-bank.ts
 * Builds a snaking tube tree from the entry above column 4 with branches at
 * rotatable tiles, puts the five trays under five exit columns, then proves
 * every ball can be routed home from the previous ball's state in at most four
 * rotations, and plays that playbook through the real sim (8/8 home).
 */
import { writeFileSync } from "node:fs";
import { encodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  btRoute,
  exitSide,
  makeBallTrackGame,
  opposite,
  rotMask,
  stepFrom,
  BT_BALLS,
  BT_COLOURS,
  BT_COLS,
  BT_DROP_TICKS,
  BT_HOPPER_COL,
  BT_K_ROTATE,
  BT_PIPE_MASKS,
  BT_ROWS,
  N,
  E,
  S,
  W,
  type BtCourse,
  type BtTile,
} from "../src/lib/arcade/ballTrack";

const TARGET = 400;
const MAX_TAPS = 4;
const MAX_ROUTE = 25; // a routed ball lands before the next one drops

let seed = 0x5eed_ba11;
const rnd = (n: number) => {
  seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
  return (seed ^ (seed >>> 13)) % n;
};
const shuffle = <T,>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
};
const CELLS = BT_COLS * BT_ROWS;
const rowOf = (c: number) => Math.floor(c / BT_COLS);

interface Node { parent: number; children: number[] } // sides
/** A downward-ish walk from `start` (entered via `inlet`) to the bottom edge avoiding `used`; no upward moves. */
function walk(start: number, inlet: number, used: Map<number, Node>, exits: Set<number>): Map<number, Node> | null {
  const path = new Map<number, Node>();
  let cell = start, entry = inlet;
  for (let guard = 0; guard < 40; guard++) {
    if (used.has(cell) || path.has(cell)) return null;
    const node: Node = { parent: entry, children: [] };
    path.set(cell, node);
    const r = rowOf(cell), c = cell % BT_COLS;
    const options: number[] = [];
    if (r === BT_ROWS - 1) {
      if (!exits.has(c)) options.push(S, S, S);
    } else options.push(S, S);
    if (entry !== E && c < BT_COLS - 1 && !used.has(cell + 1) && !path.has(cell + 1)) options.push(E, E);
    if (entry !== W && c > 0 && !used.has(cell - 1) && !path.has(cell - 1)) options.push(W, W);
    if (!options.length) return null;
    const out = options[rnd(options.length)]!;
    node.children.push(out);
    const next = stepFrom(cell, out);
    if (next >= 100) return path;
    if (next < 0) return null;
    cell = next;
    entry = opposite(out);
  }
  return null;
}

/** Shapes whose rotations connect `parent` to every child (by the sim's exit rule). */
function shapesFor(parent: number, children: number[]) {
  const ok: number[] = [];
  for (let shape = 0; shape < 3; shape++) {
    const reach = new Set<number>();
    for (let rot = 0; rot < 4; rot++) reach.add(exitSide(rotMask(BT_PIPE_MASKS[shape]!, rot), parent));
    if (children.every((c) => reach.has(c))) ok.push(shape);
  }
  return ok;
}
const fixedTile = (parent: number, child: number): BtTile => {
  for (let shape = 0; shape < 2; shape++)
    for (let rot = 0; rot < 4; rot++) {
      const m = rotMask(BT_PIPE_MASKS[shape]!, rot);
      if (m === (parent | child)) return { shape, rot };
    }
  throw Error("no tile");
};

function buildTree() {
  const tree = new Map<number, Node>();
  const exits = new Set<number>();
  const exitOf = (p: Map<number, Node>) => {
    for (const [cell, n] of p) if (rowOf(cell) === BT_ROWS - 1 && n.children.includes(S)) return cell % BT_COLS;
    return -1;
  };
  const main = walk(BT_HOPPER_COL, N, tree, exits);
  if (!main) return null;
  // The main track should snake: at least 14 tiles.
  if (main.size < 14) return null;
  for (const [k, v] of main) tree.set(k, v);
  exits.add(exitOf(main));
  const rotatable = new Set<number>();
  for (let r = 0; r < BT_ROWS - 1; r++) rotatable.add(r * BT_COLS + BT_HOPPER_COL);
  let extras = 0;
  const extraCap = 4 + rnd(3);
  for (let attempt = 0; attempt < 400 && exits.size < 5; attempt++) {
    const cells = [...tree.keys()].filter((c) => rowOf(c) < BT_ROWS - 1);
    const at = cells[rnd(cells.length)]!;
    const isExtra = !rotatable.has(at);
    if (isExtra && extras >= extraCap) continue;
    const node = tree.get(at)!;
    const side = [E, W, S][rnd(3)]!;
    if (side === node.parent || node.children.includes(side)) continue;
    if (!shapesFor(node.parent, [...node.children, side]).length) continue;
    const next = stepFrom(at, side);
    if (next < 0 || next >= 100) continue;
    const branch = walk(next, opposite(side), tree, exits);
    if (!branch) continue;
    const col = exitOf(branch);
    if (col < 0 || exits.has(col)) continue;
    for (const [k, v] of branch) tree.set(k, v);
    node.children.push(side);
    exits.add(col);
    if (isExtra) { rotatable.add(at); extras++; }
  }
  if (exits.size < 5) return null;
  // Pad to 4–6 off-centre rotatables with tree tiles on rows 1–6 (indices 0–5).
  const pad = shuffle([...tree.keys()].filter((c) => rowOf(c) < BT_ROWS - 1 && !rotatable.has(c)));
  while (extras < 4 && pad.length) { rotatable.add(pad.pop()!); extras++; }
  if (extras < 4 || extras > 6) return null;
  return { tree, exits, rotatable };
}

function makeCourse(): BtCourse | null {
  const built = buildTree();
  if (!built) return null;
  const { tree, exits, rotatable } = built;
  const tiles: BtTile[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const node = tree.get(cell);
    if (!node) tiles.push({ shape: rnd(3), rot: rnd(4) });
    else if (rotatable.has(cell)) {
      const shapes = shapesFor(node.parent, node.children);
      if (!shapes.length) return null;
      tiles.push({ shape: shapes[rnd(shapes.length)]!, rot: 0 });
    } else tiles.push(fixedTile(node.parent, node.children[0]!));
  }
  const trayCols = shuffle([...exits]).slice(0, 5);
  const colours = shuffle([0, 1, 2, 3, 4]);
  const trays = Array.from({ length: BT_COLS }, () => -1);
  trayCols.forEach((c, i) => (trays[c] = colours[i]!));
  const balls: number[] = [];
  while (balls.length < BT_BALLS) {
    const c = rnd(BT_COLOURS);
    const n = balls.length;
    if (n >= 2 && balls[n - 1] === c && balls[n - 2] === c) continue;
    balls.push(c);
  }
  for (const cell of rotatable) tiles[cell]!.rot = rnd(4); // scramble
  return { trays, balls, tiles, rotatable: [...rotatable].sort((a, b) => a - b) };
}

/** Fewest taps (≤ MAX_TAPS) from `rots` that route a ball into column `col`. */
function solveBall(course: BtCourse, rots: number[], col: number): { rots: number[]; taps: number[] } | null {
  const R = course.rotatable;
  const key = (r: number[]) => R.map((c) => r[c]).join("");
  let frontier = [{ rots, taps: [] as number[] }];
  const seen = new Set([key(rots)]);
  for (let depth = 0; depth <= MAX_TAPS; depth++) {
    for (const f of frontier) {
      const route = btRoute(course, f.rots);
      if (route.col === col && route.steps <= MAX_ROUTE) return f;
    }
    if (depth === MAX_TAPS) break;
    const next: typeof frontier = [];
    for (const f of frontier)
      for (const cell of R) {
        const r = [...f.rots];
        r[cell] = (r[cell]! + 1) & 3;
        const k = key(r);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ rots: r, taps: [...f.taps, cell] });
      }
    frontier = next;
  }
  return null;
}

function prove(course: BtCourse) {
  let rots = course.tiles.map((t) => t.rot);
  const plan: number[][] = [];
  for (const colour of course.balls) {
    const col = course.trays.indexOf(colour);
    const step = solveBall(course, rots, col);
    if (!step) return null;
    plan.push(step.taps);
    rots = step.rots;
  }
  return plan;
}

/** Plays the plan through the real sim: ball i's taps go in right after ball i−1 lands. */
export function playPlan(course: BtCourse, plan: number[][]) {
  const game = makeBallTrackGame(course);
  let state = game.init(1);
  const log: ArcadeInputEvent[] = [];
  let ball = 0, queue = [...plan[0]!], resolved = 0;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    const done = state.home + state.wrong + state.lost;
    if (done > resolved) {
      resolved = done;
      ball++;
      queue = [...(plan[ball] ?? [])];
    }
    const cell = queue[0];
    if (cell !== undefined && ball >= 0) {
      queue.shift();
      recordInput(log, { k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0, t }, game.inputRanges);
    }
    state = game.step(state, inputAt(log, t));
  }
  return { state, log };
}

if (import.meta.main) {
  const entries: { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }[] = [];
  let tries = 0;
  while (entries.length < TARGET) {
    tries++;
    const course = makeCourse();
    if (!course) continue;
    const plan = prove(course);
    if (!plan) continue;
    const par = plan.reduce((n, p) => n + p.length, 0);
    if (par < 8 || plan[0]!.length === 0) continue; // scrambled start must need work
    const run = playPlan(course, plan);
    if (run.state.home !== BT_BALLS || run.state.actions !== par) continue;
    if (run.log.some((e) => e.t >= BT_DROP_TICKS * BT_BALLS)) continue;
    entries.push({ course, tier: par < 12 ? 1 : par < 16 ? 2 : 3, par, endTick: run.state.lastLand, playbook: encodeInputEvents(run.log) });
  }
  writeFileSync(
    "src/lib/duel/ballTrackBank.server.ts",
    `/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport interface BallTrackBankEntry { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
  );
  const tiers = [1, 2, 3].map((t) => entries.filter((e) => e.tier === t).length);
  console.log(`ball track bank: ${entries.length} courses from ${tries} tries · tiers ${tiers.join("/")}`);
}
