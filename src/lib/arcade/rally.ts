/**
 * Rally — an arcade game on the shared engine.
 *
 * One main ball and a paddle that follows the finger. Every return counts,
 * shrinks the paddle and speeds the ball up. Every ten seconds a gold ball
 * drops in through the top edge; its entry point, angle and speed are drawn
 * once at init from the seed. The opening angle and the small angle changes on
 * wall bounces come from the seeded generator carried in the state, so the
 * rally plays out identically on the phone and on the server.
 */

import {
  clampInt,
  inputRange,
  isqrt,
  px,
  rngBelow,
  setLength,
  ARCADE_INPUT_DRAG,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { stdEach, stdLine, stdPart, stdScore, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const RALLY_WORLD_W = 390;
export const RALLY_WORLD_H = 620;
export const RALLY_HUD_H = 44;
export const RALLY_WALL = 8;

export const RALLY_RUN_SECONDS = 60;
export const RALLY_RUN_TICKS = RALLY_RUN_SECONDS * TICKS_PER_SECOND;

export const RALLY_PADDLE_START_W = 120;
export const RALLY_PADDLE_MIN_W = 40;
export const RALLY_PADDLE_SHRINK = 5;
export const RALLY_PADDLE_H = 12;
export const RALLY_PADDLE_Y = 560;
export const RALLY_PADDLE_Y_FP = RALLY_PADDLE_Y * 256;
/** How far the paddle's top edge sits above the bottom of the court, px. */
export const RALLY_PADDLE_LIFT = RALLY_WORLD_H - RALLY_PADDLE_Y;

/** The world height (px) a state plays in: rallyRev 6's taller court, or the original 620. */
export function rallyWorldH(state: { worldH?: number }): number {
  return state.worldH ?? RALLY_WORLD_H;
}
/** The paddle's top edge (px) in a state's world: always RALLY_PADDLE_LIFT above the bottom. */
export function rallyPaddleY(state: { worldH?: number }): number {
  return rallyWorldH(state) - RALLY_PADDLE_LIFT;
}

export const RALLY_BALL_R = 7;
export const RALLY_BALL_R_FP = RALLY_BALL_R * 256;

/** 4.0 px a tick, 3% faster a hit, capped at 2.2× the start. */
export const RALLY_SPEED_START = 1024;
export const RALLY_SPEED_CAP = Math.trunc((RALLY_SPEED_START * 22) / 10);

/** A gold ball joins every ten seconds. */
export const RALLY_GOLD_INTERVAL = 10 * TICKS_PER_SECOND;
export const RALLY_GOLD_COUNT = 5;

/** A wall bounce nudges the angle by up to this much (1/256 px a tick). */
export const RALLY_JITTER = 28;
/** The ball never travels flatter than this, so a rally cannot stall. */
export const RALLY_MIN_VY = 120;

/** Par: thirty hits (gold hits count double). */
export const RALLY_PAR = 30;
export const RALLY_HIT_POINTS = 3;
export const RALLY_GOLD_POINTS = 2.5;
export const RALLY_POINTS_CAP = 110;
export const RALLY_SURVIVE_BONUS = 40;

export const RALLY_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, RALLY_WORLD_W]),
];

/* ------------------- Rev 2: wall targets and a bumper -------------------- */

/**
 * Targets-and-bumper revision (stored as puzzle.rallyRev = 2). The opening and
 * the gold-ball schedule are drawn exactly as before; the new draws continue
 * the PRNG stream after them, before play starts.
 */
export const RALLY_REV = 2;
/** Two target pads live on the far wall at a time, 44 px wide. */
export const RALLY_TARGETS_LIVE = 2;
export const RALLY_TARGET_W = 44;
/** A struck pad moves to the next spot on its seeded list (enough for any run). */
export const RALLY_TARGET_SPOTS = 48;
/** Points for a gold ball striking a target pad. */
export const RALLY_TARGET_POINTS = 3;
/** rallyRev 4 marker (Tuning B): pads keep to their own half. */
export const RALLY_TUNE = 1;
/** The bumper: a round post, radius 14 px, from 30 s; balls bounce off it like a mirror. */
export const RALLY_BUMPER_R = 14;
export const RALLY_BUMPER_FROM = 30 * TICKS_PER_SECOND;
/** Bumper centre band, whole px: clear of the walls, the HUD and the paddle. */
export const RALLY_BUMPER_X_MIN = 90;
export const RALLY_BUMPER_X_SPAN = 211;
export const RALLY_BUMPER_Y_MIN = 220;
export const RALLY_BUMPER_Y_SPAN = 141;
/** rallyRev 5 (Tuning F): a second mirror bumper for the final 15 seconds, at least this far (px, centres) from the first. */
export const RALLY_BUMPER2_FROM = 45 * TICKS_PER_SECOND;
export const RALLY_BUMPER2_GAP = 90;

/** Left edge (px) of the target pad at a spot index. */
export function rallyTargetLeft(spots: readonly number[], index: number): number {
  return spots[index % spots.length] ?? RALLY_WALL;
}

export function rallyPaddleW(hits: number): number {
  return Math.max(RALLY_PADDLE_MIN_W, RALLY_PADDLE_START_W - RALLY_PADDLE_SHRINK * hits);
}

/* ================================ State ================================ */

export interface RallyBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /**
   * rallyRev 10+ only: the spin curving the ball (rallyRev 10: 1/256 px a tick, a tick; rallyRev 11: sixteenths of
   * that at the start speed, scaled with the ball's speed), and 1 while a spin return still curves it.
   */
  spin?: number;
  spun?: number;
}

/** A gold ball's scheduled entry, fixed at init from the seed. */
export interface RallyEntry {
  tick: number;
  x: number;
  vx: number;
  vy: number;
}

export interface RallyState extends BandFields {
  tick: number;
  rng: number;
  aimX: number;
  paddleX: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  hits: number;
  goldHits: number;
  /** The fixed gold-ball schedule and the gold balls in play. */
  entries: RallyEntry[];
  golds: RallyBall[];
  dead: boolean;
  endedTick: number;
  /** Rev 2 only: the stamp, the seeded pad spots, the spot each live pad is on, targets struck and the bumper. */
  rev?: number;
  spots?: number[];
  live?: number[];
  targetHits?: number;
  bumper?: { x: number; y: number };
  bounces?: number;
  /** Rev 2 only, render only: the tick and spot of the last target strike. */
  struckTick?: number;
  struckLeft?: number;
  /** rallyRev 4 only (Tuning B): 1 = each pad keeps to its own half of the wall. Absent on every earlier round. */
  tune?: number;
  /** rallyRev 5 only (Tuning F): the second bumper, live from 45 s. Absent on every earlier round. */
  bumper2?: { x: number; y: number };
  /** rallyRev 5 only, render only: which bumper (0 or 1) the latest bounce came off. */
  bumped?: number;
  /** rallyRev 6 only (taller worlds): the court's height in px (RALLY_TALL_H). Absent = RALLY_WORLD_H. */
  worldH?: number;
  /**
   * rallyRev 10 only (the expansion, docs/expansions/e9.md). Absent on every earlier round. The marker (1 on rallyRev 10,
   * 2 on rallyRev 11's curving spin and longer-lived targets) and the court's width (420).
   */
  exp?: number;
  worldW?: number;
  /** Smoothed paddle speed (1/256 px a tick) and the blue ball's spin (spin shots aim; they pay nothing). */
  pv?: number;
  spin?: number;
  spun?: number;
  /** The gold bonus targets: their seeded schedule, the ones struck (bit n = target n) and the last strike (render only). */
  bonus?: RallyBonusTarget[];
  bonusHit?: number;
  bonusAt?: number;
}

/** rallyRev 10: one gold bonus target, fixed at init from the seed: when it appears and where (centre, whole px). */
export interface RallyBonusTarget {
  tick: number;
  x: number;
  y: number;
}

/** Total returns, which is what shrinks the paddle. */
export function rallyTotalHits(state: RallyState): number {
  return state.hits + state.goldHits;
}

