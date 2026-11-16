/**
 * Bubble Pop — an arcade game on the shared engine.
 *
 * The hanging field and the whole 120-bubble queue are built from the seed at
 * init, so everyone shoots the same colours at the same field. Shots arrive as
 * the shared drag-aim release (kind 2, a = vx, b = vy) and the flight, the
 * sticking cell, the pops and the drops are all integer arithmetic.
 *
 * bubbleRev 2 (stamped on the puzzle) places special bubbles in the same fixed
 * queue, at seeded slots, replacing those slots' colours (every other queue
 * entry and the field are unchanged):
 *  - Joker (BUB_JOKER): matches whatever colour it touches. It joins every
 *    touching colour group and pops each one that reaches three with it; if none
 *    does, it stays as the colour of the biggest group it touches.
 *  - Bomb (BUB_BOMB): bursts where it lands, clearing every bubble within two
 *    cells.
 *  - Torpedo (BUB_LINE): clears the whole row it lands in.
 * Specials never stay on the field and never appear in it at the start.
 *
 * bubbleRev 4 (BUB_REV_TORPEDO, Tuning F) changes only the Torpedo: it never
 * lands. It flies like any shot (same aim, speed and wall bounces) and, once it
 * touches the field, keeps going in the direction it points, destroying each
 * bubble it touches (the same contact distance a shot sticks at) until it has
 * destroyed BUB_TORPEDO_HITS bubbles, reaches the top row's line or empties
 * the field. Then bubbles no longer held from the top drop, as after any pop.
 */

import {
  clampInt,
  finishScore,
  inputRange,
  rngBelow,
  setLength,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { speedBonusCurve } from "../duel/speedPar";
import { stdEach, stdLine, stdPart, stdScore, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandTop, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const BUB_WORLD_W = 390;
export const BUB_WORLD_H = 620;
export const BUB_HUD_H = 64;

export const BUB_RUN_SECONDS = 90;
export const BUB_RUN_TICKS = BUB_RUN_SECONDS * TICKS_PER_SECOND;

/** The same drag-aim release kind Bullseye uses. */
export const BUB_INPUT_SHOT = 2;

export const BUB_D = 34;
export const BUB_R = 17;
export const BUB_COLS = 10;
export const BUB_MAX_ROWS = 18;
export const BUB_START_ROWS = 7;
export const BUB_COLOUR_COUNT = 5;
/**
 * The sixth colour's value (bubbleRev 12's Expert level only): 6, 7 and 8 are the specials and 9 the chest, so the
 * sixth colour is 10. Every other reef holds colours 1…5 only.
 */
export const BUB_SIXTH = 10;
/** Every colour value, in order (the sixth last). */
export const BUB_ALL_COLOURS: readonly number[] = [1, 2, 3, 4, 5, BUB_SIXTH];
/** The colour value for colour index i (0…5): 1…5, then BUB_SIXTH. */
export function bubColourValue(i: number): number {
  return i < BUB_COLOUR_COUNT ? i + 1 : BUB_SIXTH;
}
/** Whether a grid or queue value is a colour (not empty, a special or a chest). */
export function bubIsColour(v: number): boolean {
  return (v >= 1 && v <= BUB_COLOUR_COUNT) || v === BUB_SIXTH;
}
/** A level's reef (bubbleRev 12, stage 3): its colour count and exact bubble count (chests included). */
export interface BubReefLook {
  colours: number;
  count: number;
}
/** Rows a reef of `count` bubbles spans (rows of 10 and 9 alternating, the last part-filled). */
export function bubReefRows(count: number): number {
  let rows = 0;
  for (let left = count; left > 0; rows++) left -= rows % 2 === 0 ? BUB_COLS : BUB_COLS - 1;
  return rows;
}
/** Full rows in a reef of `count` bubbles. */
export function bubReefFullRows(count: number): number {
  let rows = 0;
  for (let left = count; left >= (rows % 2 === 0 ? BUB_COLS : BUB_COLS - 1); rows++) left -= rows % 2 === 0 ? BUB_COLS : BUB_COLS - 1;
  return rows;
}

/** Rows are packed hex-style: 29 px apart, odd rows shifted half a bubble. */
export const BUB_ROW_H = 29;
export const BUB_LEFT = (BUB_WORLD_W - BUB_COLS * BUB_D) / 2;
export const BUB_TOP = BUB_HUD_H + 8;
export const BUB_WALL = BUB_LEFT;

export const BUB_SHOOTER_X = BUB_WORLD_W / 2;
export const BUB_SHOOTER_Y = 560;
export const BUB_SHOOTER_LINE = BUB_SHOOTER_Y - BUB_R;

/** Flight speed, in 1/256 px a tick: 6 px a tick. */
export const BUB_SPEED = 1536;
/** Aim payload bound, matching the shared drag-aim launch scale. */
export const BUB_V_MAX = 4096;

export const BUB_QUEUE = 120;
export const BUB_DESCEND_EVERY = 8;
export const BUB_MIN_GROUP = 3;

/** Par: popped + 2 x dropped = 90. */
/** Cleared = 130 + round(20 × ticks left ÷ run); otherwise round(130 × bubbles removed ÷ bubbles at start), 0…130. */

/** Rule revision stamped on new rounds (puzzle.bubbleRev); absent = original rules. */
export const BUB_REV = 2;
/** Special queue values (bubbleRev 2); colours stay 1…5. */
export const BUB_JOKER = 6;
export const BUB_BOMB = 7;
export const BUB_LINE = 8;
/** One Joker in each block of 15 shots, from shot 6; one Bomb and one Torpedo in each block of 60. */
export const BUB_JOKER_BLOCK = 15;
export const BUB_SPECIAL_BLOCK = 60;
export const BUB_SPECIAL_FROM = 5;
/** A Bomb clears every bubble within this many hex steps of where it lands (its neighbours). */
export const BUB_BOMB_RADIUS = 1;
/**
 * bubbleRev 2 rebalance: a part-cleared field scores up to this share instead of
 * 130 (a full clear still scores 130 + speed). Specials clear far more bubbles;
 * a full-knowledge shot bot averaged 72 on the original rules, 105+ on rev 2 at
 * 130, and 78 at 100 (scripts/arcade-batch2-check.ts measures it).
 */
export const BUB_V2_PARTIAL = 100;
/** The most a part-cleared rev-2 field can score (one bubble left on the fixed-size field). */
export const BUB_V2_PARTIAL_MAX = 99;

export function bubIsSpecial(value: number): boolean {
  return value === BUB_JOKER || value === BUB_BOMB || value === BUB_LINE;
}

export const BUB_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BUB_INPUT_SHOT, [-BUB_V_MAX, BUB_V_MAX], [-BUB_V_MAX, 0]),
];

/** How many cells a row holds: odd rows are shifted and hold one fewer. */
export function bubRowCols(row: number): number {
  return row % 2 === 0 ? BUB_COLS : BUB_COLS - 1;
}

export function bubCellX(row: number, col: number): number {
  return BUB_LEFT + BUB_R + col * BUB_D + (row % 2 === 0 ? 0 : BUB_R);
}

export function bubCellY(row: number, descents: number): number {
  return BUB_TOP + BUB_R + (row + descents) * BUB_ROW_H;
}

/* ================================ State ================================ */

export interface BubState extends BandFields {
  tick: number;
  rng: number;
  /** BUB_MAX_ROWS × BUB_COLS, 0 empty, otherwise a colour 1…5. */
  grid: number[];
  queue: number[];
  queueAt: number;
  descents: number;
  shots: number;
  popped: number;
  dropped: number;
  /** The bubble in flight, in 1/256 px; colour 0 means nothing is flying. */
  flightColour: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cleared: boolean;
  dead: boolean;
  endedTick: number;
  /** Bubbles on the field at the start of the run. */
  startCount: number;
  /** bubbleRev 2 only; absent on unstamped rounds. */
  rev?: number;
  /** Specials that went off: Jokers that popped something, Bombs and Torpedoes that cleared something. */
  jokers?: number;
  bombs?: number;
  lines?: number;
  /** The last special's landing cell and what it cleared, for the art only. */
  lastSpecial?: number;
  lastSpecialCell?: number;
  lastSpecialCleared?: number;
  /** bubbleRev 4 only (absent otherwise): the torpedo rule revision, and bubbles the torpedo in flight has destroyed so far. */
  lineRev?: number;
  drilled?: number;
  /** bubbleRev 5 only (taller worlds batch 2): the tank's height in px (BUB_TALL_H). Absent = BUB_WORLD_H. */
  worldH?: number;
  /**
   * bubbleRev 8 only (absent otherwise): the deeper reef's mark, treasure chests dropped, bank shots (a shot
   * off a wall that removed bubbles), combo shots (each back-to-back removing shot after the first), the pop
   * streak now and at best, the shot in flight's wall bounces, and the removed count when it was fired.
   */
  reef?: number;
  /** bubbleRev 9: base units credit a quarter of the bubbles burst or dropped (bubbleReefParts). */
  credit?: number;
  /** bubbleRev 10 only (phone notes, 27 Oct 2026): the mine's blast radius in hex rings (BUB_V10_BOMB_RADIUS). Absent = BUB_BOMB_RADIUS. */
  bombR?: number;
  /**
   * bubbleRev 11 only (the arcade scoring standard, 29 Oct 2026): the mine pops this many bubbles, those nearest
   * where it lands (BUB_V11_MINE_POPS), and `std` marks a state scored on the standard (BUB_V11_STD_SPEC).
   */
  minePops?: number;
  std?: number;
  chests?: number;
  banks?: number;
  combos?: number;
  streak?: number;
  bestStreak?: number;
  bounce?: number;
  shotBase?: number;
  /** bubbleRev 12 only (absent otherwise): the fast-shot rule's mark, and the shot in flight's extra flight steps a tick (0–2). */
  fast?: number;
  /**
   * bubbleRev 12's levels only (stage 3; absent at Normal, which is today's game exactly): the level's code
   * (BUB_LEVEL_CODE), the shots between descents, the colour count (3–6), and the aim trail's reach (display only,
   * outside the checksum: 2 two bounces, 1 one bounce, 0 a short trail).
   */
  lv?: number;
  every?: number;
  colours?: number;
  trail?: number;
  /** A level's bank shots for the full bank-shot part (scoring only; Normal: 30, BUB_V11_BANK_PER × BUB_V11_BANK_MAX). */
  banksFull?: number;
  /** A level's bubbles cleared for the full core (scoring only; Normal: the whole reef). */
  coreFull?: number;
  /** A level's ticks left at the clear for the full speed part (scoring only; Normal: half the clock). */
  speedFullLeft?: number;
  boost?: number;
}

