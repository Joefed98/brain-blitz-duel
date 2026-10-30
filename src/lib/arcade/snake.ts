/**
 * Snake — an arcade game on the shared engine.
 *
 * A 15×20 grid. The snake steps one cell every few ticks, eats the pellet in
 * front of it and grows. The pellet positions come from a fixed queue built at
 * init, so everyone eats the same food in the same order. Every value in the
 * state is an integer and nothing draws fresh randomness during play.
 *
 * Players call the pellets "stars" and the snake "the meteor" (Meteor).
 *
 * snakeRev 2 adds asteroids. The room seed fixes a schedule of rock slots, each
 * a grid square and a landing tick; a rock lands in a slot only for a meteor
 * that has earned one (length 10, then every 5 more stars, at most 8) by the
 * time its 2 s shadow would start. So every rock that lands anywhere in the room
 * lands on the same square at the same moment; nothing is placed relative to a
 * player's meteor. Rock squares never hold a star now or later (no square in the
 * star queue), sit off the border and never touch each other. Only the head
 * collides with a rock: moving into one, or one landing on it, ends the run;
 * the body passes through. Unstamped rounds keep the original rules.
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
import { BAND_STRICT_MARK, bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const SNAKE_COLS = 15;
export const SNAKE_ROWS = 20;
export const SNAKE_CELL = 24;
export const SNAKE_CELLS = SNAKE_COLS * SNAKE_ROWS;

export const SNAKE_BOARD_W = SNAKE_COLS * SNAKE_CELL;
export const SNAKE_BOARD_H = SNAKE_ROWS * SNAKE_CELL;
export const SNAKE_HUD_H = 44;
export const SNAKE_WORLD_W = 390;
export const SNAKE_WORLD_H = SNAKE_HUD_H + SNAKE_BOARD_H + 8;
export const SNAKE_BOARD_X = (SNAKE_WORLD_W - SNAKE_BOARD_W) / 2;
export const SNAKE_BOARD_Y = SNAKE_HUD_H;

export const SNAKE_RUN_SECONDS = 60;
export const SNAKE_RUN_TICKS = SNAKE_RUN_SECONDS * TICKS_PER_SECOND;

export const SNAKE_START_LEN = 3;
/** Ticks per cell at the start, and the floor it speeds up to. */
export const SNAKE_STEP_START = 9;
export const SNAKE_STEP_MIN = 4;
/** One tick faster per this many pellets eaten. */
export const SNAKE_PELLETS_PER_STEP = 5;

/** The fixed pellet queue, drawn once at init. */
export const SNAKE_QUEUE_LEN = 200;

/** Par: 28 pellets. */
/** 5 per pellet eaten, cap 150. */
export const SNAKE_PELLET_POINTS = 5;

/** A turn: a = 0 up, 1 right, 2 down, 3 left. */
export const SNAKE_INPUT_TURN = 4;
export const SNAKE_INPUT_RANGES: readonly InputRange[] = [inputRange(SNAKE_INPUT_TURN, [0, 3])];

/** Rule revision stamped on new rounds (puzzle.snakeRev); absent = original rules. */
export const SNAKE_REV = 3;
/** snakeRev 2: asteroids only (shipped in #15). snakeRev 3 adds the meteor shower. */
export const SNAKE_REV2 = 2;
/** snakeRev 3 meteor shower: at 20 stars, 3 rocks land at once on fixed squares. */
export const SNAKE_SHOWER_STARS = 20;
export const SNAKE_SHOWER_ROCKS = 3;
/** Shower moments: one every 4 s from 16 s, each nudged by up to ±0.5 s from the seed. */
export const SNAKE_SHOWER_SLOT_FIRST = 16 * TICKS_PER_SECOND;
export const SNAKE_SHOWER_SLOT_EVERY = 4 * TICKS_PER_SECOND;
/** Rock cap with the shower: the 8 asteroids plus the 3 shower rocks. */
export const SNAKE_ROCK_MAX_V3 = 11;
/** Asteroids (snakeRev 2): at most this many rocks in a run. */
export const SNAKE_ROCK_MAX = 8;
/** The first rock is earned at this meteor length, then one more every SNAKE_ROCK_EVERY stars. */
export const SNAKE_ROCK_START_LEN = 10;
export const SNAKE_ROCK_EVERY = 5;
/** A rock's shadow shows on its square for two seconds before it lands. */
export const SNAKE_ROCK_WARN_TICKS = 2 * TICKS_PER_SECOND;
/** Rock slots: the first lands about 10 s in, then one every 3 s, each nudged by up to ±0.5 s from the seed. */
export const SNAKE_ROCK_SLOT_FIRST = 10 * TICKS_PER_SECOND;
export const SNAKE_ROCK_SLOT_EVERY = 3 * TICKS_PER_SECOND;
export const SNAKE_ROCK_SLOT_JITTER = TICKS_PER_SECOND >> 1;

/** A swipe must cover this many pixels before it counts as a turn. */
export const SNAKE_SWIPE_PX = 24;

/** Ticks a cell takes after this many pellets. */
export function snakeStepTicks(eaten: number): number {
  const faster = Math.trunc(eaten / SNAKE_PELLETS_PER_STEP);
  return Math.max(SNAKE_STEP_MIN, SNAKE_STEP_START - faster);
}

/* ================================ State ================================ */

export interface SnakeState extends BandFields {
  tick: number;
  rng: number;
  /** Cell indices, head first. */
  body: number[];
  /** 0 up, 1 right, 2 down, 3 left. */
  dir: number;
  /** The direction the next cell step will take. */
  nextDir: number;
  eaten: number;
  /** The fixed pellet queue and how far into it the run has reached. */
  queue: number[];
  cursor: number;
  pellet: number;
  /** Ticks since the last cell step. */
  sinceMove: number;
  dead: boolean;
  endedTick: number;
  /** snakeRev 2 only; every field below is absent on unstamped rounds. */
  rev?: number;
  /** The seeded rock schedule: square and landing tick per slot, the same for the whole room. */
  rockSlots?: SnakeRockSlot[];
  /** The next slot not yet decided. */
  rockSlot?: number;
  /** Squares holding a landed rock, in landing order. */
  rocks?: number[];
  /** The square under a falling rock's shadow, or -1; it lands on rockLandTick. */
  rockWarn?: number;
  rockLandTick?: number;
  /** Why a rock ended the run: 1 = the head moved into it, 2 = it landed on the head; 0 = it did not. */
  rockHit?: number;
  /** snakeRev 3 only: the shower's three squares and its possible landing ticks (room-wide). */
  showerCells?: number[];
  showerSlots?: number[];
  /** The next shower moment not yet decided; the shower's falling squares (or empty) and their landing tick; 1 once it has fallen. */
  showerSlot?: number;
  showerWarn?: number[];
  showerLandTick?: number;
  showerDone?: number;
  /** snakeRev 5 only (Tuning E): the taller grid's row count (SNAKE_TALL_ROWS). Absent = SNAKE_ROWS. */
  rows?: number;
  /** snakeRev 6 only (Tuning F): 1 = more rocks (snakeRocksEarned's Tuning F pace). Absent on every earlier round. */
  tunef?: number;
  /** snakeRev 9 only (the expansion): every field below is absent on earlier rounds. */
  exp?: number;
  /** The wider grid's column count (SNAKE_V9_COLS). Absent = SNAKE_COLS. */
  cols?: number;
  /** Wormholes: mouth pairs, flat ([a0, b0, a1, b1]); entering one mouth comes out of the other. */
  warps?: number[];
  /** Speed lanes: one row and one column (the head steps faster travelling along them). */
  laneRow?: number;
  laneCol?: number;
  /** Gold comet stars: the room's schedule (square, appearing tick) and how far the run has reached. */
  golds?: SnakeRockSlot[];
  goldAt?: number;
  /** The gold star on the board now (square, or -1) and the tick it fades out. */
  gold?: number;
  goldEnd?: number;
  goldsEaten?: number;
  goldPts?: number;
  /** Star combo: the tick of the last star, the run of quick stars and its points. */
  lastStar?: number;
  combo?: number;
  maxCombo?: number;
  comboPts?: number;
  /** Speed lanes: the current ride's length in squares and the squares that counted. */
  laneRun?: number;
  laneCells?: number;
  /** Wormholes: trips taken, the tick of the last, and warp stars' points. */
  warpsUsed?: number;
  lastWarp?: number;
  warpPts?: number;
  /** snakeRev 10 only (Joe's phone notes, 27 Oct 2026): absent on every earlier round. */
  /** A second vertical speed lane's column. */
  laneCol2?: number;
  /** How long a gold star stays (ticks); absent = SNAKE_GOLD_LIFE. */
  goldLife?: number;
  /** Top-left squares of the room's 2 × 2 rocks (each a rock slot's cell); every other rock fills one square. */
  bigRocks?: number[];
  /** snakeRev 11 only (the arcade scoring standard, 29 Oct 2026): 1 on the new scoring; absent on every earlier round. */
  std?: number;
  /** Gold stars' worth so far, as the sum of each eaten gold's ticks left (from its life on arrival down to 1). */
  goldLeft?: number;
  /** Lane rides: rides that reached SNAKE_STD_LANE_RIDE squares along a lane. */
  laneRides?: number;
}

