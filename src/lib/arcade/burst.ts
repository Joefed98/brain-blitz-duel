/**
 * Burst — pop bouncing balls with a vertical shot; big balls split into two
 * smaller ones. Drags set the player's target x (k = 7, a = x); taps fire
 * (k = 0; b alternates so repeated taps stay distinct events). Every wave is
 * drawn at init from the seed. Popping an L ball drops a gold icon;
 * catching it switches to BURST shots — three short shots spaced by BURST_GAP
 * apart per tap — until a life is lost.
 */

import {
  clampInt,
  inputRange,
  isqrt,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

const FP = 256;
export const BURST_WORLD_W = 390;
export const BURST_WORLD_H = 620;
export const BURST_RUN_TICKS = 90 * TICKS_PER_SECOND;
export const BURST_INPUT_MOVE = 7;
export const BURST_INPUT_FIRE = 0;
export const BURST_FLOOR_Y = 560;
/** The 60 px controls bar under the floor is the drag zone; taps above it fire. */
export const BURST_DRAG_TOP = BURST_FLOOR_Y;
export const BURST_BAR_H = BURST_WORLD_H - BURST_FLOOR_Y;
const CEIL_START = 40;
const ARENA_H = BURST_FLOOR_Y - CEIL_START;
const CEIL_STEP = 40;
/** The ceiling never comes lower than 60% of the arena height above the floor. */
const CEIL_MAX = BURST_FLOOR_Y - Math.trunc((ARENA_H * 60) / 100);
const PLAYER_HALF_W = 12;
const PLAYER_H = 36;
const PLAYER_SPEED = 4 * FP;
const SHOT_SPEED = 9 * FP;
export const BURST_LIVES = 3;
const INVULN_TICKS = 60;
const WAVE_GAP = 45;
const MAX_WAVES = 41;
const HIT_POINTS = 2;
const LIFE_COST = 9;
const TOP_UP_WAVES = 4;
const ICON_FALL = 2 * FP;
export const BURST_ICON_FALL = 3 * FP;
const ICON_HALF = 8;
const BURST_SHOTS = 3;
export const BURST_GAP = 16;
const BURST_SPEED = 12 * FP;
export const BURST_SHORT_LEN = 30;
/** Popping an M ball drops a SHIELD icon one time in this many (seeded). */
const SHIELD_ODDS = 4;
/** Ceiling deflection (±15°) from this wave, when the ball hits faster than this. */
const DEFLECT_FROM_WAVE = 3;
const DEFLECT_MIN_VY = 2 * FP;
const COS15 = 989;
const SIN15 = 265;
/**
 * burstRev 2 (Oct 2026): half the BURST and SHIELD drops (BURST from 1 in 2 purple
 * atoms instead of every one, SHIELD from 1 in 8 blue atoms instead of 1 in 4) and
 * a FREEZE drop (1 in 12 green atoms) that stops every atom for 3 s. All rolls come
 * from the seeded generator in the state. Unstamped rounds keep the original drops.
 */
export const BURST_REV = 2;
export const BURST_V2_BURST_ODDS = 2;
export const BURST_V2_SHIELD_ODDS = 8;
export const BURST_V2_FREEZE_ODDS = 12;
export const BURST_FREEZE_TICKS = 3 * TICKS_PER_SECOND;
/** Icon kinds: 0 BURST (gold), 1 SHIELD (teal), 2 FREEZE (ice blue, burstRev 2). */
export const BURST_ICON_FREEZE = 2;
/** burstRev 2: without the flawless finish the score stops at 130, so only that finish scores 150. */
export const BURST_V2_PARTIAL_MAX = 130;
/** A move event with c = 1 puts the figure exactly at x (1:1 finger follow). */
export const BURST_MOVE_SNAP = 1;

/** Sizes: 0 L, 1 M, 2 S, 3 XS. */
export const BURST_RADIUS = [32, 22, 14, 8] as const;
const APEX_PCT = [75, 60, 45, 30] as const;
const SPEED_X = [410, 495, 580, 666] as const; // 1.6 → 2.6 px a tick
const GRAVITY = 32; // 0.125 px/tick²
const KICK = 3 * FP;
/** Bounce speed that lifts the ball's bottom to its apex height. */
const BOUNCE_V: readonly number[] = APEX_PCT.map((pct) => {
  const h = Math.trunc((ARENA_H * pct) / 100) * FP;
  return isqrt(2 * GRAVITY * h);
});

/**
 * The floor-dependent geometry of a world (burstRev 4's taller arena scales
 * every height with it): the floor, the arena height under the starting
 * ceiling, the lowest the ceiling comes, how far it drops a wave, and each
 * size's bounce speed (the same share of the arena as before). At the original
 * 560 floor these are exactly the constants above.
 */
export interface BurstGeometry {
  floor: number;
  arenaH: number;
  ceilMax: number;
  ceilStep: number;
  bounceV: readonly number[];
}
const ORIGINAL_GEOMETRY: BurstGeometry = { floor: BURST_FLOOR_Y, arenaH: ARENA_H, ceilMax: CEIL_MAX, ceilStep: CEIL_STEP, bounceV: BOUNCE_V };
const geometries = new Map<number, BurstGeometry>([[BURST_FLOOR_Y, ORIGINAL_GEOMETRY]]);
export function burstGeometry(floor: number = BURST_FLOOR_Y): BurstGeometry {
  let g = geometries.get(floor);
  if (!g) {
    const arenaH = floor - CEIL_START;
    g = {
      floor,
      arenaH,
      ceilMax: floor - Math.trunc((arenaH * 60) / 100),
      ceilStep: Math.trunc((CEIL_STEP * arenaH) / ARENA_H),
      bounceV: APEX_PCT.map((pct) => isqrt(2 * GRAVITY * Math.trunc((arenaH * pct) / 100) * FP)),
    };
    geometries.set(floor, g);
  }
  return g;
}
/** The floor (px) of a state's arena: burstRev 4's taller world, or the original 560. Also the drawn world's height. */
export function burstFloorY(state: { worldH?: number }): number {
  return state.worldH ?? BURST_FLOOR_Y;
}

export const BURST_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BURST_INPUT_MOVE, [0, BURST_WORLD_W], [0, 0], [0, 1]),
  inputRange(BURST_INPUT_FIRE, [0, 0], [0, 1]),
];

