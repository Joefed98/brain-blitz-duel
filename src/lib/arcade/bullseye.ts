/**
 * Bullseye — an arcade game on the shared engine.
 *
 * Front view down the range: six rings, ten arrows, the target shrinking with
 * every shot as the range grows. A drag aims from the bow at the bottom and
 * letting go fires the arrow; longer drags land higher, and each arrow takes
 * that shot's sideways wind drift. Target geometry is in whole pixels; every
 * value in the state is an integer.
 */

import {
  clampInt,
  dragLaunch,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type DragLaunch,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

export const BULLSEYE_WORLD_W = 390;
export const BULLSEYE_WORLD_H = 560;

export const BULLSEYE_RUN_SECONDS = 60;
export const BULLSEYE_RUN_TICKS = BULLSEYE_RUN_SECONDS * TICKS_PER_SECOND;
export const BULLSEYE_ARROWS = 10;

/**
 * Target centre, in whole world pixels — sat 40% down the play area so the
 * target reads as further off down the range.
 */
export const BULLSEYE_CX = 195;
export const BULLSEYE_CY = Math.round(BULLSEYE_WORLD_H * 0.4);
export const BULLSEYE_BOW_X = 195;
export const BULLSEYE_BOW_Y = 532;
/** Outer radius at full size; each ring is a sixth of it. */
export const BULLSEYE_OUTER_R = 114;
export const BULLSEYE_RINGS = 6;
export const BULLSEYE_RING_STEP = BULLSEYE_OUTER_R / BULLSEYE_RINGS;

/** Centre outwards. */
export const BULLSEYE_RING_VALUES = [10, 9, 8, 7, 6, 5] as const;
export const BULLSEYE_RING_COLOURS = [
  "#F5B82E",
  "#FF4D4D",
  "#3B82F6",
  "#3B82F6",
  "#F7F7F8",
  "#F7F7F8",
] as const;

/** Ring scale per arrow, in hundredths — the range grows each shot. */
export const BULLSEYE_SCALE_PCT = [100, 96, 92, 88, 84, 80, 77, 74, 71, 68] as const;
export const BULLSEYE_WIND_MAX = 3;
/** The arrow's flight is render-only; the landing is worked out on release. */
export const BULLSEYE_FLIGHT_TICKS = 20;

/** A release: a = launch vx, b = launch vy, in 1/256 px a tick, upwards negative. */
export const BULLSEYE_INPUT_SHOT = 2;
export const BULLSEYE_V_MAX = 3_840;
export const BULLSEYE_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BULLSEYE_INPUT_SHOT, [-BULLSEYE_V_MAX, BULLSEYE_V_MAX], [-BULLSEYE_V_MAX, 0]),
];

/**
 * The launch speed the reference aim vector produces, in 1/256 px a tick, and
 * the flight constant taken from it: a reference-strength straight-up aim
 * carries the arrow exactly the 282 px from the bow to the centre on arrow one.
 */
export const BULLSEYE_REF_V = 1_920;
export const BULLSEYE_FLIGHT_NUM = BULLSEYE_BOW_Y - BULLSEYE_CY;
export const BULLSEYE_FLIGHT_DEN = BULLSEYE_REF_V;

/**
 * Turns the aim vector (finger position minus the anchor, in world pixels) into
 * a launch velocity. Upwards is negative `dy`; a downward vector is clamped to
 * horizontal.
 */
export function bullseyeDrag(dx: number, dy: number): DragLaunch | null {
  const launch = dragLaunch(dx, dy, BULLSEYE_REF_V);
  if (!launch) return null;
  return {
    ...launch,
    vx: clampInt(launch.vx, -BULLSEYE_V_MAX, BULLSEYE_V_MAX),
    vy: clampInt(launch.vy, -BULLSEYE_V_MAX, -1),
  };
}

/** Where a flick lands on the target plane, before the wind drift. */
export function bullseyeLanding(vx: number, vy: number): { x: number; y: number } {
  const reach = (value: number) => Math.round((value * BULLSEYE_FLIGHT_NUM) / BULLSEYE_FLIGHT_DEN);
  return {
    x: clampInt(BULLSEYE_BOW_X + reach(vx), -400, BULLSEYE_WORLD_W + 400),
    y: clampInt(BULLSEYE_BOW_Y - reach(-vy), -400, BULLSEYE_WORLD_H + 400),
  };
}

export function bullseyeScalePct(index: number): number {
  return BULLSEYE_SCALE_PCT[clampInt(index, 0, BULLSEYE_ARROWS - 1)]!;
}

/** One wind unit moves one ring width at this arrow's target scale. */
export function bullseyeWindShiftPx(index: number, wind: number): number {
  const scalePct = bullseyeScalePct(index);
  return Math.round((wind * BULLSEYE_OUTER_R * scalePct) / (BULLSEYE_RINGS * 100));
}

