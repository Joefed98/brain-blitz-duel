/**
 * Sort Rush — shapes fall down a central channel; swipe each into the gate of
 * its colour. The whole schedule (spawns, fall times, colours, gate swaps) is
 * drawn at init from the seed. Swipes arrive as k = 4 events (a = direction).
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

const FP = 256;
export const SORT_WORLD_W = 390;
export const SORT_WORLD_H = 620;

export const SORT_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const SORT_INPUT_SWIPE = 4;
export const SORT_LEFT = 0;
export const SORT_RIGHT = 1;
export const SORT_DOWN = 2;
export const SORT_UP = 3;
export const SORT_SWIPE_PX = 24;

/** The middle gate opens at 20 s. */
export const SORT_MIDDLE_TICK = 20 * TICKS_PER_SECOND;
const SPAWN_START = 60; // 1.0 s
const SPAWN_END = 24; // 0.4 s
/** Fall speed in 1/256 px per tick: 3.0 px/tick at the start, 6.0 by 60 s (linear). */
const FALL_SPEED_START = 768;
const FALL_SPEED_END = 1536;
const SWAP_MIN = 12 * TICKS_PER_SECOND;
const SWAP_MAX = 15 * TICKS_PER_SECOND;
export const SORT_FLASH_TICKS = 30;
const FIRST_SPAWN = 40;
const ZIP_TICKS = 12;

const SPAWN_Y = -20 * FP;
export const SORT_GATE_Y = 540 * FP;
const CHANNEL_X = 195;
const GATE_X = [70, 320, 195] as const;

export const SORT_INPUT_RANGES: readonly InputRange[] = [inputRange(SORT_INPUT_SWIPE, [0, 3])];

/* =============================== Schedule =============================== */

export interface SortShape {
  spawn: number;
  fall: number;
  /** 0 circle, 1 square, 2 triangle, 3 star. */
  shape: number;
  /** Colour index into SORT_COLOURS. */
  colour: number;
}

export interface SortSwap {
  tick: number;
  /** Colour index shown by gates 0 (left), 1 (right), 2 (middle). */
  gates: number[];
}

function spawnGap(tick: number): number {
  return SPAWN_START - Math.trunc(((SPAWN_START - SPAWN_END) * clampInt(tick, 0, SORT_RUN_TICKS)) / SORT_RUN_TICKS);
}

function buildSchedule(seed: number) {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  // Gate colours, then swaps. Before 20 s only left/right trade places.
  const swaps: SortSwap[] = [];
  let gates = [0, 1, 2];
  if (draw(2)) gates = [1, 0, 2];
  swaps.push({ tick: 0, gates });
  let at = SWAP_MIN + draw(SWAP_MAX - SWAP_MIN + 1);
  while (at < SORT_RUN_TICKS) {
    let next: number[];
    if (at < SORT_MIDDLE_TICK) next = [gates[1]!, gates[0]!, gates[2]!];
    else {
      const perms = [
        [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
      ].filter((p) => p.some((c, i) => c !== gates[i]));
      next = perms[draw(perms.length)]!;
    }
    gates = next;
    swaps.push({ tick: at, gates });
    at += SWAP_MIN + draw(SWAP_MAX - SWAP_MIN + 1);
  }
  const twoColours = [swaps[0]!.gates[0]!, swaps[0]!.gates[1]!];

  // Spawn ticks; each shape falls at the speed of its spawn moment.
  const spawns: number[] = [];
  for (let t = FIRST_SPAWN; t < SORT_RUN_TICKS; t += spawnGap(t)) spawns.push(t);
  const shapes: SortShape[] = [];
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i]!;
    const speed = FALL_SPEED_START + Math.trunc(((FALL_SPEED_END - FALL_SPEED_START) * clampInt(s, 0, SORT_RUN_TICKS)) / SORT_RUN_TICKS);
    const fall = Math.trunc((SORT_GATE_Y - SPAWN_Y + speed - 1) / speed);
    if (s + fall > SORT_RUN_TICKS) break; // every scheduled shape can be sorted in the run
    const colour = s >= SORT_MIDDLE_TICK ? draw(3) : twoColours[draw(2)]!;
    shapes.push({ spawn: s, fall, shape: draw(4), colour });
  }
  return { shapes, swaps, rng };
}

