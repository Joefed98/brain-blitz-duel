/**
 * Skyline — the third arcade game on the shared engine.
 *
 * A block slides back and forth above a tower; a tap drops it. The overlapping
 * part stays, the overhang is lost, and the next block starts from the opposite
 * side at the trimmed width. Everything is integer fixed-point (1/256 px) and
 * every constant below is written once, in units.
 */

import {
  clampInt,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "./engine";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";
import type { ArcadeGame } from "./engine";
import { stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";

/* ============================== Constants ============================== */

export const SKYLINE_WORLD_W = 390;
export const SKYLINE_WORLD_H = 560;

export const SKYLINE_RUN_SECONDS = 60;
export const SKYLINE_RUN_TICKS = SKYLINE_RUN_SECONDS * TICKS_PER_SECOND;

/** Every simulation constant below is already in 1/256-pixel units. */
export const SKYLINE_WORLD_RIGHT = 99_840;
export const SKYLINE_WORLD_BOTTOM = 143_360;

export const SKYLINE_START_W = 51_200;
export const SKYLINE_BLOCK_H = 9_216;

export const SKYLINE_SPEED_START = 768;
export const SKYLINE_SPEED_STEP = 26;
export const SKYLINE_SPEED_MAX = 1_536;

/** Edges within this distance snap into line and win width back. */
export const SKYLINE_PERFECT_TOL = 768;
export const SKYLINE_PERFECT_GROW = 1_536;

/** Par: 36 blocks placed. */
export const SKYLINE_PAR = 36;
export const SKYLINE_BLOCK_POINTS = 2.5;
export const SKYLINE_PERFECT_POINTS = 3;
export const SKYLINE_POINTS_CAP = 110;
export const SKYLINE_SURVIVE_BONUS = 40;

/* ================================ State ================================ */

export interface SkylineBlock {
  /** Left edge, fixed-point. */
  x: number;
  w: number;
}

export interface SkylineState extends BandFields, SkylineExpandFields {
  tick: number;
  rng: number;
  /** Bottom-up: index 0 is the base block. */
  blocks: SkylineBlock[];
  /** The sliding block. */
  x: number;
  w: number;
  /** +1 sliding right, −1 sliding left. */
  dir: number;
  placed: number;
  perfects: number;
  missed: boolean;
  /** The tick of the last perfect drop, for the render-only gold flash. */
  perfectTick: number;
  endedTick: number;
  /** skylineRev 2 only (absent on stored original rounds). */
  rev?: number;
  /** Perfect drops in a row right now, and the longest run so far. */
  streak?: number;
  bestStreak?: number;
  /** Streak bonus points earned (1 per perfect drop that is 3rd or later in a row). */
  streakPoints?: number;
  /** Perfect drops made while a gust was blowing (feedback only; not scored). */
  gustPerfects?: number;
  /** Seeded gusts, packed per gust as [start tick, end tick, direction ±1]; they blow only once WIND_FROM blocks are placed. */
  gusts?: number[];
  /** skylineRev 4 only (Tuning E): the taller view's height in px (SKYLINE_TALL_H). Absent = SKYLINE_WORLD_H. */
  worldH?: number;
}

/** The view height (px) a state is drawn in: Tuning E's taller view, or the original 560. Render only. */
export function skylineWorldH(state: { worldH?: number }): number {
  return state.worldH ?? SKYLINE_WORLD_H;
}

/** Slide speed after this many blocks placed. */
export function skylineSpeed(placed: number): number {
  return Math.min(SKYLINE_SPEED_MAX, SKYLINE_SPEED_START + SKYLINE_SPEED_STEP * placed);
}

function init(seed: number): SkylineState {
  const base: SkylineBlock = {
    x: (SKYLINE_WORLD_RIGHT - SKYLINE_START_W) >> 1,
    w: SKYLINE_START_W,
  };
  // The seed decides which side the first block comes in from.
  const drawn = rngBelow(seed | 0, 2);
  const dir = drawn.value === 0 ? 1 : -1;
  return {
    tick: 0,
    rng: drawn.state,
    blocks: [base],
    x: dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - SKYLINE_START_W,
    w: SKYLINE_START_W,
    dir,
    placed: 0,
    perfects: 0,
    missed: false,
    perfectTick: 0,
    endedTick: 0,
  };
}

function isOver(state: SkylineState): boolean {
  return state.missed || state.tick >= SKYLINE_RUN_TICKS;
}

export function skylineSurvived(state: SkylineState): boolean {
  return !state.missed && state.tick >= SKYLINE_RUN_TICKS;
}

function step(state: SkylineState, tapped: boolean): SkylineState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  if (tapped) {
    const below = state.blocks[state.blocks.length - 1]!;
    const left = Math.max(state.x, below.x);
    const right = Math.min(state.x + state.w, below.x + below.w);
    if (right - left <= 0) {
      return { ...state, tick, missed: true, endedTick: tick };
    }

    const perfect = Math.abs(state.x - below.x) <= SKYLINE_PERFECT_TOL;
    const width = perfect
      ? Math.min(SKYLINE_START_W, below.w + SKYLINE_PERFECT_GROW)
      : right - left;
    const x = perfect ? below.x : left;
    const blocks = [...state.blocks, { x, w: width }];
    const placed = state.placed + 1;
    const dir = state.dir >= 0 ? -1 : 1;
    const next: SkylineState = {
      ...state,
      tick,
      blocks,
      placed,
      perfects: state.perfects + (perfect ? 1 : 0),
      perfectTick: perfect ? tick : state.perfectTick,
      x: dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - width,
      w: width,
      dir,
    };
    if (state.rev === SKYLINE_REV) {
      const streak = perfect ? (state.streak ?? 0) + 1 : 0;
      next.streak = streak;
      next.bestStreak = Math.max(state.bestStreak ?? 0, streak);
      next.streakPoints = (state.streakPoints ?? 0) + (streak >= SKYLINE_STREAK_FROM ? SKYLINE_STREAK_POINTS : 0);
      next.gustPerfects = (state.gustPerfects ?? 0) + (perfect && skylineGustAt(state, tick) !== 0 ? 1 : 0);
    }
    if (tick >= SKYLINE_RUN_TICKS) return { ...next, endedTick: tick };
    return next;
  }

  const speed = skylineSpeedOf(state);
  let x = state.x + state.dir * speed;
  if (state.rev === SKYLINE_REV) x += skylineGustAt(state, tick) * SKYLINE_GUST_SPEED;
  let dir = state.dir;
  if (x <= 0) {
    x = 0;
    dir = 1;
  } else if (x + state.w >= SKYLINE_WORLD_RIGHT) {
    x = SKYLINE_WORLD_RIGHT - state.w;
    dir = -1;
  }
  const next: SkylineState = { ...state, tick, x, dir };
  if (tick >= SKYLINE_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: SkylineState): number {
  if (state.rev === SKYLINE_REV) return skylineRev2Score(state.placed, state.perfects, state.streakPoints ?? 0);
  return clampInt(Math.floor(SKYLINE_BLOCK_POINTS * state.placed + SKYLINE_PERFECT_POINTS * state.perfects), 0, 150);
}

/* =========================== Integrity checks ========================== */

export const SKYLINE_CHECKPOINT_INTERVAL = 300;

export interface SkylineCheckpointState {
  tick: number;
  x: number;
  w: number;
  dir: number;
  placed: number;
  perfects: number;
  speed: number;
  topX: number;
  topW: number;
}

export interface SkylineCheckpoint extends SkylineCheckpointState {
  checksum: number;
}

export function skylineCheckpointState(state: SkylineState): SkylineCheckpointState {
  const top = state.blocks[state.blocks.length - 1]!;
  return {
    tick: state.tick,
    x: state.x,
    w: state.w,
    dir: state.dir,
    placed: state.placed,
    perfects: state.perfects,
    speed: skylineSpeedOf(state),
    topX: top.x,
    topW: top.w,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function skylineCheckpoint(state: SkylineState): SkylineCheckpoint {
  const snapshot = skylineCheckpointState(state);
  let checksum = 0x811c9dc5;
  const values = Object.values(snapshot);
  // skylineRev 2: the streak folds into the checksum; the encoded fields are unchanged.
  if (state.rev === SKYLINE_REV) values.push(state.streak ?? 0, state.streakPoints ?? 0, state.gustPerfects ?? 0);
  // skylineRev 4 (Tuning E): the taller view's height, last.
  if (state.worldH) values.push(state.worldH);
  // skylineRev 7: the expansion's counters, after it.
  if (state.expandRev) values.push(state.expandRev, state.golds ?? 0, state.narrows ?? 0, state.wides ?? 0, state.specialPerfects ?? 0, state.milestones ?? 0, state.perfectUnits ?? 0);
  // skylineRev 11: lives, the trim count and rescues, last.
  if (state.lives !== undefined) values.push(state.lives, state.livesLost ?? 0, state.trimRun ?? 0, state.rescues ?? 0);
  // Levels (15 Nov 2026): a level's code last (absent at Normal), so every Normal checksum is unchanged.
  if (state.lvl) values.push(state.lvl);
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const SKYLINE_BG = "#0B0B0F";
export const SKYLINE_FLASH = "#F5B82E";
/** The game palette, cycled per level — render only, never in the sim. */
export const SKYLINE_COLOURS = [
  "#2ED3B7",
  "#F5B82E",
  "#7C5CFF",
  "#FF7A59",
  "#4F9CF9",
  "#FFE600",
  "#FF4D8D",
  "#8B5A2B",
];

/** Smallest render zoom as the tower grows. */
export const SKYLINE_MIN_ZOOM = 0.45;
const zoomMemo = new WeakMap<CanvasRenderingContext2D, number>();

/** Fixed silhouette: [left, width, height] in world px. */
const BACKDROP = [
  [0, 34, 120], [30, 26, 180], [54, 40, 140], [92, 22, 210], [112, 36, 160], [146, 30, 240],
  [174, 44, 130], [216, 26, 200], [240, 38, 170], [276, 30, 230], [304, 42, 150], [344, 24, 190], [366, 30, 140],
] as const;

function drawBackdrop(ctx: CanvasRenderingContext2D, zoom: number, scroll: number, SKYLINE_WORLD_H = 560): void {
  // Moves a fifth as much as the tower: shrinks a little and sinks a little.
  const k = 1 - (1 - zoom) * 0.2;
  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H + scroll * 0.2 * zoom);
  ctx.scale(k, k);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H);
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x - 40, SKYLINE_WORLD_H - h, w - 2, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x + 15, SKYLINE_WORLD_H - h * 0.6, w - 4, h * 0.6);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize): void {
  const H = skylineWorldH(state);
  const scale = Math.min(size.width / SKYLINE_WORLD_W, size.height / H);
  const offsetX = (size.width - SKYLINE_WORLD_W * scale) / 2;
  const offsetY = (size.height - H * scale) / 2;
  const blockH = px(SKYLINE_BLOCK_H);

  ctx.save();
  ctx.fillStyle = SKYLINE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Camera (render only): once the tower passes the middle the view zooms out
  // about the bottom centre so the whole tower stays in shot, down to 0.45;
  // past that it scrolls. The zoom eases toward its target per canvas.
  const towerH = state.blocks.length * blockH;
  const middle = H / 2;
  const target = towerH + blockH <= middle ? 1 : Math.max(SKYLINE_MIN_ZOOM, middle / (towerH + blockH));
  const prev = zoomMemo.get(ctx);
  const zoom = prev === undefined || state.tick < 2 ? target : prev + (target - prev) * 0.12;
  zoomMemo.set(ctx, zoom);
  const visibleH = H / zoom;
  const camScroll = Math.max(0, towerH + blockH - visibleH * 0.5);

  // Faint city backdrop, parallaxing slower than the tower.
  drawBackdrop(ctx, zoom, camScroll, H);

  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, H);
  ctx.scale(zoom, zoom);
  ctx.translate(-SKYLINE_WORLD_W / 2, -H + camScroll);

  state.blocks.forEach((block, index) => {
    const bottom = H - index * blockH;
    const top = bottom - blockH;
    ctx.fillStyle = SKYLINE_COLOURS[index % SKYLINE_COLOURS.length]!;
    ctx.fillRect(px(block.x), top, px(block.w), blockH);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px(block.x) + 0.5, top + 0.5, px(block.w) - 1, blockH - 1);
  });

  if (!state.missed) {
    const bottom = H - state.blocks.length * blockH;
    ctx.fillStyle = SKYLINE_COLOURS[state.blocks.length % SKYLINE_COLOURS.length]!;
    ctx.fillRect(px(state.x), bottom - blockH, px(state.w), blockH);
  }

  if (state.perfectTick > 0 && state.tick - state.perfectTick < 12) {
    ctx.fillStyle = SKYLINE_FLASH;
    ctx.fillRect(-SKYLINE_WORLD_W, H - state.blocks.length * blockH - 2, SKYLINE_WORLD_W * 3, 2);
  }
  ctx.restore();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Blocks ${state.placed}`, 12, 12);
  ctx.textAlign = "right";

  if (state.missed) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, SKYLINE_WORLD_W, H);
  }

  ctx.restore();
}

export const skylineGame: ArcadeGame<SkylineState> = {
  key: "skyline",
  runTicks: SKYLINE_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
};

/* ====================== skylineRev 2: wind and streaks ====================== */

/**
 * Stored as puzzle.skylineRev. From the 20th block the top of the tower flies a
 * flag; seeded gusts (all the same strength, either way) push the sliding block
 * while they blow, and the flag starts waving a second before each one. Perfect
 * drops in a row build a streak: every perfect drop from the third in a row
 * scores a bonus. Unstamped rounds keep the original rules and score.
 */
export const SKYLINE_REV = 2;
/** Gusts blow (and the flag flies) once this many blocks are placed. */
export const SKYLINE_WIND_FROM = 20;
/** Every gust pushes the sliding block this much per tick (1.25 px), on top of its slide. */
export const SKYLINE_GUST_SPEED = 320;
/** The flag starts waving this many ticks before a gust blows. */
export const SKYLINE_GUST_WARN_TICKS = 60;
export const SKYLINE_GUST_MIN_TICKS = 90;
export const SKYLINE_GUST_MAX_TICKS = 150;
/** Calm between gusts (from the end of one to the start of the next). */
export const SKYLINE_CALM_MIN_TICKS = 150;
export const SKYLINE_CALM_MAX_TICKS = 300;
/** Streak bonus: each perfect drop that is at least the 3rd in a row adds this. */
export const SKYLINE_STREAK_FROM = 3;
export const SKYLINE_STREAK_POINTS = 1;
/** Rev-2 scoring: per block and per perfect drop (streak points on top), capped at 150. */
export const SKYLINE_V2_BLOCK_POINTS = 2.5;
export const SKYLINE_V2_PERFECT_POINTS = 2.5;

export function skylineRev2Score(placed: number, perfects: number, streakPoints: number): number {
  return clampInt(Math.floor(SKYLINE_V2_BLOCK_POINTS * placed + SKYLINE_V2_PERFECT_POINTS * perfects) + streakPoints, 0, 150);
}

/** The seeded gust schedule for a run, [start, end, dir] per gust, from its own stream. */
export function skylineGusts(seed: number): number[] {
  let rng = (seed ^ 0x2f6b_a7c3) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const out: number[] = [];
  let t = 120 + draw(SKYLINE_CALM_MAX_TICKS - SKYLINE_CALM_MIN_TICKS + 1);
  while (t < SKYLINE_RUN_TICKS) {
    const len = SKYLINE_GUST_MIN_TICKS + draw(SKYLINE_GUST_MAX_TICKS - SKYLINE_GUST_MIN_TICKS + 1);
    const dir = draw(2) === 0 ? -1 : 1;
    out.push(t, t + len, dir);
    t += len + SKYLINE_CALM_MIN_TICKS + draw(SKYLINE_CALM_MAX_TICKS - SKYLINE_CALM_MIN_TICKS + 1);
  }
  return out;
}

/** The gust direction blowing on `tick` (0 when calm or before the flag is up). */
export function skylineGustAt(state: SkylineState, tick: number): number {
  if (state.rev !== SKYLINE_REV || state.placed < skylineWindFrom(state)) return 0;
  const g = state.gusts ?? [];
  for (let k = 0; k < g.length; k += 3) if (tick >= g[k]! && tick < g[k + 1]!) return g[k + 2]!;
  return 0;
}

/** Render only: the flag's state on `tick` — 0 hanging still, ±1 streaming that way (warning or blowing). */
export function skylineFlagAt(state: SkylineState, tick: number): number {
  if (state.rev !== SKYLINE_REV || state.placed < skylineWindFrom(state)) return 0;
  const g = state.gusts ?? [];
  for (let k = 0; k < g.length; k += 3) if (tick >= g[k]! - SKYLINE_GUST_WARN_TICKS && tick < g[k + 1]!) return g[k + 2]!;
  return 0;
}

const gustCache = new Map<number, number[]>();
function initRev2(seed: number): SkylineState {
  let gusts = gustCache.get(seed | 0);
  if (!gusts) {
    gusts = skylineGusts(seed);
    if (gustCache.size > 16) gustCache.clear();
    gustCache.set(seed | 0, gusts);
  }
  return { ...init(seed), rev: SKYLINE_REV, streak: 0, bestStreak: 0, streakPoints: 0, gustPerfects: 0, gusts };
}

export const skylineRev2Game: ArcadeGame<SkylineState> = { ...skylineGame, init: initRev2 };
export function skylineGameFor(rev?: number | null, level?: string | null): ArcadeGame<SkylineState> {
  // Levels (15 Nov 2026): skylineRev 11 at Easy, Hard or Expert (the puzzle's `level`); Normal and older stamps as before.
  if (rev === SKYLINE_REV_LIVES && isSkylineLevel(level)) return skylineLivesGameAt(level);
  if (rev === SKYLINE_REV_LIVES) return skylineLivesGame;
  if (rev === SKYLINE_REV_COUNT) return skylineCountGame;
  if (rev === SKYLINE_REV_STD) return skylineStdGame;
  if (rev === SKYLINE_REV_LIFT) return skylineLiftGame;
  if (rev === SKYLINE_REV_EXPAND) return skylineExpandGame;
  if (rev === SKYLINE_REV_STRICT) return skylineStrictGame;
  if (rev === SKYLINE_REV_TARGET) return skylineTargetGame;
  if (rev === SKYLINE_REV_TALL) return skylineTallGame;
  if (rev === SKYLINE_REV_BAND) return skylineBandGame;
  return rev === SKYLINE_REV ? skylineRev2Game : skylineGame;
}

/* ================= Oct 2026 score bands (skylineRev 3) ================= */

/** Score-band revision (puzzle.skylineRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const SKYLINE_REV_BAND = 3;
/** Blocks and perfect drops count 5 each and streak points 2; 150 at 600. */
export const SKYLINE_BAND_CURVE = bandCurve([0, 100, 165, 280, 480, 600], [0, 70, 100, 125, 145, 150]);

export function skylineBandParts(state: SkylineState): BandParts {
  if (state.expandRev === SKYLINE_REV_STD) return skylineStdBandParts(state);
  if (state.expandRev) return skylineExpandParts(state);
  const units = 5 * state.placed + 5 * state.perfects + 2 * (state.streakPoints ?? 0);
  return { units, points: bandPoints(bandCurveOf(state, SKYLINE_BAND_CURVE), units), bonus: 0, penalty: 0, finished: false, text: `${state.placed} blocks · ${state.perfects} perfect · +${state.streakPoints ?? 0} streak` };
}

function scoreBand(state: SkylineState): number {
  return bandTotal(skylineBandParts(state), Boolean(state.acted));
}

export const skylineBandGame: ArcadeGame<SkylineState> = { ...skylineRev2Game, init: (seed) => bandInit(skylineRev2Game.init(seed)) };

/* ================= Tuning E (skylineRev 4, Oct 2026) ================= */

/**
 * skylineRev 4 (Tuning E): skylineRev 3 play and scoring unchanged (the sim is
 * horizontal only), drawn in a taller view (390 × SKYLINE_TALL_H, the same for
 * every player) so the arena fills a 390 × 844 phone down to the usual gap and
 * shows more of the tower and sky before the camera zooms out. States add
 * `worldH`, folded into the checkpoint checksum last.
 */
export const SKYLINE_REV_TALL = 4;
export const SKYLINE_TALL_H = 735;
export const skylineTallGame: ArcadeGame<SkylineState> = { ...skylineBandGame, init: (seed) => ({ ...skylineBandGame.init(seed), worldH: SKYLINE_TALL_H }) };

/** The view height (px) a stored round's skylineRev draws in. */
export function skylineWorldHFor(rev?: number | null): number {
  if (rev === SKYLINE_REV_EXPAND || rev === SKYLINE_REV_LIFT || rev === SKYLINE_REV_STD || rev === SKYLINE_REV_COUNT || rev === SKYLINE_REV_LIVES) return SKYLINE_SKY_H;
  return rev === SKYLINE_REV_TALL || rev === SKYLINE_REV_TARGET || rev === SKYLINE_REV_STRICT ? SKYLINE_TALL_H : SKYLINE_WORLD_H;
}

/* ================= Scoring targets (skylineRev 5, 18 Oct 2026) ================= */

/**
 * skylineRev 5 (scoring targets, docs/scoring-targets.md): skylineRev 4 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const SKYLINE_REV_TARGET = 5;
export const skylineTargetGame = bandTargetGame(skylineTallGame);
/** The curve new rounds score on: SKYLINE_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const SKYLINE_V5_BAND_CURVE = bandRetarget(SKYLINE_BAND_CURVE);


/* ================= Score bands (skylineRev 6, 19 Oct 2026) ================= */

/**
 * skylineRev 6 (score bands, docs/scoring-targets.md): skylineRev 5 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const SKYLINE_REV_STRICT = 6;
export const skylineStrictGame = bandStrictGame(skylineTargetGame);
/** The curve new rounds score on: SKYLINE_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const SKYLINE_V6_BAND_CURVE = bandStrict(SKYLINE_BAND_CURVE);

/* ============ World expansion (skylineRev 7, 25 Oct 2026, docs/expansions/e4.md) ============ */

/**
 * skylineRev 7 (the 200-point expansion, docs/scoring-200.md): skylineRev 6 play (the slide, the
 * overhang rule, the wind from block 20 and the perfect streak) with
 *
 *  - more sky: a camera that lets the tower climb higher before it pulls back, zooms out further and pulls
 *    right back at every milestone (render only, skyline.renderer.ts), in Tuning E's 390 × 735 view;
 *  - a streak multiplier: a perfect drop scores ×2 from the 3rd perfect drop in a row, ×3 from the
 *    6th and ×4 from the 10th (SKYLINE_STREAK_TIERS); any drop that isn't perfect resets it;
 *  - special blocks, dealt from the seed and announced one block ahead in the next-block preview:
 *    gold (the usual width; a perfect drop adds SKYLINE_GOLD_UNITS), narrow (three quarters of the
 *    top's width: harder, worth more) and wide (SKYLINE_WIDE_GROW wider: easier, worth less; a
 *    perfect, centred drop keeps it whole, so the tower widens). A narrow or wide block is perfect
 *    when its centre lines up with the top's centre;
 *  - height milestones every SKYLINE_MILESTONE_EVERY floors: a bonus, a celebration and the camera
 *    pulling back to show the city (render only).
 *
 * Scored to 200 (ROUND_MAX) on its own curve (SKYLINE_V7_BAND_CURVE) over skylineV7Units. Every older
 * revision plays and scores exactly as before: the expansion's step and score run only on states
 * with `expandRev` (absent on every older round).
 */
export const SKYLINE_REV_EXPAND = 7;
/**
 * The view's height (px): Tuning E's 735, the tallest world that still fills the arena box's width on the
 * iPhone 11 home-screen app (414 × 772) and a 390 × 844 phone (taller, the world would leave side strips the
 * parallax city cannot run on into). The extra sky comes from the camera (skyline.renderer.ts).
 */
export const SKYLINE_SKY_H = SKYLINE_TALL_H;

/** Block kinds (skylineRev 7). */
export const SKYLINE_KIND_NORMAL = 0;
export const SKYLINE_KIND_GOLD = 1;
export const SKYLINE_KIND_NARROW = 2;
export const SKYLINE_KIND_WIDE = 3;
/** Special blocks are dealt from this block on (0-based: the 5th block), never two in a row. */
export const SKYLINE_SPECIAL_FROM = 4;
/** Chance of a special block (in 1000ths) on a block that may be one, and the kind shares (gold, narrow, wide). */
export const SKYLINE_SPECIAL_CHANCE = 300;
export const SKYLINE_SPECIAL_SHARES: readonly [number, number, number] = [4, 3, 3];
/** How many blocks the schedule deals (no run places more than ~70 in 60 s). */
export const SKYLINE_KIND_COUNT = 96;
/** A wide block is this much wider than the top (capped at the start width). */
export const SKYLINE_WIDE_GROW = 12_288;
/** A narrow block is three quarters of the top's width, but never under this (or the top, if narrower). */
export const SKYLINE_NARROW_MIN = 8_192;

/** Streak multiplier tiers: [perfect drops in a row, multiplier], highest first. */
export const SKYLINE_STREAK_TIERS: readonly (readonly [number, number])[] = [
  [10, 4],
  [6, 3],
  [3, 2],
];
/** Units (skylineV7Units): per block by kind, per perfect drop (times the streak multiplier), gold and milestones. */
export const SKYLINE_V7_BLOCK_UNITS: readonly number[] = [5, 5, 8, 3];
export const SKYLINE_V7_PERFECT_UNITS = 5;
export const SKYLINE_GOLD_UNITS = 15;
export const SKYLINE_MILESTONE_EVERY = 10;
export const SKYLINE_MILESTONE_UNITS = 20;

/** The streak multiplier for a run of `streak` perfect drops (1 below the first tier). */
export function skylineStreakMult(streak: number): number {
  for (const [from, mult] of SKYLINE_STREAK_TIERS) if (streak >= from) return mult;
  return 1;
}

/** The seeded block-kind schedule for a run (its own stream), one kind per block index. */
export function skylineKinds(seed: number): number[] {
  let rng = (seed ^ 0x5b1d_e7a3) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const shares = SKYLINE_SPECIAL_SHARES[0] + SKYLINE_SPECIAL_SHARES[1] + SKYLINE_SPECIAL_SHARES[2];
  const out: number[] = [];
  for (let i = 0; i < SKYLINE_KIND_COUNT; i++) {
    const roll = draw(1000);
    const pick = draw(shares);
    if (i < SKYLINE_SPECIAL_FROM || out[i - 1] !== SKYLINE_KIND_NORMAL || roll >= SKYLINE_SPECIAL_CHANCE) out.push(SKYLINE_KIND_NORMAL);
    else out.push(pick < SKYLINE_SPECIAL_SHARES[0] ? SKYLINE_KIND_GOLD : pick < SKYLINE_SPECIAL_SHARES[0] + SKYLINE_SPECIAL_SHARES[1] ? SKYLINE_KIND_NARROW : SKYLINE_KIND_WIDE);
  }
  return out;
}

/** The kind of the block with this 0-based index in a rev-7 run (normal past the schedule, and on older rounds). */
export function skylineKindAt(state: SkylineState, index: number): number {
  return state.kinds?.[index] ?? SKYLINE_KIND_NORMAL;
}

/** The sliding block's width for a kind, given the top block's width. */
export function skylineKindWidth(kind: number, topW: number): number {
  if (kind === SKYLINE_KIND_NARROW) return Math.max(Math.min(topW, SKYLINE_NARROW_MIN), Math.trunc((topW * 3) / 4));
  if (kind === SKYLINE_KIND_WIDE) return Math.min(SKYLINE_START_W, topW + SKYLINE_WIDE_GROW);
  return topW;
}

/** skylineRev 7's fields (absent on every older round). */
export interface SkylineExpandFields {
  /** skylineRev 10 (the scoring audit): 1 = perfect drops counted up to SKYLINE_V9_FULL_AT, never a share. Outside the checksum. */
  perfectCount?: number;
  expandRev?: number;
  /** The block-kind schedule (skylineKinds), one per block index. */
  kinds?: number[];
  /** Gold blocks landed perfectly, narrow and wide blocks placed, perfect narrow / wide drops. */
  golds?: number;
  narrows?: number;
  wides?: number;
  specialPerfects?: number;
  /** Height milestones reached and the tick of the last one (render: celebration and camera pull-back). */
  milestones?: number;
  milestoneTick?: number;
  /** Streak-multiplied perfect units so far (5 × the multiplier per perfect drop). */
  perfectUnits?: number;
  /** The highest streak multiplier reached. */
  bestMult?: number;
  /** Kind of the last block placed and the tick it landed (render: the gold pop). */
  lastKind?: number;
  lastPerfect?: number;
  /** skylineRev 11 (lives): lives left (the run ends when the last is lost), lives lost so far. */
  lives?: number;
  livesLost?: number;
  /** skylineRev 11: placed drops in a row that were not perfect (the wide-block rescue's count), rescues dealt. */
  trimRun?: number;
  rescues?: number;
  /** skylineRev 11, render only: the tick a block was lost and where it was (it falls away). */
  lostTick?: number;
  /**
   * Levels (15 Nov 2026, docs/arcade-standard/skyline.md "Levels"; absent at Normal and on every older round): the level
   * the run is played at (SKYLINE_LEVEL_CODE: 1 Easy, 3 Hard, 4 Expert): its slide speed, perfect tolerance, wind start
   * and lives (SKYLINE_LEVEL_RULES). Folded into the checkpoint checksum last.
   */
  lvl?: number;
  lostX?: number;
  lostW?: number;
}

const kindCache = new Map<number, number[]>();
function kindsFor(seed: number): number[] {
  let kinds = kindCache.get(seed | 0);
  if (!kinds) {
    kinds = skylineKinds(seed);
    if (kindCache.size > 16) kindCache.clear();
    kindCache.set(seed | 0, kinds);
  }
  return kinds;
}

function initExpand(seed: number): SkylineState {
  return {
    ...skylineStrictGame.init(seed),
    worldH: SKYLINE_SKY_H,
    expandRev: SKYLINE_REV_EXPAND,
    kinds: kindsFor(seed),
    golds: 0,
    narrows: 0,
    wides: 0,
    specialPerfects: 0,
    milestones: 0,
    milestoneTick: 0,
    perfectUnits: 0,
    bestMult: 1,
    lastKind: SKYLINE_KIND_NORMAL,
    lastPerfect: 0,
  };
}

/** One rev-7 tick (the rev-2 rules plus the expansion's blocks, multiplier and milestones). */
function stepExpand(state: SkylineState, tapped: boolean): SkylineState {
  if (isOver(state)) return state;
  if (!tapped) return step(state, false);
  const tick = state.tick + 1;
  const below = state.blocks[state.blocks.length - 1]!;
  const left = Math.max(state.x, below.x);
  const right = Math.min(state.x + state.w, below.x + below.w);
  if (right - left <= 0) return { ...state, tick, missed: true, endedTick: tick };

  const kind = skylineKindAt(state, state.placed);
  const special = kind === SKYLINE_KIND_NARROW || kind === SKYLINE_KIND_WIDE;
  let perfect: boolean;
  let x: number;
  let width: number;
  if (special) {
    const centre = below.x + (below.w >> 1);
    perfect = Math.abs(state.x + (state.w >> 1) - centre) <= skylineTolOf(state);
    // A centred narrow or wide block stays whole (a wide one widens the tower); otherwise the overhang is cut.
    x = perfect ? centre - (state.w >> 1) : left;
    width = perfect ? state.w : right - left;
  } else {
    perfect = Math.abs(state.x - below.x) <= skylineTolOf(state);
    width = perfect ? Math.min(SKYLINE_START_W, below.w + SKYLINE_PERFECT_GROW) : right - left;
    x = perfect ? below.x : left;
  }
  const blocks = [...state.blocks, { x, w: width }];
  const placed = state.placed + 1;
  const streak = perfect ? (state.streak ?? 0) + 1 : 0;
  const mult = perfect ? skylineStreakMult(streak) : 1;
  const nextKind = skylineKindAt(state, placed);
  const nextW = skylineKindWidth(nextKind, width);
  const dir = state.dir >= 0 ? -1 : 1;
  const milestone = placed % SKYLINE_MILESTONE_EVERY === 0;
  const next: SkylineState = {
    ...state,
    tick,
    blocks,
    placed,
    perfects: state.perfects + (perfect ? 1 : 0),
    perfectTick: perfect ? tick : state.perfectTick,
    x: dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - nextW,
    w: nextW,
    dir,
    streak,
    bestStreak: Math.max(state.bestStreak ?? 0, streak),
    streakPoints: (state.streakPoints ?? 0) + (streak >= SKYLINE_STREAK_FROM ? SKYLINE_STREAK_POINTS : 0),
    gustPerfects: (state.gustPerfects ?? 0) + (perfect && skylineGustAt(state, tick) !== 0 ? 1 : 0),
    golds: (state.golds ?? 0) + (perfect && kind === SKYLINE_KIND_GOLD ? 1 : 0),
    narrows: (state.narrows ?? 0) + (kind === SKYLINE_KIND_NARROW ? 1 : 0),
    wides: (state.wides ?? 0) + (kind === SKYLINE_KIND_WIDE ? 1 : 0),
    specialPerfects: (state.specialPerfects ?? 0) + (perfect && special ? 1 : 0),
    milestones: (state.milestones ?? 0) + (milestone ? 1 : 0),
    milestoneTick: milestone ? tick : (state.milestoneTick ?? 0),
    perfectUnits: (state.perfectUnits ?? 0) + (perfect ? SKYLINE_V7_PERFECT_UNITS * mult : 0),
    bestMult: Math.max(state.bestMult ?? 1, mult),
    lastKind: kind,
    lastPerfect: perfect ? tick : (state.lastPerfect ?? 0),
  };
  if (tick >= SKYLINE_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

/** The streak multiplier the next perfect drop would score at (HUD). */
export function skylineNextMult(state: SkylineState): number {
  return skylineStreakMult((state.streak ?? 0) + 1);
}

/** skylineRev 7's achievement units: blocks by kind, streak-multiplied perfects, gold perfects and milestones. */
export function skylineV7Units(state: SkylineState): { blocks: number; perfects: number; gold: number; milestones: number; total: number } {
  let blocks = 0;
  for (let i = 0; i < state.placed; i++) blocks += SKYLINE_V7_BLOCK_UNITS[skylineKindAt(state, i)] ?? 5;
  const perfects = state.perfectUnits ?? 0;
  const gold = SKYLINE_GOLD_UNITS * (state.golds ?? 0);
  const milestones = SKYLINE_MILESTONE_UNITS * (state.milestones ?? 0);
  return { blocks, perfects, gold, milestones, total: blocks + perfects + gold + milestones };
}

/**
 * skylineRev 7's curve to 200 over skylineV7Units: fitted (scripts/e4-fit.ts on the skill-band bots) so a
 * player of every level lands near today's rev-6 score for that level up to great, and only strong use of
 * the streak multiplier, gold blocks and milestones climbs to 190–200. Merge retune (26 Oct 2026; the stamp is not
 * live): the top flattened so near-perfect's top 10 % stays under about 185, on the tuning and 200 fresh seeds.
 */
/** skylineRev 7's top score (its ROUND_MAX line, roundMax.ts). */
export const SKYLINE_V7_MAX = 200;
export const SKYLINE_V7_BAND_CURVE = bandCurve([0, 129, 203, 326, 613, 900, 1100], [0, 72, 99, 118, 168, 185, 200]);

export function skylineExpandParts(state: SkylineState): BandParts {
  const u = skylineV7Units(state);
  return {
    units: u.total,
    points: bandPoints(state.expandRev === SKYLINE_REV_LIFT ? SKYLINE_V8_BAND_CURVE : SKYLINE_V7_BAND_CURVE, u.total),
    bonus: 0,
    penalty: 0,
    finished: false,
    text: `${state.placed} blocks · ${state.perfects} perfect · best ×${state.bestMult ?? 1} · ${state.golds ?? 0} gold · ${state.milestones ?? 0} milestones`,
  };
}

function scoreExpand(state: SkylineState): number {
  return bandTotal(skylineExpandParts(state), Boolean(state.acted), SKYLINE_V7_MAX);
}

export const skylineExpandGame: ArcadeGame<SkylineState> = {
  ...skylineGame,
  init: initExpand,
  step: bandStep(stepExpand),
  score: scoreExpand,
};

/* ============ A gentler curve (skylineRev 8, 27 Oct 2026, Joe's phone notes) ============ */

/**
 * skylineRev 8: skylineRev 7's play exactly (the same blocks, kinds, multiplier, milestones and units),
 * scored on a gentler curve after Joe's phone test ("scores feel slightly low: lift them a little"):
 * every knot below the top lifted about 7–8 %, the 200 ceiling and its unit count kept. The state carries
 * `expandRev: 8` (folded into the checkpoint checksum as rev 7's 7 is); everything else reads it as rev 7.
 */
export const SKYLINE_REV_LIFT = 8;
export const SKYLINE_V8_BAND_CURVE = bandCurve([0, 129, 203, 326, 613, 900, 1100], [0, 78, 107, 127, 177, 192, 200]);

export const skylineLiftGame: ArcadeGame<SkylineState> = {
  ...skylineExpandGame,
  init: (seed: number) => ({ ...initExpand(seed), expandRev: SKYLINE_REV_LIFT }),
};

/* ============ The arcade scoring standard (skylineRev 9, 29 Oct 2026, docs/arcade-standard/skyline.md) ============ */

/**
 * skylineRev 9: skylineRev 8's play (the slide, the overhang rule, the wind from block 20, narrow and wide blocks,
 * the height milestones' celebration and camera) scored on the arcade scoring standard (arcadeStandard.ts), with
 * the gold blocks dealt differently:
 *
 *  - Floors (core) up to 140: floors built on a straight line, full at SKYLINE_V9_FULL_AT (the skill-band tool's
 *    near-perfect median on the tuning seeds). Height milestones score nothing (the old 20 every 10 floors is in here);
 *  - Perfect drops up to 30: by the share of drops that are perfect, counted over at least SKYLINE_V9_FULL_AT drops
 *    (so one perfect drop and a quit can't take it all);
 *  - Perfect streak up to 10: 1 for each perfect drop in the best streak (full at 10 in a row). The ×2 / ×3 / ×4
 *    streak multiplier no longer scores (the sim still counts it, unread);
 *  - Gold blocks up to 20: exactly SKYLINE_V9_GOLD_COUNT gold blocks a run, 4 each landed perfectly, at seeded places
 *    from the room seed, one in each fifth of blocks SKYLINE_SPECIAL_FROM … SKYLINE_V9_FULL_AT − 1, never next to
 *    another special (skylineKindsV9). Narrow and wide blocks stay where rev 8 deals them and score as any floor.
 *
 * The state carries `expandRev: 9` (folded into the checkpoint checksum as 7 and 8 are); every older revision plays
 * and scores exactly as before.
 */
export const SKYLINE_REV_STD = 9;
/** Floors at which the core is full: the near-perfect level's median floors (61 on rev 8 = rev 9 play, seeds 0–59). */
export const SKYLINE_V9_FULL_AT = 61;
export const SKYLINE_V9_CORE_MAX = 140;
export const SKYLINE_V9_PERFECTS_MAX = 30;
export const SKYLINE_V9_STREAK_MAX = 10;
export const SKYLINE_V9_GOLD_COUNT = 5;
export const SKYLINE_V9_GOLD_MAX = 20;
/** The core's straight line (the help's curve, liveBands.ts): 140 at SKYLINE_V9_FULL_AT floors. */
export const SKYLINE_V9_BAND_CURVE = bandCurve([0, SKYLINE_V9_FULL_AT], [0, SKYLINE_V9_CORE_MAX]);

export const SKYLINE_STD_SPEC: StdSpec = {
  field: "skylineRev",
  rev: SKYLINE_REV_STD,
  parts: [
    { key: "core", label: "Floors", max: SKYLINE_V9_CORE_MAX, how: `every floor counts the same, all of it at ${SKYLINE_V9_FULL_AT} floors` },
    { key: "perfects", label: "Perfect drops", max: SKYLINE_V9_PERFECTS_MAX, how: `the share of your drops that are perfect (out of at least ${SKYLINE_V9_FULL_AT})` },
    { key: "streak", label: "Perfect streak", max: SKYLINE_V9_STREAK_MAX, how: "1 for each perfect drop in your best streak" },
    { key: "gold", label: "Gold blocks", max: SKYLINE_V9_GOLD_MAX, how: `${SKYLINE_V9_GOLD_MAX / SKYLINE_V9_GOLD_COUNT} for each of the ${SKYLINE_V9_GOLD_COUNT} gold blocks landed perfectly` },
  ],
};

/**
 * skylineRev 9's block kinds: rev 7's narrow and wide blocks where they were (its gold blocks made normal), then
 * exactly SKYLINE_V9_GOLD_COUNT gold blocks from their own stream, one in each fifth of blocks
 * [SKYLINE_SPECIAL_FROM, SKYLINE_V9_FULL_AT), each on a block whose neighbours are both normal (never two specials in a
 * row). A fifth with no such block (rare) takes a seeded block whose neighbours are made normal.
 */
export function skylineKindsV9(seed: number): number[] {
  const kinds = skylineKinds(seed).map((k) => (k === SKYLINE_KIND_GOLD ? SKYLINE_KIND_NORMAL : k));
  let rng = (seed ^ 0x3c9e_71d5) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const span = SKYLINE_V9_FULL_AT - SKYLINE_SPECIAL_FROM;
  for (let g = 0; g < SKYLINE_V9_GOLD_COUNT; g++) {
    const lo = SKYLINE_SPECIAL_FROM + Math.floor((span * g) / SKYLINE_V9_GOLD_COUNT);
    const hi = SKYLINE_SPECIAL_FROM + Math.floor((span * (g + 1)) / SKYLINE_V9_GOLD_COUNT);
    const eligible: number[] = [];
    for (let i = lo; i < hi; i++)
      if (kinds[i - 1] === SKYLINE_KIND_NORMAL && kinds[i] === SKYLINE_KIND_NORMAL && kinds[i + 1] === SKYLINE_KIND_NORMAL) eligible.push(i);
    let pick: number;
    if (eligible.length > 0) pick = eligible[draw(eligible.length)]!;
    else {
      pick = lo + 1 + draw(hi - lo - 2);
      kinds[pick - 1] = SKYLINE_KIND_NORMAL;
      kinds[pick + 1] = SKYLINE_KIND_NORMAL;
    }
    kinds[pick] = SKYLINE_KIND_GOLD;
  }
  return kinds;
}

const kindV9Cache = new Map<number, number[]>();
function kindsV9For(seed: number): number[] {
  let kinds = kindV9Cache.get(seed | 0);
  if (!kinds) {
    kinds = skylineKindsV9(seed);
    if (kindV9Cache.size > 16) kindV9Cache.clear();
    kindV9Cache.set(seed | 0, kinds);
  }
  return kinds;
}

/** Render and sound only: the streak multiplier a state's HUD, pops and cues show (1 on rev 9, which scores none). */
export function skylineShownMult(state: SkylineState, streak: number = state.streak ?? 0): number {
  return state.expandRev === SKYLINE_REV_STD ? 1 : skylineStreakMult(streak);
}

/** skylineRev 9's scored parts (null on every older revision). */
export function skylineStdParts(state: SkylineState): StdPart[] | null {
  if (state.expandRev !== SKYLINE_REV_STD) return null;
  const placed = state.placed;
  const perfects = state.perfects;
  const best = state.bestStreak ?? 0;
  const golds = state.golds ?? 0;
  return [
    stdPart(SKYLINE_STD_SPEC, "core", stdLine(SKYLINE_V9_CORE_MAX, placed, SKYLINE_V9_FULL_AT), `${placed} floor${placed === 1 ? "" : "s"}`),
    // skylineRev 10: perfect drops counted (up to SKYLINE_V9_FULL_AT), so a drop that isn't perfect never lowers the score.
    state.perfectCount
      ? stdPart(SKYLINE_STD_SPEC_V10, "perfects", stdLine(SKYLINE_V9_PERFECTS_MAX, Math.min(perfects, SKYLINE_V9_FULL_AT), SKYLINE_V9_FULL_AT), `${perfects} perfect drop${perfects === 1 ? "" : "s"}`)
      : stdPart(SKYLINE_STD_SPEC, "perfects", stdLine(SKYLINE_V9_PERFECTS_MAX, perfects, Math.max(placed, SKYLINE_V9_FULL_AT)), `${perfects} of ${placed} perfect`),
    stdPart(SKYLINE_STD_SPEC, "streak", Math.min(best, SKYLINE_V9_STREAK_MAX), `best ${best} in a row`),
    stdPart(SKYLINE_STD_SPEC, "gold", stdLine(SKYLINE_V9_GOLD_MAX, golds, SKYLINE_V9_GOLD_COUNT), `${golds} of ${SKYLINE_V9_GOLD_COUNT} gold`),
  ];
}

/** skylineRev 9 for the skill-band tool: units = floors, points = the core, bonus = the features. */
function skylineStdBandParts(state: SkylineState): BandParts {
  const parts = skylineStdParts(state)!;
  const core = parts[0]!.points;
  return {
    units: state.placed,
    points: core,
    bonus: stdSum(parts) - core,
    penalty: 0,
    finished: false,
    text: parts.map((p) => `${p.label} ${p.points}`).join(" · "),
  };
}

function scoreStd(state: SkylineState): number {
  return stdScore(skylineStdParts(state)!, Boolean(state.acted));
}

export const skylineStdGame: ArcadeGame<SkylineState> = {
  ...skylineExpandGame,
  init: (seed: number) => ({ ...initExpand(seed), expandRev: SKYLINE_REV_STD, kinds: kindsV9For(seed) }),
  score: scoreStd,
};

/* ================= Perfect drops counted (skylineRev 10, Nov 2026, the scoring audit) ================= */

/**
 * skylineRev 10 (docs/arcade-standard/skyline.md "skylineRev 10"; docs/audit-nov-2026/scoring.md issue 5): skylineRev 9's
 * play and gold blocks exactly (a skylineRev 9 log replays tick for tick, the same checksum; the state keeps
 * `expandRev: 9`), with the perfect-drops part counted, not shared: 30 × min(perfect drops, SKYLINE_V9_FULL_AT) ÷
 * SKYLINE_V9_FULL_AT. On rev 9 it was the share of drops that were perfect, so past 61 floors every drop that wasn't
 * perfect lowered the score (117 floors could score below 60). Now another floor never lowers it. States add
 * `perfectCount: 1`, outside the checkpoint checksum (playRevOf maps 10 to 9's play).
 */
export const SKYLINE_REV_COUNT = 10;
export const SKYLINE_STD_SPEC_V10: StdSpec = {
  ...SKYLINE_STD_SPEC,
  rev: SKYLINE_REV_COUNT,
  parts: SKYLINE_STD_SPEC.parts.map((p) =>
    p.key === "perfects" ? { ...p, how: `every perfect drop counts the same, all of it at ${SKYLINE_V9_FULL_AT} perfect drops` } : p,
  ),
};

export const skylineCountGame: ArcadeGame<SkylineState> = {
  ...skylineStdGame,
  init: (seed: number) => ({ ...skylineStdGame.init(seed), perfectCount: 1 }),
};

/* ================= Lives and the wide-block rescue (skylineRev 11, 15 Nov 2026, the Action overhaul) ================= */

/**
 * skylineRev 11 (docs/arcade-standard/skyline.md "skylineRev 11"; docs/design/game-reviews/action.md): skylineRev 10's
 * play, gold blocks, wind and scoring with two changes, so no run ends on the first miss:
 *
 *  - Lives: the run starts with SKYLINE_V11_LIVES. A block that misses the tower costs a life and falls away; the run
 *    carries on with the same tower, the same next block (the same kind and width, from the side the missed one came
 *    from) and the streak broken. The last life's miss ends the run as before. Floors are only ever added, so a lost
 *    life costs time and the streak, nothing else. A tap in the half second after a lost life is ignored
 *    (SKYLINE_V11_REARM_TICKS), so a double tap can't lose two lives at once.
 *  - The wide-block rescue: after SKYLINE_V11_TRIM_RUN placed drops in a row that are not perfect (trims), the next
 *    block is a wide one (rev 7's wide block: the top's width + SKYLINE_WIDE_GROW, up to the start width; centred it
 *    stays whole and widens the tower) when the schedule has a normal block there with a normal block after it; the
 *    trim count starts again. Fixed by the sim from the drops alone, the same for every player who drops the same.
 *
 * The state keeps `expandRev: 9` and `perfectCount: 1` (every rev-9/10 path reads it) and adds `lives`, `livesLost`,
 * `trimRun` and `rescues`, folded into the checkpoint checksum last. Every older revision plays and scores as before.
 */
export const SKYLINE_REV_LIVES = 11;
export const SKYLINE_V11_LIVES = 3;
export const SKYLINE_V11_TRIM_RUN = 5;
/** Ticks after a lost life in which a tap is ignored (half a second, while the missed block falls). */
export const SKYLINE_V11_REARM_TICKS = 30;
export const SKYLINE_STD_SPEC_V11: StdSpec = { ...SKYLINE_STD_SPEC_V10, rev: SKYLINE_REV_LIVES };

/** True on a skylineRev 11 state (lives and the rescue). */
export function skylineHasLives(state: SkylineState): boolean {
  return state.lives !== undefined;
}

function stepLives(state: SkylineState, tapped: boolean): SkylineState {
  if (isOver(state)) return state;
  // After a lost life the next block comes back in; a tap in the first SKYLINE_V11_REARM_TICKS is ignored, so a double tap
  // can't lose two lives at once.
  if (tapped && state.lostTick && state.tick + 1 - state.lostTick <= SKYLINE_V11_REARM_TICKS) tapped = false;
  if (!tapped) return stepExpand(state, false);
  const below = state.blocks[state.blocks.length - 1]!;
  const overlap = Math.min(state.x + state.w, below.x + below.w) - Math.max(state.x, below.x);
  const lives = state.lives ?? SKYLINE_V11_LIVES;
  if (overlap <= 0) {
    const tick = state.tick + 1;
    const lost = { lostTick: tick, lostX: state.x, lostW: state.w, livesLost: (state.livesLost ?? 0) + 1, lives: lives - 1, streak: 0, trimRun: 0 };
    if (lives <= 1) return { ...state, ...lost, tick, missed: true, endedTick: tick };
    // The same block again, from the side the missed one came in from.
    const from = state.dir >= 0 ? 1 : -1;
    const next: SkylineState = { ...state, ...lost, tick, x: from === 1 ? 0 : SKYLINE_WORLD_RIGHT - state.w, dir: from };
    return tick >= SKYLINE_RUN_TICKS ? { ...next, endedTick: tick } : next;
  }
  const next = stepExpand(state, true);
  const perfect = next.perfects > state.perfects;
  let trimRun = perfect ? 0 : (state.trimRun ?? 0) + 1;
  let out: SkylineState = { ...next, trimRun };
  const at = next.placed;
  if (
    trimRun >= SKYLINE_V11_TRIM_RUN &&
    skylineKindAt(next, at) === SKYLINE_KIND_NORMAL &&
    skylineKindAt(next, at + 1) === SKYLINE_KIND_NORMAL
  ) {
    const kinds = (next.kinds ?? []).slice();
    while (kinds.length <= at) kinds.push(SKYLINE_KIND_NORMAL);
    kinds[at] = SKYLINE_KIND_WIDE;
    const top = next.blocks[next.blocks.length - 1]!;
    const w = skylineKindWidth(SKYLINE_KIND_WIDE, top.w);
    trimRun = 0;
    out = { ...out, kinds, w, x: next.dir === 1 ? 0 : SKYLINE_WORLD_RIGHT - w, trimRun, rescues: (state.rescues ?? 0) + 1 };
  }
  return out;
}

function initLives(seed: number): SkylineState {
  return { ...skylineCountGame.init(seed), lives: SKYLINE_V11_LIVES, livesLost: 0, trimRun: 0, rescues: 0 };
}

export const skylineLivesGame: ArcadeGame<SkylineState> = {
  ...skylineCountGame,
  init: initLives,
  step: bandStep(stepLives),
};

/** Lives left to show (null on revisions without lives). */
export function skylineLivesLeft(state: SkylineState): number | null {
  return state.lives === undefined ? null : Math.max(0, state.lives);
}

/* ================= Levels (15 Nov 2026, the difficulty framework) ================= */

/**
 * High Rise's levels (docs/arcade-standard/skyline.md "Levels", docs/design/difficulty/README.md): skylineRev 11 with the
 * puzzle's `level` ("easy" | "hard" | "expert"; Normal has no field and is skylineRev 11 exactly: slide 768 → 1,536, a
 * 3 px perfect tolerance, wind from block 20, 3 lives). Each level changes only these four levers; the parts, gold
 * blocks, rescue and the 60 s run are skylineRev 11's. Lives stay at 2 or more at every level (a miss never ends the
 * run on its own while a life is left). Frozen here with the sim; gameLevels.ts carries the same figures for the phone
 * (skyline-levels-check).
 */
export type SkylineLevel = "easy" | "hard" | "expert";
export interface SkylineLevelRules {
  /** The slide: speed with no block placed, its rise per block placed, and its top (1/256 px a tick). */
  speedStart: number;
  speedStep: number;
  speedMax: number;
  /** A perfect drop's tolerance (1/256 px; 256 = 1 px). */
  tol: number;
  /** Gusts blow once this many blocks are placed. */
  windFrom: number;
  /** Lives at the start. */
  lives: number;
}

export const SKYLINE_LEVEL_RULES: Readonly<Record<SkylineLevel, SkylineLevelRules>> = {
  easy: { speedStart: 448, speedStep: 12, speedMax: 896, tol: 1_280, windFrom: 30, lives: 3 },
  hard: { speedStart: 896, speedStep: 30, speedMax: 1_792, tol: 768, windFrom: 15, lives: 3 },
  expert: { speedStart: 960, speedStep: 32, speedMax: 1_920, tol: 512, windFrom: 10, lives: 3 },
};

/** The level's code in a state (`lvl`). */
export const SKYLINE_LEVEL_CODE: Readonly<Record<SkylineLevel, number>> = { easy: 1, hard: 3, expert: 4 };

export function isSkylineLevel(level: unknown): level is SkylineLevel {
  return level === "easy" || level === "hard" || level === "expert";
}

/** A state's level (null at Normal and on every older round). */
export function skylineStateLevel(state: Pick<SkylineState, "lvl">): SkylineLevel | null {
  return state.lvl === 1 ? "easy" : state.lvl === 3 ? "hard" : state.lvl === 4 ? "expert" : null;
}

function levelRulesOf(state: Pick<SkylineState, "lvl">): SkylineLevelRules | null {
  const level = skylineStateLevel(state);
  return level ? SKYLINE_LEVEL_RULES[level] : null;
}

/** The slide speed on this state: its level's table, else skylineSpeed (every Normal and older round). */
export function skylineSpeedOf(state: Pick<SkylineState, "placed" | "lvl">): number {
  const r = levelRulesOf(state);
  return r ? Math.min(r.speedMax, r.speedStart + r.speedStep * state.placed) : skylineSpeed(state.placed);
}

/** A perfect drop's tolerance on this state (SKYLINE_PERFECT_TOL at Normal). */
export function skylineTolOf(state: Pick<SkylineState, "lvl">): number {
  return levelRulesOf(state)?.tol ?? SKYLINE_PERFECT_TOL;
}

/** The blocks placed before gusts blow on this state (SKYLINE_WIND_FROM at Normal). */
export function skylineWindFrom(state: Pick<SkylineState, "lvl">): number {
  return levelRulesOf(state)?.windFrom ?? SKYLINE_WIND_FROM;
}

/** The lives a run on this state started with (SKYLINE_V11_LIVES at Normal). */
export function skylineStartLives(state: Pick<SkylineState, "lvl">): number {
  return levelRulesOf(state)?.lives ?? SKYLINE_V11_LIVES;
}

const skylineLevelGames = new Map<SkylineLevel, ArcadeGame<SkylineState>>();
/** skylineRev 11 at a level: its init stamps `lvl` and the level's lives; step, score and end are skylineRev 11's. */
export function skylineLivesGameAt(level: SkylineLevel): ArcadeGame<SkylineState> {
  let game = skylineLevelGames.get(level);
  if (!game) {
    game = { ...skylineLivesGame, init: (seed: number) => ({ ...initLives(seed), lives: SKYLINE_LEVEL_RULES[level].lives, lvl: SKYLINE_LEVEL_CODE[level] }) };
    skylineLevelGames.set(level, game);
  }
  return game;
}
