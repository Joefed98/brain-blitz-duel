/**
 * Pyramid's art and layout (display only; the sim is pyramid.ts). The world is 414 × 772 on Free Cell's blue felt:
 * HUD chips across the top, the seven-row pyramid of large cards (the bottom row of seven side by side, each row
 * overlapping the one above so every index shows), then a dark panel within thumb reach
 * holding the stock and waste piles (between them, "Need 4" while a card is selected) and the Undo / Reset buttons. The selected card glows gold; its partners (cards
 * adding to 13) and free Kings glow softly. pyHit reads the same layout.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { rankOf } from "./cards";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot, roundRect } from "./cards.renderer";
import { drawCardButton, inButton, type CardButtonBox } from "./cardButtons.renderer";
import {
  PY_CARDS, PY_INPUT_RESET, PY_INPUT_UNDO, PY_PAIR_FULL, PY_STOCK_PILE, PY_WASTE_PILE, pyCardAt, pyFree, pyramidGame, pyRowOf, pyWasteTop, type PyState,
} from "./pyramid";

export const PY_WORLD_W = 414;
export const PY_WORLD_H = 772;
export const PY_BG = "#0E2A57";

export const PY_CARD_W = 54;
export const PY_CARD_H = 78;
const STEP_X = 57;
const ROW_Y0 = 46;
const ROW_STEP = 50;
export const PY_INFO_Y = ROW_Y0 + 6 * ROW_STEP + PY_CARD_H + 12;
export const PY_PANEL_Y = 486;
export const PY_PILE_W = 84;
export const PY_PILE_H = 120;
export const PY_PILE_Y = PY_PANEL_Y + 34;
export const PY_STOCK_X = 64;
export const PY_WASTE_X = PY_WORLD_W - 64 - PY_PILE_W;
export const PY_BTN_Y = 690;
export const PY_BTN_H = 50;
/** Undo and Reset across the panel's foot. */
export const PY_BUTTONS: readonly { kind: number; box: CardButtonBox }[] = [
  { kind: PY_INPUT_UNDO, box: { x: 30, y: PY_BTN_Y, w: 168, h: PY_BTN_H } },
  { kind: PY_INPUT_RESET, box: { x: PY_WORLD_W - 30 - 168, y: PY_BTN_Y, w: 168, h: PY_BTN_H } },
];

/** A pyramid card's box. */
export function pyCardBox(i: number): { x: number; y: number } {
  const { row, pos } = pyRowOf(i);
  const rowW = (row + 1) * STEP_X - (STEP_X - PY_CARD_W);
  return { x: PY_WORLD_W / 2 - rowW / 2 + pos * STEP_X, y: ROW_Y0 + row * ROW_STEP };
}

/** What a tap hits: a pyramid card (the top-most drawn under the point), PY_STOCK_PILE, PY_WASTE_PILE, or -1. */
export function pyHit(state: PyState, x: number, y: number): number {
  for (let i = PY_CARDS - 1; i >= 0; i--) {
    if (state.gone[i]) continue;
    const b = pyCardBox(i);
    if (x >= b.x && x <= b.x + PY_CARD_W && y >= b.y && y <= b.y + PY_CARD_H) return i;
  }
  if (x >= PY_STOCK_X - 14 && x <= PY_STOCK_X + PY_PILE_W + 14 && y >= PY_PILE_Y - 14 && y <= PY_PILE_Y + PY_PILE_H + 14) return PY_STOCK_PILE;
  if (x >= PY_WASTE_X - 14 && x <= PY_WASTE_X + PY_PILE_W + 14 && y >= PY_PILE_Y - 14 && y <= PY_PILE_Y + PY_PILE_H + 14) return PY_WASTE_PILE;
  return -1;
}

/** The Undo or Reset button under a point (its input kind), 0 for none. */
export function pyButtonHit(x: number, y: number): number {
  for (const b of PY_BUTTONS) if (inButton(b.box, x, y)) return b.kind;
  return 0;
}

export interface PyView {
  pressed: number;
  button: number;
}

export function pyNewView(): PyView {
  return { pressed: -1, button: 0 };
}

const wasteAt = () => ({ x: PY_WASTE_X + PY_PILE_W / 2, y: PY_PILE_Y + PY_PILE_H / 2 });
const lastAt = (s: PyState) => {
  const a = s.lastA >= 0 && s.lastA < PY_CARDS ? s.lastA : s.lastB >= 0 && s.lastB < PY_CARDS ? s.lastB : -1;
  if (a < 0) return wasteAt();
  const b = pyCardBox(a);
  return { x: b.x + PY_CARD_W / 2, y: b.y + PY_CARD_H / 2 };
};

