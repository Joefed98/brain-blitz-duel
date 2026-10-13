/**
 * Hover — the first arcade game on the shared engine.
 *
 * A gold disc holds the left third of a fixed 390 × 560 world. Gravity pulls it
 * down every tick, a tap shoves it up, and the whole course scrolls past from
 * the right. The course is generated in full at init(seed), so the phone and the
 * server walk the identical run; everything is integer fixed-point (1/256 px).
 *
 * The scroll speed rises with every gate passed, so the ramp depends only on the
 * player's own gate count and stays deterministic.
 *
 * The course builds 45 barriers (HOVER_GATE_COUNT, capacity), of which a clean
 * run reaches 42 in sixty seconds (HOVER_REACHABLE_GATES); scoring uses the
 * reachable count.
 *
 * hoverRev 2 (stamped on the puzzle) keeps the same course spacing, gap sizes
 * and scroll ramp and adds, all built at init from the seed:
 *  - gold stars on ten barriers whose gap is narrowed to the minimum, each sitting
 *    near the upper or lower lip, collected by touching it (optional, risky);
 *  - two-gap barriers on later stretches (pass through either gap);
 *  - moving barriers on later stretches, whose single gap slides up and down on a
 *    slow integer triangle wave keyed to the sim tick.
 * Score: up to 130 for barriers plus up to 20 for stars, cap 150.
 */

import {
  clampInt,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type CanvasSize,
} from "./engine";
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

/** The world the sim runs in. Drawing scales this to the canvas. */
export const HOVER_WORLD_W = 390;
export const HOVER_WORLD_H = 560;

export const HOVER_RUN_SECONDS = 60;
export const HOVER_RUN_TICKS = HOVER_RUN_SECONDS * TICKS_PER_SECOND;

/** Every simulation constant below is already in 1/256-pixel units. */
export const HOVER_DISC_X = 33_280;
export const HOVER_DISC_R = 2_816;

export const HOVER_GRAVITY = 90;
export const HOVER_IMPULSE = -1_664;
export const HOVER_TERMINAL = 2_304;

/** Scroll speed: 2.6 px/tick, +0.06 px/tick per gate passed, capped at 5.2. */
export const HOVER_SCROLL_START = 666;
export const HOVER_SCROLL_STEP = 0.06 * 256;
export const HOVER_SCROLL_MAX = 1_331;

export const HOVER_PILLAR_W = 10_240;
/** Pillar spacing in world pixels; the first pillar starts at the right edge. */
export const HOVER_SPACING = 80_896;
/** Course capacity; the final unreachable gates keep the track populated to 60 s. */
export const HOVER_GATE_COUNT = 45;
export const HOVER_FIRST_X = 99_840;

export const HOVER_GAP_START = 38_400;
export const HOVER_GAP_STEP = 512;
export const HOVER_GAP_MIN = 25_600;
/** Keep a gap away from the floor and ceiling by this much. */
export const HOVER_GAP_MARGIN = 10_240;
export const HOVER_WORLD_BOTTOM = 143_360;

/** Score is the fraction of reachable gates passed, scaled to this maximum. */
export const HOVER_ALL_GATES_SCORE = 150;

/** Rule revision stamped on new rounds (puzzle.hoverRev); absent = original rules. */
export const HOVER_REV = 2;
/** hoverRev 2 scoring: barriers up to 130, stars up to 20, cap 150. */
export const HOVER_V2_GATES_SCORE = 130;
export const HOVER_V2_STARS_SCORE = 20;
/** Gold stars per course, on barriers from this index on (the tighter part of the run). */
export const HOVER_STARS = 10;
export const HOVER_STAR_FROM = 14;
/** Star radius and its centre's distance inside the gap lip, fixed-point. */
export const HOVER_STAR_R = 1_792;
export const HOVER_STAR_INSET = 5_376;
/** Two-gap barriers: from this index, every third barrier (index % 3 === 1). */
export const HOVER_TWO_GAP_FROM = 16;
/** Solid wall kept between the two gaps, at least. */
export const HOVER_TWO_GAP_WALL = 15_360;
/** Moving barriers: from this index, every third barrier (index % 3 === 2). */
export const HOVER_MOVE_FROM = 23;
/** A moving gap slides ±40 px over a 4 s cycle (0.67 px a tick). */
export const HOVER_MOVE_AMP = 10_240;
export const HOVER_MOVE_PERIOD = 240;

