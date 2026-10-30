/**
 * The Cards & Board deck and table (30 Oct 2026; display only, never imported by a sim or the server). One look for
 * FreeCell, TriPeaks and Poker Squares:
 *
 *  - faces warm white with a faint paper grain and a light sheen; indexes in both corners; proper pip layouts for
 *    2–10 when the card is large enough, one large suit when small; court cards a gold emblem (crown K, tiara Q,
 *    feathered cap J with the feather in the suit colour) over a large letter, no framed panel; aces a large suit in
 *    a thin gold ring;
 *  - backs a navy gradient with a gold lattice, a gold border and a "J" monogram;
 *  - the table deep blue felt with a woven texture, lamp light from above, gold stitching round the edge and a very
 *    faint "JOULZ" in the cloth.
 *
 * Cards and the felt are painted once per size and pixel scale into cached canvases and blitted each frame.
 */
import { isRed, RANK_LABELS, rankOf, suitOf } from "./cards";

export const CARD_RED = "#C42A3C";
export const CARD_BLACK = "#1A1E29";
export const CARD_GOLD = "#E9C46A";
export const CARD_GOLD_DEEP = "#B8862E";
export const FELT_BASE = "#0E2A57";
export const CARD_FONT = "'Archivo', system-ui, sans-serif";

/** A rounded rectangle path. */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A suit symbol of height `s`, centred on (x, y). */
export function suitPath(ctx: CanvasRenderingContext2D, suit: number, x: number, y: number, s: number): void {
  const h = s / 2;
  ctx.beginPath();
  if (suit === 1) {
    // Heart.
    ctx.moveTo(x, y + h);
    ctx.bezierCurveTo(x - h * 1.1, y + h * 0.1, x - h * 1.05, y - h * 0.95, x - h * 0.5, y - h * 0.95);
    ctx.bezierCurveTo(x - h * 0.15, y - h * 0.95, x, y - h * 0.6, x, y - h * 0.45);
    ctx.bezierCurveTo(x, y - h * 0.6, x + h * 0.15, y - h * 0.95, x + h * 0.5, y - h * 0.95);
    ctx.bezierCurveTo(x + h * 1.05, y - h * 0.95, x + h * 1.1, y + h * 0.1, x, y + h);
  } else if (suit === 2) {
    // Diamond.
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + h * 0.35, y - h * 0.35, x + h * 0.78, y);
    ctx.quadraticCurveTo(x + h * 0.35, y + h * 0.35, x, y + h);
    ctx.quadraticCurveTo(x - h * 0.35, y + h * 0.35, x - h * 0.78, y);
    ctx.quadraticCurveTo(x - h * 0.35, y - h * 0.35, x, y - h);
  } else if (suit === 0) {
    // Spade.
    ctx.moveTo(x, y - h);
    ctx.bezierCurveTo(x + h * 0.25, y - h * 0.55, x + h * 1.05, y - h * 0.2, x + h * 0.95, y + h * 0.3);
    ctx.bezierCurveTo(x + h * 0.85, y + h * 0.75, x + h * 0.3, y + h * 0.7, x + h * 0.08, y + h * 0.42);
    ctx.lineTo(x + h * 0.32, y + h);
    ctx.lineTo(x - h * 0.32, y + h);
    ctx.lineTo(x - h * 0.08, y + h * 0.42);
    ctx.bezierCurveTo(x - h * 0.3, y + h * 0.7, x - h * 0.85, y + h * 0.75, x - h * 0.95, y + h * 0.3);
    ctx.bezierCurveTo(x - h * 1.05, y - h * 0.2, x - h * 0.25, y - h * 0.55, x, y - h);
  } else {
    // Club: three lobes and a stem.
    const r = h * 0.42;
    ctx.moveTo(x + r, y - h * 0.48);
    ctx.arc(x, y - h * 0.48, r, 0, Math.PI * 2);
    ctx.moveTo(x - h * 0.45 + r, y + h * 0.12);
    ctx.arc(x - h * 0.45, y + h * 0.12, r, 0, Math.PI * 2);
    ctx.moveTo(x + h * 0.45 + r, y + h * 0.12);
    ctx.arc(x + h * 0.45, y + h * 0.12, r, 0, Math.PI * 2);
    ctx.moveTo(x - h * 0.1, y);
    ctx.lineTo(x + h * 0.1, y);
    ctx.lineTo(x + h * 0.3, y + h);
    ctx.lineTo(x - h * 0.3, y + h);
    ctx.closePath();
  }
}

