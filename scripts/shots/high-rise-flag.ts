/**
 * High Rise's flag for review (Prompt R, 23 Oct 2026; a design tool, not a check): a bot plays today's dealt
 * revision past block 20 (the flag flies from then) to a gust, and the real renderer (skyline.renderer.ts, the
 * app icon file loaded from public/) draws it at 414 px wide, 2×: the whole screen and the flag close up.
 *
 *   bun scripts/shots/high-rise-flag.ts [--out=screenshots/app-redesign-oct-2026]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, Image as NapiImage, Path2D as NapiPath2D } from "@napi-rs/canvas";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/app-redesign-oct-2026";
mkdirSync(OUT, { recursive: true });

// The browser globals the renderers read (as arcade-fx-check), and an Image that loads from public/.
let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2 },
});
Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    constructor(w: number, h: number) {
      return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
  },
});
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined")
  Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
const loads: Promise<void>[] = [];
// A real canvas Image (drawImage takes nothing else) whose src reads the file from public/.
class PublicImage {
  constructor() {
    const img = new NapiImage();
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(img), "src")!.set!;
    let done: () => void = () => undefined;
    loads.push(new Promise((resolve) => (done = resolve)));
    Object.defineProperty(img, "src", {
      set(url: string) {
        const onload = img.onload;
        img.onload = () => {
          (onload as (() => void) | null)?.call(img);
          done();
        };
        set.call(img, readFileSync(`public${url}`));
      },
    });
    return img;
  }
}
Object.defineProperty(globalThis, "Image", { configurable: true, value: PublicImage });

const { generateSkyline } = await import("../../src/lib/duel/arcade.server");
const { skylineGameFor, skylineFlagAt, skylineWorldH, SKYLINE_WORLD_W } = await import("../../src/lib/arcade/skyline");
const { drawSkylineArt } = await import("../../src/lib/arcade/skyline.renderer");

const rev = generateSkyline().skylineRev;
const game = skylineGameFor(rev);
// The bot: drop each block on the tick it best lines up with the one below (arcade-batch4-check's).
let s = game.init(7);
let planned = -1;
let found: typeof s | null = null;
while (!game.isOver(s) && !found) {
  if (planned < 0) {
    const below = s.blocks[s.blocks.length - 1]!;
    let p = s;
    let best = Infinity;
    planned = s.tick + 1;
    for (let k = 1; k < 240; k++) {
      p = game.step(p, false);
      const d = Math.abs(p.x - below.x);
      if (d < best) {
        best = d;
        planned = p.tick + 1;
      }
      if (d < 128) break;
    }
  }
  const t = s.tick + 1;
  const tap = t === planned;
  if (tap) planned = -1;
  s = game.step(s, tap);
  if (s.placed >= 22 && skylineFlagAt(s, s.tick) !== 0) found = s;
}
if (!found) throw new Error("the bot never reached a gust after block 20");

const W = 414;
const H = Math.round((W * skylineWorldH(found)) / SKYLINE_WORLD_W);
const draw = () => {
  const canvas = createCanvas(W * 2, H * 2);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  drawSkylineArt(ctx, found!, { width: W, height: H });
  return canvas;
};
draw(); // starts the icon's load
await Promise.all(loads);
clock += 1000;
const canvas = draw();
writeFileSync(join(OUT, "high-rise-flag-414w.jpg"), canvas.toBuffer("image/jpeg", 85));
console.log(`High Rise rev ${rev}, block ${found.placed}, flag ${skylineFlagAt(found, found.tick)}: ${OUT}/high-rise-flag-414w.jpg`);
