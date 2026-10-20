/**
 * Ten Drop — a number round on the shared arcade engine.
 *
 * Tiles fall in four columns; tapping one applies it to a running total. Hit
 * the target exactly to clear it; going past it resets the total to 0. The
 * ten targets and each target's tile queue are drawn from the seed at init,
 * and every queue is proven reachable by a greedy solver before it is used.
 * A tap is kind 11, `a` = column, `b` = y px; the sim finds the tile itself.
 */

import { speedBonusCurve } from "../duel/speedPar";
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
import { bandCurve, bandMapTotal } from "./scoreBands";

/* ============================== Config ============================== */

export interface TenDropStage {
  lo: number;
  hi: number;
  /** Fall speed, 1/256 px per tick. */
  speed: number;
  /** Ticks between spawns. */
  gap: number;
  /** Tiles in one pass of the queue (it repeats until the target is met). */
  len: number;
  digitLo: number;
  digitHi: number;
  /** Operator shares, percent of tiles. */
  mul2: number;
  div2: number;
  div3: number;
  minus: number;
  minusLo: number;
  minusHi: number;
  /** One pass of digits alone must fall short of the target. */
  needOp: boolean;
}

/**
 * Digits are sparse (about half the tiles) and spread over 1–10 with no value
 * repeated back to back; every stage needs an operator, because one pass of
 * digits alone always falls short of the target.
 */
const EASY = { digitLo: 1, digitHi: 10, mul2: 30, div2: 0, div3: 0, minus: 20, minusLo: 1, minusHi: 3, needOp: true, len: 9 };
const MID = { digitLo: 1, digitHi: 10, mul2: 25, div2: 10, div3: 0, minus: 15, minusLo: 1, minusHi: 4, needOp: true, len: 12 };
const HARD = { digitLo: 1, digitHi: 10, mul2: 22, div2: 10, div3: 8, minus: 15, minusLo: 1, minusHi: 5, needOp: true, len: 14 };

export const TD_CONFIG = {
  runSeconds: 90,
  worldW: 360,
  worldH: 520,
  cols: 4,
  tileW: 76,
  tileH: 64,
  /** Extra px around a tile that still counts as a tap on it. */
  tapSlack: 8,
  /** A new tile never lands in the same column as the last two. */
  avoidRecentCols: 2,
  shakeTicks: 18,
  clearHoldTicks: 30,
  pointsPerTarget: 13,
  /** Up to this many points for clearing all ten, by sim time of the last clear. */
  clearBonus: 20,
  /** Rejection-sampling attempts per segment before the built-in fallback. */
  maxSegmentTries: 1000,
  stages: [
    { lo: 19, hi: 25, speed: 288, gap: 34, ...EASY },
    { lo: 19, hi: 25, speed: 312, gap: 34, ...EASY },
    { lo: 19, hi: 25, speed: 336, gap: 34, ...EASY },
    { lo: 26, hi: 45, speed: 360, gap: 31, ...MID },
    { lo: 26, hi: 45, speed: 384, gap: 31, ...MID },
    { lo: 26, hi: 45, speed: 408, gap: 31, ...MID },
    { lo: 46, hi: 80, speed: 432, gap: 28, ...HARD },
    { lo: 46, hi: 80, speed: 456, gap: 28, ...HARD },
    { lo: 80, hi: 140, speed: 480, gap: 25, ...HARD },
    { lo: 80, hi: 140, speed: 504, gap: 25, ...HARD },
  ] as readonly TenDropStage[],
} as const;

export const TD_TARGETS = TD_CONFIG.stages.length;
export const TD_RUN_TICKS = TD_CONFIG.runSeconds * TICKS_PER_SECOND;
export const TD_W = TD_CONFIG.worldW;
export const TD_H = TD_CONFIG.worldH;
export const TD_COL_W = TD_W / TD_CONFIG.cols;

export const TD_INPUT_TAP = 11;
export const TD_INPUT_RANGES: readonly InputRange[] = [
  inputRange(TD_INPUT_TAP, [0, TD_CONFIG.cols - 1], [0, TD_H]),
];

export const TD_DIGIT = 0;
export const TD_MUL2 = 1;
export const TD_DIV2 = 2;
export const TD_DIV3 = 3;
export const TD_MINUS = 4;

/** Log codes. */
export const TD_LOG_APPLIED = 1;
export const TD_LOG_REFUSED = 2;
export const TD_LOG_RESET = 3;
export const TD_LOG_CLEAR = 4;
export const TD_LOG_EMPTY = 5;
const LOG_KEEP = 16;

/* =============================== Tiles =============================== */

