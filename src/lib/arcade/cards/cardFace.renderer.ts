/**
 * The Cards & Board overhaul's card face (phase 2 step 4, 15 Nov 2026; display only, never imported by a sim or the
 * server). Free Cell, Summit, Thirteen and Five Hands draw real cards: Blender renders of these faces on linen card
 * stock (`public/cards-board/cards.webp`, built by `scripts/cards-board-art/`); this painter is both the texture
 * Blender maps onto each card and the flat stand-in drawn until the render has loaded (and in node, where checks draw).
 *
 * The face is laid out for legibility at every size the games use (34 to 84 world units wide):
 *   - a top strip, the top 30 % of the card: the rank large and bold at the left, the suit as large at the right, so a
 *     card overlapped from below (Free Cell's columns, Thirteen's rows) or from the right (Summit's bottom row) still
 *     reads at a glance;
 *   - the body below it: the classic pip layout for 2–10, one large suit in a thin gold ring for an Ace, and for the
 *     Jack, Queen and King the shared court portrait (drawCourtPortrait; Blender gives its gold its sheen);
 * Aspect: every game draws these at width : height ≈ 0.68 (CARD_FACE_ASPECT).
 */
import { isRed, RANK_LABELS, rankOf, suitOf } from "./cards";
import { CARD_BLACK, CARD_FONT, CARD_GOLD, CARD_RED, drawCourtPortrait, drawSuit, roundRect } from "./cards.renderer";

/** Width over height of every overhauled card. */
export const CARD_FACE_ASPECT = 0.68;
/** The corner radius as a share of the width. */
export const CARD_FACE_RADIUS = 0.085;

const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  2: [[0.5, 0.12], [0.5, 0.88]],
  3: [[0.5, 0.12], [0.5, 0.5], [0.5, 0.88]],
  4: [[0.27, 0.12], [0.73, 0.12], [0.27, 0.88], [0.73, 0.88]],
  5: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.5], [0.27, 0.88], [0.73, 0.88]],
  6: [[0.27, 0.12], [0.73, 0.12], [0.27, 0.5], [0.73, 0.5], [0.27, 0.88], [0.73, 0.88]],
  7: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.31], [0.27, 0.5], [0.73, 0.5], [0.27, 0.88], [0.73, 0.88]],
  8: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.31], [0.27, 0.5], [0.73, 0.5], [0.5, 0.69], [0.27, 0.88], [0.73, 0.88]],
  9: [[0.27, 0.12], [0.73, 0.12], [0.27, 0.37], [0.73, 0.37], [0.5, 0.5], [0.27, 0.63], [0.73, 0.63], [0.27, 0.88], [0.73, 0.88]],
  10: [[0.27, 0.12], [0.73, 0.12], [0.5, 0.25], [0.27, 0.37], [0.73, 0.37], [0.27, 0.63], [0.73, 0.63], [0.5, 0.75], [0.27, 0.88], [0.73, 0.88]],
};

/** Where the top strip ends, as a share of the height. */
export const CARD_STRIP = 0.3;