function cellIndex(row: number, col: number): number {
  return row * BUB_COLS + col;
}

function init(seed: number, startRows = BUB_START_ROWS, maxRows = BUB_MAX_ROWS, look?: BubReefLook): BubState {
  let rng = seed | 0;
  const grid = new Array<number>(maxRows * BUB_COLS).fill(0);
  // Levels (bubbleRev 12, stage 3): `look` sets the colour count and the reef's exact bubble count (the last row
  // part-filled, centred). Without it (every revision and Normal) the draws are exactly as before.
  const colours = look?.colours ?? BUB_COLOUR_COUNT;
  let placedSoFar = 0;
  for (let row = 0; row < startRows; row++) {
    const cols = bubRowCols(row);
    const placed = look ? Math.max(0, Math.min(cols, look.count - placedSoFar)) : cols;
    const from = look ? Math.floor((cols - placed) / 2) : 0;
    placedSoFar += placed;
    for (let col = from; col < from + placed; col++) {
      const draw = rngBelow(rng, colours);
      rng = draw.state;
      const index = cellIndex(row, col);
      // Try every colour deterministically; accepting only groups of at most five
      // also catches a new bubble joining several previously separate groups.
      for (let offset = 0; offset < colours; offset++) {
        grid[index] = bubColourValue((draw.value + offset) % colours);
        if (colourGroup(grid, index).length <= 5) break;
      }
    }
  }
  const queue: number[] = [];
  for (let index = 0; index < BUB_QUEUE; index++) {
    const draw = rngBelow(rng, colours);
    rng = draw.state;
    queue.push(bubColourValue(draw.value));
  }
  return {
    tick: 0,
    rng,
    grid,
    queue,
    queueAt: 0,
    descents: 0,
    shots: 0,
    popped: 0,
    dropped: 0,
    flightColour: 0,
    x: BUB_SHOOTER_X * 256,
    y: BUB_SHOOTER_Y * 256,
    vx: 0,
    vy: 0,
    cleared: false,
    dead: false,
    endedTick: 0,
    startCount: grid.filter((cell) => cell !== 0).length,
  };
}

/**
 * bubbleRev 2: the original field and queue, then special slots drawn from the
 * PRNG continuing after the queue. Slots are distinct and every block gets one.
 * bubbleRev 3 (score bands) draws the same way with rarer specials: one Joker
 * in each block of BUB_V3_JOKER_BLOCK shots and a single mine or torpedo (its
 * kind drawn too) in the first BUB_SPECIAL_BLOCK shots.
 */
function initRev2(seed: number, v3 = false, reef = false, look?: BubReefLook): BubState {
  // bubbleRev 8: the deeper reef starts with BUB_V8_START_ROWS rows in a BUB_V8_ROWS-row field.
  // A level's reef (bubbleRev 12, stage 3) fills the rows its bubble count needs.
  const base = reef ? (look ? init(seed, bubReefRows(look.count), BUB_V8_ROWS, look) : init(seed, BUB_V8_START_ROWS, BUB_V8_ROWS)) : init(seed);
  let rng = base.rng;
  const queue = [...base.queue];
  const used = new Set<number>();
  const place = (value: number, from: number, to: number) => {
    for (let guard = 0; guard < 64; guard++) {
      const drawn = rngBelow(rng, to - from);
      rng = drawn.state;
      const slot = from + drawn.value;
      if (used.has(slot)) continue;
      used.add(slot);
      queue[slot] = value;
      return;
    }
  };
  if (v3) {
    for (let from = BUB_SPECIAL_FROM; from < BUB_QUEUE; from += BUB_V3_JOKER_BLOCK) {
      place(BUB_JOKER, from, Math.min(BUB_QUEUE, from + BUB_V3_JOKER_BLOCK));
    }
    const kind = rngBelow(rng, 2);
    rng = kind.state;
    place(kind.value === 0 ? BUB_BOMB : BUB_LINE, BUB_SPECIAL_FROM, BUB_SPECIAL_FROM + BUB_SPECIAL_BLOCK);
  }
  for (let from = BUB_SPECIAL_FROM; !v3 && from < BUB_QUEUE; from += BUB_JOKER_BLOCK) {
    place(BUB_JOKER, from, Math.min(BUB_QUEUE, from + BUB_JOKER_BLOCK));
  }
  for (let from = BUB_SPECIAL_FROM; !v3 && from < BUB_QUEUE; from += BUB_SPECIAL_BLOCK) {
    const to = Math.min(BUB_QUEUE, from + BUB_SPECIAL_BLOCK);
    place(BUB_BOMB, from, to);
    place(BUB_LINE, from, to);
  }
  return {
    ...base,
    rng,
    queue,
    rev: BUB_REV,
    jokers: 0,
    bombs: 0,
    lines: 0,
    lastSpecial: 0,
    lastSpecialCell: -1,
    lastSpecialCleared: 0,
  };
}

