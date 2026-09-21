/**
 * Swerve — the second arcade game on the shared engine.
 *
 * Three lanes, a gold chevron near the bottom, teal blocks scrolling down and
 * gold coins in the open lanes. The whole course is generated at init(seed), so
 * the phone and the server walk the identical run; everything is integer
 * fixed-point (1/256 px) and every constant below is written once, in units.
 */

import { clampInt, px, rngBelow, TICKS_PER_SECOND, type CanvasSize } from "./engine";
import type { ArcadeGame } from "./engine";

/* ============================== Constants ============================== */

/** The world the sim runs in. Drawing scales this to the canvas. */
export const SWERVE_WORLD_W = 390;
export const SWERVE_WORLD_H = 560;

export const SWERVE_RUN_SECONDS = 60;
export const SWERVE_RUN_TICKS = SWERVE_RUN_SECONDS * TICKS_PER_SECOND;

/** Every simulation constant below is already in 1/256-pixel units. */
export const SWERVE_WORLD_RIGHT = 99_840;
export const SWERVE_WORLD_BOTTOM = 143_360;

export const SWERVE_LANES = 5;
/** Canvas width ÷ 5 = 78 px. */
export const SWERVE_LANE_W = 19_968;
/** Lane centres, left to right. */
export const SWERVE_LANE_X = [9_984, 29_952, 49_920, 69_888, 89_856] as const;

export const SWERVE_CHEV_Y = 120_320;
export const SWERVE_CHEV_HALF_W = 3_584;
export const SWERVE_CHEV_HALF_H = 3_584;
/** How far the chevron slides towards its lane centre each tick — 14 px. */
export const SWERVE_SLIDE = 3_584;

/** Scroll speed: 3.0 px/tick, +0.08 px/tick per coin taken, capped at 6.0. */
export const SWERVE_SPEED_START = 768;
export const SWERVE_SPEED_STEP = 20;
export const SWERVE_SPEED_MAX = 1_536;

/** A row of blocks every 200 world pixels of scroll. */
export const SWERVE_ROW_SPACING = 51_200;
export const SWERVE_ROW_H = 10_240;
/** The first row sits just above the top edge. */
export const SWERVE_FIRST_ROW_Y = -10_240;

export const SWERVE_COIN_R = 1_536;
/** Rows carrying a coin, out of ten. */
export const SWERVE_COIN_CHANCE = 7;

export const SWERVE_COIN_POINTS = 110;
export const SWERVE_SURVIVE_BONUS = 40;

/* ================================ State ================================ */

/** A tick's input: one lane left, one lane right, or nothing. */
export type SwerveInput = -1 | 0 | 1;

export interface SwerveRow {
  /** Row top at the start of the run, fixed-point; never mutated. */
  y0: number;
  /** Blocked lanes, one or two of the three — never all three. */
  blocked: number[];
  /** The lane holding this row's coin, or -1 for no coin. */
  coinLane: number;
  /** A collected coin is removed from the board on the tick it is taken. */
  coinCollected: boolean;
}

export interface SwerveState {
  tick: number;
  /** Chevron centre x, fixed-point. */
  x: number;
  /** The lane the chevron is heading for. */
  lane: number;
  /** How far the course has scrolled, fixed-point. */
  distance: number;
  coins: number;
  /** Coins a player who never crashes could collect in a full run. */
  totalCoins: number;
  /** The last row whose coin was taken; rows resolve in order. */
  lastCoinRow: number;
  /** Tick of the most recent collection, for the render-only pop. */
  lastCoinTick: number;
  /** The first row not yet past the chevron. */
  cursor: number;
  crashed: boolean;
  endedTick: number;
  rows: SwerveRow[];
}

/** Scroll speed for a player who has taken this many coins. */
export function swerveSpeed(coins: number): number {
  return Math.min(SWERVE_SPEED_MAX, SWERVE_SPEED_START + SWERVE_SPEED_STEP * Math.max(0, coins));
}

