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
import { BAND_STRICT_MARK, bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

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
  /** hoverRev 9 only: a tight gate, a narrow gold-rimmed extra gap (top and height, fixed-point). */
  tightTop?: number;
  tightH?: number;
}

/** hoverRev 9: one star of a star chain, fixed in the world (x0 scrolls like a pillar's). */
export interface HoverChainStar {
  x0: number;
  y: number;
}

/** hoverRev 9: a star chain in the open space after barrier `after`, laid on one flap's arc. */
export interface HoverChain {
  after: number;
  stars: HoverChainStar[];
}

/** hoverRev 9: a shield pickup in the open space after barrier `after`. */
export interface HoverPickup {
  after: number;
  x0: number;
  y: number;
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
  /** hoverRev 9 only (the 200 expansion): 1 marks the expansion rules; every field below is absent on earlier rounds. */
  xp?: number;
  /** Tight gates threaded and the pillar index of each. */
  tight?: number;
  tightTaken?: number[];
  /** The barrier being threaded through its tight gate cleanly (≥ 0), failed on it (−2 − index), or none (−1). */
  tightOn?: number;
  /** The course's star chains, the stars taken (chain × 8 + star) and the chains completed. */
  chains?: HoverChain[];
  chainHits?: number[];
  chainsDone?: number;
  /** The course's shield pickups and the ones taken (their index). */
  pickups?: HoverPickup[];
  pickupsTaken?: number[];
  /** 1 while a shield is held; ticks of invulnerability left after one broke; shields broken. */
  shield?: number;
  invuln?: number;
  shieldBreaks?: number;
  /**
   * The centre line through each tight gate (new on hoverRev 9): the gate being measured (the barrier
   * index while the saucer's centre is within its columns, else −1), the furthest the saucer's centre has
   * been from the line on it so far (fixed-point), and each gate threaded with a centre grade
   * (index × 4 + grade, grade 1–3) and their points.
   */
  ctrOn?: number;
  ctrDev?: number;
  ctrLog?: number[];
  ctrPts?: number;
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
  if (state.xp) return stepExpand(state, tapped);
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
  // hoverRev 9 (the 200 expansion) folds its feature state in after them.
  if (state.xp) extra.push(state.xp, state.tight ?? 0, state.tightOn ?? -1, state.chainsDone ?? 0, state.chainHits?.length ?? 0, state.pickupsTaken?.length ?? 0, state.shield ?? 0, state.invuln ?? 0, state.shieldBreaks ?? 0, state.ctrOn ?? -1, state.ctrDev ?? 0, state.ctrPts ?? 0);
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
  if (rev === HOVER_REV_EXPAND) return hoverExpandGame;
  if (rev === HOVER_REV_STRICT || rev === HOVER_REV_PARKED) return hoverStrictGame;
  if (rev === HOVER_REV_TARGET) return hoverTargetGame;
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
  if (state.xp) return hoverExpandParts(state);
  const units = 3 * Math.max(0, state.gates) + 2 * (state.stars ?? 0);
  const finished = hoverSurvived(state);
  return { units, points: bandPoints(bandCurveOf(state, state.worldH ? HOVER_V5_BAND_CURVE : state.tunec ? HOVER_V4_BAND_CURVE : HOVER_BAND_CURVE), units), bonus: finished ? BAND_FINISH_BONUS : 0, penalty: 0, finished, text: `${state.gates} / ${state.totalGates} barriers · ${state.stars ?? 0} stars`, bonusText: "Lasted the minute" };
}

function scoreBand(state: HoverState): number {
  if (state.xp) return bandTotal(hoverExpandParts(state), Boolean(state.acted), HOVER_V9_MAX);
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
  if (rev === HOVER_REV_EXPAND) return HOVER_EXPAND_H;
  return rev === HOVER_REV_TALL || rev === HOVER_REV_TARGET || rev === HOVER_REV_STRICT || rev === HOVER_REV_PARKED ? HOVER_TALL_H : HOVER_WORLD_H;
}

/* ================= Scoring targets (hoverRev 6, 18 Oct 2026) ================= */

/**
 * hoverRev 6 (scoring targets, docs/scoring-targets.md): hoverRev 5 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const HOVER_REV_TARGET = 6;
export const hoverTargetGame = bandTargetGame(hoverTallGame);
/** The curve new rounds score on: HOVER_V5_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const HOVER_V6_BAND_CURVE = bandRetarget(HOVER_V5_BAND_CURVE);


/* ================= Score bands (hoverRev 7, 19 Oct 2026) ================= */

