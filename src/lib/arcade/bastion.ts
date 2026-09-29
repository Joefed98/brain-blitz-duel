/**
 * Bastion — an arcade game on the shared engine.
 *
 * A turret at the bottom centre aims at the finger and fires while it is held.
 * Shapes descend from the top and sides on a seeded schedule toward the base
 * line. The barrel angle is one of 65 fixed directions from an integer lookup
 * table, so no trigonometry runs in the sim; all positions are 1/256 px.
 */

import {
  clampInt,
  inputRange,
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

const FP = 256;
export const BAS_WORLD_W = 390;
export const BAS_WORLD_H = 620;
export const BAS_HUD_H = 44;

export const BAS_RUN_SECONDS = 60;
export const BAS_RUN_TICKS = BAS_RUN_SECONDS * TICKS_PER_SECOND;

export const BAS_BASE_Y = 540;
export const BAS_TURRET_X = 195;
export const BAS_TURRET_Y = 566;
export const BAS_BARREL = 30;
export const BAS_HEALTH = 5;

export const BAS_FIRE_EVERY = 10;
/** Barrel angle in 1/256 table steps; one step = 180° / 64 = 2.8125°. */
export const BAS_STEP_DEG_X256 = 720;
/** Max barrel follow: 6° a tick. */
const MAX_TURN_FP = Math.trunc((6 * 256 * 256) / BAS_STEP_DEG_X256);
const BOLT_SPEED = 7;
const MAX_BOLTS = 16;
const BOLT_R = 3;

const SPAWN_START = 72;
const SPAWN_END = 30;
const SPEED_START_FP = 200;
const SPEED_STEP_TICKS = 15 * TICKS_PER_SECOND;

export const BAS_CIRCLE = 0;
export const BAS_SQUARE = 1;
export const BAS_TRIANGLE = 2;
export const BAS_SMALL = 3;
/** Collision/draw radius per kind, in px. */
export const BAS_RADIUS = [12, 15, 16, 9] as const;

export const BAS_FULL_BONUS = 20;
export const BAS_SURVIVE_BONUS = 10;

/** 65 barrel directions from pointing left, through straight up, to right; ×256. */
export const BAS_DIRS: readonly (readonly [number, number])[] = [
  [-256, 0], [-256, -13], [-255, -25], [-253, -38], [-251, -50], [-248, -62], [-245, -74],
  [-241, -86], [-237, -98], [-231, -109], [-226, -121], [-220, -132], [-213, -142], [-206, -152],
  [-198, -162], [-190, -172], [-181, -181], [-172, -190], [-162, -198], [-152, -206],
  [-142, -213], [-132, -220], [-121, -226], [-109, -231], [-98, -237], [-86, -241], [-74, -245],
  [-62, -248], [-50, -251], [-38, -253], [-25, -255], [-13, -256], [0, -256], [13, -256],
  [25, -255], [38, -253], [50, -251], [62, -248], [74, -245], [86, -241], [98, -237],
  [109, -231], [121, -226], [132, -220], [142, -213], [152, -206], [162, -198], [172, -190],
  [181, -181], [190, -172], [198, -162], [206, -152], [213, -142], [220, -132], [226, -121],
  [231, -109], [237, -98], [241, -86], [245, -74], [248, -62], [251, -50], [253, -38],
  [255, -25], [256, -13], [256, 0],
];
const UP = 32;

/** k = 7: a = x, b = y, c = 1 while the finger is down. */
export const BAS_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, BAS_WORLD_W], [0, BAS_WORLD_H], [0, 1]),
];

/* ================================ State ================================ */

export interface BasShape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: number;
  hp: number;
  flash: number;
}

export interface BasBolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BasBurst {
  x: number;
  y: number;
  t: number;
  c: number;
}

export interface BasState {
  tick: number;
  rng: number;
  aimX: number;
  aimY: number;
  held: number;
  angle: number;
  /** Barrel angle ×256 in table steps (the sim's true angle). */
  angleFp: number;
  fireIn: number;
  spawnIn: number;
  shapes: BasShape[];
  bolts: BasBolt[];
  big: number;
  small: number;
  health: number;
  spawned: number;
  /** 0 running, 1 survived, 2 base fell. */
  ended: number;
  endedTick: number;
  /** Render only. */
  bursts: BasBurst[];
}