/** A queued tile packed as kind·16 + value. */
export function tdKind(tile: number): number {
  return tile >> 4;
}
export function tdValue(tile: number): number {
  return tile & 15;
}
function pack(kind: number, value: number): number {
  return (kind << 4) | value;
}

export function tdLabel(tile: number): string {
  const k = tdKind(tile);
  if (k === TD_DIGIT) return String(tdValue(tile));
  if (k === TD_MUL2) return "×2";
  if (k === TD_DIV2) return "÷2";
  if (k === TD_DIV3) return "÷3";
  return `−${tdValue(tile)}`;
}

/** The new total, or null when the tile is refused (÷ not exact, − below 0). */
export function tdApply(tile: number, total: number): number | null {
  const k = tdKind(tile);
  const v = tdValue(tile);
  if (k === TD_DIGIT) return total + v;
  if (k === TD_MUL2) return total * 2;
  if (k === TD_DIV2) return total % 2 === 0 ? total / 2 : null;
  if (k === TD_DIV3) return total % 3 === 0 ? total / 3 : null;
  return total - v >= 0 ? total - v : null;
}

/**
 * The proof solver: walk one pass of the queue in order, taking a digit when it
 * does not overshoot and a ×2 when it does not overshoot. Returns the index of
 * the tile that hits the target exactly, or -1.
 */
export function tdGreedy(target: number, queue: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < queue.length; i++) {
    const tile = queue[i]!;
    const k = tdKind(tile);
    if (k !== TD_DIGIT && !(k === TD_MUL2 && total > 0)) continue;
    const r = tdApply(tile, total);
    if (r === null || r > target) continue;
    total = r;
    if (total === target) return i;
  }
  return -1;
}

export function tdDigitSum(queue: readonly number[]): number {
  let sum = 0;
  for (const tile of queue) if (tdKind(tile) === TD_DIGIT) sum += tdValue(tile);
  return sum;
}

/** Does this queue satisfy the stage's rules for this target? */
export function tdSegmentOk(stage: TenDropStage, target: number, queue: readonly number[]): boolean {
  if (tdGreedy(target, queue) < 0) return false;
  if (stage.mul2 > 0 && !queue.some((t) => tdKind(t) === TD_MUL2)) return false;
  if (stage.needOp && tdDigitSum(queue) >= target) return false;
  return true;
}

/** A guaranteed queue: digits to half the target, ×2, then the odd 1. */
function fallbackSegment(stage: TenDropStage, target: number): number[] {
  const out: number[] = [];
  if (stage.mul2 === 0) {
    let left = target;
    while (left > 0) {
      const d = Math.min(stage.digitHi, left);
      out.push(pack(TD_DIGIT, d));
      left -= d;
    }
    return out;
  }
  let half = target >> 1;
  while (half > 0) {
    const d = Math.min(stage.digitHi, half);
    out.push(pack(TD_DIGIT, d));
    half -= d;
  }
  out.push(pack(TD_MUL2, 0));
  if (target % 2 === 1) out.push(pack(TD_DIGIT, 1));
  return out;
}

export interface TenDropPlan {
  targets: number[];
  queues: number[][];
  /** Tile index the proof solver hit each target on (diagnostic). */
  proof: number[];
  /** Re-seeds each segment needed. */
  tries: number[];
}

function buildPlan(seed: number): { rng: number; plan: TenDropPlan } {
  let rng = seed | 0;
  const draw = (bound: number): number => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const targets: number[] = [];
  const queues: number[][] = [];
  const proof: number[] = [];
  const tries: number[] = [];
  for (const stage of TD_CONFIG.stages) {
    let target = 0;
    let queue: number[] = [];
    let attempt = 0;
    for (; attempt < TD_CONFIG.maxSegmentTries; attempt++) {
      target = stage.lo + draw(stage.hi - stage.lo + 1);
      queue = [];
      let lastDigit = -1;
      for (let i = 0; i < stage.len; i++) {
        const roll = draw(100);
        let tile: number;
        if (roll < stage.mul2) tile = pack(TD_MUL2, 0);
        else if (roll < stage.mul2 + stage.div2) tile = pack(TD_DIV2, 0);
        else if (roll < stage.mul2 + stage.div2 + stage.div3) tile = pack(TD_DIV3, 0);
        else if (roll < stage.mul2 + stage.div2 + stage.div3 + stage.minus)
          tile = pack(TD_MINUS, stage.minusLo + draw(stage.minusHi - stage.minusLo + 1));
        else {
          // Spread digits: never the same value twice in a row.
          let v = stage.digitLo + draw(stage.digitHi - stage.digitLo + (lastDigit < 0 ? 1 : 0));
          if (lastDigit >= 0 && v >= lastDigit) v++;
          lastDigit = v;
          tile = pack(TD_DIGIT, v);
        }
        queue.push(tile);
      }
      if (tdSegmentOk(stage, target, queue)) break;
    }
    if (attempt >= TD_CONFIG.maxSegmentTries) queue = fallbackSegment(stage, target);
    targets.push(target);
    queues.push(queue);
    proof.push(tdGreedy(target, queue));
    tries.push(attempt + 1);
  }
  return { rng, plan: { targets, queues, proof, tries } };
}

