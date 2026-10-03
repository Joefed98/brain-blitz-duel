/**
 * Builds 400 Ball Track courses. Each course is laid out, then a playbook bot
 * plans piece states ball by ball (DFS over the pieces each path touches) and
 * plays the real sim; only courses where all 15 balls land home are kept.
 * Starting piece states are scrambled; par = the playbook's piece actions.
 *   bun scripts/ball-track-bank.ts
 */
import { writeFileSync } from "node:fs";
import { encodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  btExit, makeBallTrackGame, sliderPos, BT_BALLS, BT_COLOURS, BT_COLS, BT_HOPPER_COL, BT_ROWS,
  BT_K_FLIP, BT_K_RELEASE, BT_K_ROTATE, BT_K_SLIDE, BT_K_WHEEL, BT_RUN_TICKS, N,
  type BtCourse, type BtGame, type BtState,
} from "../src/lib/arcade/ballTrack";

let seed = 0x5a17c3;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = (n: number) => Math.floor(rnd() * n);
const shuffle = <T,>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = pick(i + 1); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; };

function makeCourse(tier: number): BtCourse | null {
  const pits = shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 2);
  const colours = shuffle([0, 1, 2, 3, 4]);
  let k = 0;
  const trays = [0, 1, 2, 3, 4, 5, 6].map((c) => (pits.includes(c) ? -1 : colours[k++]!));
  let balls: number[] = [];
  for (let tries = 0; tries < 50; tries++) {
    balls = shuffle([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
    if (!balls.some((b, i) => i >= 2 && balls[i - 1] === b && balls[i - 2] === b)) break;
    balls = [];
  }
  if (!balls.length) return null;
  const total = [8, 11, 14][tier]! + pick(3);
  const wheelsN = tier === 0 ? pick(2) : tier === 1 ? 1 : 2;
  const slidersN = tier === 0 ? 1 : tier === 1 ? 1 + pick(2) : 2 + pick(2);
  const used = new Set<number>();
  const wheels: BtCourse["wheels"] = [];
  for (let g = 0; wheels.length < wheelsN && g < 200; g++) {
    const r = 1 + pick(4), c = pick(6), cell = r * BT_COLS + c;
    const cells = [cell, cell + 1, cell + BT_COLS, cell + BT_COLS + 1];
    if (cells.some((x) => used.has(x))) continue;
    cells.forEach((x) => used.add(x));
    wheels.push({ cell, pocket: pick(4) });
  }
  const sliders: BtCourse["sliders"] = [];
  for (let g = 0; sliders.length < slidersN && g < 200; g++) {
    const row = 1 + pick(5), len = 3 + pick(2), col = pick(BT_COLS - len + 1);
    const cells = Array.from({ length: len }, (_, i) => row * BT_COLS + col + i);
    if (cells.some((x) => used.has(x)) || sliders.some((s) => s.row === row)) continue;
    cells.forEach((x) => used.add(x));
    sliders.push({ row, col, len, slot: pick(2), pos: pick(len - 1) });
  }
  if (wheels.length < wheelsN || sliders.length < slidersN) return null;
  const rest = total - wheelsN - slidersN;
  const free = shuffle(Array.from({ length: BT_COLS * BT_ROWS }, (_, i) => i).filter((x) => !used.has(x)));
  const flippers: BtCourse["flippers"] = [];
  const pipes: BtCourse["pipes"] = [];
  const nFlip = Math.ceil(rest * 0.55);
  // Bias one flipper near the top of the hopper column so balls can spread.
  const entryCells = [BT_HOPPER_COL, BT_COLS + BT_HOPPER_COL].filter((x) => !used.has(x));
  const first = entryCells[pick(entryCells.length)];
  const order = first === undefined ? free : [first, ...free.filter((x) => x !== first)];
  for (const cell of order.slice(0, rest)) {
    if (flippers.length < nFlip) flippers.push({ cell, dir: pick(2) });
    else pipes.push({ cell, shape: pick(3), rot: pick(4) });
  }
  return { trays, balls, pipes, flippers, sliders, wheels };
}

/** Desired piece states for one ball, or null. */
interface Plan { pipe: Map<number, number>; flip: Map<number, number>; slide: Map<number, number>; wheelIn: Map<number, number>; wheelOut: Map<number, number> }

function planBall(game: BtGame, state: BtState, colour: number): Plan | null {
  const { course, map } = game;
  const best: { plan: Plan | null; cost: number } = { plan: null, cost: 1e9 };
  const work: BtState = { ...state, pipeRot: [...state.pipeRot], flip: [...state.flip], slFrom: [...state.slFrom], slTo: [...state.slTo], slUntil: state.slUntil.map(() => 0) };
  for (let i = 0; i < course.sliders.length; i++) { const p = sliderPos(state, i); work.slFrom[i] = p; work.slTo[i] = p; }
  const plan: Plan = { pipe: new Map(), flip: new Map(), slide: new Map(), wheelIn: new Map(), wheelOut: new Map() };
  const clone = (): Plan => ({ pipe: new Map(plan.pipe), flip: new Map(plan.flip), slide: new Map(plan.slide), wheelIn: new Map(plan.wheelIn), wheelOut: new Map(plan.wheelOut) });
  const visit = (target: number, entry: number, cost: number, depth: number) => {
    if (cost >= best.cost || depth > 30) return;
    if (target === -2) return;
    if (target >= 100) { if (course.trays[target - 100] === colour) { best.cost = cost; best.plan = clone(); } return; }
    const info = map[target]!;
    if (info.kind === 4) {
      if (entry !== N || info.sub > 1 || plan.wheelIn.has(info.idx)) return;
      const q0 = state.whPocket[info.idx]!;
      const inCost = (info.sub - q0 + 4) % 4;
      plan.wheelIn.set(info.idx, info.sub);
      for (const out of [2, 3]) {
        const wc = course.wheels[info.idx]!.cell;
        const below = wc + 2 * BT_COLS + (out === 2 ? 1 : 0);
        plan.wheelOut.set(info.idx, out);
        visit(below >= BT_COLS * BT_ROWS ? 100 + (below % BT_COLS) : below, N, cost + inCost + (out - info.sub + 4) % 4, depth + 1);
      }
      plan.wheelIn.delete(info.idx); plan.wheelOut.delete(info.idx);
      return;
    }
    const step = (extra: number) => { const e = btExit(course, map, work, target, entry); visit(e.target, e.entry, cost + extra, depth + 1); };
    if (info.kind === 1) {
      const cur = state.pipeRot[info.idx]!;
      if (plan.pipe.has(info.idx)) return step(0);
      for (let d = 0; d < 4; d++) { work.pipeRot[info.idx] = (cur + d) & 3; plan.pipe.set(info.idx, (cur + d) & 3); step(d); }
      work.pipeRot[info.idx] = cur; plan.pipe.delete(info.idx);
    } else if (info.kind === 2) {
      const cur = state.flip[info.idx]!;
      if (plan.flip.has(info.idx)) return step(0);
      for (const d of [0, 1]) { work.flip[info.idx] = cur ^ d; plan.flip.set(info.idx, cur ^ d); step(d); }
      work.flip[info.idx] = cur; plan.flip.delete(info.idx);
    } else if (info.kind === 3) {
      const cur = work.slTo[info.idx]!;
      if (plan.slide.has(info.idx)) return step(0);
      const len = course.sliders[info.idx]!.len;
      for (let p = 0; p < len - 1; p++) { work.slFrom[info.idx] = p; work.slTo[info.idx] = p; plan.slide.set(info.idx, p); step(p === cur ? 0 : 1); }
      work.slFrom[info.idx] = cur; work.slTo[info.idx] = cur; plan.slide.delete(info.idx);
    } else step(0);
  };
  visit(BT_HOPPER_COL, N, 0, 0);
  return best.plan;
}

/** Plays the course with the bot; returns the event log and final state. */
export function playbook(game: BtGame): { events: ArcadeInputEvent[]; state: BtState } | null {
  let state = game.init(1);
  const events: ArcadeInputEvent[] = [];
  const queue: Omit<ArcadeInputEvent, "t">[] = [];
  let plan: Plan | null = null;
  let waitUntil = 0;
  while (!game.isOver(state)) {
    if (!queue.length && state.balls.length === 0 && state.next < BT_BALLS && state.tick >= waitUntil) {
      plan = planBall(game, state, game.course.balls[state.next]!);
      if (!plan) return null;
      for (const [i, rot] of plan.pipe) for (let d = (rot - state.pipeRot[i]! + 4) % 4; d > 0; d--) queue.push({ k: BT_K_ROTATE, a: game.course.pipes[i]!.cell, b: 0, c: 0, d: 0 });
      for (const [i, f] of plan.flip) if (f !== state.flip[i]) queue.push({ k: BT_K_FLIP, a: game.course.flippers[i]!.cell, b: 0, c: 0, d: 0 });
      for (const [i, p] of plan.slide) if (p !== sliderPos(state, i)) queue.push({ k: BT_K_SLIDE, a: i, b: p, c: 0, d: 0 });
      for (const [w, q] of plan.wheelIn) for (let d = (q - state.whPocket[w]! + 4) % 4; d > 0; d--) queue.push({ k: BT_K_WHEEL, a: w, b: 1, c: 0, d: 0 });
      queue.push({ k: BT_K_RELEASE, a: 0, b: 0, c: 0, d: 0 });
    }
    let next: ArcadeInputEvent | null = null;
    const head = queue[0];
    const settled = state.slUntil.every((u) => state.tick + 1 >= u) && state.whUntil.every((u) => state.tick + 1 >= u);
    if (head && (head.k !== BT_K_WHEEL || state.tick + 1 >= state.whUntil[head.a]!) && (head.k !== BT_K_RELEASE || settled)) {
      next = { t: state.tick + 1, ...head };
      queue.shift();
    } else if (!head && plan) {
      const held = state.balls.find((b) => b.held >= 0);
      if (held && state.tick + 1 >= state.whUntil[held.held]! && state.whPocket[held.held] !== plan.wheelOut.get(held.held)) {
        next = { t: state.tick + 1, k: BT_K_WHEEL, a: held.held, b: 1, c: 0, d: 0 };
      }
    }
    if (next) recordInput(events, next, game.inputRanges);
    state = game.step(state, inputAt(events, state.tick + 1));
    if (state.lost || state.wrong) return null;
  }
  return state.home === BT_BALLS ? { events, state } : null;
}

/** Removing slides must break this exact proven playbook, not merely change its action count. */
export function dependsOnSlide(game: BtGame, events: ArcadeInputEvent[]): boolean {
  if (!game.course.sliders.length) return true;
  if (!events.some((e) => e.k === BT_K_SLIDE)) return false;
  let full = game.init(1), deflected = false;
  while (!game.isOver(full)) {
    const before = full;
    full = game.step(full, inputAt(events, full.tick + 1));
    for (const ball of full.balls) {
      if (!before.balls.some((b) => b.id === ball.id && b.cell !== ball.cell)) continue;
      const info = game.map[ball.cell];
      if (info?.kind === 3 && ball.target >= 0) {
        const col = ball.target >= 100 ? ball.target - 100 : ball.target % BT_COLS;
        if (col !== ball.cell % BT_COLS) deflected = true;
      }
    }
  }
  if (!deflected) return false;
  const without = events.filter((e) => e.k !== BT_K_SLIDE);
  let state = game.init(1);
  while (!game.isOver(state)) state = game.step(state, inputAt(without, state.tick + 1));
  return state.home < BT_BALLS;
}

if (import.meta.main) {
  const entries: { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }[] = [];
  const seen = new Set<string>();
  const tierCount = [0, 0, 0];
  let attempts = 0;
  while (entries.length < 400 && attempts++ < 200000) {
    const tier = entries.length % 3;
    const course = makeCourse(tier);
    if (!course) continue;
    const game = makeBallTrackGame(course);
    const run = playbook(game);
    if (!run || run.state.lastLand > BT_RUN_TICKS - 900) continue;
    if (!dependsOnSlide(game, run.events)) continue;
    const par = run.state.actions;
    if (par < 12) continue;
    const key = JSON.stringify(course);
    if (seen.has(key)) continue;
    seen.add(key);
    tierCount[tier]!++;
    entries.push({ course, tier, par, endTick: run.state.lastLand, playbook: encodeInputEvents(run.events) });
  }
  if (entries.length !== 400) throw Error(`Only built ${entries.length} courses after ${attempts} attempts`);
  void BT_COLOURS; void BT_ROWS;
  writeFileSync(
    "src/lib/duel/ballTrackBank.server.ts",
    `/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport interface BallTrackBankEntry { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
  );
  const pars = entries.map((e) => e.par), ends = entries.map((e) => e.endTick);
  console.log(`Ball Track: ${entries.length} courses in ${attempts} attempts; tiers ${tierCount.join("/")}; par ${Math.min(...pars)}–${Math.max(...pars)}; last landing ${Math.min(...ends)}–${Math.max(...ends)} ticks`);
}