/* ================================ Waves ================================ */

export interface BurstSpawn {
  size: number;
  /** 0 enters from the left, 1 from the right. */
  side: number;
  /** Extra height above the default entry point, px. */
  lift: number;
}

function buildWaves(seed: number) {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const waves: BurstSpawn[][] = [];
  const side = draw(2);
  // Wave 1 is a single M; the rest of the list follows one later.
  waves.push([{ size: 1, side, lift: 0 }]);
  waves.push([{ size: 0, side: 1 - side, lift: 0 }]);
  waves.push([
    { size: 1, side: 0, lift: 0 },
    { size: 1, side: 1, lift: 0 },
  ]);
  const s3 = draw(2);
  waves.push([
    { size: 0, side: s3, lift: 0 },
    { size: 2, side: 0, lift: 40 },
    { size: 2, side: 1, lift: 40 },
  ]);
  waves.push([
    { size: 0, side: 0, lift: 0 },
    { size: 0, side: 1, lift: 30 },
  ]);
  for (let w = 6; w <= MAX_WAVES; w++) {
    const count = Math.min(5, 2 + Math.trunc((w - 6) / 2) + draw(2));
    const wave: BurstSpawn[] = [];
    for (let i = 0; i < count; i++) wave.push({ size: draw(3), side: draw(2), lift: draw(4) * 20 });
    waves.push(wave);
  }
  return { waves, rng };
}