function init(seed: number): RallyState {
  let rng = seed | 0;
  const lean = rngBelow(rng, 2 * 160 + 1);
  rng = lean.state;
  const opening = setLength(lean.value - 160, -256, RALLY_SPEED_START);

  const entries: RallyEntry[] = [];
  for (let index = 0; index < RALLY_GOLD_COUNT; index++) {
    const spot = rngBelow(rng, RALLY_WORLD_W - 2 * (RALLY_WALL + RALLY_BALL_R));
    rng = spot.state;
    const lane = rngBelow(rng, 2 * 160 + 1);
    rng = lane.state;
    const pace = rngBelow(rng, 420);
    rng = pace.state;
    const drop = setLength(lane.value - 160, 256, RALLY_SPEED_START - 180 + pace.value);
    entries.push({
      tick: (index + 1) * RALLY_GOLD_INTERVAL,
      x: RALLY_WALL + RALLY_BALL_R + spot.value,
      vx: drop.vx,
      vy: drop.vy,
    });
  }

  const paddleX = Math.round(RALLY_WORLD_W / 2);
  return {
    tick: 0,
    rng,
    aimX: paddleX,
    paddleX,
    x: paddleX * 256,
    y: (RALLY_HUD_H + 120) * 256,
    vx: opening.vx,
    vy: opening.vy,
    speed: RALLY_SPEED_START,
    hits: 0,
    goldHits: 0,
    entries,
    golds: [],
    dead: false,
    endedTick: 0,
  };
}

function isOver(state: RallyState): boolean {
  return state.dead || state.tick >= RALLY_RUN_TICKS;
}

export function rallySurvived(state: RallyState): boolean {
  return !state.dead && state.tick >= RALLY_RUN_TICKS;
}

/** A bounce nudge from the seeded generator, so both sides agree exactly. */
function nudge(
  rng: number,
  speed: number,
  vx: number,
  vy: number,
): { rng: number; vx: number; vy: number } {
  const draw = rngBelow(rng, 2 * RALLY_JITTER + 1);
  const shifted = setLength(vx + draw.value - RALLY_JITTER, vy, speed);
  let out = shifted;
  if (Math.abs(out.vy) < RALLY_MIN_VY) {
    out = setLength(out.vx, out.vy < 0 ? -RALLY_MIN_VY : RALLY_MIN_VY, speed);
  }
  return { rng: draw.state, vx: out.vx, vy: out.vy };
}

function step(state: RallyState, input: ArcadeInputEvent | null): RallyState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let aimX = state.aimX;
  if (input && input.k === ARCADE_INPUT_DRAG) aimX = clampInt(input.a, 0, RALLY_WORLD_W);
  const width = rallyPaddleW(rallyTotalHits(state));
  const half = Math.trunc(width / 2);
  const paddleX = clampInt(aimX, RALLY_WALL + half, RALLY_WORLD_W - RALLY_WALL - half);

  const next: RallyState = { ...state, tick, aimX, paddleX };
  let { speed, hits, goldHits, rng } = next;
  // Rev 2 only: live pads, strikes and the bumper (absent, so untouched, on older rounds).
  const rev2 = state.rev === RALLY_REV;
  const spots = state.spots ?? [];
  const live = rev2 ? [...(state.live ?? [])] : null;
  let targetHits = state.targetHits ?? 0;
  let bounces = state.bounces ?? 0;
  let struckTick = state.struckTick ?? 0;
  let struckLeft = state.struckLeft ?? 0;
  // Live bumpers in a fixed order: the first from 30 s, rallyRev 5's second from 45 s.
  const bumpers: { x: number; y: number }[] = [];
  if (rev2 && tick >= RALLY_BUMPER_FROM && state.bumper) bumpers.push(state.bumper);
  if (rev2 && tick >= RALLY_BUMPER2_FROM && state.bumper2) bumpers.push(state.bumper2);
  let bumped = state.bumped ?? 0;
  const top = (RALLY_HUD_H + RALLY_WALL) * 256;
  const leftWall = RALLY_WALL * 256;
  const rightWall = (RALLY_WORLD_W - RALLY_WALL) * 256;
  const paddleYFp = rallyPaddleY(state) * 256;
  const worldHFp = rallyWorldH(state) * 256;

  let golds = state.golds.map((ball) => ({ ...ball }));
  for (const entry of state.entries) {
    if (entry.tick === tick) {
      golds.push({ x: entry.x * 256, y: top + RALLY_BALL_R_FP, vx: entry.vx, vy: entry.vy });
    }
  }

  /** Runs one ball for a tick. Returns null when it fell off the bottom. */
  const move = (ball: RallyBall, gold: boolean): RallyBall | null => {
    let { x, y, vx, vy } = ball;
    for (let sub = 0; sub < 4; sub++) {
      const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
      const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);

      x += sx;
      if (x - RALLY_BALL_R_FP < leftWall || x + RALLY_BALL_R_FP > rightWall) {
        x =
          x - RALLY_BALL_R_FP < leftWall ? leftWall + RALLY_BALL_R_FP : rightWall - RALLY_BALL_R_FP;
        const turned = nudge(rng, speed, -vx, vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
      }

      y += sy;
      if (y - RALLY_BALL_R_FP < top) {
        y = top + RALLY_BALL_R_FP;
        // Rev 2: a gold ball striking a live pad on the far wall scores it; the pad moves on.
        if (gold && live) {
          const bx = px(x);
          for (let k = 0; k < live.length; k++) {
            const left = rallyTargetLeft(spots, live[k]!);
            if (bx + RALLY_BALL_R >= left && bx - RALLY_BALL_R <= left + RALLY_TARGET_W) {
              targetHits += 1;
              struckTick = tick;
              struckLeft = left;
              // rallyRev 4: a struck pad moves to its own next spot (same half of the
              // wall), so the two pads never overlap. Earlier revisions take the
              // next spot after the higher pad, which could put both in one half.
              live[k] = state.tune === RALLY_TUNE ? live[k]! + RALLY_TARGETS_LIVE : Math.max(...live) + 1;
              break;
            }
          }
        }
        const turned = nudge(rng, speed, vx, -vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
      }

      // Rev 2: the bumper reflects the ball like a mirror about the contact normal, speed kept.
      for (let bi = 0; bi < bumpers.length; bi++) {
        const bumper = bumpers[bi]!;
        const dx = x - bumper.x * 256;
        const dy = y - bumper.y * 256;
        const reach = (RALLY_BUMPER_R + RALLY_BALL_R) * 256;
        if (Math.abs(dx) < reach && Math.abs(dy) < reach) {
          const d = isqrt(dx * dx + dy * dy);
          if (d < reach) {
            const nx = d > 0 ? Math.trunc((dx * 1024) / d) : 0;
            const ny = d > 0 ? Math.trunc((dy * 1024) / d) : -1024;
            x = bumper.x * 256 + Math.trunc((nx * reach) / 1024);
            y = bumper.y * 256 + Math.trunc((ny * reach) / 1024);
            const vn = Math.trunc((vx * nx + vy * ny) / 1024);
            if (vn < 0) {
              let out = setLength(vx - Math.trunc((2 * vn * nx) / 1024), vy - Math.trunc((2 * vn * ny) / 1024), speed);
              if (Math.abs(out.vy) < RALLY_MIN_VY) out = setLength(out.vx, out.vy < 0 ? -RALLY_MIN_VY : RALLY_MIN_VY, speed);
              vx = out.vx;
              vy = out.vy;
              bounces += 1;
              bumped = bi;
            }
          }
        }
      }

      if (vy > 0 && y + RALLY_BALL_R_FP >= paddleYFp && y < paddleYFp + 4 * 256) {
        const offset = px(x) - (paddleX - half);
        if (offset >= -RALLY_BALL_R && offset <= width + RALLY_BALL_R) {
          if (gold) goldHits += 1;
          else hits += 1;
          speed = Math.min(RALLY_SPEED_CAP, Math.trunc((speed * 103) / 100));
          // Where it lands on the paddle steers the return.
          const fromCentre = Math.round(offset - half);
          const steered = setLength(
            Math.trunc((fromCentre * 256) / Math.max(1, half)) + Math.trunc(vx / 4),
            -Math.max(RALLY_MIN_VY, Math.abs(vy)),
            speed,
          );
          vx = steered.vx;
          vy = steered.vy;
          y = paddleYFp - RALLY_BALL_R_FP;
        }
      }

      if (y - RALLY_BALL_R_FP > worldHFp) return null;
    }
    return { x, y, vx, vy };
  };

  const main = move({ x: next.x, y: next.y, vx: next.vx, vy: next.vy }, false);
  if (main === null) {
    next.dead = true;
  } else {
    next.x = main.x;
    next.y = main.y;
    next.vx = main.vx;
    next.vy = main.vy;
  }

  const keptGolds: RallyBall[] = [];
  for (const ball of golds) {
    const moved = move(ball, true);
    if (moved !== null) keptGolds.push(moved);
  }
  golds = keptGolds;

  next.golds = golds;
  next.speed = speed;
  next.hits = hits;
  next.goldHits = goldHits;
  next.rng = rng;
  if (rev2) {
    next.live = live!;
    next.targetHits = targetHits;
    next.bounces = bounces;
    next.struckTick = struckTick;
    next.struckLeft = struckLeft;
    if (state.bumper2) next.bumped = bumped;
  }
  if (next.dead || tick >= RALLY_RUN_TICKS) next.endedTick = tick;
  return next;
}

