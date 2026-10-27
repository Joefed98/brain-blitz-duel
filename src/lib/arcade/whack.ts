/**
 * Whack-a-Target — an attention round built on the shared arcade engine.
 *
 * The whole run is a seeded schedule built at init: irregular rule flips
 * (3–5, periods ≥ 6 s, none in the last 5 s) and pops into the 4×4 holes with
 * a shrinking up-window (900 ms → 450 ms), at most three up at once and never
 * the same hole twice in a row. 10% of pops after 5 s are bombs. Taps only
 * shorten a pop, so the schedule is identical for every player and the replay.
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
import { bandCurve, bandMapTotal, bandPoints } from "./scoreBands";

/* ============================== Constants ============================== */

export const WHACK_RUN_SECONDS = 60;
export const WHACK_RUN_TICKS = WHACK_RUN_SECONDS * TICKS_PER_SECOND;

/** A hole tap: kind 11, `a` = hole 0…15. */
export const WHACK_INPUT_TAP = 11;

export const WHACK_COLS = 4;
export const WHACK_HOLES = WHACK_COLS * WHACK_COLS;
/** Gap between holes in CSS pixels — the overlay grid uses the same value. */
export const WHACK_GAP_PX = 8;

export const WHACK_GOLD = 0;
export const WHACK_RED = 1;
export const WHACK_BOMB = 2;

/** Up-window: 54 ticks (900 ms) at the start shrinking to 36 (600 ms) at the end. */
export const WHACK_LIFE_START_TICKS = 54;
export const WHACK_LIFE_END_TICKS = 36;
/** Gap between pops: 42 ticks at the start ramping to 13 at the end, plus 0…5 jitter,
 *  so the final third regularly has two or three balls up together (cap 3). */
const POP_GAP_START = 42;
const POP_GAP_END = 13;
const POP_GAP_JITTER = 6;
const FIRST_POP_TICK = 30;
export const WHACK_MAX_UP = 3;
export const WHACK_BOMB_PERCENT = 10;
export const WHACK_NO_BOMB_TICKS = 5 * TICKS_PER_SECOND;
/** Flip schedule bounds. */
export const WHACK_MIN_FLIPS = 3;
export const WHACK_MAX_FLIPS = 5;
export const WHACK_MIN_PERIOD_TICKS = 6 * TICKS_PER_SECOND;
export const WHACK_NO_FLIP_TAIL_TICKS = 5 * TICKS_PER_SECOND;
/** No target of the current colour pops in the final second. */
export const WHACK_NO_TARGET_TAIL_TICKS = TICKS_PER_SECOND;
export const WHACK_HIT_POINTS = 135;
export const WHACK_WRONG_PENALTY = 3;
export const WHACK_BOMB_PENALTY = 5;
/** A tap on an empty hole. */
export const WHACK_EMPTY_PENALTY = 3;
export const WHACK_PERFECT_BONUS = 15;
const POP_IN_TICKS = 7;
const FALL_TICKS = 10;

export const WHACK_STATUS_UP = 0;
export const WHACK_STATUS_HIT = 1;
export const WHACK_STATUS_WRONG = 2;
export const WHACK_STATUS_WAITING = 3;
export const WHACK_STATUS_RETIRED = 4;

export const WHACK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(WHACK_INPUT_TAP, [0, WHACK_HOLES - 1]),
];

/** Up-window for a pop starting on `tick`. */
export function whackLife(tick: number): number {
  const t = clampInt(tick, 0, WHACK_RUN_TICKS);
  return WHACK_LIFE_START_TICKS - Math.floor(((WHACK_LIFE_START_TICKS - WHACK_LIFE_END_TICKS) * t) / WHACK_RUN_TICKS);
}

/** Which colour to tap on a tick, given the seeded flip ticks (starts on gold). */
export function whackRule(flips: readonly number[], tick: number): number {
  let rule = WHACK_GOLD;
  for (const flip of flips) if (tick >= flip) rule ^= 1;
  return rule;
}

/* =============================== Schedule =============================== */

