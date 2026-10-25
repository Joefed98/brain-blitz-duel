import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { arcadeFx } from "./arcadeFx.renderer";
import { balltrackFxFor } from "./arcadeFxGames.renderer";
/**
 * Ball Track in the Toybox world: a wooden marble run. Render only; mirrors
 * btDraw's private geometry (tile centres, tube path, ball radius 22.5) and
 * reads state without writing it.
 */
import {
  BT_BALLS, BT_COLS, BT_H as BT_BASE_H, BT_HOPPER_COL, BT_HOPPER_H, BT_PALETTE,
  BT_REV, BT_ROWS as BT_BASE_ROWS, BT_SHUFFLE_TICKS, BT_TILE, BT_TRAY_H, BT_TURN_TICKS, BT_W, E, N, S, W,
  btBallPoint, btEventCountdown, btLayout, btRotatable, btSwitchedOn, btTraysAt, rowDir, btIsGold, btRowsOf, BT_V7_COMBO_FROM,
  type BtBall, type BtCourse, type BtState,
} from "./ballTrack";
import {
  TOY_BRASS, TOY_INK, TOY_OAK, TOY_WOOD_DARK, TOY_WOOD_DEEP,
  toyBoard, toyMarble, toyTabletop,
} from "./toybox.renderer";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";

const BALL_R = 22.5;
const SLOT = 100;
const CHANNEL_FIXED = "#9C6B3E";
const CHANNEL_SWITCH = "#B5683A";
const GROOVE = "#5A3519";
const SWITCH_BRASS = "#A47726";
const SWITCH_EDGE = "#493619";
/** Carved symbol per colour index: circle, square, triangle, diamond. */
export const BT_SYMBOLS = ["circle", "square", "triangle", "diamond"] as const;

const cellCentre = (cell: number) => ({
  x: (cell % BT_COLS) * BT_TILE + BT_TILE / 2,
  y: BT_HOPPER_H + Math.floor(cell / BT_COLS) * BT_TILE + BT_TILE / 2,
});
const pointOf = (cell: number, BT_ROWS = BT_BASE_ROWS) => {
  if (cell < 0) return { x: BT_HOPPER_COL * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H / 2 };
  if (cell >= SLOT) return { x: (cell - SLOT) * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H / 2 };
  return cellCentre(cell);
};

