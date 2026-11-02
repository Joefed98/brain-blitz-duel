/**
 * Golf Solitaire's art and layout (display only; the sim is golfSol.ts). The world is 414 × 772 on Free Cell's blue
 * felt: HUD chips across the top, seven fanned columns of five large face-up cards (each card's index showing above the
 * next), the run meter (five gold lamps for runs of five, the current run counted), then a dark panel within thumb
 * reach: the stock and the foundation, and the Undo / Reset buttons. Playable exposed cards glow gold. gsHit reads the
 * same layout.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot, roundRect } from "./cards.renderer";
import { drawCardButton, inButton, type CardButtonBox } from "./cardButtons.renderer";
import {
  GS_CARDS, GS_COLS, GS_DEPTH, GS_INPUT_RESET, GS_INPUT_UNDO, GS_RUN_FULL, GS_RUN_LEN, GS_STOCK, GS_STOCK_PILE, golfSolGame, gsPlayable, type GsState,
} from "./golfSol";

export const GS_WORLD_W = 414;
export const GS_WORLD_H = 772;
export const GS_BG = "#0E2A57";

export const GS_CARD_W = 55;
export const GS_CARD_H = 80;
const STEP_X = 57;
const COL_X0 = (GS_WORLD_W - (GS_COLS * STEP_X - (STEP_X - GS_CARD_W))) / 2;
const COL_Y0 = 46;
const FAN = 46;
export const GS_METER_Y = COL_Y0 + (GS_DEPTH - 1) * FAN + GS_CARD_H + 26;
export const GS_PANEL_Y = 452;
export const GS_PILE_W = 92;
export const GS_PILE_H = 132;
export const GS_PILE_Y = GS_PANEL_Y + 34;
export const GS_STOCK_X = 56;
export const GS_FOUND_X = GS_WORLD_W - 56 - GS_PILE_W;
export const GS_BTN_Y = 690;
export const GS_BTN_H = 50;
export const GS_BUTTONS: readonly { kind: number; box: CardButtonBox }[] = [
  { kind: GS_INPUT_UNDO, box: { x: 30, y: GS_BTN_Y, w: 168, h: GS_BTN_H } },
  { kind: GS_INPUT_RESET, box: { x: GS_WORLD_W - 30 - 168, y: GS_BTN_Y, w: 168, h: GS_BTN_H } },
];

/** Card `d` (0 at the back) of column `c`'s box. */
export function gsCardBox(c: number, d: number): { x: number; y: number } {
  return { x: COL_X0 + c * STEP_X, y: COL_Y0 + d * FAN };
}

/** What a tap hits: a column (anywhere on its cards, the exposed one taking the tap), GS_STOCK_PILE, or -1. */
export function gsHit(state: GsState, x: number, y: number): number {
  for (let c = 0; c < GS_COLS; c++) {
    const h = state.heights[c]!;
    if (h === 0) continue;
    const top = gsCardBox(c, 0);
    const bottom = gsCardBox(c, h - 1);
    if (x >= top.x - 1 && x <= top.x + GS_CARD_W + 1 && y >= top.y && y <= bottom.y + GS_CARD_H) return c;
  }
  if (x >= GS_STOCK_X - 14 && x <= GS_STOCK_X + GS_PILE_W + 14 && y >= GS_PILE_Y - 14 && y <= GS_PILE_Y + GS_PILE_H + 14) return GS_STOCK_PILE;
  return -1;
}

/** Whether a point is over the foundation (a drag's drop). */
export function gsOverFoundation(x: number, y: number): boolean {
  return x >= GS_FOUND_X - 20 && x <= GS_FOUND_X + GS_PILE_W + 20 && y >= GS_PILE_Y - 30 && y <= GS_PILE_Y + GS_PILE_H + 20;
}

export function gsButtonHit(x: number, y: number): number {
  for (const b of GS_BUTTONS) if (inButton(b.box, x, y)) return b.kind;
  return 0;
}

export interface GsView {
  pressed: number;
  button: number;
  drag: { col: number; x: number; y: number; ox: number; oy: number } | null;
}

export function gsNewView(): GsView {
  return { pressed: -1, button: 0, drag: null };
}

const foundAt = () => ({ x: GS_FOUND_X + GS_PILE_W / 2, y: GS_PILE_Y + GS_PILE_H / 2 });

/** The shared success layer: each run of five, the clear. */
export const GOLFSOL_FX: ArcadeFxSpec<GsState> = {
  game: "golfsol",
  world: "cards",
  width: GS_WORLD_W,
  height: GS_WORLD_H,
  shake: false,
  events: [
    { kind: "combo", count: (s) => s.runs, at: foundAt, label: (s) => `RUN ${s.run}` },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "CLEARED!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawGolfSol(ctx: CanvasRenderingContext2D, state: GsState, size: CanvasSize, view?: GsView): void {
  arcadeFx(ctx, GOLFSOL_FX, state, () => drawGolfSolWorld(ctx, state, size, view), size);
}

function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lit: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (lit) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, "#FFF2B8");
    g.addColorStop(0.6, "#F2C75C");
    g.addColorStop(1, "#C98A22");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,200,90,0.8)";
    ctx.shadowBlur = 10;
  } else ctx.fillStyle = "rgba(233,196,106,0.16)";
  ctx.fill();
  ctx.restore();
}

