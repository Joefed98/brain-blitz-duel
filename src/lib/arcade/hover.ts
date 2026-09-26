/**
 * Hover — the first arcade game on the shared engine.
 *
 * A gold disc holds the left third of a fixed 390 × 560 world. Gravity pulls it
 * down every tick, a tap shoves it up, and the whole course scrolls past from
 * the right. The course is generated in full at init(seed), so the phone and the
 * server walk the identical run; everything is integer fixed-point (1/256 px).
 *
 * The scroll speed rises with every gate passed, so the ramp depends only on the
 * player's own gate count and stays deterministic.
 */

import {
  clampInt,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type CanvasSize,
} from "./engine";

/* ============================== Constants ============================== */

/** The world the sim runs in. Drawing scales this to the canvas. */
export const HOVER_WORLD_W = 390;
export const HOVER_WORLD_H = 560;

export const HOVER_RUN_SECONDS = 60;
export const HOVER_RUN_TICKS = HOVER_RUN_SECONDS * TICKS_PER_SECOND;

/** Every simulation constant below is already in 1/256-pixel units. */
export const HOVER_DISC_X = 33_280;
export const HOVER_DISC_R = 2_816;

export const HOVER_GRAVITY = 90;
export const HOVER_IMPULSE = -1_664;
export const HOVER_TERMINAL = 2_304;

/** Scroll speed: 2.6 px/tick, +0.08 px/tick per gate passed, capped at 5.2. */
export const HOVER_SCROLL_START = 666;
export const HOVER_SCROLL_STEP = 20;
export const HOVER_SCROLL_MAX = 1_331;

export const HOVER_PILLAR_W = 10_240;
/** Pillar spacing in world pixels; the first pillar starts at the right edge. */
export const HOVER_SPACING = 80_896;
/** Every course holds exactly this many gates; a clean run passes them all. */
export const HOVER_GATE_COUNT = 45;
export const HOVER_FIRST_X = 99_840;

export const HOVER_GAP_START = 38_400;
export const HOVER_GAP_STEP = 512;
export const HOVER_GAP_MIN = 25_600;
/** Keep a gap away from the floor and ceiling by this much. */
export const HOVER_GAP_MARGIN = 10_240;
export const HOVER_WORLD_BOTTOM = 143_360;

/** 2 per gate; passing all 45 scores 100 (this game's maximum). */
export const HOVER_GATE_POINTS = 2;
export const HOVER_ALL_GATES_SCORE = 100;

/* ================================ State ================================ */

export interface HoverPillar {
  /** Left edge at the start of the run, fixed-point; never mutated. */
  x0: number;
  gapTop: number;
  gapH: number;
}

export interface HoverState {
  tick: number;
  /** Disc centre, fixed-point. */
  y: number;
  vy: number;
  /** How far the course has scrolled, fixed-point. */
  distance: number;
  gates: number;
  /** Gates a player who never crashes passes in a full run. */
  totalGates: number;
  crashed: boolean;
  /** The tick the run ended on, or 0 while it is still going. */
  endedTick: number;
  pillars: HoverPillar[];
}

/** Gap height in fixed-point units for the nth pillar. */
function gapUnits(index: number): number {
  return Math.max(HOVER_GAP_MIN, HOVER_GAP_START - HOVER_GAP_STEP * index);
}

/** Scroll speed for a player who has passed this many gates. */
export function hoverScroll(gates: number): number {
  return Math.min(HOVER_SCROLL_MAX, HOVER_SCROLL_START + HOVER_SCROLL_STEP * gates);
}

/** Left edge of a pillar right now. */
export function pillarX(pillar: HoverPillar, distance: number): number {
  return pillar.x0 - distance;
}

/** Scrolled distance at which the nth pillar counts as passed. */
function passedAt(pillar: HoverPillar): number {
  return pillar.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R);
}

/** The whole course, long enough for the fastest possible run. */
function buildCourse(seed: number): { pillars: HoverPillar[]; rng: number } {
  const maxTravel = HOVER_SCROLL_MAX * HOVER_RUN_TICKS;
  const pillars: HoverPillar[] = [];
  let rng = seed | 0;
  let x = HOVER_FIRST_X;
  void maxTravel;
  while (pillars.length < HOVER_GATE_COUNT) {
    const gap = gapUnits(pillars.length);
    const half = gap >> 1;
    // Draw the centre in whole world pixels, as before the constant audit, then
    // store it in fixed-point. This preserves every existing seeded course.
    const low = (half + HOVER_GAP_MARGIN) >> 8;
    const high = (HOVER_WORLD_BOTTOM - half - HOVER_GAP_MARGIN) >> 8;
    const span = Math.max(1, high - low + 1);
    const drawn = rngBelow(rng, span);
    rng = drawn.state;
    const centre = (low + drawn.value) << 8;
    pillars.push({ x0: x, gapTop: centre - half, gapH: gap });
    x += HOVER_SPACING;
  }
  return { pillars, rng };
}

/** Gates a clean run reaches, walked tick by tick exactly as `step` does. */
function countTotalGates(pillars: HoverPillar[]): number {
  let gates = 0;
  let distance = 0;
  for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
    distance += hoverScroll(gates);
    while (gates < pillars.length && distance > passedAt(pillars[gates]!)) gates += 1;
  }
  return gates;
}

