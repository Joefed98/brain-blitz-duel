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

/* ============================== Constants ============================== */

const FP = 256;
export const WAV_WORLD_W = 390;
export const WAV_WORLD_H = 620;
export const WAV_HUD_H = 44;

export const WAV_RUN_SECONDS = 60;
export const WAV_RUN_TICKS = WAV_RUN_SECONDS * TICKS_PER_SECOND;

export const WAV_SHIP_Y = 566;
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

export const WAV_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, WAV_WORLD_W]),
];

/* ================================ State ================================ */

export interface WavBolt {
  x: number;
  y: number;
}

export interface WavBurst {
  x: number;
  y: number;
  t: number;
  c: number;
}

export interface WavState {
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
  /** Render only. */
  bursts: WavBurst[];
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
    bursts: [],
  };
}

function isOver(state: WavState): boolean {
  return state.ended !== 0;
}

export function wavShapeBox(state: WavState, index: number): { x: number; y: number } {
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
    bursts: state.bursts.filter((b) => tick - b.t < 24),
  };
  if (input && input.k === ARCADE_INPUT_DRAG) s.aimX = clampInt(input.a, 0, WAV_WORLD_W);
  s.shipX = clampInt(s.aimX, SHIP_MIN_X, SHIP_MAX_X);
  if (s.invuln > 0) s.invuln -= 1;

  // Formation march.
  s.stepIn -= 1;
  if (s.stepIn <= 0) {
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
      const left = nextX + lc * PITCH_X;
      const right = nextX + rc * PITCH_X + WAV_CELL;
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
    s.bolts.push({ x: s.shipX * FP, y: (WAV_SHIP_Y - 14 - WAV_BOLT_H) * FP });
    s.fireIn = WAV_FIRE_EVERY;
  }

  // Saucer.
  if (tick % SAUCER_EVERY === 0 && tick < WAV_RUN_TICKS && s.saucerDir === 0) {
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
      if (code === 0) continue;
      const box = wavShapeBox(s, i);
      if (
        bolt.x + 2 * FP > box.x * FP &&
        bolt.x - 2 * FP < (box.x + WAV_CELL) * FP &&
        bolt.y < (box.y + WAV_CELL) * FP &&
        bolt.y + WAV_BOLT_H * FP > box.y * FP
      ) {
        hit = true;
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
    if (!hit && s.saucerDir !== 0) {
      const dx = Math.abs(bolt.x - s.saucerX);
      const dy = Math.abs(bolt.y + 6 * FP - SAUCER_Y * FP);
      if (dx <= (WAV_SAUCER_R + 2) * FP && dy <= (WAV_SAUCER_R + 6) * FP) {
        hit = true;
        s.saucers += 1;
        s.bursts.push({ x: Math.trunc(s.saucerX / FP), y: SAUCER_Y, t: tick, c: 3 });
        s.saucerDir = 0;
        s.saucerX = 0;
      }
    }
    if (!hit) kept.push(bolt);
  }
  s.bolts = kept;

  // Enemy fire from any shape in the lowest two occupied rows, chosen from the seed.
  s.redIn -= 1;
  if (s.redIn <= 0) {
    let lowest = -1;
    s.shapes.forEach((code, i) => {
      if (code !== 0) lowest = Math.max(lowest, Math.trunc(i / WAV_COLS));
    });
    const shooters: number[] = [];
    s.shapes.forEach((code, i) => {
      if (code !== 0 && Math.trunc(i / WAV_COLS) >= lowest - 1) shooters.push(i);
    });
    let volley = 1;
    if (s.wave >= DOUBLE_FROM_WAVE) {
      const roll = rngBelow(s.rng, 3);
      s.rng = roll.state;
      if (roll.value === 0) volley = 2;
    }
    let usedCol = -1;
    for (let shot = 0; shot < volley && shooters.length > 0 && s.reds.length < MAX_RED; shot++) {
      const pool = shooters.filter((i) => i % WAV_COLS !== usedCol);
      if (pool.length === 0) break;
      const pick = rngBelow(s.rng, pool.length);
      s.rng = pick.state;
      const index = pool[pick.value] ?? 0;
      usedCol = index % WAV_COLS;
      const box = wavShapeBox(s, index);
      s.reds.push({ x: (box.x + WAV_CELL / 2) * FP, y: (box.y + WAV_CELL) * FP });
    }
    s.redIn = Math.max(RED_MIN, s.redBase - Math.trunc((s.redBase * tick) / (2 * WAV_RUN_TICKS)));
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

  // Wave cleared.
  if (s.shapes.every((code) => code === 0)) {
    s.wavesCleared += 1;
    s.wave += 1;
    const next = newShapes(s.rng);
    s.rng = next.rng;
    s.shapes = next.shapes;
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
  s.shapes.forEach((code, i) => {
    if (code !== 0) lowest = Math.max(lowest, Math.trunc(i / WAV_COLS));
  });
  const reached = lowest >= 0 && s.fy + lowest * PITCH_Y + WAV_CELL >= WAV_SHIP_Y - WAV_SHIP_H / 2;

  if (s.lives <= 0 || reached) {
    s.lives = Math.max(0, s.lives);
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= WAV_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

export function wavScoreOf(shapesDown: number, saucers: number, waves: number): number {
  return clampInt(shapesDown + WAV_POINTS_SAUCER * saucers + WAV_POINTS_WAVE * waves, 0, 150);
}

function score(state: WavState): number {
  return wavScoreOf(state.shapesDown, state.saucers, state.wavesCleared);
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
    alive: state.shapes.reduce((n, code) => (code ? n + 1 : n), 0),
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  for (const b of [...state.bolts, ...state.reds]) {
    checksum ^= (b.x ^ Math.imul(b.y, 31)) | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
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
    if (code === 0) return;
    const box = wavShapeBox(state, i);
    const kind = Math.trunc((code - 1) / 3);
    const colour = WAV_COLOURS[(code - 1) % 3] ?? WAV_COLOURS[0]!;
    drawWavShape(ctx, kind, colour, box.x + WAV_CELL / 2, box.y + WAV_CELL / 2, WAV_CELL);
  });

  if (state.saucerDir !== 0) {
    ctx.strokeStyle = WAV_PURPLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(state.saucerX / FP, SAUCER_Y, WAV_SAUCER_R + 4, WAV_SAUCER_R - 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = WAV_GOLD;
  for (const b of state.bolts) ctx.fillRect(b.x / FP - WAV_BOLT_W / 2, b.y / FP, WAV_BOLT_W, WAV_BOLT_H);
  ctx.fillStyle = WAV_RED;
  for (const b of state.reds) ctx.fillRect(b.x / FP - WAV_BOLT_W / 2, b.y / FP, WAV_BOLT_W, WAV_BOLT_H);

  drawBursts(ctx, state.bursts, state.tick, [...WAV_COLOURS, WAV_PURPLE]);

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
  step,
  isOver,
  score,
  draw,
  inputRanges: WAV_INPUT_RANGES,
};