/* ================================ State ================================ */

export interface HoverPillar {
  /** Left edge at the start of the run, fixed-point; never mutated. */
  x0: number;
  gapTop: number;
  gapH: number;
  /** hoverRev 2 only (absent on original courses): a second, lower gap. */
  gap2Top?: number;
  gap2H?: number;
  /** hoverRev 2 only: the gap slides by hoverMoveOffset(tick, movePhase). */
  movePhase?: number;
  /** hoverRev 2 only: a gold star's centre, as an offset from the (moving) gap top. */
  starDy?: number;
}

export interface HoverState extends BandFields {
  tick: number;
  /** Disc centre, fixed-point. */
  y: number;
  vy: number;
  /** How far the course has scrolled, fixed-point. */
  distance: number;
  gates: number;
  /** Gates a player who never crashes passes in a full run. */
  totalGates: number;
  crashed: boolean;
  /** The tick the run ended on, or 0 while it is still going. */
  endedTick: number;
  pillars: HoverPillar[];
  /** hoverRev 2 only; absent on unstamped rounds. */
  rev?: number;
  /** hoverRev 4 only (Tuning C): 1 = scored on HOVER_V4_BAND_CURVE. Absent on every earlier round. */
  tunec?: number;
  /** Stars collected, the pillar index of each (in order), and stars on reachable barriers. */
  stars?: number;
  starsTaken?: number[];
  totalStars?: number;
  /** hoverRev 5 only (Tuning E): the taller world's height in px (HOVER_TALL_H). Absent = HOVER_WORLD_H. */
  worldH?: number;
}

/** The world height a state plays in (px): the taller Tuning E world, or the original 560. */
export function hoverWorldH(state: { worldH?: number }): number {
  return state.worldH ?? HOVER_WORLD_H;
}

/** The floor a state's disc crashes into, fixed-point. */
export function hoverBottom(state: { worldH?: number }): number {
  return state.worldH ? state.worldH * 256 : HOVER_WORLD_BOTTOM;
}

/** Gap height in fixed-point units for the nth pillar. */
function gapUnits(index: number): number {
  return Math.max(HOVER_GAP_MIN, HOVER_GAP_START - HOVER_GAP_STEP * index);
}

/** Scroll speed for a player who has passed this many gates. */
export function hoverScroll(gates: number): number {
  return Math.min(HOVER_SCROLL_MAX, Math.round(HOVER_SCROLL_START + HOVER_SCROLL_STEP * gates));
}

/** Left edge of a pillar right now. */
export function pillarX(pillar: HoverPillar, distance: number): number {
  return pillar.x0 - distance;
}

/** Scrolled distance at which the nth pillar counts as passed. */
function passedAt(pillar: HoverPillar): number {
  return pillar.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R);
}

/** The whole course, long enough for the fastest possible run. */
function buildCourse(seed: number): { pillars: HoverPillar[]; rng: number } {
  const pillars: HoverPillar[] = [];
  let rng = seed | 0;
  let x = HOVER_FIRST_X;
  const reachable = countTotalGates(Array.from({ length: HOVER_GATE_COUNT }, (_, i) => ({
    x0: HOVER_FIRST_X + i * HOVER_SPACING, gapTop: 0, gapH: 0,
  })));
  let previousThird = 1;
  while (pillars.length < HOVER_GATE_COUNT) {
    const gap = gapUnits(pillars.length);
    const half = gap >> 1;
    // Draw the centre in whole world pixels, as before the constant audit, then
    // store it in fixed-point. This preserves every existing seeded course.
    const low = (half + HOVER_GAP_MARGIN) >> 8;
    const high = (HOVER_WORLD_BOTTOM - half - HOVER_GAP_MARGIN) >> 8;
    const span = Math.max(1, high - low + 1);
    const drawn = rngBelow(rng, span);
    rng = drawn.state;
    let centre = (low + drawn.value) << 8;
    let third = Math.min(2, Math.floor(centre * 3 / HOVER_WORLD_BOTTOM));
    if (pillars.length < reachable - 12 && Math.abs(third - previousThird) === 2) {
      centre = HOVER_WORLD_BOTTOM >> 1;
      third = 1;
    }
    previousThird = third;
    pillars.push({ x0: x, gapTop: centre - half, gapH: gap });
    x += HOVER_SPACING;
  }
  return { pillars, rng };
}

