/**
 * Breaker — an arcade game on the shared engine.
 *
 * A paddle follows the finger, balls clear a wall of bricks. The wall, which
 * bricks are solid, which three are gold and which power-up each gold brick
 * carries are all drawn once at init from the seed, so everyone gets the same
 * board. Every value in the state is an integer in 1/256-pixel units and no
 * randomness is drawn during play except the relaunch angle, which comes from
 * the seeded generator carried in the state.
 */

import {
  clampInt,
  inputRange,
  isqrt,
  px,
  rngBelow,
  setLength,
  ARCADE_INPUT_BUTTON,
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
export const BRK_ROWS = 9;
export const BRK_BRICKS = BRK_COLS * BRK_ROWS;
export const BRK_BRICK_W = 44;
export const BRK_BRICK_H = 20;
export const BRK_ROW_PITCH = 24;
export const BRK_WALL_X = 19;
export const BRK_WALL_Y = 70;
/** Eight of the seventy-two bricks take two hits. */
export const BRK_SOLID = 8;
/** Hits needed to clear the whole wall. */
export const BRK_TOTAL_HITS = BRK_BRICKS + BRK_SOLID;

/** Four gold bricks (two MULTI, one SPAM, one LASER), never in the bottom row. */
export const BRK_GOLD_BRICKS = 4;
export const BRK_POWER_MULTI = 0;
export const BRK_POWER_SPAM = 1;
export const BRK_POWER_LASER = 2;

export const BRK_PADDLE_W = 84;
export const BRK_PADDLE_H = 12;
export const BRK_PADDLE_LIFT = 60;
export const BRK_PADDLE_Y = BRK_WORLD_H - BRK_PADDLE_LIFT - BRK_PADDLE_H;
export const BRK_PADDLE_Y_FP = BRK_PADDLE_Y * 256;

export const BRK_BALL_R = 6;
export const BRK_BALL_R_FP = BRK_BALL_R * 256;
/** At most eight balls are ever in play. */
export const BRK_MAX_BALLS = 8;

/** 4.0 px a tick, +0.1 a brick, +0.2 every ten seconds, capped at 7.5. */
export const BRK_SPEED_START = 1024;
export const BRK_SPEED_STEP = 26;
export const BRK_SPEED_TIME_STEP = 51;
export const BRK_SPEED_TIME_TICKS = 10 * TICKS_PER_SECOND;
export const BRK_SPEED_CAP = 1920;

/** A capsule falls at 2.5 px a tick. */
export const BRK_CAPSULE_FALL = 640;
export const BRK_CAPSULE_W = 16;
export const BRK_CAPSULE_H = 10;

/** Spam fires five balls; laser fires once. */
export const BRK_SPAM_SHOTS = 5;

/** The power-up button, on the right edge just above the paddle drag zone. */
export const BRK_BTN_X = 336;
export const BRK_BTN_Y = 392;
export const BRK_BTN_W = 44;
export const BRK_BTN_H = 56;

/** Losing the last ball costs three seconds, not the run. */
export const BRK_RELAUNCH_TICKS = 3 * TICKS_PER_SECOND;

export const BRK_HIT_POINTS = 2;
/** Paddle drags only start in the bottom quarter of the play area. */
export const BRK_DRAG_ZONE_TOP = Math.round((BRK_WORLD_H * 3) / 4);
/** Every brick destroyed; clearing all 72 scores 150. */
export const BRK_PAR = BRK_BRICKS;
export const BRK_ALL_CLEAR_SCORE = 150;
export function brkDestroyed(state: { bricks: number[] }): number {
  return state.bricks.reduce((n, left) => (left <= 0 ? n + 1 : n), 0);
}
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
  inputRange(ARCADE_INPUT_BUTTON, [0, 1]),
];

/** Speed for a given number of brick hits and tick, in 1/256 px a tick. */
export function brkSpeedFp(hits: number, tick: number): number {
  const ramp =
    BRK_SPEED_START +
    BRK_SPEED_STEP * hits +
    BRK_SPEED_TIME_STEP * Math.trunc(tick / BRK_SPEED_TIME_TICKS);
  return Math.min(BRK_SPEED_CAP, ramp);
}

