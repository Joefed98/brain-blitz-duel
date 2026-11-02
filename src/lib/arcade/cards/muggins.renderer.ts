/**
 * Muggins' art and layout (display only; the sim is muggins.ts). The world is 414 × 772 on green baize with gold
 * stitching: HUD chips across the top (points, big plays), the line of cream tiles across the middle (laid left to right,
 * snaking into the next row when a row is full; doubles stand crosswise), the two open end values with the running sum
 * under it (a pink ring when the sum scores), the hand along the bottom (tiles that can be laid glow softly, the chosen
 * one lifts and glows gold), then Undo / Reset and the big Draw and Play buttons within thumb reach. The phone's hit
 * tests (mgHitHand, mgHitEnd, mgButtonHit) read the same layout.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { CARD_FONT, drawChip, roundRect } from "./cards.renderer";
import { drawCardButton, inButton, type CardButtonBox } from "./cardButtons.renderer";
import {
  MG_BIG_FULL, MG_INPUT_DRAW, MG_INPUT_PLAY, MG_INPUT_RESET, MG_INPUT_UNDO, MG_TILE_PIPS, mgApply, mgEnds, mgNextTile, mgEndSum, mgFits, mgPlays, mgScoreOf, mugginsGame, type MgState,
} from "./muggins";

export const MG_WORLD_W = 414;
export const MG_WORLD_H = 772;
export const MG_BG = "#0F4A2C";
/** Cards & Board's pink (the group colour). */
export const MG_PINK = "#FF5C93";

/* ---- The line ---- */
const LINE_TOP = 50;
const LINE_ROWS_H = 295;
const CELL_W = 62;
const CELL_H = 59;
const PER_ROW = 6;
const TILE_LONG = 58;
const TILE_SHORT = 29;
/* ---- Ends and sum ---- */
export const MG_ENDS_Y = 352;
export const MG_END_W = 120;
export const MG_END_H = 64;
export const MG_END_LEFT_X = 22;
export const MG_END_RIGHT_X = MG_WORLD_W - 22 - MG_END_W;
/* ---- Hand ---- */
export const MG_HAND_TOP = 448;
export const MG_HAND_H = 184;
/* ---- Buttons ---- */
export const MG_BUTTONS: readonly { kind: number; box: CardButtonBox; label: string; icon: "undo" | "reset" | "draw" | "play" }[] = [
  { kind: MG_INPUT_UNDO, box: { x: 22, y: 644, w: 120, h: 40 }, label: "UNDO", icon: "undo" },
  { kind: MG_INPUT_RESET, box: { x: MG_WORLD_W - 22 - 120, y: 644, w: 120, h: 40 }, label: "RESET", icon: "reset" },
  { kind: MG_INPUT_DRAW, box: { x: 22, y: 696, w: 176, h: 58 }, label: "DRAW", icon: "draw" },
  { kind: MG_INPUT_PLAY, box: { x: MG_WORLD_W - 22 - 176, y: 696, w: 176, h: 58 }, label: "PLAY", icon: "play" },
];

/** Each laid tile's box (centre and size) and whether its halves are drawn swapped (a right-to-left row). */
export interface MgTileBox {
  cx: number;
  cy: number;
  vertical: boolean;
  flip: boolean;
}

export function mgLineLayout(line: readonly number[]): MgTileBox[] {
  const n = line.length;
  const rows = Math.max(1, Math.ceil(n / PER_ROW));
  const top = LINE_TOP + (LINE_ROWS_H - rows * CELL_H) / 2;
  const out: MgTileBox[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / PER_ROW);
    const inRow = row === rows - 1 ? n - row * PER_ROW : PER_ROW;
    const k = i - row * PER_ROW;
    const rowW = (rows === 1 ? inRow : PER_ROW) * CELL_W;
    const x0 = (MG_WORLD_W - rowW) / 2;
    const rtl = row % 2 === 1;
    const slot = rtl ? (rows === 1 ? inRow : PER_ROW) - 1 - k : k;
    const t = line[i]!;
    out.push({ cx: x0 + slot * CELL_W + CELL_W / 2, cy: top + row * CELL_H + CELL_H / 2, vertical: Math.floor(t / 7) === t % 7, flip: rtl });
  }
  return out;
}

