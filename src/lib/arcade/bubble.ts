/**
 * Bubble Pop — an arcade game on the shared engine.
 *
 * The hanging field and the whole 120-bubble queue are built from the seed at
 * init, so everyone shoots the same colours at the same field. Shots arrive as
 * the shared drag-aim release (kind 2, a = vx, b = vy) and the flight, the
 * sticking cell, the pops and the drops are all integer arithmetic.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  setLength,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

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
export const BUB_START_ROWS = 6;
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

export const BUB_POP_POINTS = 1;
export const BUB_DROP_POINTS = 2;
export const BUB_POINTS_CAP = 110;
export const BUB_CLEAR_BONUS = 40;

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

export interface BubState {
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
      grid[cellIndex(row, col)] = draw.value + 1;
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
  };
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
    const aimed = setLength(input.a, input.b, BUB_SPEED);
    next.flightColour = next.queue[next.queueAt]!;
    next.queueAt = next.queueAt + 1;
    next.x = BUB_SHOOTER_X * 256;
    next.y = BUB_SHOOTER_Y * 256;
    next.vx = aimed.vx;
    next.vy = aimed.vy;
  }

  if (next.flightColour !== 0) {
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

    if (landed !== null) {
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
    } else if (Math.trunc(y / 256) > BUB_WORLD_H + BUB_D) {
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

function score(state: BubState): number {
  const earned = Math.min(
    BUB_POINTS_CAP,
    BUB_POP_POINTS * state.popped + BUB_DROP_POINTS * state.dropped,
  );
  return clampInt(earned + (state.cleared ? BUB_CLEAR_BONUS : 0), 0, 150);
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
  for (const value of Object.values(snapshot)) {
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
  const scale = Math.min(size.width / BUB_WORLD_W, size.height / BUB_WORLD_H);
  const offsetX = (size.width - BUB_WORLD_W * scale) / 2;
  const offsetY = (size.height - BUB_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = BUB_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

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
      ctx.beginPath();
      ctx.arc(cx, cy, BUB_R - 1, 0, Math.PI * 2);
      ctx.fillStyle = bubColour(value);
      ctx.fill();
      bubDrawSymbol(ctx, value, cx, cy, BUB_R - 1);
    }
  }

  // The shooter and the bubble waiting in it.
  ctx.fillStyle = BUB_GOLD;
  ctx.fillRect(BUB_SHOOTER_X - 18, BUB_SHOOTER_Y + 18, 36, 8);
  const holding = bubNextColour(state, 0);
  if (holding) {
    ctx.beginPath();
    ctx.arc(BUB_SHOOTER_X, BUB_SHOOTER_Y, BUB_R - 1, 0, Math.PI * 2);
    ctx.fillStyle = bubColour(holding);
    ctx.fill();
    bubDrawSymbol(ctx, holding, BUB_SHOOTER_X, BUB_SHOOTER_Y, BUB_R - 1);
  }

  if (state.flightColour) {
    const cx = state.x / 256;
    const cy = state.y / 256;
    ctx.beginPath();
    ctx.arc(cx, cy, BUB_R - 1, 0, Math.PI * 2);
    ctx.fillStyle = bubColour(state.flightColour);
    ctx.fill();
    bubDrawSymbol(ctx, state.flightColour, cx, cy, BUB_R - 1);
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
  const left = Math.max(0, BUB_RUN_TICKS - state.tick);
  ctx.fillText(`${Math.ceil(left / TICKS_PER_SECOND)}s`, BUB_WORLD_W - 14, 22);

  // Next three, as a strip.
  ctx.textAlign = "left";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("NEXT", 14, 50);
  for (let ahead = 1; ahead <= 3; ahead++) {
    const value = bubNextColour(state, ahead);
    if (!value) continue;
    ctx.beginPath();
    ctx.arc(52 + ahead * 22, 50, 8, 0, Math.PI * 2);
    ctx.fillStyle = bubColour(value);
    ctx.fill();
    bubDrawSymbol(ctx, value, 52 + ahead * 22, 50, 8);
  }
  ctx.restore();
}

export const bubbleGame: ArcadeGame<BubState, ArcadeInputEvent | null> = {
  key: "bubble",
  runTicks: BUB_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: BUB_INPUT_RANGES,
};