/** The rank and suit across the top strip of a w × h face (local coordinates). */
function topStrip(ctx: CanvasRenderingContext2D, card: number, w: number, h: number): void {
  const label = RANK_LABELS[rankOf(card)]!;
  const colour = isRed(card) ? CARD_RED : CARD_BLACK;
  const stripH = h * CARD_STRIP;
  // "10" is two digits: condensed so it takes no more room than a letter.
  const fs = Math.round(Math.min(stripH * 0.86, w * (label.length > 1 ? 0.4 : 0.46)));
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = `900 ${fs}px ${CARD_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const x0 = w * 0.07;
  const mid = stripH * 0.54;
  if (label.length > 1) {
    ctx.save();
    ctx.translate(x0, mid);
    ctx.scale(0.78, 1);
    ctx.fillText(label, -fs * 0.03, fs * 0.04);
    ctx.restore();
  } else ctx.fillText(label, x0, mid + fs * 0.04);
  const ss = Math.min(stripH * 0.62, w * 0.3);
  drawSuit(ctx, suitOf(card), w - w * 0.08 - ss * 0.45, mid, ss);
  ctx.restore();
}

/**
 * One card face at (0, 0), w × h: the stock, the strip, the body and the corner. `stock` false leaves the card stock
 * out (Blender's texture keeps it: the render lays the face on its own linen).
 */
export function paintCardFace(ctx: CanvasRenderingContext2D, card: number, w: number, h: number, stock = true): void {
  const r = Math.max(2, w * CARD_FACE_RADIUS);
  if (stock) {
    roundRect(ctx, 0, 0, w, h, r);
    const face = ctx.createLinearGradient(0, 0, 0, h);
    face.addColorStop(0, "#FFFDF7");
    face.addColorStop(1, "#F4EEE2");
    ctx.fillStyle = face;
    ctx.fill();
    ctx.strokeStyle = "rgba(60,48,30,0.3)";
    ctx.lineWidth = Math.max(0.6, w / 70);
    roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  const rank = rankOf(card);
  const suit = suitOf(card);
  topStrip(ctx, card, w, h);
  // The body: from the strip down to just above the bottom corner index.
  const bx = w * 0.12;
  const by = h * (CARD_STRIP + 0.02);
  const bw = w - 2 * bx;
  const bh = h * 0.95 - by;
  if (rank === 1) {
    const ring = Math.min(bw, bh) * 0.36;
    ctx.strokeStyle = CARD_GOLD;
    ctx.lineWidth = Math.max(1, w * 0.03);
    ctx.beginPath();
    ctx.arc(w / 2, by + bh / 2, ring, 0, Math.PI * 2);
    ctx.stroke();
    drawSuit(ctx, suit, w / 2, by + bh / 2, ring * 1.2);
  } else if (rank >= 11) {
    drawCourtPortrait(ctx, rank, suit, bx, by, bw, bh);
  } else {
    const s = Math.min(bw * 0.27, bh * (rank >= 9 ? 0.17 : 0.19));
    for (const [ux, uy] of PIPS[rank]!) {
      const x = bx + bw * ux;
      const y = by + bh * uy;
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

/** The back: navy with a gold lattice inside a gold frame and the gold medallion (the concepts' back). */
export function paintCardBackFace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const r = Math.max(2, w * CARD_FACE_RADIUS);
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = "#F4EEE2";
  ctx.fill();
  const m = w * 0.06;
  roundRect(ctx, m, m, w - 2 * m, h - 2 * m, r * 0.6);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1C3270");
  g.addColorStop(1, "#0B1636");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(233,196,106,0.32)";
  ctx.lineWidth = Math.max(0.5, w / 80);
  const step = w / 7;
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
  ctx.lineWidth = Math.max(0.8, w / 45);
  roundRect(ctx, m * 1.6, m * 1.6, w - 3.2 * m, h - 3.2 * m, r * 0.45);
  ctx.stroke();
  const cx = w / 2;
  const cy = h / 2;
  const rad = w * 0.21;
  ctx.fillStyle = "#0C1838";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = CARD_GOLD;
  ctx.lineWidth = Math.max(0.8, w / 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.78, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.5, w / 110);
  ctx.stroke();
  // The bolt medallion (our own mark, a plain zigzag).
  ctx.fillStyle = CARD_GOLD;
  ctx.beginPath();
  ctx.moveTo(cx + rad * 0.12, cy - rad * 0.62);
  ctx.lineTo(cx - rad * 0.38, cy + rad * 0.08);
  ctx.lineTo(cx - rad * 0.02, cy + rad * 0.08);
  ctx.lineTo(cx - rad * 0.14, cy + rad * 0.62);
  ctx.lineTo(cx + rad * 0.38, cy - rad * 0.1);
  ctx.lineTo(cx + rad * 0.02, cy - rad * 0.1);
  ctx.closePath();
  ctx.fill();
}
