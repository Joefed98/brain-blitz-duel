/**
 * Dual — an arcade game on the shared engine.
 *
 * Two runners, one on each half of the screen, each with its own scrolling
 * obstacles. Both schedules are laid out in full at init from the seed, and the
 * generator never lets an obstacle on one side arrive too close to one on the
 * other, so both are always jumpable. Integer values only; the schedule is what
 * the sim reads, so no randomness is drawn during play.
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
  parPoints,
  ARCADE_COMPLETION_BONUS,
} from "./engine";

/* ============================== Constants ============================== */

export const DUAL_WORLD_W = 390;
export const DUAL_WORLD_H = 560;
export const DUAL_PANEL_W = DUAL_WORLD_W / 2;

export const DUAL_RUN_SECONDS = 60;
export const DUAL_RUN_TICKS = DUAL_RUN_SECONDS * TICKS_PER_SECOND;

export const DUAL_HUD_H = 40;
export const DUAL_GROUND_Y = 430;
export const DUAL_RUNNER_X = 62;
export const DUAL_RUNNER_R = 15;
/** Blocks are 70% of their original 26 x 34 px. */
export const DUAL_BLOCK_W = 18;
export const DUAL_BLOCK_H = 24;

/** A jump is a fixed 30-tick arc, 115 px at the top (92 px + 25%). */
export const DUAL_JUMP_TICKS = 30;
export const DUAL_JUMP_PEAK = 115;

/** An obstacle is in front of the runner for this many ticks (narrower blocks: 5, was 6). */
export const DUAL_HIT_TICKS = 5;

/** The scroll speed used for drawing: 2.0 px a tick, +0.3 every ten seconds, cap 4.4. */
export const DUAL_SCROLL_START_FP = 512;
export const DUAL_SCROLL_STEP_FP = 77;
export const DUAL_SCROLL_CAP_FP = 1_126;
export const DUAL_SCROLL_PERIOD_TICKS = 10 * TICKS_PER_SECOND;

/** The first obstacle, and the gap band between consecutive obstacles. */
export const DUAL_FIRST_TICK = 120;
export const DUAL_GAP_EXTRA = 14;
export const DUAL_GAP_SPAN = 46;

/** Cross-side separation: 20 ticks for the first twenty seconds, then 12. */
export const DUAL_SEP_EARLY = 20;
export const DUAL_SEP_LATE = 12;
export const DUAL_SEP_SWITCH_TICK = 20 * TICKS_PER_SECOND;

/** Par: fifty obstacles passed. */
export const DUAL_PAR = 50;
export const DUAL_OBSTACLE_POINTS = 2;
export const DUAL_POINTS_CAP = 110;
export const DUAL_SURVIVE_BONUS = 40;

/** A jump: a = 0 left runner, 1 right runner. */
export const DUAL_INPUT_JUMP = 6;
export const DUAL_INPUT_RANGES: readonly InputRange[] = [inputRange(DUAL_INPUT_JUMP, [0, 1])];

/** The minimum ticks between any two obstacles, either side, at this tick. */
export function dualSeparation(tick: number): number {
  return tick < DUAL_SEP_SWITCH_TICK ? DUAL_SEP_EARLY : DUAL_SEP_LATE;
}

/** The scroll speed in 1/256 px a tick at this tick. */
export function dualScroll(tick: number): number {
  const steps = Math.trunc(tick / DUAL_SCROLL_PERIOD_TICKS);
  const speed = DUAL_SCROLL_START_FP + steps * DUAL_SCROLL_STEP_FP;
  return Math.min(DUAL_SCROLL_CAP_FP, speed);
}

/**
 * Integer height of a runner in px: an arc of {@link DUAL_JUMP_PEAK} over the
 * jump, starting from `base` (non-zero after a mid-air jump) and easing it out.
 */
export function dualJumpHeight(start: number, base: number, until: number, tick: number): number {
  if (tick >= until) return 0;
  const u = tick - start;
  const t = DUAL_JUMP_TICKS;
  const arc = Math.trunc((4 * DUAL_JUMP_PEAK * u * (t - u)) / (t * t));
  return arc + Math.trunc((base * (t - u)) / t);
}

/* ================================ State ================================ */

