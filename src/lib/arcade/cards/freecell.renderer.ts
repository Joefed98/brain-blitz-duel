/**
 * FreeCell's art and layout (display only; the sim is freecell.ts). The world is 414 × 772: HUD chips across the top,
 * the four free cells (larger cards) over a faint "FREECELL", the eight columns spreading down the middle and the four
 * home piles along the bottom with faint suit symbols. The phone's hit tests (fcHit, fcDropPile) read the same layout.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { NO_CARD } from "./cards";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot } from "./cards.renderer";
import {
  FC_CELLS, FC_COLS, FC_PILE_CELL, FC_PILE_HOME, fcHomeCount, freecellGame, type FcState,
} from "./freecell";
import { cardOf } from "./cards";

export const FC_WORLD_W = 414;
export const FC_WORLD_H = 772;
export const FC_BG = "#0E2A57";

/* ---- Layout ---- */
export const FC_BIG_W = 64;
export const FC_BIG_H = 90;
export const FC_CELL_Y = 44;
export const FC_COL_W = 46;
export const FC_COL_H = 64;
export const FC_COL_Y = 148;
export const FC_COL_BOTTOM = 668;
export const FC_HOME_Y = FC_WORLD_H - FC_BIG_H - 10;
const BIG_GAP = (FC_WORLD_W - FC_CELLS * FC_BIG_W) / (FC_CELLS + 1);
const COL_GAP = (FC_WORLD_W - FC_COLS * FC_COL_W) / (FC_COLS + 1);
/** The most a column's cards step down. */
const STEP_MAX = 24;

export function fcBigX(i: number): number {
  return BIG_GAP + i * (FC_BIG_W + BIG_GAP);
}

export function fcColX(c: number): number {
  return COL_GAP + c * (FC_COL_W + COL_GAP);
}

/** How far a column of `n` cards steps each card down so it fits above the home piles. */
export function fcColStep(n: number): number {
  if (n <= 1) return STEP_MAX;
  return Math.min(STEP_MAX, (FC_COL_BOTTOM - FC_COL_Y - FC_COL_H) / (n - 1));
}

/** The card under a point: its pile and index (cells index 0), or null. */
export function fcHit(state: FcState, x: number, y: number): { pile: number; index: number } | null {
  for (let i = 0; i < FC_CELLS; i++) {
    const cx = fcBigX(i);
    if (x >= cx && x <= cx + FC_BIG_W && y >= FC_CELL_Y && y <= FC_CELL_Y + FC_BIG_H && state.cells[i] !== NO_CARD) return { pile: FC_PILE_CELL + i, index: 0 };
  }
  for (let c = 0; c < FC_COLS; c++) {
    const cx = fcColX(c);
    if (x < cx - COL_GAP / 2 || x > cx + FC_COL_W + COL_GAP / 2) continue;
    const col = state.cols[c]!;
    const step = fcColStep(col.length);
    for (let i = col.length - 1; i >= 0; i--) {
      const top = FC_COL_Y + i * step;
      if (y >= top && y <= top + FC_COL_H) return { pile: c, index: i };
    }
  }
  return null;
}

/** The pile under a drop point (columns by their whole strip; a free cell; home), or -1. */
export function fcDropPile(x: number, y: number): number {
  for (let i = 0; i < FC_CELLS; i++) {
    const cx = fcBigX(i);
    if (x >= cx - BIG_GAP / 2 && x <= cx + FC_BIG_W + BIG_GAP / 2 && y >= FC_CELL_Y - 10 && y <= FC_CELL_Y + FC_BIG_H + 8) return FC_PILE_CELL + i;
    if (x >= cx - BIG_GAP / 2 && x <= cx + FC_BIG_W + BIG_GAP / 2 && y >= FC_HOME_Y - 8) return FC_PILE_HOME;
  }
  if (y >= FC_COL_Y - 6 && y < FC_HOME_Y - 4) {
    for (let c = 0; c < FC_COLS; c++) {
      const cx = fcColX(c);
      if (x >= cx - COL_GAP / 2 && x <= cx + FC_COL_W + COL_GAP / 2) return c;
    }
  }
  return -1;
}

/** The phone's drag and press (display only): the pressed card glows, a dragged run follows the finger. */
export interface FcView {
  pressed: { pile: number; index: number } | null;
  drag: { pile: number; index: number; x: number; y: number; ox: number; oy: number } | null;
}

export function fcNewView(): FcView {
  return { pressed: null, drag: null };
}

/** Where a pile's card sits now (for the drag's offset and the move glow). */
export function fcCardBox(state: FcState, pile: number, index: number): { x: number; y: number; w: number; h: number } {
  if (pile >= FC_PILE_CELL && pile < FC_PILE_CELL + FC_CELLS) return { x: fcBigX(pile - FC_PILE_CELL), y: FC_CELL_Y, w: FC_BIG_W, h: FC_BIG_H };
  const col = state.cols[pile] ?? [];
  return { x: fcColX(pile), y: FC_COL_Y + index * fcColStep(col.length), w: FC_COL_W, h: FC_COL_H };
}