/* ================================ State ================================ */

export interface SortState {
  tick: number;
  rng: number;
  shapes: SortShape[];
  swaps: SortSwap[];
  /** Per shape: 0 unsorted, 1 + gate once sorted. */
  status: number[];
  /** Per shape: tick it was sorted and its y then (render only). */
  sortTick: number[];
  sortY: number[];
  lowest: number;
  sorted: number;
  wrong: number;
  ended: number;
  endedTick: number;
}

const cache = new Map<number, ReturnType<typeof buildSchedule>>();

function init(seed: number): SortState {
  let plan = cache.get(seed | 0);
  if (!plan) {
    plan = buildSchedule(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, plan);
  }
  const n = plan.shapes.length;
  return {
    tick: 0,
    rng: plan.rng,
    shapes: plan.shapes,
    swaps: plan.swaps,
    status: new Array<number>(n).fill(0),
    sortTick: new Array<number>(n).fill(0),
    sortY: new Array<number>(n).fill(0),
    lowest: 0,
    sorted: 0,
    wrong: 0,
    ended: 0,
    endedTick: 0,
  };
}

export function sortGatesAt(state: SortState, tick: number): number[] {
  let gates = state.swaps[0]!.gates;
  for (const swap of state.swaps) {
    if (swap.tick > tick) break;
    gates = swap.gates;
  }
  return gates;
}

export function sortShapeY(shape: SortShape, tick: number): number {
  const elapsed = clampInt(tick - shape.spawn, 0, shape.fall);
  return SPAWN_Y + Math.trunc(((SORT_GATE_Y - SPAWN_Y) * elapsed) / shape.fall);
}

function isOver(state: SortState): boolean {
  return state.ended !== 0;
}

function step(state: SortState, input: ArcadeInputEvent | null): SortState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: SortState = { ...state, tick };
  let lowest = s.lowest;
  while (lowest < s.shapes.length && s.status[lowest] !== 0) lowest += 1;

  if (input && input.k === SORT_INPUT_SWIPE) {
    const dir = clampInt(input.a, 0, 3);
    const gate = dir === SORT_LEFT ? 0 : dir === SORT_RIGHT ? 1 : dir === SORT_DOWN && tick >= SORT_MIDDLE_TICK ? 2 : -1;
    const shape = s.shapes[lowest];
    if (gate >= 0 && shape && shape.spawn <= tick) {
      s.status = s.status.slice();
      s.sortTick = s.sortTick.slice();
      s.sortY = s.sortY.slice();
      s.status[lowest] = 1 + gate;
      s.sortTick[lowest] = tick;
      s.sortY[lowest] = sortShapeY(shape, tick);
      if (sortGatesAt(s, tick)[gate] === shape.colour) s.sorted += 1;
      else s.wrong += 1;
      lowest += 1;
      while (lowest < s.shapes.length && s.status[lowest] !== 0) lowest += 1;
    }
  }
  s.lowest = lowest;
  const next = s.shapes[lowest];
  if (next && tick >= next.spawn + next.fall) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= SORT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** round(150 × sorted ÷ total) − 2 per wrong gate, min 0. */
export function sortScoreOf(sorted: number, wrong: number, total: number): number {
  if (total <= 0) return 0;
  const share = Math.trunc((300 * sorted + total) / (2 * total));
  return clampInt(share - 2 * wrong, 0, 150);
}

function score(state: SortState): number {
  return sortScoreOf(state.sorted, state.wrong, state.shapes.length);
}

/* ============================= Checkpoints ============================= */

