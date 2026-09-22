/**
 * Breaker — an arcade game on the shared engine.
 *
 * A paddle follows the finger, a ball clears a wall of bricks. The wall (and
 * which bricks are solid) is drawn once at init from the seed, so everyone gets
 * the same wall. Every value in the state is an integer in 1/256-pixel units and
 * no randomness is drawn during play except the relaunch angle, which comes from
 * the seeded generator carried in the state.
 */

import {
  clampInt,
  inputRange,
  isqrt,
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

export const BRK_WORLD_W = 390;
export const BRK_WORLD_H = 620;
export const BRK_HUD_H = 44;
export const BRK_WALL = 8;

export const BRK_RUN_SECONDS = 60;
export const BRK_RUN_TICKS = BRK_RUN_SECONDS * TICKS_PER_SECOND;

export const BRK_COLS = 8;
export const BRK_ROWS = 6;
export const BRK_BRICKS = BRK_COLS * BRK_ROWS;
export const BRK_BRICK_W = 44;
export const BRK_BRICK_H = 20;
export const BRK_ROW_PITCH = 24;
export const BRK_WALL_X = 19;
export const BRK_WALL_Y = 70;
/** Eight of the forty-eight bricks take two hits. */
export const BRK_SOLID = 8;
/** Hits needed to clear the whole wall. */
export const BRK_TOTAL_HITS = BRK_BRICKS + BRK_SOLID;

export const BRK_PADDLE_W = 84;
export const BRK_PADDLE_H = 12;
export const BRK_PADDLE_LIFT = 60;
export const BRK_PADDLE_Y = BRK_WORLD_H - BRK_PADDLE_LIFT - BRK_PADDLE_H;
export const BRK_PADDLE_Y_FP = BRK_PADDLE_Y * 256;

export const BRK_BALL_R = 6;
export const BRK_BALL_R_FP = BRK_BALL_R * 256;

/** 4.0 px a tick, +0.1 a brick, capped at 7.0. */
export const BRK_SPEED_START = 1024;
export const BRK_SPEED_STEP = 26;
export const BRK_SPEED_CAP = 1792;

/** Losing the ball costs three seconds, not the run. */
export const BRK_RELAUNCH_TICKS = 3 * TICKS_PER_SECOND;

export const BRK_HIT_POINTS = 2;
export const BRK_POINTS_CAP = 110;
export const BRK_CLEAR_BONUS = 40;

/** Five paddle zones, each with its own launch direction (256ths). */
export const BRK_ZONES: readonly (readonly [number, number])[] = [
  [-210, -147],
  [-128, -222],
  [0, -256],
  [128, -222],
  [210, -147],
];

export const BRK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, BRK_WORLD_W]),
];

/* ================================ State ================================ */

export interface BrkState {
  tick: number;
  rng: number;
  /** Hits left in each brick: 0 gone, 1 plain, 2 solid. */
  bricks: number[];
  hits: number;
  losses: number;
  /** The last drag position the phone reported, in whole pixels. */
  aimX: number;
  paddleX: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  /** Ticks of relaunch pause left. */
  pause: number;
  cleared: boolean;
  endedTick: number;
}

export function brkBricksLeft(state: BrkState): number {
  let left = 0;
  for (const hits of state.bricks) if (hits > 0) left += 1;
  return left;
}

function paddleLeft(state: BrkState): number {
  return state.paddleX - BRK_PADDLE_W / 2;
}

function restBall(state: BrkState): { x: number; y: number } {
  return {
    x: state.paddleX * 256,
    y: BRK_PADDLE_Y_FP - BRK_BALL_R_FP,
  };
}

function launch(rng: number, speed: number): { rng: number; vx: number; vy: number } {
  const pick = rngBelow(rng, BRK_ZONES.length);
  const zone = BRK_ZONES[pick.value] ?? BRK_ZONES[2]!;
  const scaled = setLength(zone[0], zone[1], speed);
  return { rng: pick.state, vx: scaled.vx, vy: scaled.vy };
}

