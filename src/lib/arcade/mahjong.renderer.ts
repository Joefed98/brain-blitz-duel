/**
 * Mahjong Solitaire's art (display only; never imported by the sim or the server). Thick ivory tiles with ivory-on-jade
 * layers along their edges, slightly engraved glossy faces, each layer casting a shadow on the one below, on a
 * jade-green play mat with gold stitching over a dark wooden table. Faces are drawn in code: dots, bamboo and
 * characters 1–9, the four winds and three dragons (the characters as stroke glyphs, so no font is loaded). Blocked
 * tiles are slightly shaded; the selected tile glows gold. The board is painted into a device layer keyed on the faces
 * and the selection, so a frame is one blit plus the moving effects.
 */
import { deviceLayer } from "./cache.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { MAHJONG_FX } from "./arcadeFxGames.renderer";
import { reducedMotion } from "./art.renderer";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  mahjongCleared,
  mahjongFree,
  mahjongGameFor,
  mahjongMoves,
  mahjongSlotRect,
  MAHJONG_BOARD_H,
  MAHJONG_BOARD_W,
  MAHJONG_BOARD_X,
  MAHJONG_BOARD_Y,
  MAHJONG_PAIRS,
  MAHJONG_SLOTS,
  MAHJONG_TILES,
  MAHJONG_TILE_H,
  MAHJONG_TILE_W,
  MAHJONG_WORLD_H,
  MAHJONG_WORLD_W,
  type MahjongState,
} from "./mahjong";

export const MAHJONG_ART = {
  wood: "#2A1A10",
  woodLo: "#160D07",
  grain: "rgba(255, 210, 160, 0.05)",
  mat: "#1F6B4E",
  matLo: "#14503A",
  stitch: "#D9B45A",
  ivory: "#FBF6E8",
  ivoryLo: "#E9DEC2",
  edge: "#D8CBA8",
  jade: "#1E7A58",
  jadeLo: "#125238",
  shadow: "rgba(0, 0, 0, 0.34)",
  gold: "#F2C75C",
  blue: "#1F4E9A",
  green: "#1A7A45",
  red: "#C0302A",
  ink: "#1B1F2A",
  chip: "rgba(14, 20, 16, 0.9)",
  chipEdge: "rgba(255, 255, 255, 0.12)",
  text: "#F3F1EC",
  muted: "#B9C4BC",
};

const HUD_FONT = "700 13px 'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ================================ Glyphs ================================ */

