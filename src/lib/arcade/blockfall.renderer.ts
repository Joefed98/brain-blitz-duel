/**
 * Blockfall's art and layout (display only; the sim is blockfall.ts). The world is 414 × 744: HUD chips across the
 * top, the 10 × 20 well in the middle (29 px squares), the next three pieces on the right, the held piece on the
 * left, and under the well, within thumb reach, three pads: HOLD, TURN and DROP (the same inputs as the gestures). Our own look in Retro's neon cyan family: each square a glass tile, a dark
 * tinted core inside a bright neon rim with a small corner glint; the ghost is the piece's rim alone, dashed. The
 * shapes' colours are our own (ice, aqua, sky, mint, violet-blue, cobalt, pale lilac), not the classic set. A clear
 * flashes its rows' band white-cyan for a moment. `blockfallScene` carries the cabinet's dark glow out to the
 * screen's edges (painted per size, never per frame).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import { RETRO_FONT } from "./retro.renderer";
import {
  BF_CORE_FULL, BF_GRAVITY, BF_H, BF_HIDDEN, BF_PREVIEW, BF_W, bfCells, bfGhostY, bfLevel, bfMultiPoints, blockfallGame, type BfState,
} from "./blockfall";

export const BF_WORLD_W = 414;
export const BF_WORLD_H = 744;
export const BF_BG = "#050B16";
export const BF_CELL = 29;
export const BF_BOARD_X = Math.round((BF_WORLD_W - BF_W * BF_CELL) / 2);
export const BF_BOARD_Y = 42;
export const BF_BOARD_W = BF_W * BF_CELL;
export const BF_BOARD_H = BF_H * BF_CELL;
/** The side columns: next pieces on the right, the held piece on the left. */
const SIDE_W = BF_BOARD_X - 8;
export const BF_HOLD_BOX = { x: 4, y: BF_BOARD_Y, w: SIDE_W, h: 84 };
const NEXT_X = BF_BOARD_X + BF_BOARD_W + 4;
/** The control pads under the well (thumb reach): hold, turn, drop. */
export const BF_PAD_Y = BF_BOARD_Y + BF_BOARD_H + 14;
export const BF_PAD_H = BF_WORLD_H - BF_PAD_Y - 10;
const PAD_GAP = 8;
const PAD_W = (BF_WORLD_W - 16 - 2 * PAD_GAP) / 3;
export const BF_PADS = [
  { id: "hold", label: "HOLD", x: 8, y: BF_PAD_Y, w: PAD_W, h: BF_PAD_H },
  { id: "turn", label: "TURN", x: 8 + PAD_W + PAD_GAP, y: BF_PAD_Y, w: PAD_W, h: BF_PAD_H },
  { id: "drop", label: "DROP", x: 8 + 2 * (PAD_W + PAD_GAP), y: BF_PAD_Y, w: PAD_W, h: BF_PAD_H },
] as const;
export type BfPadId = (typeof BF_PADS)[number]["id"];

/** Each shape's neon (rim) and core colours: our own cyan family. */
export const BF_COLOURS: readonly { rim: string; core: string }[] = [
  { rim: "#E4E0FF", core: "#2B2850" }, // bar: pale lilac
  { rim: "#36E2F5", core: "#08343D" }, // square: Retro cyan
  { rim: "#5AB8FF", core: "#0B2A4A" }, // tee: sky
  { rim: "#5CF2C4", core: "#0A3A30" }, // step right: mint
  { rim: "#9A8CFF", core: "#221C52" }, // step left: violet-blue
  { rim: "#9FFFF0", core: "#0E3C3A" }, // hook left: aqua
  { rim: "#4D7BFF", core: "#0E1C4E" }, // hook right: cobalt
];

/** The pad under a world point (half the gap round each), or null; the held piece's box counts as HOLD too. */
export function bfPadAt(x: number, y: number): BfPadId | null {
  for (const p of BF_PADS) if (x >= p.x - PAD_GAP / 2 && x <= p.x + p.w + PAD_GAP / 2 && y >= p.y - 6 && y <= BF_WORLD_H) return p.id;
  const b = BF_HOLD_BOX;
  if (x >= 0 && x <= b.x + b.w + 2 && y >= b.y - 6 && y <= b.y + b.h + 6) return "hold";
  return null;
}