export function burstCeiling(wave: number, floor: number = BURST_FLOOR_Y): number {
  const g = burstGeometry(floor);
  return Math.min(g.ceilMax, CEIL_START + g.ceilStep * Math.max(0, wave - 5));
}

/* ================================ State ================================ */

export interface BurstBall {
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BurstShot {
  x: number;
  top: number;
  /** 1 for a short BURST shot. */
  short: number;
}

export interface BurstIcon {
  x: number;
  y: number;
  /** 0 BURST shots (gold), 1 SHIELD (teal), 2 FREEZE (burstRev 2). */
  kind: number;
}

export interface BurstState extends BandFields {
  /** burstRev 2 only (absent on original rounds). */
  rev?: number;
  /** burstRev 2: ticks of freeze left (every atom stopped) and FREEZE icons caught. */
  freeze?: number;
  freezes?: number;
  /** burstRev 4 only (taller worlds): the floor, which is the drawn world's height, px (BURST_TALL_H). Absent = BURST_FLOOR_Y. */
  worldH?: number;
  tick: number;
  rng: number;
  waves: BurstSpawn[][];
  /** Wave number on screen (0 before the first). */
  wave: number;
  nextWaveAt: number;
  balls: BurstBall[];
  x: number;
  targetX: number;
  shots: BurstShot[];
  /** Gold power-up icons falling, x/y in 1/256 px. */
  icons: BurstIcon[];
  /** 1 while the one-touch shield is up. */
  shield: number;
  /** 1 while BURST shots are on. */
  burst: number;
  /** BURST shots still to fire from the current tap, and when. */
  burstLeft: number;
  burstNext: number;
  lives: number;
  invuln: number;
  /** Balls popped or split. */
  hits: number;
  cleared: number;
  ended: number;
  endedTick: number;
  /** Render only. */
  popX: number;
  popY: number;
  popTick: number;
  popSize: number;
}

const cache = new Map<number, ReturnType<typeof buildWaves>>();

function init(seed: number): BurstState {
  let plan = cache.get(seed | 0);
  if (!plan) {
    plan = buildWaves(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, plan);
  }
  const mid = Math.trunc(BURST_WORLD_W / 2) * FP;
  return {
    tick: 0,
    rng: plan.rng,
    waves: plan.waves,
    wave: 0,
    nextWaveAt: WAVE_GAP,
    balls: [],
    x: mid,
    targetX: mid,
    shots: [],
    icons: [],
    shield: 0,
    burst: 0,
    burstLeft: 0,
    burstNext: 0,
    lives: BURST_LIVES,
    invuln: 0,
    hits: 0,
    cleared: 0,
    ended: 0,
    endedTick: 0,
    popX: 0,
    popY: 0,
    popTick: -100,
    popSize: 0,
  };
}

function initV2(seed: number): BurstState {
  return { ...init(seed), rev: BURST_REV, freeze: 0, freezes: 0 };
}

function isOver(state: BurstState): boolean {
  return state.ended !== 0;
}

/** Circle against the player's box, all in 1/256 px. */
function touches(ball: BurstBall, px: number, floor: number): boolean {
  const r = BURST_RADIUS[ball.size]! * FP;
  const left = px - PLAYER_HALF_W * FP;
  const right = px + PLAYER_HALF_W * FP;
  const top = (floor - PLAYER_H) * FP;
  const bottom = floor * FP;
  const cx = clampInt(ball.x, left, right);
  const cy = clampInt(ball.y, top, bottom);
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return dx * dx + dy * dy <= r * r;
}

function step(state: BurstState, input: ArcadeInputEvent | null): BurstState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: BurstState = {
    ...state,
    tick,
    balls: state.balls.map((ball) => ({ ...ball })),
    shots: state.shots.map((shot) => ({ ...shot })),
    icons: state.icons.map((icon) => ({ ...icon })),
  };
  const minX = PLAYER_HALF_W * FP;
  const maxX = (BURST_WORLD_W - PLAYER_HALF_W) * FP;
  // burstRev 4: the taller arena's floor and its scaled ceilings and bounces (560 and the constants otherwise).
  const geo = burstGeometry(burstFloorY(state));
  const FLOOR_Y = geo.floor;