/* ================================ State ================================ */

export interface TenDropTile {
  id: number;
  col: number;
  /** Top edge, 1/256 px. */
  y: number;
  tile: number;
  shakeUntil: number;
}

export interface TenDropState {
  tick: number;
  rng: number;
  plan: TenDropPlan;
  stage: number;
  total: number;
  /** Position in the current target's queue (keeps counting past one pass). */
  queueIndex: number;
  spawnIn: number;
  nextId: number;
  recentCols: number[];
  tiles: TenDropTile[];
  cleared: number;
  resets: number;
  refused: number;
  taps: number;
  resetTick: number;
  clearTick: number;
  /** Recent events, packed tick·64 + code·8 + extra (0–7). */
  log: number[];
  /**
   * Score revision (TEN_DROP_SCORE_REV; absent on stored runs): 1 = the Oct 2026
   * puzzle shape. Scoring only: play, checkpoints and the replay are unchanged.
   */
  scoreRev?: number;
}

function init(seed: number): TenDropState {
  const built = buildPlan(seed);
  return {
    tick: 0,
    rng: built.rng,
    plan: built.plan,
    stage: 0,
    total: 0,
    queueIndex: 0,
    spawnIn: 0,
    nextId: 0,
    recentCols: [],
    tiles: [],
    cleared: 0,
    resets: 0,
    refused: 0,
    taps: 0,
    resetTick: -100,
    clearTick: -100,
    log: [],
  };
}

function isOver(state: TenDropState): boolean {
  return state.tick >= TD_RUN_TICKS ||
    (state.cleared >= TD_TARGETS && state.tick - state.clearTick >= TD_CONFIG.clearHoldTicks);
}

/** Completion holds are gameplay time, not a paused client clock. */
export function tenDropHolding(state: TenDropState): boolean {
  return state.cleared > state.stage && state.tick - state.clearTick <= TD_CONFIG.clearHoldTicks;
}

function pushLog(log: number[], tick: number, code: number, extra: number): number[] {
  const out = [...log, tick * 64 + code * 8 + clampInt(extra, 0, 7)];
  return out.length > LOG_KEEP ? out.slice(out.length - LOG_KEEP) : out;
}

export function unpackTdLog(entry: number): { tick: number; code: number; extra: number } {
  return { tick: Math.floor(entry / 64), code: Math.floor(entry / 8) % 8, extra: entry % 8 };
}