/** The shared success layer: a pair of pyramid cards, a King, the clear. */
export const PYRAMID_FX: ArcadeFxSpec<PyState> = {
  game: "pyramid",
  world: "cards",
  width: PY_WORLD_W,
  height: PY_WORLD_H,
  shake: false,
  events: [
    { kind: "combo", count: (s) => s.ppPairs, at: lastAt, label: (s) => (s.ppPairs >= PY_PAIR_FULL ? "13!" : "13") },
    { kind: "pop", count: (s) => s.kings, at: lastAt, label: () => "KING" },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "CLEARED!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawPyramid(ctx: CanvasRenderingContext2D, state: PyState, size: CanvasSize, view?: PyView): void {
  arcadeFx(ctx, PYRAMID_FX, state, () => drawPyramidWorld(ctx, state, size, view), size);
}

function drawPyramidWorld(ctx: CanvasRenderingContext2D, state: PyState, size: CanvasSize, view?: PyView): void {
  const W = PY_WORLD_W;
  const H = PY_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  drawChip(ctx, 10, 9, "REMOVED", `${state.removed}/${PY_CARDS}`, { gold: state.removed === PY_CARDS });
  drawChip(ctx, W - 10, 9, "PAIRS", `${Math.min(state.ppPairs, PY_PAIR_FULL)}/${PY_PAIR_FULL}`, { align: "right", gold: state.ppPairs >= PY_PAIR_FULL });

  const live = state.ended === 0;
  const selCard = state.sel >= 0 ? pyCardAt(state, state.sel) : -1;
  const partner = (card: number) => live && selCard >= 0 && rankOf(card) + rankOf(selCard) === 13;
  for (let i = 0; i < PY_CARDS; i++) {
    if (state.gone[i]) continue;
    const b = pyCardBox(i);
    const free = pyFree(state, i);
    const card = state.tab[i]!;
    const glow = state.sel === i || view?.pressed === i ? 1 : free && (partner(card) || (live && rankOf(card) === 13)) ? 0.55 : 0;
    drawCard(ctx, card, b.x, b.y, PY_CARD_W, PY_CARD_H, { glow, dim: free ? 0 : 0.32 });
  }

  // (The rules line "ONE PASS · PAIRS ADD TO 13 · K ALONE" lived here until 3 Nov 2026; it is in How to play.)

  // The panel: stock and waste, then Undo and Reset.
  roundRect(ctx, 14, PY_PANEL_Y, W - 28, H - PY_PANEL_Y - 14, 22);
  ctx.fillStyle = "rgba(3,8,22,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const left = state.pile.length - state.pos;
  ctx.fillStyle = "rgba(246,235,208,0.78)";
  ctx.font = `700 13px ${CARD_FONT}`;
  ctx.fillText(`STOCK ${left}`, PY_STOCK_X + PY_PILE_W / 2, PY_PANEL_Y + 18);
  ctx.fillText(`WASTE ${state.pos}`, PY_WASTE_X + PY_PILE_W / 2, PY_PANEL_Y + 18);
  if (left > 0) {
    for (let k = Math.min(3, left) - 1; k >= 0; k--) drawCard(ctx, 0, PY_STOCK_X + k * 3, PY_PILE_Y - k * 3, PY_PILE_W, PY_PILE_H, { down: true, glow: k === 0 && view?.pressed === PY_STOCK_PILE ? 1 : 0 });
  } else drawSlot(ctx, PY_STOCK_X, PY_PILE_Y, PY_PILE_W, PY_PILE_H, -1, "EMPTY");
  const top = pyWasteTop(state);
  if (top >= 0) {
    if (state.pos > 1) drawCard(ctx, state.pile[state.pos - 2]!, PY_WASTE_X - 4, PY_PILE_Y + 3, PY_PILE_W, PY_PILE_H, { dim: 0.4 });
    const glow = state.sel === PY_WASTE_PILE || view?.pressed === PY_WASTE_PILE ? 1 : partner(top) || (live && rankOf(top) === 13) ? 0.55 : 0;
    drawCard(ctx, top, PY_WASTE_X, PY_PILE_Y, PY_PILE_W, PY_PILE_H, { glow });
  } else drawSlot(ctx, PY_WASTE_X, PY_PILE_Y, PY_PILE_W, PY_PILE_H, -1, "WASTE");

  // Between the piles, only while a card is selected: the rank its partner needs (3 Nov 2026; until then a large "13"
  // over "TAP TWO" whenever nothing was selected).
  if (selCard >= 0 && live && rankOf(selCard) < 13) {
    ctx.font = `800 15px ${CARD_FONT}`;
    ctx.fillStyle = "rgba(246,235,208,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Need ${PY_RANK_NAMES[13 - rankOf(selCard)]}`, W / 2, PY_PILE_Y + PY_PILE_H / 2);
  }

  for (const b of PY_BUTTONS) {
    const isUndo = b.kind === PY_INPUT_UNDO;
    const liveBtn = live && (isUndo ? state.hist.length > 0 : state.hist.length > 0 || state.resets > 0);
    drawCardButton(ctx, b.box, isUndo ? "undo" : "reset", isUndo ? "UNDO" : "RESET", { live: liveBtn, held: view?.button === b.kind });
  }
  ctx.restore();
}

/** The partner rank as the cards show it (1 is an Ace, 11–12 Jack and Queen). */
const PY_RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export function pyramidArtGame(view?: PyView): ArcadeGame<PyState, ArcadeInputEvent | null> {
  return { ...pyramidGame, draw: (ctx, state, size) => drawPyramid(ctx, state, size, view) };
}

export const pyramidArt = pyramidArtGame();
