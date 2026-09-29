/**
 * Parry — arrows fly at a central shield from the four edges; swipe toward an
 * arrow inside its parry window to deflect it. The whole volley schedule is
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

export const PARRY_WORLD_W = 390;
export const PARRY_WORLD_H = 620;
export const PARRY_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const PARRY_INPUT_SWIPE = 4;
/** Sides and swipe directions share numbers: 0 left, 1 right, 2 up, 3 down. */
export const PARRY_LEFT = 0;
export const PARRY_RIGHT = 1;
export const PARRY_UP = 2;
export const PARRY_DOWN = 3;
export const PARRY_SWIPE_PX = 24;
export const PARRY_WINDOW = 12;
export const PARRY_MAX_HITS = 3;
const FLIGHT_START = 50;
const FLIGHT_END = 40;
const FEINT_AT = 20;
const PAIR_FROM = 20 * TICKS_PER_SECOND;
const FEINT_FROM = 40 * TICKS_PER_SECOND;
const PAIR_SPREAD = 8;
const FIRST_IMPACT = 90;

export const PARRY_INPUT_RANGES: readonly InputRange[] = [inputRange(PARRY_INPUT_SWIPE, [0, 3])];

/** Clockwise neighbours: left → up → right → down → left. */
const CLOCKWISE = [PARRY_UP, PARRY_DOWN, PARRY_RIGHT, PARRY_LEFT] as const;
const ANTI = [PARRY_DOWN, PARRY_UP, PARRY_LEFT, PARRY_RIGHT] as const;

export function parryFlight(impact: number): number {
  return FLIGHT_START - Math.trunc(((FLIGHT_START - FLIGHT_END) * clampInt(impact, 0, PARRY_RUN_TICKS)) / PARRY_RUN_TICKS);
}

/* =============================== Schedule =============================== */

export interface ParryArrow {
  impact: number;
  flight: number;
  /** Final side (the one to swipe toward). */
  side: number;
  /** Side it starts from; differs from `side` for a feint, which switches FEINT_AT ticks out. */
  from: number;
}

function buildSchedule(seed: number) {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const arrows: ParryArrow[] = [];
  const add = (impact: number, side: number) => {
    let from = side;
    if (impact >= FEINT_FROM && draw(3) === 0) from = draw(2) ? CLOCKWISE[side]! : ANTI[side]!;
    arrows.push({ impact, flight: parryFlight(impact), side, from });
  };
  let t = FIRST_IMPACT;
  let last = -1;
  while (t <= PARRY_RUN_TICKS) {
    let side = draw(4);
    if (side === last) side = (side + 1 + draw(3)) % 4;
    last = side;
    add(t, side);
    let gap = 52 + draw(24);
    if (t >= PAIR_FROM && draw(5) < 2) {
      const second = t + 1 + draw(PAIR_SPREAD);
      if (second <= PARRY_RUN_TICKS) {
        const other = (side + 1 + draw(3)) % 4;
        add(second, other);
        last = other;
        gap += 30;
      }
    }
    t += gap;
  }
  return { arrows, rng };
}

/* ================================ State ================================ */

export interface ParryState {
  tick: number;
  rng: number;
  arrows: ParryArrow[];
  /** Per arrow: 0 flying, 1 deflected, 2 hit. */
  status: number[];
  /** Per arrow: tick it resolved (render only). */
  doneTick: number[];
  cursor: number;
  deflected: number;
  hits: number;
  lastParry: number;
  lastHit: number;
  ended: number;
  endedTick: number;
}

const cache = new Map<number, ReturnType<typeof buildSchedule>>();

function init(seed: number): ParryState {
  let plan = cache.get(seed | 0);
  if (!plan) {
    plan = buildSchedule(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, plan);
  }
  const n = plan.arrows.length;
  return {
    tick: 0,
    rng: plan.rng,
    arrows: plan.arrows,
    status: new Array<number>(n).fill(0),
    doneTick: new Array<number>(n).fill(0),
    cursor: 0,
    deflected: 0,
    hits: 0,
    lastParry: -100,
    lastHit: -100,
    ended: 0,
    endedTick: 0,
  };
}

function isOver(state: ParryState): boolean {
  return state.ended !== 0;
}

/** The side an arrow is on at a tick (a feint switches FEINT_AT ticks out). */
export function parrySideAt(arrow: ParryArrow, tick: number): number {
  return arrow.impact - tick > FEINT_AT ? arrow.from : arrow.side;
}

function step(state: ParryState, input: ArcadeInputEvent | null): ParryState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: ParryState = { ...state, tick };
  let changed = false;
  const mark = (i: number, value: number) => {
    if (!changed) {
      s.status = s.status.slice();
      s.doneTick = s.doneTick.slice();
      changed = true;
    }
    s.status[i] = value;
    s.doneTick[i] = tick;
  };

  if (input && input.k === PARRY_INPUT_SWIPE) {
    const dir = clampInt(input.a, 0, 3);
    for (let i = s.cursor; i < s.arrows.length; i++) {
      const arrow = s.arrows[i]!;
      if (arrow.impact - tick >= PARRY_WINDOW) break;
      if (s.status[i] !== 0 || arrow.impact < tick) continue;
      if (parrySideAt(arrow, tick) !== dir) continue;
      mark(i, 1);
      s.deflected += 1;
      s.lastParry = tick;
      break;
    }
  }
  for (let i = s.cursor; i < s.arrows.length; i++) {
    const arrow = s.arrows[i]!;
    if (arrow.impact > tick) break;
    if (s.status[i] === 0) {
      mark(i, 2);
      s.hits += 1;
      s.lastHit = tick;
    }
  }
  let cursor = s.cursor;
  while (cursor < s.arrows.length && s.status[cursor] !== 0) cursor += 1;
  s.cursor = cursor;

  if (s.hits >= PARRY_MAX_HITS) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= PARRY_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** round(150 × deflected ÷ total), cap 150. */