function step(state: TenDropState, input: ArcadeInputEvent | null): TenDropState {
  if (isOver(state)) return state;
  const c = TD_CONFIG;
  const tick = state.tick + 1;
  if (state.cleared > state.stage) {
    // Log collection happens outside the sim; no gameplay input is applied here.
    if (tick - state.clearTick <= c.clearHoldTicks) return { ...state, tick };
    state = { ...state, stage: state.stage + 1, total: 0, queueIndex: 0,
      tiles: [], recentCols: [], spawnIn: 1 };
  }
  const stage = c.stages[state.stage];
  if (!stage) return { ...state, tick };
  const next: TenDropState = { ...state, tick };

  // Fall, then drop anything past the bottom (no penalty).
  let tiles = state.tiles
    .map((t) => ({ ...t, y: t.y + stage.speed }))
    .filter((t) => t.y < c.worldH * 256);

  // Spawn.
  let spawnIn = state.spawnIn - 1;
  if (spawnIn <= 0) {
    const queue = state.plan.queues[state.stage]!;
    const tile = queue[state.queueIndex % queue.length]!;
    const free: number[] = [];
    for (let col = 0; col < c.cols; col++) if (!state.recentCols.includes(col)) free.push(col);
    const pick = rngBelow(state.rng, free.length);
    next.rng = pick.state;
    const col = free[pick.value]!;
    tiles = [...tiles, { id: state.nextId, col, y: -c.tileH * 256, tile, shakeUntil: 0 }];
    next.nextId = state.nextId + 1;
    next.queueIndex = state.queueIndex + 1;
    next.recentCols = [...state.recentCols, col].slice(-c.avoidRecentCols);
    spawnIn = stage.gap;
  }
  next.spawnIn = spawnIn;
  next.tiles = tiles;

  if (input && input.k === TD_INPUT_TAP) {
    next.taps += 1;
    const col = clampInt(input.a, 0, c.cols - 1);
    const ty = clampInt(input.b, 0, c.worldH) * 256;
    const slack = c.tapSlack * 256;
    let hit = -1;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]!;
      if (t.col !== col) continue;
      if (ty < t.y - slack || ty > t.y + c.tileH * 256 + slack) continue;
      if (hit < 0 || t.y > tiles[hit]!.y) hit = i;
    }
    if (hit < 0) {
      next.log = pushLog(next.log, tick, TD_LOG_EMPTY, col);
    } else {
      const t = tiles[hit]!;
      const result = tdApply(t.tile, state.total);
      if (result === null) {
        next.refused += 1;
        next.tiles = tiles.map((x, i) => (i === hit ? { ...x, shakeUntil: tick + c.shakeTicks } : x));
        next.log = pushLog(next.log, tick, TD_LOG_REFUSED, col);
      } else {
        next.tiles = tiles.filter((_, i) => i !== hit);
        const target = state.plan.targets[state.stage]!;
        if (result > target) {
          next.total = 0;
          next.resets += 1;
          next.resetTick = tick;
          next.log = pushLog(next.log, tick, TD_LOG_RESET, col);
        } else if (result === target) {
          next.cleared += 1;
          next.clearTick = tick;
          next.total = result;
          next.log = pushLog(next.log, tick, TD_LOG_CLEAR, col);
        } else {
          next.total = result;
          next.log = pushLog(next.log, tick, TD_LOG_APPLIED, col);
        }
      }
    }
  }
  return next;
}

/** Tenfall's puzzle-shape score revision (stamped as `tenRev` on new puzzles). */
export const TEN_DROP_SCORE_REV = 1;
/** Rev 1: overshoots (resets) that cost nothing on an unfinished run. */
export const TD_REV1_FREE_RESETS = 5;

/** The run's starting state under a score revision (0 / absent = the original 13 per target). */
export function tenDropInit(seed: number, scoreRev?: number): TenDropState {
  const state = init(seed);
  return scoreRev && scoreRev >= TEN_DROP_SCORE_REV ? { ...state, scoreRev } : state;
}

/**
 * Original: 13 per target; all ten adds speedBonusCurve(20, run ticks − clear tick, run ticks). Cap 150.
 * Rev 1: all ten = 120 + speedBonusCurve(30, …) (the full 30 when the last clears by 45 s);
 * otherwise floor(110 × targets ÷ 9) − 2 per reset beyond 5, so nine is 110.
 */
export function tenDropScore(cleared: number, clearTick = TD_RUN_TICKS, scoreRev = 0, resets = 0): number {
  const n = clampInt(cleared, 0, TD_TARGETS);
  if (scoreRev >= TEN_DROP_SCORE_REV) {
    if (n >= TD_TARGETS) {
      const left = clampInt(TD_RUN_TICKS - clearTick, 0, TD_RUN_TICKS);
      return clampInt(120 + speedBonusCurve(30, left, TD_RUN_TICKS), 0, 150);
    }
    // Overshoots beyond the first TD_REV1_FREE_RESETS cost 2 each, so mashing tiles earns about nothing
    // (tenRev 3: beyond TD_REV3_FREE_RESETS, TD_REV3_RESET_COST each).
    const cost = scoreRev >= TEN_DROP_RAW_REV
      ? TD_REV3_RESET_COST * Math.max(0, resets - TD_REV3_FREE_RESETS)
      : 2 * Math.max(0, resets - TD_REV1_FREE_RESETS);
    return clampInt(Math.floor((110 * n) / (TD_TARGETS - 1)) - cost, 0, 110);
  }
  let total = n * TD_CONFIG.pointsPerTarget;
  if (n >= TD_TARGETS) {
    const left = clampInt(TD_RUN_TICKS - clearTick, 0, TD_RUN_TICKS);
    total += speedBonusCurve(TD_CONFIG.clearBonus, left, TD_RUN_TICKS);
  }
  return clampInt(total, 0, 150);
}

function score(state: TenDropState): number {
  const raw = tenDropScore(state.cleared, state.clearTick, state.scoreRev ?? 0, state.resets);
  return state.scoreRev === TEN_DROP_BANDS_REV ? bandMapTotal(TEN_DROP_BANDS_MAP, raw) : raw;
}

