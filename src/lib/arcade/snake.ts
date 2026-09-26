/**
 * Snake — an arcade game on the shared engine.
 *
 * A 15×20 grid. The snake steps one cell every few ticks, eats the pellet in
 * front of it and grows. The pellet positions come from a fixed queue built at
 * init, so everyone eats the same food in the same order. Every value in the
 * state is an integer and nothing draws fresh randomness during play.
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
  for (const value of Object.values(snapshot)) {
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
  ctx.fillText(`Pellets ${state.eaten}`, 14, 14);
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
