/**
 * Bullseye — an arcade game on the shared engine.
 *
 * Front view down the range: six rings, ten arrows, the target shrinking with
 * every shot as the range grows. A drag moves the reticle, release fires, and
 * the arrow lands at the reticle plus that arrow's sideways wind drift. Target
 * geometry is in whole pixels (the reticle is a pixel position); every value in
 * the state is an integer.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

export const BULLSEYE_WORLD_W = 390;
export const BULLSEYE_WORLD_H = 560;

export const BULLSEYE_RUN_SECONDS = 60;
export const BULLSEYE_RUN_TICKS = BULLSEYE_RUN_SECONDS * TICKS_PER_SECOND;
export const BULLSEYE_ARROWS = 10;

/** Target centre, in whole world pixels. */
export const BULLSEYE_CX = 195;
export const BULLSEYE_CY = 250;
export const BULLSEYE_BOW_X = 195;
export const BULLSEYE_BOW_Y = 532;
/** Outer radius at full size; each ring is a sixth of it. */
export const BULLSEYE_OUTER_R = 150;
export const BULLSEYE_RINGS = 6;
export const BULLSEYE_RING_STEP = 25;

/** Centre outwards. */
export const BULLSEYE_RING_VALUES = [30, 25, 20, 15, 10, 5] as const;
export const BULLSEYE_RING_COLOURS = [
  "#F5B82E",
  "#FF4D4D",
  "#3B82F6",
  "#3B82F6",
  "#F7F7F8",
  "#F7F7F8",
] as const;

/** Ring scale per arrow, in hundredths — the range grows each shot. */
export const BULLSEYE_SCALE_PCT = [100, 92, 85, 78, 72, 66, 60, 55, 50, 46] as const;
/** Pixels of sideways drift per wind unit, per arrow. */
export const BULLSEYE_DRIFT_PX = [10, 11, 13, 14, 15, 17, 18, 19, 21, 22] as const;

export const BULLSEYE_WIND_MAX = 4;
/** The arrow's flight is render-only; the landing is worked out on release. */
export const BULLSEYE_FLIGHT_TICKS = 20;

/** An aimed shot: a = reticle x, b = reticle y, in whole world pixels. */
export const BULLSEYE_INPUT_SHOT = 2;
export const BULLSEYE_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BULLSEYE_INPUT_SHOT, [0, BULLSEYE_WORLD_W], [0, BULLSEYE_WORLD_H]),
];

export function bullseyeScalePct(index: number): number {
  return BULLSEYE_SCALE_PCT[clampInt(index, 0, BULLSEYE_ARROWS - 1)]!;
}

export function bullseyeDriftPx(index: number): number {
  return BULLSEYE_DRIFT_PX[clampInt(index, 0, BULLSEYE_ARROWS - 1)]!;
}

/**
 * Which ring a landing point falls in, as an index, or −1 for a miss. Compared
 * with scaled integers so there is never a floating-point radius.
 */
export function bullseyeRingAt(x: number, y: number, scalePct: number): number {
  const dx = x - BULLSEYE_CX;
  const dy = y - BULLSEYE_CY;
  const distance2 = dx * dx + dy * dy;
  for (let ring = 1; ring <= BULLSEYE_RINGS; ring++) {
    const radius = BULLSEYE_RING_STEP * ring * scalePct;
    if (distance2 * 10_000 <= radius * radius) return ring - 1;
  }
  return -1;
}

export function bullseyeRingValue(ring: number): number {
  return ring < 0 ? 0 : (BULLSEYE_RING_VALUES[ring] ?? 0);
}

/* ================================ State ================================ */

export interface BullseyeHit {
  /** Where the arrow landed, in whole world pixels. */
  x: number;
  y: number;
  /** Ring index, or −1 for outside the target. */
  ring: number;
  value: number;
  /** Which arrow it was, so drawing knows the target size it hit. */
  arrow: number;
}

export interface BullseyeState {
  tick: number;
  rng: number;
  /** Wind for each arrow, −4 … +4. Same for everyone. */
  winds: number[];
  /** Arrows fired so far; also the index of the arrow now on the string. */
  arrowIndex: number;
  hits: BullseyeHit[];
  total: number;
  /** Ticks left of the current arrow's flight animation. */
  flightTick: number;
  endedTick: number;
}

