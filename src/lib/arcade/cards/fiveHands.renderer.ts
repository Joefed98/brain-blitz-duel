/**
 * Five Hands' art and layout (display only; the sim is fiveHands.ts). The world is 414 × 772: HUD chips across the
 * top, the five rows of five slots with a badge at the end of each (lit gold with the hand and its points once the row
 * makes one; rows already filled for the round greyed out), this turn's card large in the middle with the deck count,
 * and the discards along the bottom, overlapping side by side in two rows of ten, oldest on the left, each showing its
 * large index (the shared card renderer's small-card face). fhHitRow reads the layout. No instruction text.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot, roundRect } from "./cards.renderer";
import {
  fhCoreFullFor, FH_ROWS, FH_SEEN, FH_SLOTS, FH_TURNS, fhDiscard, fhDiscardsShown, fhOpenRows, fhRowHand, fhTotals, fhYours, fiveHandsGameFor, type FhState,
} from "./fiveHands";

export const FH_WORLD_W = 414;
export const FH_WORLD_H = 772;
export const FH_BG = "#0E2A57";

export const FH_CELL_W = 58;
export const FH_CELL_H = 80;
const GAP = 6;
const ROW_X = 8;
export const FH_ROW_Y = 44;
const BADGE_X = ROW_X + FH_SLOTS * (FH_CELL_W + GAP) + 2;
const BADGE_W = FH_WORLD_W - BADGE_X - 8;
export const FH_NEXT_W = 74;
export const FH_NEXT_H = 104;
export const FH_NEXT_Y = 494;
/** The discard rows: ten cards each, overlapping so each shows its large index. */
export const FH_DISCARD_W = 44;
export const FH_DISCARD_H = 62;
export const FH_DISCARD_Y = 626;
const DISCARD_X = 12;
const DISCARD_STEP = (FH_WORLD_W - 2 * DISCARD_X - FH_DISCARD_W) / 9;
const DISCARD_ROW_GAP = 8;

export function fhSlotBox(r: number, k: number): { x: number; y: number } {
  return { x: ROW_X + k * (FH_CELL_W + GAP), y: FH_ROW_Y + r * (FH_CELL_H + GAP) };
}

/** The row under a point (its slots and badge, with half the gap round each), or -1. */
export function fhHitRow(x: number, y: number): number {
  if (x < 0 || x > FH_WORLD_W) return -1;
  for (let r = 0; r < FH_ROWS; r++) {
    const top = fhSlotBox(r, 0).y;
    if (y >= top - GAP / 2 && y <= top + FH_CELL_H + GAP / 2) return r;
  }
  return -1;
}

/** Whether a point is on this turn's card (a drag starts there). */
export function fhOnNext(x: number, y: number): boolean {
  const nx = FH_WORLD_W / 2 - FH_NEXT_W / 2;
  return x >= nx - 8 && x <= nx + FH_NEXT_W + 8 && y >= FH_NEXT_Y - 8 && y <= FH_NEXT_Y + FH_NEXT_H + 8;
}

/** Discard `i`'s place along the bottom (oldest top left). */
export function fhDiscardBox(i: number): { x: number; y: number } {
  const row = i < 10 ? 0 : 1;
  const k = i % 10;
  return { x: DISCARD_X + k * DISCARD_STEP, y: FH_DISCARD_Y + row * (FH_DISCARD_H + DISCARD_ROW_GAP) };
}

export interface FhView {
  pressed: number;
  drag: { x: number; y: number } | null;
}

export function fhNewView(): FhView {
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

/** The row's badge: dark with a dash, or gold with the hand's name over its points. */
function badge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, name: string, points: number): void {
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
  if (!on) {
    ctx.fillStyle = "rgba(233,220,190,0.35)";
    ctx.font = `700 13px ${CARD_FONT}`;
    ctx.fillText("—", x + w / 2, y + h / 2);
    return;
  }
  ctx.fillStyle = "#241603";
  ctx.font = `800 26px ${CARD_FONT}`;
  ctx.fillText(String(points), x + w / 2, y + h * 0.68);
  ctx.font = `800 10px ${CARD_FONT}`;
  const words = SHORT[name] ?? name.toUpperCase();
  const parts = words.split(" ");
  const lines = parts.length > 2 ? [parts.slice(0, 2).join(" "), parts.slice(2).join(" ")] : parts.length === 2 && words.length > 9 ? parts : [words];
  lines.forEach((line, k) => ctx.fillText(line, x + w / 2, y + 14 + k * 12));
}