export interface DualState {
  tick: number;
  rng: number;
  /** Arrival ticks, ascending, for each side. */
  left: number[];
  right: number[];
  /** The tick each runner is airborne until (0 means grounded). */
  leftUntil: number;
  rightUntil: number;
  /** Whether each runner has used its one mid-air jump (reset on landing). */
  leftDouble: boolean;
  rightDouble: boolean;
  /** Drawing only: the tick the current arc started and the height it started from. */
  leftStart: number;
  rightStart: number;
  leftBase: number;
  rightBase: number;
  passed: number;
  jumps: number;
  dead: boolean;
  /** 0 left, 1 right, −1 when nothing crashed. */
  deadSide: number;
  endedTick: number;
}

/**
 * One merged schedule: every obstacle, whichever side, is at least
 * {@link dualSeparation} ticks after the last, so a tap is always free.
 */
function buildSchedule(seed: number): { rng: number; left: number[]; right: number[] } {
  let rng = seed | 0;
  const left: number[] = [];
  const right: number[] = [];
  let tick = DUAL_FIRST_TICK;
  while (tick <= DUAL_RUN_TICKS) {
    const pick = rngBelow(rng, 2);
    rng = pick.state;
    if (pick.value === 0) left.push(tick);
    else right.push(tick);
    const jitter = rngBelow(rng, DUAL_GAP_SPAN);
    rng = jitter.state;
    tick += dualSeparation(tick) + DUAL_GAP_EXTRA + jitter.value;
  }
  return { rng, left, right };
}

function init(seed: number): DualState {
  const built = buildSchedule(seed);
  return {
    tick: 0,
    rng: built.rng,
    left: built.left,
    right: built.right,
    leftUntil: 0,
    rightUntil: 0,
    leftDouble: false,
    rightDouble: false,
    leftStart: 0,
    rightStart: 0,
    leftBase: 0,
    rightBase: 0,
    passed: 0,
    jumps: 0,
    dead: false,
    deadSide: -1,
    endedTick: 0,
  };
}

function isOver(state: DualState): boolean {
  return state.dead || state.tick >= DUAL_RUN_TICKS;
}

export function dualSurvived(state: DualState): boolean {
  return !state.dead && state.tick >= DUAL_RUN_TICKS;
}

/** True when an obstacle on this side is in front of the runner at this tick. */
function atRunner(schedule: readonly number[], tick: number): boolean {
  for (const arrival of schedule) {
    if (arrival > tick) return false;
    if (tick < arrival + DUAL_HIT_TICKS) return true;
  }
  return false;
}

/** Obstacles fully behind the runner on this side at this tick. */
export function dualPassedOn(schedule: readonly number[], tick: number): number {
  let count = 0;
  for (const arrival of schedule) {
    if (arrival + DUAL_HIT_TICKS <= tick) count += 1;
    else break;
  }
  return count;
}

function step(state: DualState, input: ArcadeInputEvent | null): DualState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let { leftUntil, rightUntil, jumps, leftDouble, rightDouble } = state;
  let { leftStart, rightStart, leftBase, rightBase } = state;
  // Landing gives the mid-air jump back.
  if (tick >= leftUntil) leftDouble = false;
  if (tick >= rightUntil) rightDouble = false;

  if (input && input.k === DUAL_INPUT_JUMP) {
    const side = clampInt(input.a, 0, 1);
    // Grounded: a jump. In the air: one extra jump, then nothing until landing.
    if (side === 0 && (tick >= leftUntil || !leftDouble)) {
      if (tick < leftUntil) leftDouble = true;
      leftBase = dualJumpHeight(leftStart, leftBase, leftUntil, tick);
      leftStart = tick;
      leftUntil = tick + DUAL_JUMP_TICKS;
      jumps += 1;
    } else if (side === 1 && (tick >= rightUntil || !rightDouble)) {
      if (tick < rightUntil) rightDouble = true;
      rightBase = dualJumpHeight(rightStart, rightBase, rightUntil, tick);
      rightStart = tick;
      rightUntil = tick + DUAL_JUMP_TICKS;
      jumps += 1;
    }
  }

  const leftHit = tick >= leftUntil && atRunner(state.left, tick);
  const rightHit = tick >= rightUntil && atRunner(state.right, tick);
  if (leftHit || rightHit) {
    return {
      ...state,
      tick,
      leftUntil,
      rightUntil,
      leftDouble,
      rightDouble,
      leftStart,
      rightStart,
      leftBase,
      rightBase,
      jumps,
      dead: true,
      deadSide: leftHit ? 0 : 1,
      endedTick: tick,
    };
  }

  const passed = dualPassedOn(state.left, tick) + dualPassedOn(state.right, tick);
  const next: DualState = {
    ...state,
    tick,
    leftUntil,
    rightUntil,
    leftDouble,
    rightDouble,
    leftStart,
    rightStart,
    leftBase,
    rightBase,
    jumps,
    passed,
  };
  if (tick >= DUAL_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: DualState): number {
  const earned = parPoints(state.passed, DUAL_PAR);
  return clampInt(earned + (dualSurvived(state) ? ARCADE_COMPLETION_BONUS : 0), 0, 150);
}