/** Cells within `radius` hex steps of a cell, the cell included. */
function hexArea(start: number, radius: number, rows = BUB_MAX_ROWS): number[] {
  const seen = new Set<number>([start]);
  let frontier = [start];
  for (let ring = 0; ring < radius; ring++) {
    const next: number[] = [];
    for (const index of frontier) {
      for (const [nr, nc] of neighbours(Math.floor(index / BUB_COLS), index % BUB_COLS)) {
        if (!inGrid(nr, nc, rows)) continue;
        const cell = cellIndex(nr, nc);
        if (seen.has(cell)) continue;
        seen.add(cell);
        next.push(cell);
      }
    }
    frontier = next;
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * bubbleRev 2: a special has just landed on `landed` (grid holds its value).
 * Returns the cells it clears (field bubbles only; the special itself is never
 * counted) and the colour a Joker keeps if it pops nothing (0 = removed).
 */
function resolveSpecial(grid: number[], landed: number, kind: number, bombRadius = BUB_BOMB_RADIUS): { cleared: number[]; keep: number } {
  const row = Math.floor(landed / BUB_COLS);
  if (kind === BUB_BOMB) {
    return { cleared: hexArea(landed, bombRadius, bubRowsOf(grid)).filter((i) => i !== landed && grid[i]! > 0), keep: 0 };
  }
  if (kind === BUB_LINE) {
    const cleared: number[] = [];
    for (let col = 0; col < bubRowCols(row); col++) {
      const i = cellIndex(row, col);
      if (i !== landed && grid[i]! > 0) cleared.push(i);
    }
    return { cleared, keep: 0 };
  }
  // Joker: try every colour it touches, in colour order.
  const touching = new Set<number>();
  for (const [nr, nc] of neighbours(row, landed % BUB_COLS)) {
    if (!inGrid(nr, nc, bubRowsOf(grid))) continue;
    const v = grid[cellIndex(nr, nc)]!;
    if (bubIsColour(v)) touching.add(v);
  }
  const popped = new Set<number>();
  let keep = 0;
  let keepSize = 0;
  // In colour order; the sixth colour (BUB_SIXTH, Expert only) last, so a five-colour reef resolves exactly as before.
  for (const colour of BUB_ALL_COLOURS) {
    if (!touching.has(colour)) continue;
    grid[landed] = colour;
    const group = colourGroup(grid, landed);
    if (group.length >= BUB_MIN_GROUP) for (const i of group) if (i !== landed) popped.add(i);
    if (group.length > keepSize) {
      keep = colour;
      keepSize = group.length;
    }
  }
  grid[landed] = kind;
  return { cleared: [...popped].sort((a, b) => a - b), keep: popped.size > 0 ? 0 : keep };
}

function isOver(state: BubState): boolean {
  return state.dead || state.cleared || state.tick >= BUB_RUN_TICKS;
}

export function bubSurvived(state: BubState): boolean {
  return !state.dead && state.tick >= BUB_RUN_TICKS;
}

export function bubNextColour(state: BubState, ahead: number): number {
  return state.queue[state.queueAt + ahead] ?? 0;
}

export function bubOccupied(grid: readonly number[]): number {
  let total = 0;
  for (const value of grid) if (value) total += 1;
  return total;
}

/** The six hex neighbours of a cell, in a fixed order. */
function neighbours(row: number, col: number): Array<[number, number]> {
  const shifted = row % 2 === 1;
  const up = shifted
    ? ([
        [row - 1, col],
        [row - 1, col + 1],
      ] as Array<[number, number]>)
    : ([
        [row - 1, col - 1],
        [row - 1, col],
      ] as Array<[number, number]>);
  const down = shifted
    ? ([
        [row + 1, col],
        [row + 1, col + 1],
      ] as Array<[number, number]>)
    : ([
        [row + 1, col - 1],
        [row + 1, col],
      ] as Array<[number, number]>);
  return [[row, col - 1], [row, col + 1], ...up, ...down];
}

function inGrid(row: number, col: number, rows = BUB_MAX_ROWS): boolean {
  return row >= 0 && row < rows && col >= 0 && col < bubRowCols(row);
}

/** Rows a field holds (BUB_MAX_ROWS on every revision before bubbleRev 8's deeper reef). */
export function bubRowsOf(grid: readonly number[]): number {
  return (grid.length / BUB_COLS) | 0;
}

/** The free cell nearest the ball that touches the ceiling or another bubble. */
function landingCell(
  grid: readonly number[],
  descents: number,
  xPx: number,
  yPx: number,
): number | null {
  let best: number | null = null;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  const rows = bubRowsOf(grid);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const index = cellIndex(row, col);
      if (grid[index]) continue;
      const supported =
        row === 0 ||
        neighbours(row, col).some(([nr, nc]) => inGrid(nr, nc, rows) && grid[cellIndex(nr, nc)]! > 0);
      if (!supported) continue;
      const dx = bubCellX(row, col) - xPx;
      const dy = bubCellY(row, descents) - yPx;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
  }
  return best;
}

/** Same-colour group from a cell, flood filled over the hex neighbours. */
function colourGroup(grid: readonly number[], start: number): number[] {
  const colour = grid[start]!;
  const seen = new Set<number>([start]);
  const stack = [start];
  const group: number[] = [];
  while (stack.length > 0) {
    const index = stack.pop()!;
    group.push(index);
    const row = Math.floor(index / BUB_COLS);
    const col = index % BUB_COLS;
    for (const [nr, nc] of neighbours(row, col)) {
      if (!inGrid(nr, nc, bubRowsOf(grid))) continue;
      const next = cellIndex(nr, nc);
      if (seen.has(next) || grid[next] !== colour) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  group.sort((a, b) => a - b);
  return group;
}

/** Bubbles no longer connected to the top row. */
function unattached(grid: readonly number[]): number[] {
  const held = new Set<number>();
  const stack: number[] = [];
  for (let col = 0; col < bubRowCols(0); col++) {
    const index = cellIndex(0, col);
    if (grid[index]) {
      held.add(index);
      stack.push(index);
    }
  }
  while (stack.length > 0) {
    const index = stack.pop()!;
    const row = Math.floor(index / BUB_COLS);
    const col = index % BUB_COLS;
    for (const [nr, nc] of neighbours(row, col)) {
      if (!inGrid(nr, nc, bubRowsOf(grid))) continue;
      const next = cellIndex(nr, nc);
      if (held.has(next) || !grid[next]) continue;
      held.add(next);
      stack.push(next);
    }
  }
  const loose: number[] = [];
  for (let index = 0; index < grid.length; index++) {
    if (grid[index] && !held.has(index)) loose.push(index);
  }
  return loose;
}

/** True when a bubble has come down past the shooter line. */
function reachedShooter(grid: readonly number[], descents: number, line = BUB_SHOOTER_LINE): boolean {
  for (let row = bubRowsOf(grid) - 1; row >= 0; row--) {
    for (let col = 0; col < bubRowCols(row); col++) {
      if (!grid[cellIndex(row, col)]) continue;
      if (bubCellY(row, descents) + BUB_R >= line) return true;
    }
  }
  return false;
}

function step(state: BubState, input: ArcadeInputEvent | null): BubState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const next: BubState = { ...state, tick };

  // A release starts a shot when nothing is in flight and the queue has bubbles.
  if (
    input &&
    input.k === BUB_INPUT_SHOT &&
    next.flightColour === 0 &&
    input.b < 0 &&
    next.queueAt < next.queue.length
  ) {
    const aimed = setLength(input.a, input.b, bubSpeed(next));
    next.flightColour = next.queue[next.queueAt]!;
    next.queueAt = next.queueAt + 1;
    next.x = BUB_SHOOTER_X * 256;
    next.y = bubShooterY(next) * 256;
    next.vx = aimed.vx;
    next.vy = aimed.vy;
    // bubbleRev 8: each shot counts its own wall bounces and what it removes.
    if (next.reef) {
      next.bounce = 0;
      next.shotBase = next.popped + next.dropped;
    }
  }

  if (next.flightColour === BUB_LINE && next.lineRev === BUB_REV_TORPEDO) {
    torpedoFlight(next);
  } else if (next.flightColour !== 0) {
    let { x, y, vx } = next;
    const vy = next.vy;
    const leftWall = (BUB_WALL + BUB_R) * 256;
    const rightWall = (BUB_WORLD_W - BUB_WALL - BUB_R) * 256;
    let landed: number | null = null;
    let bounces = 0;

    for (let sub = 0; sub < 4 && landed === null; sub++) {
      const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
      const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);
      x += sx;
      y += sy;
      if (x < leftWall) {
        x = leftWall + (leftWall - x);
        vx = -vx;
        bounces++;
      } else if (x > rightWall) {
        x = rightWall - (x - rightWall);
        vx = -vx;
        bounces++;
      }

      const xPx = Math.trunc(x / 256);
      const yPx = Math.trunc(y / 256);
      const ceiling = BUB_TOP + BUB_R + next.descents * BUB_ROW_H;
      let touched = yPx <= ceiling;
      if (!touched) {
        const reach = (BUB_D - 2) * (BUB_D - 2);
        for (let row = 0; row < bubRowsOf(next.grid) && !touched; row++) {
          for (let col = 0; col < bubRowCols(row); col++) {
            if (!next.grid[cellIndex(row, col)]) continue;
            const dx = bubCellX(row, col) - xPx;
            const dy = bubCellY(row, next.descents) - yPx;
            if (dx * dx + dy * dy <= reach) {
              touched = true;
              break;
            }
          }
        }
      }
      if (touched) landed = landingCell(next.grid, next.descents, xPx, yPx);
    }

    next.x = x;
    next.y = y;
    next.vx = vx;
    if (next.reef && bounces) next.bounce = (next.bounce ?? 0) + bounces;

    if (landed !== null && bubIsSpecial(next.flightColour)) {
      // bubbleRev 2 specials (they only ever come from a stamped queue).
      const kind = next.flightColour;
      const grid = [...next.grid];
      grid[landed] = kind;
      next.flightColour = 0;
      next.shots = next.shots + 1;
      // bubbleRev 10: the mine's bigger blast (state.bombR); every earlier stamp keeps BUB_BOMB_RADIUS.
      // bubbleRev 11: the mine pops only the state.minePops bubbles nearest where it lands (bubMineNearest).
      const { cleared, keep } =
        kind === BUB_BOMB && next.minePops ? { cleared: bubMineNearest(grid, landed, next.minePops), keep: 0 } : resolveSpecial(grid, landed, kind, next.bombR ?? BUB_BOMB_RADIUS);
      for (const index of cleared) grid[index] = 0;
      grid[landed] = keep;
      // A Joker that popped groups counts itself among the popped, as a matching shot does.
      next.popped = next.popped + cleared.length + (kind === BUB_JOKER && cleared.length > 0 ? 1 : 0);
      if (cleared.length > 0) {
        if (kind === BUB_JOKER) next.jokers = (next.jokers ?? 0) + 1;
        else if (kind === BUB_BOMB) next.bombs = (next.bombs ?? 0) + 1;
        else next.lines = (next.lines ?? 0) + 1;
      }
      next.lastSpecial = kind;
      next.lastSpecialCell = landed;
      next.lastSpecialCleared = cleared.length;
      dropLoose(next, grid);
      if (next.shots % (next.every ?? BUB_DESCEND_EVERY) === 0) next.descents = next.descents + 1;
      next.grid = grid;
      if (bubOccupied(grid) === 0) next.cleared = true;
      else if (reachedShooter(grid, next.descents, bubDangerLine(next))) next.dead = true;
    } else if (landed !== null) {
      const grid = [...next.grid];
      grid[landed] = next.flightColour;
      next.flightColour = 0;
      next.shots = next.shots + 1;

      const group = colourGroup(grid, landed);
      if (group.length >= BUB_MIN_GROUP) {
        for (const index of group) grid[index] = 0;
        next.popped = next.popped + group.length;
        dropLoose(next, grid);
      }

      if (next.shots % (next.every ?? BUB_DESCEND_EVERY) === 0) next.descents = next.descents + 1;
      next.grid = grid;

      if (bubOccupied(grid) === 0) next.cleared = true;
      else if (reachedShooter(grid, next.descents, bubDangerLine(next))) next.dead = true;
    } else if (Math.trunc(y / 256) > bubWorldH(next) + BUB_D) {
      // Nothing to stick to: the shot is simply spent.
      next.flightColour = 0;
      next.shots = next.shots + 1;
      if (next.shots % (next.every ?? BUB_DESCEND_EVERY) === 0) next.descents = next.descents + 1;
      if (reachedShooter(next.grid, next.descents, bubDangerLine(next))) next.dead = true;
    }
  }

  if (next.reef && next.shots > state.shots) reefShotDone(next);
  if (isOver(next)) next.endedTick = tick;
  return next;
}

/**
 * Drops every bubble no longer held from the top (in place on `grid` and `next`). bubbleRev 8 counts the
 * treasure chests among them: a chest only ever pays here, falling with a cluster.
 */
function dropLoose(next: BubState, grid: number[]): void {
  const loose = unattached(grid);
  if (next.reef) {
    let chests = 0;
    for (const index of loose) if (grid[index] === BUB_CHEST) chests += 1;
    if (chests) next.chests = (next.chests ?? 0) + chests;
  }
  for (const index of loose) grid[index] = 0;
  next.dropped = next.dropped + loose.length;
}

/**
 * bubbleRev 8: a shot has just finished (stuck, special spent or torpedo run over). A shot that removed
 * anything extends the pop streak (each back-to-back pop after the first is a combo) and, if it came off
 * a wall first, counts as a bank shot; a shot that removed nothing ends the streak.
 */
function reefShotDone(next: BubState): void {
  const removed = next.popped + next.dropped - (next.shotBase ?? 0);
  if (removed > 0) {
    const streak = (next.streak ?? 0) + 1;
    next.streak = streak;
    if (streak >= 2) next.combos = (next.combos ?? 0) + 1;
    if (streak > (next.bestStreak ?? 0)) next.bestStreak = streak;
    if ((next.bounce ?? 0) > 0) next.banks = (next.banks ?? 0) + 1;
  } else next.streak = 0;
  next.shotBase = next.popped + next.dropped;
  next.bounce = 0;
}

/**
 * bubbleRev 4: one tick of the Torpedo's run (in place on `next`). It moves
 * exactly as a shot does, in four sub-steps with the same wall bounce, and
 * destroys every bubble within contact distance of it (cell order, up to its
 * remaining hits). It ends at the top row's line, on its last hit, or when the
 * field is empty; then loose bubbles drop and the shot counts as usual.
 */
function torpedoFlight(next: BubState): void {
  let { x, y, vx } = next;
  const vy = next.vy;
  const leftWall = (BUB_WALL + BUB_R) * 256;
  const rightWall = (BUB_WORLD_W - BUB_WALL - BUB_R) * 256;
  const reach = (BUB_D - 2) * (BUB_D - 2);
  const ceiling = BUB_TOP + BUB_R + next.descents * BUB_ROW_H;
  let grid = next.grid;
  let drilled = next.drilled ?? 0;
  let lastHit = drilled > 0 ? next.lastSpecialCell ?? -1 : -1;
  let done = false;
  let bounces = 0;
  for (let sub = 0; sub < 4 && !done; sub++) {
    const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
    const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);
    x += sx;
    y += sy;
    if (x < leftWall) {
      x = leftWall + (leftWall - x);
      vx = -vx;
      bounces++;
    } else if (x > rightWall) {
      x = rightWall - (x - rightWall);
      vx = -vx;
      bounces++;
    }
    const xPx = Math.trunc(x / 256);
    const yPx = Math.trunc(y / 256);
    for (let row = 0; row < bubRowsOf(grid) && drilled < BUB_TORPEDO_HITS; row++) {
      for (let col = 0; col < bubRowCols(row) && drilled < BUB_TORPEDO_HITS; col++) {
        const index = cellIndex(row, col);
        if (!grid[index]) continue;
        const dx = bubCellX(row, col) - xPx;
        const dy = bubCellY(row, next.descents) - yPx;
        if (dx * dx + dy * dy > reach) continue;
        if (grid === next.grid) grid = [...grid];
        grid[index] = 0;
        drilled += 1;
        lastHit = index;
      }
    }
    done = yPx <= ceiling || drilled >= BUB_TORPEDO_HITS || bubOccupied(grid) === 0;
  }
  next.popped = next.popped + (drilled - (next.drilled ?? 0));
  next.x = x;
  next.y = y;
  next.vx = vx;
  next.drilled = drilled;
  next.lastSpecialCell = lastHit;
  if (next.reef && bounces) next.bounce = (next.bounce ?? 0) + bounces;
  if (!done) {
    next.grid = grid;
    return;
  }
  grid = [...grid];
  next.flightColour = 0;
  next.shots = next.shots + 1;
  if (drilled > 0) next.lines = (next.lines ?? 0) + 1;
  next.lastSpecial = BUB_LINE;
  next.lastSpecialCleared = drilled;
  next.drilled = 0;
  dropLoose(next, grid);
  if (next.shots % (next.every ?? BUB_DESCEND_EVERY) === 0) next.descents = next.descents + 1;
  next.grid = grid;
  if (bubOccupied(grid) === 0) next.cleared = true;
  else if (reachedShooter(grid, next.descents, bubDangerLine(next))) next.dead = true;
}

