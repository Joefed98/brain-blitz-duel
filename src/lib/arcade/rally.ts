/**
 * Rally — an arcade game on the shared engine.
 *
 * One main ball and a paddle that follows the finger. Every return counts,
 * shrinks the paddle and speeds the ball up. Every ten seconds a gold ball
 * drops in through the top edge; its entry point, angle and speed are drawn
 * once at init from the seed. The opening angle and the small angle changes on
 * wall bounces come from the seeded generator carried in the state, so the
 * rally plays out identically on the phone and on the server.
 */

import {
  clampInt,
  inputRange,
  px,
  rngBelow,
  setLength,
  ARCADE_INPUT_DRAG,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

export const RALLY_WORLD_W = 390;
export const RALLY_WORLD_H = 620;
export const RALLY_HUD_H = 44;
export const RALLY_WALL = 8;

export const RALLY_RUN_SECONDS = 60;
export const RALLY_RUN_TICKS = RALLY_RUN_SECONDS * TICKS_PER_SECOND;

export const RALLY_PADDLE_START_W = 120;
export const RALLY_PADDLE_MIN_W = 40;
export const RALLY_PADDLE_SHRINK = 5;
export const RALLY_PADDLE_H = 12;
export const RALLY_PADDLE_Y = 560;
export const RALLY_PADDLE_Y_FP = RALLY_PADDLE_Y * 256;

export const RALLY_BALL_R = 7;
export const RALLY_BALL_R_FP = RALLY_BALL_R * 256;

/** 4.0 px a tick, 3% faster a hit, capped at 2.2× the start. */
export const RALLY_SPEED_START = 1024;
export const RALLY_SPEED_CAP = Math.trunc((RALLY_SPEED_START * 22) / 10);

/** A gold ball joins every ten seconds. */
export const RALLY_GOLD_INTERVAL = 10 * TICKS_PER_SECOND;
export const RALLY_GOLD_COUNT = 5;

/** A wall bounce nudges the angle by up to this much (1/256 px a tick). */
export const RALLY_JITTER = 28;
/** The ball never travels flatter than this, so a rally cannot stall. */
export const RALLY_MIN_VY = 120;

/** Par: thirty hits (gold hits count double). */
export const RALLY_PAR = 30;
export const RALLY_HIT_POINTS = 3;
export const RALLY_GOLD_POINTS = 3;
export const RALLY_POINTS_CAP = 110;
export const RALLY_SURVIVE_BONUS = 40;

export const RALLY_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, RALLY_WORLD_W]),
];

export function rallyPaddleW(hits: number): number {
  return Math.max(RALLY_PADDLE_MIN_W, RALLY_PADDLE_START_W - RALLY_PADDLE_SHRINK * hits);
}

/* ================================ State ================================ */

export interface RallyBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** A gold ball's scheduled entry, fixed at init from the seed. */
export interface RallyEntry {
  tick: number;
  x: number;
  vx: number;
  vy: number;
}

export interface RallyState {
  tick: number;
  rng: number;
  aimX: number;
  paddleX: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  hits: number;
  goldHits: number;
  /** The fixed gold-ball schedule and the gold balls in play. */
  entries: RallyEntry[];
  golds: RallyBall[];
  dead: boolean;
  endedTick: number;
}

/** Total returns, which is what shrinks the paddle. */
export function rallyTotalHits(state: RallyState): number {
  return state.hits + state.goldHits;
}

function init(seed: number): RallyState {
  let rng = seed | 0;
  const lean = rngBelow(rng, 2 * 160 + 1);
  rng = lean.state;
  const opening = setLength(lean.value - 160, -256, RALLY_SPEED_START);

  const entries: RallyEntry[] = [];
  for (let index = 0; index < RALLY_GOLD_COUNT; index++) {
    const spot = rngBelow(rng, RALLY_WORLD_W - 2 * (RALLY_WALL + RALLY_BALL_R));
    rng = spot.state;
    const lane = rngBelow(rng, 2 * 160 + 1);
    rng = lane.state;
    const pace = rngBelow(rng, 420);
    rng = pace.state;
    const drop = setLength(lane.value - 160, 256, RALLY_SPEED_START - 180 + pace.value);
    entries.push({
      tick: (index + 1) * RALLY_GOLD_INTERVAL,
      x: RALLY_WALL + RALLY_BALL_R + spot.value,
      vx: drop.vx,
      vy: drop.vy,
    });
  }

  const paddleX = Math.round(RALLY_WORLD_W / 2);
  return {
    tick: 0,
    rng,
    aimX: paddleX,
    paddleX,
    x: paddleX * 256,
    y: (RALLY_HUD_H + 120) * 256,
    vx: opening.vx,
    vy: opening.vy,
    speed: RALLY_SPEED_START,
    hits: 0,
    goldHits: 0,
    entries,
    golds: [],
    dead: false,
    endedTick: 0,
  };
}

