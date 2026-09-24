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
/** The thin javelin, enlarged 1.2× in both dimensions. */
export const DUAL_SPIKE_W = 4.8;
export const DUAL_SPIKE_H = 26.4;
export const DUAL_SPIKE_LEAN = 9.6;

/**
 * A jump is a fixed 30-tick arc, 150 px at the top (115 px × 1.3). The arc
 * length is unchanged, so the cross-side separation (a tap is always free on
 * the other side) still holds; the higher arc only widens each clearance.
 */
export const DUAL_JUMP_TICKS = 30;
export const DUAL_JUMP_PEAK = 150;

/** Time after arrival before a spike is fully behind the runner. */
export const DUAL_HIT_TICKS = 8;

/** The scroll speed used for drawing: 2.0 px a tick, +0.3 every ten seconds, cap 4.4. */
export const DUAL_SCROLL_START_FP = 512;
export const DUAL_SCROLL_STEP_FP = 77;
export const DUAL_SCROLL_CAP_FP = 1_126;
export const DUAL_SCROLL_PERIOD_TICKS = 10 * TICKS_PER_SECOND;

/**
 * No spikes in the first 5 s. On one side, consecutive spikes are at least
 * 3.0 s apart, 0.25 s less every 10 s, never below 1.0 s; each gap adds up to
 * DUAL_GAP_SPAN ticks from the seed.
 */
export const DUAL_FIRST_TICK = 5 * TICKS_PER_SECOND;
export const DUAL_SIDE_GAP_START = 180;
export const DUAL_SIDE_GAP_STEP = 15;
export const DUAL_SIDE_GAP_MIN = 60;
export const DUAL_GAP_SPAN = 30;

/** Minimum ticks between two spikes on the same side, at this tick. */
export function dualSideGap(tick: number): number {
  const steps = Math.trunc(tick / (10 * TICKS_PER_SECOND));
  return Math.max(DUAL_SIDE_GAP_MIN, DUAL_SIDE_GAP_START - steps * DUAL_SIDE_GAP_STEP);
}

/** Baseline cross-side separation, before accounting for the spike's collision width. */
export const DUAL_SEP_EARLY = 20;
export const DUAL_SEP_LATE = 12;
export const DUAL_SEP_SWITCH_TICK = 20 * TICKS_PER_SECOND;

/** Score: floor(150 × (seconds survived ÷ 60)²). */
export function dualScoreForTicks(ticks: number): number {
  const t = clampInt(ticks, 0, DUAL_RUN_TICKS);
  return Math.trunc((150 * t * t) / (DUAL_RUN_TICKS * DUAL_RUN_TICKS));
}

/** A jump: a = 0 left runner, 1 right runner. */
export const DUAL_INPUT_JUMP = 6;
export const DUAL_INPUT_RANGES: readonly InputRange[] = [inputRange(DUAL_INPUT_JUMP, [0, 1])];

/** The minimum ticks between any two obstacles, either side, at this tick. */
export function dualSeparation(tick: number): number {
  const baseline = tick < DUAL_SEP_SWITCH_TICK ? DUAL_SEP_EARLY : DUAL_SEP_LATE;
  // Allow the whole enlarged javelin to clear one runner before the next arrives.
  const collisionWidth = 2 * DUAL_RUNNER_R + DUAL_SPIKE_LEAN + DUAL_SPIKE_W;
  return Math.max(baseline, Math.ceil((collisionWidth * 256) / dualScroll(tick)) + 1);
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
  const next = [0, 0];
  for (let side = 0; side < 2; side++) {
    const jitter = rngBelow(rng, DUAL_GAP_SPAN);
    rng = jitter.state;
    next[side] = DUAL_FIRST_TICK + jitter.value;
  }
  let last = -1_000;
  for (;;) {
    const side = next[0]! <= next[1]! ? 0 : 1;
    const tick = Math.max(next[side]!, last + dualSeparation(Math.max(last, 0)));
    if (tick > DUAL_RUN_TICKS) break;
    (side === 0 ? left : right).push(tick);
    last = tick;
    const jitter = rngBelow(rng, DUAL_GAP_SPAN);
    rng = jitter.state;
    next[side] = tick + dualSideGap(tick) + jitter.value;
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

/** Circle vs the javelin shaft and point, in world coordinates. */
function touchesSpike(x: number, runnerY: number): boolean {
  const tipX = x - DUAL_SPIKE_LEAN;
  const tipY = DUAL_GROUND_Y - DUAL_SPIKE_H;
  const baseY = DUAL_GROUND_Y - 4;
  const dx = x - tipX;
  const dy = baseY - tipY;
  const projection = Math.max(
    0,
    Math.min(dx * dx + dy * dy, (DUAL_RUNNER_X - tipX) * dx + (runnerY - tipY) * dy),
  );
  const nearX = tipX + (projection * dx) / (dx * dx + dy * dy);
  const nearY = tipY + (projection * dy) / (dx * dx + dy * dy);
  const distanceX = DUAL_RUNNER_X - nearX;
  const distanceY = runnerY - nearY;
  const reach = DUAL_RUNNER_R + DUAL_SPIKE_W / 2;
  return distanceX * distanceX + distanceY * distanceY <= reach * reach;
}

function atRunner(schedule: readonly number[], tick: number, height: number): boolean {
  const speed = dualScroll(tick) / 256;
  const runnerY = DUAL_GROUND_Y - DUAL_RUNNER_R - height;
  for (const arrival of schedule) {
    const x = DUAL_RUNNER_X + (arrival - tick) * speed;
    if (x > DUAL_RUNNER_X + DUAL_RUNNER_R + DUAL_SPIKE_LEAN + DUAL_SPIKE_W) return false;
    if (x < DUAL_RUNNER_X - DUAL_RUNNER_R - DUAL_SPIKE_W) continue;
    if (touchesSpike(x, runnerY)) return true;
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

  const leftHit = atRunner(state.left, tick, dualJumpHeight(leftStart, leftBase, leftUntil, tick));
  const rightHit = atRunner(
    state.right,
    tick,
    dualJumpHeight(rightStart, rightBase, rightUntil, tick),
  );
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
  return clampInt(dualScoreForTicks(state.tick), 0, 150);
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
export const DUAL_SPIKE = "#FF4D4D";
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

  ctx.fillStyle = DUAL_SPIKE;
  for (const arrival of schedule) {
    const x = originX + DUAL_RUNNER_X + (arrival - state.tick) * speed;
    if (x < originX - 60) continue;
    if (x > originX + DUAL_PANEL_W + 60) break;
    ctx.beginPath();
    ctx.moveTo(x - DUAL_SPIKE_LEAN, DUAL_GROUND_Y - DUAL_SPIKE_H);
    ctx.lineTo(x - DUAL_SPIKE_LEAN + DUAL_SPIKE_W, DUAL_GROUND_Y - DUAL_SPIKE_H + DUAL_SPIKE_H * (9 / 22));
    ctx.lineTo(x + DUAL_SPIKE_W / 2, DUAL_GROUND_Y - 4);
    ctx.lineTo(x - DUAL_SPIKE_W / 2, DUAL_GROUND_Y - 4);
    ctx.lineTo(x - DUAL_SPIKE_LEAN - DUAL_SPIKE_W, DUAL_GROUND_Y - DUAL_SPIKE_H + DUAL_SPIKE_H * (9 / 22));
    ctx.closePath();
    ctx.fill();
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
