/**
 * Cosmetics review (13 Nov 2026), a tool, not a check: card backs and the card-front options.
 *
 *  - Card backs: the shared deck's drawCard(…, { down: true }) under each back (withCardsLook), at the sizes the card
 *    games use, at 2 px a world unit (phone) — the default back first.
 *  - Card fronts: three MOCKUPS (nothing in the app draws them). Each starts from the app's real face (drawCard) and
 *    changes only what the option would change, by pixel: the indices and pips are copied untouched.
 *      A "Card stock"  — the face's paper (the cream background pixels) and its edge; ink untouched.
 *      B "Court set"   — the J, Q, K portraits recoloured as a set; indices and the other 40 cards untouched.
 *      C "Ink finish"  — the suit and rank ink given a finish (foil); red stays red, black stays black.
 *
 *   bun docs/cosmetics-review/tools/render-cards.ts
 */
import { createCanvas, Path2D as NapiPath2D, type SKRSContext2D } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

const R = await import("../../../src/lib/arcade/cards/cards.renderer");
const { CARD_BACK_IDS, NO_LOOK } = await import("../../../src/lib/arcade/skins/look");
const { setSkinReducedMotion } = await import("../../../src/lib/arcade/skins/motion.renderer");
setSkinReducedMotion(true);

const OUT = "docs/cosmetics-review/png/cards";
mkdirSync(OUT, { recursive: true });
type Ctx = CanvasRenderingContext2D;
const S = 2; // device px a world unit (phone)

/* Card ids: suit * 13 + rank (0 = Ace … 12 = King), as cards.ts. */
const card = (rank: number, suit: number) => suit * 13 + rank;
const HAND = [card(0, 0), card(9, 1), card(10, 2), card(11, 3), card(12, 0), card(6, 1)];

function sheet(name: string, cards: number[], w: number, h: number, look = NO_LOOK, down = false, after?: (c: SKRSContext2D, x: number, y: number, k: number) => void) {
  const gap = 10;
  const c = createCanvas(((w + gap) * cards.length + gap) * S, (h + 2 * gap) * S);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0E2A57";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(S, S);
  R.withCardsLook({ ...look }, () => {
    cards.forEach((id, k) => R.drawCard(ctx as unknown as Ctx, id, gap + k * (w + gap), gap, w, h, { down }));
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (after) cards.forEach((_, k) => after(ctx, (gap + k * (w + gap)) * S, gap * S, k));
  writeFileSync(`${OUT}/${name}.png`, c.toBuffer("image/png"));
}

/* Card backs at Free Cell / Summit size (48 × 76) and Full House's Next card size (60 × 84). */
for (const back of [null, ...CARD_BACK_IDS]) {
  const tag = back ?? "default";
  sheet(`back--${tag}--small`, [0, 1, 2], 48, 76, { ...NO_LOOK, back }, true);
  sheet(`back--${tag}--large`, [0], 60, 84, { ...NO_LOOK, back }, true);
}

/* The default fronts at both sizes. */
sheet("front--default--small", HAND, 48, 76);
sheet("front--default--large", HAND, 72, 104);

/* Pixel helpers over the device-pixel card box. */
const isPaper = (r: number, g: number, b: number) => r > 200 && g > 190 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
function eachPixel(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, fn: (d: Uint8ClampedArray, i: number, px: number, py: number) => void) {
  const img = ctx.getImageData(x, y, w, h);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) fn(img.data as unknown as Uint8ClampedArray, (py * w + px) * 4, px, py);
  ctx.putImageData(img, x, y);
}

/* A: card stock — the paper becomes a pearl stock with a faint diamond weave; a gold edge. */
const stock = (W: number, H: number) => (c: SKRSContext2D, x: number, y: number) => {
  eachPixel(c, x, y, W * S, H * S, (d, i, px, py) => {
    if (!isPaper(d[i]!, d[i + 1]!, d[i + 2]!)) return;
    const t = py / (H * S);
    const weave = ((px + py) % 10 < 1 || (px - py + 1000) % 10 < 1) ? -10 : 0;
    d[i] = Math.round(236 - 14 * t + weave);
    d[i + 1] = Math.round(240 - 10 * t + weave);
    d[i + 2] = Math.round(250 - 4 * t + weave);
  });
  c.save();
  c.strokeStyle = "#D9B45A";
  c.lineWidth = 2 * S * 0.6;
  c.beginPath();
  c.roundRect(x + 2 * S, y + 2 * S, (W - 4) * S, (H - 4) * S, Math.max(3, W * 0.07) * S);
  c.stroke();
  c.restore();
};
sheet("front--A-stock--small", HAND, 48, 76, NO_LOOK, false, stock(48, 76));
sheet("front--A-stock--large", HAND, 72, 104, NO_LOOK, false, stock(72, 104));

/* B: court set — only the court cards' portrait panel (inside the indices' margin) recoloured to a neon set. */
const court = (W: number, H: number) => (c: SKRSContext2D, x: number, y: number, k: number) => {
  const rank = HAND[k]! % 13;
  if (rank < 10) return;
  const mx = Math.round(W * 0.22 * S);
  const my = Math.round(H * 0.2 * S);
  eachPixel(c, x + mx, y + my, W * S - 2 * mx, H * S - 2 * my, (d, i) => {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    if (isPaper(r, g, b)) {
      d[i] = 22; d[i + 1] = 18; d[i + 2] = 48; // a night panel behind the portrait
      return;
    }
    const lum = (r + g + b) / 3;
    // Portrait inks to a cyan / magenta / gold set by their own hue.
    if (r > g + 40) { d[i] = 255; d[i + 1] = 70; d[i + 2] = Math.min(255, 140 + lum / 4); }
    else if (b > r + 10) { d[i] = 60; d[i + 1] = 230; d[i + 2] = 255; }
    else { d[i] = 240; d[i + 1] = 200; d[i + 2] = Math.min(255, 80 + lum / 3); }
  });
};
sheet("front--B-court--small", HAND, 48, 76, NO_LOOK, false, court(48, 76));
sheet("front--B-court--large", HAND, 72, 104, NO_LOOK, false, court(72, 104));

/* C: ink finish — the red and black ink given a foil gradient (red stays red, black stays black). */
const ink = (W: number, H: number) => (c: SKRSContext2D, x: number, y: number) => {
  eachPixel(c, x, y, W * S, H * S, (d, i, px, py) => {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    if (isPaper(r, g, b)) return;
    const t = (px + py) / ((W + H) * S);
    const shine = Math.round(40 * Math.sin(t * Math.PI * 3));
    if (r > g + 60) { d[i] = Math.min(255, 200 + shine); d[i + 1] = Math.max(0, 30 + shine / 2); d[i + 2] = Math.max(0, 50 + shine / 2); }
    else if (r < 90 && g < 90 && b < 110) { const v = Math.max(0, Math.min(255, 30 + shine)); d[i] = v; d[i + 1] = v; d[i + 2] = v + 18; }
  });
};
sheet("front--C-ink--small", HAND, 48, 76, NO_LOOK, false, ink(48, 76));
sheet("front--C-ink--large", HAND, 72, 104, NO_LOOK, false, ink(72, 104));
console.log("render-cards: done");
