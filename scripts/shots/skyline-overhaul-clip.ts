/**
 * High Rise's gallery clip for the Action overhaul (docs/design/pages-review/action/skyline/): a run played by a steady
 * dropper on skylineRev 11, drawn by the game's own renderer with the play screen's fill around it (as ArcadeArenaSlot
 * lays it out on a 414 × 896 home-screen app, the world narrower than the screen), one frame every 1.5 s of play, so the
 * dusk turning to night and the city lighting up show in a few seconds. Frames are written as PNGs; the gallery's
 * animated WebP is made from them with Pillow (see the GALLERY section). A design tool, not a check.
 *
 *   bun scripts/shots/skyline-overhaul-clip.ts <out dir> [screenW=414] [screenH=810] [every=90] [sloppy]
 *
 * `sloppy` drops now and then without waiting for the block (trims, and once the tower is narrow, a lost life).
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1, getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const { skylineLivesGame: g, skylineWorldHFor, SKYLINE_WORLD_W } = await import("../../src/lib/arcade/skyline");
const R = await import("../../src/lib/arcade/skyline.renderer");

const out = process.argv[2] ?? ".shots/skyline-clip";
const W = Number(process.argv[3] ?? 414);
const H = Number(process.argv[4] ?? 810);
const EVERY = Number(process.argv[5] ?? 90);
const SLOPPY = process.argv[6] === "sloppy";
mkdirSync(out, { recursive: true });
const WH = skylineWorldHFor(11);
const scale = Math.min(W / SKYLINE_WORLD_W, H / WH) * 0.94;
const ox = (W - SKYLINE_WORLD_W * scale) / 2;
const view = { worldW: SKYLINE_WORLD_W, worldH: WH, left: -ox / scale, top: 0, right: (W - ox) / scale, bottom: H / scale, scale, boxTop: 0 };
const ww = Math.round(SKYLINE_WORLD_W * scale);
const wh = Math.round(WH * scale);
const world = createCanvas(ww, wh);
const wc = world.getContext("2d") as unknown as CanvasRenderingContext2D;

let s = g.init(4242);
let frame = 0;
// A steady dropper: drops when the block lines up within a few pixels (most drops perfect, now and then a trim).
for (let t = 1; t <= 3600 && !g.isOver(s); t++) {
  const top = s.blocks[s.blocks.length - 1]!;
  const tap = SLOPPY && t % 97 === 0 ? true : Math.abs(s.x - top.x) <= (t % 11 === 0 ? 2_400 : 700);
  s = g.step(s, tap);
  R.drawSkylineArt(wc, s, { width: ww, height: wh });
  if (t % EVERY === 0 || t === 1) {
    const screen = createCanvas(W, H);
    const sc = screen.getContext("2d") as unknown as CanvasRenderingContext2D;
    sc.fillStyle = "#070709";
    sc.fillRect(0, 0, W, H);
    sc.setTransform(scale, 0, 0, scale, ox, 0);
    R.skylineSceneFill(R.skylineNightStep(s.placed))(sc, view);
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.drawImage(world as unknown as CanvasImageSource, Math.round(ox), 0);
    writeFileSync(`${out}/f${String(frame++).padStart(3, "0")}.png`, screen.toBuffer("image/png"));
  }
}
console.log(`${frame} frames, ${s.placed} floors, ${s.livesLost ?? 0} lives lost`);