export interface WhackSchedule {
  flips: number[];
  /** Pop tick, hole, kind (gold/red/bomb) and up-window per pop. */
  at: number[];
  hole: number[];
  kind: number[];
  life: number[];
  /** Pops that are the correct colour when they appear. */
  total: number;
}

function buildSchedule(seed: number): { rng: number; schedule: WhackSchedule } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const flipCount = WHACK_MIN_FLIPS + draw(WHACK_MAX_FLIPS - WHACK_MIN_FLIPS + 1);
  const lastFlip = WHACK_RUN_TICKS - WHACK_NO_FLIP_TAIL_TICKS;
  const slack = lastFlip - WHACK_MIN_PERIOD_TICKS * flipCount;
  const offsets: number[] = [];
  for (let i = 0; i < flipCount; i++) offsets.push(draw(slack + 1));
  offsets.sort((a, b) => a - b);
  const flips = offsets.map((off, i) => WHACK_MIN_PERIOD_TICKS * (i + 1) + off);

  const at: number[] = [];
  const hole: number[] = [];
  const kind: number[] = [];
  const life: number[] = [];
  let total = 0;
  let tick = FIRST_POP_TICK;
  let prevHole = -1;
  while (tick < WHACK_RUN_TICKS) {
    const l = whackLife(tick);
    // A pop must not straddle a flip, so its role never changes while up.
    const crossing = flips.find((f) => tick < f && tick + l > f);
    if (crossing !== undefined) { tick = crossing; continue; }
    const busy = new Set<number>();
    for (let i = 0; i < at.length; i++) if (at[i]! + life[i]! > tick) busy.add(hole[i]!);
    if (busy.size >= WHACK_MAX_UP) { tick += 1; continue; }
    const free: number[] = [];
    for (let h = 0; h < WHACK_HOLES; h++) if (!busy.has(h) && h !== prevHole) free.push(h);
    const h = free[draw(free.length)]!;
    const rule = whackRule(flips, tick);
    let k: number;
    if (tick >= WHACK_NO_BOMB_TICKS && draw(100) < WHACK_BOMB_PERCENT) k = WHACK_BOMB;
    else k = draw(100) < 65 ? rule : rule ^ 1;
    if (k === rule && tick >= WHACK_RUN_TICKS - WHACK_NO_TARGET_TAIL_TICKS) k = rule ^ 1;
    if (k === rule) total += 1;
    at.push(tick); hole.push(h); kind.push(k); life.push(l);
    prevHole = h;
    const progress = Math.floor(((POP_GAP_START - POP_GAP_END) * tick) / WHACK_RUN_TICKS);
    tick += POP_GAP_START - progress + draw(POP_GAP_JITTER);
  }
  return { rng, schedule: { flips, at, hole, kind, life, total } };
}

/* ================================ State ================================ */

export interface WhackState {
  /** whackRev 1 only (scoring targets): 1 = the score is lifted through WHACK_TARGET_LIFT. Absent on older rounds. */
  tgt?: number;
  /** whackRev 2 only (score bands): 1 = the raw score mapped through WHACK_BANDS_MAP. Absent on older rounds. */
  sb?: number;
  /** whackRev 3 only (depth to 200): the gold combo and the diamonds (WhackDepth). Absent on older rounds. */
  dp?: WhackDepth;
  tick: number;
  rng: number;
  schedule: WhackSchedule;
  status: number[];
  /** Tick each pop was resolved (0 while unresolved). */
  doneTick: number[];
  hits: number;
  /** Taps on the wrong-colour ball. */
  wrong: number;
  /** Taps on bombs. */
  bombs: number;
  /** Taps that hit no ball. */
  empty: number;
  taps: number;
  /** Pops released so far. */
  next: number;
}

function init(seed: number): WhackState {
  const built = buildSchedule(seed);
  const n = built.schedule.at.length;
  return {
    tick: 0,
    rng: built.rng,
    schedule: built.schedule,
    status: new Array(n).fill(WHACK_STATUS_WAITING),
    doneTick: new Array(n).fill(0),
    hits: 0,
    wrong: 0,
    bombs: 0,
    empty: 0,
    taps: 0,
    next: 0,
  };
}

function isOver(state: WhackState): boolean {
  return state.tick >= WHACK_RUN_TICKS;
}

