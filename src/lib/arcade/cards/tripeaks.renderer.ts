/**
 * TriPeaks' art and layout (display only; the sim is tripeaks.ts). The world is 414 × 772: HUD chips across the top,
 * three tall peaks of large cards, the run readout ("Run 3 (best 5)"; a row of ten flames until 3 Nov 2026), and the stock and discard on a dark panel
 * at the bottom, within thumb reach. Playable cards glow gold. tpHit reads the same layout.
 * The Cards & Board overhaul (15 Nov 2026, display only): real cards (realArt.renderer.ts), 54 × 80, the bottom row's
 * ten overlapping a little (each card's index shows), the peaks' rows overlapping like a real deal, and the stock and
 * discard as a large pair just under them; on the live stage a played card slides to the discard, the card it uncovers
 * flips, and a turned stock card slides off and flips (CardMotion).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { CARD_FONT, drawChip, drawSlot } from "./cards.renderer";
import { CardLayer, CardMotion, drawRealFelt } from "./realArt.renderer";
import { TP_CARDS, TP_STOCK, TP_STOCK_PILE, tpFree, tpPlayable, tripeaksGameFor, type TpState } from "./tripeaks";

export const TP_WORLD_W = 414;
export const TP_WORLD_H = 772;
export const TP_BG = "#0E2A57";

/*
 * Layout (30 Oct 2026 legibility pass): the bottom row's ten face-up cards side by side, never overlapping (so the card
 * is as wide as a tenth of the world allows), the peaks taller (taller cards, more space between rows), and a smaller
 * stock and discard panel at the bottom, within thumb reach.
 */
export const TP_CARD_W = 54;
export const TP_CARD_H = 80;
const MARGIN = 4;
const UNIT = (TP_WORLD_W - 2 * MARGIN - TP_CARD_W) / 9;
const ROW_Y0 = 54;
const ROW_STEP = 66;
export const TP_FLAME_Y = ROW_Y0 + 3 * ROW_STEP + TP_CARD_H + 30;
export const TP_PANEL_Y = TP_FLAME_Y + 30;
export const TP_PILE_W = 96;
export const TP_PILE_H = 142;
export const TP_PILE_Y = TP_PANEL_Y + 30;
export const TP_STOCK_X = TP_WORLD_W / 2 - 20 - TP_PILE_W;
export const TP_DISCARD_X = TP_WORLD_W / 2 + 20;

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
  /** The live stage's card motion; none on reveals and replays. */
  motion?: CardMotion;
  /** The discard as last drawn (its top, and the card under it while a new top slides in). */
  discard?: { top: number; under: number };
}

export function tpNewView(): TpView {
  return { pressed: -1, drag: null, motion: new CardMotion(), discard: { top: -1, under: -1 } };
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
  ctx.save();
  ctx.scale(size.width / W, size.height / TP_WORLD_H);
  drawRealFelt(ctx, W, TP_WORLD_H);
  const cards = new CardLayer(ctx, view?.motion ?? null);

  drawChip(ctx, 10, 9, "CLEARED", `${state.clearedCount}/${TP_CARDS}`, { gold: state.clearedCount === TP_CARDS });
  drawChip(ctx, W - 10, 9, "PEAKS", `${state.peaks}/3`, { align: "right", gold: state.peaks === 3 });
  // tripeaksRev 2: stock cards turned against the deal's par ("Stock 20 · par 20", the overhaul; "STOCK PAR 20/20" until then).
  if (state.stockPar !== undefined) drawChip(ctx, W / 2, 9, "", `Stock ${state.turns} · par ${state.stockPar}`, { align: "center", gold: state.turns <= state.stockPar });

  // Labels over the pair.
  const left = TP_STOCK - state.stockPos;
  ctx.fillStyle = "rgba(246,235,208,0.75)";
  ctx.font = `700 12px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`STOCK ${left}`, TP_STOCK_X + TP_PILE_W / 2, TP_PILE_Y - 14);
  ctx.fillText("DISCARD", TP_DISCARD_X + TP_PILE_W / 2, TP_PILE_Y - 14);

  // The stock: up to three backs; the next card is noted at the stock so a turn slides it from there.
  if (left > 0) {
    for (let k = Math.min(3, left) - 1; k >= 0; k--) cards.card(-100 - k, -1, TP_STOCK_X + k * 3, TP_PILE_Y - k * 3, TP_PILE_W, TP_PILE_H, { down: true, glow: k === 0 && view?.pressed === TP_STOCK_PILE ? 1 : 0, lift: k === 0 && view?.pressed === TP_STOCK_PILE ? 0.6 : 0 });
    view?.motion?.seed(state.stock[state.stockPos]!, TP_STOCK_X, TP_PILE_Y, true);
  } else drawSlot(ctx, TP_STOCK_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H, -1, "EMPTY");

  // The discard: the card under the top stays drawn while the new top slides in.
  const d = view?.discard;
  if (d && d.top !== state.top) {
    d.under = d.top;
    d.top = state.top;
  }
  if (d && d.under >= 0 && d.under !== state.top) cards.card(d.under, d.under, TP_DISCARD_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H);
  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 16) : 0;

  const drag = view?.drag ?? null;
  for (let i = 0; i < TP_CARDS; i++) {
    if (state.cleared[i] || (drag && drag.index === i)) continue;
    const b = tpCardBox(i);
    const free = tpFree(state, i);
    const playable = state.ended === 0 && tpPlayable(state, i);
    const up = view?.pressed === i;
    cards.card(state.tab[i]!, state.tab[i]!, b.x, b.y - (up ? 3 : 0), TP_CARD_W, TP_CARD_H, {
      down: !free,
      glow: up ? 1 : playable ? 0.7 : 0,
      lift: up ? 1 : 0,
    });
  }
  cards.card(state.top, state.top, TP_DISCARD_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H, { glow: fresh * 0.9 });
  cards.flush();

  // The run readout (3 Nov 2026: one chip, "Run 3 (best 5)", gold from a run of five).
  drawChip(ctx, W / 2, TP_FLAME_Y - 13, "Run", `${state.run} (best ${state.bestRun})`, { align: "center", gold: state.run >= 5 });

  // A run that ended stuck (stock gone, nothing playable) says why, under the pair (15 Nov 2026, display only).
  const stuck = tpStuckLines(state);
  if (stuck) {
    ctx.font = `800 15px ${CARD_FONT}`;
    ctx.fillStyle = "rgba(246,235,208,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${stuck[0]} ${stuck[1]}`, W / 2, TP_PILE_Y + TP_PILE_H + 26);
  }

  if (drag) {
    const lifted = new CardLayer(ctx, view?.motion ?? null);
    lifted.card(state.tab[drag.index]!, state.tab[drag.index]!, drag.x - drag.ox, drag.y - drag.oy - 4, TP_CARD_W, TP_CARD_H, { glow: 1, lift: 1 }, true);
  }
  ctx.restore();
}

/** The note for a run that ended stuck (`ended` 3: the stock is gone and no card plays), or null. Display only. */
export function tpStuckLines(state: Pick<TpState, "ended">): readonly [string, string] | null {
  return state.ended === 3 ? ["NO PLAYS", "LEFT"] : null;
}

/** The art game for a stage: the revision's sim with this draw (no stamp: tripeaksRev 1). */
export function tripeaksArtGame(view?: TpView, rev?: number | null): ArcadeGame<TpState, ArcadeInputEvent | null> {
  return { ...tripeaksGameFor(rev), draw: (ctx, state, size) => drawTripeaks(ctx, state, size, view) };
}

export const tripeaksArt = tripeaksArtGame();