/** Grid rows a state plays on: Tuning E's taller grid, or the original 20. */
export function snakeRowsOf(state: { rows?: number }): number {
  return state.rows ?? SNAKE_ROWS;
}

/** World height (px) for a grid of this many rows: HUD, board and the bottom margin. */
export function snakeWorldHFor(rows: number): number {
  return SNAKE_HUD_H + rows * SNAKE_CELL + 8;
}

export interface SnakeRockSlot {
  cell: number;
  tick: number;
}

function cellOf(row: number, col: number, cols: number = SNAKE_COLS): number {
  return row * cols + col;
}

/** A cell's row and column; `cols` is the grid's width (snakeRev 9's wider grid, else SNAKE_COLS). */
export function snakeRow(cell: number, cols: number = SNAKE_COLS): number {
  return Math.trunc(cell / cols);
}

export function snakeCol(cell: number, cols: number = SNAKE_COLS): number {
  return cell % cols;
}

/** Grid columns a state plays on: snakeRev 9's wider grid, or the original 15. */
export function snakeColsOf(state: { cols?: number }): number {
  return state.cols ?? SNAKE_COLS;
}

/** The first queued pellet the snake is not sitting on. */
function pelletFrom(
  queue: readonly number[],
  cursor: number,
  body: readonly number[],
): { cursor: number; pellet: number } {
  let at = cursor;
  for (let guard = 0; guard < SNAKE_QUEUE_LEN; guard++) {
    const cell = queue[at % SNAKE_QUEUE_LEN] ?? 0;
    if (!body.includes(cell)) return { cursor: at, pellet: cell };
    at += 1;
  }
  return { cursor: at, pellet: queue[at % SNAKE_QUEUE_LEN] ?? 0 };
}

function init(seed: number, rows: number = SNAKE_ROWS, cols: number = SNAKE_COLS): SnakeState {
  let rng = seed | 0;
  const queue: number[] = [];
  for (let slot = 0; slot < SNAKE_QUEUE_LEN; slot++) {
    const drawn = rngBelow(rng, rows * cols);
    rng = drawn.state;
    queue.push(drawn.value);
  }
  const col = cols >> 1;
  const row = rows >> 1;
  const body = [cellOf(row, col, cols), cellOf(row + 1, col, cols), cellOf(row + 2, col, cols)];
  const first = pelletFrom(queue, 0, body);
  return {
    ...(rows !== SNAKE_ROWS ? { rows } : {}),
    ...(cols !== SNAKE_COLS ? { cols } : {}),
    tick: 0,
    rng,
    body,
    dir: 0,
    nextDir: 0,
    eaten: 0,
    queue,
    cursor: first.cursor,
    pellet: first.pellet,
    sinceMove: 0,
    dead: false,
    endedTick: 0,
  };
}

/**
 * The room's rock schedule: one slot every 3 s from 10 s, nudged by the seed, on
 * squares that are off the border, never in the star queue and never next to
 * (or diagonal to) another slot's square. Drawn from the state's own PRNG after
 * the star queue, so the original queue is untouched.
 */
function rockSchedule(rngIn: number, queue: readonly number[], rows: number = SNAKE_ROWS, cols: number = SNAKE_COLS): { rng: number; slots: SnakeRockSlot[] } {
  let rng = rngIn;
  const starCells = new Set(queue);
  const slots: SnakeRockSlot[] = [];
  for (let base = SNAKE_ROCK_SLOT_FIRST; base + SNAKE_ROCK_SLOT_JITTER < SNAKE_RUN_TICKS; base += SNAKE_ROCK_SLOT_EVERY) {
    const jitter = rngBelow(rng, 2 * SNAKE_ROCK_SLOT_JITTER + 1);
    rng = jitter.state;
    let cell = -1;
    for (let attempt = 0; attempt < 64 && cell < 0; attempt++) {
      const drawn = rngBelow(rng, (rows - 2) * (cols - 2));
      rng = drawn.state;
      const row = 1 + Math.trunc(drawn.value / (cols - 2));
      const col = 1 + (drawn.value % (cols - 2));
      const candidate = cellOf(row, col, cols);
      if (starCells.has(candidate)) continue;
      const near = slots.some(
        (slot) => Math.abs(snakeRow(slot.cell, cols) - row) <= 1 && Math.abs(snakeCol(slot.cell, cols) - col) <= 1,
      );
      if (!near) cell = candidate;
    }
    if (cell >= 0) slots.push({ cell, tick: base - SNAKE_ROCK_SLOT_JITTER + jitter.value });
  }
  return { rng, slots };
}

function initRev2(seed: number, rows: number = SNAKE_ROWS, cols: number = SNAKE_COLS): SnakeState {
  const base = init(seed, rows, cols);
  const schedule = rockSchedule(base.rng, base.queue, rows, cols);
  return {
    ...base,
    rng: schedule.rng,
    rev: SNAKE_REV2,
    rockSlots: schedule.slots,
    rockSlot: 0,
    rocks: [],
    rockWarn: -1,
    rockLandTick: 0,
    rockHit: 0,
  };
}

/**
 * snakeRev 3: the asteroid schedule, then the shower — three squares that are
 * off the border, not in the star queue, and clear of (not touching) every
 * asteroid square and each other — and its possible moments. Drawn from the PRNG
 * continuing after the asteroids, so the rev-2 schedule is untouched.
 */
function initRev3(seed: number, rows: number = SNAKE_ROWS, cols: number = SNAKE_COLS): SnakeState {
  const base = initRev2(seed, rows, cols);
  let rng = base.rng;
  const stars = new Set(base.queue);
  const taken = (base.rockSlots ?? []).map((slot) => slot.cell);
  const cells: number[] = [];
  for (let attempt = 0; attempt < 400 && cells.length < SNAKE_SHOWER_ROCKS; attempt++) {
    const drawn = rngBelow(rng, (rows - 2) * (cols - 2));
    rng = drawn.state;
    const row = 1 + Math.trunc(drawn.value / (cols - 2));
    const col = 1 + (drawn.value % (cols - 2));
    const candidate = cellOf(row, col, cols);
    if (stars.has(candidate)) continue;
    const near = [...taken, ...cells].some((cell) => Math.abs(snakeRow(cell, cols) - row) <= 1 && Math.abs(snakeCol(cell, cols) - col) <= 1);
    if (!near) cells.push(candidate);
  }
  const slots: number[] = [];
  for (let at = SNAKE_SHOWER_SLOT_FIRST; at + SNAKE_ROCK_SLOT_JITTER < SNAKE_RUN_TICKS; at += SNAKE_SHOWER_SLOT_EVERY) {
    const jitter = rngBelow(rng, 2 * SNAKE_ROCK_SLOT_JITTER + 1);
    rng = jitter.state;
    slots.push(at - SNAKE_ROCK_SLOT_JITTER + jitter.value);
  }
  return {
    ...base,
    rng,
    rev: SNAKE_REV,
    showerCells: cells,
    showerSlots: slots,
    showerSlot: 0,
    showerWarn: [],
    showerLandTick: 0,
    showerDone: 0,
  };
}

/** Rocks a meteor of this many stars has earned (length 10, then every 5 stars, at most 8; snakeRev 6: length 9, every 4, at most 11). */
export function snakeRocksEarned(eaten: number, tunef?: number): number {
  const length = SNAKE_START_LEN + eaten;
  const [start, every, max] = tunef ? [SNAKE_ROCK_START_LEN_V6, SNAKE_ROCK_EVERY_V6, SNAKE_ROCK_MAX_V6] : [SNAKE_ROCK_START_LEN, SNAKE_ROCK_EVERY, SNAKE_ROCK_MAX];
  if (length < start) return 0;
  return Math.min(max, 1 + Math.trunc((length - start) / every));
}

function isOver(state: SnakeState): boolean {
  return state.dead || state.tick >= SNAKE_RUN_TICKS;
}