/**
 * hoverRev 7 (score bands, docs/scoring-targets.md): hoverRev 6 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const HOVER_REV_STRICT = 7;
export const hoverStrictGame = bandStrictGame(hoverTargetGame);
/** The curve new rounds score on: HOVER_V5_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const HOVER_V7_BAND_CURVE = bandStrict(HOVER_V5_BAND_CURVE);

/* ================= The 200 expansion (hoverRev 9, 26 Oct 2026) ================= */

/**
 * hoverRev 9 (the 200 expansion, docs/scoring-200.md): Hover scores up to 200.
 *
 * World: 390 × HOVER_EXPAND_H, the height a 390-wide world takes when it fills the iPhone 11
 * home-screen arena (414 × 772) edge to edge, so the world is as large on screen as it can be.
 * The course is hoverRev 7's (the same seeded barriers, gap sizes, kinds, gold stars, slides,
 * spacing and scroll ramp), drifting over the whole height (hoverDrift on this world's floor),
 * and three features are laid on it at init from their own PRNG stream (seed ^ 0x7e1a5c03):
 *
 *  - Tight gates (HOVER_TIGHT_GATES): on plain barriers (one still gap, no star) an extra
 *    gold-rimmed gap only HOVER_TIGHT_H high (the narrowest normal gap is 100 px), above or
 *    below the main gap with solid wall between. Threading it cleanly (inside it on every tick
 *    the saucer overlaps the barrier, no shield breaking there) scores HOVER_TIGHT_POINTS.
 *  - Star chains (HOVER_CHAINS, exactly that many on every course): 5–7 stars in the open space
 *    between two barriers (on most courses neither with a gold star and the second one still; a
 *    course short of room relaxes those rules, passes 3 and 4), laid on the top of the exact arc of
 *    one flap at that stretch's scroll speed (so one well-timed tap from the right height sweeps them
 *    all). Each star is collected by touch like a gold star; collecting every star of a chain scores
 *    HOVER_CHAIN_POINTS.
 *  - Shield pickups (HOVER_PICKUPS): bubbles at fixed seeded points (one early, one mid-course) in the
 *    open space between two barriers, the same for every player; touching one with no shield held
 *    gives a shield (one at a time). A crash with a shield (a barrier, the floor or the ceiling)
 *    breaks it instead: the saucer flies on, untouchable for HOVER_SHIELD_INVULN ticks (barriers pass
 *    through it; the floor bounces it up with a tap's kick, the ceiling stops its climb). The shield
 *    scores nothing itself.
 *  - The centre line (new on hoverRev 9): every tight gate has a line through its middle. On a clean
 *    thread, the furthest the saucer's centre strays from it while within the barrier's columns
 *    grades the pass (HOVER_CENTRE_TOL: 3, 2 or 1 points).
 *
 * Score: the base (barriers 3, gold stars 2, on HOVER_V9_BAND_CURVE to 140, plus 10 for lasting
 * the minute; at most 150) plus the skill points (5 a tight gate, 5 a whole chain, the centre
 * grades: hoverSkillRaw, at most HOVER_SKILL_RAW_MAX) paid on the rising HOVER_SKILL_PAY (at most
 * 50), capped at HOVER_V9_MAX (200). 200 only for every barrier, star, tight gate, chain and a
 * dead-centre line through every gate.
 * States add `xp` and the feature fields, folded into the checkpoint checksum after the rest.
 */
/**
 * The expansion's stamp. It folds in the parked Expansion E1 revision (hoverRev 8 on an unmerged branch),
 * which was never dealt: nothing names or deals 8, and a round stamped 8 would play as hoverRev 7 (the
 * revision before it; none exists).
 */
