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
  ARCADE_INPUT_DRAG,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
import { isin, TRIG_ONE } from "./trig";

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
/** Formation waves before the boss. */
export const WAV_V2_WAVES = 5;
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
        s.fy += PITCH_Y;
        s.dir = -s.dir;
      } else s.fx = nextX;
    }
    s.stepIn = stepEvery(s);
  }

  // Ship fire.
  if (s.fireIn > 0) s.fireIn -= 1;
  if (s.fireIn <= 0 && s.bolts.length < WAV_MAX_BOLTS) {
    const bolt: WavBolt = { x: s.shipX * FP, y: (WAV_SHIP_Y - 14 - WAV_BOLT_H) * FP };
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
        const exitY = (WAV_WORLD_H + WAV_CELL) * FP;
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
        Math.abs(c.y - WAV_SHIP_Y) < (WAV_SHIP_H + WAV_CELL) / 2
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
    bolt.y -= BOLT_SPEED_FP;
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
        Math.abs(s.drop.y - WAV_SHIP_Y * FP) < (WAV_SHIP_H / 2 + WAV_DROP_R) * FP;
      if (caught) {
        s.pierce = WAV_PIERCE_SHOTS;
        s.drop = null;
      } else if (s.drop.y > WAV_WORLD_H * FP) s.drop = null;
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
    if (red.y > WAV_WORLD_H * FP) continue;
    const overlaps =
      Math.abs(red.x - s.shipX * FP) < (WAV_SHIP_W / 2 + 2) * FP &&
      red.y + WAV_BOLT_H * FP >= (WAV_SHIP_Y - WAV_SHIP_H / 2) * FP &&
      red.y <= (WAV_SHIP_Y + WAV_SHIP_H / 2) * FP;
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
    if (s.wave > WAV_V2_WAVES) {
      // The boss: the formation grid stays empty from here on.
      s.boss = { x: Math.trunc((WAV_WORLD_W - WAV_BOSS_W) / 2), dir: 1, hp: WAV_BOSS_HP, fireIn: WAV_BOSS_FIRE_EVERY };
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
  const reached = lowest >= 0 && s.fy + lowest + WAV_CELL >= WAV_SHIP_Y - WAV_SHIP_H / 2;

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
  const scale = Math.min(size.width / WAV_WORLD_W, size.height / WAV_WORLD_H);
  const ox = (size.width - WAV_WORLD_W * scale) / 2;
  const oy = (size.height - WAV_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = WAV_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawStars(ctx, WAV_WORLD_W, WAV_WORLD_H, 91);

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
  if (!flashing && state.ended !== 2) drawWavShip(ctx, state.shipX, WAV_SHIP_Y, WAV_SHIP_W);
  if (state.ended === 2) {
    ctx.globalAlpha = 0.4;
    drawWavShip(ctx, state.shipX, WAV_SHIP_Y, WAV_SHIP_W);
    ctx.globalAlpha = 1;
  }

  // Drag zone hint.
  ctx.strokeStyle = "rgba(245,184,46,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, WAV_DRAG_ZONE_TOP);
  ctx.lineTo(WAV_WORLD_W - 8, WAV_DRAG_ZONE_TOP);
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
  const units = state.shapesDown + state.armourHits + WAV_POINTS_SAUCER * state.saucers + WAV_POINTS_WAVE * state.wavesCleared + (state.bossHits ?? 0);
  const finished = (state.bossKilled ?? 0) > 0;
  return { units, points: bandPoints(WAV_BAND_CURVE, units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${state.wavesCleared} waves · ${state.shapesDown} ships · ${state.saucers} saucers · ${state.bossHits ?? 0} boss hits`, bonusText: "Boss destroyed" };
}

function scoreBand(state: WavState): number {
  return bandTotal(wavefrontBandParts(state), Boolean(state.acted));
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
export function wavForm(state: { shaped?: number; wave: number }): readonly (readonly [number, number])[] | null {
  if (!state.shaped || state.wave < 2 || state.wave > WAV_V2_WAVES) return null;
  return WAV_FORMS[state.wave] ?? null;
}

export const wavefrontShapesGame: ArcadeGame<WavState, ArcadeInputEvent | null> = {
  ...wavefrontBandGame,
  init: (seed) => ({ ...wavefrontBandGame.init(seed), shaped: 1 }),
};