/* ================================ State ================================ */

export interface BrkBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 for a spam ball, which vanishes on its first wall bounce. */
  spam: number;
}

export interface BrkCapsule {
  x: number;
  y: number;
  /** Which power-up it carries. */
  kind: number;
}

export interface BrkState {
  tick: number;
  rng: number;
  /** Hits left in each brick: 0 gone, 1 plain, 2 solid. */
  bricks: number[];
  /** 0 for a plain brick, otherwise the power-up it carries plus one. */
  gold: number[];
  hits: number;
  losses: number;
  /** Capsules caught. */
  powerUps: number;
  balls: BrkBall[];
  capsules: BrkCapsule[];
  /** 0 none, 1 spam, 2 laser. */
  held: number;
  charges: number;
  /** Ticks the laser beam is still drawn for. */
  beam: number;
  /** The last drag position the phone reported, in whole pixels. */
  aimX: number;
  paddleX: number;
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

function paddleLeftOf(paddleX: number): number {
  return paddleX - BRK_PADDLE_W / 2;
}

function restBall(paddleX: number): BrkBall {
  return {
    x: paddleX * 256,
    y: BRK_PADDLE_Y_FP - BRK_BALL_R_FP,
    vx: 0,
    vy: 0,
    spam: 0,
  };
}

function launch(rng: number, speed: number): { rng: number; vx: number; vy: number } {
  const pick = rngBelow(rng, BRK_ZONES.length);
  const zone = BRK_ZONES[pick.value] ?? BRK_ZONES[2]!;
  const scaled = setLength(zone[0], zone[1], speed);
  return { rng: pick.state, vx: scaled.vx, vy: scaled.vy };
}

function brickCentre(index: number): { x: number; y: number } {
  const row = Math.trunc(index / BRK_COLS);
  const col = index % BRK_COLS;
  return {
    x: BRK_WALL_X + col * BRK_BRICK_W + Math.trunc(BRK_BRICK_W / 2),
    y: BRK_WALL_Y + row * BRK_ROW_PITCH + Math.trunc(BRK_BRICK_H / 2),
  };
}

function init(seed: number): BrkState {
  let rng = seed | 0;
  const bricks = new Array<number>(BRK_BRICKS).fill(1);
  const gold = new Array<number>(BRK_BRICKS).fill(0);

  // The four power-ups, in a seeded order.
  const powers = [BRK_POWER_MULTI, BRK_POWER_MULTI, BRK_POWER_SPAM, BRK_POWER_LASER];
  for (let index = powers.length - 1; index > 0; index--) {
    const draw = rngBelow(rng, index + 1);
    rng = draw.state;
    const swap = powers[index]!;
    powers[index] = powers[draw.value]!;
    powers[draw.value] = swap;
  }

  // Gold bricks come from anywhere but the bottom row.
  const goldCandidates = BRK_COLS * (BRK_ROWS - 1);
  let placedGold = 0;
  for (let guard = 0; guard < 400 && placedGold < BRK_GOLD_BRICKS; guard++) {
    const draw = rngBelow(rng, goldCandidates);
    rng = draw.state;
    if (gold[draw.value] === 0) {
      gold[draw.value] = (powers[placedGold] ?? BRK_POWER_MULTI) + 1;
      placedGold += 1;
    }
  }

  // Solid bricks never sit on a gold brick.
  let placedSolid = 0;
  for (let guard = 0; guard < 600 && placedSolid < BRK_SOLID; guard++) {
    const draw = rngBelow(rng, BRK_BRICKS);
    rng = draw.state;
    if (bricks[draw.value] === 1 && gold[draw.value] === 0) {
      bricks[draw.value] = 2;
      placedSolid += 1;
    }
  }

  const paddleX = Math.round(BRK_WORLD_W / 2);
  const first = launch(rng, BRK_SPEED_START);
  const ball = restBall(paddleX);
  ball.vx = first.vx;
  ball.vy = first.vy;
  return {
    tick: 0,
    rng: first.rng,
    bricks,
    gold,
    hits: 0,
    losses: 0,
    powerUps: 0,
    balls: [ball],
    capsules: [],
    held: 0,
    charges: 0,
    beam: 0,
    aimX: paddleX,
    paddleX,
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

/** The brick column the paddle is standing under. */
export function brkPaddleColumn(paddleX: number): number {
  return clampInt(Math.trunc((paddleX - BRK_WALL_X) / BRK_BRICK_W), 0, BRK_COLS - 1);
}

function step(state: BrkState, input: ArcadeInputEvent | null): BrkState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let aimX = state.aimX;
  let press: number | null = null;
  if (input) {
    if (input.k === ARCADE_INPUT_DRAG) aimX = clampInt(input.a, 0, BRK_WORLD_W);
    else if (input.k === ARCADE_INPUT_BUTTON) press = clampInt(input.a, 0, 1);
  }
  const paddleX = clampInt(
    aimX,
    BRK_WALL + BRK_PADDLE_W / 2,
    BRK_WORLD_W - BRK_WALL - BRK_PADDLE_W / 2,
  );

  const next: BrkState = { ...state, tick, aimX, paddleX };
  const bricks = state.bricks.slice();
  let balls = state.balls.map((ball) => ({ ...ball }));
  let capsules = state.capsules.map((capsule) => ({ ...capsule }));
  let { hits, losses, powerUps, held, charges, rng } = next;
  let beam = Math.max(0, state.beam - 1);
  let speed = brkSpeedFp(hits, tick);

  const breakBrick = (index: number): void => {
    const left = bricks[index] ?? 0;
    if (left <= 0) return;
    bricks[index] = left - 1;
    hits += 1;
    speed = brkSpeedFp(hits, tick);
    if (bricks[index] === 0) {
      const kind = (state.gold[index] ?? 0) - 1;
      if (kind >= 0) {
        const centre = brickCentre(index);
        capsules.push({ x: centre.x * 256, y: centre.y * 256, kind });
      }
    }
  };

  // The button: one press, one effect, and the button is spent.
  if (press === 1 && held === BRK_POWER_LASER) {
    const col = brkPaddleColumn(paddleX);
    for (let row = BRK_ROWS - 1; row >= 0; row--) breakBrick(row * BRK_COLS + col);
    held = 0;
    charges = 0;
    beam = 12;
  } else if (
    press === 0 &&
    held === BRK_POWER_SPAM &&
    charges > 0 &&
    balls.length < BRK_MAX_BALLS
  ) {
    balls.push({
      x: paddleX * 256,
      y: BRK_PADDLE_Y_FP - BRK_BALL_R_FP,
      vx: 0,
      vy: -speed,
      spam: 1,
    });
    charges -= 1;
    if (charges === 0) held = 0;
  }

  if (next.pause > 0) {
    next.pause -= 1;
    const resting = restBall(paddleX);
    if (next.pause === 0) {
      const again = launch(rng, speed);
      rng = again.rng;
      resting.vx = again.vx;
      resting.vy = again.vy;
    }
    balls = [resting];
  } else {
    const top = (BRK_HUD_H + BRK_WALL) * 256;
    const leftWall = BRK_WALL * 256;
    const rightWall = (BRK_WORLD_W - BRK_WALL) * 256;
    const survivors: BrkBall[] = [];

    for (const ball of balls) {
      let { x, y, vx, vy } = ball;
      const spam = ball.spam;
      let gone = false;

      // Four sub-steps a tick: a ball never moves more than two pixels at
      // once, so it cannot slip through a brick.
      for (let sub = 0; sub < 4 && !gone; sub++) {
        const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
        const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);

        x += sx;
        if (x - BRK_BALL_R_FP < leftWall) {
          x = leftWall + BRK_BALL_R_FP;
          vx = -vx;
          if (spam === 1) gone = true;
        } else if (x + BRK_BALL_R_FP > rightWall) {
          x = rightWall - BRK_BALL_R_FP;
          vx = -vx;
          if (spam === 1) gone = true;
        }
        if (gone) break;

        y += sy;
        if (y - BRK_BALL_R_FP < top) {
          y = top + BRK_BALL_R_FP;
          vy = -vy;
          if (spam === 1) {
            gone = true;
            break;
          }
        }

        const brick = brkBrickAt(px(x), px(y));
        if (brick >= 0 && (bricks[brick] ?? 0) > 0) {
          breakBrick(brick);
          const rescaled = setLength(vx, -vy, speed);
          vx = rescaled.vx;
          vy = rescaled.vy;
        }

        // The paddle: caught only while falling onto its top edge.
        if (vy > 0 && y + BRK_BALL_R_FP >= BRK_PADDLE_Y_FP && y < BRK_PADDLE_Y_FP + 4 * 256) {
          const offset = px(x) - paddleLeftOf(paddleX);
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

        if (y - BRK_BALL_R_FP > BRK_WORLD_H * 256) gone = true;
      }

      if (!gone) survivors.push({ x, y, vx, vy, spam });
    }

    balls = survivors;
    const wallGone = bricks.every((left) => left <= 0);
    if (balls.length === 0 && !wallGone) {
      losses += 1;
      next.pause = BRK_RELAUNCH_TICKS;
      balls = [restBall(paddleX)];
    }
  }

  // Capsules fall whatever else is happening.
  const keptCapsules: BrkCapsule[] = [];
  for (const capsule of capsules) {
    const y = capsule.y + BRK_CAPSULE_FALL;
    const caught =
      y + (BRK_CAPSULE_H / 2) * 256 >= BRK_PADDLE_Y_FP &&
      y <= BRK_PADDLE_Y_FP + BRK_PADDLE_H * 256 &&
      Math.abs(px(capsule.x) - paddleX) <= BRK_PADDLE_W / 2 + BRK_CAPSULE_W / 2;
    if (caught) {
      powerUps += 1;
      if (capsule.kind === BRK_POWER_MULTI) {
        const extra: BrkBall[] = [];
        for (const ball of balls) {
          if (balls.length + extra.length >= BRK_MAX_BALLS) break;
          extra.push({ x: ball.x, y: ball.y, vx: -ball.vx, vy: ball.vy, spam: ball.spam });
        }
        balls = balls.concat(extra);
      } else if (capsule.kind === BRK_POWER_SPAM) {
        held = BRK_POWER_SPAM;
        charges = BRK_SPAM_SHOTS;
      } else {
        held = BRK_POWER_LASER;
        charges = 1;
      }
      continue;
    }
    if (y > BRK_WORLD_H * 256) continue;
    keptCapsules.push({ x: capsule.x, y, kind: capsule.kind });
  }
  capsules = keptCapsules;

  next.bricks = bricks;
  next.balls = balls;
  next.capsules = capsules;
  next.hits = hits;
  next.losses = losses;
  next.powerUps = powerUps;
  next.held = held;
  next.charges = charges;
  next.beam = beam;
  next.rng = rng;
  next.speed = speed;
  next.cleared = bricks.every((left) => left <= 0);
  if (next.cleared || tick >= BRK_RUN_TICKS) next.endedTick = tick;
  return next;
}

function score(state: BrkState): number {
  const destroyed = state.bricks.reduce((n, left) => (left <= 0 ? n + 1 : n), 0);
  if (destroyed >= BRK_BRICKS) return BRK_ALL_CLEAR_SCORE;
  return clampInt(BRK_HIT_POINTS * destroyed, 0, 150);
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
  balls: number;
  capsules: number;
  held: number;
  charges: number;
  powerUps: number;
}

export interface BrkCheckpoint extends BrkCheckpointState {
  checksum: number;
}

export function brkCheckpointState(state: BrkState): BrkCheckpointState {
  const lead = state.balls[0];
  return {
    tick: state.tick,
    x: lead?.x ?? 0,
    y: lead?.y ?? 0,
    vx: lead?.vx ?? 0,
    vy: lead?.vy ?? 0,
    speed: state.speed,
    paddleX: state.paddleX,
    hits: state.hits,
    left: brkBricksLeft(state),
    losses: state.losses,
    pause: state.pause,
    balls: state.balls.length,
    capsules: state.capsules.length,
    held: state.held,
    charges: state.charges,
    powerUps: state.powerUps,
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

/** True when a world point is inside the power-up button. */
export function brkButtonHit(xPx: number, yPx: number): boolean {
  return (
    xPx >= BRK_BTN_X - 6 &&
    xPx <= BRK_BTN_X + BRK_BTN_W + 6 &&
    yPx >= BRK_BTN_Y - 6 &&
    yPx <= BRK_BTN_Y + BRK_BTN_H + 6
  );
}

/** A black five-point star, marking a gold (power-up) brick. */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.fillStyle = "#0B0B0F";
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

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
    const isGold = (state.gold[index] ?? 0) > 0;
    ctx.fillStyle = isGold
      ? BRK_GOLD
      : left > 1
        ? "#0F766E"
        : (BRK_TEAL[row % BRK_TEAL.length] ?? BRK_TEAL[0]!);
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
    if (isGold) {
      drawStar(
        ctx,
        BRK_WALL_X + col * BRK_BRICK_W + BRK_BRICK_W / 2,
        BRK_WALL_Y + row * BRK_ROW_PITCH + BRK_BRICK_H / 2,
        7,
      );
    }
  });

  if (state.beam > 0) {
    const col = brkPaddleColumn(state.paddleX);
    ctx.fillStyle = "rgba(245,184,46,0.35)";
    ctx.fillRect(
      BRK_WALL_X + col * BRK_BRICK_W + 6,
      BRK_WALL_Y,
      BRK_BRICK_W - 12,
      BRK_PADDLE_Y - BRK_WALL_Y,
    );
  }

  for (const capsule of state.capsules) {
    ctx.fillStyle = BRK_GOLD;
    ctx.fillRect(
      px(capsule.x) - BRK_CAPSULE_W / 2,
      px(capsule.y) - BRK_CAPSULE_H / 2,
      BRK_CAPSULE_W,
      BRK_CAPSULE_H,
    );
    ctx.fillStyle = "#0B0B0F";
    ctx.font = "700 8px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      capsule.kind === BRK_POWER_MULTI ? "M" : capsule.kind === BRK_POWER_SPAM ? "S" : "L",
      px(capsule.x),
      px(capsule.y) + 1,
    );
  }