export const HOVER_REV_EXPAND = 9;
/** The parked, never-dealt expansion stamp: plays as hoverRev 7 (see HOVER_REV_EXPAND). */
const HOVER_REV_PARKED = 8;
export const HOVER_EXPAND_H = 727;
/** hoverRev 9's first barrier: a warm-up gap this high (300 px; the course's first gaps are 150) round the start height. */
export const HOVER_OPEN_H = 76_800;
/** A tight gate is 80 px high (the disc is 22 px across; the narrowest normal gap is 100 px). */
export const HOVER_TIGHT_H = 20_480;
/** Solid wall kept between a tight gate and the barrier's main gap, at least (fixed-point). */
export const HOVER_TIGHT_WALL = 14_336;
/** Tight gates, chains and pickups keep this far from the floor and ceiling (fixed-point). */
export const HOVER_FEATURE_EDGE = 6_144;
/** The farthest a tight gate sits from the neighbouring barriers' gaps, so it is always reachable (fixed-point). */
export const HOVER_TIGHT_REACH = 46_080;
export const HOVER_TIGHT_GATES = 5;
export const HOVER_TIGHT_FROM = 4;
export const HOVER_CHAINS = 5;
export const HOVER_CHAIN_FROM = 2;
/** A chain covers the top of one flap's hump: from HOVER_CHAIN_K0 ticks after the tap, for HOVER_CHAIN_TICKS ticks. */
export const HOVER_CHAIN_K0 = 4;
export const HOVER_CHAIN_TICKS = 28;
/** Chain stars are at least this far apart along the course (fixed-point). */
export const HOVER_CHAIN_GAP = 4_096;
/** The most two barriers' gaps differ for a chain between them (fixed-point). */
export const HOVER_CHAIN_STEP = 16_384;
/** The most the gap after a chain may differ from the gap of the barrier after that (fixed-point). */
export const HOVER_CHAIN_ONWARD = 40_960;
export const HOVER_PICKUPS = 2;
export const HOVER_SHIELD_R = 2_560;
export const HOVER_SHIELD_INVULN = 45;
export const HOVER_TIGHT_POINTS = 5;
export const HOVER_CHAIN_POINTS = 5;
/**
 * The centre line through a tight gate: on a clean thread, the furthest the saucer's centre strays from
 * the gate's middle while it is within the barrier's columns grades it 3 (within HOVER_CENTRE_TOL[0]),
 * 2 or 1 (fixed-point). The slowest gate's best arc strays about 4.3 px, so 3 is open on every gate with room to spare.
 */
export const HOVER_CENTRE_TOL = [1_536, 2_560, 3_840] as const;
export const HOVER_CENTRE_MAX_GRADE = 3;
/** The tight gate's centre line height (fixed-point). */
export function hoverCentreY(p: HoverPillar): number {
  return (p.tightTop ?? 0) + ((p.tightH ?? 0) >> 1);
}
/** A centre-line grade (0–3) for the furthest the saucer strayed (fixed-point). */
export function hoverCentreGrade(dev: number): number {
  return dev <= HOVER_CENTRE_TOL[0] ? 3 : dev <= HOVER_CENTRE_TOL[1] ? 2 : dev <= HOVER_CENTRE_TOL[2] ? 1 : 0;
}
export const HOVER_SKILL_MAX = 50;
/** hoverRev 9's cap (the round maximum it was built for, roundMax.ts). */
export const HOVER_V9_MAX = 200;
export const HOVER_SKILL_RAW_MAX = HOVER_TIGHT_GATES * (HOVER_TIGHT_POINTS + HOVER_CENTRE_MAX_GRADE) + HOVER_CHAINS * HOVER_CHAIN_POINTS;
/**
 * The skill pay scale (raw skill points → paid, as Breaker's BRK_V9_SKILL_PAY): light use pays little and
 * the full HOVER_SKILL_MAX needs every tight gate, chain and dead-centre line.
 */
export const HOVER_SKILL_PAY = bandCurve([0, 15, 30, 45, 55, HOVER_SKILL_RAW_MAX], [0, 6, 20, 32, 40, HOVER_SKILL_MAX]);
/**
 * The base curve: barriers 3 and gold stars 2, 140 at all 42 barriers and 10 stars (plus 10
 * for the minute). hoverRev 7's strict curve with its middle knots a few points lower
 * (scripts/arcade-skill-bands.ts --rev=x): the shields and the warm-up gate carry the simulated
 * good player a few barriers further than on hoverRev 7, so its median stays within 10 % of it.
 */
export const HOVER_V9_BAND_CURVE = bandCurve(
  [0, 24, 27, 42, 45, 65, 89, 100, 146],
  [0, 68, 70, 97, 101, 112, 118, 139, 140],
);

/** RISE[k]: the disc's height change k ticks after the tap tick (k = 0 is the tap tick itself), fixed-point. */
const HOVER_RISE: number[] = (() => {
  const out: number[] = [];
  let v = HOVER_IMPULSE;
  let y = 0;
  for (let k = 0; k <= HOVER_CHAIN_K0 + HOVER_CHAIN_TICKS; k++) {
    if (k > 0) v = clampInt(v + HOVER_GRAVITY, -HOVER_TERMINAL, HOVER_TERMINAL);
    y += v;
    out.push(y);
  }
  return out;
})();

