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
  /** rallyRev 9 only: the spin curving the ball (1/256 px a tick, a tick), and 1 while a spin return still curves it. */
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
  /** rallyRev 9 only (the expansion). Absent on every earlier round. The marker and the court's width (420). */
  deep?: number;
  worldW?: number;
  /** Each pad spot's glide pace (1/256 px a tick) and the tick each live pad took its spot. */
  paces?: number[];
  padAt?: number[];
  /** The multi-ball pad: its seeded spots, the tick it is next live from (0 while the twin is out), its spot index, uses. */
  mspots?: number[];
  multiAt?: number;
  multiSpot?: number;
  multiUsed?: number;
  /** The twin ball (null when none), its ticks left and its returns. */
  twin?: RallyBall | null;
  twinLeft?: number;
  twinHits?: number;
  /** Smoothed paddle speed (1/256 px a tick) and the blue ball's spin. */
  pv?: number;
  spin?: number;
  spun?: number;
  /** Returns in a row (2 each while doubled), the longest, milestones reached, doubled-return points, spin targets. */
  streak?: number;
  bestStreak?: number;
  milestones?: number;
  dblPts?: number;
  spinHits?: number;
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
  // rallyRev 9 (the expansion): its own counters, last.
  if (state.deep) values.push(state.deep, state.worldW ?? 0, state.twinHits ?? 0, state.twinLeft ?? 0, state.streak ?? 0, state.milestones ?? 0, state.dblPts ?? 0, state.spinHits ?? 0, state.spin ?? 0, state.multiUsed ?? 0);
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
  if (rev === RALLY_REV_DEEP) return rallyDeepGame;
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
  if (state.deep) return rallyDeepParts(state);
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
  if (rev === RALLY_REV_DEEP) return RALLY_V9_H;
  return rev === RALLY_REV_TALL || rev === RALLY_REV_TARGET || rev === RALLY_REV_STRICT ? RALLY_TALL_H : RALLY_WORLD_H;
}