function score(state: BubState): number {
  if (state.cleared) return finishScore(BUB_RUN_TICKS, state.endedTick);
  const start = Math.max(1, state.startCount);
  // bubbleRev 2 rebalance: specials clear far more, so a part-cleared field earns up to BUB_V2_PARTIAL instead of 130.
  const partial = state.rev === BUB_REV ? BUB_V2_PARTIAL : 130;
  return clampInt(Math.round((partial * (start - bubRemaining(state))) / start), 0, partial);
}

/** Bubbles still on the field. */
export function bubRemaining(state: BubState): number {
  let count = 0;
  for (const cell of state.grid) if (cell !== 0) count += 1;
  return count;
}

/* ============================= Checkpoints ============================= */

export const BUB_CHECKPOINT_INTERVAL = 300;

export interface BubCheckpointState {
  tick: number;
  shots: number;
  popped: number;
  dropped: number;
  descents: number;
  occupied: number;
  gridFold: number;
  x: number;
  y: number;
  flightColour: number;
}

export interface BubCheckpoint extends BubCheckpointState {
  checksum: number;
}

export function bubCheckpointState(state: BubState): BubCheckpointState {
  let gridFold = 0;
  for (let index = 0; index < state.grid.length; index++) {
    gridFold = (gridFold + (index + 1) * state.grid[index]!) | 0;
  }
  return {
    tick: state.tick,
    shots: state.shots,
    popped: state.popped,
    dropped: state.dropped,
    descents: state.descents,
    occupied: bubOccupied(state.grid),
    gridFold,
    x: state.x,
    y: state.y,
    flightColour: state.flightColour,
  };
}

export function bubCheckpoint(state: BubState): BubCheckpoint {
  const snapshot = bubCheckpointState(state);
  let checksum = 0x811c9dc5;
  // bubbleRev 2 folds its special counters into the checksum; the encoded fields stay the same.
  const extra = state.rev === BUB_REV ? [state.jokers ?? 0, state.bombs ?? 0, state.lines ?? 0, state.queueAt] : [];
  // bubbleRev 4 folds the torpedo's rule revision and its hits so far in last.
  if (state.lineRev !== undefined) extra.push(state.lineRev, state.drilled ?? 0);
  // bubbleRev 5 (taller worlds): the tank's height, last.
  if (state.worldH) extra.push(state.worldH);
  // bubbleRev 8 (the deeper reef): its feature counters, last.
  if (state.reef) extra.push(state.reef, state.chests ?? 0, state.banks ?? 0, state.combos ?? 0, state.streak ?? 0, state.bounce ?? 0);
  // bubbleRev 10 (phone notes): the mine's blast radius, last.
  if (state.bombR) extra.push(state.bombR);
  // bubbleRev 11 (the arcade scoring standard): the mine's pop count, last.
  if (state.minePops) extra.push(state.minePops);
  // bubbleRev 12 (the Strategy overhaul): the fast-shot mark and the shot in flight's level, last.
  if (state.fast) extra.push(state.fast, state.boost ?? 0);
  // bubbleRev 12's levels (stage 3): the level, its descent cadence and its colour count, last (Normal carries none).
  if (state.lv) extra.push(state.lv, state.every ?? 0, state.colours ?? 0);
  for (const value of [...Object.values(snapshot), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const BUB_BG = "#0B0B0F";
export const BUB_GOLD = "#F5B82E";
/** Five clearly distinct colours, each with its own inner symbol. */
export const BUB_PALETTE = ["#FF4D4D", "#FFE600", "#3DDC84", "#4D8CFF", "#B26BFF"];
export const BUB_SYMBOLS = ["dot", "ring", "square", "triangle", "star"] as const;
/**
 * The sixth colour (Expert only, BUB_SIXTH): a warm orange, told apart without colour by its own creature (a seahorse)
 * and symbol (a cross). Kept out of BUB_PALETTE, so every five-colour drawing (the Joker's rim) is unchanged.
 */
export const BUB_SIXTH_COLOUR = "#FF9A3C";

export function bubColour(value: number): string {
  // bubbleRev 2 specials: pearl Joker, black Bomb, teal Torpedo.
  if (value === BUB_JOKER) return "#F4F1FF";
  if (value === BUB_BOMB) return "#1C1F26";
  if (value === BUB_LINE) return "#1FB5C9";
  if (value === BUB_SIXTH) return BUB_SIXTH_COLOUR;
  return BUB_PALETTE[(value - 1) % BUB_PALETTE.length] ?? BUB_GOLD;
}

export function bubSymbol(value: number): (typeof BUB_SYMBOLS)[number] | "cross" {
  if (value === BUB_SIXTH) return "cross";
  return BUB_SYMBOLS[(value - 1) % BUB_SYMBOLS.length] ?? "dot";
}

/** Draws the colour's symbol inside a bubble. Render only. */
export function bubDrawSymbol(
  ctx: CanvasRenderingContext2D,
  value: number,
  cx: number,
  cy: number,
  radius: number,
): void {
  const ink = "rgba(11, 11, 15, 0.78)";
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.5, radius * 0.18);
  const r = radius * 0.52;
  switch (bubSymbol(value)) {
    case "dot":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "ring":
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "square":
      ctx.fillRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
      break;
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.9, cy + r * 0.7);
      ctx.lineTo(cx - r * 0.9, cy + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case "star":
      ctx.beginPath();
      for (let point = 0; point < 10; point++) {
        const reach = point % 2 === 0 ? r : r * 0.45;
        const angle = -Math.PI / 2 + (point * Math.PI) / 5;
        const x = cx + Math.cos(angle) * reach;
        const y = cy + Math.sin(angle) * reach;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case "cross":
      ctx.fillRect(cx - r * 0.8, cy - r * 0.25, r * 1.6, r * 0.5);
      ctx.fillRect(cx - r * 0.25, cy - r * 0.8, r * 0.5, r * 1.6);
      break;
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  // bubbleRev 5: the deeper tank and its lower shooter (the original 620 / 560 otherwise).
  const BUB_WORLD_H = bubWorldH(state);
  const BUB_SHOOTER_Y = bubShooterY(state);
  const scaleX = size.width / BUB_WORLD_W;
  const scaleY = size.height / BUB_WORLD_H;

  ctx.save();
  ctx.fillStyle = BUB_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);
  const circle = (value: number, x: number, y: number, r: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / scaleX, 1 / scaleY);
    const radius = r * Math.min(scaleX, scaleY);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = bubColour(value);
    ctx.fill();
    bubDrawSymbol(ctx, value, 0, 0, radius);
    ctx.restore();
  };

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(BUB_WALL, BUB_HUD_H);
  ctx.lineTo(BUB_WALL, BUB_WORLD_H);
  ctx.moveTo(BUB_WORLD_W - BUB_WALL, BUB_HUD_H);
  ctx.lineTo(BUB_WORLD_W - BUB_WALL, BUB_WORLD_H);
  ctx.stroke();

  ctx.strokeStyle = "rgba(245,184,46,0.35)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(BUB_WALL, BUB_SHOOTER_LINE);
  ctx.lineTo(BUB_WORLD_W - BUB_WALL, BUB_SHOOTER_LINE);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let row = 0; row < BUB_MAX_ROWS; row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const value = state.grid[cellIndex(row, col)]!;
      if (!value) continue;
      const cx = bubCellX(row, col);
      const cy = bubCellY(row, state.descents);
      circle(value, cx, cy, BUB_R - 1);
    }
  }

  // The shooter and the bubble waiting in it.
  ctx.fillStyle = BUB_GOLD;
  ctx.fillRect(BUB_SHOOTER_X - 18, BUB_SHOOTER_Y + 18, 36, 8);
  const holding = bubNextColour(state, 0);
  if (holding) {
    circle(holding, BUB_SHOOTER_X, BUB_SHOOTER_Y, BUB_R - 1);
  }

  if (state.flightColour) {
    const cx = state.x / 256;
    const cy = state.y / 256;
    circle(state.flightColour, cx, cy, BUB_R - 1);
  }

  ctx.fillStyle = BUB_BG;
  ctx.fillRect(0, 0, BUB_WORLD_W, BUB_HUD_H);
  ctx.fillStyle = BUB_GOLD;
  ctx.font = "bold 20px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`Popped ${state.popped}`, 14, 22);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";

  // Next three, as a strip.
  ctx.textAlign = "left";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("NEXT", 14, 50);
  for (let ahead = 1; ahead <= 3; ahead++) {
    const value = bubNextColour(state, ahead);
    if (!value) continue;
    circle(value, 52 + ahead * 22, 50, 8);
  }
  ctx.restore();
}