function init(seed: number): BullseyeState {
  let rng = seed | 0;
  const winds: number[] = [];
  for (let index = 0; index < BULLSEYE_ARROWS; index++) {
    const drawn = rngBelow(rng, BULLSEYE_WIND_MAX * 2 + 1);
    rng = drawn.state;
    winds.push(drawn.value - BULLSEYE_WIND_MAX);
  }
  return {
    tick: 0,
    rng,
    winds,
    arrowIndex: 0,
    hits: [],
    total: 0,
    flightTick: 0,
    endedTick: 0,
  };
}

function isOver(state: BullseyeState): boolean {
  if (state.tick >= BULLSEYE_RUN_TICKS) return true;
  return state.arrowIndex >= BULLSEYE_ARROWS && state.flightTick <= 0;
}

/** Every arrow loosed. */
export function bullseyeFinished(state: BullseyeState): boolean {
  return state.arrowIndex >= BULLSEYE_ARROWS;
}

function step(state: BullseyeState, input: ArcadeInputEvent | null): BullseyeState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const flightTick = Math.max(0, state.flightTick - 1);

  const canFire = flightTick === 0 && state.arrowIndex < BULLSEYE_ARROWS;
  if (input && input.k === BULLSEYE_INPUT_SHOT && canFire) {
    const arrow = state.arrowIndex;
    const wind = state.winds[arrow] ?? 0;
    const x = clampInt(input.a, 0, BULLSEYE_WORLD_W) + wind * bullseyeDriftPx(arrow);
    const y = clampInt(input.b, 0, BULLSEYE_WORLD_H);
    const ring = bullseyeRingAt(x, y, bullseyeScalePct(arrow));
    const value = bullseyeRingValue(ring);
    const next: BullseyeState = {
      ...state,
      tick,
      flightTick: BULLSEYE_FLIGHT_TICKS,
      arrowIndex: arrow + 1,
      hits: [...state.hits, { x, y, ring, value, arrow }],
      total: state.total + value,
    };
    if (isOver(next)) return { ...next, endedTick: tick };
    return next;
  }

  const next: BullseyeState = { ...state, tick, flightTick };
  if (isOver(next)) return { ...next, endedTick: tick };
  return next;
}

function score(state: BullseyeState): number {
  return clampInt(Math.round(state.total / 2), 0, 150);
}

/** Arrows in the gold or red rings — the headline for the standings summary. */
export function bullseyeInner(state: BullseyeState): number {
  return state.hits.filter((hit) => hit.ring === 0 || hit.ring === 1).length;
}

/* =========================== Integrity checks ========================== */

export const BULLSEYE_CHECKPOINT_INTERVAL = 300;

export interface BullseyeCheckpointState {
  tick: number;
  arrowIndex: number;
  flightTick: number;
  total: number;
  lastX: number;
  lastY: number;
  lastRing: number;
  wind: number;
}

export interface BullseyeCheckpoint extends BullseyeCheckpointState {
  checksum: number;
}