/** The height one flap climbs (fixed-point): the top of its arc above the tap. */
const HOVER_ARC = -Math.min(...HOVER_RISE);
/** The room kept under a tight gate's lowest centre line's arc, above the floor (fixed-point). */
const HOVER_CENTRE_FLOOR = 1_024;

/** The distance after each tick of a crash-free run (the scroll ramp depends only on barriers passed). */
const HOVER_CLEAN_DIST: number[] = (() => {
  const xs = Array.from({ length: HOVER_GATE_COUNT }, (_, i) => HOVER_FIRST_X + i * HOVER_SPACING);
  const out = [0];
  let gates = 0;
  let distance = 0;
  for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
    distance += hoverScroll(gates);
    while (
      gates < xs.length &&
      distance > xs[gates]! + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)
    )
      gates += 1;
    out.push(distance);
  }
  return out;
})();

/** The first tick of a crash-free run whose distance reaches `d`. */
function cleanTickAt(d: number): number {
  let lo = 0;
  let hi = HOVER_RUN_TICKS;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (HOVER_CLEAN_DIST[mid]! >= d) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** A barrier's gaps (top, height) at a tick: the (moving) first gap and the second one. */
function gapsAt(p: HoverPillar, tick: number): [number, number][] {
  const out: [number, number][] = [[hoverGapTop(p, tick), p.gapH]];
  if (p.gap2Top !== undefined) out.push([p.gap2Top, p.gap2H ?? 0]);
  return out;
}

/** The tick a crash-free run's disc is level with a barrier's middle. */
function middleTick(p: HoverPillar): number {
  return cleanTickAt(p.x0 + (HOVER_PILLAR_W >> 1) - HOVER_DISC_X);
}

/** Scrolled distance at which a barrier is passed (its gate counts), and at which the disc first overlaps it. */
const passDistance = (p: HoverPillar) => p.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R);
const enterDistance = (p: HoverPillar) => p.x0 - (HOVER_DISC_X + HOVER_DISC_R);