function score(state: RallyState): number {
  // Only gold-ball hits score; the blue ball scores nothing but losing it ends the run.
  if (state.rev === RALLY_REV) return rallyRev2Score(state.goldHits, state.targetHits ?? 0);
  return clampInt(Math.floor(RALLY_GOLD_POINTS * state.goldHits), 0, 150);
}

/** Rev 2: floor(2.5 × gold-ball hits) + 3 per far-wall target the gold ball strikes, up to 150. */
export function rallyRev2Score(goldHits: number, targetHits: number): number {
  return clampInt(Math.floor(RALLY_GOLD_POINTS * goldHits) + RALLY_TARGET_POINTS * targetHits, 0, 150);
}

/* ============================= Checkpoints ============================= */

export const RALLY_CHECKPOINT_INTERVAL = 300;

export interface RallyCheckpointState {
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  paddleX: number;
  hits: number;
  goldHits: number;
  golds: number;
  width: number;
}

export interface RallyCheckpoint extends RallyCheckpointState {
  checksum: number;
}

export function rallyCheckpointState(state: RallyState): RallyCheckpointState {
  return {
    tick: state.tick,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    paddleX: state.paddleX,
    hits: state.hits,
    goldHits: state.goldHits,
    golds: state.golds.length,
    width: rallyPaddleW(rallyTotalHits(state)),
  };
}