/** The court width (px) a stored round's rallyRev plays on. */
export function rallyWorldWFor(rev?: number | null): number {
  return rev === RALLY_REV_DEEP ? RALLY_V9_W : RALLY_WORLD_W;
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


/* ================= Expansion (rallyRev 9, 25 Oct 2026) ================= */

/**
 * rallyRev 9 (the 200-point expansion, docs/expansions/e3.md): a longer court and four skill
 * features, scored to 200 (roundMax.ts). Every earlier revision keeps its own step and scoring.
 *
 *  - More world: a 420 × 784 court (the iPhone 11 play box's shape, so it still fills it), the paddle
 *    RALLY_PADDLE_LIFT above the new bottom: every return travels further.
 *  - Moving targets: the two pink pads glide along the far wall inside their own halves, each at its
 *    own seeded pace, and keep moving after a strike sends them to a new spot.
 *  - Multi-ball pad: a teal pad on the far wall from 8 s. Any ball that hits it releases a twin ball
 *    for RALLY_V9_TWIN_TICKS (about 10 s). While the twin and the blue ball are both in play every
 *    return counts double: 2 towards the streak and RALLY_V9_DOUBLE_PTS skill point. Losing the twin
 *    costs nothing; the pad returns RALLY_V9_MULTI_AGAIN after the twin has gone.
 *  - Spin shots: the paddle's movement at contact (smoothed over a few ticks) curves the return; a
 *    gold ball off a spin return that strikes a pink pad (before any other far-wall touch) scores
 *    RALLY_V9_SPIN_PTS more.
 *  - Rally milestones: every 10 returns in a row scores RALLY_V9_MILESTONE_PTS and flashes the court
 *    lights; a lost gold ball (a miss) resets the streak (the twin never does).
 *
 * Score: gold hits (5) and pink pads (6) on RALLY_V9_BAND_CURVE (to 150), as before, plus the skill
 * points, at most RALLY_V9_SKILL_MAX: 200 in all. States carry `deep: 1`, folded into the checkpoint last.
 */
export const RALLY_REV_DEEP = 9;
export const RALLY_V9_W = 420;
export const RALLY_V9_H = 784;
export const RALLY_V9_MAX = 200;
export const RALLY_V9_SKILL_MAX = 50;
export const RALLY_V9_TWIN_TICKS = 10 * TICKS_PER_SECOND;
export const RALLY_V9_MULTI_FROM = 8 * TICKS_PER_SECOND;
export const RALLY_V9_MULTI_AGAIN = 10 * TICKS_PER_SECOND;
export const RALLY_V9_MULTI_W = 40;
export const RALLY_V9_DOUBLE_PTS = 1;
export const RALLY_V9_MILESTONE = 10;
export const RALLY_V9_MILESTONE_PTS = 4;
export const RALLY_V9_SPIN_PTS = 5;
/** Paddle speed (1/256 px a tick, smoothed) below which a return has no spin, the spin per unit of it, and the cap. */
export const RALLY_V9_SPIN_MIN = 4 * 256;
export const RALLY_V9_SPIN_K = 3;
export const RALLY_V9_SPIN_CAP = 24;
/** A spin's bend decays by 1/16 a tick and stops under this; the shot stays "spun" until it next meets the far wall or the paddle. */
export const RALLY_V9_SPIN_END = 2;
/** Pink pads glide at 0.3–0.7 px a tick. */
export const RALLY_V9_PAD_PACE: readonly [number, number] = [77, 102];
export const RALLY_V9_INPUT_RANGES: readonly InputRange[] = [inputRange(ARCADE_INPUT_DRAG, [0, RALLY_V9_W])];

/** The court's width (px) a state plays on: rallyRev 9's 420, or the original 390. */
export function rallyWorldW(state: { worldW?: number }): number {
  return state.worldW ?? RALLY_WORLD_W;
}

/** rallyRev 9: a pink pad's span within its half of the far wall: the lowest left edge and how far it can glide. */
export function rallyDeepPadRange(k: number): { lo: number; span: number } {
  const half = Math.trunc(RALLY_V9_W / 2);
  const span = half - RALLY_WALL - RALLY_TARGET_W - 4;
  return { lo: k % 2 === 0 ? RALLY_WALL : half + 4, span };
}

/** rallyRev 9: pink pad k's left edge at a tick: from its spot, gliding at its pace, turning at its half's ends. */
export function rallyDeepPadLeft(state: Pick<RallyState, "spots" | "live" | "padAt" | "paces">, k: number, tick: number): number {
  const { lo, span } = rallyDeepPadRange(k);
  const spot = (state.spots ?? [])[(state.live ?? [])[k] ?? k] ?? lo;
  const pace = (state.paces ?? [])[(state.live ?? [])[k] ?? k] ?? 0;
  const run = 2 * span * 256;
  if (run <= 0) return spot;
  let pos = ((spot - lo) * 256 + pace * Math.max(0, tick - ((state.padAt ?? [])[k] ?? 0))) % run;
  if (pos < 0) pos += run;
  if (pos > span * 256) pos = run - pos;
  return lo + Math.trunc(pos / 256);
}

/** rallyRev 9: the skill points a state has earned (doubled returns, spin targets and milestones, at most 50). */
export function rallySkillPoints(state: Pick<RallyState, "dblPts" | "spinHits" | "milestones">): number {
  return Math.min(RALLY_V9_SKILL_MAX, (state.dblPts ?? 0) + RALLY_V9_SPIN_PTS * (state.spinHits ?? 0) + RALLY_V9_MILESTONE_PTS * (state.milestones ?? 0));
}

/** rallyRev 9: whether the twin ball and the blue ball are both in play (returns count double). */
export function rallyDoubleOn(state: Pick<RallyState, "twin" | "dead">): boolean {
  return !!state.twin && !state.dead;
}

function initDeep(seed: number): RallyState {
  // Its own stream keyed by the seed: no earlier revision's draws are reused by accident.
  let rng = (seed ^ 0x52414c39) | 0;
  const draw = (bound: number): number => {
    const d = rngBelow(rng, bound);
    rng = d.state;
    return d.value;
  };
  const opening = setLength(draw(2 * 160 + 1) - 160, -256, RALLY_SPEED_START);
  const entries: RallyEntry[] = [];
  for (let index = 0; index < RALLY_GOLD_COUNT; index++) {
    const spot = draw(RALLY_V9_W - 2 * (RALLY_WALL + RALLY_BALL_R));
    const lane = draw(2 * 160 + 1);
    const pace = draw(420);
    const drop = setLength(lane - 160, 256, RALLY_SPEED_START - 180 + pace);
    entries.push({ tick: (index + 1) * RALLY_GOLD_INTERVAL, x: RALLY_WALL + RALLY_BALL_R + spot, vx: drop.vx, vy: drop.vy });
  }
  const spots: number[] = [];
  const paces: number[] = [];
  for (let i = 0; i < RALLY_TARGET_SPOTS; i++) {
    const { lo, span } = rallyDeepPadRange(i);
    spots.push(lo + draw(span + 1));
    const pace = RALLY_V9_PAD_PACE[0] + draw(RALLY_V9_PAD_PACE[1] + 1);
    paces.push(pace);
  }
  const mspots: number[] = [];
  for (let i = 0; i < 12; i++) mspots.push(RALLY_WALL + 40 + draw(RALLY_V9_W - 2 * RALLY_WALL - 80 - RALLY_V9_MULTI_W));
  const top = RALLY_HUD_H + RALLY_WALL;
  const paddleY = RALLY_V9_H - RALLY_PADDLE_LIFT;
  const bandY = (y: number) => top + Math.trunc(((y - top) * (paddleY - top)) / (RALLY_PADDLE_Y - top));
  const bumper = { x: 100 + draw(221), y: bandY(RALLY_BUMPER_Y_MIN + draw(RALLY_BUMPER_Y_SPAN)) };
  let bumper2 = { x: bumper.x < 210 ? bumper.x + 110 : bumper.x - 110, y: bumper.y };
  for (let tries = 0; tries < 16; tries++) {
    const b = { x: 100 + draw(221), y: bandY(RALLY_BUMPER_Y_MIN + draw(RALLY_BUMPER_Y_SPAN)) };
    if ((b.x - bumper.x) ** 2 + (b.y - bumper.y) ** 2 >= RALLY_BUMPER2_GAP * RALLY_BUMPER2_GAP) {
      bumper2 = b;
      break;
    }
  }
  const paddleX = Math.round(RALLY_V9_W / 2);
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
    worldH: RALLY_V9_H,
    worldW: RALLY_V9_W,
    deep: 1,
    paces,
    padAt: [0, 0],
    mspots,
    multiAt: RALLY_V9_MULTI_FROM,
    multiSpot: 0,
    multiUsed: 0,
    twin: null,
    twinLeft: 0,
    twinHits: 0,
    pv: 0,
    spin: 0,
    spun: 0,
    streak: 0,
    bestStreak: 0,
    milestones: 0,
    dblPts: 0,
    spinHits: 0,
  });
}