/** The shared success layer: a pop naming the hand when a row first makes one, and the core filled (FH_CORE_FULL). */
export const FIVEHANDS_FX: ArcadeFxSpec<FhState> = {
  game: "fivehands",
  world: "cards",
  width: FH_WORLD_W,
  height: FH_WORLD_H,
  shake: false,
  events: [
    {
      kind: "pop",
      count: (s) => fhTotals(s.rows, s.rev).made,
      at: (s) => (s.lastRow >= 0 ? { x: BADGE_X + BADGE_W / 2, y: fhSlotBox(s.lastRow, 0).y + FH_CELL_H / 2 } : null),
      label: (s) => (s.lastRow >= 0 ? fhRowHand(s.rows[s.lastRow]!, s.rev).name.toUpperCase() || null : null),
    },
    { kind: "final", count: (s) => (fhTotals(s.rows, s.rev).total >= fhCoreFullFor(s.rev) ? 1 : 0), label: (s) => ((s.rev ?? 1) >= 3 ? "200 POINTS!" : "FULL POINTS!") },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawFiveHands(ctx: CanvasRenderingContext2D, state: FhState, size: CanvasSize, view?: FhView): void {
  arcadeFx(ctx, FIVEHANDS_FX, state, () => drawFiveHandsWorld(ctx, state, size, view), size);
}

function drawFiveHandsWorld(ctx: CanvasRenderingContext2D, state: FhState, size: CanvasSize, view?: FhView): void {
  const W = FH_WORLD_W;
  const H = FH_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  const { total, made } = fhTotals(state.rows, state.rev);
  drawChip(ctx, 10, 9, "POINTS", `${total}`, { gold: total >= fhCoreFullFor(state.rev) });
  drawChip(ctx, W / 2, 9, "TURN", `${Math.min(FH_TURNS, state.turn + (state.turn < FH_TURNS ? 1 : 0))}/${FH_TURNS}`, { align: "center" });
  drawChip(ctx, W - 10, 9, "HANDS", `${made}/${FH_ROWS}`, { align: "right", gold: made === FH_ROWS });

  const running = state.ended === 0 && state.turn < FH_TURNS;
  const open = running ? fhOpenRows(state.rows) : [];
  const dragRow = view?.drag ? fhHitRow(view.drag.x, view.drag.y) : -1;
  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 16) : 0;
  for (let r = 0; r < FH_ROWS; r++) {
    const row = state.rows[r]!;
    const isOpen = open.includes(r);
    for (let k = 0; k < FH_SLOTS; k++) {
      const b = fhSlotBox(r, k);
      const card = row[k];
      if (card === undefined) {
        drawSlot(ctx, b.x, b.y, FH_CELL_W, FH_CELL_H);
        // The open row's next slot: a faint gold outline, bright under the finger.
        if (isOpen && k === row.length) {
          const hot = view?.pressed === r || dragRow === r;
          roundRect(ctx, b.x, b.y, FH_CELL_W, FH_CELL_H, 6);
          ctx.strokeStyle = hot ? "rgba(255,214,110,0.95)" : "rgba(255,214,110,0.38)";
          ctx.lineWidth = hot ? 2.5 : 1.5;
          ctx.stroke();
        }
      } else drawCard(ctx, card, b.x, b.y, FH_CELL_W, FH_CELL_H, { glow: state.lastRow === r && k === row.length - 1 ? fresh : 0 });
    }
    const hand = fhRowHand(row, state.rev);
    badge(ctx, BADGE_X, fhSlotBox(r, 0).y, BADGE_W, FH_CELL_H, hand.name, hand.points);
    // Rows already filled for this round: greyed out.
    if (running && !isOpen) {
      const top = fhSlotBox(r, 0).y;
      roundRect(ctx, ROW_X - 3, top - 2, BADGE_X - ROW_X - 2, FH_CELL_H + 4, 8);
      ctx.fillStyle = "rgba(8,12,24,0.66)";
      ctx.fill();
    }
  }

  // This turn's card, large, with the deck count.
  const nx = W / 2 - FH_NEXT_W / 2;
  const deckLeft = 52 - Math.min(FH_SEEN, FH_ROWS + 2 * Math.min(FH_TURNS, state.turn + (running ? 1 : 0)));
  if (running) {
    drawCard(ctx, 0, nx + 5, FH_NEXT_Y + 4, FH_NEXT_W, FH_NEXT_H, { down: true });
    if (!view?.drag) drawCard(ctx, fhYours(state.deck, state.turn), nx, FH_NEXT_Y, FH_NEXT_W, FH_NEXT_H, { glow: 0.6 });
  } else drawSlot(ctx, nx, FH_NEXT_Y, FH_NEXT_W, FH_NEXT_H);
  drawChip(ctx, nx + FH_NEXT_W + 24, FH_NEXT_Y + FH_NEXT_H / 2 - 13, "DECK", `${deckLeft}`);

  // The discards, taken by the opponents: oldest top left, each newer one over the last's right side.
  const shown = fhDiscardsShown(state);
  ctx.fillStyle = "rgba(246,235,208,0.6)";
  ctx.font = `700 11px ${CARD_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`TAKEN · ${shown}`, DISCARD_X, FH_DISCARD_Y - 11);
  for (let i = 0; i < shown; i++) {
    const b = fhDiscardBox(i);
    const newest = running && i === shown - 1;
    drawCard(ctx, fhDiscard(state.deck, i), b.x, b.y, FH_DISCARD_W, FH_DISCARD_H, { glow: newest ? 0.45 : 0 });
  }

  if (view?.drag && running) drawCard(ctx, fhYours(state.deck, state.turn), view.drag.x - FH_CELL_W / 2, view.drag.y - FH_CELL_H / 2, FH_CELL_W, FH_CELL_H, { glow: 1 });
  ctx.restore();
}

/** The art game for a stage: the revision's sim with this draw (no stamp: fiveHandsRev 1). */
export function fiveHandsArtGame(view?: FhView, rev?: number | null): ArcadeGame<FhState, ArcadeInputEvent | null> {
  return { ...fiveHandsGameFor(rev), draw: (ctx, state, size) => drawFiveHands(ctx, state, size, view) };
}

export const fiveHandsArt = fiveHandsArtGame();
