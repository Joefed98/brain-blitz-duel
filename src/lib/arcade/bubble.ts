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
import { bandCurve, bandInit, bandPoints, bandTop, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

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
}

function cellIndex(row: number, col: number): number {
  return row * BUB_COLS + col;
}

function init(seed: number): BubState {
  let rng = seed | 0;
  const grid = new Array<number>(BUB_MAX_ROWS * BUB_COLS).fill(0);
  for (let row = 0; row < BUB_START_ROWS; row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const draw = rngBelow(rng, BUB_COLOUR_COUNT);
      rng = draw.state;
      const index = cellIndex(row, col);
      // Try every colour deterministically; accepting only groups of at most five
      // also catches a new bubble joining several previously separate groups.
      for (let offset = 0; offset < BUB_COLOUR_COUNT; offset++) {
        grid[index] = 1 + (draw.value + offset) % BUB_COLOUR_COUNT;
        if (colourGroup(grid, index).length <= 5) break;
      }
    }
  }
  const queue: number[] = [];
  for (let index = 0; index < BUB_QUEUE; index++) {
    const draw = rngBelow(rng, BUB_COLOUR_COUNT);
    rng = draw.state;
    queue.push(draw.value + 1);
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
function initRev2(seed: number, v3 = false): BubState {
  const base = init(seed);
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
function hexArea(start: number, radius: number): number[] {
  const seen = new Set<number>([start]);
  let frontier = [start];
  for (let ring = 0; ring < radius; ring++) {
    const next: number[] = [];
    for (const index of frontier) {
      for (const [nr, nc] of neighbours(Math.floor(index / BUB_COLS), index % BUB_COLS)) {
        if (!inGrid(nr, nc)) continue;
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
function resolveSpecial(grid: number[], landed: number, kind: number): { cleared: number[]; keep: number } {
  const row = Math.floor(landed / BUB_COLS);
  if (kind === BUB_BOMB) {
    return { cleared: hexArea(landed, BUB_BOMB_RADIUS).filter((i) => i !== landed && grid[i]! > 0), keep: 0 };
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
    if (!inGrid(nr, nc)) continue;
    const v = grid[cellIndex(nr, nc)]!;
    if (v > 0 && v <= BUB_COLOUR_COUNT) touching.add(v);
  }
  const popped = new Set<number>();
  let keep = 0;
  let keepSize = 0;
  for (let colour = 1; colour <= BUB_COLOUR_COUNT; colour++) {
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

function inGrid(row: number, col: number): boolean {
  return row >= 0 && row < BUB_MAX_ROWS && col >= 0 && col < bubRowCols(row);
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
  for (let row = 0; row < BUB_MAX_ROWS; row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const index = cellIndex(row, col);
      if (grid[index]) continue;
      const supported =
        row === 0 ||
        neighbours(row, col).some(([nr, nc]) => inGrid(nr, nc) && grid[cellIndex(nr, nc)]! > 0);
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
      if (!inGrid(nr, nc)) continue;
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
      if (!inGrid(nr, nc)) continue;
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
function reachedShooter(grid: readonly number[], descents: number): boolean {
  for (let row = BUB_MAX_ROWS - 1; row >= 0; row--) {
    for (let col = 0; col < bubRowCols(row); col++) {
      if (!grid[cellIndex(row, col)]) continue;
      if (bubCellY(row, descents) + BUB_R >= BUB_SHOOTER_LINE) return true;
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
  }

  if (next.flightColour === BUB_LINE && next.lineRev === BUB_REV_TORPEDO) {
    torpedoFlight(next);
  } else if (next.flightColour !== 0) {
    let { x, y, vx } = next;
    const vy = next.vy;
    const leftWall = (BUB_WALL + BUB_R) * 256;
    const rightWall = (BUB_WORLD_W - BUB_WALL - BUB_R) * 256;
    let landed: number | null = null;

    for (let sub = 0; sub < 4 && landed === null; sub++) {
      const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
      const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);
      x += sx;
      y += sy;
      if (x < leftWall) {
        x = leftWall + (leftWall - x);
        vx = -vx;
      } else if (x > rightWall) {
        x = rightWall - (x - rightWall);
        vx = -vx;
      }

      const xPx = Math.trunc(x / 256);
      const yPx = Math.trunc(y / 256);
      const ceiling = BUB_TOP + BUB_R + next.descents * BUB_ROW_H;
      let touched = yPx <= ceiling;
      if (!touched) {
        const reach = (BUB_D - 2) * (BUB_D - 2);
        for (let row = 0; row < BUB_MAX_ROWS && !touched; row++) {
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

    if (landed !== null && bubIsSpecial(next.flightColour)) {
      // bubbleRev 2 specials (they only ever come from a stamped queue).
      const kind = next.flightColour;
      const grid = [...next.grid];
      grid[landed] = kind;
      next.flightColour = 0;
      next.shots = next.shots + 1;
      const { cleared, keep } = resolveSpecial(grid, landed, kind);
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
      const loose = unattached(grid);
      for (const index of loose) grid[index] = 0;
      next.dropped = next.dropped + loose.length;
      if (next.shots % BUB_DESCEND_EVERY === 0) next.descents = next.descents + 1;
      next.grid = grid;
      if (bubOccupied(grid) === 0) next.cleared = true;
      else if (reachedShooter(grid, next.descents)) next.dead = true;
    } else if (landed !== null) {
      const grid = [...next.grid];
      grid[landed] = next.flightColour;
      next.flightColour = 0;
      next.shots = next.shots + 1;

      const group = colourGroup(grid, landed);
      if (group.length >= BUB_MIN_GROUP) {
        for (const index of group) grid[index] = 0;
        next.popped = next.popped + group.length;
        const loose = unattached(grid);
        for (const index of loose) grid[index] = 0;
        next.dropped = next.dropped + loose.length;
      }

      if (next.shots % BUB_DESCEND_EVERY === 0) next.descents = next.descents + 1;
      next.grid = grid;

      if (bubOccupied(grid) === 0) next.cleared = true;
      else if (reachedShooter(grid, next.descents)) next.dead = true;
    } else if (Math.trunc(y / 256) > bubWorldH(next) + BUB_D) {
      // Nothing to stick to: the shot is simply spent.
      next.flightColour = 0;
      next.shots = next.shots + 1;
      if (next.shots % BUB_DESCEND_EVERY === 0) next.descents = next.descents + 1;
      if (reachedShooter(next.grid, next.descents)) next.dead = true;
    }
  }

  if (isOver(next)) next.endedTick = tick;
  return next;
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
  for (let sub = 0; sub < 4 && !done; sub++) {
    const sx = sub === 3 ? vx - 3 * Math.trunc(vx / 4) : Math.trunc(vx / 4);
    const sy = sub === 3 ? vy - 3 * Math.trunc(vy / 4) : Math.trunc(vy / 4);
    x += sx;
    y += sy;
    if (x < leftWall) {
      x = leftWall + (leftWall - x);
      vx = -vx;
    } else if (x > rightWall) {
      x = rightWall - (x - rightWall);
      vx = -vx;
    }
    const xPx = Math.trunc(x / 256);
    const yPx = Math.trunc(y / 256);
    for (let row = 0; row < BUB_MAX_ROWS && drilled < BUB_TORPEDO_HITS; row++) {
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
  const loose = unattached(grid);
  for (const index of loose) grid[index] = 0;
  next.dropped = next.dropped + loose.length;
  if (next.shots % BUB_DESCEND_EVERY === 0) next.descents = next.descents + 1;
  next.grid = grid;
  if (bubOccupied(grid) === 0) next.cleared = true;
  else if (reachedShooter(grid, next.descents)) next.dead = true;
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

export function bubColour(value: number): string {
  // bubbleRev 2 specials: pearl Joker, black Bomb, teal Torpedo.
  if (value === BUB_JOKER) return "#F4F1FF";
  if (value === BUB_BOMB) return "#1C1F26";
  if (value === BUB_LINE) return "#1FB5C9";
  return BUB_PALETTE[(value - 1) % BUB_PALETTE.length] ?? BUB_GOLD;
}

export function bubSymbol(value: number): (typeof BUB_SYMBOLS)[number] {
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
export function bubbleGameFor(rev?: number | null): ArcadeGame<BubState, ArcadeInputEvent | null> {
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
  const start = Math.max(1, state.startCount);
  const units = state.cleared ? start : clampInt(start - bubRemaining(state), 0, start);
  const finished = Boolean(state.cleared);
  // The curve's knots are in bubbles of the fixed field (67); scale in case it ever differs.
  // bubbleRev 5 (the deeper tank) scores on its own refitted knots.
  const curve = state.worldH ? BUB_V5_BAND_CURVE : BUB_BAND_CURVE;
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
  return rev === BUB_REV_TALL ? BUB_TALL_H : BUB_WORLD_H;
}