/** The course features for a hoverRev 9 course (pillars already drifted; tight gates are set on them). */
function buildFeatures(
  seed: number,
  pillars: HoverPillar[],
  bottom: number,
): { chains: HoverChain[]; pickups: HoverPickup[] } {
  let rng = (seed ^ 0x7e1a_5c03) | 0;
  const draw = (n: number) => {
    const drawn = rngBelow(rng, Math.max(1, n));
    rng = drawn.state;
    return drawn.value;
  };
  const reachable = HOVER_REACHABLE_GATES;
  const centres = (i: number) =>
    gapsAt(pillars[i]!, middleTick(pillars[i]!)).map(([t, h]) => t + (h >> 1));
  const nearest = (list: number[], c: number) =>
    list.reduce((best, v) => (Math.abs(v - c) < Math.abs(best - c) ? v : best), list[0]!);
  const plain = (p: HoverPillar) =>
    p.gap2Top === undefined && p.movePhase === undefined && p.starDy === undefined;
  const pickFrom = <T>(list: T[]): T => list.splice(draw(list.length), 1)[0]!;

  // Tight gates. A second, looser pass (rarely needed) makes sure every course has them all.
  const tight = new Set<number>();
  for (const relax of [0, 1]) {
    const reach = relax ? (HOVER_TIGHT_REACH * 4) / 3 : HOVER_TIGHT_REACH;
    const tightCandidates: number[] = [];
    for (let i = HOVER_TIGHT_FROM; i < reachable - 1; i++)
      if (plain(pillars[i]!) && !tight.has(i)) tightCandidates.push(i);
    while (tight.size < HOVER_TIGHT_GATES && tightCandidates.length) {
      const i = pickFrom(tightCandidates);
      if ([...tight].some((j) => Math.abs(j - i) < (relax ? 2 : 3))) continue;
      const p = pillars[i]!;
      const half = HOVER_TIGHT_H >> 1;
      const prev = centres(i - 1);
      const next = centres(i + 1);
      const sides: [number, number][] = [
        [HOVER_FEATURE_EDGE + half, p.gapTop - HOVER_TIGHT_WALL - half],
        // A centre line is flown on the top of a flap's arc, so a low gate's centre keeps a whole arc above the floor.
        [p.gapTop + p.gapH + HOVER_TIGHT_WALL + half, Math.min(bottom - HOVER_FEATURE_EDGE - half, bottom - HOVER_DISC_R - HOVER_ARC - HOVER_CENTRE_FLOOR)],
      ];
      const ranges = sides
        .map(([lo, hi]): [number, number] => {
          // Kept within reach of a gap on each neighbouring barrier.
          const mid = (lo + hi) >> 1;
          const pc = nearest(prev, mid);
          const nc = nearest(next, mid);
          const a = Math.max(lo, pc - reach, nc - reach);
          const b = Math.min(hi, pc + reach, nc + reach);
          return [Math.ceil(a / 256), Math.floor(b / 256)];
        })
        .filter(([lo, hi]) => hi >= lo);
      if (!ranges.length) continue;
      const [lo, hi] = ranges[draw(ranges.length)]!;
      const centre = (lo + draw(hi - lo + 1)) << 8;
      p.tightTop = centre - half;
      p.tightH = HOVER_TIGHT_H;
      tight.add(i);
    }
  }

  // Star chains: between barriers i and i + 1 whose gaps (where the saucer meets them) are close.
  const chains: HoverChain[] = [];
  const used = new Set<number>();
  // Passes 3 and 4 (hoverRev 9's fixed count, HOVER_CHAINS on every course): a gold-star barrier either
  // side and a sliding barrier after the chain are allowed, then (4) gaps further apart.
  for (const relax of [0, 1, 2, 3, 4]) {
    const chainCandidates: number[] = [];
    for (let i = HOVER_CHAIN_FROM; i < reachable - 2; i++)
      if (
        !tight.has(i) &&
        !tight.has(i + 1) &&
        !used.has(i) &&
        (relax >= 3 ||
          (pillars[i]!.starDy === undefined &&
            pillars[i + 1]!.starDy === undefined &&
            pillars[i + 1]!.movePhase === undefined))
      )
        chainCandidates.push(i);
    while (chains.length < HOVER_CHAINS && chainCandidates.length) {
      const i = pickFrom(chainCandidates);
      // Never two chains in a row: the drop out of one and the climb into the next can't both be flown.
      if (used.has(i) || used.has(i - 1) || used.has(i + 1)) continue;
      const a = pillars[i]!;
      const b = pillars[i + 1]!;
      // The gap the saucer leaves barrier i by (the one nearest the next barrier's), as it is then.
      const exitTick = cleanTickAt(passDistance(a));
      const nextCentres = centres(i + 1);
      let best: { top: number; h: number; c1: number } | null = null;
      for (const [top, h] of gapsAt(a, exitTick)) {
        const c = top + (h >> 1);
        const c1 = nearest(nextCentres, c);
        if (!best || Math.abs(c1 - c) < Math.abs(best.c1 - (best.top + (best.h >> 1))))
          best = { top, h, c1 };
      }
      if (!best) continue;
      const c0 = best.top + (best.h >> 1);
      if (Math.abs(best.c1 - c0) > (Math.min(relax, 2) + 1 + (relax === 4 ? 2 : 0)) * HOVER_CHAIN_STEP) continue;
      // The gap a chain leads to must not leave the saucer too far from the barrier after it (at the
      // fastest scroll a long drop can be out of reach).
      const after2 = centres(i + 2);
      if (Math.abs(nearest(after2, best.c1) - best.c1) > (relax === 4 ? HOVER_CHAIN_ONWARD * 2 : relax >= 2 ? (HOVER_CHAIN_ONWARD * 3) >> 1 : HOVER_CHAIN_ONWARD)) continue;
      // Start height: between the two gaps, kept where the saucer can be as it leaves barrier i.
      const yStart = clampInt(
        (c0 + best.c1) >> 1,
        best.top + HOVER_DISC_R + 1_024,
        best.top + best.h - HOVER_DISC_R - 1_024,
      );
      if (
        yStart + HOVER_RISE[18]! < HOVER_FEATURE_EDGE + HOVER_STAR_R ||
        yStart > bottom - HOVER_FEATURE_EDGE - HOVER_STAR_R
      )
        continue;
      const speed = hoverScroll(i + 1);
      const span = HOVER_CHAIN_TICKS * speed;
      const window = enterDistance(b) - passDistance(a);
      const margin = 2_048 + HOVER_STAR_R;
      if (span + 2 * margin > window) continue;
      const tapDistance = passDistance(a) + ((window - span) >> 1) - HOVER_CHAIN_K0 * speed;
      // 5–7 stars, as many as keep every neighbouring pair HOVER_CHAIN_GAP apart at this speed.
      const tickOf = (j: number, m: number) => Math.round((j * HOVER_CHAIN_TICKS) / (m - 1));
      const fits = (m: number) => Array.from({ length: m - 1 }, (_, j) => tickOf(j + 1, m) - tickOf(j, m)).every((dk) => dk * speed >= HOVER_CHAIN_GAP);
      let n = 5 + draw(3);
      while (n >= 5 && !fits(n)) n -= 1;
      if (n < 5) continue;
      const stars: HoverChainStar[] = [];
      for (let j = 0; j < n; j++) {
        const k = HOVER_CHAIN_K0 + tickOf(j, n);
        stars.push({ x0: HOVER_DISC_X + tapDistance + k * speed, y: yStart + HOVER_RISE[k]! });
      }
      chains.push({ after: i, stars });
      used.add(i);
    }
  }
  chains.sort((x, y) => x.after - y.after);

  // Shield pickups: one early and one in the middle of the course, after a barrier no chain uses.
  const pickups: HoverPickup[] = [];
  for (const [from, to] of [
    [5, 15],
    [20, 32],
  ] as const) {
    const options: number[] = [];
    for (let i = from; i < to; i++) if (!used.has(i)) options.push(i);
    if (!options.length) continue;
    const i = pickFrom(options);
    const a = pillars[i]!;
    const b = pillars[i + 1]!;
    const c1 = centres(i + 1)[0]!;
    const c0 = nearest(centres(i), c1);
    const y = clampInt(
      (c0 + c1) >> 1,
      HOVER_FEATURE_EDGE + HOVER_SHIELD_R,
      bottom - HOVER_FEATURE_EDGE - HOVER_SHIELD_R,
    );
    const x0 = HOVER_DISC_X + ((passDistance(a) + enterDistance(b)) >> 1);
    pickups.push({ after: i, x0, y });
  }
  return { chains, pickups };
}