/** One return's spin from the smoothed paddle speed: none when slow, then proportional, capped. */
function spinFrom(pv: number): number {
  if (Math.abs(pv) < RALLY_V9_SPIN_MIN) return 0;
  return clampInt(Math.trunc((pv * RALLY_V9_SPIN_K) / 256), -RALLY_V9_SPIN_CAP, RALLY_V9_SPIN_CAP);
}

function stepDeep(state: RallyState, input: ArcadeInputEvent | null): RallyState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const W = RALLY_V9_W;

  let aimX = state.aimX;
  if (input && input.k === ARCADE_INPUT_DRAG) aimX = clampInt(input.a, 0, W);
  const width = rallyPaddleW(rallyTotalHits(state));
  const half = Math.trunc(width / 2);
  const paddleX = clampInt(aimX, RALLY_WALL + half, W - RALLY_WALL - half);
  // Smoothed paddle speed (1/256 px a tick): what a return's spin is made of.
  const pv = Math.trunc((3 * (state.pv ?? 0) + 256 * (paddleX - state.paddleX)) / 4);

  const next: RallyState = { ...state, tick, aimX, paddleX, pv };
  let { speed, hits, goldHits, rng } = next;
  const live = [...(state.live ?? [])];
  const padAt = [...(state.padAt ?? [])];
  let targetHits = state.targetHits ?? 0;
  let bounces = state.bounces ?? 0;
  let struckTick = state.struckTick ?? 0;
  let struckLeft = state.struckLeft ?? 0;
  let bumped = state.bumped ?? 0;
  let multiAt = state.multiAt ?? 0;
  let multiSpot = state.multiSpot ?? 0;
  let multiUsed = state.multiUsed ?? 0;
  let twinLeft = Math.max(0, (state.twinLeft ?? 0) - 1);
  let twinHits = state.twinHits ?? 0;
  let streak = state.streak ?? 0;
  let bestStreak = state.bestStreak ?? 0;
  let milestones = state.milestones ?? 0;
  let dblPts = state.dblPts ?? 0;
  let spinHits = state.spinHits ?? 0;
  let release = null as { x: number } | null;
  const doubled = rallyDoubleOn(state);
  const bumpers: { x: number; y: number }[] = [];
  if (tick >= RALLY_BUMPER_FROM && state.bumper) bumpers.push(state.bumper);
  if (tick >= RALLY_BUMPER2_FROM && state.bumper2) bumpers.push(state.bumper2);
  const top = (RALLY_HUD_H + RALLY_WALL) * 256;
  const leftWall = RALLY_WALL * 256;
  const rightWall = (W - RALLY_WALL) * 256;
  const paddleYFp = (RALLY_V9_H - RALLY_PADDLE_LIFT) * 256;
  const worldHFp = RALLY_V9_H * 256;
  const multiLive = multiAt > 0 && tick >= multiAt && !state.twin;
  const multiLeft = (state.mspots ?? [])[multiSpot % 12] ?? RALLY_WALL + 40;

  let golds = state.golds.map((ball) => ({ ...ball }));
  for (const entry of state.entries) {
    if (entry.tick === tick) golds.push({ x: entry.x * 256, y: top + RALLY_BALL_R_FP, vx: entry.vx, vy: entry.vy });
  }

  type Kind = "main" | "gold" | "twin";
  /** Runs one ball for a tick. Returns null when it fell off the bottom. */
  const move = (ball: RallyBall, kind: Kind): RallyBall | null => {
    let { x, y, vx, vy } = ball;
    let spin = ball.spin ?? 0;
    let spun = ball.spun ?? 0;
    // A spin bends the flight a little every tick and wears off.
    if (spin !== 0) {
      let out = setLength(vx + spin, vy, speed);
      if (Math.abs(out.vy) < RALLY_MIN_VY) out = setLength(out.vx, out.vy < 0 ? -RALLY_MIN_VY : RALLY_MIN_VY, speed);
      vx = out.vx;
      vy = out.vy;
      spin = Math.trunc((spin * 15) / 16);
      if (Math.abs(spin) < RALLY_V9_SPIN_END) spin = 0;
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
        const bx = px(x);
        if (kind === "gold") {
          for (let k = 0; k < live.length; k++) {
            const left = rallyDeepPadLeft({ spots: state.spots ?? [], live, padAt, paces: state.paces ?? [] }, k, tick);
            if (bx + RALLY_BALL_R >= left && bx - RALLY_BALL_R <= left + RALLY_TARGET_W) {
              targetHits += 1;
              if (spun) spinHits += 1;
              struckTick = tick;
              struckLeft = left;
              live[k] = live[k]! + RALLY_TARGETS_LIVE;
              padAt[k] = tick;
              break;
            }
          }
        }
        // The multi-ball pad: any ball but the twin releases the twin.
        if (kind !== "twin" && multiLive && !release && bx + RALLY_BALL_R >= multiLeft && bx - RALLY_BALL_R <= multiLeft + RALLY_V9_MULTI_W) release = { x: multiLeft + RALLY_V9_MULTI_W / 2 };
        const turned = nudge(rng, speed, vx, -vy);
        rng = turned.rng;
        vx = turned.vx;
        vy = turned.vy;
        spin = 0;
        spun = 0;
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
          if (kind === "gold") goldHits += 1;
          else if (kind === "main") hits += 1;
          else twinHits += 1;
          // Only the blue and gold balls speed the rally up; the twin keeps the pace it was given.
          if (kind !== "twin") speed = Math.min(RALLY_SPEED_CAP, Math.trunc((speed * 103) / 100));
          const fromCentre = Math.round(offset - half);
          const steered = setLength(Math.trunc((fromCentre * 256) / Math.max(1, half)) + Math.trunc(vx / 4), -Math.max(RALLY_MIN_VY, Math.abs(vy)), speed);
          vx = steered.vx;
          vy = steered.vy;
          y = paddleYFp - RALLY_BALL_R_FP;
          spin = spinFrom(pv);
          spun = spin !== 0 ? 1 : 0;
          // The streak: 2 a return while doubled, a milestone every 10.
          const before = streak;
          streak += doubled ? 2 : 1;
          if (doubled) dblPts += RALLY_V9_DOUBLE_PTS;
          if (streak > bestStreak) bestStreak = streak;
          milestones += Math.trunc(streak / RALLY_V9_MILESTONE) - Math.trunc(before / RALLY_V9_MILESTONE);
        }
      }

      if (y - RALLY_BALL_R_FP > worldHFp) return null;
    }
    return { x, y, vx, vy, spin, spun };
  };

  const main = move({ x: next.x, y: next.y, vx: next.vx, vy: next.vy, spin: state.spin ?? 0, spun: state.spun ?? 0 }, "main");
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
    const moved = move(ball, "gold");
    if (moved !== null) keptGolds.push(moved);
    else streak = 0; // A missed gold ball ends the streak.
  }
  golds = keptGolds;

  // The twin: lives its ten seconds unless it falls first (which costs nothing).
  let twin: RallyBall | null = state.twin ? { ...state.twin } : null;
  if (twin) {
    twin = twinLeft > 0 ? move(twin, "twin") : null;
    if (!twin) {
      twinLeft = 0;
      multiAt = tick + RALLY_V9_MULTI_AGAIN;
      multiSpot += 1;
    }
  }
  if (release && !twin) {
    const lean = rngBelow(rng, 161);
    rng = lean.state;
    const drop = setLength(lean.value - 80, 256, speed);
    twin = { x: release.x * 256, y: top + RALLY_BALL_R_FP + 256, vx: drop.vx, vy: drop.vy, spin: 0, spun: 0 };
    twinLeft = RALLY_V9_TWIN_TICKS;
    multiUsed += 1;
    multiAt = 0;
  }

  next.golds = golds;
  next.speed = speed;
  next.hits = hits;
  next.goldHits = goldHits;
  next.rng = rng;
  next.live = live;
  next.padAt = padAt;
  next.targetHits = targetHits;
  next.bounces = bounces;
  next.struckTick = struckTick;
  next.struckLeft = struckLeft;
  next.bumped = bumped;
  next.multiAt = multiAt;
  next.multiSpot = multiSpot;
  next.multiUsed = multiUsed;
  next.twin = twin;
  next.twinLeft = twinLeft;
  next.twinHits = twinHits;
  next.streak = streak;
  next.bestStreak = bestStreak;
  next.milestones = milestones;
  next.dblPts = dblPts;
  next.spinHits = spinHits;
  if (next.dead || tick >= RALLY_RUN_TICKS) next.endedTick = tick;
  return next;
}