/** Stroke glyphs on a 10 × 10 grid: each stroke a polyline (a trailing "z" closes it). */
type Stroke = readonly (readonly [number, number])[] | readonly [...(readonly [number, number])[], "z"];
const G: Record<string, readonly Stroke[]> = {
  "1": [[[1, 5], [9, 5]]],
  "2": [[[2, 3.2], [8, 3.2]], [[1, 7.2], [9, 7.2]]],
  "3": [[[2.2, 2], [7.8, 2]], [[2.8, 5], [7.2, 5]], [[1, 8.2], [9, 8.2]]],
  "4": [[[1.5, 2], [8.5, 2], [8.5, 8.6], [1.5, 8.6], "z"], [[4, 2], [4, 5.2], [2.8, 6.8]], [[6, 2], [6, 6.2], [7.4, 6.2]]],
  "5": [[[2, 1.5], [8, 1.5]], [[4.6, 1.5], [3.6, 8.5]], [[2.6, 4.8], [7, 4.8], [7, 8.5]], [[1, 8.5], [9, 8.5]]],
  "6": [[[4.8, 0.6], [5.6, 2]], [[1.4, 3.2], [8.6, 3.2]], [[4, 5], [2, 8.8]], [[6, 5], [8, 8.8]]],
  "7": [[[1.4, 4.6], [8.6, 3.4]], [[4, 0.8], [4, 7.6], [5, 8.6], [8.6, 8.6], [8.6, 7]]],
  "8": [[[4, 1.8], [3.6, 5], [1.4, 8.8]], [[6, 1.8], [6.4, 5], [8.6, 8.8]]],
  "9": [[[1.4, 3.4], [6, 3.4], [6, 8], [7, 8.6], [8.8, 8.6], [8.8, 7]], [[4, 0.8], [4, 4.2], [1.4, 8.8]]],
  wan: [
    [[1, 1.4], [9, 1.4]], [[3.4, 0.3], [3.4, 2.6]], [[6.6, 0.3], [6.6, 2.6]],
    [[2.6, 3.2], [7.4, 3.2], [7.4, 5.6], [2.6, 5.6], "z"], [[5, 3.2], [5, 5.6]], [[2.6, 4.4], [7.4, 4.4]],
    [[1.6, 9.4], [1.6, 6.6], [8.4, 6.6], [8.4, 9.4], [7.4, 9.4]], [[5, 5.6], [5, 7.8]], [[3.6, 8.6], [5, 7.6], [6.4, 8.6]],
  ],
  east: [
    [[1.4, 2.6], [8.6, 2.6]], [[5, 0.4], [5, 9.6]], [[2.6, 3.8], [7.4, 3.8], [7.4, 6.6], [2.6, 6.6], "z"], [[2.6, 5.2], [7.4, 5.2]],
    [[5, 6.6], [1.6, 9.4]], [[5, 6.6], [8.4, 9.4]],
  ],
  south: [
    [[1.4, 2], [8.6, 2]], [[5, 0.4], [5, 3.4]], [[2, 3.6], [2, 9.6]], [[2, 3.6], [8, 3.6], [8, 9.6], [7, 9.6]],
    [[3.6, 4.6], [4.2, 5.4]], [[6.4, 4.6], [5.8, 5.4]], [[3, 6.2], [7, 6.2]], [[3.4, 7.8], [6.6, 7.8]], [[5, 6.2], [5, 9.6]],
  ],
  west: [[[1, 1.5], [9, 1.5]], [[1.8, 3.6], [8.2, 3.6], [8.2, 9], [1.8, 9], "z"], [[4, 1.5], [4, 5.6], [2.8, 7.2]], [[6, 1.5], [6, 6.6], [7.4, 6.6]]],
  north: [[[4, 1], [4, 9.6]], [[1.2, 4], [4, 4]], [[1.2, 8.2], [4, 6.6]], [[6.2, 1], [6.2, 8.6], [7, 9.3], [9, 9.3], [9, 8]], [[6.2, 5.2], [8.8, 3.8]]],
  chung: [[[1.5, 3], [8.5, 3], [8.5, 6.8], [1.5, 6.8], "z"], [[5, 0.4], [5, 9.8]]],
  fa: [
    [[2.2, 0.6], [1, 3]], [[1.6, 1.6], [4, 1.6], [3.2, 3]], [[6, 0.6], [9, 3]], [[6.3, 2], [8.6, 1.2]],
    [[1.4, 4], [4, 4], [4, 5.5], [1.6, 5.5], [1.6, 7], [4, 7], [3.4, 9.4]],
    [[6, 4], [8.6, 4], [8.6, 5.6]], [[5.6, 4], [5.3, 6.2]], [[5.4, 6.9], [8.6, 6.9], [6, 9.4]], [[6.6, 7.6], [9, 9.4]],
  ],
};