  if (input && input.k === BURST_INPUT_MOVE) {
    s.targetX = clampInt(input.a * FP, minX, maxX);
    // Finger in the control strip: the figure sits exactly under it.
    if (input.c === BURST_MOVE_SNAP) s.x = s.targetX;
  }
  if (input && input.k === BURST_INPUT_FIRE) {
    if (s.burst) {
      if (s.burstLeft === 0) {
        s.burstLeft = BURST_SHOTS;
        s.burstNext = tick;
      }
    } else if (s.shots.length === 0) s.shots.push({ x: s.x, top: FLOOR_Y * FP, short: 0 });
  }

  // Player walks toward its target.
  s.x += clampInt(s.targetX - s.x, -PLAYER_SPEED, PLAYER_SPEED);
  if (s.burst && s.burstLeft > 0 && tick >= s.burstNext) {
    s.shots.push({ x: s.x, top: (FLOOR_Y - PLAYER_H) * FP, short: 1 });
    s.burstLeft -= 1;
    s.burstNext = tick + BURST_GAP;
  }
  if (s.invuln > 0) s.invuln -= 1;

  // Next wave enters.
  if (s.balls.length === 0 && tick >= s.nextWaveAt && s.wave < s.waves.length) {
    s.wave += 1;
    const ceil = burstCeiling(s.wave, FLOOR_Y);
    for (const spawn of s.waves[s.wave - 1]!) {
      const r = BURST_RADIUS[spawn.size]!;
      const y = Math.min(FLOOR_Y - r - 40, ceil + r + 20 + spawn.lift);
      s.balls.push({
        size: spawn.size,
        x: (spawn.side ? BURST_WORLD_W - r - 2 : r + 2) * FP,
        y: y * FP,
        vx: spawn.side ? -SPEED_X[spawn.size]! : SPEED_X[spawn.size]!,
        vy: 0,
      });
    }
  }

  // Balls bounce (burstRev 2: not while frozen).
  const ceil = burstCeiling(s.wave, FLOOR_Y) * FP;
  const frozen = (s.freeze ?? 0) > 0;
  if (frozen) s.freeze = (s.freeze ?? 0) - 1;
  for (const ball of frozen ? [] : s.balls) {
    const r = BURST_RADIUS[ball.size]! * FP;
    ball.vy += GRAVITY;
    ball.y += ball.vy;
    ball.x += ball.vx;
    if (ball.y + r >= FLOOR_Y * FP) {
      ball.y = FLOOR_Y * FP - r;
      ball.vy = -geo.bounceV[ball.size]!;
    }
    if (ball.y - r < ceil) {
      ball.y = ceil + r;
      if (ball.vy < 0) {
        const fast = -ball.vy > DEFLECT_MIN_VY;
        ball.vy = -ball.vy;
        if (fast && s.wave >= DEFLECT_FROM_WAVE) {
          // Deflect off the ceiling by ±15° (side from the seed's stream).
          const d = rngBelow(s.rng, 2);
          s.rng = d.state;
          const sign = d.value === 0 ? -1 : 1;
          const vx = Math.trunc((ball.vx * COS15 - sign * ball.vy * SIN15) / 1024);
          const vy = Math.trunc((sign * ball.vx * SIN15 + ball.vy * COS15) / 1024);
          const base = SPEED_X[ball.size]!;
          const mag = clampInt(Math.abs(vx), Math.trunc(base / 2), Math.trunc((base * 3) / 2));
          ball.vx = vx < 0 ? -mag : mag;
          ball.vy = Math.max(GRAVITY, vy);
        }
      }
    }
    if (ball.x - r < 0) {
      ball.x = r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + r > BURST_WORLD_W * FP) {
      ball.x = BURST_WORLD_W * FP - r;
      ball.vx = -Math.abs(ball.vx);
    }
  }