export function drawSuit(ctx: CanvasRenderingContext2D, suit: number, x: number, y: number, s: number, colour?: string): void {
  ctx.fillStyle = colour ?? (suit === 1 || suit === 2 ? CARD_RED : CARD_BLACK);
  suitPath(ctx, suit, x, y, s);
  ctx.fill();
}

/* ============================== Court emblems ============================== */

function goldFill(ctx: CanvasRenderingContext2D, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#F7DD8E");
  g.addColorStop(0.55, CARD_GOLD);
  g.addColorStop(1, CARD_GOLD_DEEP);
  return g;
}

/** The gold emblem over a court card's letter: crown (13), tiara (12), feathered cap (11). Width about `w`. */
function drawEmblem(ctx: CanvasRenderingContext2D, rank: number, suit: number, cx: number, cy: number, w: number): void {
  const h = w * 0.62;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = CARD_GOLD_DEEP;
  ctx.lineWidth = Math.max(0.6, w * 0.035);
  if (rank === 13) {
    // Crown: a band and five points tipped with pearls.
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    ctx.lineTo(x0, y0 + h * 0.3);
    ctx.lineTo(x0 + w * 0.25, y0 + h * 0.62);
    ctx.lineTo(x0 + w * 0.5, y0 + h * 0.12);
    ctx.lineTo(x0 + w * 0.75, y0 + h * 0.62);
    ctx.lineTo(x0 + w, y0 + h * 0.3);
    ctx.lineTo(x0 + w, y0 + h);
    ctx.closePath();
    ctx.fillStyle = goldFill(ctx, y0, y0 + h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#FFF4D0";
    for (const [px, py] of [[0, 0.3], [0.5, 0.12], [1, 0.3]] as const) {
      ctx.beginPath();
      ctx.arc(x0 + w * px, y0 + h * py, w * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = suit === 1 || suit === 2 ? CARD_RED : CARD_BLACK;
    ctx.beginPath();
    ctx.arc(cx, y0 + h * 0.8, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else if (rank === 12) {
    // Tiara: a low arc with a tall centre jewel.
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    ctx.quadraticCurveTo(x0 + w * 0.12, y0 + h * 0.5, x0 + w * 0.35, y0 + h * 0.45);
    ctx.lineTo(x0 + w * 0.5, y0 + h * 0.05);
    ctx.lineTo(x0 + w * 0.65, y0 + h * 0.45);
    ctx.quadraticCurveTo(x0 + w * 0.88, y0 + h * 0.5, x0 + w, y0 + h);
    ctx.quadraticCurveTo(cx, y0 + h * 0.72, x0, y0 + h);
    ctx.closePath();
    ctx.fillStyle = goldFill(ctx, y0, y0 + h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = suit === 1 || suit === 2 ? CARD_RED : CARD_BLACK;
    ctx.beginPath();
    ctx.moveTo(cx, y0 + h * 0.3);
    ctx.lineTo(cx + w * 0.07, y0 + h * 0.5);
    ctx.lineTo(cx, y0 + h * 0.7);
    ctx.lineTo(cx - w * 0.07, y0 + h * 0.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Feathered cap: a dome and brim, a feather in the suit colour sweeping back.
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.5, y0 + h * 0.5);
    ctx.bezierCurveTo(x0 + w * 0.7, y0 - h * 0.15, x0 + w * 1.05, y0 - h * 0.05, x0 + w * 1.02, y0 + h * 0.18);
    ctx.bezierCurveTo(x0 + w * 0.85, y0 + h * 0.12, x0 + w * 0.7, y0 + h * 0.3, x0 + w * 0.56, y0 + h * 0.56);
    ctx.closePath();
    ctx.fillStyle = suit === 1 || suit === 2 ? CARD_RED : "#2B3550";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.12, y0 + h * 0.86);
    ctx.bezierCurveTo(x0 + w * 0.12, y0 + h * 0.2, x0 + w * 0.88, y0 + h * 0.2, x0 + w * 0.88, y0 + h * 0.86);
    ctx.closePath();
    ctx.fillStyle = goldFill(ctx, y0 + h * 0.25, y0 + h);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h * 0.88, w * 0.5, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = goldFill(ctx, y0 + h * 0.76, y0 + h);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/* ================================ Pips ================================ */

const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  2: [[0.5, 0.18], [0.5, 0.82]],
  3: [[0.5, 0.18], [0.5, 0.5], [0.5, 0.82]],
  4: [[0.28, 0.18], [0.72, 0.18], [0.28, 0.82], [0.72, 0.82]],
  5: [[0.28, 0.18], [0.72, 0.18], [0.5, 0.5], [0.28, 0.82], [0.72, 0.82]],
  6: [[0.28, 0.18], [0.72, 0.18], [0.28, 0.5], [0.72, 0.5], [0.28, 0.82], [0.72, 0.82]],
  7: [[0.28, 0.18], [0.72, 0.18], [0.5, 0.34], [0.28, 0.5], [0.72, 0.5], [0.28, 0.82], [0.72, 0.82]],
  8: [[0.28, 0.18], [0.72, 0.18], [0.5, 0.34], [0.28, 0.5], [0.72, 0.5], [0.5, 0.66], [0.28, 0.82], [0.72, 0.82]],
  9: [[0.28, 0.18], [0.72, 0.18], [0.28, 0.39], [0.72, 0.39], [0.5, 0.5], [0.28, 0.61], [0.72, 0.61], [0.28, 0.82], [0.72, 0.82]],
  10: [[0.28, 0.18], [0.72, 0.18], [0.5, 0.29], [0.28, 0.39], [0.72, 0.39], [0.28, 0.61], [0.72, 0.61], [0.5, 0.71], [0.28, 0.82], [0.72, 0.82]],
};

/** Pip layouts are drawn from this card width up; smaller cards show one large suit. */
export const PIP_MIN_W = 56;

/* ================================ Painting ================================ */

/** A seeded grain (display only, the same on every paint). */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, seed: number, step: number): void {
  let s = seed >>> 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const v = (s >>> 24) / 255;
      if (v > 0.55) {
        ctx.fillStyle = `rgba(120,100,70,${(alpha * (v - 0.55)) / 0.45})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  }
}

function paintFace(ctx: CanvasRenderingContext2D, card: number, w: number, h: number): void {
  const r = Math.max(3, w * 0.09);
  const suit = suitOf(card);
  const rank = rankOf(card);
  const colour = isRed(card) ? CARD_RED : CARD_BLACK;
  roundRect(ctx, 0, 0, w, h, r);
  const face = ctx.createLinearGradient(0, 0, w, h);
  face.addColorStop(0, "#FFFBF2");
  face.addColorStop(1, "#F3EADB");
  ctx.fillStyle = face;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  grain(ctx, w, h, 0.05, card * 977 + 13, Math.max(1, w / 40));
  // Light sheen across the upper left.
  const sheen = ctx.createLinearGradient(0, 0, w * 0.8, h * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.55)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(60,48,30,0.28)";
  ctx.lineWidth = Math.max(0.6, w / 70);
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();

  const label = RANK_LABELS[rank]!;
  const big = w < PIP_MIN_W;
  const cx = w / 2;
  if (big) {
    // A small or overlapped card: the large index, rank and suit side by side across the top strip (and mirrored at
    // the bottom), bold enough to read at a glance in the strip an overlapping card leaves showing; one large suit,
    // emblem or ringed Ace in the body below it.
    const strip = (flip: boolean) => {
      ctx.save();
      if (flip) {
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
      }
      const fs = Math.round(w * (label.length > 1 ? 0.36 : 0.42));
      ctx.fillStyle = colour;
      ctx.font = `900 ${fs}px ${CARD_FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const top = Math.max(2, w * 0.05);
      const mid = top + fs * 0.5;
      const x0 = Math.max(2, w * 0.07);
      ctx.fillText(label, x0, mid + fs * 0.04);
      const tw = ctx.measureText(label).width;
      const ss = Math.min(fs * 0.86, w - (x0 + tw) - w * 0.1);
      drawSuit(ctx, suit, x0 + tw + w * 0.05 + ss / 2, mid, ss);
      ctx.restore();
    };
    strip(false);
    strip(true);
    // The body between the two strips.
    const by = h * 0.52;
    const room = Math.min(w * 0.62, h - 2 * (w * 0.5));
    if (rank === 1) {
      const ring = Math.max(4, room * 0.5);
      ctx.strokeStyle = CARD_GOLD;
      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.beginPath();
      ctx.arc(cx, by, ring, 0, Math.PI * 2);
      ctx.stroke();
      drawSuit(ctx, suit, cx, by, ring * 1.15);
    } else if (rank >= 11) {
      drawEmblem(ctx, rank, suit, cx, by, Math.max(8, room * 0.9));
    } else {
      drawSuit(ctx, suit, cx, by, Math.max(6, room));
    }
    return;
  }

  // Pip-size cards: indexes in both corners (enlarged 30 Oct 2026), pips or a court or Ace in the middle.
  const fs = Math.round(w * 0.26 * (label.length > 1 ? 0.86 : 1));
  const ix = w * 0.06;
  const corner = (flip: boolean) => {
    ctx.save();
    if (flip) {
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = colour;
    ctx.font = `900 ${fs}px ${CARD_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, ix, h * 0.035);
    drawSuit(ctx, suit, ix + fs * 0.38, h * 0.035 + fs * 1.25, fs * 0.74);
    ctx.restore();
  };
  corner(false);
  corner(true);

  if (rank === 1) {
    // Ace: a large suit inside a thin gold ring.
    const ring = Math.min(w, h) * 0.28;
    ctx.strokeStyle = CARD_GOLD;
    ctx.lineWidth = Math.max(1, w * 0.025);
    ctx.beginPath();
    ctx.arc(cx, h / 2, ring, 0, Math.PI * 2);
    ctx.stroke();
    drawSuit(ctx, suit, cx, h / 2, ring * 1.15);
  } else if (rank >= 11) {
    // Court: a gold emblem above a large letter, no panel.
    drawEmblem(ctx, rank, suit, cx, h * 0.36, w * 0.38);
    ctx.fillStyle = colour;
    ctx.font = `800 ${Math.round(h * 0.32)}px ${CARD_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, h * 0.64);
  } else {
    const px0 = w * 0.25;
    const pw = w - 2 * px0;
    const py0 = h * 0.14;
    const ph = h - 2 * py0;
    const s = Math.min(w * 0.18, ph * 0.16);
    for (const [ux, uy] of PIPS[rank]!) {
      const x = px0 + pw * ux;
      const y = py0 + ph * uy;
      if (uy > 0.5) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI);
        drawSuit(ctx, suit, 0, 0, s);
        ctx.restore();
      } else drawSuit(ctx, suit, x, y, s);
    }
  }
}

function paintBack(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const r = Math.max(3, w * 0.09);
  roundRect(ctx, 0, 0, w, h, r);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1D3270");
  g.addColorStop(1, "#0A1534");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  roundRect(ctx, w * 0.08, w * 0.08, w - w * 0.16, h - w * 0.16, r * 0.6);
  ctx.clip();
  // Gold lattice.
  ctx.strokeStyle = "rgba(233,196,106,0.35)";
  ctx.lineWidth = Math.max(0.5, w / 90);
  const step = w / 6;
  for (let d = -h; d < w + h; d += step) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + h, h);
    ctx.moveTo(d + h, 0);
    ctx.lineTo(d, h);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = CARD_GOLD;
  ctx.lineWidth = Math.max(1, w / 40);
  roundRect(ctx, w * 0.08, w * 0.08, w - w * 0.16, h - w * 0.16, r * 0.6);
  ctx.stroke();
  // The "J" monogram on a navy disc.
  const cx = w / 2;
  const cy = h / 2;
  const rad = w * 0.22;
  ctx.fillStyle = "#0C1838";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = CARD_GOLD;
  ctx.lineWidth = Math.max(0.8, w / 60);
  ctx.stroke();
  ctx.fillStyle = CARD_GOLD;
  ctx.font = `800 ${Math.round(rad * 1.25)}px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("J", cx, cy + rad * 0.06);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

/* ================================ Caches ================================ */

const PAD = 4;
const cache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** The context's pixel scale (world units to device pixels), rounded so caches are reused. */
function scaleOf(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const s = t ? Math.hypot(t.a, t.b) : 1;
  return Math.max(0.5, Math.round(s * 4) / 4);
}

function cached(key: string, w: number, h: number, scale: number, paint: (c: CanvasRenderingContext2D) => void) {
  const full = `${key}:${w}x${h}@${scale}`;
  let canvas = cache.get(full);
  if (!canvas) {
    if (cache.size > 400) cache.clear();
    canvas = makeCanvas(Math.ceil((w + PAD * 2) * scale), Math.ceil((h + PAD * 2) * scale));
    const c = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (c) {
      c.scale(scale, scale);
      c.translate(PAD, PAD);
      // A soft shadow under every card.
      c.save();
      c.shadowColor = "rgba(0,0,0,0.45)";
      c.shadowBlur = 3;
      c.shadowOffsetY = 1.5;
      roundRect(c, 0, 0, w, h, Math.max(3, w * 0.09));
      c.fillStyle = "#000";
      c.fill();
      c.restore();
      paint(c);
    }
    cache.set(full, canvas);
  }
  return canvas;
}

export interface CardLook {
  /** Face down (a back). */
  down?: boolean;
  /** The gold glow: selected, playable or lit. */
  glow?: number;
  /** Dimmed (not playable). */
  dim?: number;
}

/** Draws one card at (x, y), w × h world units. */
export function drawCard(ctx: CanvasRenderingContext2D, card: number, x: number, y: number, w: number, h: number, look: CardLook = {}): void {
  const scale = scaleOf(ctx);
  if (look.glow && look.glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(255,205,90,${Math.min(1, look.glow)})`;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `rgba(255,214,110,${Math.min(1, look.glow)})`;
    ctx.lineWidth = 2.5;
    roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, Math.max(4, w * 0.1));
    ctx.stroke();
    ctx.restore();
  }
  const img = look.down ? cached("back", w, h, scale, (c) => paintBack(c, w, h)) : cached(`c${card}`, w, h, scale, (c) => paintFace(c, card, w, h));
  ctx.drawImage(img as CanvasImageSource, x - PAD, y - PAD, w + PAD * 2, h + PAD * 2);
  if (look.dim && look.dim > 0) {
    ctx.fillStyle = `rgba(8,18,40,${Math.min(0.7, look.dim)})`;
    roundRect(ctx, x, y, w, h, Math.max(3, w * 0.09));
    ctx.fill();
  }
}

/** An empty pile: a soft inset outline, with a faint suit or label inside. */
export function drawSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, suit = -1, label = ""): void {
  roundRect(ctx, x, y, w, h, Math.max(3, w * 0.09));
  ctx.fillStyle = "rgba(4,12,32,0.35)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.32)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (suit >= 0) drawSuit(ctx, suit, x + w / 2, y + h / 2, w * 0.42, "rgba(233,196,106,0.22)");
  if (label) {
    ctx.fillStyle = "rgba(233,196,106,0.4)";
    ctx.font = `700 ${Math.round(w * 0.16)}px ${CARD_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
}

/** The felt (cached per world size and scale): deep blue, woven, lamp-lit, gold stitching and a faint JOULZ. */
export function drawFelt(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const scale = scaleOf(ctx);
  const key = `felt:${w}x${h}@${scale}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = makeCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
    const c = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (c) {
      c.scale(scale, scale);
      paintFelt(c, w, h);
    }
    cache.set(key, canvas);
  }
  ctx.drawImage(canvas as CanvasImageSource, 0, 0, w, h);
}