export function snakeSurvived(state: SnakeState): boolean {
  return !state.dead && state.tick >= SNAKE_RUN_TICKS;
}

/** True when this direction would double the snake back on itself. */
export function snakeReversal(dir: number, next: number): boolean {
  return (dir + 2) % 4 === next;
}

function step(state: SnakeState, input: ArcadeInputEvent | null): SnakeState {
  if (state.exp) return stepV9(state, input);
  return state.rev === SNAKE_REV2 || state.rev === SNAKE_REV ? stepRev2(state, input) : stepV1(state, input);
}

/**
 * The square the head steps into next going `dir`, or -1 past a wall. snakeRev 9: a wormhole mouth
 * sends the head straight out of its partner (the mouth itself is never occupied).
 */
export function snakeTarget(state: SnakeState, dir: number): number {
  const cols = snakeColsOf(state);
  const head = state.body[0] ?? 0;
  const row = snakeRow(head, cols) + (dir === 0 ? -1 : dir === 2 ? 1 : 0);
  const col = snakeCol(head, cols) + (dir === 1 ? 1 : dir === 3 ? -1 : 0);
  if (row < 0 || row >= snakeRowsOf(state) || col < 0 || col >= cols) return -1;
  const cell = cellOf(row, col, cols);
  return state.warps ? snakeWarpExit(state.warps, cell) : cell;
}

