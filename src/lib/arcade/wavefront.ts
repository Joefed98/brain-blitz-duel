/**
 * Wavefront — an arcade game on the shared engine.
 *
 * A gold chevron ship follows the finger along the bottom and fires on its own.
 * A formation of shapes marches sideways, drops a row at each wall and fires red
 * bolts back. Every wave's shapes and every enemy shot come from the seeded
 * generator carried in the state; all positions are integers in 1/256 px.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  rngValue,
  ARCADE_INPUT_DRAG,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { BAND_STRICT_MARK, bandStrictGame, bandStrict, bandCurve, bandInit, bandTargetGame, BAND_TARGET_MARK, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
import { isin, TRIG_ONE } from "./trig";
import { speedBonusCurve } from "../duel/speedPar";
import { stdBandParts, stdLine, stdSpeed, stdTotal, type StdScore, type StdSpec } from "./arcadeStandard";

/* ============================== Constants ============================== */

const FP = 256;
export const WAV_WORLD_W = 390;
export const WAV_WORLD_H = 620;
export const WAV_HUD_H = 44;

export const WAV_RUN_SECONDS = 60;
export const WAV_RUN_TICKS = WAV_RUN_SECONDS * TICKS_PER_SECOND;

export const WAV_SHIP_Y = 554;
export const WAV_SHIP_W = 40;
export const WAV_SHIP_H = 24;
const SHIP_MIN_X = 24;
const SHIP_MAX_X = WAV_WORLD_W - 24;
/** Drags only start in the bottom quarter. */
export const WAV_DRAG_ZONE_TOP = Math.round((WAV_WORLD_H * 3) / 4);
/** How far the ship's centre line sits above the bottom of the world, px. */
export const WAV_SHIP_LIFT = WAV_WORLD_H - WAV_SHIP_Y;

/** The world height (px) a state plays in: wavRev 6's taller world, or the original 620. */
export function wavWorldH(state: { worldH?: number }): number {
  return state.worldH ?? WAV_WORLD_H;
}
/** The ship's centre line (px) in a state's world: always WAV_SHIP_LIFT above the bottom. */
export function wavShipY(state: { worldH?: number }): number {
  return wavWorldH(state) - WAV_SHIP_LIFT;
}
/** wavRev 6: the ship's bolts fly 10 px a tick, so they reach the formation and boss in the same time from the lower ship line. */
export const WAV_TALL_BOLT_SPEED = 10;
/** The ship's bolt speed (1/256 px a tick) in a state's world: 8 px a tick, 10 in wavRev 6's taller world. */
export function wavBoltSpeedFp(state: { worldH?: number; x10?: number }): number {
  if (state.x10) return WAV_X_BOLT_SPEED * FP;
  return state.worldH ? WAV_TALL_BOLT_SPEED * FP : BOLT_SPEED_FP;
}
/** Where drags may start (the bottom quarter) in a world of this height, px. */
export function wavDragZoneTop(worldH: number): number {
  return Math.round((worldH * 3) / 4);
}

export const WAV_FIRE_EVERY = 20;
export const WAV_MAX_BOLTS = 3;
const BOLT_SPEED_FP = 8 * FP;
export const WAV_BOLT_W = 4;
export const WAV_BOLT_H = 12;

export const WAV_COLS = 6;
export const WAV_ROWS = 5;
export const WAV_SHAPES = WAV_COLS * WAV_ROWS;
export const WAV_CELL = 28;
const PITCH_X = 44;
const PITCH_Y = 36;
const START_X = Math.trunc((WAV_WORLD_W - ((WAV_COLS - 1) * PITCH_X + WAV_CELL)) / 2);
const START_Y = 84;
const MAX_START_Y = START_Y + 5 * PITCH_Y;
const STEP_PX = 8;
const EDGE = 8;
export const WAV_STEP_START = 30;
export const WAV_STEP_MIN = 6;
const KILLS_PER_TICK = 3;

const RED_START = 90;
const RED_MIN = 20;
const RED_SPEED_FP = 4 * FP;
const RED_SPEED_CAP = Math.trunc((RED_SPEED_FP * 5) / 2);
const MAX_RED = 10;
/** From this wave on, some volleys fire from two columns at once (1 in 3). */
const DOUBLE_FROM_WAVE = 3;

export const WAV_LIVES = 3;
const INVULN_TICKS = 60;

const SAUCER_EVERY = 15 * TICKS_PER_SECOND;
const SAUCER_Y = 62;
const SAUCER_SPEED_FP = 2 * FP;
export const WAV_SAUCER_R = 10;

export const WAV_POINTS_SAUCER = 5;
export const WAV_POINTS_WAVE = 15;

/** Armour from wave 2: [cells covered, hits] by wave (wave 5's values hold after). */
export const WAV_ARMOUR_BY_WAVE: readonly (readonly [number, number])[] = [
  [4, 6],
  [6, 8],
  [8, 10],
  [10, 12],
];
/** Shape code for a cell covered by the wave's armoured piece. */
export const WAV_ARMOUR_CODE = 10;
/** A perfect run through wave 5: every shape, every armour hit, all 3 saucers, 5 waves. */
export const WAV_PAR = (() => {
  let raw = WAV_SHAPES;
  for (const [cells, hits] of WAV_ARMOUR_BY_WAVE) raw += WAV_SHAPES - cells + hits;
  const saucers = Math.trunc((WAV_RUN_SECONDS * TICKS_PER_SECOND - 1) / (15 * TICKS_PER_SECOND));
  return raw + WAV_POINTS_SAUCER * saucers + WAV_POINTS_WAVE * 5;
})();

export const WAV_PIERCE_SHOTS = 5;
export const WAV_PIERCE_HITS = 3;
const DROP_SPEED_FP = 4 * FP;
const DROP_DELAY_MIN = 10;
const DROP_DELAY_SPAN = 21;
export const WAV_DROP_R = 8;

/* ======================= wavRev 2 (Oct 2026) ======================= */
/*
 * A 90 s run of WAV_V2_WAVES continuous waves and a final boss. When a wave is
 * cleared the next formation flies in from the top over a 2 s breather (no march,
 * no enemy fire); from wave 3 ships peel off and dive at the player on a seeded
 * curve, leave through the bottom and fly back to their slot from the top. After
 * the last wave a boss with WAV_BOSS_HP hits flies in, slides side to side and
 * fires a seeded pattern; every hit and the kill score, and the kill ends the run.
 * Unstamped rounds keep the original 60 s rules.
 */
export const WAV_REV = 2;
export const WAV_V2_RUN_SECONDS = 90;
export const WAV_V2_RUN_TICKS = WAV_V2_RUN_SECONDS * TICKS_PER_SECOND;
/** Formation waves before the boss (wavRev 5: WAV_V5_WAVES). */
export const WAV_V2_WAVES = 5;
/** wavRev 5 (Tuning C): the same five formation waves, then the boss (wave 5 was briefly dropped and restored before release). */
export const WAV_V5_WAVES = 5;
/** wavRev 5: how far the formation drops at a wall on waves 3 and 4, px (three quarters of a row; other waves drop a full row). */
export const WAV_DROP_SLOW_PX = 27;
/** Formation waves before the boss on this state's revision. */
export function wavWaves(state: { tunec?: number }): number {
  return state.tunec ? WAV_V5_WAVES : WAV_V2_WAVES;
}
/** How far the formation drops when it reaches a wall: wavRev 5 waves 3 and 4 come down at three-quarter speed. */
export function wavDropPx(state: { tunec?: number; wave: number }): number {
  return state.tunec && (state.wave === 3 || state.wave === 4) ? WAV_DROP_SLOW_PX : PITCH_Y;
}
export const WAV_BREATHER_TICKS = 2 * TICKS_PER_SECOND;
/** How far above its place a formation (or the boss) starts its fly-in, px. */
const ENTRY_DIST = START_Y + WAV_ROWS * PITCH_Y;
export const WAV_DIVE_FROM_WAVE = 3;
export const WAV_DIVE_TICKS = 150;
export const WAV_RETURN_TICKS = 90;
/** Ticks between dives: 160 on wave 3, 20 fewer each wave after, never under 100. */
export function wavDiveEvery(wave: number): number {
  return Math.max(100, 160 - 20 * (wave - WAV_DIVE_FROM_WAVE));
}
/** At most one ship dives at a time on wave 3, two from wave 4. */
export function wavMaxDivers(wave: number): number {
  return wave >= WAV_DIVE_FROM_WAVE + 1 ? 2 : 1;
}
export const WAV_BOSS_W = 128;
export const WAV_BOSS_H = 48;
export const WAV_BOSS_Y = 84;
export const WAV_BOSS_HP = 36;
export const WAV_BOSS_FIRE_EVERY = 60;
const BOSS_MIN_X = 12;
const BOSS_MAX_X = WAV_WORLD_W - 12 - WAV_BOSS_W;
/** Points (raw) for the kill, more than every possible saucer, so 150 needs the kill. */
export const WAV_POINTS_BOSS = 40;
/** A perfect wavRev-2 run: every ship, every armour hit, every wave, every boss hit and the kill. */
export const WAV_PAR_V2 = (() => {
  let raw = 0;
  for (let wave = 1; wave <= WAV_V2_WAVES; wave++) {
    raw += WAV_SHAPES + WAV_POINTS_WAVE;
    if (wave >= 2) {
      const [cells, hits] = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
      raw += hits - cells;
    }
  }
  return raw + WAV_BOSS_HP + WAV_POINTS_BOSS;
})();

export const WAV_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, WAV_WORLD_W]),
];

/* ================================ State ================================ */

export interface WavBolt {
  x: number;
  y: number;
  /** Piercing bolts: hits left (0/undefined = ordinary), and whether the armour was already struck. */
  p?: number;
  a?: number;
  /** wavRev 10: a spread bolt's sideways speed (1/256 px a tick) and mark, and 1 once a bolt has hit something (or was fired during a fly-in). */
  v?: number;
  sd?: number;
  h?: number;
}

export interface WavArmour {
  col: number;
  row: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

export interface WavDrop {
  x: number;
  y: number;
  /** Ticks until it starts falling (seeded delay); hidden until then. */
  wait: number;
  /** wavRev 10: its kind (WAV_DROP_PIERCE / SPREAD / SHIELD); absent = the laser. */
  k?: number;
}

/** wavRev 11: a power-up falling from where its carrier (or a saucer) was shot down. Position in 1/256 px; `i` its sequence number. */
export interface WavPickup {
  x: number;
  y: number;
  k: number;
  i: number;
}

export interface WavBurst {
  x: number;
  y: number;
  t: number;
  c: number;
}

/** wavRev 2: a ship that left its formation cell to dive. Positions in 1/256 px (centre). */
export interface WavDiver {
  cell: number;
  /** Ticks since the dive began; past WAV_DIVE_TICKS it is flying home. */
  t: number;
  x: number;
  y: number;
  /** Where it left its slot and where it aims (1/256 px), and its seeded sway (px, signed). */
  x0: number;
  y0: number;
  tx: number;
  sway: number;
}

/** wavRev 2: the final boss. x is its left edge in whole px. */
export interface WavBoss {
  x: number;
  dir: number;
  hp: number;
  fireIn: number;
  /** wavRev 10: 1 for the gunship (mid-boss), its full hit points, its cannons' hit points and the tick it arrives. */
  mid?: number;
  maxHp?: number;
  guns?: number[];
  at?: number;
}

export interface WavState extends BandFields {
  /** wavRev 2 only (absent on original rounds). */
  rev?: number;
  /** wavRev 2: fly-in ticks left (formation or boss), the formation's resting fy, divers, the dive timer. */
  enter?: number;
  fyTarget?: number;
  divers?: WavDiver[];
  diveIn?: number;
  /** wavRev 2: the boss (once the last wave is cleared), hits on it, and 1 once it is destroyed. */
  boss?: WavBoss | null;
  bossHits?: number;
  bossKilled?: number;
  /** wavRev 4: 1 when waves 2–5 fly in their own formation shapes (WAV_FORMS); absent otherwise. */
  shaped?: number;
  /**
   * wavRev 5 only (Tuning C): 1 = waves 3 and 4 drop WAV_DROP_SLOW_PX at a wall instead
   * of a full row, scored on WAV_V5_BAND_CURVE with the kill timed from bossAt.
   */
  tunec?: number;
  /** wavRev 5 only: the tick the boss appeared (its fly-in starts), for the kill's speed bonus; 0 before. */
  bossAt?: number;
  /** wavRev 6 only (taller worlds): the world height in px (WAV_TALL_H). Absent = WAV_WORLD_H. */
  worldH?: number;
  /**
   * wavRev 10 only (expansion): the marker, the hit streak (current, best, points), weak-point core hits,
   * cannons destroyed, power-ups caught, hits the shield absorbed, spread volleys and shield ticks left,
   * whether the gunship fell, and the hit points taken off both bosses.
   */
  x10?: number;
  streak?: number;
  bestStreak?: number;
  streakPts?: number;
  weakHits?: number;
  cannonsDown?: number;
  powerups?: number;
  shieldBlocks?: number;
  spread?: number;
  shield?: number;
  midKilled?: number;
  bossDmg?: number;
  /** wavRev 10: the precision points of weak-point hits (wavPrecision). */
  precise?: number;
  /** wavRev 10: the room seed, the run's seeded plan (power-ups, saucer sides) and how many planned power-ups have appeared. */
  seed?: number;
  plan?: WavPlan;
  dropsSeen?: number;
  /**
   * wavRev 11 only (Joe's phone notes, 27 Oct 2026): the marker; for each formation slot the power-up its ship
   * carries (WAV_DROP_*), or -1; the power-ups falling (from carriers and saucers shot down); and how many fell.
   */
  r11?: number;
  carry?: number[];
  pickups?: WavPickup[];
  pickupsMade?: number;
  /**
   * wavRev 12 only (the arcade scoring standard, 29 Oct 2026): the marker, and which bosses' open cores were hit
   * (bit 1 the gunship, bit 2 the mothership). Not in the checkpoint checksum: play is wavRev 11's exactly.
   */
  std?: number;
  coresHit?: number;
  /** wavRev 2: ships that rammed the player while diving (destroyed, no points), and divers shot down. */
  rammed?: number;
  diversDown?: number;
  tick: number;
  rng: number;
  aimX: number;
  shipX: number;
  /** 0 gone, otherwise 1 + kind * 3 + colour. */
  shapes: number[];
  fx: number;
  fy: number;
  dir: number;
  waveBase: number;
  stepIn: number;
  wave: number;
  waveKills: number;
  shapesDown: number;
  saucers: number;
  wavesCleared: number;
  lives: number;
  invuln: number;
  fireIn: number;
  redIn: number;
  /** This wave's starting red-bolt interval and bolt speed. */
  redBase: number;
  redSpeed: number;
  bolts: WavBolt[];
  reds: WavBolt[];
  /** Saucer centre in FP, or 0 when none; saucerDir 0 when none. */
  saucerX: number;
  saucerDir: number;
  /** 0 running, 1 time up, 2 destroyed. */
  ended: number;
  endedTick: number;
  armour: WavArmour | null;
  armourHits: number;
  drop: WavDrop | null;
  /** Piercing shots left. */
  pierce: number;
  /** Render only. */
  bursts: WavBurst[];
}

/** Lay the wave's armoured piece (2 rows × cells/2 columns) over seeded cells. */
function placeArmour(rng: number, shapes: number[], wave: number): { rng: number; armour: WavArmour | null } {
  if (wave < 2) return { rng, armour: null };
  const spec = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
  const h = 2;
  const w = spec[0] / h;
  const c = rngBelow(rng, WAV_COLS - w + 1);
  const r = rngBelow(c.state, WAV_ROWS - h + 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) shapes[(r.value + y) * WAV_COLS + c.value + x] = WAV_ARMOUR_CODE;
  return { rng: r.state, armour: { col: c.value, row: r.value, w, h, hp: spec[1], maxHp: spec[1] } };
}

function newShapes(rng: number): { rng: number; shapes: number[] } {
  const shapes: number[] = [];
  let state = rng;
  for (let i = 0; i < WAV_SHAPES; i++) {
    const kind = rngBelow(state, 3);
    const colour = rngBelow(kind.state, 3);
    state = colour.state;
    shapes.push(1 + kind.value * 3 + colour.value);
  }
  return { rng: state, shapes };
}

function stepEvery(state: { waveBase: number; waveKills: number }): number {
  return Math.max(WAV_STEP_MIN, state.waveBase - Math.trunc(state.waveKills / KILLS_PER_TICK));
}

function init(seed: number): WavState {
  const first = newShapes(seed | 0);
  const shipX = Math.trunc(WAV_WORLD_W / 2);
  return {
    tick: 0,
    rng: first.rng,
    aimX: shipX,
    shipX,
    shapes: first.shapes,
    fx: START_X,
    fy: START_Y,
    dir: 1,
    waveBase: WAV_STEP_START,
    stepIn: WAV_STEP_START,
    wave: 1,
    waveKills: 0,
    shapesDown: 0,
    saucers: 0,
    wavesCleared: 0,
    lives: WAV_LIVES,
    invuln: 0,
    fireIn: WAV_FIRE_EVERY,
    redIn: RED_START,
    redBase: RED_START,
    redSpeed: RED_SPEED_FP,
    bolts: [],
    reds: [],
    saucerX: 0,
    saucerDir: 0,
    ended: 0,
    endedTick: 0,
    armour: null,
    armourHits: 0,
    drop: null,
    pierce: 0,
    bursts: [],
  };
}

function initV2(seed: number): WavState {
  const s = init(seed);
  // The first formation flies in too.
  return {
    ...s,
    rev: WAV_REV,
    enter: WAV_BREATHER_TICKS,
    fyTarget: START_Y,
    fy: START_Y - ENTRY_DIST,
    divers: [],
    diveIn: 0,
    boss: null,
    bossHits: 0,
    bossKilled: 0,
    rammed: 0,
    diversDown: 0,
  };
}

/** Where a diver is drawn and collides: its centre in whole px. */
export function wavDiverCentre(d: WavDiver): { x: number; y: number } {
  return { x: Math.trunc(d.x / FP), y: Math.trunc(d.y / FP) };
}

function isOver(state: WavState): boolean {
  return state.ended !== 0;
}

export function wavShapeBox(state: WavState, index: number): { x: number; y: number } {
  const form = wavForm(state);
  if (form) return { x: state.fx + form[index]![0], y: state.fy + form[index]![1] };
  const row = Math.trunc(index / WAV_COLS);
  const col = index % WAV_COLS;
  return { x: state.fx + col * PITCH_X, y: state.fy + row * PITCH_Y };
}

function step(state: WavState, input: ArcadeInputEvent | null): WavState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: WavState = {
    ...state,
    tick,
    shapes: state.shapes.slice(),
    bolts: state.bolts.map((b) => ({ ...b })),
    reds: state.reds.map((b) => ({ ...b })),
    armour: state.armour ? { ...state.armour } : null,
    drop: state.drop ? { ...state.drop } : null,
    bursts: state.bursts.filter((b) => tick - b.t < 24),
  };
  const v2 = state.rev === WAV_REV;
  const runTicks = v2 ? WAV_V2_RUN_TICKS : WAV_RUN_TICKS;
  // wavRev 6: the taller world's ship line and bottom edge (554 / 620 otherwise).
  const shipY = wavShipY(state);
  const worldH = wavWorldH(state);
  const boltSpeed = wavBoltSpeedFp(state);
  if (v2) {
    s.divers = (state.divers ?? []).map((d) => ({ ...d }));
    s.boss = state.boss ? { ...state.boss } : null;
  }
  if (input && input.k === ARCADE_INPUT_DRAG) s.aimX = clampInt(input.a, 0, WAV_WORLD_W);
  s.shipX = clampInt(s.aimX, SHIP_MIN_X, SHIP_MAX_X);
  if (s.invuln > 0) s.invuln -= 1;

