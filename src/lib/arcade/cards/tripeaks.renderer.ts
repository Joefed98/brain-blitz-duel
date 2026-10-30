/**
 * TriPeaks' art and layout (display only; the sim is tripeaks.ts). The world is 414 × 772: HUD chips across the top,
 * three tall peaks of large cards, the run meter (a row of ten gold flames), and the stock and discard on a dark panel
 * at the bottom, within thumb reach. Playable cards glow gold. tpHit reads the same layout.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot, roundRect } from "./cards.renderer";
import { TP_CARDS, TP_STOCK, TP_STOCK_PILE, tpFree, tpPlayable, tripeaksGame, type TpState } from "./tripeaks";

export const TP_WORLD_W = 414;
export const TP_WORLD_H = 772;
export const TP_BG = "#0E2A57";

/*
 * Layout (30 Oct 2026 legibility pass): the bottom row's ten face-up cards side by side, never overlapping (so the card
 * is as wide as a tenth of the world allows), the peaks taller (taller cards, more space between rows), and a smaller
 * stock and discard panel at the bottom, within thumb reach.
 */
export const TP_CARD_W = 39;
export const TP_CARD_H = 70;
const MARGIN = 4;
const UNIT = (TP_WORLD_W - 2 * MARGIN - TP_CARD_W) / 9;
const ROW_Y0 = 58;
const ROW_STEP = 96;
export const TP_FLAME_Y = 486;
export const TP_PANEL_Y = 598;
export const TP_PILE_W = 74;
export const TP_PILE_H = 104;
export const TP_PILE_Y = 636;
export const TP_STOCK_X = 84;
export const TP_DISCARD_X = TP_WORLD_W - 84 - TP_PILE_W;

/** A peak card's box. */
export function tpCardBox(i: number): { x: number; y: number } {
  let row: number;
  let u: number;
  if (i < 3) {
    row = 0;
    u = 3 * i + 1.5;
  } else if (i < 9) {
    const j = i - 3;
    row = 1;
    u = 3 * (j >> 1) + 1 + (j & 1);
  } else if (i < 18) {
    row = 2;
    u = i - 9 + 0.5;
  } else {
    row = 3;
    u = i - 18;
  }
  return { x: MARGIN + u * UNIT, y: ROW_Y0 + row * ROW_STEP };
}

/** What a tap at a point hits: a peak card's index, TP_STOCK_PILE, or -1 (covered cards are under the ones drawn over them). */
export function tpHit(state: TpState, x: number, y: number): number {
  for (let i = TP_CARDS - 1; i >= 0; i--) {
    if (state.cleared[i]) continue;
    const b = tpCardBox(i);
    if (x >= b.x && x <= b.x + TP_CARD_W && y >= b.y && y <= b.y + TP_CARD_H) return i;
  }
  if (x >= TP_STOCK_X - 14 && x <= TP_STOCK_X + TP_PILE_W + 14 && y >= TP_PILE_Y - 14 && y <= TP_PILE_Y + TP_PILE_H + 14) return TP_STOCK_PILE;
  return -1;
}

/** Whether a point is over the discard (a drag's drop). */
export function tpOverDiscard(x: number, y: number): boolean {
  return x >= TP_DISCARD_X - 20 && x <= TP_DISCARD_X + TP_PILE_W + 20 && y >= TP_PILE_Y - 30 && y <= TP_PILE_Y + TP_PILE_H + 20;
}

export interface TpView {
  pressed: number;
  drag: { index: number; x: number; y: number; ox: number; oy: number } | null;
}

export function tpNewView(): TpView {
  return { pressed: -1, drag: null };
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: boolean, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  const sway = lit ? Math.sin(t) * 0.06 : 0;
  ctx.rotate(sway);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.55, -s * 0.45, s * 0.6, s * 0.2, 0, s * 0.55);
  ctx.bezierCurveTo(-s * 0.6, s * 0.2, -s * 0.55, -s * 0.45, 0, -s);
  if (lit) {
    const g = ctx.createLinearGradient(0, -s, 0, s * 0.55);
    g.addColorStop(0, "#FFF2B8");
    g.addColorStop(0.5, "#F2C75C");
    g.addColorStop(1, "#D8892A");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,200,90,0.8)";
    ctx.shadowBlur = 10;
  } else ctx.fillStyle = "rgba(233,196,106,0.16)";
  ctx.fill();
  ctx.restore();
}

const discardAt = () => ({ x: TP_DISCARD_X + TP_PILE_W / 2, y: TP_PILE_Y + TP_PILE_H / 2 });