/** The pop standing in a hole, or -1. */
export function whackPopAt(state: WhackState, hole: number): number {
  for (let i = 0; i < state.next; i++) {
    if (state.status[i] === WHACK_STATUS_UP && state.schedule.hole[i] === hole) return i;
  }
  return -1;
}

function step(state: WhackState, input: ArcadeInputEvent | null): WhackState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s = state.schedule;
  const status = [...state.status];
  const doneTick = [...state.doneTick];
  let { hits, wrong, bombs, empty, taps, next } = state;
  // Retire expired pops, then release pops due this tick.
  for (let i = 0; i < next; i++) {
    if (status[i] === WHACK_STATUS_UP && tick >= s.at[i]! + s.life[i]!) {
      status[i] = WHACK_STATUS_RETIRED;
      doneTick[i] = tick;
    }
  }
  while (next < s.at.length && s.at[next]! <= tick) {
    status[next] = WHACK_STATUS_UP;
    next += 1;
  }
  // whackRev 3: diamonds rise and sink on their own schedule, in holes no pop uses meanwhile.
  const dp = state.dp ? stepDiamonds(state.dp, tick) : undefined;
  if (input && input.k === WHACK_INPUT_TAP) {
    const h = clampInt(input.a, 0, WHACK_HOLES - 1);
    taps += 1;
    let struck = false;
    let outcome = 0;
    let risenAt = tick;
    for (let i = 0; i < next; i++) {
      if (status[i] !== WHACK_STATUS_UP || s.hole[i] !== h) continue;
      if (s.kind[i] === whackRule(s.flips, s.at[i]!)) { status[i] = WHACK_STATUS_HIT; hits += 1; outcome = 1; risenAt = s.at[i]!; }
      else if (s.kind[i] === WHACK_BOMB) { status[i] = WHACK_STATUS_WRONG; bombs += 1; outcome = -1; }
      else { status[i] = WHACK_STATUS_WRONG; wrong += 1; outcome = -1; }
      doneTick[i] = tick;
      struck = true;
      break;
    }
    if (dp && !struck) {
      const d = diamondUpAt(dp, h);
      if (d >= 0) {
        dp.status[d] = WHACK_STATUS_HIT;
        dp.done[d] = tick;
        dp.hits += 1;
        struck = true;
      }
    }
    if (!struck) { empty += 1; outcome = -1; }
    if (dp) {
      // The gold combo: each right hit adds to the run; a wrong colour, a hedgehog or an empty hole ends it.
      if (outcome > 0) {
        dp.combo += 1;
        // Each hit's pips are weighted by how quickly it landed after the target rose (whackComboQuick).
        dp.pips += (whackComboMultiplier(dp.combo) - 1) * whackComboQuick(tick - risenAt);
        if (dp.combo > dp.best) dp.best = dp.combo;
      } else if (outcome < 0) dp.combo = 0;
    }
  }
  return { ...state, tick, status, doneTick, hits, wrong, bombs, empty, taps, next, ...(dp ? { dp } : {}) };
}

/** round(135 × hits ÷ total) − 3 per wrong-colour tap − 5 per bomb − 3 per empty tap; +15 if every target hit; clamp 0…150. */
export function whackScore(hits: number, wrong: number, total: number, empty = 0, bombs = 0): number {
  if (total <= 0) return 0;
  const base = Math.floor((2 * WHACK_HIT_POINTS * hits + total) / (2 * total));
  const bonus = hits >= total ? WHACK_PERFECT_BONUS : 0;
  return clampInt(base - wrong * WHACK_WRONG_PENALTY - bombs * WHACK_BOMB_PENALTY - empty * WHACK_EMPTY_PENALTY + bonus, 0, 150);
}

function score(state: WhackState): number {
  const raw = whackScore(state.hits, state.wrong, state.schedule.total, state.empty, state.bombs);
  if (state.dp) return whackDepthScore(state).score;
  if (state.sb) return bandMapTotal(WHACK_BANDS_MAP, raw);
  return state.tgt ? whackLift(raw) : raw;
}