  // wavRev 2 fly-in: the formation (or boss) glides down from above; nothing marches or fires.
  const entering = v2 && (s.enter ?? 0) > 0;
  if (entering) {
    s.enter = (s.enter ?? 0) - 1;
    s.fy = (s.fyTarget ?? START_Y) - Math.trunc((ENTRY_DIST * (s.enter ?? 0)) / WAV_BREATHER_TICKS);
  }
  const away = new Set<number>((s.divers ?? []).map((d) => d.cell));

  // Formation march.
  if (!entering) s.stepIn -= 1;
  if (!entering && s.stepIn <= 0) {
    let lc = WAV_COLS;
    let rc = -1;
    s.shapes.forEach((code, i) => {
      if (code === 0) return;
      const col = i % WAV_COLS;
      if (col < lc) lc = col;
      if (col > rc) rc = col;
    });
    if (rc >= 0) {
      const nextX = s.fx + s.dir * STEP_PX;
      let left = nextX + lc * PITCH_X;
      let right = nextX + rc * PITCH_X + WAV_CELL;
      const form = wavForm(s);
      if (form) {
        // wavRev 4: the live ships' own boxes reach the walls, wherever they sit in the shape.
        let lo = WAV_WORLD_W;
        let hi = -WAV_WORLD_W;
        s.shapes.forEach((code, i) => {
          if (code === 0) return;
          lo = Math.min(lo, form[i]![0]);
          hi = Math.max(hi, form[i]![0]);
        });
        left = nextX + lo;
        right = nextX + hi + WAV_CELL;
      }
      if (left < EDGE || right > WAV_WORLD_W - EDGE) {
        s.fy += wavDropPx(s);
        s.dir = -s.dir;
      } else s.fx = nextX;
    }
    s.stepIn = stepEvery(s);
  }

  // Ship fire.
  if (s.fireIn > 0) s.fireIn -= 1;
  if (s.fireIn <= 0 && s.bolts.length < WAV_MAX_BOLTS) {
    const bolt: WavBolt = { x: s.shipX * FP, y: (shipY - 14 - WAV_BOLT_H) * FP };
    if (s.pierce > 0) {
      bolt.p = WAV_PIERCE_HITS;
      s.pierce -= 1;
    }
    s.bolts.push(bolt);
    s.fireIn = WAV_FIRE_EVERY;
  }

  // wavRev 2 divers: start on the seeded timer, fly the curve, come home from the top.
  if (v2 && !entering && !s.boss) {
    s.diveIn = (s.diveIn ?? 0) - 1;
    if (s.wave >= WAV_DIVE_FROM_WAVE && (s.diveIn ?? 0) <= 0) {
      s.diveIn = wavDiveEvery(s.wave);
      const pool: number[] = [];
      s.shapes.forEach((code, i) => {
        if (code !== 0 && code !== WAV_ARMOUR_CODE && !away.has(i)) pool.push(i);
      });
      if (pool.length > 1 && (s.divers ?? []).length < wavMaxDivers(s.wave)) {
        const pick = rngBelow(s.rng, pool.length);
        const sway = rngBelow(pick.state, 81);
        const lead = rngBelow(sway.state, 61);
        s.rng = lead.state;
        const cell = pool[pick.value]!;
        const box = wavShapeBox(s, cell);
        const x0 = (box.x + WAV_CELL / 2) * FP;
        const y0 = (box.y + WAV_CELL / 2) * FP;
        s.divers!.push({
          cell,
          t: 0,
          x: x0,
          y: y0,
          x0,
          y0,
          tx: clampInt(s.shipX + lead.value - 30, WAV_CELL, WAV_WORLD_W - WAV_CELL) * FP,
          sway: sway.value - 40,
        });
        away.add(cell);
      }
    }
    const flying: WavDiver[] = [];
    for (const d of s.divers ?? []) {
      d.t += 1;
      if (s.shapes[d.cell] === 0) continue;
      if (d.t <= WAV_DIVE_TICKS) {
        // Down past the ship's line on a sine sway toward the aim point, then off the bottom.
        const exitY = (worldH + WAV_CELL) * FP;
        d.y = d.y0 + Math.trunc(((exitY - d.y0) * d.t) / WAV_DIVE_TICKS);
        const sway = Math.trunc((d.sway * FP * isin(Math.trunc((32768 * d.t) / WAV_DIVE_TICKS))) / TRIG_ONE);
        d.x = d.x0 + Math.trunc(((d.tx - d.x0) * d.t) / WAV_DIVE_TICKS) + sway;
      } else {
        // Home from above to wherever its slot is now.
        const k = d.t - WAV_DIVE_TICKS;
        const box = wavShapeBox(s, d.cell);
        const hx = (box.x + WAV_CELL / 2) * FP;
        const hy = (box.y + WAV_CELL / 2) * FP;
        const fromY = -WAV_CELL * FP;
        d.x = d.tx + Math.trunc(((hx - d.tx) * k) / WAV_RETURN_TICKS);
        d.y = fromY + Math.trunc(((hy - fromY) * k) / WAV_RETURN_TICKS);
        if (k >= WAV_RETURN_TICKS) {
          away.delete(d.cell);
          continue;
        }
      }
      // Ramming the player costs a life; the diver is destroyed with no points.
      const c = wavDiverCentre(d);
      if (
        Math.abs(c.x - s.shipX) < (WAV_SHIP_W + WAV_CELL) / 2 &&
        Math.abs(c.y - shipY) < (WAV_SHIP_H + WAV_CELL) / 2
      ) {
        if (s.invuln === 0) {
          s.lives -= 1;
          s.invuln = INVULN_TICKS;
        }
        s.shapes[d.cell] = 0;
        s.rammed = (s.rammed ?? 0) + 1;
        s.bursts.push({ x: c.x, y: c.y, t: tick, c: 0 });
        continue;
      }
      flying.push(d);
    }
    s.divers = flying;
  }

  // wavRev 2 boss: slides side to side and fires its seeded pattern once it has arrived.
  if (v2 && s.boss) {
    const boss = s.boss;
    if (!entering) {
      boss.x += boss.dir;
      if (boss.x <= BOSS_MIN_X || boss.x >= BOSS_MAX_X) boss.dir = -boss.dir;
      boss.fireIn -= 1;
      if (boss.fireIn <= 0) {
        boss.fireIn = WAV_BOSS_FIRE_EVERY;
        const pattern = rngBelow(s.rng, 3);
        s.rng = pattern.state;
        const muzzle = (WAV_BOSS_Y + WAV_BOSS_H) * FP;
        const guns =
          pattern.value === 0
            ? [8, WAV_BOSS_W / 2, WAV_BOSS_W - 8]
            : pattern.value === 1
              ? [8, WAV_BOSS_W - 8]
              : [clampInt(s.shipX - boss.x, 8, WAV_BOSS_W - 8)];
        for (const gx of guns) if (s.reds.length < MAX_RED) s.reds.push({ x: (boss.x + gx) * FP, y: muzzle });
      }
    }
  }

  // Saucer.
  if (tick % SAUCER_EVERY === 0 && tick < runTicks && s.saucerDir === 0) {
    const side = rngBelow(s.rng, 2);
    s.rng = side.state;
    s.saucerDir = side.value === 0 ? 1 : -1;
    s.saucerX = s.saucerDir > 0 ? -12 * FP : (WAV_WORLD_W + 12) * FP;
  }
  if (s.saucerDir !== 0) {
    s.saucerX += s.saucerDir * SAUCER_SPEED_FP;
    if (s.saucerX < -16 * FP || s.saucerX > (WAV_WORLD_W + 16) * FP) {
      s.saucerDir = 0;
      s.saucerX = 0;
    }
  }

  // Bolts up, and what they hit.
  const kept: WavBolt[] = [];
  for (const bolt of s.bolts) {
    bolt.y -= boltSpeed;
    if (bolt.y + WAV_BOLT_H * FP < WAV_HUD_H * FP) continue;
    let hit = false;
    for (let i = 0; i < WAV_SHAPES && !hit; i++) {
      const code = s.shapes[i] ?? 0;
      if (code === 0 || away.has(i)) continue;
      if (code === WAV_ARMOUR_CODE && bolt.a) continue;
      const box = wavShapeBox(s, i);
      if (
        bolt.x + 2 * FP > box.x * FP &&
        bolt.x - 2 * FP < (box.x + WAV_CELL) * FP &&
        bolt.y < (box.y + WAV_CELL) * FP &&
        bolt.y + WAV_BOLT_H * FP > box.y * FP
      ) {
        if (bolt.p) {
          bolt.p -= 1;
          if (bolt.p <= 0) hit = true;
        } else hit = true;
        if (code === WAV_ARMOUR_CODE && s.armour) {
          bolt.a = 1;
          s.armour.hp -= 1;
          s.armourHits += 1;
          if (s.armour.hp <= 0) {
            for (let j = 0; j < WAV_SHAPES; j++) if (s.shapes[j] === WAV_ARMOUR_CODE) s.shapes[j] = 0;
            const ab = wavShapeBox(s, s.armour.row * WAV_COLS + s.armour.col);
            s.bursts.push({
              x: ab.x + ((s.armour.w - 1) * PITCH_X + WAV_CELL) / 2,
              y: ab.y + ((s.armour.h - 1) * PITCH_Y + WAV_CELL) / 2,
              t: tick,
              c: 4,
            });
            s.armour = null;
          }
          continue;
        }
        s.shapes[i] = 0;
        s.shapesDown += 1;
        s.waveKills += 1;
        s.bursts.push({
          x: box.x + WAV_CELL / 2,
          y: box.y + WAV_CELL / 2,
          t: tick,
          c: (code - 1) % 3,
        });
      }
    }
    // wavRev 2: divers in flight, then the boss.
    if (!hit && v2) {
      for (const d of s.divers ?? []) {
        if (s.shapes[d.cell] === 0) continue;
        const c = wavDiverCentre(d);
        if (
          bolt.x + 2 * FP > (c.x - WAV_CELL / 2) * FP &&
          bolt.x - 2 * FP < (c.x + WAV_CELL / 2) * FP &&
          bolt.y < (c.y + WAV_CELL / 2) * FP &&
          bolt.y + WAV_BOLT_H * FP > (c.y - WAV_CELL / 2) * FP
        ) {
          hit = true;
          const code = s.shapes[d.cell]!;
          s.shapes[d.cell] = 0;
          s.shapesDown += 1;
          s.waveKills += 1;
          s.diversDown = (s.diversDown ?? 0) + 1;
          s.bursts.push({ x: c.x, y: c.y, t: tick, c: (code - 1) % 3 });
          break;
        }
      }
    }
    if (!hit && v2 && s.boss && !entering && (s.boss.hp ?? 0) > 0) {
      const boss = s.boss;
      if (
        bolt.x + 2 * FP > boss.x * FP &&
        bolt.x - 2 * FP < (boss.x + WAV_BOSS_W) * FP &&
        bolt.y < (WAV_BOSS_Y + WAV_BOSS_H) * FP &&
        bolt.y + WAV_BOLT_H * FP > WAV_BOSS_Y * FP
      ) {
        hit = true;
        boss.hp -= 1;
        s.bossHits = (s.bossHits ?? 0) + 1;
        if (boss.hp <= 0) {
          s.bossKilled = 1;
          s.bursts.push({ x: boss.x + WAV_BOSS_W / 2, y: WAV_BOSS_Y + WAV_BOSS_H / 2, t: tick, c: 4 });
        }
      }
    }
    if (!hit && s.saucerDir !== 0) {
      const dx = Math.abs(bolt.x - s.saucerX);
      const dy = Math.abs(bolt.y + 6 * FP - SAUCER_Y * FP);
      if (dx <= (WAV_SAUCER_R + 2) * FP && dy <= (WAV_SAUCER_R + 6) * FP) {
        hit = true;
        s.saucers += 1;
        s.bursts.push({ x: Math.trunc(s.saucerX / FP), y: SAUCER_Y, t: tick, c: 3 });
        if (!s.drop) {
          const delay = rngBelow(s.rng, DROP_DELAY_SPAN);
          s.rng = delay.state;
          s.drop = {
            x: clampInt(Math.trunc(s.saucerX / FP), SHIP_MIN_X, SHIP_MAX_X) * FP,
            y: SAUCER_Y * FP,
            wait: DROP_DELAY_MIN + delay.value,
          };
        }
        s.saucerDir = 0;
        s.saucerX = 0;
      }
    }
    if (!hit) kept.push(bolt);
  }
  s.bolts = kept;