function isOver(state: RallyState): boolean {
  return state.dead || state.tick >= RALLY_RUN_TICKS;
}

export function rallySurvived(state: RallyState): boolean {
  return !state.dead && state.tick >= RALLY_RUN_TICKS;
}

/** A bounce nudge from the seeded generator, so both sides agree exactly. */
function nudge(
  rng: number,
  speed: number,
  vx: number,
  vy: number,
): { rng: number; vx: number; vy: number } {
  const draw = rngBelow(rng, 2 * RALLY_JITTER + 1);
  const shifted = setLength(vx + draw.value - RALLY_JITTER, vy, speed);
  let out = shifted;
  if (Math.abs(out.vy) < RALLY_MIN_VY) {
    out = setLength(out.vx, out.vy < 0 ? -RALLY_MIN_VY : RALLY_MIN_VY, speed);
  }
  return { rng: draw.state, vx: out.vx, vy: out.vy };
}

function step(state: RallyState, input: ArcadeInputEvent | null): RallyState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let aimX = state.aimX;
  if (input && input.k === ARCADE_INPUT_DRAG) aimX = clampInt(input.a, 0, RALLY_WORLD_W);
  const width = rallyPaddleW(rallyTotalHits(state));
  const half = Math.trunc(width / 2);
  const paddleX = clampInt(aimX, RALLY_WALL + half, RALLY_WORLD_W - RALLY_WALL - half);

  const next: RallyState = { ...state, tick, aimX, paddleX };
  let { speed, hits, goldHits, rng } = next;
  const top = (RALLY_HUD_H + RALLY_WALL) * 256;
  const leftWall = RALLY_WALL * 256;
  const rightWall = (RALLY_WORLD_W - RALLY_WALL) * 256;

  let golds = state.golds.map((ball) => ({ ...ball }));
  for (const entry of state.entries) {
    if (entry.tick === tick) {
      golds.push({ x: entry.x * 256, y: top + RALLY_BALL_R_FP, vx: entry.vx, vy: entry.vy });
    }
  }

  /** Runs one ball for a tick. Returns null when it fell off the bottom. */
  const move = (ball: RallyBall, gold: boolean): RallyBall | null => {
    let { x, y, vx, vy } = ball;
    for (let sub = 0; sub < 4; sub++) {
      const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
      const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);

      x += sx;
      if (x - RALLY_BALL_R_FP < leftWall || x + RALLY_BALL_R_FP > rightWall) {
        x =
          x - RALLY_BALL_R_FP < leftWall ? leftWall + RALLY_BALL_R_FP : rightWall - RALLY_BALL_R_FP;
        const turned = nudge(rng, speed, -vx, vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
      }

      y += sy;
      if (y - RALLY_BALL_R_FP < top) {
        y = top + RALLY_BALL_R_FP;
        const turned = nudge(rng, speed, vx, -vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
      }

      if (vy > 0 && y + RALLY_BALL_R_FP >= RALLY_PADDLE_Y_FP && y < RALLY_PADDLE_Y_FP + 4 * 256) {
        const offset = px(x) - (paddleX - half);
        if (offset >= -RALLY_BALL_R && offset <= width + RALLY_BALL_R) {
          if (gold) goldHits += 1;
          else hits += 1;
          speed = Math.min(RALLY_SPEED_CAP, Math.trunc((speed * 103) / 100));
          // Where it lands on the paddle steers the return.
          const fromCentre = Math.round(offset - half);
          const steered = setLength(
            Math.trunc((fromCentre * 256) / Math.max(1, half)) + Math.trunc(vx / 4),
            -Math.max(RALLY_MIN_VY, Math.abs(vy)),
            speed,
          );
          vx = steered.vx;
          vy = steered.vy;
          y = RALLY_PADDLE_Y_FP - RALLY_BALL_R_FP;
        }
      }

      if (y - RALLY_BALL_R_FP > RALLY_WORLD_H * 256) return null;
    }
    return { x, y, vx, vy };
  };

  const main = move({ x: next.x, y: next.y, vx: next.vx, vy: next.vy }, false);
  if (main === null) {
    next.dead = true;
  } else {
    next.x = main.x;
    next.y = main.y;
    next.vx = main.vx;
    next.vy = main.vy;
  }

  const keptGolds: RallyBall[] = [];
  for (const ball of golds) {
    const moved = move(ball, true);
    if (moved !== null) keptGolds.push(moved);
  }
  golds = keptGolds;

  next.golds = golds;
  next.speed = speed;
  next.hits = hits;
  next.goldHits = goldHits;
  next.rng = rng;
  if (next.dead || tick >= RALLY_RUN_TICKS) next.endedTick = tick;
  return next;
}