export interface BfView {
  /** The pad under the finger (display only). */
  pressed: BfPadId | null;
}

export function bfNewView(): BfView {
  return { pressed: null };
}

/** A pad: a dark glass button with a neon rim, a small glyph and its word; lit while pressed. */
function drawPad(ctx: CanvasRenderingContext2D, p: (typeof BF_PADS)[number], on: boolean, dim: boolean): void {
  ctx.fillStyle = on ? "rgba(54,226,245,0.22)" : "rgba(6,22,34,0.85)";
  ctx.strokeStyle = dim ? "rgba(54,226,245,0.25)" : on ? "#9FFFF0" : "rgba(54,226,245,0.6)";
  ctx.lineWidth = on ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.stroke();
  const ink = dim ? "rgba(160,236,248,0.35)" : "#E8FDFF";
  ctx.fillStyle = ink;
  ctx.font = `12px ${RETRO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.label, p.x + p.w / 2, p.y + p.h / 2 + 16);
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2 - 10;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (p.id === "hold") {
    ctx.rect(cx - 12, cy - 6, 10, 10);
    ctx.rect(cx + 2, cy - 6, 10, 10);
  } else if (p.id === "turn") {
    ctx.arc(cx, cy, 9, -Math.PI * 0.9, Math.PI * 0.6);
    ctx.moveTo(cx - 9, cy - 1);
    ctx.lineTo(cx - 9 + 4, cy - 7);
  } else {
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 8);
    ctx.moveTo(cx - 7, cy + 2);
    ctx.lineTo(cx, cy + 9);
    ctx.lineTo(cx + 7, cy + 2);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** One square: a dark tinted core in a bright neon rim with a corner glint. */
export function drawBfSquare(ctx: CanvasRenderingContext2D, shape: number, x: number, y: number, size: number, alpha = 1): void {
  const c = BF_COLOURS[shape] ?? BF_COLOURS[1]!;
  const inset = Math.max(1, Math.round(size * 0.06));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = c.core;
  ctx.fillRect(x + inset, y + inset, size - 2 * inset, size - 2 * inset);
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = Math.max(1.5, size * 0.11);
  const lw = ctx.lineWidth;
  ctx.strokeRect(x + inset + lw / 2, y + inset + lw / 2, size - 2 * inset - lw, size - 2 * inset - lw);
  // An inner glow line and the corner glint.
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = c.rim;
  ctx.fillRect(x + inset + lw, y + size / 2 - size * 0.04, size - 2 * inset - 2 * lw, size * 0.08);
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = "#FFFFFF";
  const g = Math.max(1.5, size * 0.12);
  ctx.fillRect(x + inset + lw + 1, y + inset + lw + 1, g, g);
  ctx.globalAlpha = 1;
}

function drawGhostSquare(ctx: CanvasRenderingContext2D, shape: number, x: number, y: number, size: number): void {
  const c = BF_COLOURS[shape] ?? BF_COLOURS[1]!;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
  ctx.restore();
}

/** A shape drawn small and centred in a box (the next and hold previews). */
export function drawBfMini(ctx: CanvasRenderingContext2D, shape: number, cx: number, cy: number, size: number, alpha = 1): void {
  const cells = bfCells(shape, 0);
  let x0 = 9;
  let x1 = -9;
  let y0 = 9;
  let y1 = -9;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const w = (x1 - x0 + 1) * size;
  const h = (y1 - y0 + 1) * size;
  for (const [x, y] of cells) drawBfSquare(ctx, shape, cx - w / 2 + (x - x0) * size, cy - h / 2 + (y - y0) * size, size, alpha);
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, align: "left" | "center" | "right", hot = false): void {
  ctx.font = `9px ${RETRO_FONT}`;
  const lw = ctx.measureText(label).width;
  ctx.font = `13px ${RETRO_FONT}`;
  const vw = ctx.measureText(value).width;
  const w = lw + vw + 22;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = "rgba(6,22,34,0.9)";
  ctx.strokeStyle = hot ? "#F2C75C" : "rgba(54,226,245,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(left, y, w, 26, 6);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(160,236,248,0.8)";
  ctx.font = `9px ${RETRO_FONT}`;
  ctx.fillText(label, left + 8, y + 14);
  ctx.fillStyle = hot ? "#F2C75C" : "#E8FDFF";
  ctx.font = `13px ${RETRO_FONT}`;
  ctx.fillText(value, left + 14 + lw, y + 14);
}

/** The shared success layer: a pop for every clear (bigger for two or more at once) and the core filled. */
export const BLOCKFALL_FX: ArcadeFxSpec<BfState> = {
  game: "blockfall",
  world: "retro",
  width: BF_WORLD_W,
  height: BF_WORLD_H,
  shake: false,
  events: [
    {
      kind: "pop",
      count: (s) => s.lines,
      at: (s) => ({ x: BF_BOARD_X + BF_BOARD_W / 2, y: BF_BOARD_Y + ((s.cleared[0] ?? BF_HIDDEN + BF_H - 1) - BF_HIDDEN) * BF_CELL }),
      label: (_s, _c, delta) => (delta >= 2 ? `${delta} LINES!` : "+1"),
      textScale: 1,
    },
    { kind: "combo", count: (s) => s.triples + s.quads, label: (s) => (s.cleared.length >= 4 ? "FOUR AT ONCE!" : "THREE AT ONCE!"), neon: true },
    { kind: "final", count: (s) => (s.lines >= BF_CORE_FULL ? 1 : 0), label: () => "FULL LINES!" },
  ],
  misses: [{ count: (s) => (s.ended === 2 ? 1 : 0), at: () => ({ x: BF_BOARD_X + BF_BOARD_W / 2, y: BF_BOARD_Y + 30 }) }],
};

export function drawBlockfall(ctx: CanvasRenderingContext2D, state: BfState, size: CanvasSize, view?: BfView): void {
  arcadeFx(ctx, BLOCKFALL_FX, state, () => drawBlockfallWorld(ctx, state, size, view), size);
}

function drawBlockfallWorld(ctx: CanvasRenderingContext2D, state: BfState, size: CanvasSize, view?: BfView): void {
  const W = BF_WORLD_W;
  const H = BF_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  // The cabinet: deep navy fading to black, a faint cyan haze behind the well.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#071425");
  bg.addColorStop(1, BF_BG);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // HUD.
  const level = bfLevel(state.tick);
  chip(ctx, 8, 8, "LINES", String(state.lines), "left", state.lines >= BF_CORE_FULL);
  chip(ctx, W / 2, 8, "SPEED", `${level + 1}/${BF_GRAVITY.length}`, "center");
  chip(ctx, W - 8, 8, "MULTI", String(Math.min(40, bfMultiPoints(state))), "right", bfMultiPoints(state) >= 40);

  // The well: a dark glass panel with a faint grid.
  const bx = BF_BOARD_X;
  const by = BF_BOARD_Y;
  ctx.fillStyle = "#03080F";
  ctx.fillRect(bx, by, BF_BOARD_W, BF_BOARD_H);
  ctx.strokeStyle = "rgba(54,226,245,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < BF_W; x++) {
    ctx.moveTo(bx + x * BF_CELL + 0.5, by);
    ctx.lineTo(bx + x * BF_CELL + 0.5, by + BF_BOARD_H);
  }
  for (let y = 1; y < BF_H; y++) {
    ctx.moveTo(bx, by + y * BF_CELL + 0.5);
    ctx.lineTo(bx + BF_BOARD_W, by + y * BF_CELL + 0.5);
  }
  ctx.stroke();
  // The low-stack line: the top of the bottom four rows.
  ctx.strokeStyle = "rgba(242,199,92,0.28)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(bx, by + (BF_H - 4) * BF_CELL + 0.5);
  ctx.lineTo(bx + BF_BOARD_W, by + (BF_H - 4) * BF_CELL + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Settled squares (visible rows only).
  for (let y = BF_HIDDEN; y < BF_HIDDEN + BF_H; y++) {
    for (let x = 0; x < BF_W; x++) {
      const v = state.board[y * BF_W + x]!;
      if (v) drawBfSquare(ctx, v - 1, bx + x * BF_CELL, by + (y - BF_HIDDEN) * BF_CELL, BF_CELL);
    }
  }

  // The ghost, then the falling piece.
  if (state.ended === 0) {
    const p = state.piece;
    const gy = bfGhostY(state.board, p);
    for (const [cx, cy] of bfCells(p.shape, p.turn)) {
      const row = gy + cy - BF_HIDDEN;
      if (row >= 0) drawGhostSquare(ctx, p.shape, bx + (p.x + cx) * BF_CELL, by + row * BF_CELL, BF_CELL);
    }
    for (const [cx, cy] of bfCells(p.shape, p.turn)) {
      const row = p.y + cy - BF_HIDDEN;
      if (row >= 0) drawBfSquare(ctx, p.shape, bx + (p.x + cx) * BF_CELL, by + row * BF_CELL, BF_CELL);
    }
  }

  // A clear: the rows' band flashes white-cyan for 18 ticks.
  const since = state.tick - state.clearTick;
  if (state.cleared.length && since >= 0 && since < 18) {
    const a = 1 - since / 18;
    ctx.fillStyle = `rgba(200,250,255,${(0.55 * a).toFixed(3)})`;
    // The cleared rows are gone; the band lights where the stack fell to, one row per row cleared.
    const rows = state.cleared.length;
    const lowest = state.cleared[state.cleared.length - 1]! - BF_HIDDEN;
    ctx.fillRect(bx, by + (lowest - rows + 1) * BF_CELL, BF_BOARD_W, rows * BF_CELL);
  }

  // The well's rim: a neon cyan line.
  ctx.strokeStyle = "rgba(54,226,245,0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx - 1, by - 1, BF_BOARD_W + 2, BF_BOARD_H + 2);

  // Next three, top right.
  ctx.font = `8px ${RETRO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(160,236,248,0.85)";
  ctx.fillText("NEXT", NEXT_X + SIDE_W / 2, by + 8);
  for (let i = 0; i < BF_PREVIEW; i++) {
    const cy = by + 44 + i * 60;
    ctx.fillStyle = "rgba(6,22,34,0.75)";
    ctx.fillRect(NEXT_X, cy - 25, SIDE_W, 50);
    const shape = state.queue[i];
    if (shape !== undefined) drawBfMini(ctx, shape, NEXT_X + SIDE_W / 2, cy, i === 0 ? 12 : 10, i === 0 ? 1 : 0.75);
  }

  // The held piece, top left.
  const hb = BF_HOLD_BOX;
  ctx.fillStyle = "rgba(6,22,34,0.85)";
  ctx.strokeStyle = state.held ? "rgba(54,226,245,0.25)" : "rgba(54,226,245,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hb.x, hb.y, hb.w, hb.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(160,236,248,0.85)";
  ctx.fillText("HOLD", hb.x + hb.w / 2, hb.y + 12);
  if (state.hold >= 0) drawBfMini(ctx, state.hold, hb.x + hb.w / 2, hb.y + hb.h / 2 + 8, 11, state.held ? 0.4 : 1);

  // The pads.
  for (const p of BF_PADS) drawPad(ctx, p, view?.pressed === p.id, state.ended !== 0 || (p.id === "hold" && state.held === 1));

  ctx.restore();
}

/** The cabinet's glow carried out past the world to the screen's edges (display only, painted once per size). */
export function blockfallScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#050E1C"], [1, "#071425"]]);
  for (const side of fillSides(view)) fillGradient(ctx, side, side.y, side.y + side.h, [[0, "#071425"], [1, BF_BG]]);
  const below = fillBelow(view);
  if (below) fillGradient(ctx, below, below.y, below.y + below.h, [[0, BF_BG], [0.5, "#06101E"], [1, "#040912"]]);
}

export function blockfallArtGame(view?: BfView): ArcadeGame<BfState, ArcadeInputEvent | null> {
  return { ...blockfallGame, draw: (ctx, state, size) => drawBlockfall(ctx, state, size, view) };
}

export const blockfallArt = blockfallArtGame();
