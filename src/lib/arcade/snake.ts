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
export const SNAKE_REV = 2;
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

export interface SnakeState {
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

function init(seed: number): SnakeState {
  let rng = seed | 0;
  const queue: number[] = [];
  for (let slot = 0; slot < SNAKE_QUEUE_LEN; slot++) {
    const drawn = rngBelow(rng, SNAKE_CELLS);
    rng = drawn.state;
    queue.push(drawn.value);
  }
  const col = SNAKE_COLS >> 1;
  const row = SNAKE_ROWS >> 1;
  const body = [cellOf(row, col), cellOf(row + 1, col), cellOf(row + 2, col)];
  const first = pelletFrom(queue, 0, body);
  return {
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
function rockSchedule(rngIn: number, queue: readonly number[]): { rng: number; slots: SnakeRockSlot[] } {
  let rng = rngIn;
  const starCells = new Set(queue);
  const slots: SnakeRockSlot[] = [];
  for (let base = SNAKE_ROCK_SLOT_FIRST; base + SNAKE_ROCK_SLOT_JITTER < SNAKE_RUN_TICKS; base += SNAKE_ROCK_SLOT_EVERY) {
    const jitter = rngBelow(rng, 2 * SNAKE_ROCK_SLOT_JITTER + 1);
    rng = jitter.state;
    let cell = -1;
    for (let attempt = 0; attempt < 64 && cell < 0; attempt++) {
      const drawn = rngBelow(rng, (SNAKE_ROWS - 2) * (SNAKE_COLS - 2));
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

function initRev2(seed: number): SnakeState {
  const base = init(seed);
  const schedule = rockSchedule(base.rng, base.queue);
  return {
    ...base,
    rng: schedule.rng,
    rev: SNAKE_REV,
    rockSlots: schedule.slots,
    rockSlot: 0,
    rocks: [],
    rockWarn: -1,
    rockLandTick: 0,
    rockHit: 0,
  };
}

/** Rocks a meteor of this many stars has earned (length 10, then every 5 stars, at most 8). */
export function snakeRocksEarned(eaten: number): number {
  const length = SNAKE_START_LEN + eaten;
  if (length < SNAKE_ROCK_START_LEN) return 0;
  return Math.min(SNAKE_ROCK_MAX, 1 + Math.trunc((length - SNAKE_ROCK_START_LEN) / SNAKE_ROCK_EVERY));
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
  return state.rev === SNAKE_REV ? stepRev2(state, input) : stepV1(state, input);
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
  if (row < 0 || row >= SNAKE_ROWS || col < 0 || col >= SNAKE_COLS) {
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
    const inside = row >= 0 && row < SNAKE_ROWS && col >= 0 && col < SNAKE_COLS;
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
    if (warn < 0 && snakeRocksEarned(next.eaten) > landed.length) {
      warn = due.cell;
      landTick = due.tick;
    }
  }
  next = { ...next, rocks: landed, rockSlot: slot, rockWarn: warn, rockLandTick: landTick };
  return next;
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
  const extra = state.rev === SNAKE_REV ? [state.rockSlot ?? 0, state.rockWarn ?? -1, ...(state.rocks ?? [])] : [];
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
  const scale = Math.min(size.width / SNAKE_WORLD_W, size.height / SNAKE_WORLD_H);
  const offsetX = (size.width - SNAKE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SNAKE_WORLD_H * scale) / 2;

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
    ctx.lineTo(x, SNAKE_BOARD_Y + SNAKE_BOARD_H);
    ctx.stroke();
  }
  for (let row = 0; row <= SNAKE_ROWS; row++) {
    const y = SNAKE_BOARD_Y + row * SNAKE_CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(SNAKE_BOARD_X, y);
    ctx.lineTo(SNAKE_BOARD_X + SNAKE_BOARD_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.strokeRect(SNAKE_BOARD_X + 0.5, SNAKE_BOARD_Y + 0.5, SNAKE_BOARD_W - 1, SNAKE_BOARD_H - 1);

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
    ctx.fillRect(0, 0, SNAKE_WORLD_W, SNAKE_WORLD_H);
  }

  ctx.restore();
}

export const snakeGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = {
  key: "snake",
  runTicks: SNAKE_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: SNAKE_INPUT_RANGES,
};

/** snakeRev 2 (asteroids). Same step and score; init adds the room's rock schedule. */
export const snakeRev2Game: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeGame, init: initRev2 };

/** The game for a stored round: its snakeRev picks the rules (absent = original). */
export function snakeGameFor(rev?: number | null): ArcadeGame<SnakeState, ArcadeInputEvent | null> {
  return rev === SNAKE_REV ? snakeRev2Game : snakeGame;
}