function init(seed: number): BrkState {
  let rng = seed | 0;
  const bricks = new Array<number>(BRK_BRICKS).fill(1);
  let placed = 0;
  for (let guard = 0; guard < 400 && placed < BRK_SOLID; guard++) {
    const draw = rngBelow(rng, BRK_BRICKS);
    rng = draw.state;
    if (bricks[draw.value] === 1) {
      bricks[draw.value] = 2;
      placed += 1;
    }
  }
  const paddleX = BRK_WORLD_W / 2;
  const first = launch(rng, BRK_SPEED_START);
  return {
    tick: 0,
    rng: first.rng,
    bricks,
    hits: 0,
    losses: 0,
    aimX: Math.round(paddleX),
    paddleX: Math.round(paddleX),
    x: Math.round(paddleX) * 256,
    y: BRK_PADDLE_Y_FP - BRK_BALL_R_FP,
    vx: first.vx,
    vy: first.vy,
    speed: BRK_SPEED_START,
    pause: 0,
    cleared: false,
    endedTick: 0,
  };
}

function isOver(state: BrkState): boolean {
  return state.cleared || state.tick >= BRK_RUN_TICKS;
}

/** The brick under a point, or -1. */
export function brkBrickAt(xPx: number, yPx: number): number {
  const col = Math.trunc((xPx - BRK_WALL_X) / BRK_BRICK_W);
  const row = Math.trunc((yPx - BRK_WALL_Y) / BRK_ROW_PITCH);
  if (col < 0 || col >= BRK_COLS || row < 0 || row >= BRK_ROWS) return -1;
  if (xPx < BRK_WALL_X || yPx < BRK_WALL_Y) return -1;
  const withinRow = yPx - (BRK_WALL_Y + row * BRK_ROW_PITCH);
  if (withinRow < 0 || withinRow > BRK_BRICK_H) return -1;
  return row * BRK_COLS + col;
}

function step(state: BrkState, input: ArcadeInputEvent | null): BrkState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let aimX = state.aimX;
  if (input && input.k === ARCADE_INPUT_DRAG) aimX = clampInt(input.a, 0, BRK_WORLD_W);
  const paddleX = clampInt(
    aimX,
    BRK_WALL + BRK_PADDLE_W / 2,
    BRK_WORLD_W - BRK_WALL - BRK_PADDLE_W / 2,
  );

  const next: BrkState = { ...state, tick, aimX, paddleX };

  if (next.pause > 0) {
    next.pause -= 1;
    const rest = restBall(next);
    next.x = rest.x;
    next.y = rest.y;
    if (next.pause === 0) {
      const again = launch(next.rng, next.speed);
      next.rng = again.rng;
      next.vx = again.vx;
      next.vy = again.vy;
    }
    if (tick >= BRK_RUN_TICKS) next.endedTick = tick;
    return next;
  }

  const bricks = state.bricks.slice();
  let { x, y, vx, vy, speed, hits, losses } = next;
  const top = (BRK_HUD_H + BRK_WALL) * 256;
  const leftWall = BRK_WALL * 256;
  const rightWall = (BRK_WORLD_W - BRK_WALL) * 256;

  // Four sub-steps a tick: the ball never moves more than two pixels at once,
  // so it cannot slip through a brick.
  for (let sub = 0; sub < 4; sub++) {
    const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
    const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);

    x += sx;
    if (x - BRK_BALL_R_FP < leftWall) {
      x = leftWall + BRK_BALL_R_FP;
      vx = -vx;
    } else if (x + BRK_BALL_R_FP > rightWall) {
      x = rightWall - BRK_BALL_R_FP;
      vx = -vx;
    }

    y += sy;
    if (y - BRK_BALL_R_FP < top) {
      y = top + BRK_BALL_R_FP;
      vy = -vy;
    }

    const brick = brkBrickAt(px(x), px(y));
    if (brick >= 0 && (bricks[brick] ?? 0) > 0) {
      bricks[brick] = (bricks[brick] ?? 0) - 1;
      hits += 1;
      speed = Math.min(BRK_SPEED_CAP, speed + BRK_SPEED_STEP);
      const rescaled = setLength(vx, -vy, speed);
      vx = rescaled.vx;
      vy = rescaled.vy;
    }

    // The paddle: caught only while falling onto its top edge.
    if (vy > 0 && y + BRK_BALL_R_FP >= BRK_PADDLE_Y_FP && y < BRK_PADDLE_Y_FP + 4 * 256) {
      const offset = px(x) - paddleLeft(next);
      if (offset >= -BRK_BALL_R && offset <= BRK_PADDLE_W + BRK_BALL_R) {
        const zone = clampInt(
          Math.trunc((clampInt(Math.round(offset), 0, BRK_PADDLE_W - 1) * 5) / BRK_PADDLE_W),
          0,
          4,
        );
        const dir = BRK_ZONES[zone] ?? BRK_ZONES[2]!;
        const launched = setLength(dir[0], dir[1], speed);
        vx = launched.vx;
        vy = launched.vy;
        y = BRK_PADDLE_Y_FP - BRK_BALL_R_FP;
      }
    }

    if (y - BRK_BALL_R_FP > BRK_WORLD_H * 256) {
      losses += 1;
      next.pause = BRK_RELAUNCH_TICKS;
      const rest = restBall(next);
      x = rest.x;
      y = rest.y;
      vx = 0;
      vy = 0;
      break;
    }
  }

  next.bricks = bricks;
  next.x = x;
  next.y = y;
  next.vx = vx;
  next.vy = vy;
  next.speed = speed;
  next.hits = hits;
  next.losses = losses;
  next.cleared = bricks.every((left) => left <= 0);
  if (next.cleared || tick >= BRK_RUN_TICKS) next.endedTick = tick;
  return next;
}