  ctx.fillStyle = BRK_GOLD;
  ctx.fillRect(paddleLeftOf(state.paddleX), BRK_PADDLE_Y, BRK_PADDLE_W, BRK_PADDLE_H);

  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(px(ball.x), px(ball.y), BRK_BALL_R, 0, Math.PI * 2);
    ctx.fillStyle =
      state.pause > 0 ? "rgba(245,184,46,0.45)" : ball.spam === 1 ? BRK_GOLD : "#F7F7F8";
    ctx.fill();
  }

  if (state.held > 0) {
    ctx.fillStyle = "rgba(245,184,46,0.9)";
    ctx.beginPath();
    ctx.roundRect(BRK_BTN_X, BRK_BTN_Y, BRK_BTN_W, BRK_BTN_H, 10);
    ctx.fill();
    ctx.fillStyle = "#0B0B0F";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (state.held === BRK_POWER_SPAM) {
      ctx.font = "700 16px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText(`×${state.charges}`, BRK_BTN_X + BRK_BTN_W / 2, BRK_BTN_Y + BRK_BTN_H / 2);
    } else {
      ctx.fillRect(BRK_BTN_X + BRK_BTN_W / 2 - 2, BRK_BTN_Y + 12, 4, BRK_BTN_H - 24);
      ctx.font = "700 10px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText("beam", BRK_BTN_X + BRK_BTN_W / 2, BRK_BTN_Y + BRK_BTN_H - 8);
    }
  }

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Bricks ${brkDestroyed(state)} / ${BRK_PAR}`, 14, 14);
  ctx.textAlign = "right";

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
