/**
 * The Cards & Board overhaul's textures (15 Nov 2026): every card face and the back (cardFace.renderer.ts) and every
 * Mahjong face (mahjong.renderer.ts's paintMahjongFace) as flat PNGs, which `render.py` lays onto real card stock and
 * ivory tiles in Blender. Usage: bun scripts/cards-board-art/textures.ts <out dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

import { paintCardBackFace, paintCardFace } from "../../src/lib/arcade/cards/cardFace.renderer";
import { paintMahjongFace } from "../../src/lib/arcade/mahjong.renderer";
import { MAHJONG_BOARD_H, MAHJONG_BOARD_Y, MAHJONG_WORLD_H, MAHJONG_WORLD_W } from "../../src/lib/arcade/mahjong";
import { roundRect } from "../../src/lib/arcade/cards/cards.renderer";

const out = process.argv[2];
if (!out) throw new Error("usage: textures.ts <out dir>");
mkdirSync(out, { recursive: true });
if (!GlobalFonts.registerFromPath(join(import.meta.dir, "../../public/fonts/archivo-var-latin.woff2"), "Archivo")) throw new Error("Archivo not registered");

/** Texture size of a card (0.68 aspect, a little over 3× the largest card any game draws). */
export const TEX_W = 340;
export const TEX_H = 500;

function save(name: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): void {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  paint(ctx);
  writeFileSync(join(out, name), c.toBuffer("image/png"));
}

for (let card = 0; card < 52; card++) save(`card-${card}.png`, TEX_W, TEX_H, (ctx) => paintCardFace(ctx, card, TEX_W, TEX_H));
save("card-back.png", TEX_W, TEX_H, (ctx) => paintCardBackFace(ctx, TEX_W, TEX_H));

/** Mahjong faces on a tile-face rectangle (56 × 74 at 5×), ivory under the face so Blender can key nothing. */
const MW = 280;
const MH = 370;
for (let face = 0; face < 34; face++) {
  save(`tile-${face}.png`, MW, MH, (ctx) => {
    ctx.fillStyle = "#FBF6E8";
    ctx.fillRect(0, 0, MW, MH);
    ctx.save();
    ctx.scale(5, 5);
    paintMahjongFace(ctx, face, 0, 0, 56, 74);
    ctx.restore();
  });
}
/** A dashed seam (white on black, the stitch mask) round a rounded rectangle inset `inset` from a w × h texture. */
function seam(name: string, w: number, h: number, inset: number, radius: number, dash: number, gap: number, width: number): void {
  save(name, w, h, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.setLineDash([dash, gap]);
    roundRect(ctx, inset, inset, w - 2 * inset, h - 2 * inset, radius);
    ctx.stroke();
  });
}
// The card table's seam (2× the 414 × 772 world: today's dashed outline 5 units in, as a stitched thread).
seam("stitch-felt.png", 828, 1544, 12, 28, 11, 8, 3.4);
// Mahjong's mat (2× its world: the mat's own stitching 7 units inside it).
const matH = MAHJONG_BOARD_H + 46;
seam("stitch-mat.png", (MAHJONG_WORLD_W - 8) * 2, matH * 2, 14, 22, 10, 8, 3.4);
writeFileSync(join(out, "mahjong.json"), JSON.stringify({ worldH: MAHJONG_WORLD_H, matY: MAHJONG_BOARD_Y - 34, matH }));
console.log(`textures written to ${out}`);