export const bubbleGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  key: "bubble",
  runTicks: BUB_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: BUB_INPUT_RANGES,
};

/** bubbleRev 2 (Joker, Bomb and Torpedo in the queue). Same step and score; init seeds the specials. */
export const bubbleRev2Game: ArcadeGame<BubState, ArcadeInputEvent | null> = { ...bubbleGame, init: (seed) => initRev2(seed) };

/** The game for a stored round: its bubbleRev picks the rules (absent = original). */
export function bubbleGameFor(rev?: number | null, level?: unknown): ArcadeGame<BubState, ArcadeInputEvent | null> {
  // Levels (stage 3) exist on bubbleRev 12 only; Normal, a missing level and every older stamp play as before.
  if (rev === BUB_REV_FAST) return isBubLevel(level) ? bubbleLevelGame(level) : bubbleFastGame;
  if (rev === BUB_REV_STD) return bubbleStdGame;
  if (rev === BUB_REV_BLAST) return bubbleBlastGame;
  if (rev === BUB_REV_CREDIT) return bubbleCreditGame;
  if (rev === BUB_REV_REEF) return bubbleReefGame;
  if (rev === BUB_REV_STRICT) return bubbleStrictGame;
  if (rev === BUB_REV_TARGET) return bubbleTargetGame;
  if (rev === BUB_REV_TALL) return bubbleTallGame;
  if (rev === BUB_REV_TORPEDO) return bubbleTorpedoGame;
  if (rev === BUB_REV_BAND) return bubbleBandGame;
  return rev === BUB_REV ? bubbleRev2Game : bubbleGame;
}

/* ================= Oct 2026 score bands (bubbleRev 3) ================= */

/**
 * Score-band revision (puzzle.bubbleRev = 3): rev-2 play with rarer specials
 * (states keep rev 2, so specials resolve and fold into the checksum exactly
 * as before), scored on the shared band curve (scoreBands.ts).
 */
export const BUB_REV_BAND = 3;
/** bubbleRev 3: one Joker in each block of 22 shots (one every 20–25 on average, was 15). */
export const BUB_V3_JOKER_BLOCK = 22;
/** Bubbles cleared from the fixed field; 140 at all of it (the 99 cap is gone); clearing it adds up to 10 for speed. */
export const BUB_BAND_CURVE = bandCurve([0, 36, 50, 60, 64, 66, 67], [0, 70, 100, 120, 132, 138, 140]);

export function bubbleBandParts(state: BubState): BandParts {
  // bubbleRev 11 (the arcade scoring standard): units are the core's bubbles cleared, points the core's, bonus the features.
  if (state.std) return bubbleStdBandParts(state);
  const start = Math.max(1, state.startCount);
  const units = state.cleared ? start : clampInt(start - bubRemaining(state), 0, start);
  const finished = Boolean(state.cleared);
  // The curve's knots are in bubbles of the fixed field (67); scale in case it ever differs.
  // bubbleRev 5 (the deeper tank) scores on its own refitted knots.
  const curve = bandCurveOf(state, state.worldH ? BUB_V5_BAND_CURVE : BUB_BAND_CURVE);
  const scaled = Math.floor((units * bandTop(curve)) / start);
  return {
    units,
    points: bandPoints(curve, scaled),
    bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, BUB_RUN_TICKS - clampInt(state.endedTick, 0, BUB_RUN_TICKS), BUB_RUN_TICKS) : 0,
    penalty: 0,
    finished,
    text: finished ? "Field cleared" : `${units} / ${start} bubbles cleared`,
    bonusText: "Field cleared",
  };
}

function scoreBand(state: BubState): number {
  return bandTotal(bubbleBandParts(state), Boolean(state.acted));
}

export const bubbleBandGame: ArcadeGame<BubState, ArcadeInputEvent | null> = { ...bubbleGame, init: (seed) => bandInit(initRev2(seed, true)) };

/* ============== Tuning F directional torpedo (bubbleRev 4) ============== */

/**
 * bubbleRev 4 (Tuning F, Oct 2026): rev-3 play (same field, queue, specials and
 * band curve) with the directional Torpedo (torpedoFlight) instead of the
 * row-clearing one. States add only `lineRev` and `drilled`.
 */
export const BUB_REV_TORPEDO = 4;
/** The most bubbles one rev-4 Torpedo destroys on its run (a row holds 9 or 10). */
export const BUB_TORPEDO_HITS = 6;

export const bubbleTorpedoGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleGame,
  init: (seed) => ({ ...bandInit(initRev2(seed, true)), lineRev: BUB_REV_TORPEDO, drilled: 0 }),
};

/* ================= Taller worlds (bubbleRev 5, Oct 2026) ================= */

/**
 * bubbleRev 5 (taller worlds, batch 2): bubbleRev 4 play (the same field,
 * queue, specials, directional Torpedo and descent) in a deeper tank, 390 ×
 * BUB_TALL_H, the same for every player. The field still hangs from the same
 * ceiling and the danger line stays where it was (BUB_SHOOTER_LINE, the same
 * rows below the field: a run is lost after exactly as many descents as
 * before). The shooter sits BUB_SHOOTER_LIFT above the new bottom, so the extra
 * 110 px is open water between the danger line and the shooter; shots fly at
 * BUB_SPEED_TALL so one still reaches the ceiling in the old time. Bubbles keep
 * their size and contact distance. States add `worldH`, folded into the
 * checkpoint checksum last; scored on BUB_V5_BAND_CURVE.
 */
export const BUB_REV_TALL = 5;
export const BUB_TALL_H = 730;
/**
 * bubbleRev 5 band knots (bubbles cleared from the fixed 67-bubble field): the
 * longer shots and steeper angles from the lower gun cost the same players a few
 * bubbles (scripts/arcade-skill-bands.ts --rev=g2, 60 seeds: unit medians 33 /
 * 53.5 / 62 / 63 on bubbleRev 4, 29.5 / 52.5 / 60 / 62 on bubbleRev 5), so each
 * knot sits at the new median: 70 / 100 / 125 / 138; 140 at the whole field, a
 * clear still adds up to 10 for speed.
 */
export const BUB_V5_BAND_CURVE = bandCurve([0, 30, 52, 60, 62, 67], [0, 70, 100, 125, 138, 140]);
/** The shooter sits this far above the tank's bottom (560 in the 620 tank). */
export const BUB_SHOOTER_LIFT = BUB_WORLD_H - BUB_SHOOTER_Y;
/** bubbleRev 5 flight speed (1/256 px a tick): BUB_SPEED × the shooter-to-ceiling distance, taller ÷ original. */
export const BUB_SPEED_TALL = Math.round((BUB_SPEED * (BUB_TALL_H - BUB_SHOOTER_LIFT - BUB_TOP)) / (BUB_SHOOTER_Y - BUB_TOP));

/** The tank height (px) a state plays in: bubbleRev 5's deeper tank, or the original 620. */
export function bubWorldH(state: { worldH?: number }): number {
  return state.worldH ?? BUB_WORLD_H;
}
/** The shooter's centre (px) in a state's tank: BUB_SHOOTER_LIFT above its bottom. */
export function bubShooterY(state: { worldH?: number }): number {
  return bubWorldH(state) - BUB_SHOOTER_LIFT;
}
/** A shot's flight speed (1/256 px a tick) in a state's tank. */
export function bubSpeed(state: { worldH?: number }): number {
  return state.worldH ? BUB_SPEED_TALL : BUB_SPEED;
}