export function parryScoreOf(deflected: number, total: number): number {
  if (total <= 0) return 0;
  return clampInt(Math.trunc((300 * deflected + total) / (2 * total)), 0, 150);
}

function score(state: ParryState): number {
  return parryScoreOf(state.deflected, state.arrows.length);
}

/* ============================= Checkpoints ============================= */

export const PARRY_CHECKPOINT_INTERVAL = 300;
export const PARRY_CHECKPOINT_KEYS = ["tick", "cursor", "deflected", "hits", "ended", "rng", "checksum"] as const;

export interface ParryCheckpoint {
  tick: number;
  cursor: number;
  deflected: number;
  hits: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function parryCheckpoint(state: ParryState): ParryCheckpoint {
  const snap = {
    tick: state.tick,
    cursor: state.cursor,
    deflected: state.deflected,
    hits: state.hits,
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

export const PARRY_BG = "#07070D";
export const PARRY_GOLD = "#F5B82E";
export const PARRY_TEAL = "#2ED3B7";
export const PARRY_RED = "#FF4D5E";
const CX = PARRY_WORLD_W / 2;
const CY = PARRY_WORLD_H / 2;
const SHIELD_R = 40;
const START_R = 230;
/** Angle each side's arrow flies in from (render only). */
const SIDE_ANGLE = [Math.PI, 0, -Math.PI / 2, Math.PI / 2] as const;

function arrowAngle(arrow: ParryArrow, tick: number): number {
  const a = SIDE_ANGLE[arrow.from]!;
  if (arrow.from === arrow.side) return a;
  let b = SIDE_ANGLE[arrow.side]!;
  while (b - a > Math.PI) b -= Math.PI * 2;
  while (a - b > Math.PI) b += Math.PI * 2;
  const out = arrow.impact - tick;
  const f = clampInt(FEINT_AT + 4 - out, 0, 8) / 8;
  return a + (b - a) * f;
}

function draw(ctx: CanvasRenderingContext2D, state: ParryState, size: CanvasSize): void {
  const scale = Math.min(size.width / PARRY_WORLD_W, size.height / PARRY_WORLD_H);
  const ox = (size.width - PARRY_WORLD_W * scale) / 2;
  const oy = (size.height - PARRY_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = PARRY_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const tick = state.tick;

  // Parry-window pulse.
  const inWindow = state.arrows.some(
    (arrow, i) => state.status[i] === 0 && arrow.impact - tick < PARRY_WINDOW && arrow.impact >= tick,
  );
  if (inWindow) {
    ctx.strokeStyle = "rgba(245,184,46,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, SHIELD_R + 18 + (tick % 12), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Shield: flashes on a parry, cracks on a hit.
  const flash = tick - state.lastParry < 8;
  ctx.strokeStyle = flash ? "#FFFFFF" : PARRY_GOLD;
  ctx.lineWidth = flash ? 9 : 6;
  ctx.beginPath();
  ctx.arc(CX, CY, SHIELD_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = PARRY_BG;
  ctx.lineWidth = 3;
  const crackAngles = [0.6, 2.7, 4.6];
  for (let c = 0; c < Math.min(state.hits, PARRY_MAX_HITS); c++) {
    const a = crackAngles[c]!;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * (SHIELD_R - 6), CY + Math.sin(a) * (SHIELD_R - 6));
    ctx.lineTo(CX + Math.cos(a + 0.12) * SHIELD_R, CY + Math.sin(a + 0.12) * SHIELD_R);
    ctx.lineTo(CX + Math.cos(a - 0.05) * (SHIELD_R + 6), CY + Math.sin(a - 0.05) * (SHIELD_R + 6));
    ctx.stroke();
  }

  // Arrows in flight, and shards of deflected ones.
  for (let i = Math.max(0, state.cursor - 4); i < state.arrows.length; i++) {
    const arrow = state.arrows[i]!;
    const spawn = arrow.impact - arrow.flight;
    if (spawn > tick) break;
    const status = state.status[i]!;
    const angle = arrowAngle(arrow, tick);
    if (status === 0) {
      const f = (tick - spawn) / arrow.flight;
      const r = START_R + (SHIELD_R - START_R) * f;
      const x = CX + Math.cos(angle) * r;
      const y = CY + Math.sin(angle) * r;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI);
      ctx.strokeStyle = PARRY_TEAL;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = PARRY_RED;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -7);
      ctx.lineTo(-4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (status === 1 && tick - state.doneTick[i]! < 14) {
      const age = tick - state.doneTick[i]!;
      ctx.fillStyle = PARRY_TEAL;
      ctx.globalAlpha = 1 - age / 14;
      for (let k = 0; k < 5; k++) {
        const a = angle + (k - 2) * 0.5;
        const r = SHIELD_R + 20 + age * 4;
        ctx.fillRect(CX + Math.cos(a) * r - 2, CY + Math.sin(a) * r - 2, 5, 5);
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = PARRY_GOLD;
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`Parried ${state.deflected} · Hits ${state.hits}`, CX, 30);
  ctx.restore();
}

export const parryGame: ArcadeGame<ParryState, ArcadeInputEvent | null> = {
  key: "parry",
  runTicks: PARRY_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: PARRY_INPUT_RANGES,
};
