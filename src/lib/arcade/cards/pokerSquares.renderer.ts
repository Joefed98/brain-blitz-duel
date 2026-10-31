/**
 * Poker Squares' art and layout (display only; the sim is pokerSquares.ts). The world is 414 × 772: HUD chips across
 * the top, the 5 × 5 grid with a badge at the end of each row and under each column (lit gold with the hand and its
 * points once the line makes one), and the next card large at the bottom with the deck count. psHit reads the layout.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { NO_CARD } from "./cards";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot, roundRect } from "./cards.renderer";
import { PS_LINES, PS_SIZE, PS_SQUARES, psCoreFullFor, psLineHand, psTotals, pokerSquaresGameFor, type PsState } from "./pokerSquares";

export const PS_WORLD_W = 414;
export const PS_WORLD_H = 772;
export const PS_BG = "#0E2A57";

export const PS_CELL_W = 62;
export const PS_CELL_H = 86;
const GAP = 6;
const GRID_X = 8;
const GRID_Y = 44;
const BADGE_X = GRID_X + PS_SIZE * PS_CELL_W + (PS_SIZE - 1) * GAP + GAP;
const BADGE_W = PS_WORLD_W - BADGE_X - 8;
const COL_BADGE_Y = GRID_Y + PS_SIZE * PS_CELL_H + (PS_SIZE - 1) * GAP + GAP;
const COL_BADGE_H = 34;
export const PS_NEXT_W = 100;
export const PS_NEXT_H = 140;
export const PS_NEXT_Y = 610;

export function psCellBox(sq: number): { x: number; y: number } {
  const r = Math.floor(sq / PS_SIZE);
  const c = sq % PS_SIZE;
  return { x: GRID_X + c * (PS_CELL_W + GAP), y: GRID_Y + r * (PS_CELL_H + GAP) };
}

/** The square under a point (with half the gap round each), or -1. */
export function psHit(x: number, y: number): number {
  for (let sq = 0; sq < PS_SQUARES; sq++) {
    const b = psCellBox(sq);
    if (x >= b.x - GAP / 2 && x <= b.x + PS_CELL_W + GAP / 2 && y >= b.y - GAP / 2 && y <= b.y + PS_CELL_H + GAP / 2) return sq;
  }
  return -1;
}

export interface PsView {
  pressed: number;
  drag: { x: number; y: number } | null;
}

export function psNewView(): PsView {
  return { pressed: -1, drag: null };
}

const SHORT: Record<string, string> = {
  "Straight flush": "STRAIGHT FLUSH",
  "Four of a kind": "FOUR OF A KIND",
  "Full house": "FULL HOUSE",
  Flush: "FLUSH",
  Straight: "STRAIGHT",
  "Three of a kind": "THREE OF A KIND",
  "Two pair": "TWO PAIR",
  Pair: "PAIR",
};

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, name: string, points: number, vertical: boolean): void {
  const on = points > 0;
  roundRect(ctx, x, y, w, h, 9);
  if (on) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#F7DD8E");
    g.addColorStop(1, "#C9973A");
    ctx.fillStyle = g;
  } else ctx.fillStyle = "rgba(3,8,22,0.5)";
  ctx.fill();
  ctx.strokeStyle = on ? "#FFE7A3" : "rgba(233,196,106,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const ink = on ? "#241603" : "rgba(233,220,190,0.35)";
  ctx.fillStyle = ink;
  if (!on) {
    ctx.font = `700 13px ${CARD_FONT}`;
    ctx.fillText("—", x + w / 2, y + h / 2);
    return;
  }
  const words = SHORT[name] ?? name.toUpperCase();
  if (vertical) {
    ctx.font = `800 24px ${CARD_FONT}`;
    ctx.fillText(String(points), x + w / 2, y + h * 0.66);
    ctx.font = `800 9px ${CARD_FONT}`;
    const parts = words.split(" ");
    const lines = parts.length > 2 ? [parts.slice(0, 2).join(" "), parts.slice(2).join(" ")] : parts.length === 2 && words.length > 9 ? parts : [words];
    lines.forEach((line, k) => ctx.fillText(line, x + w / 2, y + 14 + k * 11));
  } else {
    ctx.font = `800 15px ${CARD_FONT}`;
    ctx.fillText(String(points), x + w / 2, y + h * 0.66);
    ctx.font = `800 8px ${CARD_FONT}`;
    const short = words.length > 11 ? words.replace("STRAIGHT FLUSH", "STR FLUSH").replace("FOUR OF A KIND", "FOUR KIND").replace("THREE OF A KIND", "THREE KIND") : words;
    ctx.fillText(short, x + w / 2, y + 9);
  }
}

/** The best hand on a line through square `sq`. */
function bestThrough(grid: readonly number[], sq: number): string | null {
  const row = Math.floor(sq / PS_SIZE);
  const col = PS_SIZE + (sq % PS_SIZE);
  const a = psLineHand(grid, row);
  const b = psLineHand(grid, col);
  const best = a.points >= b.points ? a : b;
  return best.points > 0 ? best.name.toUpperCase() : null;
}