export function rallyCheckpoint(state: RallyState): RallyCheckpoint {
  const snapshot = rallyCheckpointState(state);
  let checksum = 0x811c9dc5;
  const values = Object.values(snapshot);
  // Rev 2 folds its own counters in; older states never have them, so their sums are unchanged.
  if (state.rev === RALLY_REV) values.push(state.targetHits ?? 0, state.bounces ?? 0, ...(state.live ?? []));
  // rallyRev 4 adds its marker last, so rev-2/3 checksums are unchanged.
  if (state.tune !== undefined) values.push(state.tune);
  // rallyRev 5 adds its second bumper after that, so rev-2/3/4 checksums are unchanged.
  if (state.bumper2) values.push(state.bumper2.x, state.bumper2.y);
  // rallyRev 6 (taller worlds): the court's height, last.
  if (state.worldH) values.push(state.worldH);
  // rallyRev 10 (the expansion): its own counters, last.
  if (state.exp) values.push(state.exp, state.worldW ?? 0, state.pv ?? 0, state.spin ?? 0, state.spun ?? 0, state.bonusHit ?? 0, ...(state.live ?? []));
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const RALLY_BG = "#0B0B0F";
export const RALLY_GOLD = "#F5B82E";
export const RALLY_BALL = "#4D8CFF";

function draw(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  const scaleX = size.width / RALLY_WORLD_W;
  const worldH = rallyWorldH(state);
  const scaleY = size.height / worldH;

  ctx.save();
  ctx.fillStyle = RALLY_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.lineTo(RALLY_WORLD_W - RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.moveTo(RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.lineTo(RALLY_WALL, worldH);
  ctx.moveTo(RALLY_WORLD_W - RALLY_WALL, RALLY_HUD_H + RALLY_WALL);
  ctx.lineTo(RALLY_WORLD_W - RALLY_WALL, worldH);
  ctx.stroke();

  const width = rallyPaddleW(rallyTotalHits(state));
  ctx.fillStyle = RALLY_GOLD;
  ctx.fillRect(state.paddleX - width / 2, rallyPaddleY(state), width, RALLY_PADDLE_H);

  for (const ball of state.golds) {
    ctx.beginPath();
    ctx.arc(px(ball.x), px(ball.y), RALLY_BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = RALLY_GOLD;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(px(state.x), px(state.y), RALLY_BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = RALLY_BALL;
  ctx.fill();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Rally ${state.hits}`, 14, 14);
  ctx.textAlign = "center";
  ctx.fillStyle = RALLY_GOLD;
  ctx.fillText(`gold ${state.goldHits} · ${Math.floor(RALLY_GOLD_POINTS * state.goldHits)} pts`, RALLY_WORLD_W / 2, 14);
  ctx.fillStyle = "#F7F7F8";
  ctx.textAlign = "right";

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, RALLY_WORLD_W, worldH);
  }

  ctx.restore();
}

export const rallyGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  key: "rally",
  runTicks: RALLY_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: RALLY_INPUT_RANGES,
};

function initRev2(seed: number): RallyState {
  const base = init(seed);
  let rng = base.rng;
  // Even spots in the left half, odd in the right: the two live pads are always
  // consecutive spots, so they never overlap.
  const spots: number[] = [];
  const half = Math.trunc(RALLY_WORLD_W / 2);
  const span = half - RALLY_WALL - RALLY_TARGET_W - 4;
  for (let i = 0; i < RALLY_TARGET_SPOTS; i++) {
    const draw = rngBelow(rng, span + 1);
    rng = draw.state;
    spots.push(i % 2 === 0 ? RALLY_WALL + draw.value : half + 4 + draw.value);
  }
  const bx = rngBelow(rng, RALLY_BUMPER_X_SPAN);
  const by = rngBelow(bx.state, RALLY_BUMPER_Y_SPAN);
  rng = by.state;
  return {
    ...base,
    rng,
    rev: RALLY_REV,
    spots,
    live: Array.from({ length: RALLY_TARGETS_LIVE }, (_, i) => i),
    targetHits: 0,
    bounces: 0,
    bumper: { x: RALLY_BUMPER_X_MIN + bx.value, y: RALLY_BUMPER_Y_MIN + by.value },
    struckTick: 0,
    struckLeft: 0,
  };
}

/** Targets-and-bumper revision. */
export const rallyRev2Game: ArcadeGame<RallyState, ArcadeInputEvent | null> = { ...rallyGame, init: initRev2 };

/** Takes puzzle.rallyRev; anything else is the original game. */
export function rallyGameFor(rev?: number | null): ArcadeGame<RallyState, ArcadeInputEvent | null> {
  if (rev === RALLY_REV_STD) return rallyStdGame;
  if (rev === RALLY_REV_CURVE) return rallyCurveGame;
  if (rev === RALLY_REV_BONUS) return rallyBonusGame;
  if (rev === RALLY_REV_STRICT) return rallyStrictGame;
  if (rev === RALLY_REV_TARGET) return rallyTargetGame;
  if (rev === RALLY_REV_TALL) return rallyTallGame;
  if (rev === RALLY_REV_TUNEF) return rallyTunefGame;
  if (rev === RALLY_REV_TUNED) return rallyTunedGame;
  if (rev === RALLY_REV_BAND) return rallyBandGame;
  return rev === RALLY_REV ? rallyRev2Game : rallyGame;
}

/* ================= Oct 2026 score bands (rallyRev 3) ================= */

/** Score-band revision (puzzle.rallyRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const RALLY_REV_BAND = 3;
/** Gold-ball hits count 5 and pink targets 6; 150 at 220. */
export const RALLY_BAND_CURVE = bandCurve([0, 100, 130, 155, 185, 220], [0, 70, 100, 125, 145, 150]);

export function rallyBandUnits(goldHits: number, targetHits: number): number {
  return 5 * Math.max(0, goldHits) + 6 * Math.max(0, targetHits);
}

export function rallyBandParts(state: RallyState): BandParts {
  if ((state.exp ?? 0) >= RALLY_V12_EXP) return rallyStdBandParts(state);
  if (state.exp) return rallyBonusParts(state);
  const units = rallyBandUnits(state.goldHits, state.targetHits ?? 0);
  const curve = bandCurveOf(state, state.worldH ? RALLY_V6_BAND_CURVE : state.bumper2 ? RALLY_V5_BAND_CURVE : state.tune === RALLY_TUNE ? RALLY_V4_BAND_CURVE : RALLY_BAND_CURVE);
  return { units, points: bandPoints(curve, units), bonus: 0, penalty: 0, finished: false, text: `${state.goldHits} gold hits · ${state.targetHits ?? 0} targets` };
}

function scoreBand(state: RallyState): number {
  return bandTotal(rallyBandParts(state), Boolean(state.acted));
}

export const rallyBandGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = { ...rallyRev2Game, init: (seed) => bandInit(rallyRev2Game.init(seed)) };

/* ================= Tuning B (rallyRev 4): pads never overlap ================= */

/**
 * rallyRev 4 (Tuning B, Oct 2026): rallyRev 3 play and bands, except a struck
 * +3 pad moves to the next spot in its own half of the far wall (even spots
 * left, odd right; the halves are 8 px apart), so the two pads never overlap,
 * before or after they move. States keep `rev: 2` and add `tune: 1`.
 */
export const RALLY_REV_TUNED = 4;
/**
 * rallyRev 4 band knots: pads in separate halves are easier to reach, so the
 * same players strike more (refitted with scripts/arcade-skill-bands.ts --rev=current); 150 at 240.
 */
export const RALLY_V4_BAND_CURVE = bandCurve([0, 105, 139, 154, 195, 240], [0, 70, 100, 125, 145, 150]);

export const rallyTunedGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyRev2Game,
  init: (seed) => bandInit({ ...rallyRev2Game.init(seed), tune: RALLY_TUNE }),
};

/* ================= Tuning F (rallyRev 5): a second bumper ================= */

/**
 * rallyRev 5 (Tuning F, Oct 2026): rallyRev 4 play, pads and bands, plus a
 * second mirror bumper live for the final 15 seconds (from 45 s), alongside the
 * first (from 30 s). Its spot comes from a stream of its own keyed by the seed,
 * so the opening, gold balls, pads, first bumper and every bounce before 45 s
 * are exactly rallyRev 4's. It sits in the same band as the first, at least
 * RALLY_BUMPER2_GAP px (centres) from it, so a ball always fits between them.
 * States keep `rev: 2` and `tune: 1` and add `bumper2`.
 */
export const RALLY_REV_TUNEF = 5;
/**
 * rallyRev 5 band knots: the second bumper costs the same players a few hits, so
 * the knots come down (refitted with scripts/arcade-skill-bands.ts --rev=f, 30
 * seeds: medians 72 / 78 / 125 / 145; the simulated average and good players
 * barely separate in Rally, see docs/arcade-score-bands-oct-2026.md); 150 at 250.
 */
export const RALLY_V5_BAND_CURVE = bandCurve([0, 105, 130, 146, 185, 250], [0, 70, 100, 125, 145, 150]);

/** The second bumper's centre for a seed and the first bumper. */
export function rallyBumper2(seed: number, first: { x: number; y: number }): { x: number; y: number } {
  let rng = (seed ^ 0x52414c35) | 0;
  for (let tries = 0; tries < 16; tries++) {
    const bx = rngBelow(rng, RALLY_BUMPER_X_SPAN);
    const by = rngBelow(bx.state, RALLY_BUMPER_Y_SPAN);
    rng = by.state;
    const x = RALLY_BUMPER_X_MIN + bx.value;
    const y = RALLY_BUMPER_Y_MIN + by.value;
    const dx = x - first.x;
    const dy = y - first.y;
    if (dx * dx + dy * dy >= RALLY_BUMPER2_GAP * RALLY_BUMPER2_GAP) return { x, y };
  }
  // A fixed fallback 100 px across from the first, still inside the band.
  return { x: first.x < RALLY_BUMPER_X_MIN + 105 ? first.x + 100 : first.x - 100, y: first.y };
}

export const rallyTunefGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyRev2Game,
  init: (seed) => {
    const base = rallyTunedGame.init(seed);
    return { ...base, bumper2: rallyBumper2(seed, base.bumper!), bumped: 0 };
  },
};

/* ================= Taller worlds (rallyRev 6, Oct 2026) ================= */

/**
 * rallyRev 6 (taller worlds, batch 1): rallyRev 5 play (pads, both bumpers,
 * the gold-ball schedule and scoring rules) on a taller court, 390 ×
 * RALLY_TALL_H, the same for every player. The paddle sits RALLY_PADDLE_LIFT
 * above the new bottom, so the court is 110 px longer; each bumper keeps its
 * seeded spot across, and its height is stretched over the longer court
 * (rallyTallBumper), so the bumpers stay in the middle of the court and
 * the second stays at least RALLY_BUMPER2_GAP from the first. States keep
 * `rev: 2`, `tune: 1` and `bumper2` and add `worldH`, folded into the
 * checkpoint checksum last. Scored on RALLY_V6_BAND_CURVE.
 */
export const RALLY_REV_TALL = 6;
export const RALLY_TALL_H = 730;
/**
 * rallyRev 6 band knots (5 a gold-ball hit, 6 a pad): every return takes longer on
 * the longer court, so the same players land fewer gold hits and pads and the knots
 * come down (refitted with scripts/arcade-skill-bands.ts --rev=g1, 60 seeds: unit
 * medians 84.5 / 111 / 116 / 121; the simulated good, great and near-perfect
 * players sit close together in Rally, so the middle knots are close); 150 at 220.
 */
export const RALLY_V6_BAND_CURVE = bandCurve([0, 85, 111, 116, 122, 220], [0, 70, 100, 125, 142, 150]);

/** A bumper's centre on the taller court: x unchanged, y stretched from the 620 court's top-to-paddle span to the taller one's. */
export function rallyTallBumper(b: { x: number; y: number }, worldH = RALLY_TALL_H): { x: number; y: number } {
  const top = RALLY_HUD_H + RALLY_WALL;
  return { x: b.x, y: top + Math.trunc(((b.y - top) * (worldH - RALLY_PADDLE_LIFT - top)) / (RALLY_PADDLE_Y - top)) };
}

export const rallyTallGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyRev2Game,
  init: (seed) => {
    const base = rallyTunefGame.init(seed);
    return { ...base, bumper: rallyTallBumper(base.bumper!), bumper2: rallyTallBumper(base.bumper2!), worldH: RALLY_TALL_H };
  },
};

/** The court height (px) a stored round's rallyRev plays on. */
export function rallyWorldHFor(rev?: number | null): number {
  if (rev === RALLY_REV_BONUS || rev === RALLY_REV_CURVE || rev === RALLY_REV_STD) return RALLY_V10_H;
  return rev === RALLY_REV_TALL || rev === RALLY_REV_TARGET || rev === RALLY_REV_STRICT ? RALLY_TALL_H : RALLY_WORLD_H;
}

/** The court width (px) a stored round's rallyRev plays on. */
export function rallyWorldWFor(rev?: number | null): number {
  return rev === RALLY_REV_BONUS || rev === RALLY_REV_CURVE || rev === RALLY_REV_STD ? RALLY_V10_W : RALLY_WORLD_W;
}

/* ================= Scoring targets (rallyRev 7, 18 Oct 2026) ================= */

/**
 * rallyRev 7 (scoring targets, docs/scoring-targets.md): rallyRev 6 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const RALLY_REV_TARGET = 7;
export const rallyTargetGame = bandTargetGame(rallyTallGame);
/** The curve new rounds score on: RALLY_V6_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const RALLY_V7_BAND_CURVE = bandRetarget(RALLY_V6_BAND_CURVE);


/* ================= Score bands (rallyRev 8, 19 Oct 2026) ================= */

/**
 * rallyRev 8 (score bands, docs/scoring-targets.md): rallyRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const RALLY_REV_STRICT = 8;
export const rallyStrictGame = bandStrictGame(rallyTargetGame);
/** The curve new rounds score on: RALLY_V6_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const RALLY_V8_BAND_CURVE = bandStrict(RALLY_V6_BAND_CURVE);




/* ================= Expansion (rallyRev 10, 26 Oct 2026) ================= */

/**
 * rallyRev 10 (the 200-point expansion, docs/expansions/e9.md): a bigger court and a gold bonus target,
 * scored to 200 (roundMax.ts). Every earlier revision keeps its own step and scoring. Every feature is
 * placed and timed by the room seed at init, the same for every player, never by how a run has gone.
 *
 *  - More world: a 420 × 784 court (the iPhone 11 play box's shape, so it still fills it), the paddle
 *    RALLY_PADDLE_LIFT above the new bottom: every return travels further. Both bumpers as rallyRev 8.
 *  - Pink pads as today: two on the far wall, each in its own half; a gold ball striking one scores it
 *    and the pad jumps to its half's next spot on a seeded list (RALLY_TARGET_SPOTS of them, drawn at init).
 *  - Spin shots: the paddle's movement at contact (smoothed over a few ticks) curves the return. A way
 *    to aim; it pays nothing itself.
 *  - Gold bonus target: RALLY_V10_BONUS_COUNT a round, each at a seeded moment (one in each
 *    RALLY_V10_BONUS_SLOT window from RALLY_V10_BONUS_FROM) and a seeded place in the upper half of the
 *    court, clear of the bumpers; small (RALLY_V10_BONUS_R) and up for RALLY_V10_BONUS_LIFE (about two
 *    returns). Any ball (blue or gold) that touches it scores RALLY_V10_BONUS_PTS; a miss costs nothing.
 *
 * Score: gold hits (5), pink pads (6) and blue returns (1, so a run that never reaches a gold ball still
 * scores a little) on RALLY_V10_BAND_CURVE (to RALLY_V10_BASE_TOP), plus the targets struck, at most 200. States carry `exp: 1`, folded into the checkpoint last.
 */
export const RALLY_REV_BONUS = 10;
export const RALLY_V10_W = 420;
export const RALLY_V10_H = 784;
export const RALLY_V10_MAX = 200;
export const RALLY_V10_BONUS_COUNT = 6;
/** Target n appears at RALLY_V10_BONUS_FROM + n × RALLY_V10_BONUS_SLOT plus a seeded 0–RALLY_V10_BONUS_JITTER ticks. */
export const RALLY_V10_BONUS_FROM = 4 * TICKS_PER_SECOND;
export const RALLY_V10_BONUS_SLOT = 9 * TICKS_PER_SECOND;
export const RALLY_V10_BONUS_JITTER = 3 * TICKS_PER_SECOND;
/** Up for 4 s (about two returns), 12 px radius (24 across: about 24 phone px on a 414-wide play box). */
export const RALLY_V10_BONUS_LIFE = 4 * TICKS_PER_SECOND;
export const RALLY_V10_BONUS_R = 12;
/** Each target struck adds this many points on top of the curve. */
export const RALLY_V10_BONUS_PTS = 6;
/** The targets' band: the upper half of the court, this far inside the walls, the top wall and the court's middle. */
export const RALLY_V10_BONUS_MARGIN = 30;
/** A target's centre is at least this far from either bumper's centre (a ball fits between). */
export const RALLY_V10_BONUS_CLEAR = RALLY_BUMPER_R + RALLY_V10_BONUS_R + 2 * RALLY_BALL_R + 6;
/** Paddle speed (1/256 px a tick, smoothed) below which a return has no spin, the spin per unit of it, and the cap. */
export const RALLY_V10_SPIN_MIN = 2 * 256;
export const RALLY_V10_SPIN_K = 3;
export const RALLY_V10_SPIN_CAP = 24;
/** A spin's bend decays by 1/16 a tick and stops under this. */
export const RALLY_V10_SPIN_END = 2;
export const RALLY_V10_INPUT_RANGES: readonly InputRange[] = [inputRange(ARCADE_INPUT_DRAG, [0, RALLY_V10_W])];

/** The court's width (px) a state plays on: rallyRev 10's 420, or the original 390. */
export function rallyWorldW(state: { worldW?: number }): number {
  return state.worldW ?? RALLY_WORLD_W;
}

/** rallyRev 10: the pink pad spots' span in half k % 2 of the far wall: its lowest left edge and how far a spot can be from it. */
export function rallyBonusPadRange(k: number): { lo: number; span: number } {
  const half = Math.trunc(RALLY_V10_W / 2);
  const span = half - RALLY_WALL - RALLY_TARGET_W - 4;
  return { lo: k % 2 === 0 ? RALLY_WALL : half + 4, span };
}

/** rallyRev 10: whether bonus target n is up at a tick (appeared, not yet gone, not yet struck). */
export function rallyBonusLive(state: Pick<RallyState, "bonus" | "bonusHit" | "exp">, n: number, tick: number): boolean {
  const t = state.bonus?.[n];
  if (!t) return false;
  return tick >= t.tick && tick < t.tick + rallyBonusLife(state) && ((state.bonusHit ?? 0) & (1 << n)) === 0;
}

/** How long a gold bonus target stays up (ticks): rallyRev 10's 4 s, rallyRev 11's 5 s. */
export function rallyBonusLife(state: Pick<RallyState, "exp">): number {
  return (state.exp ?? 0) >= RALLY_V11_EXP ? RALLY_V11_BONUS_LIFE : RALLY_V10_BONUS_LIFE;
}

/** rallyRev 10: the bonus target up at a tick, or -1 (the slots never overlap). */
export function rallyBonusNow(state: Pick<RallyState, "bonus" | "bonusHit" | "exp">, tick: number): number {
  for (let n = 0; n < (state.bonus ?? []).length; n++) if (rallyBonusLive(state, n, tick)) return n;
  return -1;
}

/** rallyRev 10: targets struck so far. */
export function rallyBonusCount(state: Pick<RallyState, "bonusHit">): number {
  let n = 0;
  for (let bits = state.bonusHit ?? 0; bits; bits &= bits - 1) n++;
  return n;
}

/** rallyRev 10: the bonus points a state has earned. */
export function rallyBonusPoints(state: Pick<RallyState, "bonusHit">): number {
  return RALLY_V10_BONUS_PTS * rallyBonusCount(state);
}

/** rallyRev 10's bumper band on its court: rallyRev 5's centre band stretched to the longer court. */
function bonusBumperY(y: number): number {
  const top = RALLY_HUD_H + RALLY_WALL;
  const paddleY = RALLY_V10_H - RALLY_PADDLE_LIFT;
  return top + Math.trunc(((y - top) * (paddleY - top)) / (RALLY_PADDLE_Y - top));
}

/**
 * rallyRev 10's start state for a seed: a stream of its own keyed by the seed, drawn in a fixed order
 * (the opening, the five gold balls, the pad spots, both bumpers, then the six bonus targets).
 */
export function rallyBonusInit(seed: number, exp = 1): RallyState {
  let rng = (seed ^ 0x52414c3a) | 0;
  const draw = (bound: number): number => {
    const d = rngBelow(rng, bound);
    rng = d.state;
    return d.value;
  };
  const W = RALLY_V10_W;
  const opening = setLength(draw(2 * 160 + 1) - 160, -256, RALLY_SPEED_START);
  const entries: RallyEntry[] = [];
  for (let index = 0; index < RALLY_GOLD_COUNT; index++) {
    const spot = draw(W - 2 * (RALLY_WALL + RALLY_BALL_R));
    const lane = draw(2 * 160 + 1);
    const pace = draw(420);
    const drop = setLength(lane - 160, 256, RALLY_SPEED_START - 180 + pace);
    entries.push({ tick: (index + 1) * RALLY_GOLD_INTERVAL, x: RALLY_WALL + RALLY_BALL_R + spot, vx: drop.vx, vy: drop.vy });
  }
  // Even spots in the left half, odd in the right: the two live pads are always consecutive spots.
  const spots: number[] = [];
  for (let i = 0; i < RALLY_TARGET_SPOTS; i++) {
    const { lo, span } = rallyBonusPadRange(i);
    spots.push(lo + draw(span + 1));
  }
  const bumper = { x: 100 + draw(221), y: bonusBumperY(RALLY_BUMPER_Y_MIN + draw(RALLY_BUMPER_Y_SPAN)) };
  let bumper2 = { x: bumper.x < 210 ? bumper.x + 110 : bumper.x - 110, y: bumper.y };
  for (let tries = 0; tries < 16; tries++) {
    const b = { x: 100 + draw(221), y: bonusBumperY(RALLY_BUMPER_Y_MIN + draw(RALLY_BUMPER_Y_SPAN)) };
    if ((b.x - bumper.x) ** 2 + (b.y - bumper.y) ** 2 >= RALLY_BUMPER2_GAP * RALLY_BUMPER2_GAP) {
      bumper2 = b;
      break;
    }
  }
  const top = RALLY_HUD_H + RALLY_WALL;
  const paddleY = RALLY_V10_H - RALLY_PADDLE_LIFT;
  const yLo = top + RALLY_V10_BONUS_MARGIN + RALLY_V10_BONUS_R;
  const yHi = Math.trunc((top + paddleY) / 2) - RALLY_V10_BONUS_MARGIN;
  const xLo = RALLY_WALL + RALLY_V10_BONUS_MARGIN + RALLY_V10_BONUS_R;
  const xHi = W - xLo;
  const clear = (x: number, y: number) =>
    [bumper, bumper2].every((b) => (x - b.x) ** 2 + (y - b.y) ** 2 >= RALLY_V10_BONUS_CLEAR * RALLY_V10_BONUS_CLEAR);
  const bonus: RallyBonusTarget[] = [];
  for (let n = 0; n < RALLY_V10_BONUS_COUNT; n++) {
    const tick = RALLY_V10_BONUS_FROM + n * RALLY_V10_BONUS_SLOT + draw(RALLY_V10_BONUS_JITTER + 1);
    let x = xLo + draw(xHi - xLo + 1);
    let y = yLo + draw(yHi - yLo + 1);
    for (let tries = 0; tries < 24 && !clear(x, y); tries++) {
      x = xLo + draw(xHi - xLo + 1);
      y = yLo + draw(yHi - yLo + 1);
    }
    // Still on a bumper after every try (never seen): the band's top-centre, which no bumper reaches.
    if (!clear(x, y)) {
      x = Math.trunc(W / 2);
      y = yLo;
    }
    bonus.push({ tick, x, y });
  }
  const paddleX = Math.round(W / 2);
  return bandInit({
    tick: 0,
    rng,
    aimX: paddleX,
    paddleX,
    x: paddleX * 256,
    y: (RALLY_HUD_H + 140) * 256,
    vx: opening.vx,
    vy: opening.vy,
    speed: RALLY_SPEED_START,
    hits: 0,
    goldHits: 0,
    entries,
    golds: [],
    dead: false,
    endedTick: 0,
    rev: RALLY_REV,
    spots,
    live: [0, 1],
    targetHits: 0,
    bumper,
    bounces: 0,
    struckTick: 0,
    struckLeft: 0,
    tune: RALLY_TUNE,
    bumper2,
    bumped: 0,
    worldH: RALLY_V10_H,
    worldW: W,
    exp,
    pv: 0,
    spin: 0,
    spun: 0,
    bonus,
    bonusHit: 0,
    bonusAt: 0,
  });
}

/** One return's spin from the smoothed paddle speed: none when slow, then proportional, capped. */
export function rallySpinFrom(pv: number): number {
  if (Math.abs(pv) < RALLY_V10_SPIN_MIN) return 0;
  return clampInt(Math.trunc((pv * RALLY_V10_SPIN_K) / 256), -RALLY_V10_SPIN_CAP, RALLY_V10_SPIN_CAP);
}

function stepBonus(state: RallyState, input: ArcadeInputEvent | null): RallyState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const W = RALLY_V10_W;

  let aimX = state.aimX;
  if (input && input.k === ARCADE_INPUT_DRAG) aimX = clampInt(input.a, 0, W);
  const width = rallyPaddleW(rallyTotalHits(state));
  const half = Math.trunc(width / 2);
  const paddleX = clampInt(aimX, RALLY_WALL + half, W - RALLY_WALL - half);
  // Smoothed paddle speed (1/256 px a tick): what a return's spin is made of.
  const pv = Math.trunc((3 * (state.pv ?? 0) + 256 * (paddleX - state.paddleX)) / 4);

  const next: RallyState = { ...state, tick, aimX, paddleX, pv };
  let { speed, hits, goldHits, rng } = next;
  const spots = state.spots ?? [];
  const live = [...(state.live ?? [])];
  let targetHits = state.targetHits ?? 0;
  let bounces = state.bounces ?? 0;
  let struckTick = state.struckTick ?? 0;
  let struckLeft = state.struckLeft ?? 0;
  let bumped = state.bumped ?? 0;
  let bonusHit = state.bonusHit ?? 0;
  let bonusAt = state.bonusAt ?? 0;
  // The target up this tick (decided before any ball moves, so every ball sees the same one).
  const up = rallyBonusNow(state, tick);
  const target = up >= 0 ? state.bonus![up]! : null;
  const bumpers: { x: number; y: number }[] = [];
  if (tick >= RALLY_BUMPER_FROM && state.bumper) bumpers.push(state.bumper);
  if (tick >= RALLY_BUMPER2_FROM && state.bumper2) bumpers.push(state.bumper2);
  const top = (RALLY_HUD_H + RALLY_WALL) * 256;
  const leftWall = RALLY_WALL * 256;
  const rightWall = (W - RALLY_WALL) * 256;
  const paddleYFp = (RALLY_V10_H - RALLY_PADDLE_LIFT) * 256;
  const worldHFp = RALLY_V10_H * 256;
  const reachT = (RALLY_V10_BONUS_R + RALLY_BALL_R) * 256;
  // rallyRev 11: the curving spin (rallyRev 10 keeps its own short bend exactly).
  const curving = (state.exp ?? 0) >= RALLY_V11_EXP;
  // rallyRev 12: a swipe's spin is reversed (the ball leaves the way the paddle moved and curves back).
  const reversed = (state.exp ?? 0) >= RALLY_V12_EXP;

  let golds = state.golds.map((ball) => ({ ...ball }));
  for (const entry of state.entries) {
    if (entry.tick === tick) golds.push({ x: entry.x * 256, y: top + RALLY_BALL_R_FP, vx: entry.vx, vy: entry.vy });
  }

  /** Runs one ball for a tick. Returns null when it fell off the bottom. */
  const move = (ball: RallyBall, gold: boolean): RallyBall | null => {
    let { x, y, vx, vy } = ball;
    let spin = ball.spin ?? 0;
    let spun = ball.spun ?? 0;
    // A spin bends the flight a little every tick and wears off.
    if (spin !== 0 && curving) {
      // rallyRev 11: a stronger bend that lasts most of the flight (so the curve shows), scaled with the ball's
      // speed; a bend that would flatten the flight below RALLY_V11_STEEP of the speed ends the spin instead.
      const bend = Math.trunc((spin * speed) / (16 * RALLY_SPEED_START));
      const out = setLength(vx + bend, vy, speed);
      const floor = Math.trunc((speed * RALLY_V11_STEEP) / 256);
      if (Math.abs(out.vy) < floor && Math.abs(out.vy) < Math.abs(vy)) spin = 0;
      else {
        vx = out.vx;
        vy = out.vy;
        const wear = Math.max(1, Math.trunc(Math.abs(spin) / RALLY_V11_SPIN_DECAY));
        spin = spin > 0 ? spin - wear : spin + wear;
        if (Math.abs(spin) < RALLY_V11_SPIN_END) spin = 0;
      }
      if (spin === 0) spun = 0;
    } else if (spin !== 0) {
      let out = setLength(vx + spin, vy, speed);
      if (Math.abs(out.vy) < RALLY_MIN_VY) out = setLength(out.vx, out.vy < 0 ? -RALLY_MIN_VY : RALLY_MIN_VY, speed);
      vx = out.vx;
      vy = out.vy;
      spin = Math.trunc((spin * 15) / 16);
      if (Math.abs(spin) < RALLY_V10_SPIN_END) spin = 0;
    }
    for (let sub = 0; sub < 4; sub++) {
      const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
      const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);

      x += sx;
      if (x - RALLY_BALL_R_FP < leftWall || x + RALLY_BALL_R_FP > rightWall) {
        x = x - RALLY_BALL_R_FP < leftWall ? leftWall + RALLY_BALL_R_FP : rightWall - RALLY_BALL_R_FP;
        const turned = nudge(rng, speed, -vx, vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
        spin = -spin;
      }

      y += sy;
      if (y - RALLY_BALL_R_FP < top) {
        y = top + RALLY_BALL_R_FP;
        if (gold) {
          const bx = px(x);
          for (let k = 0; k < live.length; k++) {
            const left = rallyTargetLeft(spots, live[k]!);
            if (bx + RALLY_BALL_R >= left && bx - RALLY_BALL_R <= left + RALLY_TARGET_W) {
              targetHits += 1;
              struckTick = tick;
              struckLeft = left;
              // The pad jumps to its own half's next seeded spot (the same list for every player).
              live[k] = live[k]! + RALLY_TARGETS_LIVE;
              break;
            }
          }
        }
        const turned = nudge(rng, speed, vx, -vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
        spin = 0;
        spun = 0;
      }

      // The gold bonus target: a touch scores it (the ball flies on unchanged).
      if (target && (bonusHit & (1 << up)) === 0) {
        const dx = x - target.x * 256;
        const dy = y - target.y * 256;
        if (Math.abs(dx) < reachT && Math.abs(dy) < reachT && dx * dx + dy * dy <= reachT * reachT) {
          bonusHit |= 1 << up;
          bonusAt = tick;
        }
      }

      for (let bi = 0; bi < bumpers.length; bi++) {
        const bumper = bumpers[bi]!;
        const dx = x - bumper.x * 256;
        const dy = y - bumper.y * 256;
        const reach = (RALLY_BUMPER_R + RALLY_BALL_R) * 256;
        if (Math.abs(dx) < reach && Math.abs(dy) < reach) {
          const d = isqrt(dx * dx + dy * dy);
          if (d < reach) {
            const nx = d > 0 ? Math.trunc((dx * 1024) / d) : 0;
            const ny = d > 0 ? Math.trunc((dy * 1024) / d) : -1024;
            x = bumper.x * 256 + Math.trunc((nx * reach) / 1024);
            y = bumper.y * 256 + Math.trunc((ny * reach) / 1024);
            const vn = Math.trunc((vx * nx + vy * ny) / 1024);
            if (vn < 0) {
              let out = setLength(vx - Math.trunc((2 * vn * nx) / 1024), vy - Math.trunc((2 * vn * ny) / 1024), speed);
              if (Math.abs(out.vy) < RALLY_MIN_VY) out = setLength(out.vx, out.vy < 0 ? -RALLY_MIN_VY : RALLY_MIN_VY, speed);
              vx = out.vx;
              vy = out.vy;
              bounces += 1;
              bumped = bi;
            }
          }
        }
      }

      if (vy > 0 && y + RALLY_BALL_R_FP >= paddleYFp && y < paddleYFp + 4 * 256) {
        const offset = px(x) - (paddleX - half);
        if (offset >= -RALLY_BALL_R && offset <= width + RALLY_BALL_R) {
          if (gold) goldHits += 1;
          else hits += 1;
          speed = Math.min(RALLY_SPEED_CAP, Math.trunc((speed * 103) / 100));
          const fromCentre = Math.round(offset - half);
          const steered = setLength(Math.trunc((fromCentre * 256) / Math.max(1, half)) + Math.trunc(vx / 4), -Math.max(RALLY_MIN_VY, Math.abs(vy)), speed);
          vx = steered.vx;
          vy = steered.vy;
          y = paddleYFp - RALLY_BALL_R_FP;
          spin = curving ? rallyCurveSpinFrom(pv) : rallySpinFrom(pv);
          // rallyRev 12: the swipe sends the ball off its way first, then the spin curves it back round the other way.
          if (reversed && spin !== 0) {
            const kicked = setLength(vx + Math.trunc((spin * RALLY_V12_KICK_NUM) / RALLY_V12_KICK_DEN), vy, speed);
            vx = kicked.vx;
            vy = kicked.vy;
            spin = -spin;
          }
          spun = spin !== 0 ? 1 : 0;
        }
      }

      if (y - RALLY_BALL_R_FP > worldHFp) return null;
    }
    return { x, y, vx, vy, spin, spun };
  };

  const main = move({ x: next.x, y: next.y, vx: next.vx, vy: next.vy, spin: state.spin ?? 0, spun: state.spun ?? 0 }, false);
  if (main === null) next.dead = true;
  else {
    next.x = main.x;
    next.y = main.y;
    next.vx = main.vx;
    next.vy = main.vy;
    next.spin = main.spin ?? 0;
    next.spun = main.spun ?? 0;
  }

  const keptGolds: RallyBall[] = [];
  for (const ball of golds) {
    const moved = move(ball, true);
    if (moved !== null) keptGolds.push(moved);
  }
  golds = keptGolds;

  next.golds = golds;
  next.speed = speed;
  next.hits = hits;
  next.goldHits = goldHits;
  next.rng = rng;
  next.live = live;
  next.targetHits = targetHits;
  next.bounces = bounces;
  next.struckTick = struckTick;
  next.struckLeft = struckLeft;
  next.bumped = bumped;
  next.bonusHit = bonusHit;
  next.bonusAt = bonusAt;
  if (next.dead || tick >= RALLY_RUN_TICKS) next.endedTick = tick;
  return next;
}

/**
 * rallyRev 10 base knots (5 a gold-ball hit, 6 a pad), fitted with scripts/expansion-e9-bands.ts on the
 * skill-band bots (docs/expansions/e9.md); the bonus targets add up to RALLY_V10_BONUS_COUNT ×
 * RALLY_V10_BONUS_PTS on top.
 */
export const RALLY_V10_BAND_CURVE = bandCurve([0, 40, 80, 110, 140, 180, 240, 270], [0, 24, 43, 72, 112, 158, 163, 190]);
/** The most the base curve pays. */
export const RALLY_V10_BASE_TOP = 190;

/** rallyRev 10's units: 5 a gold-ball hit, 6 a pink pad and 1 a blue return. */
export function rallyBonusUnits(state: Pick<RallyState, "goldHits" | "targetHits" | "hits">): number {
  return rallyBandUnits(state.goldHits, state.targetHits ?? 0) + Math.max(0, state.hits);
}

export function rallyBonusParts(state: RallyState): BandParts {
  const units = rallyBonusUnits(state);
  const bonus = rallyBonusPoints(state);
  return {
    units,
    points: bandPoints(RALLY_V10_BAND_CURVE, units),
    bonus,
    penalty: 0,
    finished: false,
    text: `${state.goldHits} gold hits · ${state.targetHits ?? 0} targets · ${state.hits} returns`,
    bonusText: `Gold targets: ${rallyBonusCount(state)} of ${RALLY_V10_BONUS_COUNT}`,
  };
}

export const rallyBonusGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyGame,
  init: rallyBonusInit,
  step: bandStep(stepBonus),
  score: (state) => bandTotal(rallyBonusParts(state), Boolean(state.acted), RALLY_V10_MAX),
  inputRanges: RALLY_V10_INPUT_RANGES,
};

/* ================= Phone notes (rallyRev 11, 27 Oct 2026) ================= */

/**
 * rallyRev 11 (Joe's phone notes, 27 Oct 2026, docs/phone-notes-oct-2026/rally.md): rallyRev 10's court, pads,
 * bumpers, targets and scoring, with two changes, both the same for every player:
 *
 *  - Spin shots visibly curve. rallyRev 10's bend was small and gone in about a third of a second, so a spun
 *    return looked straight. Here the paddle's speed at contact (above RALLY_V11_SPIN_MIN) gives a spin of
 *    RALLY_V11_SPIN_K per px a tick, capped at RALLY_V11_SPIN_CAP; each tick it bends the flight by
 *    spin / 16 (1/256 px a tick, scaled with the ball's speed) and wears off by a 1/RALLY_V11_SPIN_DECAY share
 *    (at least 1), ending under RALLY_V11_SPIN_END: about two thirds of a second of curve, up to about 30°
 *    at full spin. A bend never flattens the flight below RALLY_V11_STEEP of its speed (the spin ends there),
 *    side walls mirror it, the far wall ends it. Spin still scores nothing itself.
 *  - Gold bonus targets stay up 5 s (RALLY_V11_BONUS_LIFE; was 4). The 9 s slots and 0–3 s jitter still keep
 *    them from ever overlapping.
 *
 * Init draws exactly rallyRev 10's stream (same opening, gold balls, pads, bumpers and targets for a seed);
 * states carry `exp: 2`, folded into the checkpoint as rallyRev 10's `exp: 1` is.
 */
export const RALLY_REV_CURVE = 11;
/** rallyRev 11's state marker (`exp`). */
export const RALLY_V11_EXP = 2;
export const RALLY_V11_BONUS_LIFE = 5 * TICKS_PER_SECOND;
/** Smoothed paddle speed (1/256 px a tick) below which a return has no spin (1.5 px a tick). */
export const RALLY_V11_SPIN_MIN = 384;
/** Spin per 1/256 px a tick of paddle speed is pv × K / 256; capped (in sixteenths of a 1/256 px a tick bend). */
export const RALLY_V11_SPIN_K = 40;
export const RALLY_V11_SPIN_CAP = 256;
/** The spin wears off by 1/DECAY a tick (at least 1) and stops under END. */
export const RALLY_V11_SPIN_DECAY = 40;
export const RALLY_V11_SPIN_END = 8;
/** A bend never takes |vy| under this share of the speed (/256: 40 %). */
export const RALLY_V11_STEEP = 102;

/** rallyRev 11: one return's spin from the smoothed paddle speed: none when slow, then proportional, capped. */
export function rallyCurveSpinFrom(pv: number): number {
  if (Math.abs(pv) < RALLY_V11_SPIN_MIN) return 0;
  return clampInt(Math.trunc((pv * RALLY_V11_SPIN_K) / 256), -RALLY_V11_SPIN_CAP, RALLY_V11_SPIN_CAP);
}

export const rallyCurveGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyBonusGame,
  init: (seed) => rallyBonusInit(seed, RALLY_V11_EXP),
};

/* ================= The arcade scoring standard (rallyRev 12, 29 Oct 2026) ================= */

/**
 * rallyRev 12 (the arcade scoring standard, docs/arcade-standard/rally.md; Joe's row): rallyRev 11's court, balls,
 * pads, bumpers, gold targets and timings, with one gameplay fix and the standard's scoring:
 *
 *  - Spin the right way round. On rallyRev 10/11 a return's spin bent the ball the way the paddle moved (a swipe left
 *    curved it further left). Here a swipe sends the ball off the way the paddle moved (its launch gets a sideways
 *    kick of RALLY_V12_KICK_NUM / RALLY_V12_KICK_DEN of the spin) and the spin then curves it back round the other
 *    way: a swipe left goes left, then curves round to the right (mirror for right). Strength, wear, the steep floor,
 *    side walls mirroring it and the far wall ending it are rallyRev 11's. Spin still scores nothing itself.
 *  - Score (arcadeStandard.ts): core = gold-ball hits on a straight line, 140 at RALLY_V12_FULL_AT; pink pads
 *    RALLY_V12_PAD_PTS each up to 30; gold targets 5 each of the 6 (30). Blue returns and lasting the minute pay
 *    nothing; losing the blue ball ends the run (as on every revision), the score standing at what was earned.
 *
 * Init draws exactly rallyRev 10's stream (same opening, gold balls, pads, bumpers and targets for a seed); states
 * carry `exp: 3`, folded into the checkpoint as rallyRev 10's `exp` is.
 */
export const RALLY_REV_STD = 12;
/** rallyRev 12's state marker (`exp`). */
export const RALLY_V12_EXP = 3;
/** The launch kick a spun return gets the way the paddle moved: spin × NUM / DEN (1/256 px a tick). */
export const RALLY_V12_KICK_NUM = 3;
export const RALLY_V12_KICK_DEN = 2;
/** Gold-ball hits at which the core is full: the near-perfect skill-band level's median on tuning seeds 0–59. */
export const RALLY_V12_FULL_AT = 23;
export const RALLY_V12_CORE_MAX = 140;
/** Pink pads: this many points each, up to RALLY_V12_PADS_MAX. */
export const RALLY_V12_PAD_PTS = 3;
export const RALLY_V12_PADS_MAX = 30;
/** Gold targets: this many points for each of the RALLY_V10_BONUS_COUNT. */
export const RALLY_V12_TARGET_PTS = 5;
export const RALLY_V12_TARGETS_MAX = RALLY_V12_TARGET_PTS * RALLY_V10_BONUS_COUNT;

/** rallyRev 12's core line (gold-ball hits → 0…140), the curve LIVE_BANDS lists. */
export const RALLY_V12_BAND_CURVE = bandCurve([0, RALLY_V12_FULL_AT], [0, RALLY_V12_CORE_MAX]);

export const RALLY_STD_SPEC: StdSpec = {
  field: "rallyRev",
  rev: RALLY_REV_STD,
  parts: [
    { key: "core", label: "Gold-ball hits", max: RALLY_V12_CORE_MAX, how: `hit gold balls back, all of it for ${RALLY_V12_FULL_AT} hits` },
    { key: "pads", label: "Pink pads", max: RALLY_V12_PADS_MAX, how: `${RALLY_V12_PAD_PTS} each time a gold ball strikes a pink pad` },
    { key: "targets", label: "Gold targets", max: RALLY_V12_TARGETS_MAX, how: `${RALLY_V12_TARGET_PTS} for each of the ${RALLY_V10_BONUS_COUNT} gold targets hit` },
  ],
};

/** rallyRev 12's parts (null on any other revision). */
export function rallyStdParts(state: RallyState): StdPart[] | null {
  if ((state.exp ?? 0) < RALLY_V12_EXP) return null;
  const gold = state.goldHits;
  const pads = state.targetHits ?? 0;
  const targets = rallyBonusCount(state);
  return [
    stdPart(RALLY_STD_SPEC, "core", stdLine(RALLY_V12_CORE_MAX, gold, RALLY_V12_FULL_AT), `${gold} gold-ball hit${gold === 1 ? "" : "s"}`),
    stdPart(RALLY_STD_SPEC, "pads", stdEach(pads, RALLY_V12_PAD_PTS, RALLY_V12_PADS_MAX), `${pads} pink pad${pads === 1 ? "" : "s"}`),
    stdPart(RALLY_STD_SPEC, "targets", stdEach(targets, RALLY_V12_TARGET_PTS, RALLY_V12_TARGETS_MAX), `${targets} of ${RALLY_V10_BONUS_COUNT}`),
  ];
}

/** rallyRev 12 for the skill-band tool: units = gold-ball hits (the core's measure), points the core's, bonus the features'. */
export function rallyStdBandParts(state: RallyState): BandParts {
  const parts = rallyStdParts(state)!;
  return {
    units: state.goldHits,
    points: parts[0]!.points,
    bonus: parts[1]!.points + parts[2]!.points,
    penalty: 0,
    finished: false,
    text: `${state.goldHits} gold hits · ${state.targetHits ?? 0} pads · ${state.hits} returns`,
    bonusText: `Gold targets: ${rallyBonusCount(state)} of ${RALLY_V10_BONUS_COUNT}`,
  };
}

export const rallyStdGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyBonusGame,
  init: (seed) => rallyBonusInit(seed, RALLY_V12_EXP),
  score: (state) => stdScore(rallyStdParts(state)!, Boolean(state.acted)),
};

/** What a gold bonus target shows it pays on a state's revision (display only): 5 on rallyRev 12, 6 before. */
export function rallyBonusPtsOf(state: Pick<RallyState, "exp">): number {
  return (state.exp ?? 0) >= RALLY_V12_EXP ? RALLY_V12_TARGET_PTS : RALLY_V10_BONUS_PTS;
}