/**
 * whackRev 1 (scoring targets, 18 Oct 2026, docs/scoring-targets.md): the same
 * play and the same hit share and costs, then the result lifted so the simulated
 * players' 62 / 102 / 118 / 133 (average / good / great / near-perfect) land
 * about 100 / 120 / 135 / 145; 0 stays 0 and 150 stays 150.
 */
export const WHACK_REV_TARGET = 1;
export const WHACK_TARGET_LIFT = bandCurve([0, 62, 102, 118, 133, 150], [0, 100, 120, 135, 145, 150]);
export function whackLift(raw: number): number {
  return clampInt(bandPoints(WHACK_TARGET_LIFT, raw), 0, 150);
}

/* ============================= Checkpoints ============================= */

export const WHACK_CHECKPOINT_INTERVAL = 300;

export interface WhackCheckpointState {
  tick: number;
  hits: number;
  wrong: number;
  bombs: number;
  empty: number;
  taps: number;
  next: number;
  statusHash: number;
}

export interface WhackCheckpoint extends WhackCheckpointState {
  checksum: number;
}

export function whackCheckpointState(state: WhackState): WhackCheckpointState {
  let statusHash = 0;
  for (let i = 0; i < state.status.length; i++) {
    statusHash = (Math.imul(statusHash, 31) + state.status[i]! * 7 + state.doneTick[i]!) | 0;
  }
  return {
    tick: state.tick,
    hits: state.hits,
    wrong: state.wrong,
    bombs: state.bombs,
    empty: state.empty,
    taps: state.taps,
    next: state.next,
    statusHash,
  };
}