/** Gates a clean run reaches, walked tick by tick exactly as `step` does. */
function countTotalGates(pillars: HoverPillar[]): number {
  let gates = 0;
  let distance = 0;
  for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
    distance += hoverScroll(gates);
    while (gates < pillars.length && distance > passedAt(pillars[gates]!)) gates += 1;
  }
  return gates;
}

/** Barriers a clean run reaches; the scroll ramp alone fixes it, whatever the gaps. */
export const HOVER_REACHABLE_GATES = countTotalGates(
  Array.from({ length: HOVER_GATE_COUNT }, (_, i) => ({ x0: HOVER_FIRST_X + i * HOVER_SPACING, gapTop: 0, gapH: 0 })),
);

/** hoverRev 2: a moving gap's offset at this tick, an integer triangle wave in ±HOVER_MOVE_AMP. */
export function hoverMoveOffset(tick: number, phase: number): number {
  const half = HOVER_MOVE_PERIOD >> 1;
  const p = (tick + phase) % HOVER_MOVE_PERIOD;
  const tri = p < half ? p : HOVER_MOVE_PERIOD - p;
  return Math.trunc((2 * HOVER_MOVE_AMP * tri) / half) - HOVER_MOVE_AMP;
}

/** The (first) gap's top at this tick; moving gaps slide, others stay put. */
export function hoverGapTop(pillar: HoverPillar, tick: number): number {
  return pillar.movePhase === undefined ? pillar.gapTop : pillar.gapTop + hoverMoveOffset(tick, pillar.movePhase);
}

/** A star's centre height at this tick, or null when the barrier has none. */
export function hoverStarY(pillar: HoverPillar, tick: number): number | null {
  return pillar.starDy === undefined ? null : hoverGapTop(pillar, tick) + pillar.starDy;
}

/**
 * hoverRev 2 course: the original seeded course, then (from a separate PRNG
 * stream continuing after it) the later barriers are reshaped into two-gap and
 * moving barriers, and ten barriers get a tightened gap and a gold star.
 */
function buildCourseRev2(seed: number): { pillars: HoverPillar[]; totalStars: number } {
  const built = buildCourse(seed);
  let rng = built.rng;
  const draw = (n: number) => {
    const drawn = rngBelow(rng, Math.max(1, n));
    rng = drawn.state;
    return drawn.value;
  };
  const mid = HOVER_WORLD_BOTTOM >> 1;
  const pillars: HoverPillar[] = built.pillars.map((pillar) => ({ ...pillar }));
  const twoGap = (index: number) => index >= HOVER_TWO_GAP_FROM && index % 3 === 1;
  const moving = (index: number) => index >= HOVER_MOVE_FROM && index % 3 === 2;
  // Stars: ten distinct single-gap barriers among the reachable ones from HOVER_STAR_FROM.
  const candidates: number[] = [];
  for (let i = HOVER_STAR_FROM; i < HOVER_REACHABLE_GATES; i++) if (!twoGap(i)) candidates.push(i);
  const starred = new Set<number>();
  while (starred.size < HOVER_STARS && starred.size < candidates.length) {
    starred.add(candidates[draw(candidates.length)]!);
  }
  pillars.forEach((pillar, index) => {
    const gap = pillar.gapH;
    const half = gap >> 1;
    if (twoGap(index)) {
      // Upper and lower gaps, each the barrier's own size, a solid wall between.
      const upperLow = HOVER_GAP_MARGIN + half;
      const upperHigh = mid - (HOVER_TWO_GAP_WALL >> 1) - half;
      const lowerLow = mid + (HOVER_TWO_GAP_WALL >> 1) + half;
      const lowerHigh = HOVER_WORLD_BOTTOM - HOVER_GAP_MARGIN - half;
      const upper = upperLow + (draw(((upperHigh - upperLow) >> 8) + 1) << 8);
      const lower = lowerLow + (draw(((lowerHigh - lowerLow) >> 8) + 1) << 8);
      pillar.gapTop = upper - half;
      pillar.gapH = gap;
      pillar.gap2Top = lower - half;
      pillar.gap2H = gap;
      return;
    }
    let gapH = gap;
    if (starred.has(index)) gapH = HOVER_GAP_MIN;
    const gapHalf = gapH >> 1;
    const swing = moving(index) ? HOVER_MOVE_AMP : 0;
    // Keep the whole sweep inside the margins, and the centre near the old one.
    const low = HOVER_GAP_MARGIN + gapHalf + swing;
    const high = HOVER_WORLD_BOTTOM - HOVER_GAP_MARGIN - gapHalf - swing;
    const centre = Math.max(low, Math.min(high, pillar.gapTop + half));
    pillar.gapTop = centre - gapHalf;
    pillar.gapH = gapH;
    if (swing) pillar.movePhase = draw(HOVER_MOVE_PERIOD);
    if (starred.has(index)) pillar.starDy = draw(2) === 0 ? HOVER_STAR_INSET : gapH - HOVER_STAR_INSET;
  });
  return { pillars, totalStars: starred.size };
}