export const SORT_CHECKPOINT_INTERVAL = 300;
export const SORT_CHECKPOINT_KEYS = [
  "tick", "lowest", "sorted", "wrong", "ended", "rng", "checksum",
] as const;

export interface SortCheckpoint {
  tick: number;
  lowest: number;
  sorted: number;
  wrong: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function sortCheckpoint(state: SortState): SortCheckpoint {
  const snap = {
    tick: state.tick,
    lowest: state.lowest,
    sorted: state.sorted,
    wrong: state.wrong,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of [...Object.values(snap), ...state.status]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const SORT_BG = "#07070D";
export const SORT_GOLD = "#F5B82E";
export const SORT_COLOURS = ["#F5B82E", "#2ED3B7", "#FF5A6E"] as const;

export function drawSortShape(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  size: number,
  colour: string,
) {
  const r = size / 2;
  ctx.fillStyle = colour;
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 1) ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (kind === 2) {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.lineTo(x - r, y + r * 0.8);
    ctx.closePath();
  } else {
    for (let p = 0; p < 10; p++) {
      const a = -Math.PI / 2 + (p * Math.PI) / 5;
      const rr = p % 2 === 0 ? r : r * 0.45;
      if (p === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, state: SortState, size: CanvasSize): void {
  const scale = Math.min(size.width / SORT_WORLD_W, size.height / SORT_WORLD_H);
  const ox = (size.width - SORT_WORLD_W * scale) / 2;
  const oy = (size.height - SORT_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = SORT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // Channel.
  ctx.fillStyle = "rgba(245,184,46,0.06)";
  ctx.fillRect(CHANNEL_X - 34, 0, 68, SORT_GATE_Y / FP);

  // Gates, with a flash before a swap.
  const tick = state.tick;
  const gates = sortGatesAt(state, tick);
  const upcoming = state.swaps.find((swap) => swap.tick > tick);
  const flashing = upcoming !== undefined && upcoming.tick - tick <= SORT_FLASH_TICKS && Math.trunc(tick / 5) % 2 === 0;
  const gateCount = tick >= SORT_MIDDLE_TICK ? 3 : 2;
  const gy = SORT_GATE_Y / FP + 30;
  for (let g = 0; g < gateCount; g++) {
    const x = GATE_X[g]!;
    ctx.strokeStyle = flashing ? "#FFFFFF" : SORT_COLOURS[gates[g]!]!;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, gy, 34, Math.PI, 0);
    ctx.lineTo(x + 34, gy + 40);
    ctx.moveTo(x - 34, gy);
    ctx.lineTo(x - 34, gy + 40);
    ctx.stroke();
  }

  // Shapes.
  for (let i = Math.max(0, state.lowest - 6); i < state.shapes.length; i++) {
    const shape = state.shapes[i]!;
    if (shape.spawn > tick) break;
    const colour = SORT_COLOURS[shape.colour]!;
    const status = state.status[i]!;
    if (status === 0) {
      drawSortShape(ctx, shape.shape, CHANNEL_X, sortShapeY(shape, tick) / FP, 40, colour);
    } else {
      const age = tick - state.sortTick[i]!;
      if (age > ZIP_TICKS) continue;
      const f = age / ZIP_TICKS;
      const fromY = state.sortY[i]! / FP;
      const x = CHANNEL_X + (GATE_X[status - 1]! - CHANNEL_X) * f;
      const y = fromY + (gy - fromY) * f;
      ctx.globalAlpha = 1 - f * 0.6;
      drawSortShape(ctx, shape.shape, x, y, 40 * (1 - f * 0.4), colour);
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = SORT_GOLD;
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`Sorted ${state.sorted} · Wrong ${state.wrong}`, SORT_WORLD_W / 2, 30);
  ctx.restore();
}

export const sortRushGame: ArcadeGame<SortState, ArcadeInputEvent | null> = {
  key: "sortrush",
  runTicks: SORT_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: SORT_INPUT_RANGES,
};