/* ------------------------------- Aim sway ------------------------------ */

/**
 * The aim sways in a small circle: one full turn every 120 ticks (two seconds),
 * radius 0.6 of a ring width at that arrow's scale. The phase depends only on
 * the sim tick, so it is identical for every player and for the server replay.
 * Cosine and sine come from a fixed 120-entry table in 1/1024 units, so no
 * floating-point trigonometry is ever involved.
 */
export const BULLSEYE_SWAY_PERIOD = 120;
export const BULLSEYE_SWAY_UNIT = 1_024;
/** Radius as a tenth: 6/10 of a ring width. */
export const BULLSEYE_SWAY_TENTHS = 6;

export const BULLSEYE_SWAY_COS: readonly number[] = [
  1024, 1023, 1018, 1011, 1002, 989, 974, 956, 935, 912, 887, 859, 828, 796, 761, 724, 685, 644,
  602, 558, 512, 465, 416, 367, 316, 265, 213, 160, 107, 54, 0, -54, -107, -160, -213, -265, -316,
  -367, -416, -465, -512, -558, -602, -644, -685, -724, -761, -796, -828, -859, -887, -912, -935,
  -956, -974, -989, -1002, -1011, -1018, -1023, -1024, -1023, -1018, -1011, -1002, -989, -974, -956,
  -935, -912, -887, -859, -828, -796, -761, -724, -685, -644, -602, -558, -512, -465, -416, -367,
  -316, -265, -213, -160, -107, -54, 0, 54, 107, 160, 213, 265, 316, 367, 416, 465, 512, 558, 602,
  644, 685, 724, 761, 796, 828, 859, 887, 912, 935, 956, 974, 989, 1002, 1011, 1018, 1023,
];

export const BULLSEYE_SWAY_SIN: readonly number[] = [
  0, 54, 107, 160, 213, 265, 316, 367, 416, 465, 512, 558, 602, 644, 685, 724, 761, 796, 828, 859,
  887, 912, 935, 956, 974, 989, 1002, 1011, 1018, 1023, 1024, 1023, 1018, 1011, 1002, 989, 974, 956,
  935, 912, 887, 859, 828, 796, 761, 724, 685, 644, 602, 558, 512, 465, 416, 367, 316, 265, 213,
  160, 107, 54, 0, -54, -107, -160, -213, -265, -316, -367, -416, -465, -512, -558, -602, -644,
  -685, -724, -761, -796, -828, -859, -887, -912, -935, -956, -974, -989, -1002, -1011, -1018,
  -1023, -1024, -1023, -1018, -1011, -1002, -989, -974, -956, -935, -912, -887, -859, -828, -796,
  -761, -724, -685, -644, -602, -558, -512, -465, -416, -367, -316, -265, -213, -160, -107, -54,
];

/** The sway offset, in whole world pixels, for this arrow at this sim tick. */
export function bullseyeSway(index: number, tick: number): { dx: number; dy: number } {
  const phase = ((tick % BULLSEYE_SWAY_PERIOD) + BULLSEYE_SWAY_PERIOD) % BULLSEYE_SWAY_PERIOD;
  const radius = BULLSEYE_SWAY_TENTHS * BULLSEYE_OUTER_R * bullseyeScalePct(index);
  const divisor = 10 * BULLSEYE_RINGS * 100 * BULLSEYE_SWAY_UNIT;
  return {
    dx: Math.round((radius * BULLSEYE_SWAY_COS[phase]!) / divisor),
    dy: Math.round((radius * BULLSEYE_SWAY_SIN[phase]!) / divisor),
  };
}

/** Where a shot released on this tick would land, sway included, wind excluded. */
export function bullseyeAimPoint(
  index: number,
  tick: number,
  vx: number,
  vy: number,
): { x: number; y: number } {
  const landing = bullseyeLanding(vx, vy);
  const sway = bullseyeSway(index, tick);
  return { x: landing.x + sway.dx, y: landing.y + sway.dy };
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
    // Keep authoritative geometry integer-only: radius is
    // OUTER_R × ring ÷ RINGS × scalePct ÷ 100.
    const radiusNumerator = BULLSEYE_OUTER_R * ring * scalePct;
    if (distance2 * BULLSEYE_RINGS * BULLSEYE_RINGS * 10_000 <= radiusNumerator ** 2) {
      return ring - 1;
    }
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
  /** The persisted wind applied to this arrow. */
  wind: number;
}