/**
 * tenRev 2 (score bands, 19 Oct 2026, docs/scoring-targets.md): tenRev 1 play and scoring, then the total mapped
 * so the simulated average / good / great / near-perfect players' 97 / 128 / 135 / 137 land about 70 / 100 / 120 /
 * 140; 0 stays 0 and only a clear with the full speed part (150) is 150.
 */
export const TEN_DROP_BANDS_REV = 2;
export const TEN_DROP_BANDS_MAP = bandCurve([0, 97, 128, 135, 137, 150], [0, 70, 100, 120, 140, 150]);

/**
 * tenRev 3 (scoring report batch 2, 20 Oct 2026, docs/scoring-targets.md): tenRev 1 play and its raw score, with
 * no map (tenRev 2's map squashed a clear of all ten to about 93 and jumped 20 points between raw 135 and 137):
 * all ten = 120 + speedBonusCurve(30, …), unfinished floor(110 × targets ÷ 9), so nine is 110. Overshoots beyond
 * the first TD_REV3_FREE_RESETS cost TD_REV3_RESET_COST each (was 2 beyond 5), so random tapping (6–23 resets)
 * stays near 0 while the simulated players (0–6) lose little.
 */
export const TEN_DROP_RAW_REV = 3;
export const TD_REV3_FREE_RESETS = 4;
export const TD_REV3_RESET_COST = 5;

/* ============================= Checkpoints ============================= */

export const TD_CHECKPOINT_INTERVAL = 300;

export interface TenDropCheckpointState {
  tick: number;
  stage: number;
  total: number;
  cleared: number;
  resets: number;
  taps: number;
  queueIndex: number;
  tilesHash: number;
}

export interface TenDropCheckpoint extends TenDropCheckpointState {
  checksum: number;
}

export const TD_CHECKPOINT_FIELDS = [
  "tick",
  "stage",
  "total",
  "cleared",
  "resets",
  "taps",
  "queueIndex",
  "tilesHash",
] as const;

export function tenDropCheckpoint(state: TenDropState): TenDropCheckpoint {
  let tilesHash = 0;
  for (const t of state.tiles) {
    tilesHash = (Math.imul(tilesHash, 31) + t.id * 7 + t.col + Math.imul(t.y, 3) + t.tile) | 0;
  }
  const snapshot: TenDropCheckpointState = {
    tick: state.tick,
    stage: state.stage,
    total: state.total,
    cleared: state.cleared,
    resets: state.resets,
    taps: state.taps,
    queueIndex: state.queueIndex,
    tilesHash,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const TD_GOLD = "#F5B82E";

export function tdView(size: CanvasSize): { scaleX: number; scaleY: number } {
  return { scaleX: size.width / TD_W, scaleY: size.height / TD_H };
}

function draw(ctx: CanvasRenderingContext2D, state: TenDropState, size: CanvasSize): void {
  const c = TD_CONFIG;
  const { scaleX, scaleY } = tdView(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);
  ctx.beginPath();
  ctx.rect(0, 0, TD_W, TD_H);
  ctx.clip();
  ctx.fillStyle = "#101016";
  ctx.fillRect(0, 0, TD_W, TD_H);
  ctx.strokeStyle = "rgba(255,255,255,0.23)";
  ctx.lineWidth = 1;
  for (let col = 1; col < c.cols; col++) {
    ctx.beginPath();
    ctx.moveTo(col * TD_COL_W, 0);
    ctx.lineTo(col * TD_COL_W, TD_H);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 28px 'JetBrains Mono', ui-monospace, monospace";
  for (const t of state.tiles) {
    const shaking = state.tick < t.shakeUntil;
    const shake = shaking ? ((state.tick % 4) - 1.5) * 3 : 0;
    const x = t.col * TD_COL_W + (TD_COL_W - c.tileW) / 2 + shake;
    const y = t.y / 256;
    const op = tdKind(t.tile) !== TD_DIGIT;
    ctx.font = `700 ${op ? 36 : 28}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.fillStyle = shaking ? "#4A1E1E" : op ? "#2A2414" : "#22222C";
    ctx.beginPath();
    ctx.roundRect(x, y, c.tileW, c.tileH, 12);
    ctx.fill();
    ctx.strokeStyle = shaking ? "#E0503C" : op ? TD_GOLD : "rgba(255,255,255,0.18)";
    ctx.lineWidth = op ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = op ? TD_GOLD : "#F2F2F2";
    ctx.fillText(tdLabel(t.tile), x + c.tileW / 2, y + c.tileH / 2 + 1);
  }
  ctx.restore();
}

export const tenDropGame: ArcadeGame<TenDropState, ArcadeInputEvent | null> = {
  key: "tendrop",
  runTicks: TD_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: TD_INPUT_RANGES,
};