export function whackCheckpoint(state: WhackState): WhackCheckpoint {
  const snapshot = whackCheckpointState(state);
  let checksum = 0x811c9dc5;
  // whackRev 3: the combo and the diamonds, last (they are in no encoded field).
  for (const value of [...Object.values(snapshot), ...(state.dp ? whackDepthChecksumValues(state.dp) : [])]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const WHACK_BG = "#0B0B0F";
export const WHACK_HOLE = "#1B1B24";
export const WHACK_GOLD_HEX = "#F5B82E";
export const WHACK_RED_HEX = "#E0503C";
const WHACK_BOMB_HEX = "#2A2A33";

function drawDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  kind: number,
): void {
  ctx.fillStyle = kind === WHACK_GOLD ? WHACK_GOLD_HEX : kind === WHACK_RED ? WHACK_RED_HEX : WHACK_BOMB_HEX;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === WHACK_BOMB) {
    ctx.strokeStyle = "#F2F2F2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.5, cy - r * 0.7);
    ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.2, cx + r * 1.1, cy - r * 0.9);
    ctx.stroke();
    ctx.fillStyle = WHACK_RED_HEX;
    ctx.font = `bold ${Math.round(r)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✕", cx, cy);
    return;
  }
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws the 4×4 board filling the canvas; the overlay grid shares the geometry. */
function draw(ctx: CanvasRenderingContext2D, state: WhackState, size: CanvasSize): void {
  const gap = WHACK_GAP_PX;
  const cellW = (size.width - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cellH = (size.height - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cell = Math.min(cellW, cellH);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  const origin = (h: number) => ({
    x: (h % WHACK_COLS) * (cellW + gap),
    y: Math.floor(h / WHACK_COLS) * (cellH + gap),
  });

  const flashWrong = new Set<number>();
  for (let i = 0; i < state.status.length; i++) {
    if (state.status[i] === WHACK_STATUS_WRONG && state.tick - state.doneTick[i]! < 12) {
      flashWrong.add(state.schedule.hole[i]!);
    }
  }

  for (let h = 0; h < WHACK_HOLES; h++) {
    const { x, y } = origin(h);
    ctx.fillStyle = flashWrong.has(h) ? "rgba(224,80,60,0.45)" : WHACK_HOLE;
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.fill();
  }

  const { kind, hole, at: spawn } = state.schedule;
  const tick = state.tick;
  const r = cell * 0.3;
  for (let i = 0; i < state.next; i++) {
    if (spawn[i]! > tick) continue;
    if (state.status[i] === WHACK_STATUS_RETIRED && tick - state.doneTick[i]! >= FALL_TICKS) continue;
    const { x, y } = origin(hole[i]!);
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.clip();
    if (state.status[i] === WHACK_STATUS_UP) {
      const grow = Math.min(1, (tick - spawn[i]! + 1) / POP_IN_TICKS);
      drawDisc(ctx, cx, cy + (1 - grow) * cellH * 0.35, r * (0.4 + 0.6 * grow), kind[i]!);
    } else if (state.status[i] === WHACK_STATUS_RETIRED) {
      const fall = (tick - state.doneTick[i]!) / FALL_TICKS;
      ctx.globalAlpha = 1 - fall;
      drawDisc(ctx, cx, cy + fall * cellH * 0.5, r * (1 - 0.3 * fall), kind[i]!);
    } else if (state.status[i] === WHACK_STATUS_HIT) {
      const age = tick - state.doneTick[i]!;
      if (age < 10) {
        ctx.globalAlpha = 1 - age / 10;
        ctx.strokeStyle = WHACK_GOLD_HEX;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + age * 0.08), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export const whackGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = {
  key: "whack",
  runTicks: WHACK_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: WHACK_INPUT_RANGES,
};

/** whackRev 1: the same game, its score lifted (WHACK_TARGET_LIFT). */
export const whackTargetGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = { ...whackGame, init: (seed) => ({ ...init(seed), tgt: 1 }) };

/** The game for a stored whackRev (absent = the original score). */
export function whackGameFor(rev?: number | null): ArcadeGame<WhackState, ArcadeInputEvent | null> {
  if (rev === WHACK_REV_NOTES) return whackNotesGame;
  if (rev === WHACK_REV_DEPTH) return whackDepthGame;
  if (rev === WHACK_REV_BANDS) return whackBandsGame;
  return rev === WHACK_REV_TARGET ? whackTargetGame : whackGame;
}

/* ================= Score bands (whackRev 2, 19 Oct 2026) ================= */

/**
 * whackRev 2 (score bands, docs/scoring-targets.md): the same play, hit share and costs as before, the raw score
 * (before whackRev 1's lift) mapped so the simulated players' 62 / 102 / 118 / 133 (average / good / great /
 * near-perfect) land about 70 / 100 / 120 / 140; 0 stays 0 and only a perfect 150 is 150.
 */
export const WHACK_REV_BANDS = 2;
export const WHACK_BANDS_MAP = bandCurve([0, 62, 102, 118, 133, 150], [0, 70, 100, 120, 140, 150]);
export const whackBandsGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = { ...whackGame, init: (seed) => ({ ...init(seed), sb: 1 }) };

/* ================= Depth to 200 (whackRev 3, 25 Oct 2026) ================= */

/**
 * whackRev 3 (docs/depth/d3-speed-attention.md): whackRev 2 play, schedule and score (0–150, the base), plus two
 * features that are the only way past 150 (round maximum 200, roundMax.ts):
 *
 *   - the gold combo: right hits in a row, with no wrong-colour, hedgehog or empty-hole tap between them (a target
 *     left to sink does not break it), raise a multiplier, ×1 for hits 1–5, ×2 from the 6th, ×3 from the 11th, ×4
 *     from the 16th; each hit adds (multiplier − 1) combo pips weighted by its quickness (whackComboQuick: full up to
 *     150 ms after the target rose, none from about 267 ms), and the combo part rises evenly to WHACK_COMBO_POINTS at
 *     WHACK_COMBO_FULL_PCT of the pips of one unbroken, full-quickness run through every target (elite pace);
 *   - the diamond: WHACK_DIAMONDS times a run a diamond rises for WHACK_DIAMOND_LIFE_TICKS (300 ms) in a burrow no
 *     target uses meanwhile; a tap on it is worth WHACK_DIAMOND_POINTS and is never a mistake.
 *
 * The diamond schedule is drawn after the pop schedule from the same seeded stream (rng carried in the state), so
 * the base schedule is whackRev 2's exactly. 200 needs a perfect base, an unbroken combo at elite pace and both
 * diamonds.
 */
export const WHACK_REV_DEPTH = 3;
export const WHACK_COMBO_POINTS = 44;
/**
 * The share of a perfect run's pips (every target, unbroken, at full quickness) that earns the whole combo part,
 * in per cent: an unbroken run at elite pace (tuned 26 Oct 2026); the part rises evenly to it.
 */
export const WHACK_COMBO_FULL_PCT = 52;
export const WHACK_DIAMONDS = 2;
export const WHACK_DIAMOND_POINTS = 3;
export const WHACK_DIAMOND_LIFE_TICKS = 18;
/**
 * whackRev 4 (27 Oct 2026, Joe's phone notes; src/lib/duel/phoneNotes.ts): whackRev 3 exactly, but each diamond
 * stays up for WHACK_DIAMOND_LIFE_TICKS_NOTES (450 ms) instead of 300 ms; its burrow is kept free for that long.
 */
export const WHACK_REV_NOTES = 4;
export const WHACK_DIAMOND_LIFE_TICKS_NOTES = 27;
/** Each diamond rises in its own window of the run (ticks). */
export const WHACK_DIAMOND_WINDOWS: readonly (readonly [number, number])[] = [[12 * TICKS_PER_SECOND, 28 * TICKS_PER_SECOND], [34 * TICKS_PER_SECOND, 52 * TICKS_PER_SECOND]];
/** Hits in a row per multiplier step, and the top multiplier. */
export const WHACK_COMBO_STEP = 5;
export const WHACK_COMBO_TOP = 4;

export interface WhackDepth {
  /** Right hits in a row now, the best run, and the combo pips earned. */
  combo: number;
  best: number;
  pips: number;
  /** Diamond schedule (rise tick, hole) and progress. */
  at: number[];
  hole: number[];
  status: number[];
  done: number[];
  hits: number;
  /** whackRev 4: each diamond's life in ticks (absent = WHACK_DIAMOND_LIFE_TICKS, whackRev 3). */
  life?: number;
}

/** A diamond's life in ticks for this run's state (whackRev 3 or 4). */
export function whackDiamondLife(dp: Pick<WhackDepth, "life">): number {
  return dp.life ?? WHACK_DIAMOND_LIFE_TICKS;
}

/** The multiplier for the `combo`-th right hit in a row (1-based). */
export function whackComboMultiplier(combo: number): number {
  if (combo <= 0) return 1;
  return Math.min(WHACK_COMBO_TOP, 1 + Math.floor((combo - 1) / WHACK_COMBO_STEP));
}

/**
 * A combo hit's quickness weight, 0–WHACK_QUICK_STEPS, from the ticks between the target rising and the hit: the
 * full weight up to WHACK_QUICK_FULL_TICKS (elite pace), falling evenly to 0 at WHACK_QUICK_ZERO_TICKS, so the
 * combo's full value needs an unbroken run at elite pace (tuned 26 Oct 2026, before whackRev 3 went live).
 */
export const WHACK_QUICK_STEPS = 8;
export const WHACK_QUICK_FULL_TICKS = 9;
export const WHACK_QUICK_ZERO_TICKS = 16;
export function whackComboQuick(delayTicks: number): number {
  if (delayTicks <= WHACK_QUICK_FULL_TICKS) return WHACK_QUICK_STEPS;
  if (delayTicks >= WHACK_QUICK_ZERO_TICKS) return 0;
  return Math.floor((WHACK_QUICK_STEPS * (WHACK_QUICK_ZERO_TICKS - delayTicks)) / (WHACK_QUICK_ZERO_TICKS - WHACK_QUICK_FULL_TICKS));
}

/** Combo pips of one unbroken run through `total` targets, every hit at full quickness. */
export function whackComboMaxPips(total: number): number {
  let pips = 0;
  for (let n = 1; n <= total; n++) pips += (whackComboMultiplier(n) - 1) * WHACK_QUICK_STEPS;
  return pips;
}

function buildDiamonds(rngStart: number, schedule: WhackSchedule, life = WHACK_DIAMOND_LIFE_TICKS): { rng: number; at: number[]; hole: number[] } {
  let rng = rngStart | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const at: number[] = [];
  const hole: number[] = [];
  for (const [lo, hi] of WHACK_DIAMOND_WINDOWS) {
    let tick = lo + draw(hi - lo);
    for (let tries = 0; tries < hi - lo; tries++, tick = tick + 1 >= hi ? lo : tick + 1) {
      // Burrows with no target up at any moment of the diamond's life (and a beat either side).
      const busy = new Set<number>();
      for (let i = 0; i < schedule.at.length; i++) {
        const from = schedule.at[i]!;
        const to = from + schedule.life[i]! + 12;
        if (from <= tick + life + 6 && to >= tick) busy.add(schedule.hole[i]!);
      }
      const free: number[] = [];
      for (let h = 0; h < WHACK_HOLES; h++) if (!busy.has(h)) free.push(h);
      if (free.length === 0) continue;
      at.push(tick);
      hole.push(free[draw(free.length)]!);
      break;
    }
  }
  return { rng, at, hole };
}

function initDepthWith(seed: number, life?: number): WhackState {
  const base = init(seed);
  const d = buildDiamonds(base.rng, base.schedule, life);
  return {
    ...base,
    rng: d.rng,
    sb: 1,
    dp: {
      combo: 0, best: 0, pips: 0, at: d.at, hole: d.hole, status: d.at.map(() => WHACK_STATUS_WAITING), done: d.at.map(() => 0), hits: 0,
      ...(life !== undefined ? { life } : {}),
    },
  };
}

function initDepth(seed: number): WhackState {
  return initDepthWith(seed);
}

function stepDiamonds(dp: WhackDepth, tick: number): WhackDepth {
  const status = [...dp.status];
  const done = [...dp.done];
  for (let i = 0; i < dp.at.length; i++) {
    if (status[i] === WHACK_STATUS_UP && tick >= dp.at[i]! + whackDiamondLife(dp)) { status[i] = WHACK_STATUS_RETIRED; done[i] = tick; }
    else if (status[i] === WHACK_STATUS_WAITING && tick >= dp.at[i]!) status[i] = WHACK_STATUS_UP;
  }
  return { ...dp, status, done };
}

/** The diamond standing in a hole, or -1. */
export function diamondUpAt(dp: WhackDepth, hole: number): number {
  for (let i = 0; i < dp.at.length; i++) if (dp.status[i] === WHACK_STATUS_UP && dp.hole[i] === hole) return i;
  return -1;
}

export interface WhackDepthScore {
  base: number;
  combo: number;
  diamonds: number;
  score: number;
}

/** whackRev 3's score: the whackRev 2 base, the combo part and the diamonds, 0–200. */
export function whackDepthScore(state: WhackState): WhackDepthScore {
  const raw = whackScore(state.hits, state.wrong, state.schedule.total, state.empty, state.bombs);
  const base = bandMapTotal(WHACK_BANDS_MAP, raw);
  const dp = state.dp;
  if (!dp) return { base, combo: 0, diamonds: 0, score: base };
  const maxPips = whackComboMaxPips(state.schedule.total);
  const pips = Math.min(dp.pips, maxPips);
  const combo = maxPips > 0 ? Math.min(WHACK_COMBO_POINTS, Math.floor((WHACK_COMBO_POINTS * 100 * pips) / (maxPips * WHACK_COMBO_FULL_PCT))) : 0;
  const diamonds = WHACK_DIAMOND_POINTS * dp.hits;
  return { base, combo, diamonds, score: clampInt(base + combo + diamonds, 0, 200) };
}

function whackDepthChecksumValues(dp: WhackDepth): number[] {
  let h = 0;
  for (let i = 0; i < dp.status.length; i++) h = (Math.imul(h, 31) + dp.status[i]! * 7 + dp.done[i]!) | 0;
  return [dp.combo, dp.best, dp.pips, dp.hits, h];
}

export const whackDepthGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = { ...whackGame, init: initDepth };
/** whackRev 4: whackRev 3 with the longer diamond. */
export const whackNotesGame: ArcadeGame<WhackState, ArcadeInputEvent | null> = { ...whackGame, init: (seed) => initDepthWith(seed, WHACK_DIAMOND_LIFE_TICKS_NOTES) };