function glyph(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, size: number, colour: string, weight: number): void {
  const strokes = G[key];
  if (!strokes) return;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = weight;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    ctx.beginPath();
    let first = true;
    for (const p of stroke) {
      if (p === "z") {
        ctx.closePath();
        continue;
      }
      const px = x + (p[0] / 10) * size;
      const py = y + (p[1] / 10) * size;
      if (first) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      first = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ================================ Faces ================================ */

const DOT_SPOTS: readonly (readonly [number, number])[][] = [
  [],
  [[0.5, 0.5]],
  [[0.5, 0.27], [0.5, 0.73]],
  [[0.26, 0.2], [0.5, 0.5], [0.74, 0.8]],
  [[0.29, 0.27], [0.71, 0.27], [0.29, 0.73], [0.71, 0.73]],
  [[0.27, 0.22], [0.73, 0.22], [0.5, 0.5], [0.27, 0.78], [0.73, 0.78]],
  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
  [[0.22, 0.13], [0.5, 0.24], [0.78, 0.35], [0.3, 0.6], [0.7, 0.6], [0.3, 0.84], [0.7, 0.84]],
  [[0.3, 0.13], [0.7, 0.13], [0.3, 0.38], [0.7, 0.38], [0.3, 0.62], [0.7, 0.62], [0.3, 0.87], [0.7, 0.87]],
  [[0.22, 0.18], [0.5, 0.18], [0.78, 0.18], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.82], [0.5, 0.82], [0.78, 0.82]],
];
const DOT_COLOURS = [MAHJONG_ART.blue, MAHJONG_ART.green, MAHJONG_ART.red];

function paintDots(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, w: number, h: number): void {
  const spots = DOT_SPOTS[n]!;
  const r = n === 1 ? w * 0.3 : n <= 4 ? w * 0.15 : n <= 6 ? w * 0.13 : w * 0.105;
  spots.forEach(([fx, fy], i) => {
    const cx = x + fx * w;
    const cy = y + fy * h;
    const c = DOT_COLOURS[n === 1 ? 2 : (i + n) % 3]!;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MAHJONG_ART.ivory;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    if (n === 1) {
      ctx.strokeStyle = MAHJONG_ART.green;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function stick(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, w / 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(cx - w / 2, cy - 0.6, w, 1.2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(cx - w * 0.12, cy - h / 2 + 1.5, w * 0.24, h - 3);
}

function paintBamboo(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, w: number, h: number): void {
  if (n === 1) {
    stick(ctx, x + w * 0.5, y + h * 0.55, w * 0.22, h * 0.62, MAHJONG_ART.green);
    ctx.fillStyle = MAHJONG_ART.red;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.16, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const spots = DOT_SPOTS[n]!;
  const sh = n <= 3 ? h * 0.36 : n <= 6 ? h * 0.27 : h * 0.2;
  const sw = w * 0.13;
  spots.forEach(([fx, fy], i) => {
    const colour = (n === 5 && i === 2) || (n === 7 && i === 0) || (n === 9 && i % 3 === 1) ? MAHJONG_ART.red : n === 8 && i % 2 ? MAHJONG_ART.blue : MAHJONG_ART.green;
    stick(ctx, x + fx * w, y + fy * h, sw, sh, colour);
  });
}

/** One face on a tile's face rectangle (x, y, w, h), engraved: drawn once offset light, then in its colours. */
export function paintMahjongFace(ctx: CanvasRenderingContext2D, face: number, x: number, y: number, w: number, h: number): void {
  const px = x + w * 0.12;
  const py = y + h * 0.1;
  const pw = w * 0.76;
  const ph = h * 0.8;
  const weight = Math.max(1.4, w * 0.055);
  if (face < 9) paintDots(ctx, face + 1, px, py, pw, ph);
  else if (face < 18) paintBamboo(ctx, face - 8, px, py, pw, ph);
  else if (face < 27) {
    const size = pw;
    glyph(ctx, String(face - 17), px, py, size * 0.95, MAHJONG_ART.ink, weight);
    glyph(ctx, "wan", px + size * 0.05, py + ph * 0.48, size * 0.9, MAHJONG_ART.red, weight * 0.85);
  } else if (face < 31) {
    const key = ["east", "south", "west", "north"][face - 27]!;
    glyph(ctx, key, px, py + (ph - pw) / 2, pw, MAHJONG_ART.ink, weight * 1.1);
  } else if (face === 31) glyph(ctx, "chung", px, py + (ph - pw) / 2, pw, MAHJONG_ART.red, weight * 1.4);
  else if (face === 32) glyph(ctx, "fa", px, py + (ph - pw) / 2, pw, MAHJONG_ART.green, weight * 1.1);
  else {
    // The white dragon: a blue double frame.
    ctx.strokeStyle = MAHJONG_ART.blue;
    ctx.lineWidth = weight;
    roundRect(ctx, px + pw * 0.06, py + ph * 0.08, pw * 0.88, ph * 0.84, 3);
    ctx.stroke();
    ctx.lineWidth = weight * 0.6;
    roundRect(ctx, px + pw * 0.2, py + ph * 0.2, pw * 0.6, ph * 0.6, 2);
    ctx.stroke();
  }
}

/** A tile's body: its shadow on the layer below, the jade and ivory layers along its edges and the glossy face. */
export function paintMahjongTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, depth = 6): void {
  const r = Math.max(3, w * 0.1);
  ctx.fillStyle = MAHJONG_ART.shadow;
  roundRect(ctx, x + depth + 2, y + depth + 4, w, h, r);
  ctx.fill();
  ctx.fillStyle = MAHJONG_ART.jadeLo;
  roundRect(ctx, x + depth, y + depth, w, h, r);
  ctx.fill();
  ctx.fillStyle = MAHJONG_ART.jade;
  roundRect(ctx, x + depth * 0.75, y + depth * 0.75, w, h, r);
  ctx.fill();
  ctx.fillStyle = MAHJONG_ART.edge;
  roundRect(ctx, x + depth * 0.4, y + depth * 0.4, w, h, r);
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, "#FFFDF6");
  g.addColorStop(0.55, MAHJONG_ART.ivory);
  g.addColorStop(1, MAHJONG_ART.ivoryLo);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 100, 60, 0.35)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
  // The gloss: a soft light band over the top of the face.
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  roundRect(ctx, x + w * 0.1, y + h * 0.05, w * 0.8, h * 0.16, r * 0.7);
  ctx.fill();
}

/** The dark wooden table and the jade mat with its gold stitching. */
export function paintMahjongTable(ctx: CanvasRenderingContext2D, w: number, h: number, mat = true): void {
  paintMahjongWood(ctx, 0, 0, w, h, h);
  if (!mat) return;
  const mx = MAHJONG_BOARD_X - 22;
  const my = MAHJONG_BOARD_Y - 34;
  const mw = MAHJONG_BOARD_W + 36;
  const mh = MAHJONG_BOARD_H + 46;
  const mg = ctx.createRadialGradient(mx + mw / 2, my + mh / 2, 20, mx + mw / 2, my + mh / 2, mw);
  mg.addColorStop(0, MAHJONG_ART.mat);
  mg.addColorStop(1, MAHJONG_ART.matLo);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  roundRect(ctx, mx + 3, my + 5, mw, mh, 16);
  ctx.fill();
  ctx.fillStyle = mg;
  roundRect(ctx, mx, my, mw, mh, 16);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = MAHJONG_ART.stitch;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 4]);
  roundRect(ctx, mx + 7, my + 7, mw - 14, mh - 14, 11);
  ctx.stroke();
  ctx.restore();
}

/**
 * The wooden table over a rectangle: a vertical gradient on the world's height (`worldH`), so the play screen's fill
 * continues it with no seam, and faint grain lines every 24 units (anchored to the world's top).
 */
export function paintMahjongWood(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, worldH: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, worldH);
  g.addColorStop(0, MAHJONG_ART.wood);
  g.addColorStop(1, MAHJONG_ART.woodLo);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = MAHJONG_ART.grain;
  ctx.lineWidth = 1;
  const from = Math.floor(y / 24) - 1;
  const to = Math.ceil((y + h) / 24) + 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = from; i <= to; i++) {
    const y0 = i * 24;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    for (let px = Math.floor(x / 40) * 40; px <= x + w + 40; px += 40) ctx.lineTo(px, y0 + 4 * Math.sin(px / 61 + i * 1.3));
    ctx.stroke();
  }
  ctx.restore();
}