function tubePath(ctx: CanvasRenderingContext2D, cell: number, mask: number) {
  const { x, y } = cellCentre(cell);
  const h = BT_TILE / 2 - 2;
  const end = (side: number) => ({ x: x + (side === E ? h : side === W ? -h : 0), y: y + (side === S ? h : side === N ? -h : 0) });
  const sides = [N, E, S, W].filter((side) => mask & side);
  if (sides.length === 2 && !(mask === (N | S) || mask === (E | W))) {
    const a = end(sides[0]!), b = end(sides[1]!);
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(x, y, b.x, b.y);
  } else if (sides.length === 2) {
    const a = end(sides[0]!), b = end(sides[1]!);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else {
    for (const side of sides) {
      const p = end(side);
      ctx.moveTo(x, y);
      ctx.lineTo(p.x, p.y);
    }
  }
}

/**
 * Rev 2 turn animation: the eased turn progress of a tube (1 when settled) and
 * the swing direction (+1 clockwise) that carries a marble's entry end to the
 * upstream side, so a riding marble keeps rolling the way it was going.
 */
function turnOf(s: BtState, cell: number): { u: number; sign: number } {
  const since = s.tick - (s.turned?.[cell] ?? -1000);
  const k = Math.max(0, Math.min(1, since / BT_TURN_TICKS));
  const d = rowDir(Math.floor(cell / BT_COLS));
  const toVertical = s.vert[cell] === 1;
  return { u: k * k * (3 - 2 * k), sign: toVertical ? (d > 0 ? 1 : -1) : (d > 0 ? -1 : 1) };
}

/**
 * Where a marble is drawn: a rev-2 marble swings round with its tube only when
 * the tube turned while the marble was inside it (turned after it arrived; the
 * sim applies a tap before marbles move, so a same-tick arrival came in after the
 * turn). A marble rolling into a tube that was already turned rolls straight in
 * and drops, exactly as the sim moves it.
 */
export function btArtBallPoint(s: BtState, b: BtBall, rot: Set<number>) {
  const p = btBallPoint(s, b);
  if (s.rev !== BT_REV || b.cell < 0 || b.cell >= SLOT || !rot.has(b.cell)) return p;
  if ((s.turned?.[b.cell] ?? -1000) <= b.arrived) return p;
  const enteredVertical = b.above === 1;
  if (enteredVertical === (s.vert[b.cell] === 1)) return p;
  const c = cellCentre(b.cell);
  const { u, sign } = turnOf(s, b.cell);
  const a = sign * (Math.PI / 2) * u;
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/**
 * Rev 2 switch point badge, drawn only on a switched drop: a gold → shows marbles
 * now roll past that cup. Open drops show no arrow (the upright drop tube already
 * shows the way down).
 */
function drawSwitch(ctx: CanvasRenderingContext2D, cell: number, on: boolean) {
  if (!on) return;
  const { x, y } = cellCentre(cell);
  ctx.save();
  ctx.fillStyle = on ? "#2B1A0E" : "#3A2614";
  ctx.strokeStyle = on ? "#FFD27A" : "#FFF1CF";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.translate(x, y);
  if (on) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = on ? "#FFD27A" : "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(-4, -12);
  ctx.lineTo(4, -12);
  ctx.lineTo(4, 1);
  ctx.lineTo(11, 1);
  ctx.lineTo(0, 13);
  ctx.lineTo(-11, 1);
  ctx.lineTo(-4, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function symbol(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, r: number) {
  ctx.beginPath();
  const s = BT_SYMBOLS[kind % BT_SYMBOLS.length];
  if (s === "circle") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (s === "square") ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (s === "triangle") { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
  else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
}

/* ----------------------------- Cached board layer ----------------------------- */


/** Device pixels per world unit under the current transform. */
function deviceScale(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  return t ? Math.max(0.1, Math.hypot(t.a, t.b)) : 1;
}

/** The board layer per device size and board height: its canvas and the masks it was painted with. */
interface BoardLayer {
  canvas: ArtCanvas;
  c: CanvasRenderingContext2D;
  masks: readonly number[];
}
const layers = new Map<string, BoardLayer | null>();
/** World px round a changed cell that a repaint covers: its own and its neighbours' shadows reach 4 px past a tile. */
const REPAINT_MARGIN = 6;
/** More changed cells than this (a new course, a drop row flipping) repaint the whole layer. */
const REPAINT_MAX_CELLS = 8;

/**
 * Draws the world-sized board layer (board, plank seams, shelves and settled channels, painted by
 * paintBoardLayer for `masks`), or paints straight onto ctx where no offscreen canvas exists (SSR,
 * Node checks). One layer per size is repainted when the masks change (the same pixels as before).
 * Low-end performance (16 Oct 2026): in reduced effects (lib/fx/lowEnd.ts) a tap that turns a tube
 * changes only that tube's cells, so only their tiles (plus REPAINT_MARGIN) are repainted, clipped to
 * whole device pixels, instead of the whole board twice per tap.
 */
function btBoardLayer(ctx: CanvasRenderingContext2D, masks: readonly number[], BT_ROWS: number, BT_H: number): void {
  const k = deviceScale(ctx);
  const pw = Math.max(1, Math.round(BT_W * k));
  const ph = Math.max(1, Math.round(BT_H * k));
  const id = `${pw}x${ph}|${BT_ROWS}`;
  let layer = layers.get(id);
  if (layer === undefined) {
    if (layers.size >= 4) layers.clear();
    const canvas = artCanvas(pw, ph);
    const c = canvas ? (artContext(canvas) as CanvasRenderingContext2D | null) : null;
    layer = null;
    if (canvas && c) {
      c.scale(pw / BT_W, ph / BT_H);
      paintBoardLayer(c, masks, BT_ROWS, BT_H);
      layer = { canvas, c, masks: [...masks] };
    }
    layers.set(id, layer);
  } else if (layer) {
    const changed: number[] = [];
    for (let cell = 0; cell < Math.max(masks.length, layer.masks.length); cell++) if (masks[cell] !== layer.masks[cell]) changed.push(cell);
    if (changed.length) {
      const { c } = layer;
      const sx = pw / BT_W;
      const sy = ph / BT_H;
      // Reduced effects (slow devices only): one pixel-aligned rectangle per changed cell. A partial
      // clip moves anti-aliased edges inside it by a few levels (≤ 17 of 255), so at full effects
      // the whole layer is repainted, exactly as before.
      const boxes: [number, number, number, number][] = changed.length > REPAINT_MAX_CELLS || !arcadeReducedEffects() ? [[0, 0, pw, ph]] : changed.map((cell) => {
        const x0 = (cell % BT_COLS) * BT_TILE - REPAINT_MARGIN;
        const y0 = BT_HOPPER_H + Math.floor(cell / BT_COLS) * BT_TILE - REPAINT_MARGIN;
        const left = Math.max(0, Math.floor(x0 * sx));
        const top = Math.max(0, Math.floor(y0 * sy));
        return [left, top, Math.min(pw, Math.ceil((x0 + BT_TILE + REPAINT_MARGIN * 2) * sx)) - left, Math.min(ph, Math.ceil((y0 + BT_TILE + REPAINT_MARGIN * 2) * sy)) - top];
      });
      for (const [x, y, w, h] of boxes) {
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.beginPath();
        c.rect(x, y, w, h);
        c.clip();
        c.clearRect(x, y, w, h);
        c.setTransform(sx, 0, 0, sy, 0, 0);
        paintBoardLayer(c, masks, BT_ROWS, BT_H);
        c.restore();
      }
      layer.masks = [...masks];
    }
  }
  if (layer) ctx.drawImage(layer.canvas as CanvasImageSource, 0, 0, BT_W, BT_H);
  else paintBoardLayer(ctx, masks, BT_ROWS, BT_H);
}

/**
 * Wooden channels for the tube paths `trace` adds, at the sim's tube widths:
 * a soft drop shadow, dark rim, bevelled walls (lit lip, shaded inner edge),
 * the bed with a polished centre and the carved groove.
 */
function strokeChannels(ctx: CanvasRenderingContext2D, trace: (c: CanvasRenderingContext2D) => void, movable: boolean): void {
  const pass = (width: number, colour: string, dx = 0, dy = 0) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    if (dx || dy) {
      ctx.save();
      ctx.translate(dx, dy);
      trace(ctx);
      ctx.restore();
    } else trace(ctx);
    ctx.stroke();
  };
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  pass(BALL_R * 3 + 6, "rgba(40,20,6,0.22)", 0, 4);
  pass(BALL_R * 3 + 6, TOY_WOOD_DEEP);
  pass(BALL_R * 3, movable ? CHANNEL_SWITCH : CHANNEL_FIXED);
  pass(BALL_R * 3 - 6, movable ? "#CF8E5E" : "#B88A5A");
  pass(BALL_R * 2 + 6, movable ? "#7E4524" : "#6E4A2A");
  pass(BALL_R * 2, movable ? "#C47A48" : "#AD7A4A");
  // Polish A3 (25 Oct 2026, art only): two carved rail grooves the marble rides between, each with
  // a lit lower lip, then the polished centre and the fine centre groove, all inside the channel.
  // Refinement: deeper grooves (a darker cut, a shadow under its upper wall and a brighter lower lip).
  pass(BALL_R * 1.3 + 1, movable ? "rgba(255,226,190,0.4)" : "rgba(255,232,200,0.36)", 0, 2);
  pass(BALL_R * 1.3, "rgba(58,30,10,0.9)");
  pass(BALL_R * 1.3 - 3, "rgba(40,20,6,0.55)", 0, -1);
  pass(BALL_R * 1.3 - 4, movable ? "#C47A48" : "#AD7A4A");
  pass(BALL_R * 0.9, movable ? "rgba(255,214,170,0.2)" : "rgba(255,226,186,0.17)");
}

/** A domed brass pin (radius 6, same as before). */
function brassPin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = SWITCH_EDGE;
  ctx.beginPath();
  ctx.arc(x, y, 6.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SWITCH_BRASS;
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TOY_BRASS;
  ctx.beginPath();
  ctx.arc(x - 0.8, y - 0.8, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,248,220,0.85)";
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // Polish A3: a lit lower rim on the collar (inside the pin's radius).
  ctx.strokeStyle = "rgba(255,226,150,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 6.1, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

/** Recessed shelf: shadow under its top edge, light along its bottom lip. */
function shelf(c: CanvasRenderingContext2D, y: number, h: number): void {
  c.fillStyle = "rgba(60,35,15,0.25)";
  c.fillRect(0, y, BT_W, h);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(40,20,6,0.35)");
  g.addColorStop(0.3, "rgba(40,20,6,0)");
  g.addColorStop(1, "rgba(255,230,190,0.12)");
  c.fillStyle = g;
  c.fillRect(0, y, BT_W, h);
  c.fillStyle = "rgba(255,236,200,0.3)";
  c.fillRect(0, y + h - 1.5, BT_W, 1.5);
  c.fillStyle = "rgba(40,20,6,0.35)";
  c.fillRect(0, y, BT_W, 1.5);
}

/** A tile's tone: a few seeded shades so neighbouring squares read as separate pieces of wood. */
function tileTone(cell: number): number {
  let h = (cell + 1) * 2654435761;
  h ^= h >>> 15;
  return ((h >>> 0) % 5) - 2;
}

/**
 * Polish A3 (25 Oct 2026, art only): each tile a bevelled wooden square, inside its own 100 px cell:
 * a faint tone of its own, a lit top-left bevel, a shaded bottom-right bevel and a fine joint line.
 */
function bevelTile(c: CanvasRenderingContext2D, x: number, y: number, tone: number, outerL = false, outerR = false): void {
  const t = BT_TILE;
  if (tone) {
    c.fillStyle = tone > 0 ? `rgba(255,230,190,${0.035 * tone})` : `rgba(70,38,14,${-0.05 * tone})`;
    c.fillRect(x, y, t, t);
  }
  const b = 7;
  // Lit top and left faces (refinement: a clearly visible bevel).
  c.fillStyle = "rgba(255,238,205,0.4)";
  c.beginPath();
  c.moveTo(x, y); c.lineTo(x + t, y); c.lineTo(x + t - b, y + b); c.lineTo(x + b, y + b); c.lineTo(x + b, y + t - b); c.lineTo(x, y + t);
  c.closePath();
  c.fill();
  // Shaded bottom and right faces.
  c.fillStyle = "rgba(62,30,8,0.45)";
  c.beginPath();
  if (outerR) {
    // On the world's right side only the bottom face is shaded (the screen fill runs on beside it).
    c.moveTo(x + t, y + t); c.lineTo(x, y + t); c.lineTo(x + b, y + t - b); c.lineTo(x + t, y + t - b);
  } else {
    c.moveTo(x + t, y + t); c.lineTo(x, y + t); c.lineTo(x + b, y + t - b); c.lineTo(x + t - b, y + t - b); c.lineTo(x + t - b, y + b); c.lineTo(x + t, y);
  }
  c.closePath();
  c.fill();
  // The joint between tiles and a hairline highlight on the bevel's crest. No joint along the world's
  // outer sides, where the screen fill runs on (a line there reads as a border, arcade-fill-check).
  c.strokeStyle = "rgba(60,30,10,0.42)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x + 0.75, y + 0.75);
  c.lineTo(x + t - 0.75, y + 0.75);
  if (outerR) c.moveTo(x + t - 0.75, y + t - 0.75);
  else c.lineTo(x + t - 0.75, y + t - 0.75);
  c.lineTo(x + 0.75, y + t - 0.75);
  if (!outerL) c.lineTo(x + 0.75, y + 0.75);
  c.stroke();
  c.strokeStyle = "rgba(255,240,210,0.3)";
  c.lineWidth = 1;
  c.strokeRect(x + b + 0.5, y + b + 0.5, t - b * 2 - 1, t - b * 2 - 1);
}

/**
 * The queue's wooden shelf across the hopper strip (Polish A3): a shaded back wall, the shelf's top
 * on which the queued marbles rest (their lowest point, hopper centre + ball radius) and its lit front lip.
 */
function queueShelf(c: CanvasRenderingContext2D): void {
  const h = BT_HOPPER_H;
  const rest = h / 2 + BALL_R - 3;
  const back = c.createLinearGradient(0, 0, 0, rest);
  back.addColorStop(0, "rgba(46,24,8,0.5)");
  back.addColorStop(1, "rgba(46,24,8,0.18)");
  c.fillStyle = back;
  c.fillRect(0, 0, BT_W, rest);
  const top = c.createLinearGradient(0, rest, 0, h - 4);
  top.addColorStop(0, "#B9874F");
  top.addColorStop(1, "#D9AC72");
  c.fillStyle = top;
  c.fillRect(0, rest, BT_W, h - 4 - rest);
  c.fillStyle = "rgba(255,240,210,0.45)";
  c.fillRect(0, h - 5, BT_W, 1.2);
  const lip = c.createLinearGradient(0, h - 4, 0, h);
  lip.addColorStop(0, "#9C6B3E");
  lip.addColorStop(1, GROOVE);
  c.fillStyle = lip;
  c.fillRect(0, h - 4, BT_W, 4);
  c.fillStyle = "rgba(40,20,6,0.4)";
  c.fillRect(0, rest - 1, BT_W, 1);
}

/** Board, bevelled tiles, shelves, settled channels and the overhead light (cached by btLayer). */
function paintBoardLayer(c: CanvasRenderingContext2D, masks: readonly number[], BT_ROWS = BT_BASE_ROWS, BT_H = BT_BASE_H): void {
  toyBoard(c, 0, 0, BT_W, BT_H, 14);
  const gridY = BT_HOPPER_H;
  for (let row = 0; row < BT_ROWS; row++)
    for (let col = 0; col < BT_COLS; col++) bevelTile(c, col * BT_TILE, gridY + row * BT_TILE, tileTone(row * BT_COLS + col), col === 0, col === BT_COLS - 1);
  queueShelf(c);
  shelf(c, gridY + BT_ROWS * BT_TILE, BT_TRAY_H);
  for (const movable of [false, true]) {
    strokeChannels(c, (cc) => {
      for (let cell = 0; cell < masks.length; cell++) {
        const m = masks[cell]!;
        if (m && (m & 1) === (movable ? 1 : 0)) tubePath(cc, cell, m >> 1);
      }
    }, movable);
  }
  // Warm overhead light: a soft lamp pool from above the board's top, falling off down the board.
  const lamp = c.createRadialGradient(BT_W / 2, -BT_H * 0.08, BT_W * 0.1, BT_W / 2, BT_H * 0.25, BT_H * 0.75);
  lamp.addColorStop(0, "rgba(255,220,160,0.36)");
  lamp.addColorStop(0.5, "rgba(255,200,130,0.1)");
  lamp.addColorStop(1, "rgba(30,14,4,0.16)");
  c.fillStyle = lamp;
  c.fillRect(0, 0, BT_W, BT_H);
  // Refinement: a darker vignette round the tile grid's edges (the grid only, so the shelves where the
  // screen fill meets the world keep their colour and no seam shows).
  const gridH = BT_ROWS * BT_TILE;
  const vx = BT_W / 2;
  const vy = gridY + gridH * 0.42;
  c.save();
  c.translate(vx, vy);
  c.scale(1, gridH / BT_W);
  const vig = c.createRadialGradient(0, 0, BT_W * 0.3, 0, 0, BT_W * 0.78);
  vig.addColorStop(0, "rgba(30,14,4,0)");
  vig.addColorStop(1, "rgba(30,14,4,0.3)");
  c.fillStyle = vig;
  c.fillRect(-vx, (gridY - vy) * (BT_W / gridH), BT_W, BT_W);
  c.restore();
}

/**
 * Ball Tracker's glass marble: the toybox marble at the sim radius, with a
 * shaded edge and a soft bounce light low on the far side (inside the radius).
 */
export function btMarble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, seed: number): void {
  toyMarble(ctx, x, y, r, colour, 0, seed);
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
  g.addColorStop(0, "rgba(255,255,255,0.12)");
  g.addColorStop(0.6, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(10,6,20,0.38)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, Math.PI * 0.12, Math.PI * 0.52);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(0.6, r * 0.05);
  ctx.beginPath();
  ctx.arc(x, y, r - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  // Polish A3: a glossy window reflection over the upper left and a warm bounce under it (inside r).
  const gloss = ctx.createLinearGradient(x, y - r, x, y);
  gloss.addColorStop(0, "rgba(255,255,255,0.55)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.12, y - r * 0.42, r * 0.62, r * 0.4, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.44, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,214,150,0.35)";
  ctx.lineWidth = Math.max(0.6, r * 0.07);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, Math.PI * 0.6, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
}

/**
 * btRev 7: a crossover's brass plate, a small four-way badge at the tile centre (inside the channel, so the
 * marble's path and collision are the channel's).
 */
function drawCrossPlate(ctx: CanvasRenderingContext2D, cell: number): void {
  const { x, y } = cellCentre(cell);
  ctx.save();
  ctx.fillStyle = SWITCH_EDGE;
  ctx.beginPath();
  ctx.moveTo(x, y - 15); ctx.lineTo(x + 15, y); ctx.lineTo(x, y + 15); ctx.lineTo(x - 15, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = TOY_BRASS;
  ctx.beginPath();
  ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5A3519";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
  ctx.restore();
}

/**
 * btRev 7: a speed booster's chevrons, burnt orange in the channel bed pointing the way marbles run along
 * the row, the lead chevron lit in turn (held still under reduced motion and reduced effects).
 */
function drawBooster(ctx: CanvasRenderingContext2D, cell: number, tick: number): void {
  const { x, y } = cellCentre(cell);
  const dir = rowDir(Math.floor(cell / BT_COLS));
  const still = arcadeReducedEffects();
  const lit = still ? -1 : Math.floor(tick / 8) % 3;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let k = 0; k < 3; k++) {
    const cx = x + dir * (k - 1) * 18;
    ctx.strokeStyle = k === lit ? "#FFD27A" : "#E2702A";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - dir * 6, y - 11);
    ctx.lineTo(cx + dir * 5, y);
    ctx.lineTo(cx - dir * 6, y + 11);
    ctx.stroke();
  }
  ctx.restore();
}

/** btRev 7: a gold marble's band (a gold ring inside its radius, lit at the top) and a glint. */
function goldBand(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  const ring = ctx.createLinearGradient(x, y - r, x, y + r);
  ring.addColorStop(0, "#FFF1B8");
  ring.addColorStop(0.5, "#F2BE3C");
  ring.addColorStop(1, "#A8700E");
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(1.5, r * 0.2);
  ctx.beginPath();
  ctx.arc(x, y, r - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#FFFBE6";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const d = i % 2 === 0 ? r * 0.3 : r * 0.08;
    ctx.lineTo(x + r * 0.42 + Math.cos(a) * d, y - r * 0.42 + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** btRev 7: the boosted marble's streak, fading back along the step it is making. */
function boostStreak(ctx: CanvasRenderingContext2D, s: BtState, b: BtBall, p: { x: number; y: number }): void {
  const from = pointOf(b.from, btRowsOf(s));
  const dx = p.x - from.x, dy = p.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  ctx.save();
  const g = ctx.createLinearGradient(p.x, p.y, p.x - ux * BALL_R * 3, p.y - uy * BALL_R * 3);
  g.addColorStop(0, "rgba(255,190,90,0.55)");
  g.addColorStop(1, "rgba(255,190,90,0)");
  ctx.strokeStyle = g;
  ctx.lineWidth = BALL_R * 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - ux * BALL_R * 3, p.y - uy * BALL_R * 3);
  ctx.stroke();
  ctx.restore();
}

/** A marble's soft contact shadow on the wood, offset away from the overhead lamp (Polish A3). */
function marbleShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "rgba(40,18,4,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.12, y + r * 0.22, r * 1.02, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(40,18,4,0.2)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.08, y + r * 0.18, r * 0.9, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Ball Tracker drawing (world units; the caller scales) through the shared success layer. */
export function btArtDraw(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState, rotatable?: Set<number>) {
  arcadeFx(ctx, balltrackFxFor(s), s, () => btArtDrawWorld(ctx, course, s, rotatable));
}

function btArtDrawWorld(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState, rotatable?: Set<number>) {
  // btRev 4: the taller board's rows, tiles and height (the original 9 rows otherwise).
  const { rows: BT_ROWS, kind: BT_KIND, corner: BT_CORNER, h: BT_H } = btLayout(course);
  const gridY = BT_HOPPER_H;
  const rot = rotatable ?? new Set(btRotatable(course));
  // Low-end performance (16 Oct 2026): the tabletop and board never change, so they are one cached
  // layer (cache.renderer deviceLayer: the same pixels, one copy a frame instead of a gradient fill,
  // grain strokes and a vignette).
  // In reduced effects (lib/fx/lowEnd.ts, slow devices only) it is skipped: the board layer below
  // paints the whole world opaque, so only sub-pixel edges of the table ever showed.
  if (!arcadeReducedEffects())
    deviceLayer(ctx, `bt-table:${BT_H}`, (c) => {
      toyTabletop(c);
      toyBoard(c, 0, 0, BT_W, BT_H, 14);
    });

  const v2 = s.rev === BT_REV;
  const liveDrop = (cell: number) => cell >= (BT_ROWS - 1) * BT_COLS && (btTraysAt(course, s.tick)[cell % BT_COLS] ?? -1) >= 0;
  // btRev 7: a crossover is a channel both ways (a plus).
  const maskOf = (cell: number) => (liveDrop(cell) && !btSwitchedOn(s.sw, cell % BT_COLS) ? N | S : BT_KIND[cell] === 2 ? BT_CORNER[cell]! : course.cross?.includes(cell) ? N | E | S | W : s.vert[cell] ? N | S : E | W);
  // Rev 2: tubes mid-turn are drawn on their own, swung back by the part of the turn still to come.
  const turning = new Set<number>();
  if (v2) for (const cell of rot) if (turnOf(s, cell).u < 1) turning.add(cell);
  // The board, its shelves and every settled channel come from one cached layer (redrawn only when
  // a tube turns or a drop changes); tubes mid-turn are drawn on top, swung by the turn still to come.
  const masks: number[] = [];
  for (let cell = 0; cell < BT_KIND.length; cell++) masks.push(BT_KIND[cell] && !turning.has(cell) ? maskOf(cell) * 2 + (rot.has(cell) ? 1 : 0) : 0);
  btBoardLayer(ctx, masks, BT_ROWS, BT_H);
  for (const cell of turning) {
    const { x, y } = cellCentre(cell);
    const { u, sign } = turnOf(s, cell);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-sign * (Math.PI / 2) * (1 - u));
    ctx.translate(-x, -y);
    strokeChannels(ctx, (c) => tubePath(c, cell, maskOf(cell)), true);
    ctx.restore();
  }
  // Switches: a domed brass pin at each rotatable paddle's centre.
  for (const cell of rot) {
    const { x, y } = cellCentre(cell);
    brassPin(ctx, x, y);
  }

  // btRev 7: crossover plates and booster chevrons, over the channels.
  for (const cell of course.cross ?? []) drawCrossPlate(ctx, cell);
  for (const cell of course.boost ?? []) drawBooster(ctx, cell, s.tick);

  if (v2) for (let col = 1; col < BT_COLS; col++) {
    const cell = (BT_ROWS - 1) * BT_COLS + col;
    if (liveDrop(cell)) drawSwitch(ctx, cell, btSwitchedOn(s.sw, col));
  }

  // Wooden cups, each carved with its symbol; same slide/flash timing as before.
  const trayY = gridY + BT_ROWS * BT_TILE + 6;
  const event = s.tick >= course.shuffle.tick ? course.shuffle : s.tick >= course.relay.tick ? course.relay : null;
  const prior = event ? btTraysAt(course, event.tick - 1) : course.trays;
  const since = event ? s.tick - event.tick : -1;
  const k = since < 0 ? 0 : Math.min(1, since / BT_SHUFFLE_TICKS);
  const ease = k * k * (3 - 2 * k);
  const shuffleFlash = since >= 0 && since < BT_SHUFFLE_TICKS + 20 && Math.floor(since / 5) % 2 === 0;
  const now = btTraysAt(course, s.tick);
  const reduced = arcadeReducedEffects();
  prior.forEach((tray, from) => {
    if (tray < 0) return;
    const to = event ? event.trays.indexOf(tray) : from;
    const col = from + (to - from) * ease;
    const x = col * BT_TILE + 6, w = BT_TILE - 12, h = BT_TRAY_H - 10;
    const landed = now.indexOf(tray);
    const flash = shuffleFlash || s.landings.some((m) => m.cell === landed && s.tick - m.tick < 30);
    // Polish A3: each cup glows softly in its colour on the tray shelf (brighter as a marble lands).
    if (!reduced) {
      ctx.save();
      ctx.translate(x + w / 2, trayY + h / 2);
      ctx.scale(1, 0.55);
      const glow = ctx.createRadialGradient(0, 0, w * 0.2, 0, 0, w * 0.68);
      glow.addColorStop(0, BT_PALETTE[tray]!);
      glow.addColorStop(0.62, BT_PALETTE[tray]!);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = flash ? 0.8 : 0.5;
      ctx.fillStyle = glow;
      ctx.fillRect(-w * 0.68, -w * 0.68, w * 1.36, w * 1.36);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // A carved oak cup: light lip, hollow shaded from the top, the colour tint, then the colour edge.
    ctx.fillStyle = TOY_OAK;
    ctx.fillRect(x, trayY, w, h);
    const hollow = ctx.createLinearGradient(0, trayY + 3, 0, trayY + h - 3);
    hollow.addColorStop(0, "rgba(40,22,8,0.62)");
    hollow.addColorStop(0.45, "rgba(62,39,22,0.34)");
    hollow.addColorStop(1, "rgba(62,39,22,0.18)");
    ctx.fillStyle = hollow;
    ctx.fillRect(x + 4, trayY + 3, w - 8, h - 6);
    ctx.globalAlpha = flash ? 0.6 : 0.25;
    ctx.fillStyle = BT_PALETTE[tray]!;
    ctx.fillRect(x, trayY, w, h);
    ctx.globalAlpha = flash ? 0.45 : 0.22;
    const inner = ctx.createLinearGradient(0, trayY, 0, trayY + h);
    inner.addColorStop(0, "rgba(255,255,255,0)");
    inner.addColorStop(1, BT_PALETTE[tray]!);
    ctx.fillStyle = inner;
    ctx.fillRect(x + 4, trayY + 3, w - 8, h - 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,236,200,0.35)";
    ctx.fillRect(x + 4, trayY + h - 5, w - 8, 1.5);
    ctx.strokeStyle = shuffleFlash ? "#FFFFFF" : BT_PALETTE[tray]!;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 9;
    ctx.strokeRect(x, trayY, w, h);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, trayY, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1, trayY - 1.5);
    ctx.lineTo(x + w + 1, trayY - 1.5);
    ctx.stroke();
    // Carved symbol: dark cut with a light lower edge.
    const sx = x + w / 2, sy = trayY + h / 2;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,235,200,0.5)";
    ctx.save();
    ctx.translate(0, 1);
    symbol(ctx, tray, sx, sy, 8);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = TOY_INK;
    symbol(ctx, tray, sx, sy, 8);
    ctx.stroke();
  });

  // Landings: a settle wobble in the cup (right) or a grey marble bouncing out (wrong). Animation only.
  for (const m of s.landings) {
    const age = s.tick - m.tick;
    if (age < 0 || age >= 30) continue;
    const trays = btTraysAt(course, m.tick);
    const x = m.cell * BT_TILE + BT_TILE / 2;
    const cupY = trayY + (BT_TRAY_H - 10) / 2;
    const u = age / 30;
    if (m.ok) {
      ctx.globalAlpha = 1 - u * 0.6;
      toyMarble(ctx, x + Math.sin(age * 0.9) * 4 * (1 - u), cupY, BALL_R * 0.6, BT_PALETTE[m.colour]!, 0, m.colour);
    } else if ((trays[m.cell] ?? -1) >= 0) {
      ctx.globalAlpha = 1 - u;
      toyMarble(ctx, x + u * 18, cupY - Math.sin(u * Math.PI) * 34, BALL_R * 0.6, "#8A8F98", 0, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Lost balls fade where they fell.
  for (const m of s.falls) {
    const age = s.tick - m.tick;
    if (age >= 40) continue;
    const p = pointOf(m.cell, BT_ROWS);
    ctx.globalAlpha = 1 - age / 40;
    ctx.strokeStyle = BT_PALETTE[m.colour]!;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R + age / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const hy = BT_HOPPER_H / 2;
  const countdown = btEventCountdown(course, s.tick);
  if (countdown !== null) {
    ctx.save();
    ctx.fillStyle = TOY_INK;
    ctx.font = '24px "JetBrains Mono", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(countdown), BT_W - 12, hy);
    ctx.restore();
  }
  const leadX = BT_HOPPER_COL * BT_TILE + BT_TILE / 2;
  const queueGap = BALL_R;
  const leadOutline = BALL_R + 6 + 1.5;
  const queuedRadius = Math.min(BALL_R, (leadX - 4 - leadOutline - 5 * queueGap) / 10);
  for (let i = s.next; i < Math.min(course.balls.length || BT_BALLS, s.next + 6); i++) {
    const offset = i - s.next;
    const x = offset === 0 ? leadX : leadX - leadOutline - queueGap - queuedRadius - (offset - 1) * (queuedRadius * 2 + queueGap);
    const colour = course.balls[i]!;
    const r = offset === 0 ? BALL_R : queuedRadius;
    if (i === s.next) {
      // Polish A3: the current marble sits in a soft gold halo inside its ring.
      const halo = ctx.createRadialGradient(x, hy, BALL_R * 0.8, x, hy, BALL_R + 6);
      halo.addColorStop(0, "rgba(255,206,90,0)");
      halo.addColorStop(1, "rgba(255,206,90,0.4)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, hy, BALL_R + 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Contact shadow where the marble rests on the shelf.
    ctx.fillStyle = "rgba(40,18,4,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.1, hy + r * 0.86, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = i === s.next ? 1 : 0.7;
    btMarble(ctx, x, hy, r, BT_PALETTE[colour]!, colour);
    if (btIsGold(course, i)) goldBand(ctx, x, hy, r);
    ctx.globalAlpha = 1;
    if (i === s.next) {
      // The gold ring (same radius and width as the old brass one), lit at the top.
      const ring = ctx.createLinearGradient(x, hy - BALL_R - 6, x, hy + BALL_R + 6);
      ring.addColorStop(0, "#FFE9A6");
      ring.addColorStop(0.5, "#F2BE3C");
      ring.addColorStop(1, "#B07A16");
      ctx.strokeStyle = ring;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, hy, BALL_R + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Shadows are decorative: skipped in reduced effects (slow devices only).
  if (!arcadeReducedEffects())
    for (const b of s.balls) {
      const p = btArtBallPoint(s, b, rot);
      marbleShadow(ctx, p.x, p.y, BALL_R);
    }
  for (const b of s.balls) {
    const p = btArtBallPoint(s, b, rot);
    // btRev 7: a boosted marble trails a short streak (behind it, along the way it came; decorative).
    if ((b.bst ?? 0) > 0 && b.cell >= 0 && b.cell < SLOT && !arcadeReducedEffects()) boostStreak(ctx, s, b, p);
    btMarble(ctx, p.x, p.y, BALL_R, BT_PALETTE[b.colour]!, b.colour);
    if (btIsGold(course, b.id)) goldBand(ctx, p.x, p.y, BALL_R);
  }
  // btRev 7: the home-in-a-row combo, on the queue shelf's right (left of an event countdown).
  if (s.r7 && (s.streak ?? 0) >= BT_V7_COMBO_FROM) {
    ctx.save();
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#7A3E0E";
    ctx.fillText(`×${s.streak}`, BT_W - (countdown !== null ? 46 : 12), hy);
    ctx.restore();
  }
  const lastHome=[...s.landings].reverse().find(m=>m.ok);
  successFrame(ctx,{id:'balltrack',tick:s.tick,count:s.home,eventTick:lastHome?.tick,misses:s.wrong+s.lost,colour:TOY_BRASS,width:BT_W,height:BT_H,point:{x:(lastHome?.cell??0)*BT_TILE+BT_TILE/2,y:trayY+BT_TRAY_H/2,shape:'ring',radius:20}});
  void TOY_WOOD_DARK;
}
