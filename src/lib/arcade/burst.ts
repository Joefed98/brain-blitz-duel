/**
 * Burst — pop bouncing balls with a vertical shot; big balls split into two
 * smaller ones. Drags set the player's target x (k = 7, a = x); taps fire
 * (k = 0; b alternates so repeated taps stay distinct events). Every wave is
 * drawn at init from the seed. Popping an L ball drops a gold icon (2 px/tick);
 * catching it switches to BURST shots — three short 12 px/tick shots 8 ticks
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
const ICON_HALF = 8;
const BURST_SHOTS = 3;
const BURST_GAP = 8;
const BURST_SPEED = 12 * FP;
export const BURST_SHORT_LEN = 30;
/** Popping an M ball drops a SHIELD icon one time in this many (seeded). */
const SHIELD_ODDS = 4;
/** Ceiling deflection (±15°) from this wave, when the ball hits faster than this. */
const DEFLECT_FROM_WAVE = 3;
const DEFLECT_MIN_VY = 2 * FP;
const COS15 = 989;
const SIN15 = 265;
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

export function burstCeiling(wave: number): number {
  return Math.min(CEIL_MAX, CEIL_START + CEIL_STEP * Math.max(0, wave - 5));
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
  /** 0 BURST shots (gold), 1 SHIELD (teal). */
  kind: number;
}

export interface BurstState {
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

function isOver(state: BurstState): boolean {
  return state.ended !== 0;
}

/** Circle against the player's box, all in 1/256 px. */
function touches(ball: BurstBall, px: number): boolean {
  const r = BURST_RADIUS[ball.size]! * FP;
  const left = px - PLAYER_HALF_W * FP;
  const right = px + PLAYER_HALF_W * FP;
  const top = (BURST_FLOOR_Y - PLAYER_H) * FP;
  const bottom = BURST_FLOOR_Y * FP;
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
    } else if (s.shots.length === 0) s.shots.push({ x: s.x, top: BURST_FLOOR_Y * FP, short: 0 });
  }

  // Player walks toward its target.
  s.x += clampInt(s.targetX - s.x, -PLAYER_SPEED, PLAYER_SPEED);
  if (s.burst && s.burstLeft > 0 && tick >= s.burstNext) {
    s.shots.push({ x: s.x, top: (BURST_FLOOR_Y - PLAYER_H) * FP, short: 1 });
    s.burstLeft -= 1;
    s.burstNext = tick + BURST_GAP;
  }
  if (s.invuln > 0) s.invuln -= 1;

  // Next wave enters.
  if (s.balls.length === 0 && tick >= s.nextWaveAt && s.wave < s.waves.length) {
    s.wave += 1;
    const ceil = burstCeiling(s.wave);
    for (const spawn of s.waves[s.wave - 1]!) {
      const r = BURST_RADIUS[spawn.size]!;
      const y = Math.min(BURST_FLOOR_Y - r - 40, ceil + r + 20 + spawn.lift);
      s.balls.push({
        size: spawn.size,
        x: (spawn.side ? BURST_WORLD_W - r - 2 : r + 2) * FP,
        y: y * FP,
        vx: spawn.side ? -SPEED_X[spawn.size]! : SPEED_X[spawn.size]!,
        vy: 0,
      });
    }
  }

  // Balls bounce.
  const ceil = burstCeiling(s.wave) * FP;
  for (const ball of s.balls) {
    const r = BURST_RADIUS[ball.size]! * FP;
    ball.vy += GRAVITY;
    ball.y += ball.vy;
    ball.x += ball.vx;
    if (ball.y + r >= BURST_FLOOR_Y * FP) {
      ball.y = BURST_FLOOR_Y * FP - r;
      ball.vy = -BOUNCE_V[ball.size]!;
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
    const bottom = shot.short ? shot.top + BURST_SHORT_LEN * FP : BURST_FLOOR_Y * FP;
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
      if (ball.size === 0) s.icons.push({ x: ball.x, y: ball.y, kind: 0 });
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
    icon.y += ICON_FALL;
    const top = (BURST_FLOOR_Y - PLAYER_H) * FP;
    const near = Math.abs(icon.x - s.x) <= (PLAYER_HALF_W + ICON_HALF) * FP;
    if (near && icon.y + ICON_HALF * FP >= top) {
      if (icon.kind === 1) s.shield = 1;
      else s.burst = 1;
    }
    else if (icon.y - ICON_HALF * FP < BURST_FLOOR_Y * FP) falling.push(icon);
  }
  s.icons = falling;

  // Touching the player costs a life and the BURST shots.
  if (s.invuln === 0 && s.balls.some((ball) => touches(ball, s.x))) {
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

function score(state: BurstState): number {
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
  for (const ball of state.balls) values.push(ball.size, ball.x, ball.y, ball.vx, ball.vy);
  for (const shot of state.shots) values.push(shot.x, shot.top, shot.short);
  for (const icon of state.icons) values.push(icon.x, icon.y, icon.kind);
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
  const scale = Math.min(size.width / BURST_WORLD_W, size.height / BURST_FLOOR_Y);
  const ox = (size.width - BURST_WORLD_W * scale) / 2;
  const oy = (size.height - BURST_FLOOR_Y * scale) / 2;
  ctx.save();
  ctx.fillStyle = BURST_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const tick = state.tick;

  // Ceiling, walls, floor.
  const ceil = burstCeiling(state.wave);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, BURST_WORLD_W, ceil);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, ceil, BURST_WORLD_W - 2, BURST_FLOOR_Y - ceil);
  ctx.strokeStyle = BURST_TEAL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, BURST_FLOOR_Y);
  ctx.lineTo(BURST_WORLD_W, BURST_FLOOR_Y);
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
      ctx.moveTo(x, BURST_FLOOR_Y);
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
    ctx.roundRect(px - PLAYER_HALF_W, BURST_FLOOR_Y - 26, PLAYER_HALF_W * 2, 26, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, BURST_FLOOR_Y - 31, 6, 0, Math.PI * 2);
    ctx.fill();
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
  step,
  isOver,
  score,
  draw,
  inputRanges: BURST_INPUT_RANGES,
};
