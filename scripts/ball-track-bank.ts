/**
 * Ball Track bank: 400 courses over the fixed serpentine.
 *   bun scripts/ball-track-bank.ts
 * Seeds only tray order, ball order and 8–10 upper fixed straights and sparse lower rotatables. Every tray
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
      const next = btNext(q.cell, q.above, v === 1, course);
      const path = [...q.path, { cell: q.cell, vert: v }];
      if (next.cell >= 100) { if (next.cell - 100 === col) return path; continue; }
      if (next.cell < 0) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, path });
    }
  }
  return null;
}

/** Minimise triple stacks with 8–10 seeded upper fixed straights and sparse lower rows. */
function seededFixed(): number[] {
  const lowerRot = [6, 7].flatMap((row) => shuffle([1, 2, 3, 4, 5]).slice(0, 2).map((col) => row * BT_COLS + col));
  if (new Set(lowerRot.map((cell) => cell % BT_COLS)).size !== lowerRot.length) return seededFixed();
  const lowerFixed = BT_KIND.flatMap((kind, cell) => kind === 1 && cell >= 42 && cell < 56 && !lowerRot.includes(cell) ? [cell] : []);
  const patterns = Array.from({ length: BT_COLS }, (_, col) => {
    const candidates = BT_KIND.flatMap((kind, cell) => kind === 1 && cell < 42 && cell % BT_COLS === col && !BT_ALWAYS_FIXED.includes(cell) ? [cell] : []);
    const options: { fixed: number[]; triples: number }[] = [];
    for (let mask = 0; mask < 2 ** candidates.length; mask++) {
      const fixed = candidates.filter((_, i) => mask & (1 << i));
      const allFixed = new Set([...BT_ALWAYS_FIXED, ...lowerFixed, ...fixed]);
      let run = 0, triples = 0, valid = true;
      for (let row = 0; row < 8; row++) {
        const cell = row * BT_COLS + col;
        run = BT_KIND[cell] === 1 && !allFixed.has(cell) ? run + 1 : 0;
        if (run === 3) triples++;
        if (run > 3) valid = false;
      }
      if (valid) options.push({ fixed, triples });
    }
    return options;
  });
  const costs = Array.from({ length: BT_COLS + 1 }, () => Array.from({ length: 11 }, () => Infinity));
  const last = costs[BT_COLS];
  if (!last) throw Error("Missing costs");
  last[0] = 0;
  for (let col = BT_COLS - 1; col >= 0; col--) {
    const current = costs[col];
    if (!current) throw Error("Missing costs");
    for (let budget = 0; budget <= 10; budget++) for (const option of patterns[col] ?? []) {
      if (option.fixed.length <= budget) current[budget] = Math.min(current[budget] ?? Infinity, option.triples + (costs[col + 1]?.[budget - option.fixed.length] ?? Infinity));
    }
  }
  let budget = 8 + rnd(3);
  if (!Number.isFinite(costs[0]?.[budget])) return seededFixed();
  const fixed = [...lowerFixed];
  for (let col = 0; col < BT_COLS; col++) {
    const options = (patterns[col] ?? []).filter((p) => p.fixed.length <= budget && p.triples + (costs[col + 1]?.[budget - p.fixed.length] ?? Infinity) === costs[col]?.[budget]);
    const chosen = options[rnd(options.length)];
    if (!chosen) throw Error("Missing fixed pattern");
    fixed.push(...chosen.fixed);
    budget -= chosen.fixed.length;
  }
  return fixed.sort((a, b) => a - b);
}

/** Reject any tray obtainable from the initial track by one lower-row toggle alone. */
export function hasLowerShortcut(course: BtCourse): boolean {
  for (const toggle of btRotatable(course).filter((cell) => cell >= 42)) {
    let cell = BT_HOPPER_COL, above = true;
    for (let i = 0; i < BT_COLS * BT_ROWS + 1; i++) {
      const next = btNext(cell, above, cell === toggle, course);
      if (next.cell >= 100) { if ((course.trays[next.cell - 100] ?? -1) >= 0) return true; break; }
      if (next.cell < 0) break;
      cell = next.cell; above = next.fromAbove;
    }
  }
  return false;
}

function makeCourse(): BtCourse {
  const cols = shuffle([0, 1, 2, 3, 4, 5]);
  const colours = shuffle([0, 1, 2, 3, 4]);
  const trays = Array.from({ length: BT_COLS }, () => -1);
  colours.forEach((c, i) => (trays[cols[i]!] = c));
  // Four balls per colour, shuffled deterministically; triple runs are rerolled below.
  const balls = shuffle(Array.from({ length: BT_BALLS }, (_, i) => i % BT_COLOURS));
  const fixed = seededFixed();
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
    if (course.balls.some((b, i) => i >= 2 && b === course.balls[i - 1] && b === course.balls[i - 2])) continue;
    if (hasLowerShortcut(course)) continue;
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
