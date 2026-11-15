/**
 * Blockzone's (Blockfall's) art and layout (display only; the sim is blockfall.ts). The world is 414 × 744 on every
 * revision. blockfallRev 1: HUD chips across the top, the 10 × 20 well in the middle (29 px squares), the next three
 * pieces on the right, the held piece on the left, and under the well three pads: HOLD, TURN and DROP. blockfallRev 2
 * (Blockzone, 3 Nov 2026): no hold and no pads, so the well takes the freed space (34 px squares, 340 × 680) with the
 * next three and the speed in a column on its right (`bfLayout`).
 *
 * Our own look in Retro's neon cyan family (3 Nov 2026, both revisions): each square bevelled, a lit top-left edge and
 * a shaded bottom-right one round a tinted face with an inner highlight; a softly glowing well edge over a faint grid;
 * the ghost a tinted fill inside the piece's solid rim; a clear a short white-cyan flash across its rows. The shapes'
 * colours are our own (ice, aqua, sky, mint, violet-blue, cobalt, pale lilac), not the classic set.
 * `blockfallScene` carries the cabinet's dark glow out to the screen's edges (painted per size, never per frame).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { fxFlash, fxSparks, fxStreak, retroFx } from "./retroFx.renderer";
import { reducedMotion } from "./art.renderer";
import { bfNearTop } from "./retroMoments";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";

import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { fillAbove, fillBelow, fillGradient, fillSides } from "./arenaFills.renderer";
import { retroHud, retroMix, retroTextFloor, RETRO_FONT, RETRO_WHITE, withRetroTextFloor } from "./retro.renderer";
import {
  BF_H, BF_HIDDEN, BF_PREVIEW, BF_W, BF_ZONE_MULTI_MAX, BF_ZONE_PIECES_MAX, BLOCKFALL_REV_ZONE, bfCells, bfCoreFullFor, bfGhostY, bfGravityFor, bfLevelFor,
  bfMultiPoints, blockfallGame, blockfallGameFor, type BfState,
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

/** A revision's layout: the well's square size and place, the side column, and whether the hold box and pads show. */
export interface BfLayout {
  cell: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  nextX: number;
  sideW: number;
  pads: boolean;
}
const LAYOUT_V1: BfLayout = { cell: BF_CELL, bx: BF_BOARD_X, by: BF_BOARD_Y, bw: BF_BOARD_W, bh: BF_BOARD_H, nextX: NEXT_X, sideW: SIDE_W, pads: true };
/** Blockzone: 34 px squares, the well at the left, the next three and the speed on its right. */
export const BF_ZONE_CELL = 34;
const LAYOUT_V2: BfLayout = {
  cell: BF_ZONE_CELL, bx: 8, by: 44, bw: BF_W * BF_ZONE_CELL, bh: BF_H * BF_ZONE_CELL,
  nextX: 8 + BF_W * BF_ZONE_CELL + 6, sideW: BF_WORLD_W - (8 + BF_W * BF_ZONE_CELL + 6) - 6, pads: false,
};
export function bfLayout(rev: number | null | undefined): BfLayout {
  return rev === BLOCKFALL_REV_ZONE ? LAYOUT_V2 : LAYOUT_V1;
}

/**
 * Each shape's neon (rim) and core colours. Since 3 Nov 2026 (Joe's audit, display only) seven clearly different
 * hues of our own neon palette, so the shapes tell apart at a glance (the old cyan family's three cool blues
 * read alike); deliberately not the familiar falling-blocks colours or their usual shape-to-colour mapping.
 */