/** The shared success layer: a pop naming the hand when a line first makes one, and the core filled (psCoreFullFor). */
export const POKERSQUARES_FX: ArcadeFxSpec<PsState> = {
  game: "pokersquares",
  world: "cards",
  width: PS_WORLD_W,
  height: PS_WORLD_H,
  shake: false,
  events: [
    {
      kind: "pop",
      count: (s) => psTotals(s.grid).made,
      at: (s) => (s.lastSquare >= 0 ? { x: psCellBox(s.lastSquare).x + PS_CELL_W / 2, y: psCellBox(s.lastSquare).y + PS_CELL_H / 2 } : null),
      label: (s) => (s.lastSquare >= 0 ? bestThrough(s.grid, s.lastSquare) : null),
    },
    { kind: "final", count: (s) => (psTotals(s.grid).total >= psCoreFullFor(s.rev) ? 1 : 0), label: () => "FULL POINTS!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawPokerSquares(ctx: CanvasRenderingContext2D, state: PsState, size: CanvasSize, view?: PsView): void {
  arcadeFx(ctx, POKERSQUARES_FX, state, () => drawPokerSquaresWorld(ctx, state, size, view), size);
}

function drawPokerSquaresWorld(ctx: CanvasRenderingContext2D, state: PsState, size: CanvasSize, view?: PsView): void {
  const W = PS_WORLD_W;
  const H = PS_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  const { total, made } = psTotals(state.grid);
  const full = psCoreFullFor(state.rev);
  drawChip(ctx, 10, 9, "POINTS", `${total}`, { gold: total >= full });
  drawChip(ctx, W / 2, 9, "FULL AT", `${full}`, { align: "center" });
  drawChip(ctx, W - 10, 9, "HANDS", `${made}/${PS_LINES}`, { align: "right", gold: made === PS_LINES });

  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 16) : 0;
  for (let sq = 0; sq < PS_SQUARES; sq++) {
    const b = psCellBox(sq);
    const card = state.grid[sq]!;
    if (card === NO_CARD) {
      drawSlot(ctx, b.x, b.y, PS_CELL_W, PS_CELL_H);
      if (view?.pressed === sq || (view?.drag && psHit(view.drag.x, view.drag.y) === sq)) {
        roundRect(ctx, b.x, b.y, PS_CELL_W, PS_CELL_H, 6);
        ctx.strokeStyle = "rgba(255,214,110,0.95)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    } else drawCard(ctx, card, b.x, b.y, PS_CELL_W, PS_CELL_H, { glow: state.lastSquare === sq ? fresh : 0 });
  }
  for (let r = 0; r < PS_SIZE; r++) {
    const hand = psLineHand(state.grid, r);
    badge(ctx, BADGE_X, psCellBox(r * PS_SIZE).y, BADGE_W, PS_CELL_H, hand.name, hand.points, true);
  }
  for (let c = 0; c < PS_SIZE; c++) {
    const hand = psLineHand(state.grid, PS_SIZE + c);
    badge(ctx, psCellBox(c).x, COL_BADGE_Y, PS_CELL_W, COL_BADGE_H, hand.name, hand.points, false);
  }

  // The next card, large, with the deck count.
  const left = PS_SQUARES - state.next;
  const nx = W / 2 - PS_NEXT_W / 2;
  ctx.fillStyle = "rgba(246,235,208,0.75)";
  ctx.font = `700 12px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(left > 0 ? "NEXT CARD" : "ALL PLACED", W / 2, PS_NEXT_Y - 16);
  if (left > 0) {
    if (left > 1) drawCard(ctx, 0, nx + 6, PS_NEXT_Y + 4, PS_NEXT_W, PS_NEXT_H, { down: true });
    if (!view?.drag) drawCard(ctx, state.order[state.next]!, nx, PS_NEXT_Y, PS_NEXT_W, PS_NEXT_H, { glow: 0.6 });
  } else drawSlot(ctx, nx, PS_NEXT_Y, PS_NEXT_W, PS_NEXT_H);
  drawChip(ctx, nx + PS_NEXT_W + 22, PS_NEXT_Y + PS_NEXT_H / 2 - 13, "DECK", `${left}`);
  if (view?.drag && left > 0) drawCard(ctx, state.order[state.next]!, view.drag.x - PS_CELL_W / 2, view.drag.y - PS_CELL_H / 2, PS_CELL_W, PS_CELL_H, { glow: 1 });
  ctx.restore();
}

export function pokerSquaresArtGame(view?: PsView, rev?: number | null): ArcadeGame<PsState, ArcadeInputEvent | null> {
  return { ...pokerSquaresGameFor(rev), draw: (ctx, state, size) => drawPokerSquares(ctx, state, size, view) };
}

export const pokerSquaresArt = pokerSquaresArtGame();

/** Whether a point is on the next card (a drag starts there). */
export function psOnNext(x: number, y: number): boolean {
  const nx = PS_WORLD_W / 2 - PS_NEXT_W / 2;
  return x >= nx && x <= nx + PS_NEXT_W && y >= PS_NEXT_Y && y <= PS_NEXT_Y + PS_NEXT_H;
}