  // Shots climb; the first ball each meets splits or pops.
  const flying: BurstShot[] = [];
  for (const shot of s.shots) {
    shot.top -= shot.short ? BURST_SPEED : SHOT_SPEED;
    const bottom = shot.short ? shot.top + BURST_SHORT_LEN * FP : FLOOR_Y * FP;
    let hit = -1;
    for (let i = 0; i < s.balls.length; i++) {
      const ball = s.balls[i]!;
      const r = BURST_RADIUS[ball.size]! * FP;
      if (Math.abs(ball.x - shot.x) <= r && ball.y + r >= shot.top && ball.y - r <= bottom) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) {
      const ball = s.balls[hit]!;
      s.hits += 1;
      if (s.rev === BURST_REV) {
        // Seeded drops: BURST from 1 in 2 L, SHIELD from 1 in 8 M, FREEZE from 1 in 12 S.
        const odds = ball.size === 0 ? BURST_V2_BURST_ODDS : ball.size === 1 ? BURST_V2_SHIELD_ODDS : ball.size === 2 ? BURST_V2_FREEZE_ODDS : 0;
        if (odds > 0) {
          const roll = rngBelow(s.rng, odds);
          s.rng = roll.state;
          if (roll.value === 0) s.icons.push({ x: ball.x, y: ball.y, kind: ball.size === 2 ? BURST_ICON_FREEZE : ball.size });
        }
      } else if (ball.size === 0) s.icons.push({ x: ball.x, y: ball.y, kind: 0 });
      else if (ball.size === 1) {
        const roll = rngBelow(s.rng, SHIELD_ODDS);
        s.rng = roll.state;
        if (roll.value === 0) s.icons.push({ x: ball.x, y: ball.y, kind: 1 });
      }
      s.popX = ball.x;
      s.popY = ball.y;
      s.popTick = tick;
      s.popSize = ball.size;
      s.balls.splice(hit, 1);
      if (ball.size < 3) {
        const size = ball.size + 1;
        for (const dir of [-1, 1]) {
          s.balls.push({ size, x: ball.x, y: ball.y, vx: dir * SPEED_X[size]!, vy: -KICK });
        }
      }
    } else if (shot.top > ceil) flying.push(shot);
  }
  s.shots = flying;

  // Power-up icons fall; the player catches them, the floor loses them.
  const falling: BurstIcon[] = [];
  for (const icon of s.icons) {
    icon.y += icon.kind === 0 ? BURST_ICON_FALL : ICON_FALL;
    const top = (FLOOR_Y - PLAYER_H) * FP;
    const near = Math.abs(icon.x - s.x) <= (PLAYER_HALF_W + ICON_HALF) * FP;
    if (near && icon.y + ICON_HALF * FP >= top) {
      if (icon.kind === 1) s.shield = 1;
      else if (icon.kind === BURST_ICON_FREEZE) {
        s.freeze = BURST_FREEZE_TICKS;
        s.freezes = (s.freezes ?? 0) + 1;
      } else s.burst = 1;
    }
    else if (icon.y - ICON_HALF * FP < FLOOR_Y * FP) falling.push(icon);
  }
  s.icons = falling;

  // Touching the player costs a life and the BURST shots.
  if (s.invuln === 0 && s.balls.some((ball) => touches(ball, s.x, FLOOR_Y))) {
    if (s.shield) {
      // The shield takes the hit and vanishes; no life lost.
      s.shield = 0;
      s.invuln = INVULN_TICKS;
    } else {
    s.lives -= 1;
    s.invuln = INVULN_TICKS;
    s.burst = 0;
    s.burstLeft = 0;
    }
  }