function score(state: BrkState): number {
  const earned = Math.min(BRK_POINTS_CAP, BRK_HIT_POINTS * state.hits);
  return clampInt(earned + (state.cleared ? BRK_CLEAR_BONUS : 0), 0, 150);
}

/* ============================= Checkpoints ============================= */

export const BRK_CHECKPOINT_INTERVAL = 300;

export interface BrkCheckpointState {
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  paddleX: number;
  hits: number;
  left: number;
  losses: number;
  pause: number;
}

export interface BrkCheckpoint extends BrkCheckpointState {
  checksum: number;
}

export function brkCheckpointState(state: BrkState): BrkCheckpointState {
  return {
    tick: state.tick,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    paddleX: state.paddleX,
    hits: state.hits,
    left: brkBricksLeft(state),
    losses: state.losses,
    pause: state.pause,
  };
}

export function brkCheckpoint(state: BrkState): BrkCheckpoint {
  const snapshot = brkCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const BRK_BG = "#0B0B0F";
export const BRK_GOLD = "#F5B82E";
export const BRK_TEAL = ["#2ED3B7", "#27B6A0", "#1F9A89", "#178073"];

function draw(ctx: CanvasRenderingContext2D, state: BrkState, size: CanvasSize): void {
  const scale = Math.min(size.width / BRK_WORLD_W, size.height / BRK_WORLD_H);
  const offsetX = (size.width - BRK_WORLD_W * scale) / 2;
  const offsetY = (size.height - BRK_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = BRK_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  state.bricks.forEach((left, index) => {
    if (left <= 0) return;
    const row = Math.trunc(index / BRK_COLS);
    const col = index % BRK_COLS;
    ctx.fillStyle = left > 1 ? "#0F766E" : (BRK_TEAL[row % BRK_TEAL.length] ?? BRK_TEAL[0]!);
    ctx.fillRect(
      BRK_WALL_X + col * BRK_BRICK_W + 1,
      BRK_WALL_Y + row * BRK_ROW_PITCH,
      BRK_BRICK_W - 2,
      BRK_BRICK_H,
    );
    if (left > 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        BRK_WALL_X + col * BRK_BRICK_W + 2.5,
        BRK_WALL_Y + row * BRK_ROW_PITCH + 1.5,
        BRK_BRICK_W - 5,
        BRK_BRICK_H - 3,
      );
    }
  });

  ctx.fillStyle = BRK_GOLD;
  ctx.fillRect(paddleLeft(state), BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H);

  ctx.beginPath();
  ctx.arc(px(state.x), px(state.y), BRK_BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = state.pause > 0 ? "rgba(245,184,46,0.45)" : "#F7F7F8";
  ctx.fill();

  const remaining = Math.max(0, BRK_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Bricks ${brkBricksLeft(state)} / ${state.hits} hits`, 14, 14);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, BRK_WORLD_W - 14, 14);

  if (state.pause > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#F5B82E";
    ctx.fillText(
      `relaunch in ${(state.pause / TICKS_PER_SECOND).toFixed(1)}s`,
      BRK_WORLD_W / 2,
      BRK_PADDLE_Y - 34,
    );
  }

  ctx.restore();
}

export const breakerGame: ArcadeGame<BrkState, ArcadeInputEvent | null> = {
  key: "breaker",
  runTicks: BRK_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: BRK_INPUT_RANGES,
};

export { isqrt };