/** Every way one, two or three of the five lanes can be blocked — never more. */
const BLOCK_SETS: number[][] = (() => {
  const sets: number[][] = [];
  for (let bits = 1; bits < 1 << SWERVE_LANES; bits++) {
    const lanes: number[] = [];
    for (let lane = 0; lane < SWERVE_LANES; lane++) {
      if (bits & (1 << lane)) lanes.push(lane);
    }
    if (lanes.length >= 1 && lanes.length <= 3) sets.push(lanes);
  }
  return sets;
})();

function openLanes(blocked: number[]): number[] {
  const open: number[] = [];
  for (let lane = 0; lane < SWERVE_LANES; lane++) {
    if (!blocked.includes(lane)) open.push(lane);
  }
  return open;
}

/**
 * Passable means the open lanes of consecutive rows share a lane, or sit at
 * most two lane steps apart — so the chevron can always reach an open lane.
 */
function passable(previousOpen: number[], nextOpen: number[]): boolean {
  for (const a of previousOpen) {
    for (const b of nextOpen) {
      if (Math.abs(a - b) <= 2) return true;
    }
  }
  return false;
}

/** The whole course, long enough for the fastest possible run. */
function buildCourse(seed: number): { rows: SwerveRow[]; rng: number } {
  const maxTravel = SWERVE_SPEED_MAX * SWERVE_RUN_TICKS;
  const rows: SwerveRow[] = [];
  let rng = seed | 0;
  let previousOpen = [0, 1, 2];
  let index = 0;
  while (index * SWERVE_ROW_SPACING <= maxTravel + SWERVE_ROW_SPACING * 2) {
    let blocked: number[] | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const drawn = rngBelow(rng, BLOCK_SETS.length);
      rng = drawn.state;
      const candidate = BLOCK_SETS[drawn.value]!;
      if (passable(previousOpen, openLanes(candidate))) {
        blocked = candidate;
        break;
      }
    }
    // Fallback: a single blocked lane always leaves a passable pair of lanes.
    if (!blocked) {
      const drawn = rngBelow(rng, SWERVE_LANES);
      rng = drawn.state;
      blocked = [drawn.value];
    }
    const open = openLanes(blocked);

    const coinRoll = rngBelow(rng, 10);
    rng = coinRoll.state;
    let coinLane = -1;
    if (coinRoll.value < SWERVE_COIN_CHANCE) {
      const pick = rngBelow(rng, open.length);
      rng = pick.state;
      coinLane = open[pick.value]!;
    }

    rows.push({
      y0: SWERVE_FIRST_ROW_Y - index * SWERVE_ROW_SPACING,
      blocked,
      coinLane,
      coinCollected: false,
    });
    previousOpen = open;
    index += 1;
  }
  return { rows, rng };
}

/** Coins a clean run could reach, walked tick by tick exactly as `step` does. */
function countTotalCoins(rows: SwerveRow[]): number {
  let distance = 0;
  for (let tick = 0; tick < SWERVE_RUN_TICKS; tick++) distance += swerveSpeed(tick);
  let total = 0;
  for (const row of rows) {
    if (row.y0 + distance < SWERVE_CHEV_Y) break;
    if (row.coinLane >= 0) total += 1;
  }
  return total;
}

function init(seed: number): SwerveState {
  const { rows } = buildCourse(seed);
  return {
    tick: 0,
    x: SWERVE_LANE_X[1],
    lane: 1,
    distance: 0,
    coins: 0,
    totalCoins: countTotalCoins(rows),
    lastCoinRow: -1,
    lastCoinTick: 0,
    cursor: 0,
    crashed: false,
    endedTick: 0,
    rows,
  };
}

function isOver(state: SwerveState): boolean {
  return state.crashed || state.tick >= SWERVE_RUN_TICKS;
}

export function swerveSurvived(state: SwerveState): boolean {
  return !state.crashed && state.tick >= SWERVE_RUN_TICKS;
}

function laneLeft(lane: number): number {
  return lane * SWERVE_LANE_W;
}