/* =========================== Integrity checks ========================== */

export const DUAL_CHECKPOINT_INTERVAL = 300;

export interface DualCheckpointState {
  tick: number;
  passed: number;
  jumps: number;
  leftUntil: number;
  rightUntil: number;
  leftPassed: number;
  rightPassed: number;
  scroll: number;
}

export interface DualCheckpoint extends DualCheckpointState {
  checksum: number;
}

export function dualCheckpointState(state: DualState): DualCheckpointState {
  return {
    tick: state.tick,
    passed: state.passed,
    jumps: state.jumps,
    leftUntil: state.leftUntil,
    rightUntil: state.rightUntil,
    leftPassed: dualPassedOn(state.left, state.tick),
    rightPassed: dualPassedOn(state.right, state.tick),
    scroll: dualScroll(state.tick),
  };
}

/** 32-bit FNV-1a over the integer snapshot. */
export function dualCheckpoint(state: DualState): DualCheckpoint {
  const snapshot = dualCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const DUAL_BG = "#0B0B0F";
export const DUAL_RUNNER = "#F5B82E";
export const DUAL_BLOCK = "#FF4D4D";
export const DUAL_GROUND = "#2A2A33";

function drawSide(
  ctx: CanvasRenderingContext2D,
  state: DualState,
  schedule: readonly number[],
  until: number,
  start: number,
  base: number,
  originX: number,
): void {
  const speed = dualScroll(state.tick) / 256;
  ctx.save();
  ctx.beginPath();
  ctx.rect(originX, DUAL_HUD_H, DUAL_PANEL_W, DUAL_WORLD_H - DUAL_HUD_H);
  ctx.clip();

  ctx.fillStyle = DUAL_GROUND;
  ctx.fillRect(originX + 4, DUAL_GROUND_Y, DUAL_PANEL_W - 8, 6);

  ctx.fillStyle = DUAL_BLOCK;
  for (const arrival of schedule) {
    const x = originX + DUAL_RUNNER_X + (arrival - state.tick) * speed;
    if (x < originX - 60) continue;
    if (x > originX + DUAL_PANEL_W + 60) break;
    ctx.fillRect(x - DUAL_BLOCK_W / 2, DUAL_GROUND_Y - DUAL_BLOCK_H, DUAL_BLOCK_W, DUAL_BLOCK_H);
  }

  const height = dualJumpHeight(start, base, until, state.tick);
  ctx.fillStyle = DUAL_RUNNER;
  ctx.beginPath();
  ctx.arc(
    originX + DUAL_RUNNER_X,
    DUAL_GROUND_Y - DUAL_RUNNER_R - height,
    DUAL_RUNNER_R,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: DualState, size: CanvasSize): void {
  const scale = Math.min(size.width / DUAL_WORLD_W, size.height / DUAL_WORLD_H);
  const offsetX = (size.width - DUAL_WORLD_W * scale) / 2;
  const offsetY = (size.height - DUAL_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = DUAL_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawSide(ctx, state, state.left, state.leftUntil, state.leftStart, state.leftBase, 0);
  drawSide(
    ctx,
    state,
    state.right,
    state.rightUntil,
    state.rightStart,
    state.rightBase,
    DUAL_PANEL_W,
  );

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DUAL_PANEL_W + 0.5, DUAL_HUD_H);
  ctx.lineTo(DUAL_PANEL_W + 0.5, DUAL_WORLD_H);
  ctx.stroke();

  const remaining = Math.max(0, DUAL_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Passed ${state.passed}`, 14, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, DUAL_WORLD_W - 14, 12);

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(state.deadSide === 0 ? 0 : DUAL_PANEL_W, 0, DUAL_PANEL_W, DUAL_WORLD_H);
  }

  ctx.restore();
}

export const dualGame: ArcadeGame<DualState, ArcadeInputEvent | null> = {
  key: "dual",
  runTicks: DUAL_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: DUAL_INPUT_RANGES,
};