/* ================================ The board ================================ */

/** Draw order: bottom layer first; within a layer top to bottom, left to right (sides covered by later tiles). */
const ORDER: readonly number[] = MAHJONG_SLOTS.map((_, i) => i).sort((a, b) => {
  const sa = MAHJONG_SLOTS[a]!;
  const sb = MAHJONG_SLOTS[b]!;
  return sa.z - sb.z || sa.y2 - sb.y2 || sa.x2 - sb.x2;
});

function paintBoard(ctx: CanvasRenderingContext2D, s: MahjongState): void {
  paintMahjongTable(ctx, MAHJONG_WORLD_W, MAHJONG_WORLD_H);
  for (const slot of ORDER) {
    const face = s.face[slot]!;
    if (face < 0) continue;
    const r = mahjongSlotRect(slot);
    paintMahjongTile(ctx, r.x, r.y, r.w, r.h);
    paintMahjongFace(ctx, face, r.x, r.y, r.w, r.h);
    if (!mahjongFree(s.face, slot)) {
      ctx.fillStyle = "rgba(30, 24, 10, 0.24)";
      roundRect(ctx, r.x, r.y, r.w, r.h, Math.max(3, r.w * 0.1));
      ctx.fill();
    }
  }
}

function chip(ctx: CanvasRenderingContext2D, x: number, w: number, label: string, value: string, tint?: string): void {
  const y = 8;
  const h = 28;
  ctx.fillStyle = MAHJONG_ART.chip;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = tint ?? MAHJONG_ART.chipEdge;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 13.5);
  ctx.stroke();
  ctx.font = HUD_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = MAHJONG_ART.muted;
  ctx.fillText(label, x + 12, y + h / 2 + 1);
  ctx.textAlign = "right";
  ctx.fillStyle = tint ?? MAHJONG_ART.text;
  ctx.fillText(value, x + w - 12, y + h / 2 + 1);
}

/** Moves left on the board, cached per board (the HUD's MOVES chip; 0 means only a Shuffle helps). */
let movesKey: readonly number[] | null = null;
let movesCount = 0;
export function mahjongMovesShown(face: readonly number[]): number {
  if (face !== movesKey) {
    movesKey = face;
    movesCount = mahjongMoves(face).length;
  }
  return movesCount;
}