export const bubbleTallGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleTorpedoGame,
  init: (seed) => {
    const base = bubbleTorpedoGame.init(seed);
    return { ...base, y: (BUB_TALL_H - BUB_SHOOTER_LIFT) * 256, worldH: BUB_TALL_H };
  },
};

/** The tank height (px) a stored round's bubbleRev plays in. */
export function bubbleWorldHFor(rev?: number | null): number {
  return rev === BUB_REV_STD + 1 /* bubbleRev 12 (BUB_REV_FAST) */ || rev === BUB_REV_STD || rev === BUB_REV_TALL || rev === BUB_REV_TARGET || rev === BUB_REV_STRICT || rev === BUB_REV_REEF || rev === BUB_REV_CREDIT || rev === BUB_REV_BLAST ? BUB_TALL_H : BUB_WORLD_H;
}

/* ================= Scoring targets (bubbleRev 6, 18 Oct 2026) ================= */

/**
 * bubbleRev 6 (scoring targets, docs/scoring-targets.md): bubbleRev 5 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const BUB_REV_TARGET = 6;
export const bubbleTargetGame = bandTargetGame(bubbleTallGame);
/** The curve new rounds score on: BUB_V5_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const BUB_V6_BAND_CURVE = bandRetarget(BUB_V5_BAND_CURVE);


/* ================= Score bands (bubbleRev 7, 19 Oct 2026) ================= */

/**
 * bubbleRev 7 (score bands, docs/scoring-targets.md): bubbleRev 6 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const BUB_REV_STRICT = 7;
export const bubbleStrictGame = bandStrictGame(bubbleTargetGame);
/** The curve new rounds score on: BUB_V5_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const BUB_V7_BAND_CURVE = bandStrict(BUB_V5_BAND_CURVE);


/* ================= Expansion E6 (bubbleRev 8, 25 Oct 2026): the deeper reef ================= */

/**
 * bubbleRev 8 (docs/expansions/e6.md, docs/scoring-200.md): bubbleRev 7's tank (390 × BUB_TALL_H, the
 * same gun, shot speed, queue, Jokers, mine or torpedo, directional Torpedo and descent pace) with a taller
 * reef and three skill features worth up to BUB_V8_FEATURE_MAX more, so the round tops out at 200:
 *  - The reef starts BUB_V8_START_ROWS rows deep (95 bubbles, was 67) in a BUB_V8_ROWS-row field, and the
 *    danger line sits BUB_V8_LINE (just above the gun) instead of 543, so the run lasts the same number of
 *    descents as before.
 *  - Treasure chests (BUB_CHEST): BUB_V8_CHESTS seeded chests sit in the reef (rows 3–9, never touching).
 *    A chest is no colour (nothing matches it, a Joker ignores it) and pays only when it falls with a
 *    cluster (dropLoose); a mine or torpedo that destroys one directly pays nothing.
 *  - Bank shots: a shot that comes off a wall at least once and removes bubbles.
 *  - Combos: every removing shot straight after another removing shot.
 * Base points: the bubbles cleared (chests included) on BUB_V8_BAND_CURVE, plus the clear's speed bonus
 * (to 150, as before); the features add bubV8FeatureBonus (to 50). States add the `reef` fields (folded
 * into the checkpoint checksum last) and a 220-cell grid.
 */
export const BUB_REV_REEF = 8;
export const BUB_V8_START_ROWS = 10;
export const BUB_V8_ROWS = 20;
/** The danger line's y in the deeper reef (the bubble's lower edge): 263 px below the starting reef, as in every earlier tank. */
export const BUB_V8_LINE = 630;
/** The treasure chest's grid value (never in the queue). */
export const BUB_CHEST = 9;
export const BUB_V8_CHESTS = 6;
/** Feature points: a chest dropped, a bank shot, a combo shot. */
export const BUB_V8_CHEST_FP = 5;
export const BUB_V8_BANK_FP = 1;
export const BUB_V8_COMBO_FP = 1;
/** The most the features add. */
export const BUB_V8_FEATURE_MAX = 50;
/** Feature points → bonus (fitted by scripts/e6-bands.ts so solid play earns a little and strong play nearly all 50). */
export const BUB_V8_FEATURE_CURVE = bandCurve([0, 16, 28, 49, 72], [0, 6, 10, 22, 50]);
/** bubbleRev 8 units: the bubbles (chests included) cleared of the reef's BUB_V8_UNIT_SCALE. */
export const BUB_V8_UNIT_SCALE = 95;
/**
 * bubbleRev 8 base knots (bubbles cleared): fitted by scripts/e6-bands.ts so the same players' base points
 * plus their usual feature bonus land where they did on bubbleRev 7; 140 from 89 of the 95, a clear adds up
 * to 10 for speed.
 */
export const BUB_V8_BAND_CURVE = bandCurve([0, 20, 43, 71, 86, 89], [0, 66, 92, 110, 132, 140]);

/** The danger line (the lowest bubble's lower edge may not reach it) a state plays to. */
export function bubDangerLine(state: { reef?: number }): number {
  return state.reef ? BUB_V8_LINE : BUB_SHOOTER_LINE;
}

/** bubbleRev 8 feature points so far. */
export function bubV8FeaturePoints(state: BubState): number {
  return (state.chests ?? 0) * BUB_V8_CHEST_FP + (state.banks ?? 0) * BUB_V8_BANK_FP + (state.combos ?? 0) * BUB_V8_COMBO_FP;
}

/** bubbleRev 8 feature bonus, 0…BUB_V8_FEATURE_MAX. */
export function bubV8FeatureBonus(state: BubState): number {
  return clampInt(bandPoints(BUB_V8_FEATURE_CURVE, bubV8FeaturePoints(state)), 0, BUB_V8_FEATURE_MAX);
}

function initReef(seed: number, reefRows = BUB_V8_START_ROWS, look?: BubReefLook): BubState {
  const base = initRev2(seed, true, true, look);
  // Chests from the PRNG after the specials: rows 3–9, never two touching.
  // bubbleRev 12 (reefRows 9): the tenth row is left empty first and the chests are drawn on rows 3–8.
  let rng = base.rng;
  const grid = [...base.grid];
  for (let row = reefRows; row < BUB_V8_START_ROWS; row++) for (let col = 0; col < bubRowCols(row); col++) grid[cellIndex(row, col)] = 0;
  const chestAt: number[] = [];
  for (let guard = 0; chestAt.length < BUB_V8_CHESTS && guard < 400; guard++) {
    // A level's reef draws its chests on its full rows only (never in the part-filled last row's gaps).
    const rowDraw = rngBelow(rng, (look ? bubReefFullRows(look.count) : reefRows) - 3);
    rng = rowDraw.state;
    const row = 3 + rowDraw.value;
    const colDraw = rngBelow(rng, bubRowCols(row));
    rng = colDraw.state;
    const index = cellIndex(row, colDraw.value);
    const near = neighbours(row, colDraw.value).some(([r, c]) => inGrid(r, c, BUB_V8_ROWS) && chestAt.includes(cellIndex(r, c)));
    if (chestAt.includes(index) || near) continue;
    chestAt.push(index);
    grid[index] = BUB_CHEST;
  }
  return {
    ...bandInit(base),
    ...(reefRows === BUB_V8_START_ROWS && !look ? {} : { startCount: grid.filter((cell) => cell !== 0).length }),
    rng,
    grid,
    lineRev: BUB_REV_TORPEDO,
    drilled: 0,
    y: (BUB_TALL_H - BUB_SHOOTER_LIFT) * 256,
    worldH: BUB_TALL_H,
    reef: 1,
    chests: 0,
    banks: 0,
    combos: 0,
    streak: 0,
    bestStreak: 0,
    bounce: 0,
    shotBase: 0,
  };
}

export function bubbleReefParts(state: BubState): BandParts {
  const start = Math.max(1, state.startCount);
  const net = state.cleared ? start : clampInt(start - bubRemaining(state), 0, start);
  // bubbleRev 9: a reef grown past its start still credits a quarter of the bubbles burst or dropped.
  const units = state.credit ? Math.max(net, clampInt(Math.floor(((state.popped ?? 0) + (state.dropped ?? 0)) / BUB_V9_CREDIT_PER), 0, start)) : net;
  const finished = Boolean(state.cleared);
  const scaled = Math.floor((units * BUB_V8_UNIT_SCALE) / start);
  const speed = finished ? speedBonusCurve(BAND_FINISH_BONUS, BUB_RUN_TICKS - clampInt(state.endedTick, 0, BUB_RUN_TICKS), BUB_RUN_TICKS) : 0;
  const feature = bubV8FeatureBonus(state);
  const extras = `${state.chests ?? 0} chest${state.chests === 1 ? "" : "s"} · ${state.banks ?? 0} bank${state.banks === 1 ? "" : "s"} · ${state.combos ?? 0} combo${state.combos === 1 ? "" : "s"}`;
  return {
    units,
    points: bandPoints(BUB_V8_BAND_CURVE, scaled),
    bonus: speed + feature,
    penalty: 0,
    finished,
    text: finished ? "Reef cleared" : `${units} / ${start} bubbles cleared`,
    bonusText: finished ? `Cleared +${speed} · ${extras}` : extras,
  };
}

function scoreReef(state: BubState): number {
  return bandTotal(bubbleReefParts(state), Boolean(state.acted), BUB_V8_MAX);
}
/** bubbleRev 8's round maximum (ROUND_MAX.bubble). */
export const BUB_V8_MAX = 200;

export const bubbleReefGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleGame,
  init: initReef,
  score: (state) => (state.reef ? scoreReef(state) : bubbleGame.score(state)),
};

/* ================= bubbleRev 9 (26 Oct 2026): credit for bubbles burst ================= */

