/**
 * Mahjong Solitaire's art (display only; never imported by the sim or the server). Thick ivory tiles with ivory-on-jade
 * layers along their edges, slightly engraved glossy faces, each layer casting a shadow on the one below, on a
 * jade-green play mat with gold stitching over a dark wooden table. Faces are drawn in code: dots, bamboo and
 * characters 1–9, the four winds and three dragons (the characters as stroke glyphs, so no font is loaded). Blocked
 * tiles are dimmed (well down since 3 Nov 2026, so the free ones stand out); the selected tile glows gold. The board is painted into a device layer keyed on the faces
 * and the selection, so a frame is one blit plus the moving effects.
 * The Cards & Board overhaul (15 Nov 2026, display only): real ivory tiles over jade backs and the green mat in a
 * wooden table edge, Blender renders of these faces (realArt.renderer.ts; the code tiles and table until they load);
 * the HUD's free-pair count reads "Free pairs" (it read "Moves", which looked like a move counter).
 */
import { deviceLayer } from "./cache.renderer";
import { drawRealTile, mahjongTableImage, realArtReady } from "./cards/realArt.renderer";
import { drawOutline, drawSparks, easeInOut, FxTimeline, shakeX } from "./cards/cardsFx.renderer";
import { drawHudPillRow } from "./hudPill.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { MAHJONG_FX } from "./arcadeFxGames.renderer";
import { reducedMotion } from "./art.renderer";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  mahjongBlockers,
  mahjongCleared,
  mahjongFree,
  mahjongGameAt,
  mahjongGameFor,
  mahjongHintPair,
  mahjongLayoutOf,
  MAHJONG_LAYOUT,
  MAHJONG_LV_EASY,
  type MahjongLayout,
  mahjongMoves,
  mahjongSlotRect,
  MAHJONG_BOARD_H,
  MAHJONG_BOARD_W,
  MAHJONG_BOARD_X,
  MAHJONG_BOARD_Y,
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
  // The mat spans the world's width less a 4-unit margin (3 Nov 2026: the world narrowed to the stack's width).
  const mx = 4;
  const my = MAHJONG_BOARD_Y - 34;
  const mw = w - 8;
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
function orderOf(lay: MahjongLayout): readonly number[] {
  return lay.slots.map((_, i) => i).sort((a, b) => {
    const sa = lay.slots[a]!;
    const sb = lay.slots[b]!;
    return sa.z - sb.z || sa.y2 - sb.y2 || sa.x2 - sb.x2;
  });
}
const ORDERS = new Map<MahjongLayout, readonly number[]>();
/** The layout being drawn (set at the top of each frame from the board's length; the difficulty levels' 56 and 88). */
let LAY: MahjongLayout = MAHJONG_LAYOUT;
function rect(slot: number): { x: number; y: number; w: number; h: number } {
  return mahjongSlotRect(slot, LAY);
}
function order(): readonly number[] {
  let o = ORDERS.get(LAY);
  if (!o) ORDERS.set(LAY, (o = orderOf(LAY)));
  return o;
}

/**
 * The live stage's view (the overhaul's stage 2; display only): the effects' timeline, the board as it was last frame
 * (a pair taken flies from there) and the state seen. Reveals, replays and the intro's still pass none.
 */
export interface MahjongView {
  fx: FxTimeline;
  face: readonly number[] | null;
  seen: { pairs: number; misses: number; blocked: number; shuffles: number; sel: number; cleared: boolean; tick: number } | null;
}

export function mahjongNewView(): MahjongView {
  return { fx: new FxTimeline(), face: null, seen: null };
}