export function bullseyeCheckpointState(state: BullseyeState): BullseyeCheckpointState {
  const last = state.hits[state.hits.length - 1];
  return {
    tick: state.tick,
    arrowIndex: state.arrowIndex,
    flightTick: state.flightTick,
    total: state.total,
    lastX: last ? last.x : 0,
    lastY: last ? last.y : 0,
    lastRing: last ? last.ring : -1,
    wind: state.winds[Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1)] ?? 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function bullseyeCheckpoint(state: BullseyeState): BullseyeCheckpoint {
  const snapshot = bullseyeCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const BULLSEYE_BG = "#0B0B0F";
export const BULLSEYE_GOLD = "#F5B82E";
export const BULLSEYE_TEXT = "#F7F7F8";

export interface BullseyeTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function bullseyeTransform(size: CanvasSize): BullseyeTransform {
  const scale = Math.min(size.width / BULLSEYE_WORLD_W, size.height / BULLSEYE_WORLD_H);
  return {
    scale,
    offsetX: (size.width - BULLSEYE_WORLD_W * scale) / 2,
    offsetY: (size.height - BULLSEYE_WORLD_H * scale) / 2,
  };
}

/** The six rings at the size this arrow sees them. */
export function bullseyeDrawTarget(ctx: CanvasRenderingContext2D, scalePct: number): void {
  for (let ring = BULLSEYE_RINGS; ring >= 1; ring--) {
    const radius = (BULLSEYE_RING_STEP * ring * scalePct) / 100;
    ctx.beginPath();
    ctx.fillStyle = BULLSEYE_RING_COLOURS[ring - 1]!;
    ctx.globalAlpha = ring <= 2 ? 0.9 : 0.35;
    ctx.arc(BULLSEYE_CX, BULLSEYE_CY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(11, 11, 15, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = "700 9px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let index = 0; index < BULLSEYE_RINGS; index++) {
    const outer = (BULLSEYE_RING_STEP * (index + 1) * scalePct) / 100;
    const inner = index === 0 ? 0 : (BULLSEYE_RING_STEP * index * scalePct) / 100;
    const y = BULLSEYE_CY - Math.max(8, (outer + inner) / 2);
    ctx.fillStyle = index === 0 || index >= 4 ? "#0B0B0F" : BULLSEYE_TEXT;
    ctx.fillText(String(BULLSEYE_RING_VALUES[index] ?? 0), BULLSEYE_CX, y);
  }
}

function drawWind(ctx: CanvasRenderingContext2D, wind: number): void {
  const centreX = BULLSEYE_WORLD_W / 2;
  const y = 66;
  ctx.save();
  ctx.strokeStyle = wind === 0 ? "#F7F7F855" : BULLSEYE_GOLD;
  ctx.lineWidth = 2;
  if (wind !== 0) {
    const dir = wind < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(centreX - 24 * dir, y);
    ctx.lineTo(centreX + 24 * dir, y);
    ctx.lineTo(centreX + 16 * dir, y - 6);
    ctx.moveTo(centreX + 24 * dir, y);
    ctx.lineTo(centreX + 16 * dir, y + 6);
    ctx.stroke();
  }
  ctx.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BULLSEYE_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    wind === 0 ? "no wind" : `${wind < 0 ? "←" : "→"} ${Math.abs(wind)}`,
    centreX,
    y - 12,
  );
  ctx.restore();
}

function drawBow(ctx: CanvasRenderingContext2D, targetX: number, targetY: number): void {
  const angle = Math.atan2(targetY - BULLSEYE_BOW_Y, targetX - BULLSEYE_BOW_X);
  ctx.save();
  ctx.translate(BULLSEYE_BOW_X, BULLSEYE_BOW_Y);
  ctx.rotate(angle);
  ctx.strokeStyle = BULLSEYE_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -30);
  ctx.stroke();
  ctx.strokeStyle = "rgba(247, 247, 248, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -10, 22, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BullseyeState, size: CanvasSize): void {
  const { scale, offsetX, offsetY } = bullseyeTransform(size);
  // Mid-flight the target is still the one the arrow was loosed at.
  const shown =
    state.flightTick > 0
      ? Math.max(0, state.arrowIndex - 1)
      : Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1);

  ctx.save();
  ctx.fillStyle = BULLSEYE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  bullseyeDrawTarget(ctx, bullseyeScalePct(shown));

  // The last landed arrow stays as a small gold dot until the next one flies.
  const last = state.hits[state.hits.length - 1];
  if (last && state.flightTick === 0) {
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // In flight: the arrow shrinks in towards its landing point.
  if (last && state.flightTick > 0) {
    const progress = (BULLSEYE_FLIGHT_TICKS - state.flightTick) / BULLSEYE_FLIGHT_TICKS;
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3 + 14 * (1 - progress), 0, Math.PI * 2);
    ctx.globalAlpha = 0.35 + 0.65 * progress;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (state.arrowIndex < BULLSEYE_ARROWS) drawWind(ctx, state.winds[state.arrowIndex] ?? 0);
  if (state.arrowIndex < BULLSEYE_ARROWS && state.flightTick === 0) {
    drawBow(ctx, BULLSEYE_CX, BULLSEYE_CY);
  }

  const remaining = Math.max(0, BULLSEYE_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BULLSEYE_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const shownArrow = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
  ctx.fillText(`Arrow ${shownArrow} / ${BULLSEYE_ARROWS} · ${state.total} pts`, 12, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, BULLSEYE_WORLD_W - 12, 12);

  ctx.restore();
}

/** The gold aim line, bow and crosshair, drawn while a drag is in progress. Render only. */
export function bullseyeDrawAim(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  x: number,
  y: number,
): void {
  const { scale, offsetX, offsetY } = bullseyeTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(245, 184, 46, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(BULLSEYE_BOW_X, BULLSEYE_BOW_Y);
  ctx.lineTo(x, y);
  ctx.stroke();
  drawBow(ctx, x, y);
  ctx.strokeStyle = BULLSEYE_GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export const bullseyeGame: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = {
  key: "bullseye",
  runTicks: BULLSEYE_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: BULLSEYE_INPUT_RANGES,
};
