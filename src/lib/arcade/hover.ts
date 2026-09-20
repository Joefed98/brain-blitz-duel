/**
 * Hover — the first arcade game on the shared engine.
 *
 * A gold disc holds the left third of a fixed 390 × 560 world. Gravity pulls it
 * down every tick, a tap shoves it up, and pillars scroll in from the right.
 * Everything here is integer fixed-point (1/256 px), so the phone and the server
 * walk the same run tick for tick.
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

export const HOVER_RUN_SECONDS = 45;
export const HOVER_RUN_TICKS = HOVER_RUN_SECONDS * TICKS_PER_SECOND;

/** Gates that fit in a full run, and the scoring cap. */
export const HOVER_GATES = 22;

export const HOVER_DISC_X = fp(130);
export const HOVER_DISC_R = fp(11);

export const HOVER_GRAVITY = fp(0.35);
export const HOVER_IMPULSE = fp(-6.5);
export const HOVER_TERMINAL = fp(9);
export const HOVER_SCROLL = fp(2.6);

export const HOVER_PILLAR_W = fp(40);
/**
 * Pillar spacing. A 45-second run travels 2.6 × 2700 = 7020 px, so 22 gates
 * means one pillar every 319 px — the 150 px in the brief would have produced
 * 46 gates in a run.
 */
export const HOVER_SPACING = fp(319);

export const HOVER_GAP_START = 150;
export const HOVER_GAP_STEP = 2;
export const HOVER_GAP_MIN = 100;
/** Keep a gap away from the floor and ceiling by this much. */
export const HOVER_GAP_MARGIN = 40;

export const HOVER_GATE_POINTS = 5;
export const HOVER_SURVIVE_BONUS = 40;

/* ================================ State ================================ */

export interface HoverPillar {
  /** Left edge, fixed-point. */
  x: number;
  gapTop: number;
  gapH: number;
  scored: boolean;
}

export interface HoverState {
  tick: number;
  /** Disc centre, fixed-point. */
  y: number;
  vy: number;
  rng: number;
  spawned: number;
  gates: number;
  crashed: boolean;
  /** The tick the run ended on, or 0 while it is still going. */
  endedTick: number;
  pillars: HoverPillar[];
}

/** Gap height in whole pixels for the nth pillar, narrowing as the run goes. */
function gapPixels(index: number): number {
  return Math.max(HOVER_GAP_MIN, HOVER_GAP_START - HOVER_GAP_STEP * index);
}

function spawnPillar(state: HoverState, x: number): HoverState {
  const gapPx = gapPixels(state.spawned);
  const half = gapPx / 2;
  const low = half + HOVER_GAP_MARGIN;
  const high = HOVER_WORLD_H - half - HOVER_GAP_MARGIN;
  const span = Math.max(1, high - low + 1);
  const drawn = rngBelow(state.rng, span);
  const centre = low + drawn.value;
  return {
    ...state,
    rng: drawn.state,
    spawned: state.spawned + 1,
    pillars: [...state.pillars, { x, gapTop: fp(centre - half), gapH: fp(gapPx), scored: false }],
  };
}

function init(seed: number): HoverState {
  const base: HoverState = {
    tick: 0,
    y: fp(HOVER_WORLD_H / 2),
    vy: 0,
    rng: seed | 0,
    spawned: 0,
    gates: 0,
    crashed: false,
    endedTick: 0,
    pillars: [],
  };
  // The first pillar starts just off the right edge.
  return spawnPillar(base, fp(HOVER_WORLD_W));
}

function hits(pillar: HoverPillar, y: number): boolean {
  const left = pillar.x;
  const right = pillar.x + HOVER_PILLAR_W;
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

  let gates = state.gates;
  const pillars: HoverPillar[] = [];
  for (const pillar of state.pillars) {
    const x = pillar.x - HOVER_SCROLL;
    if (x + HOVER_PILLAR_W < 0) continue;
    const passed = !pillar.scored && x + HOVER_PILLAR_W < HOVER_DISC_X - HOVER_DISC_R;
    if (passed) gates += 1;
    pillars.push({ ...pillar, x, scored: pillar.scored || passed });
  }

  let next: HoverState = { ...state, tick, y, vy, gates, pillars };

  const last = pillars[pillars.length - 1];
  if (!last || last.x <= fp(HOVER_WORLD_W) - HOVER_SPACING) {
    next = spawnPillar(next, last ? last.x + HOVER_SPACING : fp(HOVER_WORLD_W));
  }

  const ceiling = y - HOVER_DISC_R <= 0;
  const floor = y + HOVER_DISC_R >= fp(HOVER_WORLD_H);
  const crashed = ceiling || floor || next.pillars.some((pillar) => hits(pillar, y));
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
  const gates = HOVER_GATE_POINTS * clampInt(state.gates, 0, HOVER_GATES);
  const bonus = hoverSurvived(state) ? HOVER_SURVIVE_BONUS : 0;
  return clampInt(gates + bonus, 0, 150);
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
    const left = px(pillar.x);
    const width = px(HOVER_PILLAR_W);
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
  ctx.fillText(`gates ${state.gates}`, 12, 12);
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