/**
 * bubbleRev 9 (docs/arcade-200-remeasure.md): bubbleRev 8's reef, features, curves and play exactly; only the
 * base units change. bubbleRev 8 counts the reef's net shrink (start − remaining), so a player whose reef grew
 * past its start through the descents scored 0 however many bubbles they burst (about 1 weak run in 25 with
 * the fixed bots). bubbleRev 9 counts the larger of that and a quarter of the bubbles burst or dropped
 * (BUB_V9_CREDIT_PER), which only ever lifts runs that were held near 0: a good player's net shrink is
 * already well above it. States add `credit: 1` (not in the checkpoint checksum: play is unchanged).
 */
export const BUB_REV_CREDIT = 9;
export const BUB_V9_CREDIT_PER = 4;

export const bubbleCreditGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleReefGame,
  init: (seed) => ({ ...initReef(seed), credit: 1 }),
};

/* ================= bubbleRev 10 (27 Oct 2026): the mine's bigger blast ================= */

/**
 * bubbleRev 10 (Joe's phone-test notes, docs/phone-notes-oct-2026/bubble.md): bubbleRev 9 exactly (reef, queue,
 * features, credit and curves), with the mine (BUB_BOMB) clearing every bubble within BUB_V10_BOMB_RADIUS hex rings
 * of where it lands (18 cells) instead of one ring (6). The queue is unchanged, so the mine comes at the same shot for
 * every player. States add `bombR` (folded into the checkpoint checksum last).
 */
export const BUB_REV_BLAST = 10;
export const BUB_V10_BOMB_RADIUS = 2;

/** The mine's blast radius (hex rings) a state plays with. */
export function bubBombRadius(state: { bombR?: number }): number {
  return state.bombR ?? BUB_BOMB_RADIUS;
}

export const bubbleBlastGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleCreditGame,
  init: (seed) => ({ ...bubbleCreditGame.init(seed), bombR: BUB_V10_BOMB_RADIUS }),
};

/* ================= bubbleRev 11 (29 Oct 2026): the arcade scoring standard ================= */

/**
 * bubbleRev 11 (the arcade scoring standard, docs/arcade-standard/bubble.md): bubbleRev 10's reef, queue, chests,
 * bank shots and combos, with two changes:
 *  - Play: the mine pops only the BUB_V11_MINE_POPS bubbles nearest where it lands (bubMineNearest: by the squared
 *    distance in px between cell centres, ties to the lower cell index; a chest is a bubble here, as on every earlier
 *    revision, and one popped by the mine pays nothing) instead of bubbleRev 10's two rings. Bubbles left hanging then
 *    drop as after any pop and count as cleared. States add `minePops` (folded into the checkpoint checksum last) and
 *    `std`, and carry no `bombR`.
 *  - Score (arcadeStandard.ts, 200 in all, integer maths): core up to 120 on a straight line, 120 × bubbles cleared ÷
 *    the reef's starting bubbles (95 on every seed), full only when the reef is cleared; clearing the reef 10; speed up
 *    to 10 (a cleared reef only: full with half the clock or more left, then even to 0 at the buzzer); 5 for each of the
 *    6 seeded chests that falls; 1 for every BUB_V11_BANK_PER bank shots up to 15; BUB_V11_COMBO_EACH for each combo up to
 *    15. No feature curve. Bubbles cleared are the reef's net shrink, or a quarter of the bubbles burst or dropped when
 *    that is more (bubbleRev 9's credit, bubStdCleared).
 */
export const BUB_REV_STD = 11;
export const BUB_V11_MINE_POPS = 4;
export const BUB_V11_CORE_MAX = 120;
export const BUB_V11_CLEAR = 10;
export const BUB_V11_SPEED_MAX = 10;
/** Speed is full when the reef is cleared with this many ticks or more left (half the clock). */
export const BUB_V11_SPEED_FULL_LEFT = BUB_RUN_TICKS / 2;
export const BUB_V11_CHEST_EACH = 5;
export const BUB_V11_CHESTS_MAX = 30;
/** Bank shots pay 1 for every BUB_V11_BANK_PER (half a point each), up to 15 (30 bank shots): near-perfect play makes about 25. */
export const BUB_V11_BANK_PER = 2;
export const BUB_V11_BANK_MAX = 15;
export const BUB_V11_COMBO_EACH = 1;
export const BUB_V11_COMBO_MAX = 15;
/** The reef's starting bubbles (BUB_V8_START_ROWS rows of 10 and 9, chests included): the core's full-at figure. */
export const BUB_V11_REEF = 95;

/**
 * bubbleRev 11: the `count` bubbles nearest the mine's landing cell (the landing cell itself excluded), nearest first
 * by squared distance between cell centres in px (integers; descents shift every row alike), ties to the lower index.
 */
export function bubMineNearest(grid: readonly number[], landed: number, count: number): number[] {
  const lr = Math.floor(landed / BUB_COLS);
  const lx = bubCellX(lr, landed % BUB_COLS);
  const ly = bubCellY(lr, 0);
  const near: Array<[number, number]> = [];
  for (let index = 0; index < grid.length; index++) {
    if (index === landed || !grid[index]) continue;
    const row = Math.floor(index / BUB_COLS);
    const dx = bubCellX(row, index % BUB_COLS) - lx;
    const dy = bubCellY(row, 0) - ly;
    near.push([dx * dx + dy * dy, index]);
  }
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return near
    .slice(0, count)
    .map(([, index]) => index)
    .sort((a, b) => a - b);
}

export const BUB_V11_STD_SPEC: StdSpec = {
  field: "bubbleRev",
  rev: BUB_REV_STD,
  parts: [
    { key: "core", label: "Bubbles cleared", max: BUB_V11_CORE_MAX, how: `pop or drop the ${BUB_V11_REEF} reef bubbles, each worth the same` },
    { key: "clear", label: "Reef cleared", max: BUB_V11_CLEAR, how: "clear the whole reef" },
    { key: "speed", label: "Speed", max: BUB_V11_SPEED_MAX, how: "clear the reef with half the clock left for all of it, falling to 0 at the buzzer" },
    { key: "chests", label: "Chests", max: BUB_V11_CHESTS_MAX, how: `${BUB_V11_CHEST_EACH} for each of the ${BUB_V8_CHESTS} chests that falls` },
    { key: "banks", label: "Bank shots", max: BUB_V11_BANK_MAX, how: `1 for every ${BUB_V11_BANK_PER} bank shots` },
    { key: "combos", label: "Combos", max: BUB_V11_COMBO_MAX, how: `${BUB_V11_COMBO_EACH} for each combo` },
  ],
};

/**
 * bubbleRev 11: the core's bubbles cleared, 0…the reef's starting count: the whole reef when it is cleared, else its
 * net shrink, or a quarter of the bubbles burst or dropped when that is more (at most (95 + 120 shots) ÷ 4 = 53 in play,
 * so only a cleared reef reaches the full count).
 */
export function bubStdCleared(state: BubState): number {
  const start = Math.max(1, state.startCount);
  if (state.cleared) return start;
  const net = clampInt(start - bubRemaining(state), 0, start);
  const burst = clampInt(Math.floor(((state.popped ?? 0) + (state.dropped ?? 0)) / BUB_V9_CREDIT_PER), 0, start);
  return Math.max(net, burst);
}

/** bubbleRev 11's standard parts (null for any other revision's state). */
export function bubbleStdParts(state: BubState): StdPart[] | null {
  if (!state?.std) return null;
  const spec = state.fast ? BUB_V12_STD_SPEC : BUB_V11_STD_SPEC;
  const start = Math.max(1, state.startCount);
  const cleared = bubStdCleared(state);
  const left = state.cleared ? BUB_RUN_TICKS - clampInt(state.endedTick, 0, BUB_RUN_TICKS) : 0;
  const chests = state.chests ?? 0;
  const banks = state.banks ?? 0;
  const combos = state.combos ?? 0;
  const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    stdPart(spec, "core", stdLine(BUB_V11_CORE_MAX, cleared, Math.min(start, state.coreFull ?? start)), `${cleared} of ${start} bubbles`),
    stdPart(spec, "clear", state.cleared ? BUB_V11_CLEAR : 0, state.cleared ? "reef cleared" : "not cleared"),
    stdPart(spec, "speed", state.cleared ? stdLine(BUB_V11_SPEED_MAX, left, state.speedFullLeft ?? BUB_V11_SPEED_FULL_LEFT) : 0, state.cleared ? `${Math.floor(left / TICKS_PER_SECOND)} s left` : "not cleared"),
    stdPart(spec, "chests", stdEach(chests, BUB_V11_CHEST_EACH, BUB_V11_CHESTS_MAX), `${chests} of ${BUB_V8_CHESTS} fell`),
    stdPart(spec, "banks", stdLine(BUB_V11_BANK_MAX, banks, state.banksFull ?? BUB_V11_BANK_PER * BUB_V11_BANK_MAX), plural(banks, "bank shot", "bank shots")),
    stdPart(spec, "combos", stdEach(combos, BUB_V11_COMBO_EACH, BUB_V11_COMBO_MAX), plural(combos, "combo", "combos")),
  ];
}

/** bubbleRev 11's feature points so far (chests, bank shots and combos, as scored). */
export function bubStdFeaturePoints(state: BubState): number {
  return (
    stdEach(state.chests ?? 0, BUB_V11_CHEST_EACH, BUB_V11_CHESTS_MAX) +
    stdLine(BUB_V11_BANK_MAX, state.banks ?? 0, state.banksFull ?? BUB_V11_BANK_PER * BUB_V11_BANK_MAX) +
    stdEach(state.combos ?? 0, BUB_V11_COMBO_EACH, BUB_V11_COMBO_MAX)
  );
}

