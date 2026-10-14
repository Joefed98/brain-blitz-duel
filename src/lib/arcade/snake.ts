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
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";

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

function cellOf(row: number, col: number): number {
  return row * SNAKE_COLS + col;
}

export function snakeRow(cell: number): number {
  return Math.trunc(cell / SNAKE_COLS);
}

export function snakeCol(cell: number): number {
  return cell % SNAKE_COLS;
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

function init(seed: number, rows: number = SNAKE_ROWS): SnakeState {
  let rng = seed | 0;
  const queue: number[] = [];
  for (let slot = 0; slot < SNAKE_QUEUE_LEN; slot++) {
    const drawn = rngBelow(rng, rows * SNAKE_COLS);
    rng = drawn.state;
    queue.push(drawn.value);
  }
  const col = SNAKE_COLS >> 1;
  const row = rows >> 1;
  const body = [cellOf(row, col), cellOf(row + 1, col), cellOf(row + 2, col)];
  const first = pelletFrom(queue, 0, body);
  return {
    ...(rows !== SNAKE_ROWS ? { rows } : {}),
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
function rockSchedule(rngIn: number, queue: readonly number[], rows: number = SNAKE_ROWS): { rng: number; slots: SnakeRockSlot[] } {
  let rng = rngIn;
  const starCells = new Set(queue);
  const slots: SnakeRockSlot[] = [];
  for (let base = SNAKE_ROCK_SLOT_FIRST; base + SNAKE_ROCK_SLOT_JITTER < SNAKE_RUN_TICKS; base += SNAKE_ROCK_SLOT_EVERY) {
    const jitter = rngBelow(rng, 2 * SNAKE_ROCK_SLOT_JITTER + 1);
    rng = jitter.state;
    let cell = -1;
    for (let attempt = 0; attempt < 64 && cell < 0; attempt++) {
      const drawn = rngBelow(rng, (rows - 2) * (SNAKE_COLS - 2));
      rng = drawn.state;
      const row = 1 + Math.trunc(drawn.value / (SNAKE_COLS - 2));
      const col = 1 + (drawn.value % (SNAKE_COLS - 2));
      const candidate = cellOf(row, col);
      if (starCells.has(candidate)) continue;
      const near = slots.some(
        (slot) => Math.abs(snakeRow(slot.cell) - row) <= 1 && Math.abs(snakeCol(slot.cell) - col) <= 1,
      );
      if (!near) cell = candidate;
    }
    if (cell >= 0) slots.push({ cell, tick: base - SNAKE_ROCK_SLOT_JITTER + jitter.value });
  }
  return { rng, slots };
}

function initRev2(seed: number, rows: number = SNAKE_ROWS): SnakeState {
  const base = init(seed, rows);
  const schedule = rockSchedule(base.rng, base.queue, rows);
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
function initRev3(seed: number, rows: number = SNAKE_ROWS): SnakeState {
  const base = initRev2(seed, rows);
  let rng = base.rng;
  const stars = new Set(base.queue);
  const taken = (base.rockSlots ?? []).map((slot) => slot.cell);
  const cells: number[] = [];
  for (let attempt = 0; attempt < 400 && cells.length < SNAKE_SHOWER_ROCKS; attempt++) {
    const drawn = rngBelow(rng, (rows - 2) * (SNAKE_COLS - 2));
    rng = drawn.state;
    const row = 1 + Math.trunc(drawn.value / (SNAKE_COLS - 2));
    const col = 1 + (drawn.value % (SNAKE_COLS - 2));
    const candidate = cellOf(row, col);
    if (stars.has(candidate)) continue;
    const near = [...taken, ...cells].some((cell) => Math.abs(snakeRow(cell) - row) <= 1 && Math.abs(snakeCol(cell) - col) <= 1);
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
  return state.rev === SNAKE_REV2 || state.rev === SNAKE_REV ? stepRev2(state, input) : stepV1(state, input);
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
  if (sinceMove < snakeStepTicks(state.eaten)) {
    const next: SnakeState = { ...state, tick, nextDir, sinceMove };
    if (tick >= SNAKE_RUN_TICKS) return { ...next, endedTick: tick };
    return next;
  }

  const head = state.body[0] ?? 0;
  const row = snakeRow(head) + (nextDir === 0 ? -1 : nextDir === 2 ? 1 : 0);
  const col = snakeCol(head) + (nextDir === 1 ? 1 : nextDir === 3 ? -1 : 0);
  if (row < 0 || row >= snakeRowsOf(state) || col < 0 || col >= SNAKE_COLS) {
    return { ...state, tick, dir: nextDir, nextDir, sinceMove: 0, dead: true, endedTick: tick };
  }

  const target = cellOf(row, col);
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
  const moving = state.sinceMove + 1 >= snakeStepTicks(state.eaten);
  if (moving && rocks.length > 0) {
    const head = state.body[0] ?? 0;
    const row = snakeRow(head) + (nextDir === 0 ? -1 : nextDir === 2 ? 1 : 0);
    const col = snakeCol(head) + (nextDir === 1 ? 1 : nextDir === 3 ? -1 : 0);
    const inside = row >= 0 && row < snakeRowsOf(state) && col >= 0 && col < SNAKE_COLS;
    if (inside && rocks.includes(cellOf(row, col))) {
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
    const hitHead = next.body[0] === warn;
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
  const units = Math.max(0, state.eaten);
  return { units, points: bandPoints(state.tunef ? SNAKE_V6_BAND_CURVE : state.rows ? SNAKE_V5_BAND_CURVE : SNAKE_BAND_CURVE, units), bonus: 0, penalty: 0, finished: false, text: `${units} stars` };
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
  return rev === SNAKE_REV_TALL || rev === SNAKE_REV_ROCKS ? SNAKE_TALL_H : SNAKE_WORLD_H;
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