/**
 * rallyRev 9 band knots (5 a gold-ball hit, 6 a pad): fitted with scripts/arcade-skill-bands.ts --rev=x so the
 * simulated players' points plus their incidental skill points land where rallyRev 8 put them
 * (docs/expansions/e3.md); 150 at 220, the skill points add up to 50 more.
 */
export const RALLY_V9_BAND_CURVE = bandCurve([0, 60, 90, 105, 125, 160, 220], [0, 40, 64, 84, 97, 118, 150]);

export function rallyDeepParts(state: RallyState): BandParts {
  const units = rallyBandUnits(state.goldHits, state.targetHits ?? 0);
  const skill = rallySkillPoints(state);
  return {
    units,
    points: bandPoints(RALLY_V9_BAND_CURVE, units),
    bonus: skill,
    penalty: 0,
    finished: false,
    text: `${state.goldHits} gold hits · ${state.targetHits ?? 0} targets`,
    bonusText: `Skill: ${state.milestones ?? 0} milestones · ${state.spinHits ?? 0} spin targets · ${state.dblPts ?? 0} doubled`,
  };
}

export const rallyDeepGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = {
  ...rallyGame,
  init: initDeep,
  step: bandStep(stepDeep),
  score: (state) => bandTotal(rallyDeepParts(state), Boolean(state.acted), RALLY_V9_MAX),
  inputRanges: RALLY_V9_INPUT_RANGES,
};
