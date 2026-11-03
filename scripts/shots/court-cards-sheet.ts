/**
 * The court-card sheet (3 Nov 2026, a design tool, not a check): every J, Q and K of the shared Cards & Board deck
 * (drawCourtPortrait in src/lib/arcade/cards/cards.renderer.ts) at each card size a game uses, on the felt, at 2×:
 * 34 × 48 (Five Hands' discards), 39 × 70 (Summit), 48 × 76 (Free Cell), 54 × 78 (Thirteen), 58 × 84 (Five Hands'
 * rows), 74 × 104 (Five Hands' card in hand, Summit's piles) and 92 × 132 (the largest piles).
 *
 *   bun scripts/shots/court-cards-sheet.ts [--out=screenshots/cards-strategy-nov-2026/court-cards.png]
 */
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(w, h);
  }
};
const { drawCard } = await import("../../src/lib/arcade/cards/cards.renderer");
const { cardOf } = await import("../../src/lib/arcade/cards/cards");

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/cards-strategy-nov-2026/court-cards.png";
const SIZES = [[34, 48], [39, 70], [48, 76], [54, 78], [58, 84], [74, 104], [92, 132]] as const;
const SCALE = 2;
const W = 12 * 104 + 16;
const H = SIZES.reduce((a, s) => a + s[1] + 18, 18);
const canvas = createCanvas(W * SCALE, H * SCALE);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
ctx.scale(SCALE, SCALE);
ctx.fillStyle = "#0E2A57";
ctx.fillRect(0, 0, W, H);
let y = 12;
for (const [w, h] of SIZES) {
  let x = 12;
  for (const rank of [11, 12, 13]) for (let suit = 0; suit < 4; suit++) {
    drawCard(ctx, cardOf(suit, rank), x, y, w, h);
    x += 104;
  }
  y += h + 18;
}
writeFileSync(OUT, canvas.toBuffer("image/png"));
console.log(`wrote ${OUT}`);