/** The hand's tile boxes, in hand order: rows of up to eight, sized to fit. */
export function mgHandLayout(n: number): { x: number; y: number; w: number; h: number }[] {
  if (n === 0) return [];
  const rows = Math.ceil(n / 8);
  const per = Math.ceil(n / rows);
  const h = Math.min(92, (MG_HAND_H - (rows - 1) * 10) / rows);
  const w = Math.min(h / 2, (MG_WORLD_W - 40 - (per - 1) * 6) / per);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per);
    const k = i - row * per;
    const inRow = Math.min(per, n - row * per);
    const rowW = inRow * w + (inRow - 1) * 8;
    out.push({ x: (MG_WORLD_W - rowW) / 2 + k * (w + 8), y: MG_HAND_TOP + (MG_HAND_H - (rows * h + (rows - 1) * 10)) / 2 + row * (h + 10), w, h });
  }
  return out;
}

/** The hand tile under a point (its tile id), or -1. */
export function mgHitHand(state: MgState, x: number, y: number): number {
  const boxes = mgHandLayout(state.hand.length);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    if (x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 10 && y <= b.y + b.h + 4) return state.hand[i]!;
  }
  return -1;
}

/** The end under a point (0 left, 1 right: its end badge or the end tile itself), or -1. */
export function mgHitEnd(state: MgState, x: number, y: number): number {
  if (y >= MG_ENDS_Y - 6 && y <= MG_ENDS_Y + MG_END_H + 6) {
    if (x >= MG_END_LEFT_X - 6 && x <= MG_END_LEFT_X + MG_END_W + 6) return 0;
    if (x >= MG_END_RIGHT_X - 6 && x <= MG_END_RIGHT_X + MG_END_W + 6) return 1;
  }
  const boxes = mgLineLayout(state.line);
  const near = (b: MgTileBox) => Math.abs(x - b.cx) <= CELL_W / 2 + 4 && Math.abs(y - b.cy) <= CELL_H / 2;
  if (boxes.length === 1) return near(boxes[0]!) ? (x < boxes[0]!.cx ? 0 : 1) : -1;
  if (near(boxes[0]!)) return 0;
  if (near(boxes[boxes.length - 1]!)) return 1;
  return -1;
}

export function mgButtonHit(x: number, y: number): number {
  for (const b of MG_BUTTONS) if (inButton(b.box, x, y, 4)) return b.kind;
  return 0;
}

/** The end a Play press lays `tile` on: the end that scores more (the right on a tie), or -1 when it fits neither. */
export function mgBestEnd(state: MgState, tile: number): number {
  let best = -1;
  let bestPts = -1;
  for (const end of [1, 0]) {
    const next = mgApply(state, tile, end);
    if (next && next.lastScore > bestPts) {
      bestPts = next.lastScore;
      best = end;
    }
  }
  return best;
}

export interface MgView {
  /** The chosen hand tile (-1 none), the button held, the end pressed. */
  sel: number;
  button: number;
  end: number;
}

export function mgNewView(): MgView {
  return { sel: -1, button: 0, end: -1 };
}

/* ---- Art ---- */