/** The shared success layer: a burst at home for every card home, a banner each full suit and when all are home. */
export const FREECELL_FX: ArcadeFxSpec<FcState> = {
  game: "freecell",
  world: "cards",
  width: FC_WORLD_W,
  height: FC_WORLD_H,
  shake: false,
  events: [
    { kind: "pop", count: (s) => fcHomeCount(s), at: () => ({ x: FC_WORLD_W / 2, y: FC_HOME_Y + FC_BIG_H / 2 }), label: () => null },
    { kind: "streak", count: (s) => fcHomeCount(s), every: 13, at: () => ({ x: FC_WORLD_W / 2, y: FC_HOME_Y - 30 }), label: (_s, c) => `${c} HOME` },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "ALL HOME!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

/** Draws a frame of FreeCell with the shared success layer (`view`: the phone's press and drag; the reveal passes none). */
export function drawFreecell(ctx: CanvasRenderingContext2D, state: FcState, size: CanvasSize, view?: FcView): void {
  arcadeFx(ctx, FREECELL_FX, state, () => drawFreecellWorld(ctx, state, size, view), size);
}

function drawFreecellWorld(ctx: CanvasRenderingContext2D, state: FcState, size: CanvasSize, view?: FcView): void {
  const W = FC_WORLD_W;
  const H = FC_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  // HUD chips.
  const home = fcHomeCount(state);
  drawChip(ctx, 10, 9, "MOVES", `${state.moves}`);
  drawChip(ctx, W / 2, 9, "HOME", `${home}/52`, { align: "center", gold: home === 52 });
  drawChip(ctx, W - 10, 9, "PAR", `${state.par}`, { align: "right", gold: state.ended === 1 && state.moves <= state.par });

  // The free cells over a faint FREECELL.
  ctx.save();
  ctx.fillStyle = "rgba(233,196,106,0.07)";
  ctx.font = `900 58px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FREECELL", W / 2, FC_CELL_Y + FC_BIG_H / 2 + 2);
  ctx.restore();
  const dragging = view?.drag ?? null;
  const pressed = view?.pressed ?? null;
  const lit = (pile: number, index: number) =>
    (pressed && pressed.pile === pile && index >= pressed.index) || (dragging && dragging.pile === pile && index >= dragging.index) ? 1 : 0;
  const fresh = state.lastTick > 0 && state.tick - state.lastTick < 18 ? 1 - (state.tick - state.lastTick) / 18 : 0;
  for (let i = 0; i < FC_CELLS; i++) {
    const x = fcBigX(i);
    const card = state.cells[i]!;
    if (card === NO_CARD || (dragging && dragging.pile === FC_PILE_CELL + i)) drawSlot(ctx, x, FC_CELL_Y, FC_BIG_W, FC_BIG_H, -1, "FREE");
    if (card !== NO_CARD && !(dragging && dragging.pile === FC_PILE_CELL + i)) {
      drawCard(ctx, card, x, FC_CELL_Y, FC_BIG_W, FC_BIG_H, { glow: lit(FC_PILE_CELL + i, 0) || (state.lastTo === FC_PILE_CELL + i ? fresh * 0.8 : 0) });
    }
  }

  // The columns.
  for (let c = 0; c < FC_COLS; c++) {
    const x = fcColX(c);
    const col = state.cols[c]!;
    if (col.length === 0) drawSlot(ctx, x, FC_COL_Y, FC_COL_W, FC_COL_H);
    const step = fcColStep(col.length);
    for (let i = 0; i < col.length; i++) {
      if (dragging && dragging.pile === c && i >= dragging.index) break;
      const glow = lit(c, i) || (state.lastTo === c && i >= col.length - state.lastCount ? fresh * 0.8 : 0);
      drawCard(ctx, col[i]!, x, FC_COL_Y + i * step, FC_COL_W, FC_COL_H, { glow });
    }
  }

  // Home piles with faint suit symbols.
  for (let s = 0; s < 4; s++) {
    const x = fcBigX(s);
    const top = state.home[s]!;
    if (top === 0) drawSlot(ctx, x, FC_HOME_Y, FC_BIG_W, FC_BIG_H, s);
    else drawCard(ctx, cardOf(s, top), x, FC_HOME_Y, FC_BIG_W, FC_BIG_H, { glow: state.lastTo === FC_PILE_HOME && fresh > 0 ? fresh * 0.6 : 0 });
  }

  // The dragged run follows the finger.
  if (dragging) {
    const cards = dragging.pile < FC_COLS ? state.cols[dragging.pile]!.slice(dragging.index) : [state.cells[dragging.pile - FC_PILE_CELL]!];
    const big = dragging.pile >= FC_PILE_CELL;
    const w = big ? FC_BIG_W : FC_COL_W;
    const h = big ? FC_BIG_H : FC_COL_H;
    cards.forEach((card, k) => {
      if (card === NO_CARD) return;
      drawCard(ctx, card, dragging.x - dragging.ox, dragging.y - dragging.oy + k * 22, w, h, { glow: k === 0 ? 1 : 0 });
    });
  }

  if (state.ended === 2 && home < 52) {
    ctx.fillStyle = "rgba(4,10,26,0.25)";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/** The art game for a stage: the sim with this draw (the view, when given, is the phone's press and drag). */
export function freecellArtGame(view?: FcView): ArcadeGame<FcState, ArcadeInputEvent | null> {
  return { ...freecellGame, draw: (ctx, state, size) => drawFreecell(ctx, state, size, view) };
}

export const freecellArt = freecellArtGame();
