/** Eat and Grow in the Retro Arcade world. Render only; the sim and its cells are untouched. */
import {
  snakeGame,
  snakeCol,
  snakeRow,
  SNAKE_BOARD_H,
  SNAKE_BOARD_W,
  SNAKE_BOARD_X,
  SNAKE_BOARD_Y,
  SNAKE_CELL,
  SNAKE_COLS,
  SNAKE_ROWS,
  SNAKE_WORLD_H,
  SNAKE_WORLD_W,
  type SnakeState,
} from "./snake";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { pixelRect, retroBloom, retroClock, retroReadout, retroScreen, RETRO_RED, RETRO_WHITE } from "./retro.renderer";

const BODY = "#4BFF7A";
const BODY_DARK = "#1E9C45";
const HEAD = "#B9FFC9";
const PELLET = "#FFD84A";
const POP_MS = 260;

/** Per-canvas presentation memory for the eat pop; never read by the sim. */
const pops = new WeakMap<CanvasRenderingContext2D, { eaten: number; at: number; cell: number }>();

function draw(ctx: CanvasRenderingContext2D, state: SnakeState, size: CanvasSize): void {
  retroScreen(ctx, size, SNAKE_WORLD_W, SNAKE_WORLD_H, "fit", (c) => drawWorld(c, state, ctx));
}

function cellX(cell: number) {
  return SNAKE_BOARD_X + snakeCol(cell) * SNAKE_CELL;
}
function cellY(cell: number) {
  return SNAKE_BOARD_Y + snakeRow(cell) * SNAKE_CELL;
}

function drawWorld(ctx: CanvasRenderingContext2D, state: SnakeState, key: CanvasRenderingContext2D): void {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  let pop = pops.get(key);
  if (!pop || state.eaten < pop.eaten) pop = { eaten: state.eaten, at: -1e9, cell: -1 };
  if (state.eaten > pop.eaten) pop = { eaten: state.eaten, at: now, cell: state.body[0] ?? -1 };
  pops.set(key, pop);
  const popAge = now - pop.at;

  // Faint grid.
  ctx.fillStyle = "rgba(75,255,122,0.07)";
  for (let col = 0; col <= SNAKE_COLS; col++) ctx.fillRect(SNAKE_BOARD_X + col * SNAKE_CELL, SNAKE_BOARD_Y, 1, SNAKE_BOARD_H);
  for (let row = 0; row <= SNAKE_ROWS; row++) ctx.fillRect(SNAKE_BOARD_X, SNAKE_BOARD_Y + row * SNAKE_CELL, SNAKE_BOARD_W, 1);
  ctx.fillStyle = "rgba(75,255,122,0.35)";
  ctx.fillRect(SNAKE_BOARD_X, SNAKE_BOARD_Y, SNAKE_BOARD_W, 1);
  ctx.fillRect(SNAKE_BOARD_X, SNAKE_BOARD_Y + SNAKE_BOARD_H - 1, SNAKE_BOARD_W, 1);
  ctx.fillRect(SNAKE_BOARD_X, SNAKE_BOARD_Y, 1, SNAKE_BOARD_H);
  ctx.fillRect(SNAKE_BOARD_X + SNAKE_BOARD_W - 1, SNAKE_BOARD_Y, 1, SNAKE_BOARD_H);

  // Pellet: a pixel dot that pulses inside its cell.
  const bloom = retroBloom();
  const t = retroClock();
  const pulse = t === 0 ? 0 : Math.floor(t / 260) % 2;
  const pxl = cellX(state.pellet);
  const pyl = cellY(state.pellet);
  const inset = 7 - pulse;
  pixelRect(ctx, pxl + inset, pyl + inset + 2, SNAKE_CELL - inset * 2, SNAKE_CELL - inset * 2 - 4, PELLET, bloom);
  pixelRect(ctx, pxl + inset + 2, pyl + inset, SNAKE_CELL - inset * 2 - 4, SNAKE_CELL - inset * 2, PELLET, bloom);

  // Eat pop: a pixel ring growing to the cell edge, inside the eaten cell.
  if (pop.cell >= 0 && popAge >= 0 && popAge < POP_MS) {
    const k = popAge / POP_MS;
    const ring = Math.round(2 + k * 8);
    const x = cellX(pop.cell) + 12 - ring;
    const y = cellY(pop.cell) + 12 - ring;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = PELLET;
    ctx.fillRect(x, y, ring * 2, 2);
    ctx.fillRect(x, y + ring * 2 - 2, ring * 2, 2);
    ctx.fillRect(x, y, 2, ring * 2);
    ctx.fillRect(x + ring * 2 - 2, y, 2, ring * 2);
    ctx.globalAlpha = 1;
  }

  const body = state.body;
  const last = body.length - 1;
  for (let i = last; i >= 1; i--) {
    const x = cellX(body[i]!);
    const y = cellY(body[i]!);
    const colour = state.dead ? "#B02A40" : BODY;
    if (i === last) {
      drawTail(ctx, x, y, body[i - 1]!, body[i]!, colour);
      continue;
    }
    pixelRect(ctx, x, y, SNAKE_CELL, SNAKE_CELL, BODY_DARK);
    pixelRect(ctx, x + 2, y + 2, SNAKE_CELL - 4, SNAKE_CELL - 4, colour);
  }

  const head = body[0] ?? 0;
  const hx = cellX(head);
  const hy = cellY(head);
  const flashing = popAge >= 0 && popAge < 160;
  const headColour = state.dead ? RETRO_RED : flashing ? RETRO_WHITE : HEAD;
  pixelRect(ctx, hx, hy, SNAKE_CELL, SNAKE_CELL, headColour, bloom);
  drawEyes(ctx, hx, hy, state.dir);

  retroReadout(ctx, 14, 10, `PELLETS ${state.eaten}`, RETRO_WHITE);
  if (state.dead) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, SNAKE_WORLD_W, SNAKE_WORLD_H);
  }
}

/** Two square eyes on the leading side of the head. */
function drawEyes(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  const e = 4;
  const near = 4;
  const far = SNAKE_CELL - 4 - e;
  const front = dir === 0 || dir === 3 ? 4 : SNAKE_CELL - 4 - e;
  const spots = dir === 0 || dir === 2
    ? [[near, front], [far, front]]
    : [[front, near], [front, far]];
  for (const [ex, ey] of spots) pixelRect(ctx, x + ex!, y + ey!, e, e, "#000000");
}

/** The tail tapers in pixel steps away from the segment in front of it. */
function drawTail(ctx: CanvasRenderingContext2D, x: number, y: number, ahead: number, tail: number, colour: string): void {
  const dRow = snakeRow(ahead) - snakeRow(tail);
  const dCol = snakeCol(ahead) - snakeCol(tail);
  const steps = [2, 5, 8];
  const band = SNAKE_CELL / steps.length;
  steps.forEach((inset, s) => {
    // s = 0 touches the segment ahead; later bands narrow towards the tip.
    if (dCol !== 0) {
      const bx = dCol > 0 ? x + SNAKE_CELL - (s + 1) * band : x + s * band;
      pixelRect(ctx, bx, y + inset, band, SNAKE_CELL - inset * 2, colour);
    } else {
      const by = dRow > 0 ? y + SNAKE_CELL - (s + 1) * band : y + s * band;
      pixelRect(ctx, x + inset, by, SNAKE_CELL - inset * 2, band, colour);
    }
  });
}

export const snakeArtGame: ArcadeGame<SnakeState, ArcadeInputEvent | null> = { ...snakeGame, draw };