const PIP_SPOTS: readonly (readonly [number, number])[][] = [
  [],
  [[0, 0]],
  [[-1, -1], [1, 1]],
  [[-1, -1], [0, 0], [1, 1]],
  [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
];

function pips(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, half: number): void {
  const r = Math.max(1.6, half * 0.12);
  const d = half * 0.27;
  ctx.fillStyle = "#1E1A16";
  for (const [px, py] of PIP_SPOTS[n]!) {
    ctx.beginPath();
    ctx.arc(cx + px * d, cy + py * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One domino: a cream tile with a rounded edge, a centre bar and pips; (x, y) its top-left, `a` the top / left half. */
export function drawDomino(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, b: number, look: { glow?: number; dim?: number; ring?: string } = {}): void {
  const vertical = h > w;
  const short = vertical ? w : h;
  const r = Math.max(3, short * 0.16);
  if (look.glow && look.glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(255,205,90,${Math.min(1, look.glow)})`;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = look.ring ?? `rgba(255,214,110,${Math.min(1, look.glow)})`;
    ctx.lineWidth = 2.5;
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, r + 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "#D9CDAE";
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#FFF9EA");
  g.addColorStop(1, "#EFE4C6");
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2.5, r - 1);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(60,44,20,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(x + w * 0.16, y + h / 2);
    ctx.lineTo(x + w * 0.84, y + h / 2);
  } else {
    ctx.moveTo(x + w / 2, y + h * 0.16);
    ctx.lineTo(x + w / 2, y + h * 0.84);
  }
  ctx.stroke();
  if (vertical) {
    pips(ctx, a, x + w / 2, y + h / 4, short / 2);
    pips(ctx, b, x + w / 2, y + (3 * h) / 4, short / 2);
  } else {
    pips(ctx, a, x + w / 4, y + h / 2, short / 2);
    pips(ctx, b, x + (3 * w) / 4, y + h / 2, short / 2);
  }
  if (look.dim && look.dim > 0) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = `rgba(6,30,18,${Math.min(0.7, look.dim)})`;
    ctx.fill();
  }
}

let baizeCache: { key: string; canvas: HTMLCanvasElement | OffscreenCanvas } | null = null;

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Paints the green baize: lamp-lit, a fine weave, a faint JOULZ and gold stitching. */
export function paintBaize(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = MG_BG;
  c.fillRect(0, 0, w, h);
  const lamp = c.createRadialGradient(w / 2, h * 0.36, 10, w / 2, h * 0.42, Math.max(w, h) * 0.75);
  lamp.addColorStop(0, "rgba(70,170,110,0.5)");
  lamp.addColorStop(0.5, "rgba(20,90,50,0.15)");
  lamp.addColorStop(1, "rgba(0,14,6,0.66)");
  c.fillStyle = lamp;
  c.fillRect(0, 0, w, h);
  c.lineWidth = 0.5;
  for (let y = 0; y < h; y += 3) {
    c.strokeStyle = y % 6 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)";
    c.beginPath();
    c.moveTo(0, y + 0.25);
    c.lineTo(w, y + 0.25);
    c.stroke();
  }
  for (let x = 0; x < w; x += 3) {
    c.strokeStyle = x % 6 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.04)";
    c.beginPath();
    c.moveTo(x + 0.25, 0);
    c.lineTo(x + 0.25, h);
    c.stroke();
  }
  c.save();
  c.translate(w / 2, h * 0.5);
  c.rotate(-0.18);
  c.fillStyle = "rgba(255,255,255,0.03)";
  c.font = `900 ${Math.round(w * 0.24)}px ${CARD_FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("JOULZ", 0, 0);
  c.restore();
  c.strokeStyle = "rgba(233,196,106,0.55)";
  c.lineWidth = 1.2;
  c.setLineDash([5, 4]);
  roundRect(c, 5, 5, w - 10, h - 10, 14);
  c.stroke();
  c.setLineDash([]);
}

function drawBaize(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const t = ctx.getTransform();
  const scale = Math.max(0.5, Math.min(4, Math.hypot(t.a, t.b) || 1));
  const key = `${w}x${h}@${scale.toFixed(3)}`;
  if (!baizeCache || baizeCache.key !== key) {
    const canvas = makeCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
    const c = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (c) {
      c.scale(scale, scale);
      paintBaize(c, w, h);
    }
    baizeCache = { key, canvas };
  }
  ctx.drawImage(baizeCache.canvas as CanvasImageSource, 0, 0, w, h);
}

/** The shared success layer: a scoring play (big plays louder), the hand cleared. */
export const MUGGINS_FX: ArcadeFxSpec<MgState> = {
  game: "muggins",
  world: "cards",
  width: MG_WORLD_W,
  height: MG_WORLD_H,
  shake: false,
  events: [
    { kind: "pop", count: (s) => s.points, at: () => ({ x: MG_WORLD_W / 2, y: MG_ENDS_Y + 20 }), label: (_s, _c, delta) => `+${delta}`, when: (s) => s.lastScore > 0 && s.lastScore < 15 },
    { kind: "combo", count: (s) => s.bigs, at: () => ({ x: MG_WORLD_W / 2, y: MG_ENDS_Y + 20 }), label: (s) => `+${s.lastScore}!` },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "DOMINO!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawMuggins(ctx: CanvasRenderingContext2D, state: MgState, size: CanvasSize, view?: MgView): void {
  arcadeFx(ctx, MUGGINS_FX, state, () => drawMugginsWorld(ctx, state, size, view), size);
}

/** One end's badge: its label, its value; with a chosen tile that fits, lit gold with what laying it there scores. */
function endBadge(ctx: CanvasRenderingContext2D, x: number, label: string, value: number, dbl: boolean, lit: boolean, pressed: boolean, gain: number | null): void {
  roundRect(ctx, x, MG_ENDS_Y, MG_END_W, MG_END_H, 16);
  ctx.fillStyle = pressed ? "rgba(255,226,140,0.95)" : "rgba(4,22,12,0.62)";
  ctx.fill();
  ctx.strokeStyle = lit ? "rgba(255,214,110,0.95)" : "rgba(233,196,106,0.35)";
  ctx.lineWidth = lit ? 2.2 : 1;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = pressed ? "rgba(40,26,4,0.75)" : gain !== null ? (gain > 0 ? "#FFD0E0" : "#F2C75C") : "rgba(233,220,190,0.75)";
  ctx.font = `${gain !== null ? 800 : 700} 12px ${CARD_FONT}`;
  ctx.fillText(gain !== null ? (gain > 0 ? `LAY HERE · +${gain}` : "LAY HERE · +0") : label, x + MG_END_W / 2, MG_ENDS_Y + 15);
  ctx.fillStyle = pressed ? "#231503" : "#F6EBD0";
  ctx.font = `900 28px ${CARD_FONT}`;
  ctx.fillText(dbl ? `${value}+${value}` : String(value), x + MG_END_W / 2, MG_ENDS_Y + 42);
}

function drawMugginsWorld(ctx: CanvasRenderingContext2D, state: MgState, size: CanvasSize, view?: MgView): void {
  const W = MG_WORLD_W;
  const H = MG_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawBaize(ctx, W, H);

  drawChip(ctx, 10, 9, "POINTS", String(state.points), { gold: false });
  drawChip(ctx, W / 2, 9, "PILE", String(state.pile.length - state.pilePos), { align: "center" });
  drawChip(ctx, W - 10, 9, "BIG", `${Math.min(state.bigs, MG_BIG_FULL)}/${MG_BIG_FULL}`, { align: "right", gold: state.bigs >= MG_BIG_FULL });

  const live = state.ended === 0;
  const sel = view && view.sel >= 0 && state.hand.includes(view.sel) ? view.sel : -1;
  const fitL = sel >= 0 && live && mgFits(state, sel, 0);
  const fitR = sel >= 0 && live && mgFits(state, sel, 1);

  // The line.
  const boxes = mgLineLayout(state.line);
  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 20) : 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    const t = state.line[i]!;
    const l = Math.floor(t / 7);
    const r = t % 7;
    const isEnd = i === 0 ? fitL : i === boxes.length - 1 ? fitR : false;
    const justLaid = fresh > 0 && ((state.lastEnd === 0 && i === 0) || (state.lastEnd === 1 && i === boxes.length - 1));
    const glow = isEnd ? 0.85 : justLaid ? fresh : 0;
    if (b.vertical) drawDomino(ctx, b.cx - TILE_SHORT / 2, b.cy - TILE_LONG / 2, TILE_SHORT, TILE_LONG, l, r, { glow });
    else drawDomino(ctx, b.cx - TILE_LONG / 2, b.cy - TILE_SHORT / 2, TILE_LONG, TILE_SHORT, b.flip ? r : l, b.flip ? l : r, { glow });
  }

  // The ends and the running sum.
  const e = mgEnds(state);
  const lone = state.line.length === 1;
  const gainAt = (end: number) => (sel >= 0 && live ? (mgApply(state, sel, end)?.lastScore ?? null) : null);
  // A lone double's two ends are the same end: one choice, shown on both.
  endBadge(ctx, MG_END_LEFT_X, "◀ LEFT", e.l, !lone && e.ld, fitL, view?.end === 0, fitL ? gainAt(0) : null);
  endBadge(ctx, MG_END_RIGHT_X, "RIGHT ▶", e.r, !lone && e.rd, fitR, view?.end === 1, fitR ? gainAt(1) : null);
  const sum = mgEndSum(state);
  const scores = !lone && mgScoreOf(sum) > 0;
  const cx = W / 2;
  const cy = MG_ENDS_Y + MG_END_H / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(4,22,12,0.7)";
  ctx.fill();
  ctx.strokeStyle = scores ? MG_PINK : "rgba(233,196,106,0.4)";
  ctx.lineWidth = scores ? 3 : 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(233,220,190,0.75)";
  ctx.font = `700 11px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SUM", cx, cy - 16);
  ctx.fillStyle = scores ? "#FFD0E0" : "#F6EBD0";
  ctx.font = `900 28px ${CARD_FONT}`;
  ctx.fillText(String(sum), cx, cy + 6);
  ctx.fillStyle = "rgba(246,235,208,0.7)";
  ctx.font = `700 12px ${CARD_FONT}`;
  ctx.fillText(state.lastScore > 0 && fresh > 0 ? `SCORED ${state.lastScore}` : "ENDS ADD TO 5 · 10 · 15 · 20 TO SCORE", cx, MG_ENDS_Y + MG_END_H + 18);

  // The hand.
  const playable = new Set(live ? mgPlays(state).map((p) => p[0]) : []);
  const hand = mgHandLayout(state.hand.length);
  for (let i = 0; i < hand.length; i++) {
    const b = hand[i]!;
    const t = state.hand[i]!;
    const [a, c] = MG_TILE_PIPS[t]!;
    const chosen = t === sel;
    drawDomino(ctx, b.x, b.y - (chosen ? 10 : 0), b.w, b.h, a, c, { glow: chosen ? 1 : playable.has(t) ? 0.4 : 0, dim: live && !playable.has(t) ? 0.28 : 0 });
  }
  if (state.hand.length === 0) {
    ctx.fillStyle = "rgba(246,235,208,0.8)";
    ctx.font = `800 18px ${CARD_FONT}`;
    ctx.fillText("HAND CLEARED", W / 2, MG_HAND_TOP + MG_HAND_H / 2);
  }

  // The buttons.
  const canDraw = live && playable.size === 0 && state.pilePos < state.pile.length;
  for (const b of MG_BUTTONS) {
    let liveBtn = live;
    if (b.kind === MG_INPUT_UNDO) liveBtn = live && state.hist.length > 0;
    else if (b.kind === MG_INPUT_RESET) liveBtn = live && (state.hist.length > 0 || state.resets > 0);
    else if (b.kind === MG_INPUT_DRAW) liveBtn = canDraw;
    else liveBtn = live && sel >= 0 && (fitL || fitR);
    const next = b.kind === MG_INPUT_DRAW ? mgNextTile(state) : -1;
    // Draw shows the pile's next tile face up on its right (the same tile for everyone; the label moves over for it).
    const box = next >= 0 ? { ...b.box, w: b.box.w - 44 } : b.box;
    if (next >= 0) {
      roundRect(ctx, b.box.x, b.box.y, b.box.w, b.box.h, Math.min(16, b.box.h / 2));
      ctx.fillStyle = canDraw ? "rgba(233,196,106,0.95)" : "rgba(5,12,30,0.66)";
      ctx.fill();
    }
    drawCardButton(ctx, box, b.icon, b.label, { live: liveBtn, held: view?.button === b.kind, primary: (b.kind === MG_INPUT_PLAY && liveBtn) || (b.kind === MG_INPUT_DRAW && canDraw) });
    if (next >= 0) {
      const [a, c] = MG_TILE_PIPS[next]!;
      const tw = 20;
      const th = 38;
      drawDomino(ctx, b.box.x + b.box.w - tw - 14, b.box.y + b.box.h - th - 5, tw, th, a, c);
      ctx.fillStyle = canDraw ? "rgba(40,26,4,0.75)" : "rgba(233,220,190,0.6)";
      ctx.font = `800 9px ${CARD_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NEXT", b.box.x + b.box.w - tw / 2 - 14, b.box.y + 8);
    }
  }
  ctx.restore();
}

export function mugginsArtGame(view?: MgView): ArcadeGame<MgState, ArcadeInputEvent | null> {
  return { ...mugginsGame, draw: (ctx, state, size) => drawMuggins(ctx, state, size, view) };
}

export const mugginsArt = mugginsArtGame();