function score(state: RallyState): number {
  // Only gold-ball hits score; the blue ball scores nothing but losing it ends the run.
  return clampInt(RALLY_GOLD_POINTS * state.goldHits, 0, 150);
}

/* ============================= Checkpoints ============================= */

export const RALLY_CHECKPOINT_INTERVAL = 300;

export interface RallyCheckpointState {
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  paddleX: number;
  hits: number;
  goldHits: number;
  golds: number;
  width: number;
}

export interface RallyCheckpoint extends RallyCheckpointState {
  checksum: number;
}

export function rallyCheckpointState(state: RallyState): RallyCheckpointState {
  return {
    tick: state.tick,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    paddleX: state.paddleX,
    hits: state.hits,
    goldHits: state.goldHits,
    golds: state.golds.length,
    width: rallyPaddleW(rallyTotalHits(state)),
  };
}

export function rallyCheckpoint(state: RallyState): RallyCheckpoint {
  const snapshot = rallyCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const RALLY_BG = "#0B0B0F";
export const RALLY_GOLD = "#F5B82E";
export const RALLY_BALL = "#4D8CFF";

function draw(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  const scale = Math.min(size.width / RALLY_WORLD_W, size.height / RALLY_WORLD_H);
  const offsetX = (size.width - RALLY_WORLD_W * scale) / 2;
  const offsetY = (size.height - RALLY_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = RALLY_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.lineTo(RALLY_WORLD_W - RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.moveTo(RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.lineTo(RALLY_WALL, RALLY_WORLD_H);
  ctx.moveTo(RALLY_WORLD_W - RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.lineTo(RALLY_WORLD_W - RALLY_WALL, RALLY_WORLD_H);
  ctx.stroke();

  const width = rallyPaddleW(rallyTotalHits(state));
  ctx.fillStyle = RALLY_GOLD;
  ctx.fillRect(state.paddleX - width / 2, RALLY_PADDLE_Y, width, RALLY_PADDLE_H);

  for (const ball of state.golds) {
    ctx.beginPath();
    ctx.arc(px(ball.x), px(ball.y), RALLY_BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = RALLY_GOLD;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(px(state.x), px(state.y), RALLY_BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = RALLY_BALL;
  ctx.fill();

  const remaining = Math.max(0, RALLY_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Rally ${state.hits}`, 14, 14);
  ctx.textAlign = "center";
  ctx.fillStyle = RALLY_GOLD;
  ctx.fillText(`gold ${state.goldHits} · ${RALLY_GOLD_POINTS * state.goldHits} pts`, RALLY_WORLD_W / 2, 14);
  ctx.fillStyle = "#F7F7F8";
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, RALLY_WORLD_W - 14, 14);

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, RALLY_WORLD_W, RALLY_WORLD_H);
  }

  ctx.restore();
}

export const rallyGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  key: "rally",
  runTicks: RALLY_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: RALLY_INPUT_RANGES,
};
