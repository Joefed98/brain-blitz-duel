/**
 * Ball Track bank: 400 courses over the fixed serpentine.
 *   bun scripts/ball-track-bank.ts
 * Seeds only tray order, ball order and 3–5 extra fixed straights. Every tray
 * must be reachable from the all-horizontal start, and a just-in-time playbook
 * (each tile set for the next ball due through it) must route every ball home in the
 * real sim; seeds that fail are rerolled.
 */
import { writeFileSync } from "node:fs";
import { encodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  btNext,
  btRotatable,
  makeBallTrackGame,
  BT_ALWAYS_FIXED,
  BT_BALLS,
  BT_COLOURS,
  BT_COLS,
  BT_HOPPER_COL,
  BT_KIND,
  BT_K_ROTATE,
  BT_ROWS,
  type BtCourse,
} from "../src/lib/arcade/ballTrack";

const TARGET = 400;

let seed = 0x5eed_ba11;
const rnd = (n: number) => {
  seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
  return ((seed ^ (seed >>> 13)) >>> 0) % n;
};
const shuffle = <T,>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
};

/** Shortest route into column `col`: visited cells with the vertical state each needs (-1 for corners). */
export function routeTo(course: BtCourse, col: number): { cell: number; vert: number }[] | null {
  const rot = new Set(btRotatable(course));
  type Q = { cell: number; above: boolean; path: { cell: number; vert: number }[] };
  const queue: Q[] = [{ cell: BT_HOPPER_COL, above: true, path: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const q = queue.shift()!;
    const key = `${q.cell}|${q.above}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const options = BT_KIND[q.cell] === 2 ? [-1] : rot.has(q.cell) ? [0, 1] : [0];
    for (const v of options) {
      const next = btNext(q.cell, q.above, v === 1);
      const path = [...q.path, { cell: q.cell, vert: v }];
      if (next.cell >= 100) { if (next.cell - 100 === col) return path; continue; }
      if (next.cell < 0) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, path });
    }
  }
  return null;
}

function makeCourse(): BtCourse {
  const cols = shuffle([0, 1, 2, 3, 4, 5, 6]);
  const colours = shuffle([0, 1, 2, 3, 4]);
  const trays = Array.from({ length: BT_COLS }, () => -1);
  colours.forEach((c, i) => (trays[cols[i]!] = c));
  const balls = shuffle(Array.from({ length: BT_BALLS }, (_, i) => i % BT_COLOURS));
  const pool = shuffle(BT_KIND.flatMap((k, cell) => (k === 1 && cell < (BT_ROWS - 1) * BT_COLS && !BT_ALWAYS_FIXED.includes(cell) ? [cell] : [])));
  const fixed = pool.slice(0, 3 + rnd(3)).sort((a, b) => a - b);
  return { trays, balls, fixed };
}

/** Just-in-time playbook: each tick toggle the mismatched tile whose next ball is closest to it. */
export function playRoutes(course: BtCourse, routes: { cell: number; vert: number }[][]) {
  const game = makeBallTrackGame(course);
  let state = game.init(1);
  const log: ArcadeInputEvent[] = [];
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    // Progress of each ball along its route (index of the tile it's in; -1 hopper/undropped).
    const progress = routes.map((_, id) => {
      const b = state.balls.find((x) => x.id === id);
      if (b) return b.cell >= 100 ? Infinity : b.steps - 1;
      return id < state.next ? Infinity : -1;
    });
    let best: { cell: number; dist: number } | null = null;
    const claimed = new Set<number>();
    for (let id = 0; id < routes.length; id++) {
      const route = routes[id]!;
      for (let i = Math.max(0, progress[id]! + 1); i < route.length; i++) {
        const step = route[i]!;
        if (step.vert < 0 || claimed.has(step.cell)) continue;
        claimed.add(step.cell);
        if (state.vert[step.cell] === step.vert || state.balls.some((b) => b.cell === step.cell)) continue;
        const dist = (id - state.next) * 1000 + i - progress[id]!;
        if (!best || dist < best.dist) best = { cell: step.cell, dist };
      }
      // A tile whose state was already used by this ball's earlier steps is still claimed by it.
      for (let i = 0; i <= progress[id]! && i < route.length; i++) if (state.balls.some((b) => b.id === id && b.cell === route[i]!.cell)) claimed.add(route[i]!.cell);
    }
    if (best) recordInput(log, { k: BT_K_ROTATE, a: best.cell, b: 0, c: 0, d: 0, t }, game.inputRanges);
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
    if (!course.trays.every((tray, col) => tray < 0 || routeTo(course, col))) continue;
    const routes = course.balls.map((c) => routeTo(course, course.trays.indexOf(c))!);
    const run = playRoutes(course, routes);
    if (run.state.home !== BT_BALLS) continue;
    const par = run.state.actions;
    entries.push({ course, tier: par < 20 ? 1 : par < 30 ? 2 : 3, par, endTick: run.state.lastLand, playbook: encodeInputEvents(run.log) });
  }
  writeFileSync(
    "src/lib/duel/ballTrackBank.server.ts",
    `/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport interface BallTrackBankEntry { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
  );
  const tiers = [1, 2, 3].map((t) => entries.filter((e) => e.tier === t).length);
  console.log(`ball track bank: ${entries.length} courses from ${tries} tries · tiers ${tiers.join("/")}`);
}