/** The original rules, byte for byte; snakeRev 2 runs them and then its rocks. */
function stepV1(state: SnakeState, input: ArcadeInputEvent | null): SnakeState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let nextDir = state.nextDir;
  if (input && input.k === SNAKE_INPUT_TURN) {
    const wanted = clampInt(input.a, 0, 3);
    if (!snakeReversal(state.dir, wanted)) nextDir = wanted;
  }

  const sinceMove = state.sinceMove + 1;
  // snakeRev 9: a speed lane steps faster (snakeStepTicksFor); older rounds use the star count alone.
  if (sinceMove < (state.exp ? snakeStepTicksFor(state, nextDir) : snakeStepTicks(state.eaten))) {
    const next: SnakeState = { ...state, tick, nextDir, sinceMove };
    if (tick >= SNAKE_RUN_TICKS) return { ...next, endedTick: tick };
    return next;
  }

  const ahead = snakeTarget(state, nextDir);
  if (ahead < 0) {
    return { ...state, tick, dir: nextDir, nextDir, sinceMove: 0, dead: true, endedTick: tick };
  }

  const target = ahead;
  const grew = target === state.pellet;
  const body = [target, ...state.body];
  if (!grew) body.pop();
  if (body.slice(1).includes(target)) {
    return { ...state, tick, dir: nextDir, nextDir, sinceMove: 0, dead: true, endedTick: tick };
  }

  const eaten = state.eaten + (grew ? 1 : 0);
  const found = grew
    ? pelletFrom(state.queue, state.cursor + 1, body)
    : { cursor: state.cursor, pellet: state.pellet };

  const next: SnakeState = {
    ...state,
    tick,
    body,
    dir: nextDir,
    nextDir,
    eaten,
    cursor: found.cursor,
    pellet: found.pellet,
    sinceMove: 0,
  };
  if (tick >= SNAKE_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

/** snakeRev 2: the original move, then the rock schedule. */
function stepRev2(state: SnakeState, input: ArcadeInputEvent | null): SnakeState {
  if (isOver(state)) return state;
  const rocks = state.rocks ?? [];
  // The head may not enter a rock square: test the square it is about to step into.
  let nextDir = state.nextDir;
  if (input && input.k === SNAKE_INPUT_TURN) {
    const wanted = clampInt(input.a, 0, 3);
    if (!snakeReversal(state.dir, wanted)) nextDir = wanted;
  }
  const moving = state.sinceMove + 1 >= (state.exp ? snakeStepTicksFor(state, nextDir) : snakeStepTicks(state.eaten));
  if (moving && rocks.length > 0) {
    const target = snakeTarget(state, nextDir);
    if (target >= 0 && (state.bigRocks ? snakeRockCells(state).includes(target) : rocks.includes(target))) {
      const tick = state.tick + 1;
      return { ...state, tick, dir: nextDir, nextDir, sinceMove: 0, dead: true, endedTick: tick, rockHit: 1 };
    }
  }

  let next = stepV1(state, input);
  if (next.dead) return next;

  const slots = next.rockSlots ?? [];
  let slot = next.rockSlot ?? 0;
  let warn = next.rockWarn ?? -1;
  let landTick = next.rockLandTick ?? 0;
  let landed = rocks;
  // A falling rock lands; on the head it ends the run, anywhere on the body it does nothing.
  if (warn >= 0 && next.tick >= landTick) {
    landed = [...rocks, warn];
    // snakeRev 10: a 2 × 2 rock lands on all four of its squares.
    const hitHead = next.bigRocks ? snakeRockSpan(next, warn).includes(next.body[0] ?? -1) : next.body[0] === warn;
    warn = -1;
    landTick = 0;
    if (hitHead) {
      return { ...next, rocks: landed, rockWarn: -1, rockLandTick: 0, rockHit: 2, dead: true, endedTick: next.tick };
    }
  }
  // Each slot is decided once, when its shadow would start: it falls only for a meteor that has earned a rock.
  while (slot < slots.length && next.tick >= (slots[slot]?.tick ?? 0) - SNAKE_ROCK_WARN_TICKS) {
    const due = slots[slot]!;
    slot += 1;
    // Shower rocks (rev 3) do not count against the asteroids a meteor has earned.
    const showerCells = next.showerCells ?? [];
    const asteroids = showerCells.length > 0 ? landed.filter((cell) => !showerCells.includes(cell)).length : landed.length;
    if (warn < 0 && snakeRocksEarned(next.eaten, next.tunef) > asteroids) {
      warn = due.cell;
      landTick = due.tick;
    }
  }
  next = { ...next, rocks: landed, rockSlot: slot, rockWarn: warn, rockLandTick: landTick };
  if (next.rev === SNAKE_REV) next = stepShower(next);
  return next;
}

/**
 * snakeRev 3 meteor shower: the first shower moment whose 2 s warning starts once
 * the meteor has 20 stars drops all three rocks on their fixed squares together.
 * One shower a run; a shower rock on the head ends the run, on the body does nothing.
 */
function stepShower(state: SnakeState): SnakeState {
  let warn = state.showerWarn ?? [];
  let landTick = state.showerLandTick ?? 0;
  let done = state.showerDone ?? 0;
  let slot = state.showerSlot ?? 0;
  let rocks = state.rocks ?? [];
  if (warn.length > 0 && state.tick >= landTick) {
    rocks = [...rocks, ...warn];
    const hitHead = warn.includes(state.body[0] ?? -1);
    warn = [];
    landTick = 0;
    if (hitHead) return { ...state, rocks, showerWarn: [], showerLandTick: 0, rockHit: 2, dead: true, endedTick: state.tick };
  }
  const slots = state.showerSlots ?? [];
  while (slot < slots.length && state.tick >= (slots[slot] ?? 0) - SNAKE_ROCK_WARN_TICKS) {
    const due = slots[slot]!;
    slot += 1;
    if (!done && state.eaten >= SNAKE_SHOWER_STARS && (state.showerCells ?? []).length > 0) {
      warn = [...(state.showerCells ?? [])];
      landTick = due;
      done = 1;
    }
  }
  return { ...state, rocks, showerSlot: slot, showerWarn: warn, showerLandTick: landTick, showerDone: done };
}

function score(state: SnakeState): number {
  return clampInt(SNAKE_PELLET_POINTS * state.eaten, 0, 150);
}

/* =========================== Integrity checks ========================== */

export const SNAKE_CHECKPOINT_INTERVAL = 300;

export interface SnakeCheckpointState {
  tick: number;
  head: number;
  tail: number;
  length: number;
  dir: number;
  nextDir: number;
  eaten: number;
  pellet: number;
  cursor: number;
  sinceMove: number;
  stepTicks: number;
}

export interface SnakeCheckpoint extends SnakeCheckpointState {
  checksum: number;
}

export function snakeCheckpointState(state: SnakeState): SnakeCheckpointState {
  return {
    tick: state.tick,
    head: state.body[0] ?? 0,
    tail: state.body[state.body.length - 1] ?? 0,
    length: state.body.length,
    dir: state.dir,
    nextDir: state.nextDir,
    eaten: state.eaten,
    pellet: state.pellet,
    cursor: state.cursor,
    sinceMove: state.sinceMove,
    stepTicks: snakeStepTicks(state.eaten),
  };
}

/** 32-bit FNV-1a over the integer snapshot. */
export function snakeCheckpoint(state: SnakeState): SnakeCheckpoint {
  const snapshot = snakeCheckpointState(state);
  let checksum = 0x811c9dc5;
  // snakeRev 2 folds its rock state into the checksum; the encoded fields stay the same.
  const extra =
    state.rev === SNAKE_REV2 || state.rev === SNAKE_REV ? [state.rockSlot ?? 0, state.rockWarn ?? -1, ...(state.rocks ?? [])] : [];
  // snakeRev 3 adds the shower's progress.
  if (state.rev === SNAKE_REV) extra.push(state.showerSlot ?? 0, state.showerDone ?? 0, state.showerLandTick ?? 0, ...(state.showerWarn ?? []));
  // snakeRev 5 (Tuning E): the taller grid's rows, last.
  if (state.rows) extra.push(state.rows);
  // snakeRev 6 (Tuning F): its marker after that, so rev-2 to rev-5 checksums are unchanged.
  if (state.tunef) extra.push(state.tunef);
  // snakeRev 9 (the expansion): its own state, last, so every earlier checksum is unchanged.
  if (state.exp) extra.push(...snakeV9Fold(state));
  // snakeRev 10: its fixed features' marker after that, so every snakeRev 9 checksum is unchanged.
  if (state.bigRocks) extra.push(state.laneCol2 ?? -1, state.goldLife ?? 0, ...state.bigRocks);
  // snakeRev 11 (the arcade scoring standard): its marker and its own counters after that, so every snakeRev 10 checksum is unchanged.
  if (state.std) extra.push(state.std, state.goldLeft ?? 0, state.laneRides ?? 0);
  for (const value of [...Object.values(snapshot), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const SNAKE_BG = "#0B0B0F";
export const SNAKE_BODY = "#F5B82E";
export const SNAKE_HEAD = "#B98708";
export const SNAKE_PELLET = "#2ED3B7";

function draw(ctx: CanvasRenderingContext2D, state: SnakeState, size: CanvasSize): void {
  const ROWS = snakeRowsOf(state);
  const WORLD_H = snakeWorldHFor(ROWS);
  const BOARD_H = ROWS * SNAKE_CELL;
  const scale = Math.min(size.width / SNAKE_WORLD_W, size.height / WORLD_H);
  const offsetX = (size.width - SNAKE_WORLD_W * scale) / 2;
  const offsetY = (size.height - WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = SNAKE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Faint grid.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let col = 0; col <= SNAKE_COLS; col++) {
    const x = SNAKE_BOARD_X + col * SNAKE_CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, SNAKE_BOARD_Y);
    ctx.lineTo(x, SNAKE_BOARD_Y + BOARD_H);
    ctx.stroke();
  }
  for (let row = 0; row <= ROWS; row++) {
    const y = SNAKE_BOARD_Y + row * SNAKE_CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(SNAKE_BOARD_X, y);
    ctx.lineTo(SNAKE_BOARD_X + SNAKE_BOARD_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.strokeRect(SNAKE_BOARD_X + 0.5, SNAKE_BOARD_Y + 0.5, SNAKE_BOARD_W - 1, BOARD_H - 1);

  // Pellet.
  ctx.fillStyle = SNAKE_PELLET;
  ctx.beginPath();
  ctx.arc(
    SNAKE_BOARD_X + snakeCol(state.pellet) * SNAKE_CELL + SNAKE_CELL / 2,
    SNAKE_BOARD_Y + snakeRow(state.pellet) * SNAKE_CELL + SNAKE_CELL / 2,
    SNAKE_CELL / 2 - 5,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // snakeRev 2: a falling rock's shadow, then the landed rocks.
  if ((state.rockWarn ?? -1) >= 0) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.3)";
    ctx.fillRect(
      SNAKE_BOARD_X + snakeCol(state.rockWarn!) * SNAKE_CELL + 2,
      SNAKE_BOARD_Y + snakeRow(state.rockWarn!) * SNAKE_CELL + 2,
      SNAKE_CELL - 4,
      SNAKE_CELL - 4,
    );
  }
  ctx.fillStyle = "#77747B";
  for (const rock of state.rocks ?? []) {
    ctx.fillRect(SNAKE_BOARD_X + snakeCol(rock) * SNAKE_CELL + 1, SNAKE_BOARD_Y + snakeRow(rock) * SNAKE_CELL + 1, SNAKE_CELL - 2, SNAKE_CELL - 2);
  }

  state.body.forEach((cell, index) => {
    ctx.fillStyle = index === 0 ? SNAKE_HEAD : SNAKE_BODY;
    ctx.fillRect(
      SNAKE_BOARD_X + snakeCol(cell) * SNAKE_CELL + 2,
      SNAKE_BOARD_Y + snakeRow(cell) * SNAKE_CELL + 2,
      SNAKE_CELL - 4,
      SNAKE_CELL - 4,
    );
  });

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Stars ${state.eaten}`, 14, 14);
  ctx.textAlign = "right";

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, SNAKE_WORLD_W, WORLD_H);
  }

  ctx.restore();
}

export const snakeGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = {
  key: "snake",
  runTicks: SNAKE_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: SNAKE_INPUT_RANGES,
};

/** snakeRev 2 (asteroids). Same step and score; init adds the room's rock schedule. */
export const snakeRev2Game: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeGame, init: initRev2 };
/** snakeRev 3 (asteroids and the 20-star meteor shower). */
export const snakeRev3Game: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeGame, init: initRev3 };

/** The game for a stored round: its snakeRev picks the rules (absent = original). */
export function snakeGameFor(rev?: number | null): ArcadeGame<SnakeState, ArcadeInputEvent | null> {
  if (rev === SNAKE_REV_STD) return snakeStdGame;
  if (rev === SNAKE_REV_10) return snakeV10Game;
  if (rev === SNAKE_REV_200) return snakeV9Game;
  if (rev === SNAKE_REV_STRICT) return snakeStrictGame;
  if (rev === SNAKE_REV_TARGET) return snakeTargetGame;
  if (rev === SNAKE_REV_ROCKS) return snakeRocksGame;
  if (rev === SNAKE_REV_TALL) return snakeTallGame;
  if (rev === SNAKE_REV_BAND) return snakeBandGame;
  if (rev === SNAKE_REV) return snakeRev3Game;
  return rev === SNAKE_REV2 ? snakeRev2Game : snakeGame;
}

/* ================= Oct 2026 score bands (snakeRev 4) ================= */

/** Score-band revision (puzzle.snakeRev = 4): rev-3 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const SNAKE_REV_BAND = 4;
/** Stars eaten; 150 at 38 (the best near-perfect simulated runs ate 38–39). */
export const SNAKE_BAND_CURVE = bandCurve([0, 14, 24, 30, 35, 38], [0, 70, 100, 125, 145, 150]);

export function snakeBandParts(state: SnakeState): BandParts {
  if (state.exp) return snakeV9Parts(state);
  const units = Math.max(0, state.eaten);
  return { units, points: bandPoints(bandCurveOf(state, state.tunef ? SNAKE_V6_BAND_CURVE : state.rows ? SNAKE_V5_BAND_CURVE : SNAKE_BAND_CURVE), units), bonus: 0, penalty: 0, finished: false, text: `${units} stars` };
}

function scoreBand(state: SnakeState): number {
  return bandTotal(snakeBandParts(state), Boolean(state.acted));
}

export const snakeBandGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeRev3Game, init: (seed) => bandInit(snakeRev3Game.init(seed)) };

/* ================= Tuning E (snakeRev 5, Oct 2026) ================= */

/**
 * snakeRev 5 (Tuning E): snakeRev 4 rules on a taller grid, 15 × SNAKE_TALL_ROWS
 * (world 390 × snakeWorldHFor(28) = 724, the same for every player), so the
 * arena fills a 390 × 844 phone down to the usual gap. The star queue, rock
 * squares and shower squares are drawn from the seed over the taller grid; the
 * meteor starts in its middle. Scored on SNAKE_V5_BAND_CURVE (150 at 34 stars
 * instead of 38: the same skill eats fewer stars on the bigger board). States add
 * `rows`, folded into the checkpoint checksum last.
 */
export const SNAKE_REV_TALL = 5;
export const SNAKE_TALL_ROWS = 28;
export const SNAKE_TALL_H = snakeWorldHFor(SNAKE_TALL_ROWS);
/** Stars eaten on the taller grid (stars sit further apart); 150 at 34 (re-measured with scripts/arcade-skill-bands.ts --rev=e). */
export const SNAKE_V5_BAND_CURVE = bandCurve([0, 15, 22, 26, 30, 34], [0, 70, 100, 125, 142, 150]);
export const snakeTallGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeBandGame, init: (seed) => bandInit(initRev3(seed, SNAKE_TALL_ROWS)) };

/** The world height (px) a stored round's snakeRev plays in. */
export function snakeWorldHForRev(rev?: number | null): number {
  if (rev === SNAKE_REV_200 || rev === SNAKE_REV_10 || rev === SNAKE_REV_STD) return SNAKE_V9_H;
  return rev === SNAKE_REV_TALL || rev === SNAKE_REV_ROCKS || rev === SNAKE_REV_TARGET || rev === SNAKE_REV_STRICT ? SNAKE_TALL_H : SNAKE_WORLD_H;
}

/* ================= Tuning F (snakeRev 6, Oct 2026) ================= */

/**
 * snakeRev 6 (Tuning F): snakeRev 5's taller grid with a few more rocks, since
 * the grid is 40 % bigger. The room's rock schedule, squares and shower are
 * drawn exactly as on snakeRev 5; a meteor earns its first rock a star sooner
 * (length 9), then one more every 4 stars (was 5), up to 11 asteroids (was 8),
 * so up to 14 rocks with the shower. Slots still come one every 3 s, so rocks
 * can never land faster than before. States add `tunef: 1`, folded into the
 * checkpoint checksum last.
 */
export const SNAKE_REV_ROCKS = 6;
export const SNAKE_ROCK_START_LEN_V6 = 9;
export const SNAKE_ROCK_EVERY_V6 = 4;
export const SNAKE_ROCK_MAX_V6 = 11;
/** Stars eaten with the extra rocks: the same skill eats a star or two fewer; 150 at 33 (re-measured with scripts/arcade-skill-bands.ts --rev=f). */
export const SNAKE_V6_BAND_CURVE = bandCurve([0, 15, 21, 26, 29, 33], [0, 70, 100, 125, 142, 150]);
export const snakeRocksGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeTallGame, init: (seed) => ({ ...snakeTallGame.init(seed), tunef: 1 }) };

/* ================= Scoring targets (snakeRev 7, 18 Oct 2026) ================= */

/**
 * snakeRev 7 (scoring targets, docs/scoring-targets.md): snakeRev 6 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const SNAKE_REV_TARGET = 7;
export const snakeTargetGame = bandTargetGame(snakeRocksGame);
/** The curve new rounds score on: SNAKE_V6_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const SNAKE_V7_BAND_CURVE = bandRetarget(SNAKE_V6_BAND_CURVE);


/* ================= Score bands (snakeRev 8, 19 Oct 2026) ================= */

/**
 * snakeRev 8 (score bands, docs/scoring-targets.md): snakeRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const SNAKE_REV_STRICT = 8;
export const snakeStrictGame = bandStrictGame(snakeTargetGame);
/** The curve new rounds score on: SNAKE_V6_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const SNAKE_V8_BAND_CURVE = bandStrict(SNAKE_V6_BAND_CURVE);


/* ================= The expansion (snakeRev 9, 25 Oct 2026) ================= */

/**
 * snakeRev 9 (world expansion, docs/expansions/e2.md): a bigger field and four skill features, scored
 * to 200 (docs/scoring-200.md). Everything is drawn once from the room seed, so every player meets
 * the same squares at the same moments; nothing is placed relative to a player's meteor.
 *
 *  - The field: 19 × 34 squares (was 15 × 28), world 468 × 868, so it fills a phone's arena. The star
 *    queue, rocks (snakeRev 6's pace) and the shower are drawn exactly as before over the bigger grid.
 *  - Wormholes: two pairs of mouths, off the border, never on a star, rock, shower square or lane.
 *    Stepping into a mouth comes straight out of its partner, still heading the same way (a risky
 *    shortcut: whatever lies past the exit comes up fast). A star eaten within SNAKE_WARP_STAR_TICKS
 *    of a trip is a warp star (+2).
 *  - Gold comet stars: from 8 s, about every 7 s a gold star appears on a fixed square for 3.5 s and
 *    fades. Eating it (the meteor does not grow) is worth 2–6, more the sooner it is eaten.
 *  - Speed lanes: one row and one column glow. Travelling along a lane the meteor steps 3 ticks
 *    faster (never under 3); from a ride's third square on, every 4 squares ridden score 1.
 *  - Combo: a star eaten within SNAKE_COMBO_TICKS of the last raises the combo; each star at combo n
 *    adds min(n − 1, 3).
 *
 * Score: the stars on SNAKE_V9_BAND_CURVE (to 150, fitted so today's play lands where it did) plus
 * the features' points, each capped (SNAKE_V9_CAPS, 50 in all), to 200. States add `exp: 1` and the
 * fields above, folded into the checkpoint checksum last.
 */
export const SNAKE_REV_200 = 9;
export const SNAKE_V9_COLS = 19;
export const SNAKE_V9_ROWS = 34;
export const SNAKE_V9_WORLD_W = SNAKE_V9_COLS * SNAKE_CELL + 12;
export const SNAKE_V9_H = snakeWorldHFor(SNAKE_V9_ROWS);
export const SNAKE_V9_MAX = 200;
export const SNAKE_WARP_PAIRS = 2;
export const SNAKE_WARP_STAR_TICKS = TICKS_PER_SECOND;
export const SNAKE_WARP_STAR_POINTS = 2;
export const SNAKE_GOLD_FIRST = 8 * TICKS_PER_SECOND;
export const SNAKE_GOLD_EVERY = 7 * TICKS_PER_SECOND;
export const SNAKE_GOLD_JITTER = TICKS_PER_SECOND;
export const SNAKE_GOLD_LIFE = (7 * TICKS_PER_SECOND) >> 1;
export const SNAKE_GOLD_MIN = 1;
export const SNAKE_GOLD_SPAN = 4;
export const SNAKE_LANE_FASTER = 3;
export const SNAKE_LANE_STEP_MIN = 3;
/** A ride counts from its SNAKE_LANE_FROM-th square; every SNAKE_LANE_PER counted squares score 1. */
export const SNAKE_LANE_FROM = 6;
export const SNAKE_LANE_PER = 4;
export const SNAKE_COMBO_TICKS = (5 * TICKS_PER_SECOND) >> 2;
export const SNAKE_COMBO_STEP_MAX = 3;
/** Each feature's most points, 50 in all. */
export const SNAKE_V9_CAPS = { gold: 20, combo: 14, lane: 8, warp: 8 } as const;

/** Board left edge and world width (px) a state plays in: snakeRev 9's wider world, or the original. */
export function snakeBoardXOf(state: { cols?: number }): number {
  return state.cols ? (SNAKE_V9_WORLD_W - state.cols * SNAKE_CELL) / 2 : SNAKE_BOARD_X;
}
export function snakeWorldWOf(state: { cols?: number }): number {
  return state.cols ? SNAKE_V9_WORLD_W : SNAKE_WORLD_W;
}
/** The world width (px) a stored round's snakeRev plays in. */
export function snakeWorldWForRev(rev?: number | null): number {
  return rev === SNAKE_REV_200 || rev === SNAKE_REV_10 || rev === SNAKE_REV_STD ? SNAKE_V9_WORLD_W : SNAKE_WORLD_W;
}

/** The other mouth of a wormhole, or the square itself when it is not a mouth. */
export function snakeWarpExit(warps: readonly number[], cell: number): number {
  const at = warps.indexOf(cell);
  return at < 0 ? cell : warps[at ^ 1]!;
}

/** Whether a head on `cell` heading `dir` travels along a speed lane. */
export function snakeOnLane(state: SnakeState, cell: number, dir: number): boolean {
  if (!state.exp) return false;
  const cols = snakeColsOf(state);
  if (dir === 1 || dir === 3) return snakeRow(cell, cols) === state.laneRow;
  const col = snakeCol(cell, cols);
  // snakeRev 10: a second vertical lane.
  return col === state.laneCol || (state.laneCol2 !== undefined && col === state.laneCol2);
}

/** Ticks the next step takes on snakeRev 9: the star pace, 3 faster along a speed lane. */
export function snakeStepTicksFor(state: SnakeState, dir: number): number {
  const base = snakeStepTicks(state.eaten);
  return snakeOnLane(state, state.body[0] ?? 0, dir) ? Math.max(SNAKE_LANE_STEP_MIN, base - SNAKE_LANE_FASTER) : base;
}

/**
 * A gold star's worth if eaten on `tick`: 1–5, falling as it fades. `life` is how long it stays (snakeRev 10's
 * longer stay, else SNAKE_GOLD_LIFE): the worth falls 5 → 1 over its first SNAKE_GOLD_LIFE, as before, and the
 * extra time it stays pays 1, so the longer stay is a later chance rather than a bigger prize.
 */
export function snakeGoldWorth(tick: number, end: number, life: number = SNAKE_GOLD_LIFE): number {
  const left = clampInt(end - tick - (life - SNAKE_GOLD_LIFE), 0, SNAKE_GOLD_LIFE);
  return SNAKE_GOLD_MIN + Math.trunc((SNAKE_GOLD_SPAN * left + SNAKE_GOLD_LIFE - 1) / SNAKE_GOLD_LIFE);
}

function initV9(seed: number): SnakeState {
  const base = { ...initRev3(seed, SNAKE_V9_ROWS, SNAKE_V9_COLS), tunef: 1 };
  const cols = SNAKE_V9_COLS;
  const rows = SNAKE_V9_ROWS;
  let rng = base.rng;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const stars = new Set(base.queue);
  const rockCells = new Set([...(base.rockSlots ?? []).map((slot) => slot.cell), ...(base.showerCells ?? [])]);
  // Lanes: a row in the middle half and a column in the middle 3/5, clear of the start column.
  const laneRow = Math.trunc(rows / 4) + draw(Math.trunc(rows / 2));
  let laneCol = 4 + draw(cols - 8);
  if (laneCol === cols >> 1) laneCol += 2;
  // Wormholes: one pair top ↔ bottom, one pair left ↔ right, 2+ squares off the border.
  const free = (cell: number, taken: number[]) => {
    const r = snakeRow(cell, cols);
    const c = snakeCol(cell, cols);
    if (stars.has(cell) || rockCells.has(cell) || r === laneRow || c === laneCol) return false;
    return !taken.some((t) => Math.abs(snakeRow(t, cols) - r) <= 2 && Math.abs(snakeCol(t, cols) - c) <= 2);
  };
  const pick = (r0: number, r1: number, c0: number, c1: number, taken: number[]) => {
    for (let attempt = 0; attempt < 400; attempt++) {
      const cell = cellOf(r0 + draw(r1 - r0), c0 + draw(c1 - c0), cols);
      if (free(cell, taken)) return cell;
    }
    return -1;
  };
  const warps: number[] = [];
  const third = Math.trunc(rows / 3);
  const regions: [number, number, number, number][] = [
    [2, third, 2, cols - 2],
    [rows - third, rows - 2, 2, cols - 2],
    [third, rows - third, 2, (cols >> 1) - 2],
    [third, rows - third, (cols >> 1) + 2, cols - 2],
  ];
  for (const [r0, r1, c0, c1] of regions) warps.push(pick(r0, r1, c0, c1, warps));
  // Gold stars: a fixed schedule over the run, each on a square no star, rock, mouth or lane uses.
  const golds: SnakeRockSlot[] = [];
  for (let at = SNAKE_GOLD_FIRST; at + SNAKE_GOLD_JITTER + SNAKE_GOLD_LIFE < SNAKE_RUN_TICKS; at += SNAKE_GOLD_EVERY) {
    const tick = at - SNAKE_GOLD_JITTER + draw(2 * SNAKE_GOLD_JITTER + 1);
    const cell = pick(1, rows - 1, 1, cols - 1, [...warps, ...golds.slice(-1).map((g) => g.cell)]);
    if (cell >= 0) golds.push({ cell, tick });
  }
  return {
    ...base,
    rng,
    exp: 1,
    band: BAND_STRICT_MARK,
    acted: 0,
    warps: warps.every((w) => w >= 0) ? warps : [],
    laneRow,
    laneCol,
    golds,
    goldAt: 0,
    gold: -1,
    goldEnd: 0,
    goldsEaten: 0,
    goldPts: 0,
    lastStar: -9999,
    combo: 0,
    maxCombo: 0,
    comboPts: 0,
    laneRun: 0,
    laneCells: 0,
    warpsUsed: 0,
    lastWarp: -9999,
    warpPts: 0,
  };
}

/** snakeRev 9: snakeRev 3's move, rocks and shower, then the features. */
function stepV9(state: SnakeState, input: ArcadeInputEvent | null): SnakeState {
  if (isOver(state)) return state;
  let next = stepRev2(state, input);
  if (next === state) return state;
  const tick = next.tick;
  const head = next.body[0] ?? 0;
  const moved = !next.dead && head !== state.body[0];
  const extra: Partial<SnakeState> = {};
  if (moved) {
    const cols = snakeColsOf(state);
    const from = state.body[0] ?? 0;
    const warped = Math.abs(snakeRow(from, cols) - snakeRow(head, cols)) + Math.abs(snakeCol(from, cols) - snakeCol(head, cols)) > 1;
    if (warped) {
      extra.warpsUsed = (state.warpsUsed ?? 0) + 1;
      extra.lastWarp = tick;
    }
    // A lane ride: squares stepped along a lane in a row; from its third, they count.
    if (snakeOnLane(state, from, next.dir)) {
      const run = (state.laneRun ?? 0) + 1;
      extra.laneRun = run;
      if (run >= SNAKE_LANE_FROM) extra.laneCells = (state.laneCells ?? 0) + 1;
      // snakeRev 11: a ride counts once, when it reaches SNAKE_STD_LANE_RIDE squares.
      if (state.std && run === SNAKE_STD_LANE_RIDE) extra.laneRides = (state.laneRides ?? 0) + 1;
    } else extra.laneRun = 0;
    if (next.eaten > state.eaten) {
      // snakeRev 11: a 3 s combo window, 1 a star from the third in a row; a 2 s warp window.
      const quick = tick - (state.lastStar ?? -9999) <= (state.std ? SNAKE_STD_COMBO_TICKS : SNAKE_COMBO_TICKS);
      const combo = quick ? (state.combo ?? 0) + 1 : 1;
      extra.combo = combo;
      extra.maxCombo = Math.max(state.maxCombo ?? 0, combo);
      extra.comboPts = (state.comboPts ?? 0) + (state.std ? (combo >= SNAKE_STD_COMBO_FROM ? 1 : 0) : clampInt(combo - 2, 0, SNAKE_COMBO_STEP_MAX));
      extra.lastStar = tick;
      if (tick - (extra.lastWarp ?? state.lastWarp ?? -9999) <= (state.std ? SNAKE_STD_WARP_TICKS : SNAKE_WARP_STAR_TICKS)) extra.warpPts = (state.warpPts ?? 0) + (state.std ? SNAKE_STD_WARP_POINTS : SNAKE_WARP_STAR_POINTS);
    }
  }
  // Gold stars: eaten by the head, faded at their end, the next appears at its tick.
  let gold = state.gold ?? -1;
  let goldEnd = state.goldEnd ?? 0;
  let goldAt = state.goldAt ?? 0;
  if (gold >= 0 && moved && head === gold) {
    extra.goldsEaten = (state.goldsEaten ?? 0) + 1;
    if (state.std) {
      // snakeRev 11: worth falls in a straight line from its full share on the first tick it can be eaten to 0 as it fades.
      const life = state.goldLife ?? SNAKE_GOLD_LIFE;
      const goldLeft = (state.goldLeft ?? 0) + clampInt(goldEnd - tick + 1, 0, life);
      extra.goldLeft = goldLeft;
      extra.goldPts = snakeStdGoldPoints(goldLeft, (state.golds ?? []).length, life);
    } else extra.goldPts = (state.goldPts ?? 0) + snakeGoldWorth(tick, goldEnd, state.goldLife ?? SNAKE_GOLD_LIFE);
    gold = -1;
  }
  if (gold >= 0 && tick >= goldEnd) gold = -1;
  const golds = state.golds ?? [];
  while (goldAt < golds.length && tick >= golds[goldAt]!.tick) {
    gold = golds[goldAt]!.cell;
    goldEnd = golds[goldAt]!.tick + (state.goldLife ?? SNAKE_GOLD_LIFE);
    goldAt += 1;
  }
  if (gold !== state.gold || goldEnd !== state.goldEnd || goldAt !== state.goldAt) Object.assign(extra, { gold, goldEnd, goldAt });
  next = { ...next, ...extra };
  return next;
}

/** snakeRev 9 checkpoint extras: every feature's state, in a fixed order. */
function snakeV9Fold(state: SnakeState): number[] {
  return [
    state.cols ?? 0, state.gold ?? -1, state.goldEnd ?? 0, state.goldAt ?? 0, state.goldsEaten ?? 0, state.goldPts ?? 0,
    state.lastStar ?? 0, state.combo ?? 0, state.comboPts ?? 0, state.laneRun ?? 0, state.laneCells ?? 0,
    state.warpsUsed ?? 0, state.lastWarp ?? 0, state.warpPts ?? 0,
  ];
}

/** snakeRev 9's feature points, each capped (SNAKE_V9_CAPS). */
export function snakeV9Bonus(state: SnakeState): { gold: number; combo: number; lane: number; warp: number; total: number } {
  // snakeRev 11: the standard's feature parts.
  if (state.std) {
    const p = snakeStdParts(state);
    return { gold: p.gold, combo: p.combo, lane: p.lane, warp: p.warp, total: p.gold + p.combo + p.lane + p.warp };
  }
  const gold = Math.min(SNAKE_V9_CAPS.gold, state.goldPts ?? 0);
  const combo = Math.min(SNAKE_V9_CAPS.combo, state.comboPts ?? 0);
  const lane = Math.min(SNAKE_V9_CAPS.lane, Math.trunc((state.laneCells ?? 0) / SNAKE_LANE_PER));
  const warp = Math.min(SNAKE_V9_CAPS.warp, state.warpPts ?? 0);
  return { gold, combo, lane, warp, total: gold + combo + lane + warp };
}

/**
 * snakeRev 9 band knots: stars eaten on the bigger field, fitted so the simulated players who ignore
 * the features land where they did on snakeRev 8 (scripts/expansions-e2-bands.ts); 150 at the top.
 */
export const SNAKE_V9_BAND_CURVE = bandCurve([0, 8, 16, 21, 24, 27, 31], [0, 35, 76, 98, 120, 138, 150]);

export function snakeV9Parts(state: SnakeState): BandParts {
  if (state.std) return snakeStdBandParts(state);
  const units = Math.max(0, state.eaten);
  const b = snakeV9Bonus(state);
  const bits = [b.gold && `gold ${b.gold}`, b.combo && `combo ${b.combo}`, b.lane && `lanes ${b.lane}`, b.warp && `warps ${b.warp}`].filter(Boolean);
  const points = bandPoints(SNAKE_V9_BAND_CURVE, units);
  // snakeRev 10: a played run that crashed before its first star and earned no bonus still scores SNAKE_V10_PLAYED_MIN
  // (bandTotal keeps a run with no input at 0).
  if (state.bigRocks && points + b.total === 0) return { units, points, bonus: SNAKE_V10_PLAYED_MIN, penalty: 0, finished: false, text: `${units} stars`, bonusText: "Run played" };
  return { units, points, bonus: b.total, penalty: 0, finished: false, text: `${units} stars`, bonusText: `Skill bonus (${bits.join(" · ")})` };
}

export const snakeV9Game: ArcadeGame<SnakeState, ArcadeInputEvent | null> = {
  ...snakeGame,
  init: initV9,
  score: (state) => bandTotal(snakeV9Parts(state), Boolean(state.acted), SNAKE_V9_MAX),
};

/* ================= Joe's phone notes (snakeRev 10, 27 Oct 2026) ================= */

/**
 * snakeRev 10 (docs/phone-notes-oct-2026/snake.md): snakeRev 9's world and scoring with four changes, all
 * drawn once from the room seed after everything snakeRev 9 draws (so its stars, rocks, shower, lanes,
 * wormholes and gold schedule are exactly snakeRev 9's), the same for every player:
 *
 *  - Gold comet stars stay 5 s (was 3.5 s); a gold star's worth still runs 5 → 1 over its first 3.5 s, and the
 *    extra 1.5 s pays 1 (snakeGoldWorth).
 *  - A third wormhole pair (green), one mouth in the top-left part of the field and one in the bottom-right.
 *  - A second vertical speed lane, at least 4 columns from the first, clear of every mouth.
 *  - SNAKE_V10_BIG_ROCKS of the room's rock slots (seeded) are 2 × 2 rocks: the slot's square plus three
 *    beside it, none on a star, gold star, mouth, shower square or the border, none touching another rock.
 *    Like every rock, one lands only for a meteor that has earned a rock, it counts as one rock, its shadow
 *    shows on all four squares, and the head may not enter (or be under) any of them; the body passes.
 *
 * Scored as snakeRev 9 (SNAKE_V9_BAND_CURVE to 150, the same feature caps, 200 at most), except that a played run
 * which crashed before its first star with no bonus scores SNAKE_V10_PLAYED_MIN (1) instead of 0.
 */
export const SNAKE_REV_10 = 10;
export const SNAKE_V10_GOLD_LIFE = 5 * TICKS_PER_SECOND;
export const SNAKE_V10_BIG_ROCKS = 5;
/** snakeRev 10: the least a played run scores (Joe's bar: anyone who plays scores above 0); no input still scores 0. */
export const SNAKE_V10_PLAYED_MIN = 1;

/** The squares a rock covers: its own, or (snakeRev 10's 2 × 2 rocks) its block's four. */
export function snakeRockSpan(state: { bigRocks?: number[]; cols?: number }, rock: number): number[] {
  if (!state.bigRocks || !state.bigRocks.includes(rock)) return [rock];
  const cols = snakeColsOf(state);
  return [rock, rock + 1, rock + cols, rock + cols + 1];
}

/** Whether a rock (or a falling rock's square) is one of snakeRev 10's 2 × 2 rocks. */
export function snakeRockBig(state: { bigRocks?: number[] }, rock: number): boolean {
  return Boolean(state.bigRocks?.includes(rock));
}

/** Every square a landed rock covers (the landed rocks themselves on rounds before snakeRev 10). */
export function snakeRockCells(state: SnakeState): number[] {
  const rocks = state.rocks ?? [];
  if (!state.bigRocks) return rocks;
  return rocks.flatMap((rock) => snakeRockSpan(state, rock));
}

/** Every square a falling rock (or the shower) will cover when it lands. */
export function snakeWarnCells(state: SnakeState): number[] {
  const out = (state.rockWarn ?? -1) >= 0 ? snakeRockSpan(state, state.rockWarn!) : [];
  return [...out, ...(state.showerWarn ?? [])];
}

function initV10(seed: number): SnakeState {
  const base = initV9(seed);
  const cols = SNAKE_V9_COLS;
  const rows = SNAKE_V9_ROWS;
  let rng = base.rng;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const rowOf = (c: number) => snakeRow(c, cols);
  const colOf = (c: number) => snakeCol(c, cols);
  const touching = (a: number, b: number) => Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
  const stars = new Set(base.queue);
  const warps = [...(base.warps ?? [])];
  const goldCells = new Set((base.golds ?? []).map((g) => g.cell));
  const shower = base.showerCells ?? [];
  // The second vertical lane: 4+ columns from the first, off the start column, through no mouth.
  const mouthCols = new Set(warps.map(colOf));
  let laneCol2 = -1;
  for (let attempt = 0; attempt < 64 && laneCol2 < 0; attempt++) {
    const c = 3 + draw(cols - 6);
    if (Math.abs(c - (base.laneCol ?? -99)) >= 4 && c !== cols >> 1 && !mouthCols.has(c)) laneCol2 = c;
  }
  // The 2 × 2 rocks: SNAKE_V10_BIG_ROCKS slots (from the second on), each grown round its square where it fits.
  const slots = (base.rockSlots ?? []).map((slot) => ({ ...slot }));
  const order = slots.map((_, i) => i).slice(1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const bigRocks: number[] = [];
  const blocks = new Map<number, number[]>();
  const cellsOf = (i: number) => blocks.get(i) ?? [slots[i]!.cell];
  for (const i of order) {
    if (bigRocks.length >= SNAKE_V10_BIG_ROCKS) break;
    const cell = slots[i]!.cell;
    const turn = draw(4);
    for (let k = 0; k < 4; k++) {
      const o = (turn + k) & 3;
      const anchor = cell - (o & 1) - (o >> 1) * cols;
      const r0 = rowOf(anchor);
      const c0 = colOf(anchor);
      if (r0 < 1 || c0 < 1 || r0 + 1 > rows - 2 || c0 + 1 > cols - 2) continue;
      const block = [anchor, anchor + 1, anchor + cols, anchor + cols + 1];
      const clear = block.every(
        (b) =>
          !stars.has(b) && !goldCells.has(b) && !warps.includes(b) && !shower.some((s) => touching(s, b)) &&
          slots.every((_, j) => j === i || cellsOf(j).every((o2) => !touching(o2, b))),
      );
      if (!clear) continue;
      slots[i] = { ...slots[i]!, cell: anchor };
      blocks.set(i, block);
      bigRocks.push(anchor);
      break;
    }
  }
  const rockCells = new Set([...slots.flatMap((_, i) => cellsOf(i)), ...shower]);
  // The third wormhole pair: top-left part ↔ bottom-right part, 2+ squares off the border, clear of
  // stars, gold stars, rocks, every lane and the other mouths.
  const free = (cell: number, taken: number[]) => {
    const r = rowOf(cell);
    const c = colOf(cell);
    if (stars.has(cell) || goldCells.has(cell) || rockCells.has(cell) || r === base.laneRow || c === base.laneCol || c === laneCol2) return false;
    return !taken.some((t) => Math.abs(rowOf(t) - r) <= 2 && Math.abs(colOf(t) - c) <= 2);
  };
  const pick = (r0: number, r1: number, c0: number, c1: number, taken: number[]) => {
    for (let attempt = 0; attempt < 400; attempt++) {
      const cell = r0 + draw(r1 - r0);
      const at = cell * cols + c0 + draw(c1 - c0);
      if (free(at, taken)) return at;
    }
    return -1;
  };
  const half = rows >> 1;
  const a = pick(2, half - 2, 2, (cols >> 1) - 1, warps);
  const b = a >= 0 ? pick(half + 2, rows - 2, (cols >> 1) + 2, cols - 2, [...warps, a]) : -1;
  return {
    ...base,
    rng,
    rockSlots: slots,
    bigRocks,
    ...(laneCol2 >= 0 ? { laneCol2 } : {}),
    goldLife: SNAKE_V10_GOLD_LIFE,
    warps: a >= 0 && b >= 0 && warps.length === 4 ? [...warps, a, b] : warps,
  };
}

export const snakeV10Game: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeV9Game, init: initV10 };

/* ================= The arcade scoring standard (snakeRev 11, 29 Oct 2026) ================= */

/**
 * snakeRev 11 (docs/arcade-standard-oct-2026/snake.md): snakeRev 10's world and play exactly (the same stars, rocks,
 * shower, lanes, wormholes and gold schedule, drawn the same way from the room seed), scored to the arcade standard:
 * straight-line parts with fixed maxima that add up to 200.
 *
 *  - Core, up to 120: stars eaten, a straight line, 120 × stars ÷ SNAKE_STD_CORE_STARS (full at that many).
 *  - Gold stars, up to 40: the run deals `golds.length` gold stars (7 on every seed: the snakeRev 9 schedule), each
 *    worth up to 40 ÷ that count, falling in a straight line from its full worth on the first tick it can be eaten to
 *    0 as it fades (snakeStdGoldPoints, from the sum of ticks left; rounded down once, on the total).
 *  - Combos, up to 20: a star eaten within SNAKE_STD_COMBO_TICKS (3 s) of the last raises the combo; from the third in
 *    a row each star scores 1.
 *  - Lane rides, up to 10: a ride along a speed lane that reaches SNAKE_STD_LANE_RIDE squares in a row scores
 *    SNAKE_STD_LANE_POINTS, once per ride.
 *  - Warp stars, up to 10: a star eaten within SNAKE_STD_WARP_TICKS (2 s) of a wormhole trip scores 2.
 *
 * A crash ends the run, as before. Any played run scores at least 1; no input scores 0. States add `std: 1`, `goldLeft`
 * and `laneRides`, folded into the checkpoint checksum last.
 */
export const SNAKE_REV_STD = 11;
export const SNAKE_STD_CORE_MAX = 120;
/**
 * Stars for the full core: the near-perfect level's median (27 on 100 room seeds, scripts/arcade-skill-bands.ts). The first target, 22,
 * was the great level's median, so great players would have filled the core; docs/arcade-standard-oct-2026/snake.md.
 */
export const SNAKE_STD_CORE_STARS = 27;
export const SNAKE_STD_CAPS = { gold: 40, combo: 20, lane: 10, warp: 10 } as const;
/** Gold stars a run deals: the snakeRev 9 gold schedule fits 7 in the 60 s run (8 s, then about every 7 s) on every seed, so each is worth up to 40 ÷ 7. */
export const SNAKE_STD_GOLDS = 7;
export const SNAKE_STD_COMBO_TICKS = 3 * TICKS_PER_SECOND;
export const SNAKE_STD_COMBO_FROM = 3;
export const SNAKE_STD_WARP_TICKS = 2 * TICKS_PER_SECOND;
export const SNAKE_STD_WARP_POINTS = 2;
export const SNAKE_STD_LANE_RIDE = 10;
export const SNAKE_STD_LANE_POINTS = 1;
export const SNAKE_STD_MAX = 200;
export const SNAKE_STD_PLAYED_MIN = 1;
/** The core as a band curve (a straight line, two knots), for the "?" help (liveBands.ts); snakeStdCore is the same line. */
export const SNAKE_V11_BAND_CURVE = bandCurve([0, SNAKE_STD_CORE_STARS], [0, SNAKE_STD_CORE_MAX]);

/** Gold stars' points from the sum of ticks left on eating: 40 × left ÷ (count × life), rounded down, at most 40. */
export function snakeStdGoldPoints(goldLeft: number, count: number, life: number): number {
  if (count <= 0 || life <= 0) return 0;
  return Math.min(SNAKE_STD_CAPS.gold, Math.trunc((SNAKE_STD_CAPS.gold * goldLeft) / (count * life)));
}

/** One gold star's worth (exact, for texts and bots) if eaten on `tick`. */
export function snakeStdGoldWorth(tick: number, end: number, count: number, life: number): number {
  if (count <= 0) return 0;
  return (SNAKE_STD_CAPS.gold * clampInt(end - tick + 1, 0, life)) / (count * life);
}

/** Core points for this many stars: the straight line to SNAKE_STD_CORE_MAX at SNAKE_STD_CORE_STARS. */
export function snakeStdCore(eaten: number): number {
  return Math.trunc((SNAKE_STD_CORE_MAX * clampInt(eaten, 0, SNAKE_STD_CORE_STARS)) / SNAKE_STD_CORE_STARS);
}

export interface SnakeStdParts {
  core: number;
  gold: number;
  combo: number;
  lane: number;
  warp: number;
}

/** snakeRev 11's parts, each within its maximum. */
export function snakeStdParts(state: SnakeState): SnakeStdParts {
  return {
    core: snakeStdCore(state.eaten),
    gold: snakeStdGoldPoints(state.goldLeft ?? 0, (state.golds ?? []).length, state.goldLife ?? SNAKE_GOLD_LIFE),
    combo: Math.min(SNAKE_STD_CAPS.combo, state.comboPts ?? 0),
    lane: Math.min(SNAKE_STD_CAPS.lane, SNAKE_STD_LANE_POINTS * (state.laneRides ?? 0)),
    warp: Math.min(SNAKE_STD_CAPS.warp, state.warpPts ?? 0),
  };
}

/** snakeRev 11's score: the parts' sum (at most 200), at least 1 for a played run, 0 with no input. */
export function snakeStdScore(state: SnakeState): number {
  if (!state.acted) return 0;
  const p = snakeStdParts(state);
  return clampInt(Math.max(SNAKE_STD_PLAYED_MIN, p.core + p.gold + p.combo + p.lane + p.warp), 0, SNAKE_STD_MAX);
}

function snakeStdBandParts(state: SnakeState): BandParts {
  const p = snakeStdParts(state);
  const bonus = p.gold + p.combo + p.lane + p.warp;
  const units = Math.max(0, state.eaten);
  if (p.core + bonus === 0) return { units, points: 0, bonus: SNAKE_STD_PLAYED_MIN, penalty: 0, finished: false, text: `${units} stars`, bonusText: "Run played" };
  const C = SNAKE_STD_CAPS;
  return {
    units,
    points: p.core,
    bonus,
    penalty: 0,
    finished: false,
    text: `${units} stars (${SNAKE_STD_CORE_MAX} at ${SNAKE_STD_CORE_STARS})`,
    bonusText: `Gold ${p.gold}/${C.gold} · combos ${p.combo}/${C.combo} · lanes ${p.lane}/${C.lane} · warps ${p.warp}/${C.warp}`,
  };
}

function initStd(seed: number): SnakeState {
  return { ...initV10(seed), std: 1, goldLeft: 0, laneRides: 0 };
}

export const snakeStdGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeV10Game, init: initStd, score: snakeStdScore };