export function basSpeedFp(tick: number): number {
  let speed = SPEED_START_FP;
  for (let i = Math.trunc(tick / SPEED_STEP_TICKS); i > 0; i--) speed = Math.trunc((speed * 11) / 10);
  return speed;
}

function spawnGap(tick: number): number {
  return SPAWN_START - Math.trunc(((SPAWN_START - SPAWN_END) * tick) / BAS_RUN_TICKS);
}

function init(seed: number): BasState {
  return {
    tick: 0,
    rng: seed | 0,
    aimX: BAS_TURRET_X,
    aimY: 0,
    held: 0,
    angle: UP,
    angleFp: UP * 256,
    fireIn: 0,
    spawnIn: 30,
    shapes: [],
    bolts: [],
    big: 0,
    small: 0,
    health: BAS_HEALTH,
    spawned: 0,
    ended: 0,
    endedTick: 0,
    bursts: [],
  };
}

function isOver(state: BasState): boolean {
  return state.ended !== 0;
}

/** The table direction closest to (dx, dy), by integer dot product. */
export function basAngleFor(dx: number, dy: number, fallback: number): number {
  if (dx === 0 && dy === 0) return fallback;
  let best = fallback;
  let bestDot = -Infinity;
  for (let i = 0; i < BAS_DIRS.length; i++) {
    const dir = BAS_DIRS[i]!;
    const dot = dir[0] * dx + dir[1] * dy;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  return best;
}

function next(rng: number, bound: number): { rng: number; v: number } {
  const draw = rngBelow(rng, bound);
  return { rng: draw.state, v: draw.value };
}

function spawn(s: BasState): void {
  let r = next(s.rng, 5);
  const side = r.v; // 0–2 top, 3 left, 4 right
  let x: number;
  let y: number;
  if (side <= 2) {
    r = next(r.rng, 330);
    x = 30 + r.v;
    y = BAS_HUD_H - 10;
  } else {
    r = next(r.rng, 200);
    x = side === 3 ? -14 : BAS_WORLD_W + 14;
    y = 80 + r.v;
  }
  r = next(r.rng, 330);
  const tx = 30 + r.v;
  r = next(r.rng, 10);
  const kind = r.v < 5 ? BAS_CIRCLE : r.v < 8 ? BAS_SQUARE : BAS_TRIANGLE;
  s.rng = r.rng;
  const v = setLength((tx - x) * FP, (BAS_BASE_Y - y) * FP, basSpeedFp(s.tick));
  s.shapes.push({
    x: x * FP,
    y: y * FP,
    vx: v.vx,
    vy: v.vy,
    kind,
    hp: kind === BAS_SQUARE ? 2 : 1,
    flash: 0,
  });
  s.spawned += 1;
}

function step(state: BasState, input: ArcadeInputEvent | null): BasState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: BasState = {
    ...state,
    tick,
    shapes: state.shapes.map((x) => ({ ...x })),
    bolts: state.bolts.map((x) => ({ ...x })),
    bursts: state.bursts.filter((b) => tick - b.t < 24),
  };
  if (input && input.k === ARCADE_INPUT_DRAG) {
    s.aimX = clampInt(input.a, 0, BAS_WORLD_W);
    s.aimY = clampInt(input.b, 0, BAS_WORLD_H);
    s.held = clampInt(input.c, 0, 1);
  }
  // The barrel follows the aim point at up to 6° a tick; the finger-down flag is ignored.
  const target = basAngleFor(s.aimX - BAS_TURRET_X, s.aimY - BAS_TURRET_Y, s.angle) * 256;
  s.angleFp += clampInt(target - s.angleFp, -MAX_TURN_FP, MAX_TURN_FP);
  s.angle = Math.trunc((s.angleFp + 128) / 256);

  // Fires continuously.
  if (s.fireIn > 0) s.fireIn -= 1;
  if (s.fireIn <= 0 && s.bolts.length < MAX_BOLTS) {
    const dir = BAS_DIRS[s.angle] ?? BAS_DIRS[UP]!;
    s.bolts.push({
      x: BAS_TURRET_X * FP + dir[0] * BAS_BARREL,
      y: BAS_TURRET_Y * FP + dir[1] * BAS_BARREL,
      vx: dir[0] * BOLT_SPEED,
      vy: dir[1] * BOLT_SPEED,
    });
    s.fireIn = BAS_FIRE_EVERY;
  }

  // Spawns.
  s.spawnIn -= 1;
  if (s.spawnIn <= 0 && tick < BAS_RUN_TICKS) {
    spawn(s);
    s.spawnIn = spawnGap(tick);
  }

  // Move shapes; base hits.
  const alive: BasShape[] = [];
  for (const shape of s.shapes) {
    shape.x += shape.vx;
    shape.y += shape.vy;
    if (shape.flash > 0) shape.flash -= 1;
    if (shape.y >= BAS_BASE_Y * FP) {
      s.health -= 1;
      s.bursts.push({ x: Math.trunc(shape.x / FP), y: BAS_BASE_Y, t: tick, c: 4 });
      continue;
    }
    if (shape.x < -40 * FP || shape.x > (BAS_WORLD_W + 40) * FP || shape.y < 0) continue;
    alive.push(shape);
  }
  s.shapes = alive;

  // Move bolts; hits.
  const bolts: BasBolt[] = [];
  for (const bolt of s.bolts) {
    bolt.x += bolt.vx;
    bolt.y += bolt.vy;
    if (bolt.x < 0 || bolt.x > BAS_WORLD_W * FP || bolt.y < BAS_HUD_H * FP) continue;
    let hitIndex = -1;
    for (let i = 0; i < s.shapes.length; i++) {
      const shape = s.shapes[i]!;
      const reach = ((BAS_RADIUS[shape.kind] ?? 12) + BOLT_R) * FP;
      const dx = bolt.x - shape.x;
      const dy = bolt.y - shape.y;
      if (dx * dx + dy * dy <= reach * reach) {
        hitIndex = i;
        break;
      }
    }
    if (hitIndex < 0) {
      bolts.push(bolt);
      continue;
    }
    const shape = s.shapes[hitIndex]!;
    shape.hp -= 1;
    if (shape.hp > 0) {
      shape.flash = 8;
      continue;
    }
    s.shapes.splice(hitIndex, 1);
    s.bursts.push({ x: Math.trunc(shape.x / FP), y: Math.trunc(shape.y / FP), t: tick, c: shape.kind });
    if (shape.kind === BAS_SMALL) s.small += 1;
    else s.big += 1;
    if (shape.kind === BAS_TRIANGLE) {
      const speed = basSpeedFp(tick);
      const hx = Math.trunc(shape.vy / 2);
      const hy = Math.trunc(shape.vx / 2);
      const a = setLength(shape.vx - hx, shape.vy + hy, speed);
      const b = setLength(shape.vx + hx, shape.vy - hy, speed);
      for (const v of [a, b]) {
        s.shapes.push({ x: shape.x, y: shape.y, vx: v.vx, vy: v.vy, kind: BAS_SMALL, hp: 1, flash: 0 });
      }
    }
  }
  s.bolts = bolts;

  if (s.health <= 0) {
    s.health = 0;
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= BAS_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

export function basDestroyed(state: { big: number; small: number }): number {
  return state.big + Math.trunc(state.small / 2);
}

export function basScoreOf(destroyed: number, health: number, finished: boolean): number {
  let bonus = 0;
  if (finished && health >= BAS_HEALTH) bonus = BAS_FULL_BONUS;
  else if (finished && health > 0) bonus = BAS_SURVIVE_BONUS;
  return clampInt(destroyed + bonus, 0, 150);
}

function score(state: BasState): number {
  return basScoreOf(basDestroyed(state), state.health, state.ended === 1);
}

/* ============================= Checkpoints ============================= */

export const BAS_CHECKPOINT_INTERVAL = 300;

export const BAS_CHECKPOINT_KEYS = [
  "tick",
  "aimX",
  "aimY",
  "held",
  "angle",
  "angleFp",
  "fireIn",
  "spawnIn",
  "shapes",
  "bolts",
  "big",
  "small",
  "health",
  "spawned",
  "rng",
  "checksum",
] as const;

export interface BasCheckpoint {
  tick: number;
  aimX: number;
  aimY: number;
  held: number;
  angle: number;
  fireIn: number;
  spawnIn: number;
  shapes: number;
  bolts: number;
  big: number;
  small: number;
  health: number;
  spawned: number;
  rng: number;
  checksum: number;
}

export function basCheckpoint(state: BasState): BasCheckpoint {
  const snap = {
    tick: state.tick,
    aimX: state.aimX,
    aimY: state.aimY,
    held: state.held,
    angle: state.angle,
    fireIn: state.fireIn,
    spawnIn: state.spawnIn,
    shapes: state.shapes.length,
    bolts: state.bolts.length,
    big: state.big,
    small: state.small,
    health: state.health,
    spawned: state.spawned,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  for (const item of [...state.shapes, ...state.bolts]) {
    checksum ^= (item.x ^ Math.imul(item.y, 31)) | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const BAS_BG = "#08080D";
export const BAS_GOLD = "#F5B82E";
export const BAS_COLOURS = ["#2ED3B7", "#60A5FA", "#F472B6", "#F472B6", "#F0524F"];

export function drawBasShape(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  flash: boolean,
  hp = 1,
): void {
  const r = BAS_RADIUS[kind] ?? 12;
  ctx.fillStyle = flash ? "#FFFFFF" : (BAS_COLOURS[kind] ?? "#FFFFFF");
  ctx.beginPath();
  if (kind === BAS_CIRCLE) ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === BAS_SQUARE) ctx.rect(x - r, y - r, r * 2, r * 2);
  else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.9, y + r * 0.7);
    ctx.lineTo(x - r * 0.9, y + r * 0.7);
    ctx.closePath();
  }
  ctx.fill();
  if (kind === BAS_SQUARE && hp === 1 && !flash) {
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r + 4, y - r + 4);
    ctx.lineTo(x + r - 4, y + r - 4);
    ctx.stroke();
  }
}

export function drawBasTurret(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: readonly [number, number],
  health: number,
  baseY: number,
  width: number,
): void {
  // Base strip and health bar.
  ctx.fillStyle = BAS_GOLD;
  ctx.fillRect(8, baseY - 1, width - 16, 2);
  const barW = 80;
  for (let i = 0; i < BAS_HEALTH; i++) {
    ctx.fillStyle = i < health ? BAS_GOLD : "rgba(245,184,46,0.18)";
    ctx.fillRect(x - barW / 2 + i * (barW / BAS_HEALTH) + 1, y + 30, barW / BAS_HEALTH - 2, 6);
  }
  // Barrel.
  ctx.strokeStyle = BAS_GOLD;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + (dir[0] / 256) * BAS_BARREL, y + (dir[1] / 256) * BAS_BARREL);
  ctx.stroke();
  ctx.lineCap = "butt";
  // Dome, 48 px wide.
  ctx.fillStyle = BAS_GOLD;
  ctx.beginPath();
  ctx.arc(x, y + 6, 24, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, state: BasState, size: CanvasSize): void {
  const scale = Math.min(size.width / BAS_WORLD_W, size.height / BAS_WORLD_H);
  const ox = (size.width - BAS_WORLD_W * scale) / 2;
  const oy = (size.height - BAS_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = BAS_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  for (const shape of state.shapes) {
    drawBasShape(ctx, shape.kind, shape.x / FP, shape.y / FP, shape.flash > 0, shape.hp);
  }
  ctx.fillStyle = BAS_GOLD;
  for (const bolt of state.bolts) {
    ctx.beginPath();
    ctx.arc(bolt.x / FP, bolt.y / FP, BOLT_R, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of state.bursts) {
    const age = state.tick - b.t;
    ctx.globalAlpha = Math.max(0, 1 - age / 24);
    ctx.fillStyle = BAS_COLOURS[b.c] ?? "#FFFFFF";
    for (let p = 0; p < 6; p++) {
      const angle = (p * Math.PI) / 3 + 0.4;
      const d = 4 + age * 1.5;
      ctx.fillRect(b.x + Math.cos(angle) * d - 2, b.y + Math.sin(angle) * d - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;

  drawBasTurret(
    ctx,
    BAS_TURRET_X,
    BAS_TURRET_Y,
    BAS_DIRS[state.angle] ?? BAS_DIRS[UP]!,
    state.health,
    BAS_BASE_Y,
    BAS_WORLD_W,
  );

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Destroyed ${basDestroyed(state)}`, 14, 14);
  ctx.restore();
}

export const bastionGame: ArcadeGame<BasState, ArcadeInputEvent | null> = {
  key: "bastion",
  runTicks: BAS_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: BAS_INPUT_RANGES,
};