  // Power-up drop: waits its seeded delay, then falls straight down.
  if (s.drop) {
    if (s.drop.wait > 0) s.drop.wait -= 1;
    else {
      s.drop.y += DROP_SPEED_FP;
      const caught =
        Math.abs(s.drop.x - s.shipX * FP) < (WAV_SHIP_W / 2 + WAV_DROP_R) * FP &&
        Math.abs(s.drop.y - shipY * FP) < (WAV_SHIP_H / 2 + WAV_DROP_R) * FP;
      if (caught) {
        s.pierce = WAV_PIERCE_SHOTS;
        s.drop = null;
      } else if (s.drop.y > worldH * FP) s.drop = null;
    }
  }

  // Enemy fire from any shape in the lowest two occupied rows, chosen from the seed.
  if (!entering && !s.boss) s.redIn -= 1;
  if (s.redIn <= 0) {
    // wavRev 4 shapes: a ship's "row" is its height in the shape in grid rows (PITCH_Y), and its "column" its x.
    const form = wavForm(s);
    const rowOf = (i: number) => (form ? Math.trunc(form[i]![1] / PITCH_Y) : Math.trunc(i / WAV_COLS));
    const colOf = (i: number) => (form ? form[i]![0] : i % WAV_COLS);
    let lowest = -1;
    s.shapes.forEach((code, i) => {
      if (code !== 0) lowest = Math.max(lowest, rowOf(i));
    });
    const shooters: number[] = [];
    s.shapes.forEach((code, i) => {
      if (code !== 0 && code !== WAV_ARMOUR_CODE && !away.has(i) && rowOf(i) >= lowest - 1)
        shooters.push(i);
    });
    let volley = 1;
    if (s.wave >= DOUBLE_FROM_WAVE) {
      const roll = rngBelow(s.rng, 3);
      s.rng = roll.state;
      if (roll.value === 0) volley = 2;
    }
    let usedCol = -1;
    for (let shot = 0; shot < volley && shooters.length > 0 && s.reds.length < MAX_RED; shot++) {
      const pool = shooters.filter((i) => colOf(i) !== usedCol);
      if (pool.length === 0) break;
      const pick = rngBelow(s.rng, pool.length);
      s.rng = pick.state;
      const index = pool[pick.value] ?? 0;
      usedCol = colOf(index);
      const box = wavShapeBox(s, index);
      s.reds.push({ x: (box.x + WAV_CELL / 2) * FP, y: (box.y + WAV_CELL) * FP });
    }
    s.redIn = Math.max(RED_MIN, s.redBase - Math.trunc((s.redBase * tick) / (2 * runTicks)));
  }
  const redsKept: WavBolt[] = [];
  for (const red of s.reds) {
    red.y += s.redSpeed;
    if (red.y > worldH * FP) continue;
    const overlaps =
      Math.abs(red.x - s.shipX * FP) < (WAV_SHIP_W / 2 + 2) * FP &&
      red.y + WAV_BOLT_H * FP >= (shipY - WAV_SHIP_H / 2) * FP &&
      red.y <= (shipY + WAV_SHIP_H / 2) * FP;
    if (overlaps) {
      if (s.invuln === 0) {
        s.lives -= 1;
        s.invuln = INVULN_TICKS;
      }
      continue;
    }
    redsKept.push(red);
  }
  s.reds = redsKept;