function step(state: SwerveState, input: SwerveInput): SwerveState {
  if (isOver(state)) return state;

  const tick = state.tick + 1;
  const lane = clampInt(
    state.lane + (input === -1 ? -1 : input === 1 ? 1 : 0),
    0,
    SWERVE_LANES - 1,
  );
  const target = SWERVE_LANE_X[lane]!;
  const x =
    state.x < target
      ? Math.min(target, state.x + SWERVE_SLIDE)
      : Math.max(target, state.x - SWERVE_SLIDE);
  const distance = state.distance + swerveSpeed(state.tick);

  let cursor = state.cursor;
  while (
    cursor < state.rows.length &&
    state.rows[cursor]!.y0 + distance - SWERVE_ROW_H > SWERVE_CHEV_Y + SWERVE_CHEV_HALF_H
  ) {
    cursor += 1;
  }

  let coins = state.coins;
  let lastCoinRow = state.lastCoinRow;
  let lastCoinTick = state.lastCoinTick;
  let rows = state.rows;
  let crashed = false;

  for (let index = cursor; index < Math.min(cursor + 3, state.rows.length); index++) {
    const row = state.rows[index]!;
    const top = row.y0 + distance;
    const bottom = top + SWERVE_ROW_H;
    if (bottom < SWERVE_CHEV_Y - SWERVE_CHEV_HALF_H) continue;
    if (top > SWERVE_CHEV_Y + SWERVE_CHEV_HALF_H) continue;

    for (const blocked of row.blocked) {
      const left = laneLeft(blocked);
      if (x + SWERVE_CHEV_HALF_W > left && x - SWERVE_CHEV_HALF_W < left + SWERVE_LANE_W) {
        crashed = true;
      }
    }

    if (row.coinLane >= 0 && !row.coinCollected) {
      const centreY = top + (SWERVE_ROW_H >> 1);
      const nearY = Math.abs(centreY - SWERVE_CHEV_Y) < SWERVE_CHEV_HALF_H + SWERVE_COIN_R;
      const nearX = Math.abs(x - SWERVE_LANE_X[row.coinLane]!) < SWERVE_COIN_R + SWERVE_CHEV_HALF_W;
      if (nearY && nearX) {
        coins += 1;
        lastCoinRow = index;
        lastCoinTick = tick;
        rows = rows === state.rows ? [...state.rows] : rows;
        rows[index] = { ...row, coinCollected: true };
      }
    }
  }

  const next: SwerveState = {
    ...state,
    tick,
    x,
    lane,
    distance,
    coins,
    lastCoinRow,
    lastCoinTick,
    cursor,
    rows,
  };
  if (crashed) return { ...next, crashed: true, endedTick: tick };
  if (tick >= SWERVE_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: SwerveState): number {
  const total = Math.max(1, state.totalCoins);
  const coins = clampInt(state.coins, 0, total);
  const earned = Math.round((SWERVE_COIN_POINTS * coins) / total);
  const bonus = swerveSurvived(state) ? SWERVE_SURVIVE_BONUS : 0;
  return clampInt(earned + bonus, 0, 150);
}

/* =========================== Integrity checks ========================== */

export const SWERVE_CHECKPOINT_INTERVAL = 300;

export interface SwerveCheckpointState {
  tick: number;
  x: number;
  lane: number;
  distance: number;
  coins: number;
  cursor: number;
  nextRowY: number;
  nextRowMask: number;
  nextCoinLane: number;
  nextCoinCollected: number;
}

export interface SwerveCheckpoint extends SwerveCheckpointState {
  checksum: number;
}

/** A blocked-lane set as a bitmask, so the snapshot stays a flat integer list. */
function mask(blocked: number[]): number {
  let bits = 0;
  for (const lane of blocked) bits |= 1 << lane;
  return bits;
}

export function swerveCheckpointState(state: SwerveState): SwerveCheckpointState {
  const next = state.rows[state.cursor];
  return {
    tick: state.tick,
    x: state.x,
    lane: state.lane,
    distance: state.distance,
    coins: state.coins,
    cursor: state.cursor,
    nextRowY: next ? next.y0 + state.distance : 0,
    nextRowMask: next ? mask(next.blocked) : 0,
    nextCoinLane: next ? next.coinLane : -1,
    nextCoinCollected: next?.coinCollected ? 1 : 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function swerveCheckpoint(state: SwerveState): SwerveCheckpoint {
  const snapshot = swerveCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const SWERVE_BG = "#0B0B0F";
export const SWERVE_CHEV_COLOUR = "#F5B82E";
export const SWERVE_BLOCK_COLOUR = "#2ED3B7";
export const SWERVE_BLOCK_EDGE = "#1B8C7B";
export const SWERVE_COIN_COLOUR = "#F5B82E";
export const SWERVE_CRASH_COLOUR = "#FF4D4D";

/** Draws purely from the state — no animation lives outside the sim. */
function draw(ctx: CanvasRenderingContext2D, state: SwerveState, size: CanvasSize): void {
  const scale = Math.min(size.width / SWERVE_WORLD_W, size.height / SWERVE_WORLD_H);
  const offsetX = (size.width - SWERVE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SWERVE_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = SWERVE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Faint lane dividers.
  ctx.strokeStyle = "rgba(247, 247, 248, 0.10)";
  ctx.lineWidth = 1;
  for (let lane = 1; lane < SWERVE_LANES; lane++) {
    const x = px(laneLeft(lane));
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SWERVE_WORLD_H);
    ctx.stroke();
  }

  for (let index = 0; index < state.rows.length; index++) {
    const row = state.rows[index]!;
    const top = px(row.y0 + state.distance);
    if (top > SWERVE_WORLD_H || top + px(SWERVE_ROW_H) < 0) continue;
    for (const blocked of row.blocked) {
      const left = px(laneLeft(blocked)) + 3;
      const width = px(SWERVE_LANE_W) - 6;
      ctx.fillStyle = SWERVE_BLOCK_COLOUR;
      ctx.fillRect(left, top, width, px(SWERVE_ROW_H));
      ctx.strokeStyle = SWERVE_BLOCK_EDGE;
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 1, top + 1, width - 2, px(SWERVE_ROW_H) - 2);
    }
    if (row.coinLane >= 0 && !row.coinCollected) {
      ctx.beginPath();
      ctx.fillStyle = SWERVE_COIN_COLOUR;
      ctx.arc(
        px(SWERVE_LANE_X[row.coinLane]!),
        top + px(SWERVE_ROW_H) / 2,
        px(SWERVE_COIN_R),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else if (row.coinLane >= 0 && state.lastCoinRow === index) {
      const age = state.tick - state.lastCoinTick;
      if (age >= 0 && age < 12) {
        ctx.beginPath();
        ctx.strokeStyle = SWERVE_COIN_COLOUR;
        ctx.globalAlpha = 1 - age / 12;
        ctx.lineWidth = 2;
        ctx.arc(
          px(SWERVE_LANE_X[row.coinLane]!),
          top + px(SWERVE_ROW_H) / 2,
          px(SWERVE_COIN_R) + age * 0.8,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // The chevron.
  const cx = px(state.x);
  const cy = px(SWERVE_CHEV_Y);
  const half = px(SWERVE_CHEV_HALF_W);
  ctx.beginPath();
  ctx.fillStyle = state.crashed ? SWERVE_CRASH_COLOUR : SWERVE_CHEV_COLOUR;
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half, cy + half);
  ctx.lineTo(cx, cy + half * 0.4);
  ctx.lineTo(cx - half, cy + half);
  ctx.closePath();
  ctx.fill();

  const remaining = Math.max(0, SWERVE_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Coins ${state.coins} / ${state.totalCoins}`, 12, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, SWERVE_WORLD_W - 12, 12);

  if (state.crashed) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, SWERVE_WORLD_W, SWERVE_WORLD_H);
  }

  ctx.restore();
}

export const swerveGame: ArcadeGame<SwerveState, SwerveInput> = {
  key: "swerve",
  runTicks: SWERVE_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
};