export interface BullseyeState {
  tick: number;
  rng: number;
  /** Wind for each arrow, −3 … +3. Same for everyone. */
  winds: number[];
  /** Arrows fired so far; also the index of the arrow now on the string. */
  arrowIndex: number;
  hits: BullseyeHit[];
  total: number;
  /** Ticks left of the current arrow's flight animation. */
  flightTick: number;
  endedTick: number;
}

export function bullseyeWinds(seed: number): number[] {
  let rng = seed | 0;
  const winds: number[] = [];
  for (let index = 0; index < BULLSEYE_ARROWS; index++) {
    const drawn = rngBelow(rng, BULLSEYE_WIND_MAX * 2 + 1);
    rng = drawn.state;
    winds.push(drawn.value - BULLSEYE_WIND_MAX);
  }
  return winds;
}

export function bullseyeInit(seed: number, storedWinds?: readonly number[]): BullseyeState {
  let rng = seed | 0;
  for (let index = 0; index < BULLSEYE_ARROWS; index++) {
    rng = rngBelow(rng, BULLSEYE_WIND_MAX * 2 + 1).state;
  }
  const generated = bullseyeWinds(seed);
  const validStored =
    storedWinds?.length === BULLSEYE_ARROWS &&
    storedWinds.every(
      (wind) => Number.isInteger(wind) && wind >= -BULLSEYE_WIND_MAX && wind <= BULLSEYE_WIND_MAX,
    );
  const winds = validStored ? [...storedWinds] : generated;
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
    const vx = clampInt(input.a, -BULLSEYE_V_MAX, BULLSEYE_V_MAX);
    const vy = clampInt(input.b, -BULLSEYE_V_MAX, 0);
    // The landing is the aim point on the release tick — sway included — then
    // shifted sideways by this arrow's wind.
    const aimed = bullseyeAimPoint(arrow, tick, vx, vy);
    const x = aimed.x + bullseyeWindShiftPx(arrow, wind);
    const y = aimed.y;
    const ring = bullseyeRingAt(x, y, bullseyeScalePct(arrow));
    const value = bullseyeRingValue(ring);
    const next: BullseyeState = {
      ...state,
      tick,
      flightTick: BULLSEYE_FLIGHT_TICKS,
      arrowIndex: arrow + 1,
      hits: [...state.hits, { x, y, ring, value, arrow, wind }],
      total: state.total + value,
    };
    if (isOver(next)) return { ...next, endedTick: tick };
    return next;
  }

  const next: BullseyeState = { ...state, tick, flightTick };
  if (isOver(next)) return { ...next, endedTick: tick };
  return next;
}

/** Ten centres (100) make the 150 cap. */
function score(state: BullseyeState): number {
  return clampInt(Math.round((state.total * 3) / 2), 0, 150);
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

/** The bow with a nocked arrow, sitting at bottom-centre. Render only. */
function drawBow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(BULLSEYE_BOW_X, BULLSEYE_BOW_Y);
  ctx.strokeStyle = "rgba(247, 247, 248, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 10, 22, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = BULLSEYE_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -18);
  ctx.lineTo(0, -28);
  ctx.lineTo(5, -18);
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

  // The last landed arrow stays as a faint correction dot until the next release.
  const last = state.hits[state.hits.length - 1];
  if (last && state.flightTick === 0) {
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // In flight: the arrow travels from the bow to its landing point, shrinking
  // as it goes down the range. Render only.
  if (last && state.flightTick > 0) {
    const progress = (BULLSEYE_FLIGHT_TICKS - state.flightTick) / BULLSEYE_FLIGHT_TICKS;
    const x = BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * progress;
    const y = BULLSEYE_BOW_Y + (last.y - BULLSEYE_BOW_Y) * progress;
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.globalAlpha = 0.45 + 0.55 * progress;
    ctx.beginPath();
    ctx.arc(x, y, 3 + 7 * (1 - progress), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (state.arrowIndex < BULLSEYE_ARROWS) drawWind(ctx, state.winds[state.arrowIndex] ?? 0);
  if (state.arrowIndex < BULLSEYE_ARROWS && state.flightTick === 0) drawBow(ctx);

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

/**
 * The aim line the shot would take if the finger were released right now: a
 * dotted line from the bow to the predicted landing point, with a small ring
 * there. Render only — the sim never sees it.
 */
export function bullseyeDrawAim(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  landing: { x: number; y: number },
): void {
  const { scale, offsetX, offsetY } = bullseyeTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = BULLSEYE_GOLD;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(BULLSEYE_BOW_X, BULLSEYE_BOW_Y - 26);
  ctx.lineTo(landing.x, landing.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(landing.x, landing.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

export const bullseyeGame: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = {
  key: "bullseye",
  runTicks: BULLSEYE_RUN_TICKS,
  init: bullseyeInit,
  step,
  isOver,
  score,
  draw,
  inputRanges: BULLSEYE_INPUT_RANGES,
};