/** bubbleRev 11 as BandParts (the skill-band tool reads `units`): the core's bubbles cleared, its points, the rest as bonus. */
function bubbleStdBandParts(state: BubState): BandParts {
  const parts = bubbleStdParts(state) ?? [];
  const start = Math.max(1, state.startCount);
  const units = bubStdCleared(state);
  let bonus = 0;
  for (const p of parts.slice(1)) bonus += p.points;
  return {
    units,
    points: parts[0]?.points ?? 0,
    bonus,
    penalty: 0,
    finished: Boolean(state.cleared),
    text: state.cleared ? "Reef cleared" : `${units} / ${start} bubbles cleared`,
    bonusText: parts
      .slice(1)
      .map((p) => `${p.label} ${p.points}`)
      .join(" · "),
  };
}

/** The bubbleRev 11 band curve: the core's straight line (0 → 120 at the whole reef). */
export const BUB_V11_BAND_CURVE = bandCurve([0, BUB_V11_REEF], [0, BUB_V11_CORE_MAX]);

export const bubbleStdGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleCreditGame,
  init: (seed) => ({ ...initReef(seed), credit: 1, minePops: BUB_V11_MINE_POPS, std: 1 }),
  score: (state) => (state.std ? stdScore(bubbleStdParts(state) ?? [], Boolean(state.acted)) : bubbleCreditGame.score(state)),
};

/* ================= The Strategy overhaul (bubbleRev 12, 15 Nov 2026) ================= */

/**
 * bubbleRev 12 (the Strategy overhaul, docs/arcade-standard/bubble.md "bubbleRev 12"): bubbleRev 11's game and parts
 * with two changes, both from the seed or the input log only.
 *  - **A smaller reef**: nine rows (86 bubbles) instead of ten, the chests drawn on rows 3–8, so a strong player
 *    clears it in the 90 s (Near-perfect play left about 20 of 95 on bubbleRev 11).
 *  - **The fast shot**: the release's `c` (0, 1 or 2, set by how far down the aim line the finger was dragged) runs the
 *    shot's flight 1, 2 or 3 times a tick. Each run is the same flight step every older revision uses, so the bubble
 *    follows exactly the same path (the same sub-steps, wall bounces and landing cell) and only arrives sooner.
 * Older stamps never read `c` (their input range clamps it to 0) and play exactly as before.
 */
export const BUB_REV_FAST = 12;
export const BUB_V12_REEF_ROWS = 9;
/** Reef bubbles on every bubbleRev 12 seed (rows of 10 and 9 alternating: 5 × 10 + 4 × 9). */
export const BUB_V12_REEF = 86;
/** The highest fast-shot level a release may carry; the flight runs `level + 1` steps a tick. */
export const BUB_V12_FAST_MAX = 2;
/** Drag length (world px from the finger's start) at which each fast level begins, on the phone. */
export const BUB_V12_FAST_DRAG: readonly number[] = [0, 110, 190];

export const BUB_INPUT_RANGES_V12: readonly InputRange[] = [
  inputRange(BUB_INPUT_SHOT, [-BUB_V_MAX, BUB_V_MAX], [-BUB_V_MAX, 0], [0, BUB_V12_FAST_MAX]),
];

/** The input ranges a stored round's bubbleRev replays with (only bubbleRev 12 reads `c`). */
export function bubbleInputRangesFor(rev?: number | null): readonly InputRange[] {
  return rev === BUB_REV_FAST ? BUB_INPUT_RANGES_V12 : BUB_INPUT_RANGES;
}

/** The fast-shot level for a drag of `dragPx` world px (the phone's mapping; the sim only reads the level sent). */
export function bubFastLevel(dragPx: number): number {
  let level = 0;
  for (let k = 1; k < BUB_V12_FAST_DRAG.length; k++) if (dragPx >= BUB_V12_FAST_DRAG[k]!) level = k;
  return Math.min(level, BUB_V12_FAST_MAX);
}

export const BUB_V12_STD_SPEC: StdSpec = {
  ...BUB_V11_STD_SPEC,
  rev: BUB_REV_FAST,
  parts: BUB_V11_STD_SPEC.parts.map((part) =>
    part.key === "core" ? { ...part, how: `pop or drop the ${BUB_V12_REEF} reef bubbles, each worth the same` } : part,
  ),
};

/** bubbleRev 12's core line (0 → 120 at the whole 86-bubble reef). */
export const BUB_V12_BAND_CURVE = bandCurve([0, BUB_V12_REEF], [0, BUB_V11_CORE_MAX]);

function fastStep(state: BubState, input: ArcadeInputEvent | null): BubState {
  const firing = Boolean(input && input.k === BUB_INPUT_SHOT && state.flightColour === 0 && input.b < 0 && state.queueAt < state.queue.length);
  let next = bubbleStdGame.step(state, input);
  if (next === state) return next;
  if (firing && next.flightColour !== 0) next = { ...next, boost: clampInt(input!.c | 0, 0, BUB_V12_FAST_MAX) };
  const extra = next.flightColour !== 0 ? (next.boost ?? 0) : 0;
  for (let k = 0; k < extra && next.flightColour !== 0 && !isOver(next); k++) {
    // The same flight step, on the same tick: the shot covers its path sooner, never a different one.
    const again = bubbleStdGame.step({ ...next, tick: next.tick - 1 }, null);
    next = again;
  }
  if (next.flightColour === 0 && next.boost) next = { ...next, boost: 0 };
  return next;
}

export const bubbleFastGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  ...bubbleStdGame,
  init: (seed) => ({ ...initReef(seed, BUB_V12_REEF_ROWS), credit: 1, minePops: BUB_V11_MINE_POPS, std: 1, fast: 1, boost: 0 }),
  step: fastStep,
  inputRanges: BUB_INPUT_RANGES_V12,
};

/* ================= Difficulty levels on bubbleRev 12 (the Strategy overhaul, stage 3, 15 Nov 2026) ================= */

/**
 * Coral Pop's levels (docs/arcade-standard/bubble.md "Levels (stage 3)", docs/design/difficulty/README.md): played on
 * the live stamp, bubbleRev 12, with the level read from the stored puzzle (`level`, puzzleLevel). Normal has no entry
 * and is today's game exactly (no field on the puzzle or the state). Each level sets, from the seed alone:
 *  - `colours`: the reef's and the queue's colour count (3 on Easy, 4, or 6 with the sixth colour BUB_SIXTH);
 *  - `reef`: the reef's exact bubble count, chests included (the last row part-filled and centred);
 *  - `every`: the shots between descents (Normal 8);
 *  - `trail`: the aim trail's reach, display only (2 two bounces, 1 one bounce, 0 a short trail);
 *  - the parts' "full at" figures (the same six parts and maximums, 200 in all): `banksFull` bank shots for the 15
 *    bank-shot points, `coreFull` bubbles cleared for the 120 core points, `speedFullLeft` ticks left at the clear for
 *    the 10 speed points (Normal: 30, the whole reef, 2,700), so a flawless run can fill every part on a level.
 * These numbers are frozen with the stamp (a retune is a new stamp); GAME_LEVELS.bubble in src/lib/levels/gameLevels.ts
 * repeats them for the selectors and the tuning tool, and bubble-levels-check proves the two agree.
 */
export type BubLevel = "easy" | "hard" | "expert";
export interface BubLevelSettings {
  colours: number;
  reef: number;
  every: number;
  trail: number;
  /** Bank shots that fill the 15-point bank-shot part (Normal: 30). */
  banksFull: number;
  /** Bubbles cleared that fill the 120-point core (Normal: the whole reef). */
  coreFull: number;
  /** Ticks left at the clear that fill the 10-point speed part (Normal: half the clock, 2,700). */
  speedFullLeft: number;
}
export const BUB_LEVELS: Readonly<Record<BubLevel, BubLevelSettings>> = {
  easy: { colours: 3, reef: 75, every: 10, trail: 2, banksFull: 8, coreFull: 50, speedFullLeft: 1800 },
  hard: { colours: 5, reef: 110, every: 5, trail: 1, banksFull: 20, coreFull: 110, speedFullLeft: 1800 },
  expert: { colours: 6, reef: 110, every: 7, trail: 0, banksFull: 10, coreFull: 110, speedFullLeft: 1800 },
};
/** The level's code in the state and the checkpoint checksum. */
export const BUB_LEVEL_CODE: Readonly<Record<BubLevel, number>> = { easy: 1, hard: 3, expert: 4 };
/** The short trail's reach (Expert), world px from the gun. */
export const BUB_SHORT_TRAIL_PX = 120;

export function isBubLevel(level: unknown): level is BubLevel {
  return level === "easy" || level === "hard" || level === "expert";
}

function initLevel(seed: number, level: BubLevel): BubState {
  const set = BUB_LEVELS[level];
  const base = initReef(seed, bubReefRows(set.reef), { colours: set.colours, count: set.reef });
  return {
    ...base,
    credit: 1,
    minePops: BUB_V11_MINE_POPS,
    std: 1,
    fast: 1,
    boost: 0,
    lv: BUB_LEVEL_CODE[level],
    every: set.every,
    colours: set.colours,
    trail: set.trail,
    banksFull: set.banksFull,
    coreFull: set.coreFull,
    speedFullLeft: set.speedFullLeft,
  };
}

const levelGames = new Map<BubLevel, ArcadeGame<BubState, ArcadeInputEvent | null>>();
/** bubbleRev 12 at a level (Normal is bubbleFastGame itself). */
export function bubbleLevelGame(level: BubLevel): ArcadeGame<BubState, ArcadeInputEvent | null> {
  let game = levelGames.get(level);
  if (!game) {
    game = { ...bubbleFastGame, init: (seed) => initLevel(seed, level) };
    levelGames.set(level, game);
  }
  return game;
}

/** The colour values a state's reef and queue use (1…5 on every revision and at Normal). */
export function bubColoursOf(state: { colours?: number }): number[] {
  const n = state.colours ?? BUB_COLOUR_COUNT;
  return Array.from({ length: n }, (_, i) => bubColourValue(i));
}