function initExpand(seed: number): HoverState {
  const base = hoverTunecGame.init(seed);
  const bottom = HOVER_EXPAND_H * 256;
  const pillars = base.pillars.map((pillar, index) => {
    const drift = hoverDrift(seed, index, bottom);
    const out: HoverPillar = { ...pillar, gapTop: pillar.gapTop + drift };
    if (pillar.gap2Top !== undefined) out.gap2Top = pillar.gap2Top + drift;
    return out;
  });
  const y = base.y + hoverDrift(seed, 0, bottom);
  // The first barrier is a warm-up: a HOVER_OPEN_H gap centred on the saucer's starting height.
  pillars[0] = { ...pillars[0]!, gapTop: y - (HOVER_OPEN_H >> 1), gapH: HOVER_OPEN_H };
  const { chains, pickups } = buildFeatures(seed, pillars, bottom);
  return {
    ...base,
    band: BAND_STRICT_MARK,
    y,
    pillars,
    worldH: HOVER_EXPAND_H,
    xp: 1,
    tight: 0,
    tightTaken: [],
    tightOn: -1,
    chains,
    chainHits: [],
    chainsDone: 0,
    pickups,
    pickupsTaken: [],
    shield: 0,
    invuln: 0,
    shieldBreaks: 0,
    ctrOn: -1,
    ctrDev: 0,
    ctrLog: [],
    ctrPts: 0,
  };
}

/** True when the disc (centre y) sits wholly inside a gap. */
const insideGap = (y: number, top: number, h: number) =>
  y - HOVER_DISC_R >= top && y + HOVER_DISC_R <= top + h;

/** True when the disc overlaps a barrier's columns at this distance. */
function overlaps(pillar: HoverPillar, distance: number): boolean {
  const left = pillarX(pillar, distance);
  return left + HOVER_PILLAR_W > HOVER_DISC_X - HOVER_DISC_R && left < HOVER_DISC_X + HOVER_DISC_R;
}

/** hoverRev 9 collision: overlapping, and inside none of the barrier's gaps (a tight gate counts as one). */
function hitsExpand(pillar: HoverPillar, distance: number, y: number, tick: number): boolean {
  if (!overlaps(pillar, distance)) return false;
  if (insideGap(y, hoverGapTop(pillar, tick), pillar.gapH)) return false;
  if (pillar.gap2Top !== undefined && insideGap(y, pillar.gap2Top, pillar.gap2H ?? 0)) return false;
  if (pillar.tightTop !== undefined && insideGap(y, pillar.tightTop, pillar.tightH ?? 0))
    return false;
  return true;
}