  // Wave cleared (wavRev 2: the next formation, or the boss, flies in).
  if (v2 && !s.boss && s.shapes.every((code) => code === 0)) {
    s.wavesCleared += 1;
    s.wave += 1;
    s.divers = [];
    s.diveIn = wavDiveEvery(s.wave);
    s.enter = WAV_BREATHER_TICKS;
    s.waveBase = Math.max(WAV_STEP_MIN, Math.trunc((s.waveBase * 85) / 100));
    s.redBase = Math.max(RED_MIN, Math.trunc((s.redBase * 80) / 100));
    s.redSpeed = Math.min(RED_SPEED_CAP, Math.trunc((s.redSpeed * 115) / 100));
    s.waveKills = 0;
    s.stepIn = stepEvery(s);
    s.redIn = s.redBase;
    s.armour = null;
    if (s.wave > wavWaves(s)) {
      // The boss: the formation grid stays empty from here on.
      s.boss = { x: Math.trunc((WAV_WORLD_W - WAV_BOSS_W) / 2), dir: 1, hp: WAV_BOSS_HP, fireIn: WAV_BOSS_FIRE_EVERY };
      if (s.tunec) s.bossAt = tick;
    } else {
      const next = newShapes(s.rng);
      s.rng = next.rng;
      s.shapes = next.shapes;
      const form = wavForm(s);
      if (form) {
        // wavRev 4: the shape's first slots are its armour core (2 rows on the grid pitch, slot 0 top-left).
        const [cells, hp] = WAV_ARMOUR_BY_WAVE[Math.min(s.wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
        for (let i = 0; i < cells; i++) s.shapes[i] = WAV_ARMOUR_CODE;
        s.armour = { col: 0, row: 0, w: cells / 2, h: 2, hp, maxHp: hp };
        const size = wavFormSize(s.wave);
        s.fx = Math.trunc((WAV_WORLD_W - size.w) / 2);
        // Shapes are wider than the grid (they reach the walls, and drop, sooner), so they settle higher:
        // at the top on wave 2, WAV_FORM_STEP_Y lower each wave after (measured to keep the score bands).
        s.fyTarget = START_Y + (s.wave - 2) * WAV_FORM_STEP_Y;
      } else {
        const armour = placeArmour(s.rng, s.shapes, s.wave);
        s.rng = armour.rng;
        s.armour = armour.armour;
        s.fx = START_X;
        s.fyTarget = Math.min(MAX_START_Y, START_Y + (s.wave - 1) * PITCH_Y);
      }
      s.fy = s.fyTarget - ENTRY_DIST;
      s.dir = 1;
    }
  } else if (!v2 && s.shapes.every((code) => code === 0)) {
    s.wavesCleared += 1;
    s.wave += 1;
    const next = newShapes(s.rng);
    s.rng = next.rng;
    s.shapes = next.shapes;
    const armour = placeArmour(s.rng, s.shapes, s.wave);
    s.rng = armour.rng;
    s.armour = armour.armour;
    s.fx = START_X;
    s.fy = Math.min(MAX_START_Y, START_Y + (s.wave - 1) * PITCH_Y);
    s.dir = 1;
    s.waveBase = Math.max(WAV_STEP_MIN, Math.trunc((s.waveBase * 85) / 100));
    s.redBase = Math.max(RED_MIN, Math.trunc((s.redBase * 80) / 100));
    s.redSpeed = Math.min(RED_SPEED_CAP, Math.trunc((s.redSpeed * 115) / 100));
    s.waveKills = 0;
    s.stepIn = stepEvery(s);
  }

  // Reached the ship's line?
  let lowest = -1;
  const shapedForm = wavForm(s);
  s.shapes.forEach((code, i) => {
    if (code !== 0) lowest = Math.max(lowest, shapedForm ? shapedForm[i]![1] : Math.trunc(i / WAV_COLS) * PITCH_Y);
  });
  const reached = lowest >= 0 && s.fy + lowest + WAV_CELL >= shipY - WAV_SHIP_H / 2;

  if (s.lives <= 0 || reached) {
    s.lives = Math.max(0, s.lives);
    s.ended = 2;
    s.endedTick = tick;
  } else if (v2 && s.bossKilled) {
    s.ended = 1;
    s.endedTick = tick;
  } else if (tick >= runTicks) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** Achieved = shapes + armour hits + 5 per saucer + 15 per wave; par (wave 5 perfect) = 150. */
export function wavScoreOf(shapesDown: number, saucers: number, waves: number, armourHits = 0): number {
  const raw = shapesDown + armourHits + WAV_POINTS_SAUCER * saucers + WAV_POINTS_WAVE * waves;
  return clampInt(Math.floor((150 * raw) / WAV_PAR), 0, 150);
}

/** wavRev 2: the same points plus every boss hit and 40 for the kill, against WAV_PAR_V2. */
export function wavScoreV2(shapesDown: number, saucers: number, waves: number, armourHits: number, bossHits: number, bossKilled: number): number {
  const raw =
    shapesDown + armourHits + WAV_POINTS_SAUCER * saucers + WAV_POINTS_WAVE * waves + bossHits + WAV_POINTS_BOSS * bossKilled;
  return clampInt(Math.floor((150 * raw) / WAV_PAR_V2), 0, 150);
}

function score(state: WavState): number {
  if (state.rev === WAV_REV)
    return wavScoreV2(state.shapesDown, state.saucers, state.wavesCleared, state.armourHits, state.bossHits ?? 0, state.bossKilled ?? 0);
  return wavScoreOf(state.shapesDown, state.saucers, state.wavesCleared, state.armourHits);
}

/* ============================= Checkpoints ============================= */

export const WAV_CHECKPOINT_INTERVAL = 300;

export const WAV_CHECKPOINT_KEYS = [
  "tick",
  "shipX",
  "fx",
  "fy",
  "dir",
  "stepIn",
  "wave",
  "waveKills",
  "shapesDown",
  "saucers",
  "wavesCleared",
  "lives",
  "invuln",
  "bolts",
  "reds",
  "saucerX",
  "redBase",
  "redSpeed",
  "armourHp",
  "armourHits",
  "pierce",
  "drop",
  "alive",
  "rng",
  "checksum",
] as const;

export interface WavCheckpoint {
  tick: number;
  shipX: number;
  fx: number;
  fy: number;
  dir: number;
  stepIn: number;
  wave: number;
  waveKills: number;
  shapesDown: number;
  saucers: number;
  wavesCleared: number;
  lives: number;
  invuln: number;
  bolts: number;
  reds: number;
  saucerX: number;
  redBase: number;
  redSpeed: number;
  armourHp: number;
  armourHits: number;
  pierce: number;
  drop: number;
  alive: number;
  rng: number;
  checksum: number;
}

export function wavCheckpoint(state: WavState): WavCheckpoint {
  const snap = {
    tick: state.tick,
    shipX: state.shipX,
    fx: state.fx,
    fy: state.fy,
    dir: state.dir,
    stepIn: state.stepIn,
    wave: state.wave,
    waveKills: state.waveKills,
    shapesDown: state.shapesDown,
    saucers: state.saucers,
    wavesCleared: state.wavesCleared,
    lives: state.lives,
    invuln: state.invuln,
    bolts: state.bolts.length,
    reds: state.reds.length,
    saucerX: state.saucerX,
    redBase: state.redBase,
    redSpeed: state.redSpeed,
    armourHp: state.armour ? state.armour.hp : 0,
    armourHits: state.armourHits,
    pierce: state.pierce,
    drop: state.drop ? state.drop.y : 0,
    alive: state.shapes.reduce((n, code) => (code ? n + 1 : n), 0),
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  for (const b of [...state.bolts, ...state.reds]) {
    checksum ^= (b.x ^ Math.imul(b.y, 31) ^ ((b.p ?? 0) << 3)) | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  // wavRev 2 only, so original checksums are unchanged.
  if (state.rev !== undefined) {
    const extra = [state.rev, state.enter ?? 0, state.diveIn ?? 0, state.bossHits ?? 0, state.bossKilled ?? 0, state.rammed ?? 0, state.diversDown ?? 0];
    if (state.boss) extra.push(state.boss.x, state.boss.dir, state.boss.hp, state.boss.fireIn);
    for (const d of state.divers ?? []) extra.push(d.cell, d.t, d.x, d.y);
    // wavRev 4 only, after every rev-2 value.
    if (state.shaped) extra.push(state.shaped);
    // wavRev 5 only, after every rev-4 value.
    if (state.tunec) extra.push(state.tunec, state.bossAt ?? 0);
    // wavRev 6 (taller worlds): the world height, last.
    if (state.worldH) extra.push(state.worldH);
    // wavRev 10 (expansion): its marker and feature state, after everything else.
    if (state.x10) {
      extra.push(state.x10, state.streak ?? 0, state.streakPts ?? 0, state.weakHits ?? 0, state.cannonsDown ?? 0, state.powerups ?? 0, state.shieldBlocks ?? 0, state.spread ?? 0, state.shield ?? 0, state.midKilled ?? 0, state.bossDmg ?? 0, state.drop?.k ?? -1, state.dropsSeen ?? 0, state.precise ?? 0);
      if (state.boss) extra.push(state.boss.mid ?? 0, ...(state.boss.guns ?? []));
      for (const b of state.bolts) extra.push(b.v ?? 0, b.sd ?? 0, b.h ?? 0);
    }
    // wavRev 11 (phone notes): its marker, the carriers and the falling power-ups, last.
    if (state.r11) {
      extra.push(state.r11, state.pickupsMade ?? 0, ...(state.carry ?? []));
      for (const p of state.pickups ?? []) extra.push(p.x, p.y, p.k, p.i);
    }
    for (const value of extra) {
      checksum ^= value | 0;
      checksum = Math.imul(checksum, 0x01000193) >>> 0;
    }
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const WAV_BG = "#07070C";
export const WAV_GOLD = "#F5B82E";
export const WAV_RED = "#F0524F";
export const WAV_PURPLE = "#A78BFA";
export const WAV_COLOURS = ["#2ED3B7", "#F472B6", "#60A5FA"];

export function drawWavShape(
  ctx: CanvasRenderingContext2D,
  kind: number,
  colour: string,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size / 2;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (kind === 0) {
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const points = kind === 1 ? 3 : 6;
  for (let p = 0; p < points; p++) {
    const angle = -Math.PI / 2 + (p * Math.PI * 2) / points;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r + (kind === 1 ? r * 0.15 : 0);
    if (p === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
}

export function drawWavShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  const h = (w * 3) / 5;
  ctx.fillStyle = WAV_GOLD;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx, cy + h / 6);
  ctx.lineTo(cx - w / 2, cy + h / 2);
  ctx.closePath();
  ctx.fill();
}

function drawBursts(ctx: CanvasRenderingContext2D, bursts: WavBurst[], tick: number, palette: string[]) {
  for (const b of bursts) {
    const age = tick - b.t;
    ctx.globalAlpha = Math.max(0, 1 - age / 24);
    ctx.fillStyle = palette[b.c] ?? "#FFFFFF";
    for (let p = 0; p < 6; p++) {
      const angle = (p * Math.PI) / 3 + 0.3;
      const d = 4 + age * 1.4;
      ctx.fillRect(b.x + Math.cos(angle) * d - 2, b.y + Math.sin(angle) * d - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  let v = seed | 0 || 7;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 60; i++) {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    const x = ((v >>> 8) % 1000) / 1000;
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    const y = ((v >>> 8) % 1000) / 1000;
    ctx.fillRect(x * w, y * h, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }
}

/** Grey plated block; one black crack per hit taken (render-only shapes, fixed per hit index). */
function drawWavArmour(ctx: CanvasRenderingContext2D, state: WavState, a: WavArmour): void {
  const box = wavShapeBox(state, a.row * WAV_COLS + a.col);
  const w = (a.w - 1) * PITCH_X + WAV_CELL;
  const h = (a.h - 1) * PITCH_Y + WAV_CELL;
  ctx.fillStyle = "#9AA3B2";
  ctx.fillRect(box.x, box.y, w, h);
  ctx.strokeStyle = "#D8DDE5";
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x + 3, box.y + 3, w - 6, h - 6);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  const hits = a.maxHp - a.hp;
  for (let k = 0; k < hits; k++) {
    let v = Math.imul(k + 1, 2654435761) ^ (a.maxHp * 977);
    const rnd = () => {
      v = (Math.imul(v, 1103515245) + 12345) | 0;
      return ((v >>> 8) % 1000) / 1000;
    };
    let x = box.x + rnd() * w;
    let y = box.y;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let seg = 0; seg < 4; seg++) {
      x = Math.min(box.x + w, Math.max(box.x, x + (rnd() - 0.5) * w * 0.5));
      y += h / 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function draw(ctx: CanvasRenderingContext2D, state: WavState, size: CanvasSize): void {
  const H = wavWorldH(state);
  const scale = Math.min(size.width / WAV_WORLD_W, size.height / H);
  const ox = (size.width - WAV_WORLD_W * scale) / 2;
  const oy = (size.height - H * scale) / 2;
  ctx.save();
  ctx.fillStyle = WAV_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawStars(ctx, WAV_WORLD_W, H, 91);

  state.shapes.forEach((code, i) => {
    if (code === 0 || code === WAV_ARMOUR_CODE) return;
    const box = wavShapeBox(state, i);
    const kind = Math.trunc((code - 1) / 3);
    const colour = WAV_COLOURS[(code - 1) % 3] ?? WAV_COLOURS[0]!;
    drawWavShape(ctx, kind, colour, box.x + WAV_CELL / 2, box.y + WAV_CELL / 2, WAV_CELL);
  });

  if (state.armour) drawWavArmour(ctx, state, state.armour);

  if (state.drop && state.drop.wait === 0) {
    const dx = state.drop.x / FP;
    const dy = state.drop.y / FP;
    ctx.fillStyle = WAV_PURPLE;
    ctx.beginPath();
    ctx.moveTo(dx, dy - WAV_DROP_R);
    ctx.lineTo(dx + WAV_DROP_R, dy);
    ctx.lineTo(dx, dy + WAV_DROP_R);
    ctx.lineTo(dx - WAV_DROP_R, dy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#F7F7F8";
    ctx.fillRect(dx - 1, dy - 5, 2, 10);
  }

  if (state.saucerDir !== 0) {
    ctx.strokeStyle = WAV_PURPLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(state.saucerX / FP, SAUCER_Y, WAV_SAUCER_R + 4, WAV_SAUCER_R - 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const b of state.bolts) {
    ctx.fillStyle = b.p ? WAV_PURPLE : WAV_GOLD;
    const w = b.p ? WAV_BOLT_W + 2 : WAV_BOLT_W;
    ctx.fillRect(b.x / FP - w / 2, b.y / FP - (b.p ? 6 : 0), w, WAV_BOLT_H + (b.p ? 6 : 0));
  }
  ctx.fillStyle = WAV_RED;
  for (const b of state.reds) ctx.fillRect(b.x / FP - WAV_BOLT_W / 2, b.y / FP, WAV_BOLT_W, WAV_BOLT_H);

  drawBursts(ctx, state.bursts, state.tick, [...WAV_COLOURS, WAV_PURPLE, "#9AA3B2"]);

  const flashing = state.invuln > 0 && state.tick % 8 < 4;
  if (!flashing && state.ended !== 2) drawWavShip(ctx, state.shipX, wavShipY(state), WAV_SHIP_W);
  if (state.ended === 2) {
    ctx.globalAlpha = 0.4;
    drawWavShip(ctx, state.shipX, wavShipY(state), WAV_SHIP_W);
    ctx.globalAlpha = 1;
  }

  // Drag zone hint.
  ctx.strokeStyle = "rgba(245,184,46,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, wavDragZoneTop(H));
  ctx.lineTo(WAV_WORLD_W - 8, wavDragZoneTop(H));
  ctx.stroke();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Wave ${state.wave} · ${score(state)}`, 14, 14);
  if (state.pierce > 0) {
    ctx.fillStyle = WAV_PURPLE;
    ctx.fillText(`Laser ×${state.pierce}`, 14, 34);
  }
  for (let i = 0; i < WAV_LIVES; i++) {
    ctx.globalAlpha = i < state.lives ? 1 : 0.2;
    drawWavShip(ctx, WAV_WORLD_W - 24 - i * 26, 22, 18);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export const wavefrontGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  key: "wavefront",
  runTicks: WAV_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: WAV_INPUT_RANGES,
};

const wavefrontGameV2: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontGame,
  runTicks: WAV_V2_RUN_TICKS,
  init: initV2,
};

/** The game for a stored wavRev (absent = the original 60 s rules). */
export function wavefrontGameFor(rev?: number | null): ArcadeGame<WavState, ArcadeInputEvent | null> {
  if (rev === WAV_REV_STD) return wavefrontStdGame;
  if (rev === WAV_REV_PHONE) return wavefrontPhoneGame;
  if (rev === WAV_REV_EXPAND) return wavefrontExpandGame;
  if (rev === WAV_REV_STRICT) return wavefrontStrictGame;
  if (rev === WAV_REV_TARGET) return wavefrontTargetGame;
  if (rev === WAV_REV_TALL) return wavefrontTallGame;
  if (rev === WAV_REV_TUNEC) return wavefrontTunecGame;
  if (rev === WAV_REV_SHAPES) return wavefrontShapesGame;
  if (rev === WAV_REV_BAND) return wavefrontBandGame;
  return rev === WAV_REV ? wavefrontGameV2 : wavefrontGame;
}

/* ================= Oct 2026 score bands (wavRev 3) ================= */

/** Score-band revision (puzzle.wavRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const WAV_REV_BAND = 3;
/** Ships, armour hits and boss hits count 1, saucers 5, waves 15; 140 at a perfect five waves plus every boss hit; destroying the boss adds 10. */
export const WAV_BAND_CURVE = bandCurve([0, 100, 214, 235, 255, WAV_PAR_V2 - WAV_POINTS_BOSS], [0, 25, 72, 100, 120, 140]);
export function wavefrontBandParts(state: WavState): BandParts {
  if (state.std) return wavefrontStdParts(state);
  if (state.r11) return wavefrontPhoneParts(state);
  if (state.x10) return wavefrontExpandParts(state);
  // wavRev 5: a saucer counts 1 like a ship and can stand in for one missed; at 5 it outweighed the boss fight that separates players.
  const saucer = state.tunec ? WAV_POINTS_SAUCER_V5 : WAV_POINTS_SAUCER;
  const units = state.shapesDown + state.armourHits + saucer * state.saucers + WAV_POINTS_WAVE * state.wavesCleared + (state.bossHits ?? 0);
  const finished = (state.bossKilled ?? 0) > 0;
  // wavRev 5: the kill adds up to 10 for speed, timed from the boss's arrival: the full 10 for a fight
  // of WAV_KILL_WINDOW_V5 / 2 or less, falling evenly to 0 at WAV_KILL_WINDOW_V5 (the 50 % par shape);
  // older revisions a flat 10.
  const fight = state.tick - (state.bossAt ?? 0);
  const bonus = !finished ? 0 : state.tunec ? speedBonusCurve(BAND_FINISH_BONUS, clampInt(WAV_KILL_WINDOW_V5 - fight, 0, WAV_KILL_WINDOW_V5), WAV_KILL_WINDOW_V5) : BAND_FINISH_BONUS;
  return { units, points: bandPoints(state.band === BAND_STRICT_MARK ? bandStrict(WAV_V7_BAND_CURVE) : state.band === BAND_TARGET_MARK ? WAV_V7_BAND_CURVE : state.worldH ? WAV_V6_BAND_CURVE : state.tunec ? WAV_V5_BAND_CURVE : WAV_BAND_CURVE, units), bonus, penalty: 0, finished, text: `${state.wavesCleared} waves · ${state.shapesDown} ships · ${state.saucers} saucers · ${state.bossHits ?? 0} boss hits`, bonusText: "Boss destroyed" };
}

function scoreBand(state: WavState): number {
  // wavRev 12: the arcade scoring standard (at least 1 for anyone who plays).
  if (state.std) return stdTotal(wavStdScore(state), Boolean(state.acted));
  return bandTotal(wavefrontBandParts(state), Boolean(state.acted), state.x10 ? WAV_X_MAX : undefined);
}

export const wavefrontBandGame: ArcadeGame<WavState, ArcadeInputEvent | null> = { ...wavefrontGameV2, init: (seed) => bandInit(wavefrontGameV2.init(seed)) };

/* ================= Tuning A (wavRev 4, Oct 2026) ================= */
/*
 * Waves 2–5 each fly in their own formation shape with the same 30 ships as
 * the grid (wave 1 keeps the grid): a triangle, a circle, a pentagon and an
 * octagon, each round an armour core of the wave's usual size and hits. The
 * ships, colours and every seeded draw are the rev-2 ones (the core takes no
 * placement draws), scored on the rev-3 band curve. Rev-3 and older rounds
 * never set `shaped`, so they replay unchanged.
 */
export const WAV_REV_SHAPES = 4;

/**
 * Each shaped wave's 30 cell boxes: top-left [x, y] in whole px from the
 * formation's origin (fx, fy). The first slots are the armour core (2 rows on
 * the grid's 44 × 36 pitch, slot 0 its top-left cell); the rest outline the
 * shape. Index 0–1 are unused (wave 1 is the grid).
 */
export const WAV_FORMS: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [],
  // Wave 2: triangle (apex toward the player), 2 × 2 armour core.
  [
    [117, 44], [161, 44], [117, 80], [161, 80], [139, 186], [122, 163], [104, 140], [87, 116], [70, 93], [52, 70],
    [35, 47], [18, 23], [0, 0], [28, 0], [56, 0], [84, 0], [111, 0], [139, 0], [167, 0], [194, 0],
    [222, 0], [250, 0], [278, 0], [260, 23], [243, 46], [226, 70], [208, 93], [191, 116], [174, 139], [156, 163],
  ],
  // Wave 3: circle, 3 × 2 armour core.
  [
    [86, 84], [130, 84], [174, 84], [86, 120], [130, 120], [174, 120], [130, 0], [164, 3], [195, 14], [222, 30],
    [243, 51], [256, 76], [260, 102], [256, 128], [243, 153], [222, 174], [195, 190], [164, 201], [130, 204], [96, 201],
    [65, 190], [38, 174], [17, 153], [4, 128], [0, 102], [4, 76], [17, 51], [38, 30], [65, 14], [96, 3],
  ],
  // Wave 4: pentagon (point toward the player), 4 × 2 armour core.
  [
    [65, 73], [109, 73], [153, 73], [197, 73], [65, 109], [109, 109], [153, 109], [197, 109], [131, 203], [105, 188],
    [79, 172], [52, 157], [26, 141], [0, 126], [12, 94], [25, 63], [37, 32], [50, 0], [90, 0], [131, 0],
    [172, 0], [212, 0], [225, 32], [237, 63], [250, 94], [262, 126], [236, 141], [210, 157], [183, 172], [157, 188],
  ],
  // Wave 5: octagon, 5 × 2 armour core.
  [
    [51, 82], [95, 82], [139, 82], [183, 82], [227, 82], [51, 118], [95, 118], [139, 118], [183, 118], [227, 118],
    [196, 0], [223, 20], [251, 39], [278, 59], [278, 100], [278, 141], [251, 161], [223, 180], [196, 200], [139, 200],
    [82, 200], [55, 180], [27, 161], [0, 141], [0, 100], [0, 59], [27, 39], [55, 20], [82, 0], [139, 0],
  ],
];

/** How much lower each shaped wave settles than the one before, px (wave 2 settles at the top). */
export const WAV_FORM_STEP_Y = 21;

/** A shaped wave's width and height, px (its boxes' extent). */
export function wavFormSize(wave: number): { w: number; h: number } {
  const form = WAV_FORMS[wave]!;
  let w = 0;
  let h = 0;
  for (const [x, y] of form) {
    w = Math.max(w, x + WAV_CELL);
    h = Math.max(h, y + WAV_CELL);
  }
  return { w, h };
}

/** The current wave's shape (wavRev 4, waves 2–5), or null for the grid. */
export function wavForm(state: { shaped?: number; tunec?: number; wave: number }): readonly (readonly [number, number])[] | null {
  if (!state.shaped || state.wave < 2 || state.wave > wavWaves(state)) return null;
  return ((state as { x10?: number }).x10 ? WAV_FORMS_X : WAV_FORMS)[state.wave] ?? null;
}

export const wavefrontShapesGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontBandGame,
  init: (seed) => ({ ...wavefrontBandGame.init(seed), shaped: 1 }),
};

/* ================= Tuning C (wavRev 5, Oct 2026) ================= */

/**
 * wavRev 5 (Tuning C): wavRev 4 play (five shaped waves, divers, fly-ins, the
 * same boss, 90 s), except on waves 3 and 4 the formation drops three quarters
 * of a row (WAV_DROP_SLOW_PX) at each wall, so it comes down more slowly. Every
 * ship, armour hit, wave and boss hit counts toward 140 (a saucer counts 1 and
 * can stand in for a missed ship); the kill adds up to 10 by how fast the boss
 * fell from its arrival (bossAt), so 150 needs all five waves and a quick kill.
 * States add `tunec: 1` and `bossAt`; older rounds never set them.
 */
export const WAV_REV_TUNEC = 5;
/** A perfect wavRev-5 run: every ship, every armour hit and all five waves, every boss hit and the kill. */
export const WAV_PAR_V5 = (() => {
  let raw = 0;
  for (let wave = 1; wave <= WAV_V5_WAVES; wave++) {
    raw += WAV_SHAPES + WAV_POINTS_WAVE;
    if (wave >= 2) {
      const [cells, hits] = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
      raw += hits - cells;
    }
  }
  return raw + WAV_BOSS_HP + WAV_POINTS_BOSS;
})();
/** wavRev 5: a saucer counts 1 band unit (5 on earlier revisions). */
export const WAV_POINTS_SAUCER_V5 = 1;
/** wavRev 5: the kill bonus window from the boss's arrival (its 2 s fly-in included): the full 10 within 20 s, none after 40 s (a flawless fight takes 15-18 s). */
export const WAV_KILL_WINDOW_V5 = 40 * TICKS_PER_SECOND;
/**
 * wavRev 5 knots: every ship, armour hit and wave of five waves (233) and every boss hit (36) is
 * 269 = 140. Fitted with scripts/arcade-skill-bands.ts wavefront --rev=c: average players stop around
 * wave 4 or 5 (211 → 70, 218 → 100), great and near-perfect ones fight the boss (266 → 125, 268 → 138).
 */
export const WAV_V5_BAND_CURVE = bandCurve([0, 100, 180, 211, 218, 245, 266, 268, WAV_PAR_V5 - WAV_POINTS_BOSS], [0, 25, 50, 70, 100, 112, 125, 138, 140]);
export const wavefrontTunecGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontShapesGame,
  init: (seed) => ({ ...wavefrontShapesGame.init(seed), tunec: 1 }),
};

/* ================= Taller worlds (wavRev 6, Oct 2026) ================= */

/**
 * wavRev 6 (taller worlds, batch 1): wavRev 5 play (the five waves, their
 * shapes and slow drops, divers, the timed boss, 90 s) in a taller world, 390 ×
 * WAV_TALL_H, the same for every player. The formations, saucer and boss keep
 * their places at the top; the ship sits WAV_SHIP_LIFT above the new bottom, so
 * the extra 110 px is all between the formation and the ship (red bolts and
 * divers have further to come, and a formation further to march down before it
 * reaches the ship's line). Drags start in the bottom quarter of the taller
 * world. States keep `shaped: 1` and `tunec: 1` and add `worldH`, folded into
 * the checkpoint checksum last. Scored on WAV_V6_BAND_CURVE.
 */
export const WAV_REV_TALL = 6;
export const WAV_TALL_H = 730;
/**
 * wavRev 6 knots (the wavRev 5 units; 269 = every ship, armour hit, wave and boss
 * hit = 140): with more room to see bolts and divers coming, the same players get
 * further, so the knots go up (refitted with scripts/arcade-skill-bands.ts
 * wavefront --rev=g1, 60 seeds: unit medians 249.5 / 259 / 263 / 268).
 */
export const WAV_V6_BAND_CURVE = bandCurve([0, 100, 200, 249, 259, 263, 268, WAV_PAR_V5 - WAV_POINTS_BOSS], [0, 20, 45, 70, 100, 125, 138, 140]);
export const wavefrontTallGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontTunecGame,
  init: (seed) => ({ ...wavefrontTunecGame.init(seed), worldH: WAV_TALL_H }),
};

/** The world height (px) a stored round's wavRev plays in. */
export function wavefrontWorldHFor(rev?: number | null): number {
  if (rev === WAV_REV_EXPAND || rev === WAV_REV_PHONE || rev === WAV_REV_STD) return WAV_X_H;
  return rev === WAV_REV_TALL || rev === WAV_REV_TARGET || rev === WAV_REV_STRICT ? WAV_TALL_H : WAV_WORLD_H;
}

/* ================= Scoring targets (wavRev 7, 18 Oct 2026) ================= */

/**
 * wavRev 7 (scoring targets, docs/scoring-targets.md): wavRev 6 play, scored on a
 * gentler curve (Joe found Wavefront too harsh). wavRev 6's knots sat in a cliff
 * (249 → 70, 259 → 100, 263 → 125), so a few missed ships cost 30–50 points and a
 * run that stops in wave 4 scored under 50. The new knots rise steadily from the
 * first wave: two waves (about 100 units) 60, four (about 200) 92, the boss 105,
 * every wave and boss hit (269) 140, never below wavRev 6 for the same units; the
 * kill's speed bonus is unchanged.
 */
export const WAV_REV_TARGET = 7;
export const WAV_V7_BAND_CURVE = bandCurve([0, 50, 100, 150, 200, 240, 255, 262, 268, WAV_PAR_V5 - WAV_POINTS_BOSS], [0, 35, 60, 78, 92, 105, 118, 128, 139, 140]);
export const wavefrontTargetGame = bandTargetGame(wavefrontTallGame);


/* ================= Score bands (wavRev 8, 19 Oct 2026) ================= */

/**
 * wavRev 8 (score bands, docs/scoring-targets.md): wavRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const WAV_REV_STRICT = 8;
export const wavefrontStrictGame = bandStrictGame(wavefrontTargetGame);
/** The curve new rounds score on: WAV_V7_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const WAV_V8_BAND_CURVE = bandStrict(WAV_V7_BAND_CURVE);

/* ================= World expansion (wavRev 10, 26 Oct 2026) ================= */

/**
 * wavRev 10 (the 200 expansion, docs/expansions/x200-wavefront.md): a taller arena and longer waves, with the
 * skill features, scored to 200 (ROUND_MAX). The same 90 s, 390 px wide world, now WAV_X_H tall; the extra
 * height is between the formation and the ship. Every formation wave has 36 ships: wave 1 a 6 × 6 grid,
 * waves 2–5 their Tuning A shapes with a row of six escorts under the shape, each wave's ships from its own
 * seeded stream. After wave 3 a gunship (the mid-boss) flies in; after wave 5 the mothership. The gun fires
 * every WAV_X_FIRE_EVERY ticks. Features, all dealt from the seed alone (the same for every player in a room):
 *  - power-ups: WAV_X_DROPS fall from the top on the run's plan (wavPlan: seeded moments and places, three of
 *    each kind): the laser (piercing, as before), the SPREAD shot (each volley adds two bolts angled out) or the
 *    SHIELD (the next hit is absorbed, for up to WAV_X_SHIELD_TICKS). Nothing the player shoots drops one;
 *  - saucers (the bonus UFO) on the clock as before, their sides from the plan;
 *  - the hit STREAK: hits in a row without a ship bolt leaving the top or a life lost; every hit adds its
 *    multiplier less one (×2 from WAV_X_STREAK_STEP in a row, ×3 from twice that, never more); hull hits on a
 *    boss keep it without growing it;
 *  - boss WEAK POINTS: each boss has two cannons (WAV_X_CANNON_HP hits each; a destroyed one stops firing) and a
 *    core that opens for half of every WAV_X_CORE_PERIOD ticks of the run clock (a hit on the open core takes
 *    WAV_X_CORE_DAMAGE hit points).
 * Base units are ships, armour hits, 15 a wave (the gunship counts as one) and every boss hit point on
 * WAV_V10_BAND_CURVE to 140, plus the kill's speed bonus to 10; the features' skill points (wavSkillRaw) are paid
 * on WAV_X_SKILL_PAY, up to 50. States carry `x10: 1`, folded into the checkpoint last.
 */
export const WAV_REV_EXPAND = 10;
export const WAV_X_H = 800;
export const WAV_X_ROWS = 6;
export const WAV_X_SHAPES = WAV_COLS * WAV_X_ROWS;
/** Escorts under each shaped wave: how many, and their gap below the shape (px). */
export const WAV_X_ESCORTS = 6;
const WAV_X_ESCORT_GAP = 10;
/** The gunship comes after this wave. */
export const WAV_X_MID_AFTER = 3;
export const WAV_X_MID_W = 96;
export const WAV_X_MID_HP = 16;
export const WAV_X_BOSS_HP = WAV_BOSS_HP;
export const WAV_X_CANNON_HP = 4;
/** A cannon's hit box: centred on its gun (8 px in from the boss's edge), this wide, the boss's lower half. */
export const WAV_X_CANNON_W = 16;
export const WAV_X_CORE_W = 24;
export const WAV_X_CORE_PERIOD = 150;
export const WAV_X_CORE_DAMAGE = 3;
export const WAV_X_SPREAD_VOLLEYS = 8;
/** wavRev 10's faster gun: a volley every WAV_X_FIRE_EVERY ticks, up to WAV_X_MAX_BOLTS centre bolts in the air, 12 px a tick. */
export const WAV_X_FIRE_EVERY = 10;
export const WAV_X_MAX_BOLTS = 3;
export const WAV_X_BOLT_SPEED = 11;
/** wavRev 10's red bolts: they start faster and more often (the longer drop to the ship would make them easy). */
export const WAV_X_RED_START = 50;
const WAV_X_RED_SPEED = 6 * FP;
const WAV_X_RED_CAP = Math.trunc((WAV_X_RED_SPEED * 5) / 2);
/** A spread bolt's sideways speed (1/256 px a tick). */
export const WAV_X_SPREAD_DX = 2 * FP;
export const WAV_X_SHIELD_TICKS = 12 * TICKS_PER_SECOND;
/** Drop kinds: 0 laser (pierce), 1 spread, 2 shield. */
export const WAV_DROP_PIERCE = 0;
export const WAV_DROP_SPREAD = 1;
export const WAV_DROP_SHIELD = 2;
/**
 * The streak's multiplier: ×1, then one more every WAV_X_STREAK_STEP hits in a row, capped at ×WAV_X_STREAK_MAX so
 * a long streak pays at a steady rate and never snowballs; the streak's points are capped again in the score
 * (WAV_X_STREAK_CAP).
 */
export const WAV_X_STREAK_STEP = 10;
export const WAV_X_STREAK_MAX = 3;
export function wavStreakMult(streak: number): number {
  return Math.min(WAV_X_STREAK_MAX, 1 + Math.trunc(streak / WAV_X_STREAK_STEP));
}

/**
 * The run's seeded plan (wavRev 10), drawn from the seed alone at the start, so every player in a room sees the
 * same power-ups and saucers at the same moments and places whatever they do: WAV_X_DROPS power-ups, one in each
 * WAV_X_DROP_GAP-tick slot from WAV_X_DROP_FIRST (a seeded moment in the slot's first WAV_X_DROP_JITTER ticks,
 * a seeded x), WAV_X_DROPS / 3 of each kind in a seeded order, falling from WAV_X_DROP_Y at 4 px a tick; and
 * the side each saucer flies in from. Every power-up has left the screen before the next appears.
 */
export const WAV_X_DROPS = 9;
export const WAV_X_DROP_FIRST = 4 * TICKS_PER_SECOND;
export const WAV_X_DROP_GAP = 330;
export const WAV_X_DROP_JITTER = 150;
export const WAV_X_DROP_Y = 60;
export const WAV_X_DROP_MIN_X = 40;
export const WAV_X_DROP_MAX_X = WAV_WORLD_W - 40;
/** Saucers fly every WAV_SAUCER_EVERY ticks: at most this many in the 90 s. */
export const WAV_SAUCER_EVERY = SAUCER_EVERY;
export const WAV_X_SAUCERS = Math.trunc((WAV_V2_RUN_TICKS - 1) / SAUCER_EVERY);
export interface WavPlanDrop {
  t: number;
  x: number;
  k: number;
}
export interface WavPlan {
  drops: WavPlanDrop[];
  /** +1 from the left, −1 from the right, for each saucer in turn. */
  saucers: number[];
}
/** A stream of the seed's own for one part of the plan (`salt`), independent of every draw the play makes. */
function planStream(seed: number, salt: number): number {
  return rngValue((Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) | 0) | 0;
}
export function wavPlan(seed: number): WavPlan {
  let r = planStream(seed, 1);
  const kinds: number[] = [];
  for (let i = 0; i < WAV_X_DROPS; i++) kinds.push(i % 3);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rngBelow(r, i + 1);
    r = j.state;
    [kinds[i], kinds[j.value]] = [kinds[j.value]!, kinds[i]!];
  }
  const drops: WavPlanDrop[] = [];
  for (let i = 0; i < WAV_X_DROPS; i++) {
    const at = rngBelow(r, WAV_X_DROP_JITTER);
    const x = rngBelow(at.state, WAV_X_DROP_MAX_X - WAV_X_DROP_MIN_X + 1);
    r = x.state;
    drops.push({ t: WAV_X_DROP_FIRST + i * WAV_X_DROP_GAP + at.value, x: WAV_X_DROP_MIN_X + x.value, k: kinds[i]! });
  }
  let q = planStream(seed, 2);
  const saucers: number[] = [];
  for (let i = 0; i < WAV_X_SAUCERS; i++) {
    const side = rngBelow(q, 2);
    q = side.state;
    saucers.push(side.value === 0 ? 1 : -1);
  }
  return { drops, saucers };
}
/** wavRev 10: the ships of a formation wave (1–5), from the seed's own stream for that wave. */
function waveShapes(seed: number, wave: number): number[] {
  return newShapesN(planStream(seed, 10 + wave), WAV_X_SHAPES).shapes;
}

/** wavRev 10: waves 2–5's shapes with six escorts in a row under each. */
export const WAV_FORMS_X: readonly (readonly (readonly [number, number])[])[] = WAV_FORMS.map((form, wave) => {
  if (!form.length) return form;
  const { w, h } = wavFormSize(wave);
  const escorts = Array.from({ length: WAV_X_ESCORTS }, (_, k) => [Math.round((k * (w - WAV_CELL)) / (WAV_X_ESCORTS - 1)), h + WAV_X_ESCORT_GAP] as const);
  return [...form, ...escorts];
});

/**
 * wavRev 10 weak-point precision: a hit on a cannon or the open core pays more skill points the nearer its centre
 * it lands (`d` whole px from the centre): 3 within 1 px, 2 within 3, 1 within 5, else 0.
 */
export function wavPrecision(d: number): number {
  return d <= 1 ? 3 : d <= 3 ? 2 : d <= 5 ? 1 : 0;
}
/** wavRev 10: the mothership arrives by this tick of the run clock at the latest (74 s). */
export const WAV_X_BOSS_BY = 78 * TICKS_PER_SECOND;

/** wavRev 10: a boss's width (the gunship is narrower). */
export function wavBossW(boss: { mid?: number }): number {
  return boss.mid ? WAV_X_MID_W : WAV_BOSS_W;
}
/** wavRev 10: whether a boss's core is open on this tick (half of every period from its arrival). */
export function wavCoreOpen(_boss: unknown, tick: number): boolean {
  // On the run's own clock (the same moments for every player), not the boss's arrival.
  return tick % WAV_X_CORE_PERIOD < WAV_X_CORE_PERIOD / 2;
}
/** wavRev 10: a cannon's gun x (from the boss's left edge) for side 0 (left) or 1 (right). */
export function wavCannonX(boss: { mid?: number }, side: number): number {
  return side === 0 ? 8 : wavBossW(boss) - 8;
}

function bossX(mid: boolean, hp: number, now: number): WavBoss {
  const w = mid ? WAV_X_MID_W : WAV_BOSS_W;
  return { x: Math.trunc((WAV_WORLD_W - w) / 2), dir: 1, hp, fireIn: WAV_BOSS_FIRE_EVERY, mid: mid ? 1 : 0, maxHp: hp, guns: [WAV_X_CANNON_HP, WAV_X_CANNON_HP], at: now + WAV_BREATHER_TICKS };
}

function newShapesN(rng: number, count: number): { rng: number; shapes: number[] } {
  const shapes: number[] = [];
  let state = rng;
  for (let i = 0; i < count; i++) {
    const kind = rngBelow(state, 3);
    const colour = rngBelow(kind.state, 3);
    state = colour.state;
    shapes.push(1 + kind.value * 3 + colour.value);
  }
  return { rng: state, shapes };
}

function initX(seed: number): WavState {
  const s = initV2(seed);
  // Wave 1: the 6 × 6 grid, from wave 1's own stream; the play's draws (enemy fire, divers) use rng.
  return bandInit({
    ...s,
    shapes: waveShapes(seed, 1),
    seed: seed | 0,
    plan: wavPlan(seed),
    dropsSeen: 0,
    shaped: 1,
    tunec: 1,
    worldH: WAV_X_H,
    x10: 1,
    streak: 0,
    bestStreak: 0,
    streakPts: 0,
    weakHits: 0,
    cannonsDown: 0,
    powerups: 0,
    shieldBlocks: 0,
    spread: 0,
    shield: 0,
    midKilled: 0,
    bossDmg: 0,
    fireIn: WAV_X_FIRE_EVERY,
    redIn: WAV_X_RED_START,
    redBase: WAV_X_RED_START,
    redSpeed: WAV_X_RED_SPEED,
  });
}

/** wavRev 10: a hit landed (any target): the streak grows and pays its multiplier less one. */
function streakHit(s: WavState): void {
  // wavRev 11: no hit streak.
  if (s.r11) return;
  s.streak = (s.streak ?? 0) + 1;
  s.bestStreak = Math.max(s.bestStreak ?? 0, s.streak);
  s.streakPts = (s.streakPts ?? 0) + wavStreakMult(s.streak) - 1;
}


/** wavRev 10: the ship takes a hit (a red bolt or a ram): the shield absorbs it (the streak lives on), else a life. */
function shipHit(s: WavState): void {
  if (s.invuln !== 0) return;
  if ((s.shield ?? 0) > 0) {
    s.shield = 0;
    s.shieldBlocks = (s.shieldBlocks ?? 0) + 1;
    s.invuln = 30;
    return;
  }
  s.lives -= 1;
  s.invuln = INVULN_TICKS;
  s.streak = 0;
}

function stepX(state: WavState, input: ArcadeInputEvent | null): WavState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: WavState = {
    ...state,
    tick,
    shapes: state.shapes.slice(),
    bolts: state.bolts.map((b) => ({ ...b })),
    reds: state.reds.map((b) => ({ ...b })),
    armour: state.armour ? { ...state.armour } : null,
    drop: state.drop ? { ...state.drop } : null,
    bursts: state.bursts.filter((b) => tick - b.t < 24),
    divers: (state.divers ?? []).map((d) => ({ ...d })),
    boss: state.boss ? { ...state.boss, guns: [...(state.boss.guns ?? [])] } : null,
  };
  if (state.r11) {
    s.carry = (state.carry ?? []).slice();
    s.pickups = (state.pickups ?? []).map((p) => ({ ...p }));
  }
  const runTicks = WAV_V2_RUN_TICKS;
  const shipY = wavShipY(s);
  const worldH = wavWorldH(s);
  const boltSpeed = wavBoltSpeedFp(s);
  const n = s.shapes.length;
  if (input && input.k === ARCADE_INPUT_DRAG) s.aimX = clampInt(input.a, 0, WAV_WORLD_W);
  s.shipX = clampInt(s.aimX, SHIP_MIN_X, SHIP_MAX_X);
  if (s.invuln > 0) s.invuln -= 1;
  if ((s.shield ?? 0) > 0) s.shield = (s.shield ?? 0) - 1;

  const entering = (s.enter ?? 0) > 0;
  if (entering) {
    s.enter = (s.enter ?? 0) - 1;
    s.fy = (s.fyTarget ?? START_Y) - Math.trunc((ENTRY_DIST * (s.enter ?? 0)) / WAV_BREATHER_TICKS);
  }
  const away = new Set<number>((s.divers ?? []).map((d) => d.cell));
  const form = wavForm(s);

  // Formation march.
  if (!entering && !s.boss) s.stepIn -= 1;
  if (!entering && !s.boss && s.stepIn <= 0) {
    let lo = WAV_WORLD_W;
    let hi = -WAV_WORLD_W;
    s.shapes.forEach((code, i) => {
      if (code === 0) return;
      const ox = form ? form[i]![0] : (i % WAV_COLS) * PITCH_X;
      lo = Math.min(lo, ox);
      hi = Math.max(hi, ox);
    });
    if (hi >= lo) {
      const nextX = s.fx + s.dir * STEP_PX;
      if (nextX + lo < EDGE || nextX + hi + WAV_CELL > WAV_WORLD_W - EDGE) {
        s.fy += wavDropPx(s);
        s.dir = -s.dir;
      } else s.fx = nextX;
    }
    s.stepIn = stepEvery(s);
  }

  // Ship fire: the centre bolt (piercing while the laser lasts), and two angled bolts while the spread lasts.
  if (s.fireIn > 0) s.fireIn -= 1;
  if (s.fireIn <= 0 && s.bolts.filter((b) => !b.sd).length < WAV_X_MAX_BOLTS) {
    const y0 = (shipY - 14 - WAV_BOLT_H) * FP;
    // A volley fired while the next wave (or a boss) flies in can't break the streak.
    const bolt: WavBolt = entering ? { x: s.shipX * FP, y: y0, h: 1 } : { x: s.shipX * FP, y: y0 };
    if (s.pierce > 0) {
      bolt.p = WAV_PIERCE_HITS;
      s.pierce -= 1;
    }
    s.bolts.push(bolt);
    if ((s.spread ?? 0) > 0) {
      s.spread = (s.spread ?? 0) - 1;
      s.bolts.push({ x: s.shipX * FP, y: y0, v: -WAV_X_SPREAD_DX, sd: 1 }, { x: s.shipX * FP, y: y0, v: WAV_X_SPREAD_DX, sd: 1 });
    }
    s.fireIn = WAV_X_FIRE_EVERY;
  }

  // Divers (from wave 3), as wavRev 5.
  if (!entering && !s.boss) {
    s.diveIn = (s.diveIn ?? 0) - 1;
    if (s.wave >= WAV_DIVE_FROM_WAVE && (s.diveIn ?? 0) <= 0) {
      s.diveIn = wavDiveEvery(s.wave);
      const pool: number[] = [];
      s.shapes.forEach((code, i) => {
        if (code !== 0 && code !== WAV_ARMOUR_CODE && !away.has(i)) pool.push(i);
      });
      if (pool.length > 1 && (s.divers ?? []).length < wavMaxDivers(s.wave)) {
        const pick = rngBelow(s.rng, pool.length);
        const sway = rngBelow(pick.state, 81);
        const lead = rngBelow(sway.state, 61);
        s.rng = lead.state;
        const cell = pool[pick.value]!;
        const box = wavShapeBox(s, cell);
        const x0 = (box.x + WAV_CELL / 2) * FP;
        const y0 = (box.y + WAV_CELL / 2) * FP;
        s.divers!.push({ cell, t: 0, x: x0, y: y0, x0, y0, tx: clampInt(s.shipX + lead.value - 30, WAV_CELL, WAV_WORLD_W - WAV_CELL) * FP, sway: sway.value - 40 });
        away.add(cell);
      }
    }
  }
  {
    const flying: WavDiver[] = [];
    for (const d of s.divers ?? []) {
      d.t += 1;
      if (s.shapes[d.cell] === 0) continue;
      if (d.t <= WAV_DIVE_TICKS) {
        const exitY = (worldH + WAV_CELL) * FP;
        d.y = d.y0 + Math.trunc(((exitY - d.y0) * d.t) / WAV_DIVE_TICKS);
        const sway = Math.trunc((d.sway * FP * isin(Math.trunc((32768 * d.t) / WAV_DIVE_TICKS))) / TRIG_ONE);
        d.x = d.x0 + Math.trunc(((d.tx - d.x0) * d.t) / WAV_DIVE_TICKS) + sway;
      } else {
        const k = d.t - WAV_DIVE_TICKS;
        const box = wavShapeBox(s, d.cell);
        const hx = (box.x + WAV_CELL / 2) * FP;
        const hy = (box.y + WAV_CELL / 2) * FP;
        const fromY = -WAV_CELL * FP;
        d.x = d.tx + Math.trunc(((hx - d.tx) * k) / WAV_RETURN_TICKS);
        d.y = fromY + Math.trunc(((hy - fromY) * k) / WAV_RETURN_TICKS);
        if (k >= WAV_RETURN_TICKS) {
          away.delete(d.cell);
          continue;
        }
      }
      const c = wavDiverCentre(d);
      if (Math.abs(c.x - s.shipX) < (WAV_SHIP_W + WAV_CELL) / 2 && Math.abs(c.y - shipY) < (WAV_SHIP_H + WAV_CELL) / 2) {
        shipHit(s);
        s.shapes[d.cell] = 0;
        // wavRev 11: a carrier that rams the ship takes its power-up with it.
        if (s.r11) s.carry![d.cell] = -1;
        s.rammed = (s.rammed ?? 0) + 1;
        s.bursts.push({ x: c.x, y: c.y, t: tick, c: 0 });
        continue;
      }
      flying.push(d);
    }
    s.divers = flying;
  }

  // The bosses: slide side to side and fire their seeded pattern from the cannons still standing.
  if (s.boss && !entering) {
    const boss = s.boss;
    const w = wavBossW(boss);
    boss.x += boss.dir;
    if (boss.x <= BOSS_MIN_X || boss.x >= WAV_WORLD_W - 12 - w) boss.dir = -boss.dir;
    boss.fireIn -= 1;
    if (boss.fireIn <= 0) {
      boss.fireIn = boss.mid ? WAV_BOSS_FIRE_EVERY + 20 : WAV_BOSS_FIRE_EVERY;
      const pattern = rngBelow(s.rng, 3);
      s.rng = pattern.state;
      const muzzle = (WAV_BOSS_Y + WAV_BOSS_H) * FP;
      const guns = boss.guns ?? [0, 0];
      const sides = [0, 1].filter((k) => guns[k]! > 0).map((k) => wavCannonX(boss, k));
      const centre = w / 2;
      const all = pattern.value === 0 ? [...sides, centre] : pattern.value === 1 ? sides : [clampInt(s.shipX - boss.x, 8, w - 8)];
      for (const gx of all.length ? all : [centre]) if (s.reds.length < MAX_RED) s.reds.push({ x: (boss.x + gx) * FP, y: muzzle });
    }
  }

  // Saucer, on the clock as before; its side from the run's plan.
  if (tick % SAUCER_EVERY === 0 && tick < runTicks && s.saucerDir === 0) {
    s.saucerDir = s.plan?.saucers[tick / SAUCER_EVERY - 1] ?? 1;
    s.saucerX = s.saucerDir > 0 ? -12 * FP : (WAV_WORLD_W + 12) * FP;
  }
  // The planned power-ups: each appears at its seeded moment and place, whatever the play.
  {
    // wavRev 11: none fall from the top; they come from the carriers and saucers shot down.
    const next = s.r11 ? undefined : s.plan?.drops[s.dropsSeen ?? 0];
    if (next && tick === next.t) {
      s.drop = { x: next.x * FP, y: WAV_X_DROP_Y * FP, wait: 0, k: next.k };
      s.dropsSeen = (s.dropsSeen ?? 0) + 1;
    }
  }
  if (s.saucerDir !== 0) {
    s.saucerX += s.saucerDir * SAUCER_SPEED_FP;
    if (s.saucerX < -16 * FP || s.saucerX > (WAV_WORLD_W + 16) * FP) {
      s.saucerDir = 0;
      s.saucerX = 0;
    }
  }

  // Bolts up, and what they hit (the formation's boxes are fixed for the rest of the tick).
  const boxes = s.shapes.map((_, i) => wavShapeBox(s, i));
  const kept: WavBolt[] = [];
  for (const bolt of s.bolts) {
    bolt.y -= boltSpeed;
    if (bolt.v) bolt.x += bolt.v;
    if (bolt.y + WAV_BOLT_H * FP < WAV_HUD_H * FP || bolt.x < 0 || bolt.x > WAV_WORLD_W * FP) {
      // A centre bolt that leaves without a hit breaks the streak (spread bolts never do).
      if (!bolt.sd && !bolt.h) s.streak = 0;
      continue;
    }
    let hit = false;
    for (let i = 0; i < n && !hit; i++) {
      const code = s.shapes[i] ?? 0;
      if (code === 0 || away.has(i)) continue;
      if (code === WAV_ARMOUR_CODE && bolt.a) continue;
      const box = boxes[i]!;
      if (bolt.x + 2 * FP > box.x * FP && bolt.x - 2 * FP < (box.x + WAV_CELL) * FP && bolt.y < (box.y + WAV_CELL) * FP && bolt.y + WAV_BOLT_H * FP > box.y * FP) {
        if (bolt.p) {
          bolt.p -= 1;
          if (bolt.p <= 0) hit = true;
        } else hit = true;
        bolt.h = 1;
        streakHit(s);
        if (code === WAV_ARMOUR_CODE && s.armour) {
          bolt.a = 1;
          s.armour.hp -= 1;
          s.armourHits += 1;
          if (s.armour.hp <= 0) {
            for (let j = 0; j < n; j++) if (s.shapes[j] === WAV_ARMOUR_CODE) s.shapes[j] = 0;
            const ab = wavShapeBox(s, s.armour.row * WAV_COLS + s.armour.col);
            const bx = ab.x + ((s.armour.w - 1) * PITCH_X + WAV_CELL) / 2;
            const by = ab.y + ((s.armour.h - 1) * PITCH_Y + WAV_CELL) / 2;
            s.bursts.push({ x: bx, y: by, t: tick, c: 4 });
            s.armour = null;
          }
          continue;
        }
        s.shapes[i] = 0;
        s.shapesDown += 1;
        s.waveKills += 1;
        s.bursts.push({ x: box.x + WAV_CELL / 2, y: box.y + WAV_CELL / 2, t: tick, c: (code - 1) % 3 });
        if (s.r11) dropCarried(s, i, box.x + WAV_CELL / 2, box.y + WAV_CELL / 2);
      }
    }
    if (!hit) {
      for (const d of s.divers ?? []) {
        if (s.shapes[d.cell] === 0) continue;
        const c = wavDiverCentre(d);
        if (bolt.x + 2 * FP > (c.x - WAV_CELL / 2) * FP && bolt.x - 2 * FP < (c.x + WAV_CELL / 2) * FP && bolt.y < (c.y + WAV_CELL / 2) * FP && bolt.y + WAV_BOLT_H * FP > (c.y - WAV_CELL / 2) * FP) {
          hit = true;
          const code = s.shapes[d.cell]!;
          s.shapes[d.cell] = 0;
          s.shapesDown += 1;
          s.waveKills += 1;
          s.diversDown = (s.diversDown ?? 0) + 1;
          streakHit(s);
          s.bursts.push({ x: c.x, y: c.y, t: tick, c: (code - 1) % 3 });
          if (s.r11) dropCarried(s, d.cell, c.x, c.y);
          break;
        }
      }
    }
    if (!hit && s.boss && !entering && s.boss.hp > 0) {
      const boss = s.boss;
      const w = wavBossW(boss);
      if (bolt.x + 2 * FP > boss.x * FP && bolt.x - 2 * FP < (boss.x + w) * FP && bolt.y < (WAV_BOSS_Y + WAV_BOSS_H) * FP && bolt.y + WAV_BOLT_H * FP > WAV_BOSS_Y * FP) {
        hit = true;
        // A hull hit keeps the streak but does not grow it; a cannon or the open core grows it.
        bolt.h = 1;
        const bx = Math.trunc(bolt.x / FP) - boss.x;
        const guns = boss.guns ?? [0, 0];
        const side = [0, 1].find((k) => guns[k]! > 0 && Math.abs(bx - wavCannonX(boss, k)) <= WAV_X_CANNON_W / 2);
        let dmg = 1;
        if (side !== undefined) {
          // A cannon: its own hit points; the boss takes the usual one too. Nearer its centre pays more.
          streakHit(s);
          s.precise = (s.precise ?? 0) + wavPrecision(Math.abs(bx - wavCannonX(boss, side)));
          guns[side] = guns[side]! - 1;
          if (guns[side]! <= 0) {
            s.cannonsDown = (s.cannonsDown ?? 0) + 1;
            s.bursts.push({ x: boss.x + wavCannonX(boss, side), y: WAV_BOSS_Y + WAV_BOSS_H - 8, t: tick, c: 3 });
          }
          boss.guns = guns;
        } else if (Math.abs(bx - w / 2) <= WAV_X_CORE_W / 2 && wavCoreOpen(boss, tick)) {
          streakHit(s);
          dmg = WAV_X_CORE_DAMAGE;
          s.weakHits = (s.weakHits ?? 0) + 1;
          // wavRev 12: which bosses' cores were hit (scoring only).
          if (s.std) s.coresHit = (s.coresHit ?? 0) | (boss.mid ? 1 : 2);
          s.precise = (s.precise ?? 0) + wavPrecision(Math.abs(bx - w / 2));
        }
        const taken = Math.min(dmg, boss.hp);
        boss.hp -= taken;
        s.bossDmg = (s.bossDmg ?? 0) + taken;
        s.bossHits = (s.bossHits ?? 0) + 1;
        if (boss.hp <= 0) {
          s.bursts.push({ x: boss.x + w / 2, y: WAV_BOSS_Y + WAV_BOSS_H / 2, t: tick, c: 4 });
          if (boss.mid) s.midKilled = 1;
          else s.bossKilled = 1;
        }
      }
    }
    if (!hit && s.saucerDir !== 0) {
      const dx = Math.abs(bolt.x - s.saucerX);
      const dy = Math.abs(bolt.y + 6 * FP - SAUCER_Y * FP);
      if (dx <= (WAV_SAUCER_R + 2) * FP && dy <= (WAV_SAUCER_R + 6) * FP) {
        hit = true;
        s.saucers += 1;
        streakHit(s);
        s.bursts.push({ x: Math.trunc(s.saucerX / FP), y: SAUCER_Y, t: tick, c: 3 });
        // wavRev 11: a saucer shot down drops the purple laser where it fell.
        if (s.r11) s.pickups!.push({ x: clampInt(s.saucerX, WAV_X_DROP_MIN_X * FP, WAV_X_DROP_MAX_X * FP), y: SAUCER_Y * FP, k: WAV_DROP_PIERCE, i: (s.pickupsMade = (s.pickupsMade ?? 0) + 1) });
        s.saucerDir = 0;
        s.saucerX = 0;
      }
    }
    if (!hit) kept.push(bolt);
  }
  s.bolts = kept;

  // Power-up drop: waits its seeded delay, then falls; caught, it gives its kind.
  if (s.drop) {
    if (s.drop.wait > 0) s.drop.wait -= 1;
    else {
      s.drop.y += DROP_SPEED_FP;
      const caught = Math.abs(s.drop.x - s.shipX * FP) < (WAV_SHIP_W / 2 + WAV_DROP_R) * FP && Math.abs(s.drop.y - shipY * FP) < (WAV_SHIP_H / 2 + WAV_DROP_R) * FP;
      if (caught) {
        const k = s.drop.k ?? WAV_DROP_PIERCE;
        if (k === WAV_DROP_SPREAD) s.spread = WAV_X_SPREAD_VOLLEYS;
        else if (k === WAV_DROP_SHIELD) s.shield = WAV_X_SHIELD_TICKS;
        else s.pierce = WAV_PIERCE_SHOTS;
        s.powerups = (s.powerups ?? 0) + 1;
        s.drop = null;
      } else if (s.drop.y > worldH * FP) s.drop = null;
    }
  }
  // wavRev 11: the power-ups falling from carriers and saucers, each caught as the planned ones were.
  if (s.r11 && s.pickups!.length) {
    const falling: WavPickup[] = [];
    for (const p of s.pickups!) {
      p.y += DROP_SPEED_FP;
      if (Math.abs(p.x - s.shipX * FP) < (WAV_SHIP_W / 2 + WAV_DROP_R) * FP && Math.abs(p.y - shipY * FP) < (WAV_SHIP_H / 2 + WAV_DROP_R) * FP) {
        if (p.k === WAV_DROP_SPREAD) s.spread = WAV_X_SPREAD_VOLLEYS;
        else if (p.k === WAV_DROP_SHIELD) s.shield = WAV_X_SHIELD_TICKS;
        else s.pierce = WAV_PIERCE_SHOTS;
        s.powerups = (s.powerups ?? 0) + 1;
      } else if (p.y <= worldH * FP) falling.push(p);
    }
    s.pickups = falling;
  }

  // Enemy fire from the lowest two rows of the formation.
  if (!entering && !s.boss) s.redIn -= 1;
  if (s.redIn <= 0 && !s.boss) {
    const rowOf = (i: number) => (form ? Math.trunc(form[i]![1] / PITCH_Y) : Math.trunc(i / WAV_COLS));
    const colOf = (i: number) => (form ? form[i]![0] : i % WAV_COLS);
    let lowest = -1;
    s.shapes.forEach((code, i) => {
      if (code !== 0) lowest = Math.max(lowest, rowOf(i));
    });
    const shooters: number[] = [];
    s.shapes.forEach((code, i) => {
      if (code !== 0 && code !== WAV_ARMOUR_CODE && !away.has(i) && rowOf(i) >= lowest - 1) shooters.push(i);
    });
    let volley = 1;
    if (s.wave >= DOUBLE_FROM_WAVE) {
      const roll = rngBelow(s.rng, 3);
      s.rng = roll.state;
      if (roll.value === 0) volley = 2;
    }
    let usedCol = -1;
    for (let shot = 0; shot < volley && shooters.length > 0 && s.reds.length < MAX_RED; shot++) {
      const pool = shooters.filter((i) => colOf(i) !== usedCol);
      if (pool.length === 0) break;
      const pick = rngBelow(s.rng, pool.length);
      s.rng = pick.state;
      const index = pool[pick.value] ?? 0;
      usedCol = colOf(index);
      const box = wavShapeBox(s, index);
      s.reds.push({ x: (box.x + WAV_CELL / 2) * FP, y: (box.y + WAV_CELL) * FP });
    }
    s.redIn = Math.max(RED_MIN, s.redBase - Math.trunc((s.redBase * tick) / (2 * runTicks)));
  }
  const redsKept: WavBolt[] = [];
  for (const red of s.reds) {
    red.y += s.redSpeed;
    if (red.y > worldH * FP) continue;
    const overlaps = Math.abs(red.x - s.shipX * FP) < (WAV_SHIP_W / 2 + 2) * FP && red.y + WAV_BOLT_H * FP >= (shipY - WAV_SHIP_H / 2) * FP && red.y <= (shipY + WAV_SHIP_H / 2) * FP;
    if (overlaps) {
      shipHit(s);
      continue;
    }
    redsKept.push(red);
  }
  s.reds = redsKept;

  // The gunship down: it counts as a wave, and wave 4 flies in.
  const midDown = Boolean(s.boss?.mid) && (s.boss?.hp ?? 1) <= 0;
  if (midDown) {
    s.boss = null;
    s.wavesCleared += 1;
  }
  // Wave cleared: the gunship after wave 3, the next formation, or the mothership after the last.
  if (!s.boss && (midDown || s.shapes.every((code) => code === 0))) {
    if (!midDown) {
      s.wavesCleared += 1;
      s.wave += 1;
      s.waveBase = Math.max(WAV_STEP_MIN, Math.trunc((s.waveBase * 85) / 100));
      s.redBase = Math.max(RED_MIN, Math.trunc((s.redBase * 80) / 100));
      s.redSpeed = Math.min(WAV_X_RED_CAP, Math.trunc((s.redSpeed * 115) / 100));
    }
    s.divers = [];
    s.diveIn = wavDiveEvery(s.wave);
    s.enter = WAV_BREATHER_TICKS;
    s.armour = null;
    s.waveKills = 0;
    s.stepIn = stepEvery(s);
    s.redIn = s.redBase;
    if (s.r11) s.carry = s.shapes.map(() => -1);
    if (!midDown && s.wave === WAV_X_MID_AFTER + 1 && !s.midKilled) {
      s.shapes = s.shapes.map(() => 0);
      s.boss = bossX(true, WAV_X_MID_HP, tick);
    } else if (s.wave > wavWaves(s)) {
      s.shapes = s.shapes.map(() => 0);
      s.boss = bossX(false, WAV_X_BOSS_HP, tick);
      s.bossAt = tick;
    } else {
      // The wave's ships from its own seeded stream (the same for every player, whenever it arrives).
      s.shapes = waveShapes(s.seed ?? 0, s.wave);
      const [cells, hp] = WAV_ARMOUR_BY_WAVE[Math.min(s.wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
      for (let i = 0; i < cells; i++) s.shapes[i] = WAV_ARMOUR_CODE;
      s.armour = { col: 0, row: 0, w: cells / 2, h: 2, hp, maxHp: hp };
      if (s.r11) s.carry = wavCarriers(s.seed ?? 0, s.wave, cells);
      const size = wavFormSizeX(s.wave);
      s.fx = Math.trunc((WAV_WORLD_W - size.w) / 2);
      s.fyTarget = START_Y + (s.wave - 2) * WAV_FORM_STEP_Y;
      s.fy = s.fyTarget - ENTRY_DIST;
      s.dir = 1;
    }
  }

  // wavRev 10: the mothership arrives by WAV_X_BOSS_BY on the run clock at the latest (sooner when wave 5 falls
  // sooner): whatever is left of the formations, or the gunship, leaves, so every player has its weak points.
  // wavRev 11: never early; the mothership comes only once wave 5 (the last before it) is destroyed.
  if (s.x10 && !s.r11 && tick === WAV_X_BOSS_BY && !s.bossAt && !s.bossKilled) {
    s.shapes = s.shapes.map(() => 0);
    s.divers = [];
    s.armour = null;
    s.waveKills = 0;
    s.wave = wavWaves(s) + 1;
    s.enter = WAV_BREATHER_TICKS;
    s.redIn = s.redBase;
    s.boss = bossX(false, WAV_X_BOSS_HP, tick);
    s.bossAt = tick;
  }

  // Reached the ship's line?
  let lowest = -1;
  const shapedForm = wavForm(s);
  s.shapes.forEach((code, i) => {
    if (code !== 0) lowest = Math.max(lowest, shapedForm ? shapedForm[i]![1] : Math.trunc(i / WAV_COLS) * PITCH_Y);
  });
  const reached = lowest >= 0 && s.fy + lowest + WAV_CELL >= shipY - WAV_SHIP_H / 2;
  if (s.lives <= 0 || reached) {
    s.lives = Math.max(0, s.lives);
    s.ended = 2;
    s.endedTick = tick;
  } else if (s.bossKilled) {
    s.ended = 1;
    s.endedTick = tick;
  } else if (tick >= runTicks) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** wavRev 10: a shaped wave's extent with its escorts. */
export function wavFormSizeX(wave: number): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const [x, y] of WAV_FORMS_X[wave]!) {
    w = Math.max(w, x + WAV_CELL);
    h = Math.max(h, y + WAV_CELL);
  }
  return { w, h };
}

/** wavRev 10: a perfect run's base units: every ship, armour hit and wave (the gunship one too), every boss hit point. */
export const WAV_PAR_X = (() => {
  let raw = 0;
  for (let wave = 1; wave <= WAV_V5_WAVES; wave++) {
    raw += WAV_X_SHAPES + WAV_POINTS_WAVE;
    if (wave >= 2) {
      const [cells, hits] = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
      raw += hits - cells;
    }
  }
  return raw + WAV_POINTS_WAVE + WAV_X_MID_HP + WAV_X_BOSS_HP;
})();
/**
 * wavRev 10 knots on the base units (WAV_PAR_X = 140), fitted with the skill-band bots
 * (docs/expansions/x200-wavefront.md) so today's players land where they did on wavRev 8.
 */
export const WAV_V10_BAND_CURVE = bandCurve([0, 250, 270, 290, 300, 310, 318, 326, WAV_PAR_X], [0, 53, 55, 55, 67, 107, 126, 140, 140]);
/**
 * wavRev 10 skill points (the features' raw points, `wavSkillRaw`): the streak's points (capped at
 * WAV_X_STREAK_CAP), WAV_X_SKILL_DROP a power-up caught, WAV_X_SKILL_SAUCER a saucer, WAV_X_SKILL_CANNON a
 * cannon destroyed and WAV_X_SKILL_CORE a hit on an open core. Every one of them is dealt on the seeded plan or
 * the fixed waves, the same count every run.
 */
export const WAV_X_STREAK_CAP = 40;
export const WAV_X_SKILL_DROP = 2;
export const WAV_X_SKILL_SAUCER = 3;
export const WAV_X_SKILL_CANNON = 8;
export const WAV_X_SKILL_CORE = 2;
export const WAV_X_SKILL_PRECISE = 2;
export function wavSkillRaw(s: WavState): number {
  return (
    Math.min(WAV_X_STREAK_CAP, s.streakPts ?? 0) +
    WAV_X_SKILL_DROP * (s.powerups ?? 0) +
    WAV_X_SKILL_SAUCER * s.saucers +
    WAV_X_SKILL_CANNON * (s.cannonsDown ?? 0) +
    WAV_X_SKILL_CORE * (s.weakHits ?? 0) +
    WAV_X_SKILL_PRECISE * (s.precise ?? 0)
  );
}
/** The skill points paid on a rising scale: little for incidental use, the full 50 only for elite play. */
export const WAV_X_SKILL_PAY = bandCurve([0, 120, 150, 170, 185, 200, 212, 225], [0, 0, 18, 20, 37, 37, 48, 50]);
export const WAV_X_EDGE_MAX = 50;
/** wavRev 10's round maximum (ROUND_MAX's wavefront line; the sim keeps its own figure). */
export const WAV_X_MAX = 200;
export function wavSkillPaid(s: WavState): number {
  return Math.min(WAV_X_EDGE_MAX, bandPoints(WAV_X_SKILL_PAY, wavSkillRaw(s)));
}

/** wavRev 10's breakdown: the base units on WAV_V10_BAND_CURVE, the kill's speed bonus and the paid skill points. */
export function wavefrontExpandParts(state: WavState): BandParts {
  // Saucers are a feature on wavRev 10 (skill points), not base units.
  const units = state.shapesDown + state.armourHits + WAV_POINTS_WAVE * state.wavesCleared + (state.bossDmg ?? 0);
  const finished = (state.bossKilled ?? 0) > 0;
  const fight = state.tick - (state.bossAt ?? 0);
  const kill = finished ? speedBonusCurve(BAND_FINISH_BONUS, clampInt(WAV_KILL_WINDOW_V5 - fight, 0, WAV_KILL_WINDOW_V5), WAV_KILL_WINDOW_V5) : 0;
  const skill = wavSkillPaid(state);
  return {
    units,
    points: bandPoints(WAV_V10_BAND_CURVE, units),
    bonus: kill + skill,
    penalty: 0,
    finished,
    text: `${state.wavesCleared} waves · ${state.shapesDown} ships · ${state.saucers} saucers · ${state.bossDmg ?? 0} boss damage`,
    bonusText: finished ? `Boss destroyed (+${kill}) · streaks, weak points, saucers and power-ups` : "Streaks, weak points, saucers and power-ups",
  };
}

export const wavefrontExpandGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontGameV2,
  init: initX,
  step: bandStep(stepX),
};

/* ================= Joe's phone notes (wavRev 11, 27 Oct 2026) ================= */

/**
 * wavRev 11 (docs/phone-notes-oct-2026/wavefront.md): wavRev 10's world, waves, bosses and weak points, with:
 *  - power-ups carried by ships: each formation wave has WAV_R11_CARRIERS carriers (one SPREAD, one SHIELD), its
 *    slots and order drawn at the wave's start from the seed's own stream for that wave (wavCarriers), so the same
 *    ship carries the same power-up for every player; shot down, a carrier drops it where it fell (a carrier that
 *    rams the ship takes it with it). Nothing falls from the top;
 *  - a saucer shot down drops the purple laser (the piercing shot);
 *  - no hit streak and no multiplier;
 *  - the mothership only once wave 5 is destroyed (no 78 s arrival);
 *  - higher scores: base units on WAV_V11_BAND_CURVE, skill points (no streak) on WAV_R11_SKILL_PAY.
 * States carry `r11: 1` (with `x10: 1`), folded into the checkpoint last.
 */
export const WAV_REV_PHONE = 11;
/** wavRev 11: carriers in each formation wave (one of each kind, WAV_DROP_SPREAD and WAV_DROP_SHIELD). */
export const WAV_R11_CARRIERS = 2;

/**
 * wavRev 11: wave `wave`'s carriers, from the seed's own stream for that wave (independent of play): an array over
 * the wave's slots, -1 or the power-up the ship in that slot carries. Armour slots (the first `skip`) carry none.
 */
export function wavCarriers(seed: number, wave: number, skip = 0): number[] {
  const carry = Array.from({ length: WAV_X_SHAPES }, () => -1);
  let r = planStream(seed, 30 + wave);
  const order = rngBelow(r, 2);
  r = order.state;
  const kinds = order.value === 0 ? [WAV_DROP_SPREAD, WAV_DROP_SHIELD] : [WAV_DROP_SHIELD, WAV_DROP_SPREAD];
  for (let k = 0; k < WAV_R11_CARRIERS; k++) {
    let pick = rngBelow(r, WAV_X_SHAPES - skip);
    r = pick.state;
    while (carry[skip + pick.value] !== -1) {
      pick = rngBelow(r, WAV_X_SHAPES - skip);
      r = pick.state;
    }
    carry[skip + pick.value] = kinds[k % kinds.length]!;
  }
  return carry;
}

/** wavRev 11: the ship in `cell` was shot down at (x, y): its power-up, if it carried one, starts to fall. */
function dropCarried(s: WavState, cell: number, x: number, y: number): void {
  const k = s.carry?.[cell] ?? -1;
  if (k < 0) return;
  s.carry![cell] = -1;
  s.pickupsMade = (s.pickupsMade ?? 0) + 1;
  s.pickups!.push({ x: x * FP, y: y * FP, k, i: s.pickupsMade });
}

function initR11(seed: number): WavState {
  return { ...initX(seed), r11: 1, carry: wavCarriers(seed, 1), pickups: [], pickupsMade: 0 };
}

/**
 * wavRev 11's base curve on wavRev 10's base units (WAV_PAR_X = 330 for everything; 140 points): a steady rise in
 * place of wavRev 10's flat 250–300 (53–67), so a run that clears most of the waves scores clearly more; the last
 * 30 points are the mothership's final hit points. Fitted with the band bots on the tuning seeds
 * (docs/phone-notes-oct-2026/wavefront.md).
 */
export const WAV_V11_BAND_CURVE = bandCurve([0, 100, 200, 250, 290, 310, 324, WAV_PAR_X], [0, 28, 55, 70, 86, 96, 110, 140]);
/** wavRev 11's skill pay on its skill points (no streak): little for incidental play, the full 50 near a flawless run. */
export const WAV_R11_SKILL_PAY = bandCurve([0, 50, 90, 120, 150, 180], [0, 3, 10, 20, 34, 50]);
export function wavSkillRawR11(s: WavState): number {
  return WAV_X_SKILL_DROP * (s.powerups ?? 0) + WAV_X_SKILL_SAUCER * s.saucers + WAV_X_SKILL_CANNON * (s.cannonsDown ?? 0) + WAV_X_SKILL_CORE * (s.weakHits ?? 0) + WAV_X_SKILL_PRECISE * (s.precise ?? 0);
}
export function wavSkillPaidR11(s: WavState): number {
  return Math.min(WAV_X_EDGE_MAX, bandPoints(WAV_R11_SKILL_PAY, wavSkillRawR11(s)));
}

/** wavRev 11's breakdown: the base units on WAV_V11_BAND_CURVE, the kill's speed bonus and the paid skill points. */
export function wavefrontPhoneParts(state: WavState): BandParts {
  const units = state.shapesDown + state.armourHits + WAV_POINTS_WAVE * state.wavesCleared + (state.bossDmg ?? 0);
  const finished = (state.bossKilled ?? 0) > 0;
  const fight = state.tick - (state.bossAt ?? 0);
  const kill = finished ? speedBonusCurve(BAND_FINISH_BONUS, clampInt(WAV_KILL_WINDOW_V5 - fight, 0, WAV_KILL_WINDOW_V5), WAV_KILL_WINDOW_V5) : 0;
  const skill = wavSkillPaidR11(state);
  return {
    units,
    points: bandPoints(WAV_V11_BAND_CURVE, units),
    bonus: kill + skill,
    penalty: 0,
    finished,
    text: `${state.wavesCleared} waves · ${state.shapesDown} ships · ${state.saucers} saucers · ${state.bossDmg ?? 0} boss damage`,
    bonusText: finished ? `Boss destroyed (+${kill}) · weak points, saucers and power-ups` : "Weak points, saucers and power-ups",
  };
}

export const wavefrontPhoneGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontGameV2,
  init: initR11,
  step: bandStep(stepX),
};

/* ================= The arcade scoring standard (wavRev 12, 29 Oct 2026) ================= */

/**
 * wavRev 12 (the arcade scoring standard, docs/arcade-standard/wavefront.md; src/lib/arcade/arcadeStandard.ts):
 * wavRev 11's play exactly (a wavRev 11 log replays tick for tick; states add `std: 1` and the cores hit, outside the
 * checkpoint checksum), scored in fixed parts that total 200:
 *  - core, up to 150 on a straight line: ships shot, armour hits, 15 a cleared wave (the gunship counts as one) and
 *    the gunship's hit points, full at WAV_STD_CORE_FULL, everything before the mothership (WAV_PAR_X less its hit points);
 *  - Boss destroyed 10, and Boss speed up to 10 (only with the boss destroyed: full within 20 s of its arrival, 0 at
 *    40 s, a straight line between);
 *  - Saucers up to 20: 4 a saucer of the WAV_X_SAUCERS (5) the 90 s clock flies. A run that ends by destroying the
 *    boss is credited the saucers its clock would still have flown (it can no longer meet them), so a quick kill never
 *    costs saucers; a run lost or timed out is not;
 *  - Cannons and weak points up to 10: equal shares of the six the run offers, each boss's two cannons destroyed and
 *    each boss's open core hit (at least once);
 *  - power-ups pay nothing; each life lost costs WAV_STD_LIFE_COST. Anyone who plays scores at least 1.
 */
export const WAV_REV_STD = 12;
/** The core's full figure: every unit before the mothership (all five waves, the gunship and its hit points; 294). */
export const WAV_STD_CORE_FULL = WAV_PAR_X - WAV_X_BOSS_HP;
export const WAV_STD_CORE_MAX = 150;
/** The weak points a run offers: two cannons and a core on each of the two bosses. */
export const WAV_STD_WEAK_POINTS = 6;
/** The boss's speed part: full within this many ticks of its arrival, 0 at the second. */
export const WAV_STD_KILL_FULL = 20 * TICKS_PER_SECOND;
export const WAV_STD_KILL_ZERO = 40 * TICKS_PER_SECOND;
export const WAV_STD_LIFE_COST = 5;
export const WAVEFRONT_STD: StdSpec = {
  core: { key: "core", label: "Ships, hits and waves", max: WAV_STD_CORE_MAX, of: WAV_STD_CORE_FULL, item: "unit" },
  features: [
    { key: "boss", label: "Boss destroyed", max: 10, of: 1 },
    { key: "speed", label: "Boss speed", max: 10, of: 1 },
    { key: "saucers", label: "Saucers", max: 20, of: WAV_X_SAUCERS, item: "saucer" },
    { key: "weak", label: "Cannons and weak points", max: 10, of: WAV_STD_WEAK_POINTS, items: "cannons and cores" },
  ],
};
/** wavRev 12's core on a straight line: 150 at WAV_STD_CORE_FULL units (arcade-help-bands-check reads the newest curve). */
export const WAV_V12_BAND_CURVE = bandCurve([0, WAV_STD_CORE_FULL], [0, WAV_STD_CORE_MAX]);

/** wavRev 12's core units: ships, armour hits, 15 a cleared wave and the gunship's hit points (never the mothership's). */
export function wavStdUnits(s: WavState): number {
  return s.shapesDown + s.armourHits + WAV_POINTS_WAVE * s.wavesCleared + Math.min(s.bossDmg ?? 0, WAV_X_MID_HP);
}
/** wavRev 12: saucers the run's clock had flown by its end (one every WAV_SAUCER_EVERY ticks, WAV_X_SAUCERS at most). */
export function wavStdSaucersFlown(s: WavState): number {
  return Math.min(WAV_X_SAUCERS, Math.trunc(s.tick / SAUCER_EVERY));
}
/** wavRev 12: the saucers counted: those shot, plus on a run ended by the boss's kill the ones still to come. */
export function wavStdSaucers(s: WavState): number {
  return s.saucers + ((s.bossKilled ?? 0) > 0 ? WAV_X_SAUCERS - wavStdSaucersFlown(s) : 0);
}
/** wavRev 12: weak points taken: cannons destroyed and bosses whose open core was hit. */
export function wavStdWeakPoints(s: WavState): number {
  const cores = s.coresHit ?? 0;
  return (s.cannonsDown ?? 0) + (cores & 1) + ((cores >> 1) & 1);
}
/** wavRev 12's breakdown in the standard's parts. */
export function wavStdScore(s: WavState): StdScore {
  const killed = (s.bossKilled ?? 0) > 0;
  const fight = s.tick - (s.bossAt ?? 0);
  return {
    core: stdLine(WAV_STD_CORE_MAX, wavStdUnits(s), WAV_STD_CORE_FULL),
    features: {
      boss: killed ? 10 : 0,
      speed: killed ? stdSpeed(10, fight, WAV_STD_KILL_FULL, WAV_STD_KILL_ZERO) : 0,
      saucers: stdLine(20, wavStdSaucers(s), WAV_X_SAUCERS),
      weak: stdLine(10, wavStdWeakPoints(s), WAV_STD_WEAK_POINTS),
    },
    penalty: WAV_STD_LIFE_COST * Math.max(0, WAV_LIVES - Math.max(0, s.lives)),
  };
}
/** wavRev 12's reveal and band breakdown. */
export function wavefrontStdParts(state: WavState): BandParts {
  const lost = Math.max(0, WAV_LIVES - Math.max(0, state.lives));
  return stdBandParts(
    WAVEFRONT_STD,
    wavStdScore(state),
    wavStdUnits(state),
    `${state.wavesCleared} waves · ${state.shapesDown} ships · ${state.armourHits} armour hits · gunship ${Math.min(state.bossDmg ?? 0, WAV_X_MID_HP)}/${WAV_X_MID_HP}`,
    (state.bossKilled ?? 0) > 0,
    `${lost} ${lost === 1 ? "life" : "lives"} lost`,
  );
}

function initStd(seed: number): WavState {
  return { ...initR11(seed), std: 1, coresHit: 0 };
}

export const wavefrontStdGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontGameV2,
  init: initStd,
  step: bandStep(stepX),
};