function drawGolfSolWorld(ctx: CanvasRenderingContext2D, state: GsState, size: CanvasSize, view?: GsView): void {
  const W = GS_WORLD_W;
  const H = GS_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  drawChip(ctx, 10, 9, "CLEARED", `${state.cleared}/${GS_CARDS}`, { gold: state.cleared === GS_CARDS });
  drawChip(ctx, W - 10, 9, "RUNS", `${Math.min(state.runs, GS_RUN_FULL)}/${GS_RUN_FULL}`, { align: "right", gold: state.runs >= GS_RUN_FULL });

  const live = state.ended === 0;
  const drag = view?.drag ?? null;
  for (let c = 0; c < GS_COLS; c++) {
    const h = state.heights[c]!;
    if (h === 0) {
      const b = gsCardBox(c, 0);
      drawSlot(ctx, b.x, b.y, GS_CARD_W, GS_CARD_H);
      continue;
    }
    for (let d = 0; d < h; d++) {
      const exposed = d === h - 1;
      if (exposed && drag && drag.col === c) continue;
      const b = gsCardBox(c, d);
      const glow = exposed ? (view?.pressed === c ? 1 : live && gsPlayable(state, c) ? 0.7 : 0) : 0;
      drawCard(ctx, state.tab[c * GS_DEPTH + d]!, b.x, b.y, GS_CARD_W, GS_CARD_H, { glow, dim: exposed ? 0 : 0.12 });
    }
  }

  // The run meter: five lamps (runs of five made), and the current run.
  const gap = 34;
  const lx0 = W / 2 - ((GS_RUN_FULL - 1) * gap) / 2;
  for (let k = 0; k < GS_RUN_FULL; k++) lamp(ctx, lx0 + k * gap, GS_METER_Y, 10, k < state.runs);
  ctx.fillStyle = "rgba(246,235,208,0.82)";
  ctx.font = `700 13px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`RUN ${state.run}${state.run < GS_RUN_LEN ? ` OF ${GS_RUN_LEN}` : ""}  ·  ONE UP OR DOWN`, W / 2, GS_METER_Y + 28);

  // The panel: stock and foundation, then Undo and Reset.
  roundRect(ctx, 14, GS_PANEL_Y, W - 28, H - GS_PANEL_Y - 14, 22);
  ctx.fillStyle = "rgba(3,8,22,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const left = GS_STOCK - state.stockPos;
  ctx.fillStyle = "rgba(246,235,208,0.78)";
  ctx.font = `700 13px ${CARD_FONT}`;
  ctx.fillText(`STOCK ${left}`, GS_STOCK_X + GS_PILE_W / 2, GS_PANEL_Y + 18);
  ctx.fillText("FOUNDATION", GS_FOUND_X + GS_PILE_W / 2, GS_PANEL_Y + 18);
  if (left > 0) {
    for (let k = Math.min(3, left) - 1; k >= 0; k--) drawCard(ctx, 0, GS_STOCK_X + k * 3, GS_PILE_Y - k * 3, GS_PILE_W, GS_PILE_H, { down: true, glow: k === 0 && view?.pressed === GS_STOCK_PILE ? 1 : 0 });
  } else drawSlot(ctx, GS_STOCK_X, GS_PILE_Y, GS_PILE_W, GS_PILE_H, -1, "EMPTY");
  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 16) : 0;
  drawCard(ctx, state.top, GS_FOUND_X, GS_PILE_Y, GS_PILE_W, GS_PILE_H, { glow: fresh * 0.9 });

  for (const b of GS_BUTTONS) {
    const isUndo = b.kind === GS_INPUT_UNDO;
    const liveBtn = live && (isUndo ? state.hist.length > 0 : state.hist.length > 0 || state.resets > 0);
    drawCardButton(ctx, b.box, isUndo ? "undo" : "reset", isUndo ? "UNDO" : "RESET", { live: liveBtn, held: view?.button === b.kind });
  }

  if (drag) {
    const h = state.heights[drag.col]!;
    if (h > 0) drawCard(ctx, state.tab[drag.col * GS_DEPTH + h - 1]!, drag.x - drag.ox, drag.y - drag.oy, GS_CARD_W, GS_CARD_H, { glow: 1 });
  }
  ctx.restore();
}

export function golfSolArtGame(view?: GsView): ArcadeGame<GsState, ArcadeInputEvent | null> {
  return { ...golfSolGame, draw: (ctx, state, size) => drawGolfSol(ctx, state, size, view) };
}

export const golfSolArt = golfSolArtGame();