/** One tile with its shadow (the real render, or the code tile until it loads). */
function paintOneTile(ctx: CanvasRenderingContext2D, face: number, x: number, y: number, w: number, h: number, shadow = 1): void {
  ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * shadow})`;
  roundRect(ctx, x + 8, y + 10, w, h, Math.max(3, w * 0.1));
  ctx.fill();
  if (!drawRealTile(ctx, face, x, y, w, h)) {
    paintMahjongTile(ctx, x, y, w, h);
    paintMahjongFace(ctx, face, x, y, w, h);
  }
}

function paintBoard(ctx: CanvasRenderingContext2D, s: MahjongState, skip: ReadonlySet<number> = new Set()): void {
  const table = mahjongTableImage();
  if (table) ctx.drawImage(table, 0, 0, MAHJONG_WORLD_W, MAHJONG_WORLD_H);
  else paintMahjongTable(ctx, MAHJONG_WORLD_W, MAHJONG_WORLD_H);
  for (const slot of order()) {
    const face = s.face[slot]!;
    if (face < 0 || skip.has(slot)) continue;
    const r = rect(slot);
    // The tile's shadow on the layer (or mat) below, then the rendered tile, or the code tile until it loads.
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    roundRect(ctx, r.x + 8, r.y + 10, r.w, r.h, Math.max(3, r.w * 0.1));
    ctx.fill();
    if (!drawRealTile(ctx, face, r.x, r.y, r.w, r.h)) {
      paintMahjongTile(ctx, r.x, r.y, r.w, r.h);
      paintMahjongFace(ctx, face, r.x, r.y, r.w, r.h);
    }
    if (!mahjongFree(s.face, slot)) {
      // Blocked tiles dimmed well down (3 Nov 2026; 0.24 until then), so the free ones read at a glance.
      ctx.fillStyle = "rgba(22, 18, 10, 0.46)";
      roundRect(ctx, r.x, r.y, r.w, r.h, Math.max(3, r.w * 0.1));
      ctx.fill();
    }
  }
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
  // Pill chips (3 Nov 2026): the main count top left; "Shuffles" spelled out (it read "SHUF" until then).
  drawHudPillRow(ctx, 12, 8, [
    { label: "Pairs", value: `${s.pairs}/${s.face.length / 2}`, opts: { gold: mahjongCleared(s) } },
    { label: "Free pairs", value: String(moves), opts: { gold: moves === 0 && !mahjongCleared(s) } },
    { label: "Shuffles", value: String(s.shuffles), opts: { alert: s.shuffles > 0 } },
  ]);
}

/** The board, the HUD and the moving effects, under the shared success layer (MAHJONG_FX). */
export function drawMahjong(ctx: CanvasRenderingContext2D, s: MahjongState, size: CanvasSize, view?: MahjongView): void {
  LAY = mahjongLayoutOf(s.face);
  arcadeFx(ctx, MAHJONG_FX, s, () => drawMahjongWorld(ctx, s, view), size);
}

/** Starts stage 2's effects from what changed since the last frame. */
function noticeMahjong(s: MahjongState, view: MahjongView): void {
  const fx = view.fx;
  const before = view.face;
  const seen = view.seen;
  view.face = s.face;
  view.seen = { pairs: s.pairs, misses: s.misses, blocked: s.blocked, shuffles: s.shuffles, sel: s.sel, cleared: mahjongCleared(s), tick: s.tick };
  if (!seen || !before || s.tick < seen.tick) return;
  // A pair taken: the two tiles slide together, click and fly off.
  if (s.pairs > seen.pairs && s.lastA >= 0 && s.lastB >= 0) {
    fx.start("pair", 560, { a: s.lastA, b: s.lastB, fa: before[s.lastA]!, fb: before[s.lastB]! });
  }
  // A second tile that doesn't match: both shake once.
  if (s.misses > seen.misses) fx.start("wrong", 300, [seen.sel, s.sel].filter((x) => x >= 0));
  // A blocked tile: the tiles keeping it blocked flash.
  if (s.blocked > seen.blocked && s.lastBlocked >= 0) fx.start("blockers", 520, mahjongBlockers(s.face, s.lastBlocked));
  if (s.shuffles > seen.shuffles) fx.start("spin", 620);
  if (mahjongCleared(s) && !seen.cleared) fx.start("shower", 1400);
  const left = (s.face.length / 2 - s.pairs) * 2;
  const leftBefore = (s.face.length / 2 - seen.pairs) * 2;
  if (left <= 6 && leftBefore > 6) fx.start("brighten", 700);
}

/** The mat's soft light once six tiles or fewer are left (held; fading in over the "brighten" run). */
function drawNearEnd(ctx: CanvasRenderingContext2D, s: MahjongState, view?: MahjongView): void {
  const left = (s.face.length / 2 - s.pairs) * 2;
  if (left > 6 || left === 0) return;
  const b = view?.fx.at("brighten");
  const a = 0.16 * (b ? b.k : 1);
  const cx = MAHJONG_BOARD_X + MAHJONG_BOARD_W / 2;
  const cy = MAHJONG_BOARD_Y + MAHJONG_BOARD_H / 2;
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, MAHJONG_BOARD_W * 0.75);
  g.addColorStop(0, `rgba(255, 244, 210, ${a})`);
  g.addColorStop(1, "rgba(255, 244, 210, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, MAHJONG_BOARD_Y - 30, MAHJONG_WORLD_W, MAHJONG_BOARD_H + 40);
}

function drawMahjongWorld(ctx: CanvasRenderingContext2D, s: MahjongState, view?: MahjongView): void {
  const art = (realArtReady("tiles") ? 1 : 0) + (realArtReady("mahjongTable") ? 2 : 0);
  if (view) noticeMahjong(s, view);
  const fx = view?.fx ?? null;
  const spin = fx?.at("spin") ?? null;
  const wrong = fx?.at<number[]>("wrong") ?? null;
  // Tiles drawn on their own this frame (lifted, shaking or spinning) are left out of the cached board.
  const own = new Set<number>();
  if (view && s.sel >= 0 && s.face[s.sel]! >= 0) own.add(s.sel);
  if (wrong) for (const t of wrong.data) if (s.face[t]! >= 0) own.add(t);
  if (spin) {
    const table = mahjongTableImage();
    if (table) ctx.drawImage(table, 0, 0, MAHJONG_WORLD_W, MAHJONG_WORLD_H);
    else paintMahjongTable(ctx, MAHJONG_WORLD_W, MAHJONG_WORLD_H);
    // The Shuffle: every tile turns on its centre and lands again, face by face.
    for (const slot of order()) {
      const face = s.face[slot]!;
      if (face < 0) continue;
      const r = rect(slot);
      const turn = Math.abs(Math.cos(Math.PI * easeInOut(spin.k)));
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(Math.max(0.06, turn), 1);
      paintOneTile(ctx, face, -r.w / 2, -r.h / 2, r.w, r.h, turn);
      ctx.restore();
    }
  } else deviceLayer(ctx, `mahjong|${art}|${s.seed}|${s.face.join(",")}|${[...own].join(".")}`, (c) => paintBoard(c, s, own));
  drawNearEnd(ctx, s, view);
  drawHint(ctx, s, view);
  // The tiles drawn on their own: the selected one lifted, a wrong pair shaking.
  if (!spin) {
    for (const t of own) {
      const r = rect(t);
      const lifted = t === s.sel ? 3 : 0;
      const sx = wrong && wrong.data.includes(t) ? shakeX(wrong.k, 4) : 0;
      paintOneTile(ctx, s.face[t]!, r.x + sx - lifted * 0.6, r.y - lifted, r.w, r.h, 1.3);
      if (!mahjongFree(s.face, t)) {
        ctx.fillStyle = "rgba(22, 18, 10, 0.46)";
        roundRect(ctx, r.x + sx - lifted * 0.6, r.y - lifted, r.w, r.h, Math.max(3, r.w * 0.1));
        ctx.fill();
      }
    }
  }
  paintHud(ctx, s);
  const still = reducedMotion();
  // The selected tile glows gold.
  if (s.sel >= 0 && s.face[s.sel]! >= 0) {
    const r = rect(s.sel);
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
  if (!view && s.lastA >= 0 && age >= 0 && age < life && s.lastPairTick > 0) {
    const k = age / life;
    for (const slot of [s.lastA, s.lastB]) {
      const r = rect(slot);
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
    const r = rect(s.lastBlocked);
    ctx.save();
    ctx.globalAlpha = 1 - bAge / (TICKS_PER_SECOND * 0.3);
    ctx.strokeStyle = "#FF5A4A";
    ctx.lineWidth = 2.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.stroke();
    ctx.restore();
  }
  if (fx) drawMahjongFx(ctx, fx);
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

/** The pair flying off, the blockers' flash and the finish's tile shower. */
function drawMahjongFx(ctx: CanvasRenderingContext2D, fx: FxTimeline): void {
  const pair = fx.at<{ a: number; b: number; fa: number; fb: number }>("pair");
  if (pair) {
    const ra = rect(pair.data.a);
    const rb = rect(pair.data.b);
    const mx = (ra.x + rb.x) / 2;
    const my = (ra.y + rb.y) / 2;
    const meet = easeInOut(Math.min(1, pair.k / 0.4));
    const fly = Math.max(0, (pair.k - 0.4) / 0.6);
    ctx.save();
    ctx.globalAlpha = 1 - fly;
    for (const [r, face, side] of [[ra, pair.data.fa, -1], [rb, pair.data.fb, 1]] as const) {
      const x = r.x + (mx + side * (r.w / 2 + 1) - r.x) * meet + fly * 70;
      const y = r.y + (my - r.y) * meet - fly * fly * 240;
      paintOneTile(ctx, face, x, y, r.w, r.h, 1.4);
    }
    ctx.restore();
    if (pair.k > 0.35 && pair.k < 0.7) drawSparks(ctx, mx + ra.w / 2, my + ra.h / 2, (pair.k - 0.35) / 0.35, 40, 10);
  }
  const blockers = fx.at<number[]>("blockers");
  if (blockers) {
    const a = Math.abs(Math.sin(Math.PI * 2 * blockers.k)) * (1 - blockers.k * 0.5);
    for (const t of blockers.data) {
      const r = rect(t);
      drawOutline(ctx, r.x, r.y, r.w, r.h, a, 6, "255,140,100");
    }
  }
  const shower = fx.at("shower");
  if (shower) {
    for (let i = 0; i < 18; i++) {
      const delay = (i % 6) * 0.06 + Math.floor(i / 6) * 0.1;
      const t = (shower.k - delay) / (1 - delay);
      if (t <= 0) continue;
      const x = 20 + ((i * 53) % (MAHJONG_WORLD_W - 60));
      const y = -80 + t * t * (MAHJONG_WORLD_H + 120);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - t) * 3);
      ctx.translate(x + MAHJONG_TILE_W / 2, y + MAHJONG_TILE_H / 2);
      ctx.rotate((i % 2 ? 1 : -1) * t * Math.PI * (0.5 + (i % 3) * 0.3));
      paintOneTile(ctx, (i * 7) % 34, -MAHJONG_TILE_W / 2, -MAHJONG_TILE_H / 2, MAHJONG_TILE_W, MAHJONG_TILE_H, 0.6);
      ctx.restore();
    }
  }
}

/** One object per revision (a stage resets its run when its game object changes). */
const MAHJONG_ART_GAME: ArcadeGame<MahjongState, ArcadeInputEvent | null> = { ...mahjongGameFor(1), draw: drawMahjong };
const MAHJONG_ART_GAME_V2: ArcadeGame<MahjongState, ArcadeInputEvent | null> = { ...mahjongGameFor(2), draw: drawMahjong };
export function mahjongArtGameFor(rev?: number | null, view?: MahjongView, level?: string | null): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  const base = level ? levelArtGame(rev, level) : (rev ?? 1) >= 2 ? MAHJONG_ART_GAME_V2 : MAHJONG_ART_GAME;
  return view ? { ...base, draw: (ctx, s, size) => drawMahjong(ctx, s, size, view) } : base;
}

export { MAHJONG_TILES, MAHJONG_TILE_W, MAHJONG_TILE_H };

/** One art game per level (a stage resets its run when its game object changes). */
const LEVEL_ART = new Map<string, ArcadeGame<MahjongState, ArcadeInputEvent | null>>();
function levelArtGame(rev: number | null | undefined, level: string): ArcadeGame<MahjongState, ArcadeInputEvent | null> {
  let g = LEVEL_ART.get(level);
  if (!g) LEVEL_ART.set(level, (g = { ...mahjongGameAt(rev, level), draw: drawMahjong }));
  return g;
}

/* ---- The difficulty levels' hints (display only; the sim only counts them) ---- */

const HINT_TICKS = 150;
const IDLE_HINT_TICKS = 8 * 60;
let hintMemo: { face: readonly number[]; pair: [number, number] | null } | null = null;

/**
 * The hint showing now (live stage only): for HINT_TICKS after a hint was asked for, or on Easy after 8 s with no pair
 * taken; a soft pulsing gold outline round the pair (mahjongHintPair, worked out once per board).
 */
export function mahjongHintShown(s: MahjongState, view?: MahjongView): { pair: [number, number]; glow: number } | null {
  if (!view || !s.lv || s.tick >= MAHJONG_RUN_TICKS_SHOWN || mahjongCleared(s)) return null;
  const asked = (s.hints ?? 0) > 0 ? s.tick - (s.hintTick ?? 0) : Infinity;
  const quiet = Math.max(s.lastPairTick, s.lastShuffleTick, s.lastUndoTick ?? 0, s.lastResetTick ?? 0, s.hintTick ?? 0);
  const idle = s.lv === MAHJONG_LV_EASY && s.tick - quiet >= IDLE_HINT_TICKS;
  if (!(asked < HINT_TICKS) && !idle) return null;
  if (hintMemo?.face !== s.face) hintMemo = { face: s.face, pair: mahjongHintPair(s.face) };
  if (!hintMemo.pair) return null;
  const pulse = 0.55 + 0.35 * Math.sin((s.tick / 60) * Math.PI * 1.4);
  return { pair: hintMemo.pair, glow: asked < HINT_TICKS ? Math.min(1, (HINT_TICKS - asked) / 30) * pulse : pulse };
}
const MAHJONG_RUN_TICKS_SHOWN = 120 * 60;

function drawHint(ctx: CanvasRenderingContext2D, s: MahjongState, view?: MahjongView): void {
  const hint = mahjongHintShown(s, view);
  if (!hint) return;
  ctx.save();
  for (const slot of hint.pair) {
    const r = rect(slot);
    roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, Math.max(4, r.w * 0.12));
    ctx.strokeStyle = `rgba(242,199,92,${(0.95 * hint.glow).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}