  if (s.balls.length === 0 && s.wave > 0 && s.nextWaveAt <= state.tick) {
    s.cleared += 1;
    s.nextWaveAt = tick + WAVE_GAP;
  }

  if (s.lives <= 0) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= BURST_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** 2 per hit − 9 per life lost (min 0); a finished run with no lives lost and 4+ waves cleared tops up to 150. */
export function burstScoreOf(hits: number, livesLost: number, cleared: number, ended: boolean): number {
  if (ended && livesLost === 0 && cleared >= TOP_UP_WAVES) return 150;
  return clampInt(HIT_POINTS * hits - LIFE_COST * livesLost, 0, 150);
}

/** burstRev 2: the same points, but 150 only for a finished run with no life lost and 4+ waves cleared. */
export function burstScoreV2(hits: number, livesLost: number, cleared: number, ended: boolean): number {
  if (ended && livesLost === 0 && cleared >= TOP_UP_WAVES) return 150;
  return clampInt(HIT_POINTS * hits - LIFE_COST * livesLost, 0, BURST_V2_PARTIAL_MAX);
}

function score(state: BurstState): number {
  if (state.rev === BURST_REV) return burstScoreV2(state.hits, BURST_LIVES - state.lives, state.cleared, state.ended !== 0);
  return burstScoreOf(state.hits, BURST_LIVES - state.lives, state.cleared, state.ended !== 0);
}

/* ============================= Checkpoints ============================= */

export const BURST_CHECKPOINT_INTERVAL = 300;
export const BURST_CHECKPOINT_KEYS = [
  "tick", "wave", "balls", "x", "targetX", "shots", "burst", "lives", "invuln", "hits", "cleared", "ended", "rng", "checksum",
] as const;

export interface BurstCheckpoint {
  tick: number;
  wave: number;
  balls: number;
  x: number;
  targetX: number;
  shots: number;
  burst: number;
  lives: number;
  invuln: number;
  hits: number;
  cleared: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function burstCheckpoint(state: BurstState): BurstCheckpoint {
  const snap = {
    tick: state.tick,
    wave: state.wave,
    balls: state.balls.length,
    x: state.x,
    targetX: state.targetX,
    shots: state.shots.length,
    burst: state.burst,
    lives: state.lives,
    invuln: state.invuln,
    hits: state.hits,
    cleared: state.cleared,
    ended: state.ended,
    rng: state.rng | 0,
  };
  const values = [...Object.values(snap), state.nextWaveAt, state.burstLeft, state.burstNext, state.shield];
  // burstRev 2 only, so original checksums are unchanged.
  if (state.rev !== undefined) values.push(state.rev, state.freeze ?? 0, state.freezes ?? 0);
  for (const ball of state.balls) values.push(ball.size, ball.x, ball.y, ball.vx, ball.vy);
  for (const shot of state.shots) values.push(shot.x, shot.top, shot.short);
  for (const icon of state.icons) values.push(icon.x, icon.y, icon.kind);
  // burstRev 4 (taller worlds): the floor, last.
  if (state.worldH) values.push(state.worldH);
  let checksum = 0x811c9dc5;
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const BURST_BG = "#07070D";
export const BURST_GOLD = "#F5B82E";
export const BURST_TEAL = "#2ED3B7";
/** L purple, M blue, S green, XS gold. */
export const BURST_COLOURS = ["#A970FF", "#4DA3FF", "#4BD66B", "#F5B82E"] as const;

function draw(ctx: CanvasRenderingContext2D, state: BurstState, size: CanvasSize): void {
  const FLOOR_Y = burstFloorY(state);
  const scale = Math.min(size.width / BURST_WORLD_W, size.height / FLOOR_Y);
  const ox = (size.width - BURST_WORLD_W * scale) / 2;
  const oy = (size.height - FLOOR_Y * scale) / 2;
  ctx.save();
  ctx.fillStyle = BURST_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const tick = state.tick;

  // Ceiling, walls, floor.
  const ceil = burstCeiling(state.wave, FLOOR_Y);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, BURST_WORLD_W, ceil);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, ceil, BURST_WORLD_W - 2, FLOOR_Y - ceil);
  ctx.strokeStyle = BURST_TEAL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y);
  ctx.lineTo(BURST_WORLD_W, FLOOR_Y);
  ctx.stroke();