export function paintFelt(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = FELT_BASE;
  c.fillRect(0, 0, w, h);
  // Lamp light from above, falling off to the corners.
  const lamp = c.createRadialGradient(w / 2, h * 0.32, 10, w / 2, h * 0.38, Math.max(w, h) * 0.75);
  lamp.addColorStop(0, "rgba(70,120,210,0.55)");
  lamp.addColorStop(0.5, "rgba(30,70,150,0.18)");
  lamp.addColorStop(1, "rgba(0,6,20,0.65)");
  c.fillStyle = lamp;
  c.fillRect(0, 0, w, h);
  // The weave: fine crossing threads.
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
  // A very faint JOULZ in the cloth.
  c.save();
  c.translate(w / 2, h * 0.55);
  c.rotate(-0.18);
  c.fillStyle = "rgba(255,255,255,0.035)";
  c.font = `900 ${Math.round(w * 0.24)}px ${CARD_FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("JOULZ", 0, 0);
  c.restore();
  // Gold stitching round the edge.
  c.strokeStyle = "rgba(233,196,106,0.55)";
  c.lineWidth = 1.2;
  c.setLineDash([5, 4]);
  roundRect(c, 5, 5, w - 10, h - 10, 14);
  c.stroke();
  c.setLineDash([]);
}

/* ================================ HUD chips ================================ */

/** A HUD chip: a dark pill with a label and a value; `gold` for the lit state. Returns its width. */
export function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, opts: { gold?: boolean; align?: "left" | "right" | "center"; h?: number } = {}): number {
  const h = opts.h ?? 26;
  ctx.font = `700 11px ${CARD_FONT}`;
  const lw = label ? ctx.measureText(label).width + 6 : 0;
  ctx.font = `800 14px ${CARD_FONT}`;
  const vw = ctx.measureText(value).width;
  const w = Math.ceil(lw + vw + 22);
  const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
  roundRect(ctx, left, y, w, h, h / 2);
  ctx.fillStyle = opts.gold ? "rgba(233,196,106,0.95)" : "rgba(5,12,30,0.62)";
  ctx.fill();
  ctx.strokeStyle = opts.gold ? "#FFE7A3" : "rgba(233,196,106,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (label) {
    ctx.font = `700 11px ${CARD_FONT}`;
    ctx.fillStyle = opts.gold ? "rgba(40,26,4,0.75)" : "rgba(233,220,190,0.7)";
    ctx.fillText(label, left + 11, y + h / 2 + 0.5);
  }
  ctx.font = `800 14px ${CARD_FONT}`;
  ctx.fillStyle = opts.gold ? "#231503" : "#F6EBD0";
  ctx.fillText(value, left + 11 + lw, y + h / 2 + 0.5);
  return w;
}
