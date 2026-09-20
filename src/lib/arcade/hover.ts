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
  fp,
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

export const HOVER_DISC_X = fp(130);
export const HOVER_DISC_R = fp(11);

export const HOVER_GRAVITY = fp(0.35);
export const HOVER_IMPULSE = fp(-6.5);
export const HOVER_TERMINAL = fp(9);

/** Scroll speed: starts here, rises per gate, never past the cap. */
export const HOVER_SCROLL_START = fp(2.6);
export const HOVER_SCROLL_STEP = fp(0.06);
export const HOVER_SCROLL_MAX = fp(4.4);

export const HOVER_PILLAR_W = fp(40);
/** Pillar spacing in world pixels; the first pillar starts at the right edge. */
export const HOVER_SPACING = fp(319);
export const HOVER_FIRST_X = fp(HOVER_WORLD_W);

export const HOVER_GAP_START = 150;
export const HOVER_GAP_STEP = 2;
export const HOVER_GAP_MIN = 100;
/** Keep a gap away from the floor and ceiling by this much. */
export const HOVER_GAP_MARGIN = 40;

export const HOVER_GATE_POINTS = 110;
export const HOVER_SURVIVE_BONUS = 40;

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

/** Gap height in whole pixels for the nth pillar, narrowing as the run goes. */
function gapPixels(index: number): number {
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
  while (x <= HOVER_FIRST_X + maxTravel + HOVER_SPACING) {
    const gapPx = gapPixels(pillars.length);
    const half = gapPx / 2;
    const low = half + HOVER_GAP_MARGIN;
    const high = HOVER_WORLD_H - half - HOVER_GAP_MARGIN;
    const span = Math.max(1, high - low + 1);
    const drawn = rngBelow(rng, span);
    rng = drawn.state;
    const centre = low + drawn.value;
    pillars.push({ x0: x, gapTop: fp(centre - half), gapH: fp(gapPx) });
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
    y: fp(HOVER_WORLD_H / 2),
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
  const floor = y + HOVER_DISC_R >= fp(HOVER_WORLD_H);
  const crashed =
    ceiling || floor || state.pillars.some((pillar) => hits(pillar, distance, y));
  if (crashed) return { ...next, crashed: true, endedTick: tick };
  if (tick >= HOVER_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function isOver(state: HoverState): boolean {
  return state.crashed || state.tick >= HOVER_RUN_TICKS;
}

export function hoverSurvived(state: HoverState): boolean {
  return !state.crashed && state.tick >= HOVER_RUN_TICKS;
}

function score(state: HoverState): number {
  const total = Math.max(1, state.totalGates);
  const gates = clampInt(state.gates, 0, total);
  const earned = Math.round((HOVER_GATE_POINTS * gates) / total);
  const bonus = hoverSurvived(state) ? HOVER_SURVIVE_BONUS : 0;
  return clampInt(earned + bonus, 0, 150);
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

  const remaining = Math.max(0, HOVER_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Gates ${state.gates} / ${state.totalGates}`, 12, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, HOVER_WORLD_W - 12, 12);

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
