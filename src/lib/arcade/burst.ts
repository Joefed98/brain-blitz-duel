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
import { stdFinal } from "./arcadeStandard";
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
  /** burstRev 9 only: the atom's identity (wave, spawn and split path; burstAtomId), the same for every player. */
  id?: number;
}

export interface BurstShot {
  x: number;
  top: number;
  /** 1 for a short BURST shot. */
  short: number;
  /** burstRev 8 only: the shot (one tap: one beam, or the double beam's two) this beam belongs to. */
  g?: number;
}

/** burstRev 8: one shot in flight, its beams still climbing, whether any hit, and the wave it counts for. */
export interface BurstShotGroup {
  g: number;
  left: number;
  hit: number;
  wave: number;
}

/** burstRev 8: a scheduled power-up (2 FREEZE, 3 DOUBLE beam) or golden atom: when and where, fixed at init from the seed. */
export interface BurstScheduled {
  tick: number;
  x: number;
  y: number;
  kind: number;
}

export interface BurstIcon {
  x: number;
  y: number;
  /** 0 BURST shots (gold), 1 SHIELD (teal), 2 FREEZE (burstRev 2), 3 DOUBLE beam (burstRev 8). */
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
  /** burstRev 8 only (the expansion, docs/expansions/e9.md): every field below is absent on earlier rounds. */
  exp?: number;
  /** The seeded schedules: power-ups (dropped from the top) and golden atoms (hovering), and the golden atoms taken (bit n). */
  drops?: BurstScheduled[];
  goldens?: BurstScheduled[];
  goldHit?: number;
  /** The tick of the latest golden atom taken (render only: the pop). */
  goldAt?: number;
  /** Double beam: ticks left (two beams per shot) and DOUBLE icons caught. */
  double?: number;
  doubles?: number;
  /** The tick the wave on screen appeared, and wave-clear time points. */
  waveAt?: number;
  clearPts?: number;
  /** The last wave cleared's time bonus and clean bonus (render only: the pop). */
  lastClear?: number;
  lastClean?: number;
  /** Clean waves: shots in flight, the next shot's id, this wave's shots fired and shots that hit, whether one missed, and clean waves so far. */
  groups?: BurstShotGroup[];
  nextG?: number;
  fired?: number;
  landed?: number;
  missed?: number;
  cleanWaves?: number;
  /** The wave the clean counter is for: the one on screen, or the next one once it is cleared. */
  cw?: number;
  /** burstRev 9 only (docs/phone-notes-oct-2026/fission.md): every field below is absent on earlier rounds. */
  carry?: number;
  /** The seeded carriers: atom id → the power-up it drops when it splits. */
  carriers?: BurstCarrier[];
  /** BURST shots: ticks left (0 = off). */
  burstT?: number;
  /** BURST icons caught. */
  bursts?: number;
  /** The golden atom in play: its index (-1 none), centre and speed (1/256 px). */
  gn?: number;
  gx?: number;
  gy?: number;
  gvx?: number;
  gvy?: number;
  /** Waves cleared with a time bonus. */
  quickWaves?: number;
  /** burstRev 10 only (the arcade scoring standard, docs/arcade-standard/burst.md): every field below is absent on earlier rounds. */
  std?: number;
  /** Each wave's golden atom: -1 its wave not reached yet, the tick it is due (its wave's entry plus its seeded delay), -2 once it has appeared. */
  gDue?: number[];
  /** The tick the golden atom in play fades. */
  gUntil?: number;
  /** 1 once every wave is cleared (and the last golden atom gone): the run is complete. */
  done?: number;
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
  const geo = state.exp ? burstGeometryV8(burstFloorY(state)) : burstGeometry(burstFloorY(state));
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
    } else if (s.shots.length === 0) {
      if (s.carry) burstFireV9(s, FLOOR_Y);
      else if (s.exp) burstFireV8(s, FLOOR_Y);
      else s.shots.push({ x: s.x, top: FLOOR_Y * FP, short: 0 });
    }
  }

  // Player walks toward its target.
  s.x += clampInt(s.targetX - s.x, -PLAYER_SPEED, PLAYER_SPEED);
  if (s.burst && s.burstLeft > 0 && tick >= s.burstNext) {
    s.shots.push({ x: s.x, top: (FLOOR_Y - PLAYER_H) * FP, short: 1 });
    s.burstLeft -= 1;
    s.burstNext = tick + BURST_GAP;
  }
  if (s.invuln > 0) s.invuln -= 1;
  if (s.carry && (s.burstT ?? 0) > 0) {
    s.burstT = (s.burstT ?? 0) - 1;
    if (s.burstT === 0) {
      s.burst = 0;
      s.burstLeft = 0;
    }
  }

  // Next wave enters.
  if (s.balls.length === 0 && tick >= s.nextWaveAt && s.wave < s.waves.length) {
    s.wave += 1;
    const ceil = s.exp ? burstCeilingV8(s.wave, FLOOR_Y) : burstCeiling(s.wave, FLOOR_Y);
    s.waves[s.wave - 1]!.forEach((spawn, index) => {
      const r = BURST_RADIUS[spawn.size]!;
      const y = Math.min(FLOOR_Y - r - 40, ceil + r + 20 + spawn.lift);
      s.balls.push({
        size: spawn.size,
        x: (spawn.side ? BURST_WORLD_W - r - 2 : r + 2) * FP,
        y: y * FP,
        vx: spawn.side ? -SPEED_X[spawn.size]! : SPEED_X[spawn.size]!,
        vy: 0,
        // burstRev 9: each atom's identity, for its seeded power-up.
        ...(s.carry ? { id: burstAtomId(s.wave, index) } : {}),
      });
    });
    if (s.exp) s.waveAt = tick;
    // burstRev 10: this wave's golden atom is due its seeded delay after the wave appears.
    if (s.std && s.gDue && s.wave <= s.gDue.length) s.gDue = s.gDue.map((d, i) => (i === s.wave - 1 ? tick + s.goldens![i]!.tick : d));
  }

  // Balls bounce (burstRev 2: not while frozen).
  const ceil = (s.exp ? burstCeilingV8(s.wave, FLOOR_Y) : burstCeiling(s.wave, FLOOR_Y)) * FP;
  const frozen = (s.freeze ?? 0) > 0;
  if (frozen) s.freeze = (s.freeze ?? 0) - 1;
  if (s.exp && (s.double ?? 0) > 0) s.double = (s.double ?? 0) - 1;
  if (s.std) burstGoldenStepV10(s, tick, geo, ceil, frozen);
  else if (s.carry) burstGoldenStepV9(s, tick, geo, ceil, frozen);
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
    if (hit >= 0 && s.carry) burstSplitV9(s, hit, tick);
    else if (hit >= 0 && s.exp) {
      // burstRev 8: the split (no drops: power-ups come on the schedule); the beam's shot hit.
      burstSplitV8(s, hit, tick);
      burstBeamDoneV8(s, shot, true);
    } else if (hit >= 0) {
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
    } else if (s.carry ? burstGoldenV9(s, tick, shot, bottom) : s.exp && burstGoldenV8(s, tick, shot)) {
      if (!s.carry) burstBeamDoneV8(s, shot, true);
    }
    else if (shot.top > ceil) flying.push(shot);
    else if (s.exp && !s.carry) burstBeamDoneV8(s, shot, false);
  }
  s.shots = flying;
  if (s.exp) burstDropsV8(s, tick);

  // Power-up icons fall; the player catches them, the floor loses them.
  const falling: BurstIcon[] = [];
  for (const icon of s.icons) {
    icon.y += icon.kind === 0 ? BURST_ICON_FALL : ICON_FALL;
    const top = (FLOOR_Y - PLAYER_H) * FP;
    const near = Math.abs(icon.x - s.x) <= (PLAYER_HALF_W + ICON_HALF) * FP;
    if (near && icon.y + ICON_HALF * FP >= top) {
      if (icon.kind === 1) s.shield = 1;
      else if (s.carry && (icon.kind === BURST_ICON_DOUBLE || icon.kind === BURST_ICON_BURST)) burstCatchV9(s, icon.kind);
      else if (icon.kind === BURST_ICON_DOUBLE) {
        s.double = BURST_DOUBLE_TICKS;
        s.doubles = (s.doubles ?? 0) + 1;
      } else if (icon.kind === BURST_ICON_FREEZE) {
        s.freeze = BURST_FREEZE_TICKS;
        s.freezes = (s.freezes ?? 0) + 1;
      } else s.burst = 1;
    }
    else if (icon.y - ICON_HALF * FP < FLOOR_Y * FP) falling.push(icon);
  }
  s.icons = falling;

  // Touching the player costs a life and the BURST shots.
  // burstRev 10: the golden atom hurts like any other atom.
  if (s.invuln === 0 && (s.balls.some((ball) => touches(ball, s.x, FLOOR_Y)) || (s.std && burstGoldenTouchesV10(s, FLOOR_Y)))) {
    if (s.shield) {
      // The shield takes the hit and vanishes; no life lost.
      s.shield = 0;
      s.invuln = INVULN_TICKS;
    } else {
    s.lives -= 1;
    s.invuln = INVULN_TICKS;
    s.burst = 0;
    s.burstLeft = 0;
    // burstRev 8: a lost life also ends the double beam (burstRev 9: and the BURST shots' clock).
    if (s.exp) s.double = 0;
    if (s.carry) s.burstT = 0;
    }
  }

  // burstRev 10's run holds five waves: a cleared wave counts once (no waves follow the last).
  if (s.balls.length === 0 && s.wave > 0 && s.nextWaveAt <= state.tick && !(s.std && s.cleared >= s.wave)) {
    s.cleared += 1;
    s.nextWaveAt = tick + WAVE_GAP;
    if (s.std) burstWaveClearV10(s, tick);
    else if (s.carry) burstWaveClearV9(s, tick);
    else if (s.exp) burstWaveClearV8(s, tick);
  }

  if (s.lives <= 0) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (s.std && burstCompleteV10(s)) {
    // burstRev 10: every wave cleared and the last golden atom gone: the run is complete.
    s.done = 1;
    s.ended = 1;
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
  // burstRev 8 (the expansion): its own state after that, so every earlier checksum is unchanged.
  if (state.exp) {
    values.push(state.exp, state.double ?? 0, state.doubles ?? 0, state.goldHit ?? 0, state.waveAt ?? 0, state.clearPts ?? 0, state.nextG ?? 0, state.fired ?? 0, state.landed ?? 0, state.missed ?? 0, state.cleanWaves ?? 0, state.cw ?? 0);
    for (const shot of state.shots) values.push(shot.g ?? 0);
    for (const group of state.groups ?? []) values.push(group.g, group.left, group.hit, group.wave);
  }
  // burstRev 9: its own state after that.
  if (state.carry) {
    values.push(state.carry, state.burstT ?? 0, state.bursts ?? 0, state.gn ?? -1, state.gx ?? 0, state.gy ?? 0, state.gvx ?? 0, state.gvy ?? 0, state.quickWaves ?? 0);
    for (const ball of state.balls) values.push(ball.id ?? 0);
  }
  // burstRev 10: its own state after that.
  if (state.std) {
    values.push(state.std, state.gUntil ?? 0, state.done ?? 0);
    for (const due of state.gDue ?? []) values.push(due);
  }
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
  if (rev === BURST_REV_STD) return burstStdGame;
  if (rev === BURST_REV_CARRY) return burstCarryGame;
  if (rev === BURST_REV_CLEAN) return burstCleanGame;
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
  if (state.std) return burstStdBandParts(state);
  if (state.carry) return burstCarryParts(state);
  if (state.exp) return burstCleanParts(state);
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
  return rev === BURST_REV_STD || rev === BURST_REV_CARRY || rev === BURST_REV_CLEAN || rev === BURST_REV_TALL || rev === BURST_REV_TARGET || rev === BURST_REV_STRICT ? BURST_TALL_H : BURST_FLOOR_Y;
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




/* ================= The expansion (burstRev 8, 26 Oct 2026) ================= */

/**
 * burstRev 8 (the 200-point expansion, docs/expansions/e9.md): burstRev 6's waves, lives and ship in a
 * higher arena, with the skill features below, scored to 200 (docs/scoring-200.md). Every power-up and
 * golden atom is placed and timed by the room seed at init, the same for every player, never by which
 * atom a player popped; atoms drop nothing.
 *
 *  - Higher arena: the same 390 × 650 world with the ceiling starting at 24 px (was 40), each atom
 *    bouncing higher (84 / 70 / 54 / 38 % of the arena, was 75 / 60 / 45 / 30) and the ceiling never lower
 *    than 70 % of the arena above the floor (was 60 %).
 *  - Power-ups on a fixed schedule: BURST_V8_DROPS of them, one in each BURST_V8_DROP_SLOT window, each a
 *    DOUBLE beam (8 s of two beams a shot) or a FREEZE (3 s with every atom still), falling from the top
 *    at a seeded x. They pay nothing themselves. (The original BURST and SHIELD drops are gone.)
 *  - Golden atoms: BURST_V8_GOLDENS of them, each at a seeded moment and a seeded spot in the middle of
 *    the arena, up for BURST_V8_GOLDEN_LIFE; a beam that reaches it takes it for BURST_V8_GOLDEN_PTS.
 *  - Wave-clear time bonus: 3 for clearing a wave within 5 s of it appearing, 2 within 8 s, 1 within 12 s.
 *  - Clean wave: a wave cleared with no missed shot adds BURST_V8_CLEAN_PTS. A shot is one tap (the
 *    double beam's two beams are one shot); it misses when every beam of it reaches the ceiling without
 *    hitting an atom or a golden atom. A shot counts for the wave on screen when it is fired (the next
 *    wave between waves). HUD: "CLEAN hit/fired".
 *
 * Score: atoms hit less 5 a life lost (never below a quarter of the atoms hit, so a run that hits atoms
 * always scores) on BURST_V8_BAND_CURVE, 10 for lasting the 90 s, plus the features'
 * points, each capped (BURST_V8_CAPS), to 200. States keep `rev: 2` and `worldH` and add `exp: 1` and the
 * fields above, folded into the checkpoint checksum last.
 */
export const BURST_REV_CLEAN = 8;
export const BURST_V8_MAX = 200;
const CEIL_START_V8 = 24;
const APEX_PCT_V8 = [84, 70, 54, 38] as const;
export const BURST_ICON_DOUBLE = 3;
export const BURST_DOUBLE_TICKS = 8 * TICKS_PER_SECOND;
/** Each beam of a double shot sits this far either side of the ship: under the smallest atom's radius, so the pair never straddles a centred atom. */
export const BURST_DOUBLE_GAP = 7;
/** Power-ups: one in each 12 s window from 6 s, at a seeded 0–2 s into it. */
export const BURST_V8_DROPS = 7;
export const BURST_V8_DROP_FROM = 6 * TICKS_PER_SECOND;
export const BURST_V8_DROP_SLOT = 12 * TICKS_PER_SECOND;
export const BURST_V8_DROP_JITTER = 2 * TICKS_PER_SECOND;
/** Golden atoms: one in each 13 s window from 8 s, at a seeded 0–3 s into it, up for 4 s, 9 px radius. */
export const BURST_V8_GOLDENS = 6;
export const BURST_V8_GOLDEN_FROM = 8 * TICKS_PER_SECOND;
export const BURST_V8_GOLDEN_SLOT = 13 * TICKS_PER_SECOND;
export const BURST_V8_GOLDEN_JITTER = 3 * TICKS_PER_SECOND;
export const BURST_V8_GOLDEN_LIFE = 4 * TICKS_PER_SECOND;
export const BURST_GOLD_R = 9;
/** A golden atom's centre: this far inside the side walls, and this far below the lowest the ceiling comes (and this deep a band). */
export const BURST_V8_GOLDEN_SIDE = 30;
export const BURST_V8_GOLDEN_BELOW = 24;
export const BURST_V8_GOLDEN_BAND = 110;
/** Points: a golden atom, a clean wave. */
export const BURST_V8_GOLDEN_PTS = 6;
export const BURST_V8_CLEAN_PTS = 5;
/** Each feature's most points. */
export const BURST_V8_CAPS = { gold: 36, clear: 12, clean: 25 } as const;

const geometriesV8 = new Map<number, BurstGeometry>();
/** burstRev 8's higher arena: the ceiling from 24 px, higher bounces and a higher lowest ceiling. */
export function burstGeometryV8(floor: number): BurstGeometry {
  let g = geometriesV8.get(floor);
  if (!g) {
    const arenaH = floor - CEIL_START_V8;
    g = {
      floor,
      arenaH,
      ceilMax: floor - Math.trunc((arenaH * 70) / 100),
      ceilStep: Math.trunc((CEIL_STEP * arenaH) / ARENA_H),
      bounceV: APEX_PCT_V8.map((pct) => isqrt(2 * GRAVITY * Math.trunc((arenaH * pct) / 100) * FP)),
    };
    geometriesV8.set(floor, g);
  }
  return g;
}

export function burstCeilingV8(wave: number, floor: number): number {
  const g = burstGeometryV8(floor);
  return Math.min(g.ceilMax, CEIL_START_V8 + g.ceilStep * Math.max(0, wave - 5));
}

/** The ceiling (px) of a state's arena now, for any revision. */
export function burstCeilingOf(state: BurstState): number {
  return state.exp ? burstCeilingV8(state.wave, burstFloorY(state)) : burstCeiling(state.wave, burstFloorY(state));
}

/** The bounce speeds (1/256 px a tick) of a state's arena, for any revision (the bots read them). */
export function burstBounceOf(state: BurstState): readonly number[] {
  return (state.exp ? burstGeometryV8(burstFloorY(state)) : burstGeometry(burstFloorY(state))).bounceV;
}

export function burstClearPoints(ticks: number): number {
  return ticks <= 5 * TICKS_PER_SECOND ? 3 : ticks <= 8 * TICKS_PER_SECOND ? 2 : ticks <= 12 * TICKS_PER_SECOND ? 1 : 0;
}

/**
 * burstRev 8's schedules for a seed: a stream of its own (so the waves, drawn first from the seed, are
 * burstRev 6's), the power-ups first, then the golden atoms. Pure: the same for every player and the server.
 */
export function burstScheduleV8(seed: number, floor: number = BURST_TALL_H): { drops: BurstScheduled[]; goldens: BurstScheduled[] } {
  let rng = (seed ^ 0x46495338) | 0;
  const draw = (bound: number): number => {
    const d = rngBelow(rng, bound);
    rng = d.state;
    return d.value;
  };
  const drops: BurstScheduled[] = [];
  // Kinds alternate from a seeded first, so every run has both.
  const first = draw(2);
  for (let n = 0; n < BURST_V8_DROPS; n++) {
    const tick = BURST_V8_DROP_FROM + n * BURST_V8_DROP_SLOT + draw(BURST_V8_DROP_JITTER + 1);
    const x = BURST_V8_GOLDEN_SIDE + draw(BURST_WORLD_W - 2 * BURST_V8_GOLDEN_SIDE + 1);
    drops.push({ tick, x, y: CEIL_START_V8 + ICON_HALF, kind: (n + first) % 2 === 0 ? BURST_ICON_DOUBLE : BURST_ICON_FREEZE });
  }
  const top = burstGeometryV8(floor).ceilMax + BURST_V8_GOLDEN_BELOW;
  const goldens: BurstScheduled[] = [];
  for (let n = 0; n < BURST_V8_GOLDENS; n++) {
    const tick = BURST_V8_GOLDEN_FROM + n * BURST_V8_GOLDEN_SLOT + draw(BURST_V8_GOLDEN_JITTER + 1);
    const x = BURST_V8_GOLDEN_SIDE + draw(BURST_WORLD_W - 2 * BURST_V8_GOLDEN_SIDE + 1);
    const y = top + draw(BURST_V8_GOLDEN_BAND + 1);
    goldens.push({ tick, x, y, kind: 0 });
  }
  return { drops, goldens };
}

/** burstRev 8: whether golden atom n is up at a tick (appeared, not gone, not taken). */
export function burstGoldenLive(state: Pick<BurstState, "goldens" | "goldHit">, n: number, tick: number): boolean {
  const g = state.goldens?.[n];
  return !!g && tick >= g.tick && tick < g.tick + BURST_V8_GOLDEN_LIFE && ((state.goldHit ?? 0) & (1 << n)) === 0;
}

/** burstRev 8: the golden atom up at a tick, or -1 (the windows never overlap). */
export function burstGoldenNow(state: Pick<BurstState, "goldens" | "goldHit">, tick: number): number {
  for (let n = 0; n < (state.goldens ?? []).length; n++) if (burstGoldenLive(state, n, tick)) return n;
  return -1;
}

/** burstRev 8: golden atoms taken. */
export function burstGoldenCount(state: Pick<BurstState, "goldHit">): number {
  let n = 0;
  for (let bits = state.goldHit ?? 0; bits; bits &= bits - 1) n++;
  return n;
}

/** burstRev 8: one tap fires a shot: one beam, or two either side of the ship while the double beam is on. */
function burstFireV8(s: BurstState, floor: number): void {
  const g = (s.nextG ?? 0) + 1;
  s.nextG = g;
  const xs = (s.double ?? 0) > 0 ? [s.x - BURST_DOUBLE_GAP * FP, s.x + BURST_DOUBLE_GAP * FP] : [s.x];
  for (const x of xs) s.shots.push({ x: clampInt(x, 0, BURST_WORLD_W * FP), top: floor * FP, short: 0, g });
  // It counts for the wave the counter shows: the one on screen, or the next one between waves.
  s.groups = [...(s.groups ?? []), { g, left: xs.length, hit: 0, wave: s.cw ?? 1 }];
  s.fired = (s.fired ?? 0) + 1;
}

/**
 * burstRev 8: a beam has ended, on an atom or golden atom (`hit`) or at the ceiling. A shot counts as hit on its first
 * beam to hit (at once, so the last atom of a wave counts before the wave clears) and as a miss only when its last
 * beam ends without any having hit. Only a shot counting for the wave the counter shows moves it.
 */
function burstBeamDoneV8(s: BurstState, shot: BurstShot, hit: boolean): void {
  const groups = (s.groups ?? []).map((group) => ({ ...group }));
  const group = groups.find((item) => item.g === shot.g);
  if (!group) return;
  const current = group.wave === (s.cw ?? 1);
  if (hit && !group.hit) {
    group.hit = 1;
    if (current) s.landed = (s.landed ?? 0) + 1;
  }
  group.left -= 1;
  if (group.left <= 0) {
    if (!group.hit && current) s.missed = 1;
    s.groups = groups.filter((item) => item !== group);
  } else s.groups = groups;
}

/** burstRev 8: a beam reaching the golden atom up now takes it (the beam stops there). */
function burstGoldenV8(s: BurstState, tick: number, shot: BurstShot): boolean {
  const n = burstGoldenNow(s, tick);
  if (n < 0) return false;
  const g = s.goldens![n]!;
  const r = BURST_GOLD_R * FP;
  if (Math.abs(shot.x - g.x * FP) > r || shot.top > g.y * FP + r) return false;
  s.goldHit = (s.goldHit ?? 0) | (1 << n);
  s.goldAt = tick;
  s.popX = g.x * FP;
  s.popY = g.y * FP;
  s.popTick = tick;
  s.popSize = 3;
  return true;
}

/** burstRev 8: splits (or pops) ball `index` in place. Atoms drop nothing on this revision. */
function burstSplitV8(s: BurstState, index: number, tick: number): void {
  const ball = s.balls[index]!;
  s.hits += 1;
  s.popX = ball.x;
  s.popY = ball.y;
  s.popTick = tick;
  s.popSize = ball.size;
  s.balls.splice(index, 1);
  if (ball.size < 3) {
    const size = ball.size + 1;
    for (const dir of [-1, 1]) s.balls.push({ size, x: ball.x, y: ball.y, vx: dir * SPEED_X[size]!, vy: -KICK });
  }
}

/** burstRev 8: the scheduled power-ups start falling from the top on their ticks. */
function burstDropsV8(s: BurstState, tick: number): void {
  for (const drop of s.drops ?? []) {
    if (drop.tick === tick) s.icons = [...s.icons, { x: drop.x * FP, y: drop.y * FP, kind: drop.kind }];
  }
}

/** burstRev 8: a wave cleared: its time bonus, and the clean bonus when no shot for it missed; the counter starts again. */
function burstWaveClearV8(s: BurstState, tick: number): void {
  const pts = burstClearPoints(tick - (s.waveAt ?? tick));
  s.clearPts = (s.clearPts ?? 0) + pts;
  s.lastClear = pts;
  const clean = (s.missed ?? 0) === 0 && (s.landed ?? 0) > 0;
  if (clean) s.cleanWaves = (s.cleanWaves ?? 0) + 1;
  s.lastClean = clean ? 1 : 0;
  // The counter moves on to the next wave.
  s.cw = s.wave + 1;
  s.fired = 0;
  s.landed = 0;
  s.missed = 0;
}

function initV8(seed: number): BurstState {
  const base = burstStrictGame.init(seed);
  const { drops, goldens } = burstScheduleV8(seed, burstFloorY(base));
  return {
    ...base,
    exp: 1,
    drops,
    goldens,
    goldHit: 0,
    goldAt: 0,
    double: 0,
    doubles: 0,
    waveAt: 0,
    clearPts: 0,
    lastClear: 0,
    lastClean: 0,
    groups: [],
    nextG: 0,
    fired: 0,
    landed: 0,
    missed: 0,
    cleanWaves: 0,
    cw: 1,
  };
}

/** burstRev 8's feature points, each capped (BURST_V8_CAPS). */
export function burstCleanBonus(state: BurstState): { gold: number; clear: number; clean: number; total: number } {
  const gold = Math.min(BURST_V8_CAPS.gold, BURST_V8_GOLDEN_PTS * burstGoldenCount(state));
  const clear = Math.min(BURST_V8_CAPS.clear, state.clearPts ?? 0);
  const clean = Math.min(BURST_V8_CAPS.clean, BURST_V8_CLEAN_PTS * (state.cleanWaves ?? 0));
  return { gold, clear, clean, total: gold + clear + clean };
}

/**
 * burstRev 8 band knots (atoms hit, minus 5 a life lost; lasting the 90 s adds 10, the features come on top),
 * fitted with scripts/expansion-e9-bands.ts (docs/expansions/e9.md).
 */
export const BURST_V8_BAND_CURVE = bandCurve([0, 15, 45, 70, 80, 90, 100, 140], [0, 38, 64, 106, 114, 122, 128, 136]);

/** burstRev 8's units: atoms hit less 5 a life lost, never below a quarter of the atoms hit (rounded up). */
export function burstCleanUnits(state: Pick<BurstState, "hits" | "lives">): number {
  return Math.max(Math.ceil(state.hits / 4), state.hits - 5 * (BURST_LIVES - state.lives));
}

export function burstCleanParts(state: BurstState): BandParts {
  const units = burstCleanUnits(state);
  const finished = state.ended === 1;
  const b = burstCleanBonus(state);
  const bits = [b.clean && `clean waves ${b.clean}`, b.clear && `fast waves ${b.clear}`, b.gold && `golden ${b.gold}`].filter(Boolean);
  return {
    units,
    points: bandPoints(BURST_V8_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + b.total,
    penalty: 0,
    finished,
    text: `${state.hits} atoms · ${BURST_LIVES - state.lives} lives lost`,
    bonusText: `${finished ? "Lasted the 90 s +10 · " : ""}skill bonus (${bits.join(" · ") || "none"})`,
  };
}

export const burstCleanGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = {
  ...burstGame,
  init: initV8,
  score: (state) => bandTotal(burstCleanParts(state), Boolean(state.acted), BURST_V8_MAX),
};

/* ================= Phone-test notes (burstRev 9, 27 Oct 2026) ================= */

/**
 * burstRev 9 (Joe's phone-test notes, docs/phone-notes-oct-2026/fission.md): burstRev 8's arena, waves, lives,
 * DOUBLE and FREEZE, with four changes:
 *
 *  - Power-ups ride on atoms: at init the room seed marks some atoms as carriers (an atom is known by its wave,
 *    its place in the wave and its split path, burstAtomId), the same atoms for every player. A carrier drops its
 *    power-up where it splits, and the icon falls to the floor as before. Nothing falls from the top any more, and
 *    nothing is rolled at the moment of a hit: the carriers are fixed before the first tick.
 *  - The golden atom bounces like the other atoms (an S atom's bounce and speed, its own 9 px disc) for
 *    BURST_V9_GOLDEN_LIFE; it never hurts the ship, and FREEZE stops it too.
 *  - BURST shots are back as a carried power-up: for BURST_V9_BURST_TICKS each tap fires three short shots from
 *    head height, BURST_GAP apart (burstRev 2's BURST); catching DOUBLE or BURST ends the other one.
 *  - The clean-wave bonus is gone. In its place each cleared wave pays a time bonus: up to BURST_V9_CLEAR_MAX,
 *    the full amount within the wave's quick time (1 s plus 0.6 s for every atom the wave holds, its splits
 *    included), then one less every 2 s after it (burstV9ClearPoints). HUD: "CLEAR +n" counting down.
 *
 * Score: burstRev 8's units on BURST_V9_BAND_CURVE, 10 for lasting the 90 s, golden atoms (+6, up to 36) and the
 * wave-clear bonus (up to BURST_V9_CAPS.clear), to 200. States keep `exp: 1` and add `carry: 1`; the new fields go
 * into the checkpoint checksum after burstRev 8's, so every earlier checksum is unchanged.
 */
export const BURST_REV_CARRY = 9;
/** BURST icons (kind 0, gold): three short shots a tap. */
export const BURST_ICON_BURST = 0;
export const BURST_V9_BURST_TICKS = 8 * TICKS_PER_SECOND;
export const BURST_V9_GOLDEN_LIFE = 5 * TICKS_PER_SECOND;
/** The golden atom bounces like an S atom (size 2). */
export const BURST_V9_GOLDEN_AS = 2;
/** Carriers per wave: the first wave one, waves 2–5 two each, every later wave one. */
export function burstV9CarriersInWave(wave: number): number {
  return wave === 1 ? 1 : wave <= 5 ? 2 : 1;
}
/** Kinds in turn from a seeded start: DOUBLE, BURST, FREEZE. */
export const BURST_V9_KINDS = [BURST_ICON_DOUBLE, BURST_ICON_BURST, BURST_ICON_FREEZE] as const;
/** Wave-clear bonus: most points a wave, its quick time (ticks: 1 s plus 0.6 s an atom) and one point less every 2 s past it. */
export const BURST_V9_CLEAR_MAX = 5;
export const BURST_V9_QUICK_BASE = TICKS_PER_SECOND;
export const BURST_V9_QUICK_PER_ATOM = 36;
export const BURST_V9_CLEAR_STEP = 2 * TICKS_PER_SECOND;
export const BURST_V9_CAPS = { gold: 36, clear: 25 } as const;

export interface BurstCarrier {
  id: number;
  kind: number;
}

/** An atom's identity: its wave, its place among the wave's spawns and its split path (1, then ×2 + side per split). */
export function burstAtomId(wave: number, index: number, path = 1): number {
  return (wave << 8) | (index << 4) | path;
}

/** Atoms a spawn of `size` becomes in all (itself and every split): L 15, M 7, S 3, XS 1. */
export function burstAtomsOf(size: number): number {
  return (1 << (4 - size)) - 1;
}

/** The quick time (ticks) of a wave: 1 s plus 0.6 s for every atom it holds. */
export function burstV9QuickTicks(wave: readonly BurstSpawn[]): number {
  return BURST_V9_QUICK_BASE + BURST_V9_QUICK_PER_ATOM * wave.reduce((n, spawn) => n + burstAtomsOf(spawn.size), 0);
}

/** A wave cleared `ticks` after it appeared: the full bonus within its quick time, one less every 2 s after it. */
export function burstV9ClearPoints(ticks: number, quick: number): number {
  return clampInt(BURST_V9_CLEAR_MAX - Math.floor(Math.max(0, ticks - quick) / BURST_V9_CLEAR_STEP), 0, BURST_V9_CLEAR_MAX);
}

/**
 * burstRev 9's schedules for a seed, on a stream of its own (the waves, drawn first from the seed, are burstRev 8's):
 * the golden atoms (burstRev 8's windows; `kind` is the side it sets off towards, 0 left, 1 right), then the
 * carriers, wave by wave, among each wave's atoms that split (not the smallest). Pure: the same for every player
 * and the server.
 */
export function burstScheduleV9(seed: number, waves: readonly BurstSpawn[][], floor: number = BURST_TALL_H): { goldens: BurstScheduled[]; carriers: BurstCarrier[] } {
  let rng = (seed ^ 0x46495339) | 0;
  const draw = (bound: number): number => {
    const d = rngBelow(rng, bound);
    rng = d.state;
    return d.value;
  };
  const top = burstGeometryV8(floor).ceilMax + BURST_V8_GOLDEN_BELOW;
  const goldens: BurstScheduled[] = [];
  for (let n = 0; n < BURST_V8_GOLDENS; n++) {
    const tick = BURST_V8_GOLDEN_FROM + n * BURST_V8_GOLDEN_SLOT + draw(BURST_V8_GOLDEN_JITTER + 1);
    const x = BURST_V8_GOLDEN_SIDE + draw(BURST_WORLD_W - 2 * BURST_V8_GOLDEN_SIDE + 1);
    const y = top + draw(BURST_V8_GOLDEN_BAND + 1);
    goldens.push({ tick, x, y, kind: draw(2) });
  }
  const carriers: BurstCarrier[] = [];
  const first = draw(BURST_V9_KINDS.length);
  waves.forEach((wave, w) => {
    // Every atom of the wave that splits: each spawn's tree down to its S atoms.
    const ids: number[] = [];
    wave.forEach((spawn, index) => {
      let level = [1];
      for (let size = spawn.size; size < 3; size++) {
        for (const path of level) ids.push(burstAtomId(w + 1, index, path));
        level = level.flatMap((path) => [path * 2, path * 2 + 1]);
      }
    });
    for (let k = 0; k < burstV9CarriersInWave(w + 1) && ids.length > 0; k++) {
      const id = ids.splice(draw(ids.length), 1)[0]!;
      carriers.push({ id, kind: BURST_V9_KINDS[(carriers.length + first) % BURST_V9_KINDS.length]! });
    }
  });
  return { goldens, carriers };
}

/** burstRev 9: a tap fires one beam, or two while the double beam is on (no clean-wave count). */
function burstFireV9(s: BurstState, floor: number): void {
  const xs = (s.double ?? 0) > 0 ? [s.x - BURST_DOUBLE_GAP * FP, s.x + BURST_DOUBLE_GAP * FP] : [s.x];
  for (const x of xs) s.shots.push({ x: clampInt(x, 0, BURST_WORLD_W * FP), top: floor * FP, short: 0 });
}

/** burstRev 9: DOUBLE or BURST caught; each ends the other. */
function burstCatchV9(s: BurstState, kind: number): void {
  if (kind === BURST_ICON_DOUBLE) {
    s.double = BURST_DOUBLE_TICKS;
    s.doubles = (s.doubles ?? 0) + 1;
    s.burst = 0;
    s.burstLeft = 0;
    s.burstT = 0;
  } else {
    s.burst = 1;
    s.burstT = BURST_V9_BURST_TICKS;
    s.bursts = (s.bursts ?? 0) + 1;
    s.double = 0;
  }
}

/** burstRev 9: splits (or pops) ball `index`; the daughters carry its id's split paths, and a carrier drops its power-up. */
function burstSplitV9(s: BurstState, index: number, tick: number): void {
  const ball = s.balls[index]!;
  s.hits += 1;
  s.popX = ball.x;
  s.popY = ball.y;
  s.popTick = tick;
  s.popSize = ball.size;
  s.balls.splice(index, 1);
  const carried = (s.carriers ?? []).find((c) => c.id === ball.id);
  if (carried) s.icons.push({ x: ball.x, y: ball.y, kind: carried.kind });
  if (ball.size < 3) {
    const size = ball.size + 1;
    const id = ball.id ?? 0;
    const base = id & ~0xf;
    const path = id & 0xf;
    [-1, 1].forEach((dir, side) => s.balls.push({ size, x: ball.x, y: ball.y, vx: dir * SPEED_X[size]!, vy: -KICK, id: base | (path * 2 + side) }));
  }
}

/** burstRev 9: the golden atom appears on its tick, bounces as an S atom (not while frozen) and goes after its life. */
function burstGoldenStepV9(s: BurstState, tick: number, geo: BurstGeometry, ceil: number, frozen: boolean): void {
  const gn = s.gn ?? -1;
  if (gn >= 0 && tick >= s.goldens![gn]!.tick + BURST_V9_GOLDEN_LIFE) s.gn = -1;
  const n = (s.goldens ?? []).findIndex((g) => g.tick === tick);
  if (n >= 0) {
    const g = s.goldens![n]!;
    s.gn = n;
    s.gx = g.x * FP;
    s.gy = g.y * FP;
    s.gvx = g.kind ? SPEED_X[BURST_V9_GOLDEN_AS]! : -SPEED_X[BURST_V9_GOLDEN_AS]!;
    s.gvy = 0;
  }
  if ((s.gn ?? -1) < 0 || frozen) return;
  burstGoldenMove(s, geo, ceil);
}

/** burstRev 9 and 10: the golden atom in play moves one tick, bouncing as an S atom off the floor, ceiling and walls. */
function burstGoldenMove(s: BurstState, geo: BurstGeometry, ceil: number): void {
  const r = BURST_GOLD_R * FP;
  let x = s.gx ?? 0;
  let y = s.gy ?? 0;
  let vx = s.gvx ?? 0;
  let vy = (s.gvy ?? 0) + GRAVITY;
  y += vy;
  x += vx;
  if (y + r >= geo.floor * FP) {
    y = geo.floor * FP - r;
    vy = -geo.bounceV[BURST_V9_GOLDEN_AS]!;
  }
  if (y - r < ceil) {
    y = ceil + r;
    if (vy < 0) vy = -vy;
  }
  if (x - r < 0) {
    x = r;
    vx = Math.abs(vx);
  } else if (x + r > BURST_WORLD_W * FP) {
    x = BURST_WORLD_W * FP - r;
    vx = -Math.abs(vx);
  }
  s.gx = x;
  s.gy = y;
  s.gvx = vx;
  s.gvy = vy;
}

/** burstRev 9: a shot (beam or short BURST shot, from `bottom` up to its top) reaching the golden atom takes it. */
function burstGoldenV9(s: BurstState, tick: number, shot: BurstShot, bottom: number): boolean {
  const n = s.gn ?? -1;
  if (n < 0) return false;
  const r = BURST_GOLD_R * FP;
  const gx = s.gx ?? 0;
  const gy = s.gy ?? 0;
  if (Math.abs(shot.x - gx) > r || gy + r < shot.top || gy - r > bottom) return false;
  s.goldHit = (s.goldHit ?? 0) | (1 << n);
  s.goldAt = tick;
  s.gn = -1;
  s.popX = gx;
  s.popY = gy;
  s.popTick = tick;
  s.popSize = 3;
  return true;
}

/** burstRev 9: the wave-clear bonus for the wave just cleared (in place of the clean-wave bonus). */
function burstWaveClearV9(s: BurstState, tick: number): void {
  const pts = burstV9ClearPoints(tick - (s.waveAt ?? tick), burstV9QuickTicks(s.waves[s.wave - 1] ?? []));
  s.clearPts = (s.clearPts ?? 0) + pts;
  s.lastClear = pts;
  if (pts > 0) s.quickWaves = (s.quickWaves ?? 0) + 1;
}

/** burstRev 9: the wave-clear bonus the wave on screen would pay if cleared now (the HUD's "CLEAR +n"); 0 between waves. */
export function burstV9ClearNow(state: BurstState): number {
  if (state.balls.length === 0 || state.wave === 0) return 0;
  return burstV9ClearPoints(state.tick - (state.waveAt ?? state.tick), burstV9QuickTicks(state.waves[state.wave - 1] ?? []));
}

/** burstRev 9: the golden atom in play now (its index), or -1. */
export function burstV9GoldenNow(state: Pick<BurstState, "gn">): number {
  return state.gn ?? -1;
}

function initV9(seed: number): BurstState {
  const base = initV8(seed);
  const { goldens, carriers } = burstScheduleV9(seed, base.waves, burstFloorY(base));
  return { ...base, drops: [], goldens, carry: 1, carriers, burstT: 0, bursts: 0, gn: -1, gx: 0, gy: 0, gvx: 0, gvy: 0, quickWaves: 0 };
}

/** burstRev 9's feature points, each capped (BURST_V9_CAPS). */
export function burstCarryBonus(state: BurstState): { gold: number; clear: number; total: number } {
  const gold = Math.min(BURST_V9_CAPS.gold, BURST_V8_GOLDEN_PTS * burstGoldenCount(state));
  const clear = Math.min(BURST_V9_CAPS.clear, state.clearPts ?? 0);
  return { gold, clear, total: gold + clear };
}

/** burstRev 9 band knots (burstRev 8's units; lasting the 90 s adds 10, the features come on top). */
export const BURST_V9_BAND_CURVE = bandCurve([0, 15, 50, 78, 88, 98, 108, 140], [0, 38, 62, 100, 110, 120, 128, 136]);

export function burstCarryParts(state: BurstState): BandParts {
  const units = burstCleanUnits(state);
  const finished = state.ended === 1;
  const b = burstCarryBonus(state);
  const bits = [b.clear && `wave clears ${b.clear}`, b.gold && `golden ${b.gold}`].filter(Boolean);
  return {
    units,
    points: bandPoints(BURST_V9_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + b.total,
    penalty: 0,
    finished,
    text: `${state.hits} atoms · ${BURST_LIVES - state.lives} lives lost`,
    bonusText: `${finished ? "Lasted the 90 s +10 · " : ""}skill bonus (${bits.join(" · ") || "none"})`,
  };
}

export const burstCarryGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = {
  ...burstGame,
  init: initV9,
  score: (state) => bandTotal(burstCarryParts(state), Boolean(state.acted), BURST_V8_MAX),
};

/* ================= The arcade scoring standard (burstRev 10, 29 Oct 2026) ================= */

/**
 * burstRev 10 (the arcade scoring standard, docs/arcade-standard/burst.md): burstRev 9's arena, atoms,
 * carried power-ups and BURST shots, with these changes:
 *
 *  - The run is five waves (burstRev 9's waves 1–5 from the seed: M; L; M M; L S S; L L), 87 atoms counting every
 *    piece their splits make (burstV10Atoms). Clearing all five completes the run (once the last golden atom is
 *    gone); otherwise it ends at 90 s or with the third life.
 *  - One golden atom per wave (five a run), at a seeded spot, setting off to a seeded side, appearing a seeded
 *    1–2 s after its wave does (a golden atom still up when the next is due holds it back until it fades). It
 *    bounces as on burstRev 9 for 5 s, and it now takes a life if it hits the ship, like any atom.
 *  - Score, straight lines only: core 140 × atoms popped ÷ 87 (every split piece counts; golden atoms are not
 *    atoms here); each wave cleared pays up to 7 (the full 7 within its quick time, 1 s plus 0.6 s an atom, then
 *    evenly less to 0 at twice that); each golden atom popped 25 ÷ 5 = 5; power-ups nothing; each life lost −5.
 *    140 + 35 + 25 = 200. A run with any input scores at least 1, never below 0; no input scores 0.
 *
 * States keep burstRev 9's fields (`carry: 1`) and add `std: 1`, `gDue`, `gUntil` and `done`, folded into the
 * checkpoint checksum after burstRev 9's, so every earlier checksum is unchanged.
 */
export const BURST_REV_STD = 10;
export const BURST_V10_WAVES = 5;
export const BURST_V10_CORE_MAX = 140;
export const BURST_V10_CLEAR_PER_WAVE = 7;
export const BURST_V10_CLEAR_MAX = BURST_V10_CLEAR_PER_WAVE * BURST_V10_WAVES;
export const BURST_V10_GOLDENS = BURST_V10_WAVES;
export const BURST_V10_GOLDEN_MAX = 25;
export const BURST_V10_GOLDEN_PTS = BURST_V10_GOLDEN_MAX / BURST_V10_GOLDENS;
export const BURST_V10_LIFE_COST = 5;
/** The parts' maxima (they add up to 200). */
export const BURST_V10_PARTS = { core: BURST_V10_CORE_MAX, clear: BURST_V10_CLEAR_MAX, gold: BURST_V10_GOLDEN_MAX } as const;
/** A golden atom appears this long after its wave does: 1 s plus a seeded 0–1 s. */
export const BURST_V10_GOLDEN_DELAY = TICKS_PER_SECOND;
export const BURST_V10_GOLDEN_JITTER = TICKS_PER_SECOND;
/** Atoms in burstRev 10's run, every split piece counted (the core's denominator): 7 + 15 + 14 + 21 + 30. */
export const BURST_V10_ATOMS = 87;
/** The core's straight line (atoms popped → points), for the "?" help: 140 at all 87. */
export const BURST_V10_BAND_CURVE = bandCurve([0, BURST_V10_ATOMS], [0, BURST_V10_CORE_MAX]);

/** Every atom a run's waves hold, each spawn with every piece its splits make (L 15, M 7, S 3, XS 1). */
export function burstV10Atoms(waves: readonly BurstSpawn[][]): number {
  return waves.reduce((n, wave) => n + wave.reduce((m, spawn) => m + burstAtomsOf(spawn.size), 0), 0);
}

/**
 * A wave cleared `ticks` after it appeared: the full 7 within its quick time, then evenly less to 0 at twice the
 * quick time (floored to whole points).
 */
export function burstV10ClearPoints(ticks: number, quick: number): number {
  if (ticks <= quick) return BURST_V10_CLEAR_PER_WAVE;
  const zero = 2 * quick;
  if (ticks >= zero) return 0;
  return Math.floor((BURST_V10_CLEAR_PER_WAVE * (zero - ticks)) / (zero - quick));
}

/**
 * burstRev 10's schedules for a seed, on a stream of its own (the waves, drawn first from the seed, are burstRev 9's):
 * each wave's golden atom (`tick` its delay after the wave appears, its spot, `kind` the side it sets off towards),
 * then the carriers wave by wave as on burstRev 9. Pure: the same for every player and the server.
 */
export function burstScheduleV10(seed: number, waves: readonly BurstSpawn[][], floor: number = BURST_TALL_H): { goldens: BurstScheduled[]; carriers: BurstCarrier[] } {
  let rng = (seed ^ 0x4649530a) | 0;
  const draw = (bound: number): number => {
    const d = rngBelow(rng, bound);
    rng = d.state;
    return d.value;
  };
  const top = burstGeometryV8(floor).ceilMax + BURST_V8_GOLDEN_BELOW;
  const goldens: BurstScheduled[] = [];
  for (let n = 0; n < waves.length; n++) {
    const tick = BURST_V10_GOLDEN_DELAY + draw(BURST_V10_GOLDEN_JITTER + 1);
    const x = BURST_V8_GOLDEN_SIDE + draw(BURST_WORLD_W - 2 * BURST_V8_GOLDEN_SIDE + 1);
    const y = top + draw(BURST_V8_GOLDEN_BAND + 1);
    goldens.push({ tick, x, y, kind: draw(2) });
  }
  const carriers: BurstCarrier[] = [];
  const first = draw(BURST_V9_KINDS.length);
  waves.forEach((wave, w) => {
    const ids: number[] = [];
    wave.forEach((spawn, index) => {
      let level = [1];
      for (let size = spawn.size; size < 3; size++) {
        for (const path of level) ids.push(burstAtomId(w + 1, index, path));
        level = level.flatMap((path) => [path * 2, path * 2 + 1]);
      }
    });
    for (let k = 0; k < burstV9CarriersInWave(w + 1) && ids.length > 0; k++) {
      const id = ids.splice(draw(ids.length), 1)[0]!;
      carriers.push({ id, kind: BURST_V9_KINDS[(carriers.length + first) % BURST_V9_KINDS.length]! });
    }
  });
  return { goldens, carriers };
}

/** burstRev 10: the golden atom in play fades on its time; the next one due appears (only one is up at once); it moves as on burstRev 9. */
function burstGoldenStepV10(s: BurstState, tick: number, geo: BurstGeometry, ceil: number, frozen: boolean): void {
  if ((s.gn ?? -1) >= 0 && tick >= (s.gUntil ?? 0)) s.gn = -1;
  if ((s.gn ?? -1) < 0) {
    const due = s.gDue ?? [];
    const n = due.findIndex((d) => d >= 0 && d <= tick);
    if (n >= 0) {
      const g = s.goldens![n]!;
      s.gn = n;
      s.gx = g.x * FP;
      s.gy = g.y * FP;
      s.gvx = g.kind ? SPEED_X[BURST_V9_GOLDEN_AS]! : -SPEED_X[BURST_V9_GOLDEN_AS]!;
      s.gvy = 0;
      s.gUntil = tick + BURST_V9_GOLDEN_LIFE;
      s.gDue = due.map((d, i) => (i === n ? -2 : d));
    }
  }
  if ((s.gn ?? -1) < 0 || frozen) return;
  burstGoldenMove(s, geo, ceil);
}

/** burstRev 10: whether the golden atom in play touches the ship's box (as touches() does for atoms). */
function burstGoldenTouchesV10(s: BurstState, floor: number): boolean {
  if ((s.gn ?? -1) < 0) return false;
  const r = BURST_GOLD_R * FP;
  const gx = s.gx ?? 0;
  const gy = s.gy ?? 0;
  const cx = clampInt(gx, s.x - PLAYER_HALF_W * FP, s.x + PLAYER_HALF_W * FP);
  const cy = clampInt(gy, (floor - PLAYER_H) * FP, floor * FP);
  const dx = gx - cx;
  const dy = gy - cy;
  return dx * dx + dy * dy <= r * r;
}

/** burstRev 10: a wave cleared pays its time bonus. */
function burstWaveClearV10(s: BurstState, tick: number): void {
  const pts = burstV10ClearPoints(tick - (s.waveAt ?? tick), burstV9QuickTicks(s.waves[s.wave - 1] ?? []));
  s.clearPts = (s.clearPts ?? 0) + pts;
  s.lastClear = pts;
  if (pts > 0) s.quickWaves = (s.quickWaves ?? 0) + 1;
}

/** burstRev 10: every wave cleared, every golden atom has appeared and none is still up. */
function burstCompleteV10(s: BurstState): boolean {
  return s.cleared >= s.waves.length && (s.gn ?? -1) < 0 && (s.gDue ?? []).every((d) => d === -2);
}

/** burstRev 10: the wave-clear bonus the wave on screen would pay if cleared now (the HUD's "CLEAR +n"); 0 between waves. */
export function burstV10ClearNow(state: BurstState): number {
  if (state.balls.length === 0 || state.wave === 0) return 0;
  return burstV10ClearPoints(state.tick - (state.waveAt ?? state.tick), burstV9QuickTicks(state.waves[state.wave - 1] ?? []));
}

/** burstRev 9 and 10: the tick the golden atom in play fades (-1 none). */
export function burstGoldenUntil(state: BurstState): number {
  const n = state.gn ?? -1;
  if (n < 0) return -1;
  return state.std ? (state.gUntil ?? 0) : state.goldens![n]!.tick + BURST_V9_GOLDEN_LIFE;
}

function initV10(seed: number): BurstState {
  const base = initV8(seed);
  const waves = base.waves.slice(0, BURST_V10_WAVES);
  const { goldens, carriers } = burstScheduleV10(seed, waves, burstFloorY(base));
  return {
    ...base,
    waves,
    drops: [],
    goldens,
    carry: 1,
    carriers,
    burstT: 0,
    bursts: 0,
    gn: -1,
    gx: 0,
    gy: 0,
    gvx: 0,
    gvy: 0,
    quickWaves: 0,
    std: 1,
    gDue: goldens.map(() => -1),
    gUntil: 0,
    done: 0,
  };
}

/** burstRev 10's parts: core, wave clears, golden atoms (each at most its maximum) and the lives' cost. */
export function burstStdParts(state: BurstState): { core: number; clear: number; gold: number; lives: number; atoms: number; total: number } {
  const atoms = burstV10Atoms(state.waves);
  const core = bandPoints(bandCurve([0, atoms], [0, BURST_V10_CORE_MAX]), state.hits);
  const clear = Math.min(BURST_V10_CLEAR_MAX, state.clearPts ?? 0);
  const gold = Math.min(BURST_V10_GOLDEN_MAX, BURST_V10_GOLDEN_PTS * burstGoldenCount(state));
  const lives = BURST_V10_LIFE_COST * (BURST_LIVES - state.lives);
  return { core, clear, gold, lives, atoms, total: core + clear + gold - lives };
}

/** burstRev 10's score: the parts' sum, at least 1 for a run with any input (0 without), at most 200. */
export function burstStdScore(state: BurstState): number {
  return stdFinal(burstStdParts(state).total, Boolean(state.acted));
}

/** burstRev 10's breakdown for the reveal (bandLines): core, the features as the bonus, the lives as the penalty. */
export function burstStdBandParts(state: BurstState): BandParts {
  const p = burstStdParts(state);
  const lost = BURST_LIVES - state.lives;
  return {
    units: state.hits,
    points: p.core,
    bonus: p.clear + p.gold,
    penalty: p.lives,
    finished: state.done === 1,
    text: `${state.hits} of ${p.atoms} atoms`,
    bonusText: `Wave clears ${p.clear} · golden atoms ${p.gold}`,
    penaltyText: `${lost} ${lost === 1 ? "life" : "lives"} lost × ${BURST_V10_LIFE_COST}`,
  };
}

export const burstStdGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = {
  ...burstGame,
  init: initV10,
  score: burstStdScore,
};