export const BF_COLOURS: readonly { rim: string; core: string }[] = [
  { rim: "#FF4FD8", core: "#4A0B40" }, // bar: hot magenta
  { rim: "#A6FF3A", core: "#2A4A08" }, // square: neon lime
  { rim: "#FFB02E", core: "#4E3006" }, // tee: amber
  { rim: "#36E2F5", core: "#08343D" }, // step right: Retro cyan
  { rim: "#FF5A5A", core: "#4E0E0E" }, // step left: coral
  { rim: "#A57CFF", core: "#25135A" }, // hook left: violet
  { rim: "#FFFFFF", core: "#6C7896" }, // hook right: pearl white
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
  ctx.font = `${Math.max(12, retroTextFloor())}px ${RETRO_FONT}`;
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

/**
 * One square, bevelled: a lit top-left edge and a shaded bottom-right one round a tinted face, a neon rim line and an
 * inner highlight (our own look, 3 Nov 2026).
 */
export function drawBfSquare(ctx: CanvasRenderingContext2D, shape: number, x: number, y: number, size: number, alpha = 1): void {
  const c = BF_COLOURS[shape] ?? BF_COLOURS[1]!;
  const inset = Math.max(1, Math.round(size * 0.05));
  const x0 = x + inset;
  const y0 = y + inset;
  const w = size - 2 * inset;
  const bev = Math.max(2, Math.round(size * 0.16));
  ctx.globalAlpha = alpha;
  // The Retro overhaul (15 Nov 2026): a solid, chunky block, never a hollow outline. Blockzone's glow is the brief's one
  // exception to the minimal-glow rule: a soft halo of the block's own colour inside its cell, under the face.
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = c.rim;
  ctx.fillRect(x, y, size, size);
  ctx.globalAlpha = alpha;
  // The face: the rim colour, solid, deepening towards the bottom (lacquer with depth).
  ctx.fillStyle = c.rim;
  ctx.fillRect(x0, y0, w, w);
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = c.core;
  ctx.fillRect(x0, y0 + Math.round(w * 0.55), w, w - Math.round(w * 0.55));
  ctx.globalAlpha = alpha;
  // The bevel: light along the top and left, shade along the bottom and right.
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + w, y0);
  ctx.lineTo(x0 + w - bev, y0 + bev);
  ctx.lineTo(x0 + bev, y0 + bev);
  ctx.lineTo(x0 + bev, y0 + w - bev);
  ctx.lineTo(x0, y0 + w);
  ctx.closePath();
  ctx.globalAlpha = alpha * 0.32;
  ctx.fill();
  ctx.fillStyle = "#000814";
  ctx.beginPath();
  ctx.moveTo(x0 + w, y0);
  ctx.lineTo(x0 + w, y0 + w);
  ctx.lineTo(x0, y0 + w);
  ctx.lineTo(x0 + bev, y0 + w - bev);
  ctx.lineTo(x0 + w - bev, y0 + w - bev);
  ctx.lineTo(x0 + w - bev, y0 + bev);
  ctx.closePath();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fill();
  // The neon rim and the inner highlight.
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.strokeRect(x0 + ctx.lineWidth / 2, y0 + ctx.lineWidth / 2, w - ctx.lineWidth, w - ctx.lineWidth);
  // A crisp gloss on the face: a bright streak across its upper part and a small hot spot at its left (light on a
  // glossy surface, never a wash over the block).
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x0 + bev, y0 + bev, w - 2 * bev, Math.max(1, Math.round(size * 0.1)));
  ctx.globalAlpha = alpha * 0.95;
  const g = Math.max(1.5, size * 0.14);
  ctx.fillRect(x0 + bev + 1, y0 + bev + 1, g, Math.max(1, g * 0.6));
  // Stage 2: a lit gem centre, the face's core colour glowing in its middle (a jewel, lit from within).
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = retroMix(c.rim, "#FFFFFF", 0.45);
  const m = Math.round(w * 0.3);
  ctx.fillRect(Math.round(x0 + (w - m) / 2), Math.round(y0 + (w - m) / 2), m, m);
  ctx.globalAlpha = 1;
}

/** The ghost: a faint tint of the piece inside its solid rim, so where it lands reads at a glance. */
function drawGhostSquare(ctx: CanvasRenderingContext2D, shape: number, x: number, y: number, size: number): void {
  const c = BF_COLOURS[shape] ?? BF_COLOURS[1]!;
  ctx.save();
  // Brighter since 3 Nov 2026 (Joe's audit): a stronger tint and a full-strength 2 px rim.
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = c.rim;
  ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2.5, y + 2.5, size - 5, size - 5);
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
      at: (s) => {
        const L = bfLayout(s.rev);
        return { x: L.bx + L.bw / 2, y: L.by + ((s.cleared[0] ?? BF_HIDDEN + BF_H - 1) - BF_HIDDEN) * L.cell };
      },
      label: (_s, _c, delta) => (delta >= 2 ? `${delta} LINES!` : "+1"),
      textScale: 1,
    },
    { kind: "combo", count: (s) => s.triples + s.quads, label: (s) => (s.cleared.length >= 4 ? "FOUR AT ONCE!" : "THREE AT ONCE!"), neon: true },
    { kind: "final", count: (s) => (s.lines >= bfCoreFullFor(s.rev) ? 1 : 0), label: () => "FULL LINES!" },
  ],
  misses: [{ count: (s) => (s.ended === 2 ? 1 : 0), at: (s) => ({ x: bfLayout(s.rev).bx + bfLayout(s.rev).bw / 2, y: bfLayout(s.rev).by + 30 }) }],
};