function initRev2(seed: number): HoverState {
  const { pillars, totalStars } = buildCourseRev2(seed);
  return {
    tick: 0,
    y: 71_680,
    vy: 0,
    distance: 0,
    gates: 0,
    totalGates: countTotalGates(pillars),
    crashed: false,
    endedTick: 0,
    pillars,
    rev: HOVER_REV,
    stars: 0,
    starsTaken: [],
    totalStars,
  };
}

function init(seed: number): HoverState {
  const { pillars } = buildCourse(seed);
  return {
    tick: 0,
    y: 71_680,
    vy: 0,
    distance: 0,
    gates: 0,
    totalGates: countTotalGates(pillars),
    crashed: false,
    endedTick: 0,
    pillars,
  };
}

function hits(pillar: HoverPillar, distance: number, y: number): boolean {
  const left = pillarX(pillar, distance);
  const right = left + HOVER_PILLAR_W;
  const overlaps = right > HOVER_DISC_X - HOVER_DISC_R && left < HOVER_DISC_X + HOVER_DISC_R;
  if (!overlaps) return false;
  return y - HOVER_DISC_R < pillar.gapTop || y + HOVER_DISC_R > pillar.gapTop + pillar.gapH;
}

/** hoverRev 2 collision: inside either gap (the first one may be moving) while overlapping. */
function hitsRev2(pillar: HoverPillar, distance: number, y: number, tick: number): boolean {
  const left = pillarX(pillar, distance);
  const right = left + HOVER_PILLAR_W;
  const overlaps = right > HOVER_DISC_X - HOVER_DISC_R && left < HOVER_DISC_X + HOVER_DISC_R;
  if (!overlaps) return false;
  const inside = (top: number, h: number) => y - HOVER_DISC_R >= top && y + HOVER_DISC_R <= top + h;
  if (inside(hoverGapTop(pillar, tick), pillar.gapH)) return false;
  if (pillar.gap2Top !== undefined && inside(pillar.gap2Top, pillar.gap2H ?? 0)) return false;
  return true;
}