/** The shared success layer: runs of five and more, each peak top, and the clear. */
export const TRIPEAKS_FX: ArcadeFxSpec<TpState> = {
  game: "tripeaks",
  world: "cards",
  width: TP_WORLD_W,
  height: TP_WORLD_H,
  shake: false,
  events: [
    { kind: "combo", count: (s) => s.plays, when: (s) => s.run >= 5, at: discardAt, label: (s) => `RUN ${s.run}` },
    {
      kind: "perfect",
      count: (s) => s.peaks,
      at: (s) => (s.lastPlay >= 0 && s.lastPlay < 3 ? { x: tpCardBox(s.lastPlay).x + TP_CARD_W / 2, y: tpCardBox(s.lastPlay).y + TP_CARD_H / 2 } : null),
      label: () => "PEAK!",
    },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "CLEARED!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawTripeaks(ctx: CanvasRenderingContext2D, state: TpState, size: CanvasSize, view?: TpView): void {
  arcadeFx(ctx, TRIPEAKS_FX, state, () => drawTripeaksWorld(ctx, state, size, view), size);
}

function drawTripeaksWorld(ctx: CanvasRenderingContext2D, state: TpState, size: CanvasSize, view?: TpView): void {
  const W = TP_WORLD_W;
  const H = TP_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  drawChip(ctx, 10, 9, "CLEARED", `${state.clearedCount}/${TP_CARDS}`, { gold: state.clearedCount === TP_CARDS });
  drawChip(ctx, W - 10, 9, "PEAKS", `${state.peaks}/3`, { align: "right", gold: state.peaks === 3 });

  const drag = view?.drag ?? null;
  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 16) : 0;
  for (let i = 0; i < TP_CARDS; i++) {
    if (state.cleared[i] || (drag && drag.index === i)) continue;
    const b = tpCardBox(i);
    const free = tpFree(state, i);
    const playable = state.ended === 0 && tpPlayable(state, i);
    drawCard(ctx, state.tab[i]!, b.x, b.y, TP_CARD_W, TP_CARD_H, {
      down: !free,
      glow: view?.pressed === i ? 1 : playable ? 0.7 : 0,
    });
  }

  // The run meter: ten gold flames, lit to the current run.
  const flames = 10;
  const gap = 30;
  const fx0 = W / 2 - ((flames - 1) * gap) / 2;
  const t = state.tick / 8;
  for (let k = 0; k < flames; k++) flame(ctx, fx0 + k * gap, TP_FLAME_Y + 6, 12, k < state.run, t + k);
  ctx.fillStyle = "rgba(246,235,208,0.8)";
  ctx.font = `700 12px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`RUN ${state.run}  ·  BEST ${state.bestRun}`, W / 2, TP_FLAME_Y + 26);

  // The dark panel: stock and discard.
  roundRect(ctx, 14, TP_PANEL_Y, W - 28, H - TP_PANEL_Y - 14, 22);
  ctx.fillStyle = "rgba(3,8,22,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const left = TP_STOCK - state.stockPos;
  ctx.fillStyle = "rgba(246,235,208,0.75)";
  ctx.font = `700 12px ${CARD_FONT}`;
  ctx.fillText(`STOCK ${left}`, TP_STOCK_X + TP_PILE_W / 2, TP_PANEL_Y + 12);
  ctx.fillText("DISCARD", TP_DISCARD_X + TP_PILE_W / 2, TP_PANEL_Y + 12);
  if (left > 0) {
    for (let k = Math.min(3, left) - 1; k >= 0; k--) drawCard(ctx, 0, TP_STOCK_X + k * 3, TP_PILE_Y - k * 3, TP_PILE_W, TP_PILE_H, { down: true, glow: k === 0 && view?.pressed === TP_STOCK_PILE ? 1 : 0 });
  } else drawSlot(ctx, TP_STOCK_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H, -1, "EMPTY");
  drawCard(ctx, state.top, TP_DISCARD_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H, { glow: fresh * 0.9 });

  if (drag) {
    drawCard(ctx, state.tab[drag.index]!, drag.x - drag.ox, drag.y - drag.oy, TP_CARD_W, TP_CARD_H, { glow: 1 });
  }
  ctx.restore();
}

export function tripeaksArtGame(view?: TpView): ArcadeGame<TpState, ArcadeInputEvent | null> {
  return { ...tripeaksGame, draw: (ctx, state, size) => drawTripeaks(ctx, state, size, view) };
}

export const tripeaksArt = tripeaksArtGame();