  // Shots: a long line with a hook, or a short BURST dash.
  ctx.strokeStyle = BURST_GOLD;
  ctx.lineWidth = 3;
  for (const shot of state.shots) {
    const x = shot.x / FP;
    const top = shot.top / FP;
    ctx.beginPath();
    if (shot.short) {
      ctx.moveTo(x, top + BURST_SHORT_LEN);
      ctx.lineTo(x, top);
    } else {
      ctx.moveTo(x, FLOOR_Y);
      ctx.lineTo(x, top);
      ctx.lineTo(x + 5, top + 6);
    }
    ctx.stroke();
  }

  // Power-up icons: a gold diamond (BURST) or a teal shield ring.
  for (const icon of state.icons) {
    const x = icon.x / FP;
    const y = icon.y / FP;
    if (icon.kind === 1) {
      ctx.strokeStyle = BURST_TEAL;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, ICON_HALF, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = BURST_TEAL;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = BURST_GOLD;
    ctx.beginPath();
    ctx.moveTo(x, y - ICON_HALF);
    ctx.lineTo(x + ICON_HALF, y);
    ctx.lineTo(x, y + ICON_HALF);
    ctx.lineTo(x - ICON_HALF, y);
    ctx.closePath();
    ctx.fill();
  }

  for (const ball of state.balls) {
    const r = BURST_RADIUS[ball.size]!;
    ctx.strokeStyle = BURST_COLOURS[ball.size]!;
    ctx.lineWidth = Math.max(4, r / 4);
    ctx.beginPath();
    ctx.arc(ball.x / FP, ball.y / FP, r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (tick - state.popTick < 10) {
    const f = (tick - state.popTick) / 10;
    ctx.globalAlpha = 1 - f;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(state.popX / FP, state.popY / FP, BURST_RADIUS[state.popSize]! * (0.6 + f), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Player: capsule body and a small head; flashes while invulnerable.
  if (state.invuln === 0 || Math.trunc(tick / 5) % 2 === 0) {
    const px = state.x / FP;
    ctx.fillStyle = BURST_GOLD;
    ctx.beginPath();
    ctx.roundRect(px - PLAYER_HALF_W, FLOOR_Y - 26, PLAYER_HALF_W * 2, 26, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, FLOOR_Y - 31, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.shield) {
    ctx.strokeStyle = BURST_TEAL;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(state.x / FP, FLOOR_Y - 18, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = BURST_GOLD;
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Wave ${Math.max(1, state.wave)} · ${score(state)}${state.burst ? " · BURST" : ""}`, 16, 28);
  for (let i = 0; i < BURST_LIVES; i++) {
    ctx.fillStyle = i < state.lives ? BURST_GOLD : "rgba(245,184,46,0.2)";
    ctx.beginPath();
    ctx.arc(BURST_WORLD_W - 100 + i * 16, 22, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const burstGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = {
  key: "burst",
  runTicks: BURST_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: BURST_INPUT_RANGES,
};

const burstGameV2: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGame, init: initV2 };

/** The game for a stored burstRev (absent = the original drops). */
export function burstGameFor(rev?: number | null): ArcadeGame<BurstState, ArcadeInputEvent | null> {
  if (rev === BURST_REV_STRICT) return burstStrictGame;
  if (rev === BURST_REV_TARGET) return burstTargetGame;
  if (rev === BURST_REV_TALL) return burstTallGame;
  if (rev === BURST_REV_BAND) return burstBandGame;
  return rev === BURST_REV ? burstGameV2 : burstGame;
}

/* ================= Oct 2026 score bands (burstRev 3) ================= */

/** Score-band revision (puzzle.burstRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const BURST_REV_BAND = 3;
/** Atoms hit, minus 5 a life lost; 140 at 100; lasting the 90 s adds 10 (no 130 cap, no 150 shortcut). */
export const BURST_BAND_CURVE = bandCurve([0, 55, 76, 88, 100], [0, 70, 100, 125, 140]);
export function burstBandParts(state: BurstState): BandParts {
  const units = Math.max(0, state.hits - 5 * (BURST_LIVES - state.lives));
  const finished = state.ended === 1;
  return { units, points: bandPoints(bandCurveOf(state, state.worldH ? BURST_V4_BAND_CURVE : BURST_BAND_CURVE), units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${state.hits} atoms · ${BURST_LIVES - state.lives} lives lost`, bonusText: "Lasted the 90 s" };
}

function scoreBand(state: BurstState): number {
  return bandTotal(burstBandParts(state), Boolean(state.acted));
}

export const burstBandGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameV2, init: (seed) => bandInit(burstGameV2.init(seed)) };

/* ================= Taller worlds (burstRev 4, Oct 2026) ================= */

/**
 * burstRev 4 (taller worlds, batch 1): burstRev 3 play (the waves, drops,
 * lives and scoring rules) in a taller arena, 390 × BURST_TALL_H with the floor
 * at its bottom (the arrow row stays below the arena). Every height scales
 * with the arena (burstGeometry): each atom size bounces to the same share of
 * the taller arena, and the ceiling's lowest point and its drop per wave scale
 * with it, so atoms still use the whole height. States keep `rev: 2` and add
 * `worldH`, folded into the checkpoint checksum last. Scored on
 * BURST_V4_BAND_CURVE.
 */
export const BURST_REV_TALL = 4;
export const BURST_TALL_H = 650;
/**
 * burstRev 4 band knots (atoms hit, minus 5 a life lost): the taller bounces are
 * slower, so the same players hit a few fewer atoms in the 90 s and the upper knots
 * come down (refitted with scripts/arcade-skill-bands.ts --rev=g1, 60 seeds: unit
 * medians 54.5 / 74.5 / 83 / 84; great and near-perfect players barely separate);
 * 140 at 95, lasting the 90 s still adds 10.
 */
export const BURST_V4_BAND_CURVE = bandCurve([0, 55, 79, 84, 95], [0, 70, 100, 125, 140]);
export const burstTallGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameV2, init: (seed) => ({ ...burstBandGame.init(seed), worldH: BURST_TALL_H }) };

/** The drawn world's height (the floor, px) a stored round's burstRev plays in. */
export function burstWorldHFor(rev?: number | null): number {
  return rev === BURST_REV_TALL || rev === BURST_REV_TARGET || rev === BURST_REV_STRICT ? BURST_TALL_H : BURST_FLOOR_Y;
}

/* ================= Scoring targets (burstRev 5, 18 Oct 2026) ================= */

/**
 * burstRev 5 (scoring targets, docs/scoring-targets.md): burstRev 4 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const BURST_REV_TARGET = 5;
export const burstTargetGame = bandTargetGame(burstTallGame);
/** The curve new rounds score on: BURST_V4_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const BURST_V5_BAND_CURVE = bandRetarget(BURST_V4_BAND_CURVE);


/* ================= Score bands (burstRev 6, 19 Oct 2026) ================= */

/**
 * burstRev 6 (score bands, docs/scoring-targets.md): burstRev 5 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const BURST_REV_STRICT = 6;
export const burstStrictGame = bandStrictGame(burstTargetGame);
/** The curve new rounds score on: BURST_V4_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const BURST_V6_BAND_CURVE = bandStrict(BURST_V4_BAND_CURVE);