function stepRev2(state: HoverState, tapped: boolean): HoverState {
  if (isOver(state)) return state;
  const vy = clampInt(tapped ? HOVER_IMPULSE : state.vy + HOVER_GRAVITY, -HOVER_TERMINAL, HOVER_TERMINAL);
  const y = state.y + vy;
  const tick = state.tick + 1;
  const distance = state.distance + hoverScroll(state.gates);
  let gates = state.gates;
  while (gates < state.pillars.length && distance > passedAt(state.pillars[gates]!)) gates += 1;

  const ceiling = y - HOVER_DISC_R <= 0;
  const floor = y + HOVER_DISC_R >= hoverBottom(state);
  const crashed = ceiling || floor || state.pillars.some((pillar) => hitsRev2(pillar, distance, y, tick));
  // A star counts when the disc touches it (and the disc did not crash this tick).
  let stars = state.stars ?? 0;
  let starsTaken = state.starsTaken ?? [];
  if (!crashed) {
    const reach = (HOVER_DISC_R + HOVER_STAR_R) * (HOVER_DISC_R + HOVER_STAR_R);
    state.pillars.forEach((pillar, index) => {
      const starY = hoverStarY(pillar, tick);
      if (starY === null || starsTaken.includes(index)) return;
      const dx = pillarX(pillar, distance) + (HOVER_PILLAR_W >> 1) - HOVER_DISC_X;
      const dy = starY - y;
      if (Math.abs(dx) > HOVER_DISC_R + HOVER_STAR_R) return;
      if (dx * dx + dy * dy <= reach) {
        starsTaken = [...starsTaken, index];
        stars += 1;
      }
    });
  }
  const next: HoverState = { ...state, tick, y, vy, distance, gates, stars, starsTaken };
  if (crashed) return { ...next, crashed: true, endedTick: tick };
  if (tick >= HOVER_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function step(state: HoverState, tapped: boolean): HoverState {
  if (state.rev === HOVER_REV) return stepRev2(state, tapped);
  if (isOver(state)) return state;

  const vy = clampInt(
    tapped ? HOVER_IMPULSE : state.vy + HOVER_GRAVITY,
    -HOVER_TERMINAL,
    HOVER_TERMINAL,
  );
  const y = state.y + vy;
  const tick = state.tick + 1;

  // Speed follows the gates already passed, so the ramp is identical for
  // everyone on the same gate count.
  const distance = state.distance + hoverScroll(state.gates);
  let gates = state.gates;
  while (gates < state.pillars.length && distance > passedAt(state.pillars[gates]!)) gates += 1;

  const next: HoverState = { ...state, tick, y, vy, distance, gates };

  const ceiling = y - HOVER_DISC_R <= 0;
  const floor = y + HOVER_DISC_R >= HOVER_WORLD_BOTTOM;
  const crashed = ceiling || floor || state.pillars.some((pillar) => hits(pillar, distance, y));
  if (crashed) return { ...next, crashed: true, endedTick: tick };
  if (tick >= HOVER_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

/* =========================== Integrity checks ========================== */

export const HOVER_CHECKPOINT_INTERVAL = 300;

export interface HoverCheckpointState {
  tick: number;
  y: number;
  vy: number;
  speed: number;
  gates: number;
  nextPillarX: number;
  nextGapTop: number;
  nextGapH: number;
}

export interface HoverCheckpoint extends HoverCheckpointState {
  checksum: number;
}

/** The exact integer state used for permanent client/server integrity checks. */
export function hoverCheckpointState(state: HoverState): HoverCheckpointState {
  const next = state.pillars[state.gates];
  return {
    tick: state.tick,
    y: state.y,
    vy: state.vy,
    speed: hoverScroll(state.gates),
    gates: state.gates,
    nextPillarX: next ? pillarX(next, state.distance) : 0,
    nextGapTop: next ? hoverGapTop(next, state.tick) : 0,
    nextGapH: next?.gapH ?? 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function hoverCheckpoint(state: HoverState): HoverCheckpoint {
  const snapshot = hoverCheckpointState(state);
  let checksum = 0x811c9dc5;
  // hoverRev 2 folds its stars into the checksum; the encoded fields stay the same.
  const extra = state.rev === HOVER_REV ? [state.stars ?? 0, ...(state.starsTaken ?? [])] : [];
  // hoverRev 4 (Tuning C) adds its marker last; hoverRev 5 (Tuning E) its world height after it.
  if (state.tunec) extra.push(state.tunec);
  if (state.worldH) extra.push(state.worldH);
  for (const value of [...Object.values(snapshot), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

function isOver(state: HoverState): boolean {
  return state.crashed || state.tick >= HOVER_RUN_TICKS;
}

export function hoverSurvived(state: HoverState): boolean {
  return !state.crashed && state.tick >= HOVER_RUN_TICKS;
}

function score(state: HoverState): number {
  if (state.rev === HOVER_REV) return hoverScoreV2(state);
  return clampInt(Math.round(HOVER_ALL_GATES_SCORE * state.gates / Math.max(1, state.totalGates)), 0, HOVER_ALL_GATES_SCORE);
}

/** hoverRev 2: up to 130 for barriers and up to 20 for stars, cap 150. */
export function hoverScoreV2(state: HoverState): number {
  const barriers = Math.round((HOVER_V2_GATES_SCORE * state.gates) / Math.max(1, state.totalGates));
  const stars = Math.round((HOVER_V2_STARS_SCORE * (state.stars ?? 0)) / Math.max(1, state.totalStars ?? 0));
  return clampInt(Math.min(barriers, HOVER_V2_GATES_SCORE) + Math.min(stars, HOVER_V2_STARS_SCORE), 0, 150);
}

/* ================================ Drawing ============================== */

export const HOVER_BG = "#0B0B0F";
export const HOVER_DISC_COLOUR = "#F5B82E";
export const HOVER_PILLAR_COLOUR = "#2ED3B7";
export const HOVER_CRASH_COLOUR = "#FF4D4D";

/** Draws purely from the state — no animation lives outside the sim. */
function draw(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  const H = hoverWorldH(state);
  const scale = Math.min(size.width / HOVER_WORLD_W, size.height / H);
  const offsetX = (size.width - HOVER_WORLD_W * scale) / 2;
  const offsetY = (size.height - H * scale) / 2;

  ctx.save();
  ctx.fillStyle = HOVER_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = HOVER_PILLAR_COLOUR;
  for (const pillar of state.pillars) {
    const left = px(pillarX(pillar, state.distance));
    const width = px(HOVER_PILLAR_W);
    if (left > HOVER_WORLD_W || left + width < 0) continue;
    const top = px(hoverGapTop(pillar, state.tick));
    const gap = px(pillar.gapH);
    ctx.fillRect(left, 0, width, Math.max(0, top));
    if (pillar.gap2Top !== undefined) {
      const top2 = px(pillar.gap2Top);
      const gap2 = px(pillar.gap2H ?? 0);
      ctx.fillRect(left, top + gap, width, Math.max(0, top2 - top - gap));
      ctx.fillRect(left, top2 + gap2, width, Math.max(0, H - top2 - gap2));
    } else ctx.fillRect(left, top + gap, width, Math.max(0, H - top - gap));
  }

  ctx.beginPath();
  ctx.fillStyle = state.crashed ? HOVER_CRASH_COLOUR : HOVER_DISC_COLOUR;
  ctx.arc(px(HOVER_DISC_X), px(state.y), px(HOVER_DISC_R), 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Gates ${state.gates} / ${state.totalGates}`, 12, 12);
  ctx.textAlign = "right";

  if (state.crashed) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, HOVER_WORLD_W, H);
  }

  ctx.restore();
}

export const hoverGame: ArcadeGame<HoverState> = {
  key: "hover",
  runTicks: HOVER_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
};

/** hoverRev 2 (stars, two-gap and moving barriers). Same step/score dispatch; init builds the new course. */
export const hoverRev2Game: ArcadeGame<HoverState> = { ...hoverGame, init: initRev2 };

/** The game for a stored round: its hoverRev picks the rules (absent = original). */
export function hoverGameFor(rev?: number | null): ArcadeGame<HoverState> {
  if (rev === HOVER_REV_TALL) return hoverTallGame;
  if (rev === HOVER_REV_TUNEC) return hoverTunecGame;
  if (rev === HOVER_REV_BAND) return hoverBandGame;
  return rev === HOVER_REV ? hoverRev2Game : hoverGame;
}

/* ================= Oct 2026 score bands (hoverRev 3) ================= */

/** Score-band revision (puzzle.hoverRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const HOVER_REV_BAND = 3;
/** Barriers count 3 and gold stars 2; 140 at every barrier and star; lasting the minute adds 10. */
export const HOVER_BAND_CURVE = bandCurve([0, 24, 45, 65, 100, 123, 146], [0, 70, 100, 125, 136, 138, 140]);
export function hoverBandParts(state: HoverState): BandParts {
  const units = 3 * Math.max(0, state.gates) + 2 * (state.stars ?? 0);
  const finished = hoverSurvived(state);
  return { units, points: bandPoints(state.worldH ? HOVER_V5_BAND_CURVE : state.tunec ? HOVER_V4_BAND_CURVE : HOVER_BAND_CURVE, units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${state.gates} / ${state.totalGates} barriers · ${state.stars ?? 0} stars`, bonusText: "Lasted the minute" };
}

function scoreBand(state: HoverState): number {
  return bandTotal(hoverBandParts(state), Boolean(state.acted));
}

export const hoverBandGame: ArcadeGame<HoverState> = { ...hoverRev2Game, init: (seed) => bandInit(hoverRev2Game.init(seed)) };

/* ================= Tuning C (hoverRev 4, Oct 2026) ================= */

/**
 * hoverRev 4 (Tuning C): hoverRev 3 play unchanged, scored about 10 % lower
 * (Joe found Hover a little lenient): every knot below the top keeps its units
 * and drops to nine tenths of its points; every barrier and star still reaches
 * 140, plus 10 for lasting the minute. States add `tunec: 1`.
 */
export const HOVER_REV_TUNEC = 4;
export const HOVER_V4_BAND_CURVE = bandCurve([0, 24, 45, 65, 100, 123, 146], [0, 63, 90, 112, 122, 124, 140]);
export const hoverTunecGame: ArcadeGame<HoverState> = { ...hoverBandGame, init: (seed) => ({ ...hoverBandGame.init(seed), tunec: 1 }) };

/* ================= Tuning E (hoverRev 5, Oct 2026) ================= */

/**
 * hoverRev 5 (Tuning E): a taller world (390 × HOVER_TALL_H, the same for every
 * player) so the arena fills a 390 × 844 phone down to the usual gap. The
 * course is the hoverRev 4 course (same spacing, gap sizes, kinds, stars, slides
 * and scroll ramp), with the whole course drifting slowly up and down over the
 * extra height: every barrier moves down by hoverDrift(index), a seeded integer
 * triangle wave over the barrier index (0 … the extra height, a full cycle every
 * HOVER_DRIFT_PERIOD barriers). Both gaps of a barrier move together, so every
 * gap keeps its size, every star its place in its gap, every two-gap barrier its
 * wall, and each climb from one barrier to the next changes by at most
 * HOVER_DRIFT_STEP px: the flying is as hard as before, spread over the whole
 * height. (Stretching the course with the world made some late drops longer
 * than the disc can fall between barriers at top speed.) The disc starts at
 * its old height plus the first barrier's drift. Scored on HOVER_V5_BAND_CURVE.
 * States add `worldH`, folded into the checkpoint checksum last.
 */
export const HOVER_REV_TALL = 5;
export const HOVER_TALL_H = 735;
/**
 * The flying is unchanged, so the Tuning C curve stands (re-measured with
 * scripts/arcade-skill-bands.ts --rev=e), but for its 123-unit knot at 125
 * (was 124): with it one barrier short of a full run is within 12 of finishing,
 * as the band rules ask (Tuning C's curve missed by a tenth of a point).
 */
export const HOVER_V5_BAND_CURVE = bandCurve([0, 24, 45, 65, 100, 123, 146], [0, 63, 90, 112, 122, 125, 140]);
/** Barriers per full drift cycle (down and back up). */
export const HOVER_DRIFT_PERIOD = 16;
/** The most the drift changes between neighbouring barriers, px. */
export const HOVER_DRIFT_STEP = Math.ceil((HOVER_TALL_H - HOVER_WORLD_H) / (HOVER_DRIFT_PERIOD >> 1));

/** The drift (fixed-point, 0 … the extra height) of barrier `index` on a seed's course. */
export function hoverDrift(seed: number, index: number, bottom: number): number {
  const extra = bottom - HOVER_WORLD_BOTTOM;
  const phase = rngBelow((seed ^ 0x4e0f_d21a) | 0, HOVER_DRIFT_PERIOD).value;
  const half = HOVER_DRIFT_PERIOD >> 1;
  const p = (index + phase) % HOVER_DRIFT_PERIOD;
  const tri = p < half ? p : HOVER_DRIFT_PERIOD - p;
  return Math.trunc((extra * tri) / half);
}

function initTall(seed: number): HoverState {
  const base = hoverTunecGame.init(seed);
  const bottom = HOVER_TALL_H * 256;
  const pillars = base.pillars.map((pillar, index) => {
    const drift = hoverDrift(seed, index, bottom);
    const out: HoverPillar = { ...pillar, gapTop: pillar.gapTop + drift };
    if (pillar.gap2Top !== undefined) out.gap2Top = pillar.gap2Top + drift;
    return out;
  });
  return { ...base, y: base.y + hoverDrift(seed, 0, bottom), pillars, worldH: HOVER_TALL_H };
}

export const hoverTallGame: ArcadeGame<HoverState> = { ...hoverTunecGame, init: initTall };

/** The world height (px) a stored round's hoverRev plays in. */
export function hoverWorldHFor(rev?: number | null): number {
  return rev === HOVER_REV_TALL ? HOVER_TALL_H : HOVER_WORLD_H;
}