function paintHud(ctx: CanvasRenderingContext2D, s: MahjongState): void {
  const moves = mahjongMovesShown(s.face);
  chip(ctx, 15, 130, "PAIRS", `${s.pairs}/${MAHJONG_PAIRS}`);
  chip(ctx, 153, 112, "MOVES", String(moves), moves === 0 && !mahjongCleared(s) ? MAHJONG_ART.gold : undefined);
  chip(ctx, 273, 102, "SHUF", String(s.shuffles), s.shuffles > 0 ? "#FF9C7A" : undefined);
}

/** The board, the HUD and the moving effects, under the shared success layer (MAHJONG_FX). */
export function drawMahjong(ctx: CanvasRenderingContext2D, s: MahjongState, size: CanvasSize): void {
  arcadeFx(ctx, MAHJONG_FX, s, () => drawMahjongWorld(ctx, s), size);
}

function drawMahjongWorld(ctx: CanvasRenderingContext2D, s: MahjongState): void {
  deviceLayer(ctx, `mahjong|${s.seed}|${s.face.join(",")}`, (c) => paintBoard(c, s));
  paintHud(ctx, s);
  const still = reducedMotion();
  // The selected tile glows gold.
  if (s.sel >= 0 && s.face[s.sel]! >= 0) {
    const r = mahjongSlotRect(s.sel);
    const pulse = still ? 0.8 : 0.65 + 0.35 * Math.sin((s.tick / TICKS_PER_SECOND) * Math.PI * 2.4);
    ctx.save();
    ctx.shadowColor = MAHJONG_ART.gold;
    ctx.shadowBlur = 14 * pulse;
    ctx.strokeStyle = MAHJONG_ART.gold;
    ctx.lineWidth = 3;
    roundRect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 7);
    ctx.stroke();
    ctx.fillStyle = `rgba(242, 199, 92, ${0.16 * pulse})`;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.restore();
  }
  // The pair just taken: both tiles lift and fade in gold.
  const age = s.tick - s.lastPairTick;
  const life = TICKS_PER_SECOND * 0.4;
  if (s.lastA >= 0 && age >= 0 && age < life && s.lastPairTick > 0) {
    const k = age / life;
    for (const slot of [s.lastA, s.lastB]) {
      const r = mahjongSlotRect(slot);
      const lift = still ? 0 : -10 * k;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.shadowColor = MAHJONG_ART.gold;
      ctx.shadowBlur = 16;
      ctx.fillStyle = MAHJONG_ART.ivory;
      roundRect(ctx, r.x, r.y + lift, r.w, r.h, 6);
      ctx.fill();
      ctx.restore();
    }
  }
  // A tap on a blocked tile: a brief red edge.
  const bAge = s.tick - s.lastBlockedTick;
  if (s.lastBlocked >= 0 && s.face[s.lastBlocked]! >= 0 && bAge >= 0 && bAge < TICKS_PER_SECOND * 0.3 && s.lastBlockedTick > 0) {
    const r = mahjongSlotRect(s.lastBlocked);
    ctx.save();
    ctx.globalAlpha = 1 - bAge / (TICKS_PER_SECOND * 0.3);
    ctx.strokeStyle = "#FF5A4A";
    ctx.lineWidth = 2.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.stroke();
    ctx.restore();
  }
  // A Shuffle: a gold wash over the mat.
  const sAge = s.tick - s.lastShuffleTick;
  if (s.lastShuffleTick > 0 && sAge >= 0 && sAge < TICKS_PER_SECOND * 0.5) {
    ctx.save();
    ctx.globalAlpha = (1 - sAge / (TICKS_PER_SECOND * 0.5)) * 0.25;
    ctx.fillStyle = MAHJONG_ART.gold;
    ctx.fillRect(MAHJONG_BOARD_X - 14, MAHJONG_BOARD_Y - 26, MAHJONG_BOARD_W + 22, MAHJONG_BOARD_H + 32);
    ctx.restore();
  }
}

/** One object for the one revision (a stage resets its run when its game object changes). */
const MAHJONG_ART_GAME: ArcadeGame<MahjongState, ArcadeInputEvent | null> = { ...mahjongGameFor(), draw: drawMahjong };
export function mahjongArtGameFor(_rev?: number | null): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  return MAHJONG_ART_GAME;
}

export { MAHJONG_TILES, MAHJONG_TILE_W, MAHJONG_TILE_H };