function init(seed: number): HoverState {
  const { pillars } = buildCourse(seed);
  return {
    tick: 0,
    y: 71_680,
    vy: 0,
    distance: 0,
    gates: 0,
    totalGates: countTotalGates(pillars),
    crashed: false,
    endedTick: 0,
    pillars,
  };
}

function hits(pillar: HoverPillar, distance: number, y: number): boolean {
  const left = pillarX(pillar, distance);
  const right = left + HOVER_PILLAR_W;
  const overlaps = right > HOVER_DISC_X - HOVER_DISC_R && left < HOVER_DISC_X + HOVER_DISC_R;
  if (!overlaps) return false;
  return y - HOVER_DISC_R < pillar.gapTop || y + HOVER_DISC_R > pillar.gapTop + pillar.gapH;
}

function step(state: HoverState, tapped: boolean): HoverState {
  if (isOver(state)) return state;

  const vy = clampInt(
    tapped ? HOVER_IMPULSE : state.vy + HOVER_GRAVITY,
    -HOVER_TERMINAL,
    HOVER_TERMINAL,
  );
  const y = state.y + vy;
  const tick = state.tick + 1;

  // Speed follows the gates already passed, so the ramp is identical for
  // everyone on the same gate count.
  const distance = state.distance + hoverScroll(state.gates);
  let gates = state.gates;
  while (gates < state.pillars.length && distance > passedAt(state.pillars[gates]!)) gates += 1;

  const next: HoverState = { ...state, tick, y, vy, distance, gates };

  const ceiling = y - HOVER_DISC_R <= 0;
  const floor = y + HOVER_DISC_R >= HOVER_WORLD_BOTTOM;
  const crashed = ceiling || floor || state.pillars.some((pillar) => hits(pillar, distance, y));
  if (crashed) return { ...next, crashed: true, endedTick: tick };
  if (tick >= HOVER_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

/* =========================== Integrity checks ========================== */

export const HOVER_CHECKPOINT_INTERVAL = 300;

export interface HoverCheckpointState {
  tick: number;
  y: number;
  vy: number;
  speed: number;
  gates: number;
  nextPillarX: number;
  nextGapTop: number;
  nextGapH: number;
}

export interface HoverCheckpoint extends HoverCheckpointState {
  checksum: number;
}

/** The exact integer state used for permanent client/server integrity checks. */
export function hoverCheckpointState(state: HoverState): HoverCheckpointState {
  const next = state.pillars[state.gates];
  return {
    tick: state.tick,
    y: state.y,
    vy: state.vy,
    speed: hoverScroll(state.gates),
    gates: state.gates,
    nextPillarX: next ? pillarX(next, state.distance) : 0,
    nextGapTop: next?.gapTop ?? 0,
    nextGapH: next?.gapH ?? 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function hoverCheckpoint(state: HoverState): HoverCheckpoint {
  const snapshot = hoverCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

function isOver(state: HoverState): boolean {
  return state.crashed || state.tick >= HOVER_RUN_TICKS;
}

export function hoverSurvived(state: HoverState): boolean {
  return !state.crashed && state.tick >= HOVER_RUN_TICKS;
}

function score(state: HoverState): number {
  const gates = clampInt(state.gates, 0, HOVER_GATE_COUNT);
  if (gates >= HOVER_GATE_COUNT) return HOVER_ALL_GATES_SCORE;
  return clampInt(HOVER_GATE_POINTS * gates, 0, HOVER_ALL_GATES_SCORE);
}

/* ================================ Drawing ============================== */

export const HOVER_BG = "#0B0B0F";
export const HOVER_DISC_COLOUR = "#F5B82E";
export const HOVER_PILLAR_COLOUR = "#2ED3B7";
export const HOVER_CRASH_COLOUR = "#FF4D4D";

/** Draws purely from the state — no animation lives outside the sim. */
function draw(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  const scale = Math.min(size.width / HOVER_WORLD_W, size.height / HOVER_WORLD_H);
  const offsetX = (size.width - HOVER_WORLD_W * scale) / 2;
  const offsetY = (size.height - HOVER_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = HOVER_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = HOVER_PILLAR_COLOUR;
  for (const pillar of state.pillars) {
    const left = px(pillarX(pillar, state.distance));
    const width = px(HOVER_PILLAR_W);
    if (left > HOVER_WORLD_W || left + width < 0) continue;
    const top = px(pillar.gapTop);
    const gap = px(pillar.gapH);
    ctx.fillRect(left, 0, width, Math.max(0, top));
    ctx.fillRect(left, top + gap, width, Math.max(0, HOVER_WORLD_H - top - gap));
  }

  ctx.beginPath();
  ctx.fillStyle = state.crashed ? HOVER_CRASH_COLOUR : HOVER_DISC_COLOUR;
  ctx.arc(px(HOVER_DISC_X), px(state.y), px(HOVER_DISC_R), 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Gates ${state.gates} / ${state.totalGates}`, 12, 12);
  ctx.textAlign = "right";

  if (state.crashed) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, HOVER_WORLD_W, HOVER_WORLD_H);
  }

  ctx.restore();
}

export const hoverGame: ArcadeGame<HoverState> = {
  key: "hover",
  runTicks: HOVER_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
};