/** True when the disc touches a round object (radius r) at world x0, height oy. */
function touches(x0: number, oy: number, r: number, distance: number, y: number): boolean {
  const dx = x0 - distance - HOVER_DISC_X;
  const reach = HOVER_DISC_R + r;
  if (dx > reach || dx < -reach) return false;
  const dy = oy - y;
  return dx * dx + dy * dy <= reach * reach;
}

function stepExpand(state: HoverState, tapped: boolean): HoverState {
  if (isOver(state)) return state;
  let vy = clampInt(
    tapped ? HOVER_IMPULSE : state.vy + HOVER_GRAVITY,
    -HOVER_TERMINAL,
    HOVER_TERMINAL,
  );
  let y = state.y + vy;
  const tick = state.tick + 1;
  const distance = state.distance + hoverScroll(state.gates);
  let gates = state.gates;
  while (gates < state.pillars.length && distance > passedAt(state.pillars[gates]!)) gates += 1;

  let invuln = Math.max(0, (state.invuln ?? 0) - 1);
  let shield = state.shield ?? 0;
  let shieldBreaks = state.shieldBreaks ?? 0;
  const bottom = hoverBottom(state);
  const ceiling = y - HOVER_DISC_R <= 0;
  const floor = y + HOVER_DISC_R >= bottom;
  let crashed =
    ceiling || floor || state.pillars.some((pillar) => hitsExpand(pillar, distance, y, tick));
  if (crashed && (invuln > 0 || shield)) {
    // The shield takes the crash: it breaks and the saucer flies on, untouchable for a moment.
    if (invuln === 0) {
      shield = 0;
      shieldBreaks += 1;
      invuln = HOVER_SHIELD_INVULN;
    }
    if (floor) {
      y = bottom - HOVER_DISC_R - 256;
      vy = HOVER_IMPULSE;
    } else if (ceiling) {
      y = HOVER_DISC_R + 256;
      vy = 0;
    }
    crashed = false;
  }

  // Tight gates: threaded cleanly when the disc was inside the gate on every tick it overlapped the barrier.
  let tight = state.tight ?? 0;
  let tightTaken = state.tightTaken ?? [];
  let tightOn = state.tightOn ?? -1;
  let ctrOn = state.ctrOn ?? -1;
  let ctrDev = state.ctrDev ?? 0;
  let ctrLog = state.ctrLog ?? [];
  let ctrPts = state.ctrPts ?? 0;
  for (let g = state.gates; g < gates; g++) {
    if (tightOn === g) {
      tight += 1;
      tightTaken = [...tightTaken, g];
      // The centre line pays on a clean thread only, graded by the furthest the saucer strayed from it.
      const grade = ctrOn === g ? hoverCentreGrade(ctrDev) : 0;
      if (grade > 0) {
        ctrLog = [...ctrLog, g * 4 + grade];
        ctrPts += grade;
      }
    }
    if (tightOn === g || tightOn === -2 - g) tightOn = -1;
    if (ctrOn === g) {
      ctrOn = -1;
      ctrDev = 0;
    }
  }
  const ahead = state.pillars[gates];
  if (
    !crashed &&
    ahead?.tightTop !== undefined &&
    overlaps(ahead, distance) &&
    tightOn !== -2 - gates
  ) {
    tightOn = invuln === 0 && insideGap(y, ahead.tightTop, ahead.tightH ?? 0) ? gates : -2 - gates;
  }
  // The centre line: measured on every tick the saucer's centre is within the barrier's columns (the gate's depth).
  if (!crashed && ahead?.tightTop !== undefined && tightOn === gates) {
    const left = pillarX(ahead, distance);
    if (left <= HOVER_DISC_X && HOVER_DISC_X <= left + HOVER_PILLAR_W) {
      const dev = Math.abs(y - hoverCentreY(ahead));
      ctrDev = ctrOn === gates ? Math.max(ctrDev, dev) : dev;
      ctrOn = gates;
    }
  }

  // Gold stars (as hoverRev 2), chain stars and shield pickups, when the disc touches them.
  let stars = state.stars ?? 0;
  let starsTaken = state.starsTaken ?? [];
  let chainHits = state.chainHits ?? [];
  let chainsDone = state.chainsDone ?? 0;
  let pickupsTaken = state.pickupsTaken ?? [];
  if (!crashed) {
    state.pillars.forEach((pillar, index) => {
      const starY = hoverStarY(pillar, tick);
      if (starY === null || starsTaken.includes(index)) return;
      if (touches(pillar.x0 + (HOVER_PILLAR_W >> 1), starY, HOVER_STAR_R, distance, y)) {
        starsTaken = [...starsTaken, index];
        stars += 1;
      }
    });
    (state.chains ?? []).forEach((chain, c) => {
      chain.stars.forEach((star, j) => {
        const id = c * 8 + j;
        if (chainHits.includes(id) || !touches(star.x0, star.y, HOVER_STAR_R, distance, y)) return;
        chainHits = [...chainHits, id];
        if (chain.stars.every((_, k) => chainHits.includes(c * 8 + k))) chainsDone += 1;
      });
    });
    (state.pickups ?? []).forEach((pickup, k) => {
      if (
        shield ||
        pickupsTaken.includes(k) ||
        !touches(pickup.x0, pickup.y, HOVER_SHIELD_R, distance, y)
      )
        return;
      pickupsTaken = [...pickupsTaken, k];
      shield = 1;
    });
  }
  const next: HoverState = {
    ...state,
    tick,
    y,
    vy,
    distance,
    gates,
    stars,
    starsTaken,
    tight,
    tightTaken,
    tightOn,
    chainHits,
    chainsDone,
    pickupsTaken,
    shield,
    invuln,
    shieldBreaks,
    ctrOn,
    ctrDev,
    ctrLog,
    ctrPts,
  };
  if (crashed) return { ...next, crashed: true, endedTick: tick };
  if (tick >= HOVER_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

/** Tight gates and chains a course offers (all on its reachable part). */
export function hoverFeatureTotals(state: HoverState): { tight: number; chains: number } {
  return {
    tight: state.pillars.filter((p) => p.tightTop !== undefined).length,
    chains: state.chains?.length ?? 0,
  };
}

/**
 * The skill points before the pay scale: HOVER_TIGHT_POINTS a tight gate, HOVER_CHAIN_POINTS a whole star
 * chain and the centre-line grades (up to HOVER_CENTRE_MAX_GRADE a gate), at most HOVER_SKILL_RAW_MAX.
 * Every course holds exactly HOVER_TIGHT_GATES tight gates and HOVER_CHAINS chains.
 */
export function hoverSkillRaw(state: HoverState): number {
  return HOVER_TIGHT_POINTS * Math.min(HOVER_TIGHT_GATES, state.tight ?? 0) + HOVER_CHAIN_POINTS * Math.min(HOVER_CHAINS, state.chainsDone ?? 0) + Math.min(HOVER_TIGHT_GATES * HOVER_CENTRE_MAX_GRADE, state.ctrPts ?? 0);
}

/** The skill points paid (on HOVER_SKILL_PAY, at most HOVER_SKILL_MAX): what the score, HUD and stored run read. */
export function hoverFeatureBonus(state: HoverState): number {
  return bandPoints(HOVER_SKILL_PAY, hoverSkillRaw(state));
}

/** hoverRev 9 breakdown: the base on its curve, then the minute and the features as one bonus line. */
export function hoverExpandParts(state: HoverState): BandParts {
  const units = 3 * Math.max(0, state.gates) + 2 * (state.stars ?? 0);
  const finished = hoverSurvived(state);
  const totals = hoverFeatureTotals(state);
  const words = [
    ...(finished ? ["lasted the minute"] : []),
    ...(state.tight ? [`${state.tight} / ${totals.tight} tight gates`] : []),
    ...(state.chainsDone ? [`${state.chainsDone} / ${totals.chains} star chains`] : []),
    ...(state.ctrPts ? [`centre lines ${state.ctrPts}`] : []),
  ];
  const text = words.join(" · ");
  return {
    units,
    points: bandPoints(HOVER_V9_BAND_CURVE, units),
    bonus: (finished ? BAND_FINISH_BONUS : 0) + hoverFeatureBonus(state),
    penalty: 0,
    finished,
    text: `${state.gates} / ${state.totalGates} barriers · ${state.stars ?? 0} stars`,
    bonusText: text ? text[0]!.toUpperCase() + text.slice(1) : "Bonus",
  };
}

export const hoverExpandGame: ArcadeGame<HoverState> = { ...hoverStrictGame, init: initExpand };