export function drawBlockfall(ctx: CanvasRenderingContext2D, state: BfState, size: CanvasSize, view?: BfView): void {
  // The on-screen text floor for this world (the Retro overhaul, retroScale.ts).
  withRetroTextFloor(BF_WORLD_W, BF_WORLD_H, () => arcadeFx(ctx, BLOCKFALL_FX, state, () => drawBlockfallWorld(ctx, state, size, view), size));
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
  paintBlockzoneCabinet(ctx, W, H);

  // HUD.
  const L = bfLayout(state.rev);
  const zone = state.rev === BLOCKFALL_REV_ZONE;
  const level = bfLevelFor(state.tick, state.rev);
  const full = bfCoreFullFor(state.rev);
  const multiMax = zone ? BF_ZONE_MULTI_MAX : 40;
  // One Retro HUD (3 Nov 2026): lines top left, pieces (or the speed, blockfallRev 1) and multi-clears top
  // right, in place of the three chips; "MULTI" is now "MULTI-CLEARS" (the count of 2-, 3- and 4-line clears).
  const hot = "#F2C75C";
  const multiClears = state.doubles + state.triples + state.quads;
  retroHud(
    ctx,
    W,
    { text: `LINES ${state.lines}`, colour: state.lines >= full ? hot : RETRO_WHITE },
    [
      zone
        ? { text: `PIECES ${state.pieces}`, colour: state.pieces >= BF_ZONE_PIECES_MAX ? hot : RETRO_WHITE }
        : { text: `SPEED ${level + 1}/${bfGravityFor(state.rev).length}` },
      { text: `MULTI-CLEARS ${multiClears}`, colour: bfMultiPoints(state) >= multiMax ? hot : RETRO_WHITE },
    ],
    { top: 5, pitch: 16 },
  );

  // The well: a dark glass panel with a faint grid and a softly glowing edge.
  const bx = L.bx;
  const by = L.by;
  const cell = L.cell;
  // The glow: a few wide, faint cyan strokes round the well (no shadow blur: it is drawn every frame).
  for (const [w, a] of [[14, 0.05], [9, 0.08], [5, 0.12]] as const) {
    ctx.strokeStyle = `rgba(54,226,245,${a})`;
    ctx.lineWidth = w;
    ctx.strokeRect(bx - 1, by - 1, L.bw + 2, L.bh + 2);
  }
  // Stage 2 of the Retro overhaul (Joe: "a clear lift"): the well's back wall is dark glass shading from deep teal to
  // violet with a soft light falling from its top, a grid of fine dots at the cell corners in place of lines, and a
  // chrome bevel just inside the glow (lit on its top and left, in shade on its right and bottom).
  const wall = ctx.createLinearGradient(0, by, 0, by + L.bh);
  wall.addColorStop(0, "#04141E");
  wall.addColorStop(0.6, "#060B18");
  wall.addColorStop(1, "#0C0820");
  ctx.fillStyle = wall;
  ctx.fillRect(bx, by, L.bw, L.bh);
  const light = ctx.createRadialGradient(bx + L.bw / 2, by - 40, 10, bx + L.bw / 2, by, L.bh * 0.7);
  light.addColorStop(0, "rgba(54,226,245,0.12)");
  light.addColorStop(1, "rgba(54,226,245,0)");
  ctx.fillStyle = light;
  ctx.fillRect(bx, by, L.bw, L.bh);
  ctx.fillStyle = "rgba(120,220,255,0.22)";
  for (let x = 1; x < BF_W; x++) for (let y = 1; y < BF_H; y++) ctx.fillRect(Math.round(bx + x * cell) - 1, Math.round(by + y * cell) - 1, 2, 2);
  ctx.fillStyle = "#9FB6CC";
  ctx.fillRect(bx - 3, by - 3, L.bw + 6, 2);
  ctx.fillRect(bx - 3, by - 3, 2, L.bh + 6);
  ctx.fillStyle = "#26303E";
  ctx.fillRect(bx - 3, by + L.bh + 1, L.bw + 6, 2);
  ctx.fillRect(bx + L.bw + 1, by - 3, 2, L.bh + 6);
  // The low-stack line: the top of the bottom four rows.
  ctx.strokeStyle = "rgba(242,199,92,0.28)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(bx, by + (BF_H - 4) * cell + 0.5);
  ctx.lineTo(bx + L.bw, by + (BF_H - 4) * cell + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Stage 2 of the Retro overhaul (Joe: "the glow emphasised"): a neon halo round the stack, drawn first for every
  // settled square and the falling piece, 5 px past each square in its own colour, so the whole stack glows at its
  // outline while every face (drawn after) stays crisp. Under reduced effects, none.
  if (!arcadeReducedEffects()) {
    const halo = (shape: number, x: number, y: number) => {
      const c = BF_COLOURS[shape] ?? BF_COLOURS[1]!;
      ctx.fillStyle = c.rim;
      ctx.globalAlpha = 0.07;
      ctx.fillRect(x - 5, y - 5, cell + 10, cell + 10);
      ctx.globalAlpha = 0.09;
      ctx.fillRect(x - 2, y - 2, cell + 4, cell + 4);
    };
    for (let y = BF_HIDDEN; y < BF_HIDDEN + BF_H; y++)
      for (let x = 0; x < BF_W; x++) {
        const v = state.board[y * BF_W + x]!;
        if (v) halo(v - 1, bx + x * cell, by + (y - BF_HIDDEN) * cell);
      }
    if (state.ended === 0)
      for (const [cx, cy] of bfCells(state.piece.shape, state.piece.turn)) {
        const row = state.piece.y + cy - BF_HIDDEN;
        if (row >= 0) halo(state.piece.shape, bx + (state.piece.x + cx) * cell, by + row * cell);
      }
    ctx.globalAlpha = 1;
  }
  // Settled squares (visible rows only). The Retro overhaul, stage 2: for 6 ticks after a clear the rows that were
  // above it slide down the last of the way into their new places, so the drop reads (display only; the board is
  // already compacted, and nothing is drawn outside the well).
  const dropAge = state.tick - state.clearTick;
  const dropRows = state.cleared.length;
  const dropBelow = dropRows ? state.cleared[dropRows - 1]! : -1;
  const dropping = dropRows > 0 && dropAge >= 0 && dropAge < 6 && !reducedMotion();
  for (let y = BF_HIDDEN; y < BF_HIDDEN + BF_H; y++) {
    const lift = dropping && y <= dropBelow ? Math.round(dropRows * cell * (1 - dropAge / 6) * 0.5) : 0;
    for (let x = 0; x < BF_W; x++) {
      const v = state.board[y * BF_W + x]!;
      if (v) drawBfSquare(ctx, v - 1, bx + x * cell, Math.max(by, by + (y - BF_HIDDEN) * cell - lift), cell);
    }
  }

  // The ghost, then the falling piece.
  if (state.ended === 0) {
    const p = state.piece;
    const gy = bfGhostY(state.board, p);
    if (gy !== p.y) {
      for (const [cx, cy] of bfCells(p.shape, p.turn)) {
        const row = gy + cy - BF_HIDDEN;
        if (row >= 0) drawGhostSquare(ctx, p.shape, bx + (p.x + cx) * cell, by + row * cell, cell);
      }
    }
    for (const [cx, cy] of bfCells(p.shape, p.turn)) {
      const row = p.y + cy - BF_HIDDEN;
      if (row >= 0) drawBfSquare(ctx, p.shape, bx + (p.x + cx) * cell, by + row * cell, cell);
    }
  }

  // A clear: a short white-cyan flash across the rows, fading from the middle out (12 ticks).
  const since = state.tick - state.clearTick;
  if (state.cleared.length && since >= 0 && since < 12) {
    const a = 1 - since / 12;
    const rows = state.cleared.length;
    const lowest = state.cleared[state.cleared.length - 1]! - BF_HIDDEN;
    const y0 = by + (lowest - rows + 1) * cell;
    const g = ctx.createLinearGradient(bx, 0, bx + L.bw, 0);
    g.addColorStop(0, `rgba(160,240,255,${(0.25 * a).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(235,255,255,${(0.75 * a).toFixed(3)})`);
    g.addColorStop(1, `rgba(160,240,255,${(0.25 * a).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(bx, y0, L.bw, rows * cell);
  }

  blockzoneEffects(ctx, state, bx, by, cell, L.bw);

  // The well's rim: a neon cyan line with a soft glow.
  ctx.strokeStyle = "rgba(54,226,245,0.25)";
  ctx.lineWidth = 4;
  ctx.strokeRect(bx - 1, by - 1, L.bw + 2, L.bh + 2);
  ctx.strokeStyle = "rgba(54,226,245,0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx - 1, by - 1, L.bw + 2, L.bh + 2);

  // Next three, top right.
  ctx.font = `${retroTextFloor()}px ${RETRO_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = RETRO_WHITE;
  ctx.fillText("NEXT", L.nextX + L.sideW / 2, by + 8);
  for (let i = 0; i < BF_PREVIEW; i++) {
    const cy = by + 44 + i * 60;
    // Brighter since 3 Nov 2026: a lit box (the first framed in its piece's colour) and full-strength pieces.
    ctx.fillStyle = "rgba(20,44,64,0.9)";
    ctx.fillRect(L.nextX, cy - 25, L.sideW, 50);
    const shape = state.queue[i];
    ctx.strokeStyle = i === 0 && shape !== undefined ? (BF_COLOURS[shape]?.rim ?? "#36E2F5") : "rgba(54,226,245,0.35)";
    ctx.lineWidth = i === 0 ? 2 : 1;
    ctx.strokeRect(L.nextX + 0.5, cy - 24.5, L.sideW - 1, 49);
    if (shape !== undefined) drawBfMini(ctx, shape, L.nextX + L.sideW / 2, cy, zone ? (i === 0 ? 11 : 9) : i === 0 ? 12 : 10, i === 0 ? 1 : 0.92);
  }
  if (zone) {
    // The speed, under the next three.
    const sy = by + 44 + BF_PREVIEW * 60;
    ctx.fillStyle = "rgba(160,236,248,0.85)";
    ctx.fillText("SPEED", L.nextX + L.sideW / 2, sy);
    ctx.font = `${Math.max(13, retroTextFloor())}px ${RETRO_FONT}`;
    ctx.fillStyle = "#E8FDFF";
    ctx.fillText(`${level + 1}/${bfGravityFor(state.rev).length}`, L.nextX + L.sideW / 2, sy + 20);
    ctx.restore();
    return;
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

export function blockfallArtGame(view?: BfView, rev?: number | null): ArcadeGame<BfState, ArcadeInputEvent | null> {
  return { ...(rev === undefined ? blockfallGame : blockfallGameFor(rev)), draw: (ctx, state, size) => drawBlockfall(ctx, state, size, view) };
}

export const blockfallArt = blockfallArtGame();

/**
 * The cabinet round the well (stage 2 of the Retro overhaul): a fixed pixel starfield over the navy and, low down, a
 * faint synthwave floor (horizontal lines closing up towards a horizon behind the well, and lines fanning out from its
 * vanishing point), so the margins round the well read as a scene rather than flat colour. Display only; static.
 */
function paintBlockzoneCabinet(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const r = Math.imul(i + 1, 0x9e3779b1) >>> 0;
    ctx.fillStyle = r % 7 === 0 ? "rgba(255,255,255,0.7)" : "rgba(160,200,255,0.35)";
    ctx.fillRect(r % W, (r >>> 9) % Math.round(H * 0.7), r % 11 === 0 ? 2 : 1, r % 11 === 0 ? 2 : 1);
  }
  const horizon = Math.round(H * 0.62);
  ctx.strokeStyle = "rgba(160,90,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i <= 9; i++) {
    const y = horizon + i * i * 3.2;
    if (y > H) break;
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(W, Math.round(y) + 0.5);
  }
  for (let j = -6; j <= 6; j++) {
    ctx.moveTo(W / 2, horizon);
    ctx.lineTo(W / 2 + j * 70, H);
  }
  ctx.stroke();
  const glow = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 10);
  glow.addColorStop(0, "rgba(255,120,200,0)");
  glow.addColorStop(1, "rgba(160,90,255,0.16)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - 40, W, 50);
  ctx.restore();
}

/**
 * Blockzone's in-world moments (the Retro overhaul, stage 2; display only, read from the state, aged by the sim tick): a
 * turn outlines the piece in white, a refused move or turn outlines it red, a hard drop leaves a streak down each of its
 * columns, a lock flashes the squares white, a clear throws sparks off both walls, and a stack within four rows of the
 * top makes the well's rim beat red (bfNearTop, shared with its sound; steady under reduced motion).
 */
function blockzoneEffects(ctx: CanvasRenderingContext2D, state: BfState, bx: number, by: number, cell: number, bw: number): void {
  const fx = retroFx(ctx, "blockfall", state.tick);
  const p = state.piece;
  const outline = (shape: number, turn: number, x: number, y: number, colour: string, age: number) => {
    ctx.save();
    ctx.globalAlpha = 1 - age;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    for (const [cx, cy] of bfCells(shape, turn)) {
      const row = y + cy - BF_HIDDEN;
      if (row >= 0) ctx.strokeRect(bx + (x + cx) * cell + 1, by + row * cell + 1, cell - 2, cell - 2);
    }
    ctx.restore();
  };
  // The piece last frame (its place and its landing row), so the moment it locks can be drawn where it was.
  const last = { pieces: fx.get("pieces", state.pieces), x: fx.get("x", p.x), y: fx.get("y", p.y), shape: fx.get("shape", p.shape), turn: fx.get("turn", p.turn), ghost: fx.get("ghost", p.y) };
  if (state.pieces > last.pieces) {
    fx.log("lock", { x: last.x, y: last.ghost, n: last.shape, x2: last.turn });
    if (last.ghost - last.y >= 3) fx.log("drop", { x: last.x, y: last.y, n: last.shape, x2: last.turn, y2: last.ghost });
  } else if (state.ended === 0 && p.turn !== last.turn) fx.log("turn", { x: 0, y: 0, n: 0 });
  fx.set("pieces", state.pieces);
  fx.set("x", p.x);
  fx.set("y", p.y);
  fx.set("shape", p.shape);
  fx.set("turn", p.turn);
  fx.set("ghost", state.ended === 0 ? bfGhostY(state.board, p) : p.y);
  fx.rise("reject", state.rejects, () => ({ x: 0, y: 0, n: 0 }));
  if (state.ended === 0) {
    const turn = fx.latest("turn", 6);
    if (turn) outline(p.shape, p.turn, p.x, p.y, "#FFFFFF", turn.age);
    const reject = fx.latest("reject", 8);
    if (reject) outline(p.shape, p.turn, p.x, p.y, "#FF4D6D", reject.age);
  }
  fx.each("drop", 10, (e, age) => {
    const cols = new Set(bfCells(e.n, e.x2 ?? 0).map(([cx]) => e.x + cx));
    for (const col of cols) {
      const x = bx + col * cell + cell / 2;
      fxStreak(fx, ctx, x, by + Math.max(0, e.y - BF_HIDDEN) * cell, x, by + Math.max(0, (e.y2 ?? e.y) - BF_HIDDEN) * cell, age, "#E8FDFF", Math.max(2, cell * 0.3));
    }
  });
  fx.each("lock", 6, (e, age) => {
    for (const [cx, cy] of bfCells(e.n, e.x2 ?? 0)) {
      const row = e.y + cy - BF_HIDDEN;
      if (row >= 0) fxFlash(ctx, bx + (e.x + cx) * cell, by + row * cell, cell, cell, age, "#FFFFFF", 0.5);
    }
  });
  fx.rise("clear", state.lines, () => {
    const lowest = (state.cleared[state.cleared.length - 1] ?? BF_HIDDEN) - BF_HIDDEN;
    return { x: 0, y: by + (lowest + 0.5) * cell, n: state.cleared.length };
  });
  fx.each("clear", 16, (e, age) => {
    fxSparks(fx, ctx, bx + 2, e.y, age, "#A0F0FF", { n: 4 + e.n * 2, spread: 18, seed: e.tick });
    fxSparks(fx, ctx, bx + bw - 2, e.y, age, "#A0F0FF", { n: 4 + e.n * 2, spread: 18, seed: e.tick + 5 });
  });
  if (bfNearTop(state)) {
    const beat = fx.still ? 0.5 : Math.max(0, Math.sin((state.tick % 50) / 50 * Math.PI * 2)) ** 2;
    ctx.save();
    ctx.strokeStyle = `rgba(255,77,109,${(0.25 + 0.55 * beat).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, BF_H * cell + 2);
    ctx.restore();
  }
}
