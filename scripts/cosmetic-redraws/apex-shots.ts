/**
 * Apex's Neon Night sample pictures (a design tool, not a check): the real renderer (drawRacingPlay, the live stage's
 * call) through @napi-rs/canvas on a real run of the sim, today's Neon Night beside the Blender redraw (forced on for
 * this script only), and a short clip of the redraw (animated WebP).
 *
 *   bun scripts/cosmetic-redraws/apex-shots.ts
 * → docs/design/cosmetics-redraws/samples/apex/{today,redraw}.png, redraw.webp (clip), today.webp (clip)
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "docs/design/cosmetics-redraws/samples/apex");
const R = await import("../../src/lib/arcade/racing.renderer");
const G = await import("../../src/lib/arcade/racing");
const { setRedrawPreview } = await import("../../src/lib/arcade/skins/redrawPreview");
const { setSceneImageForShots } = await import("../../src/lib/arcade/skins/sceneImages");

for (const f of readdirSync(join(ROOT, "public/cosmetics/redrawn")).filter((f) => f.startsWith("apex.")))
  setSceneImageForShots(f.replace(/\.webp$/, ""), await loadImage(join(ROOT, "public/cosmetics/redrawn", f)));

const LOOK = { skin: null, world: "world-theme.apex.neon-night" };
const W = G.RACING_WORLD_W;
const H = G.RACING_WORLD_H;
const game = G.racingGameFor(G.RACING_REV_DEALT);
/** A driven run: through the start lights, then steering gently through the bends. */
function states(seed: number, from: number, count: number, every: number) {
  let s = game.init(seed) as Parameters<typeof R.drawRacingPlay>[1];
  const out: (typeof s)[] = [];
  for (let t = 0; t < from + count * every; t++) {
    s = game.step(s, (t >= 340 ? { t: s.tick + 1, k: 7, a: 0, b: 85, c: 0, d: 0 } : null) as never) as typeof s;
    if (t >= from && (t - from) % every === 0) out.push(s);
  }
  return out;
}
const frame = (s: Parameters<typeof R.drawRacingPlay>[1]) => {
  const c = createCanvas(W, H);
  R.drawRacingPlay(c.getContext("2d") as unknown as CanvasRenderingContext2D, s, { width: W, height: H }, LOOK as never);
  return c;
};

const still = states(6, 900, 1, 1)[0]!;
for (const [name, on] of [["today", false], ["redraw", true]] as const) {
  setRedrawPreview(on ? ["world-theme.apex.neon-night"] : null);
  writeFileSync(join(OUT, `${name}.png`), await frame(still).encode("png"));
}
// The clips: two seconds of driving, every 4th tick (15 fps), as PNG frames for Pillow to assemble.
const clipDir = join(process.env["RENDER_TMP"] ?? "/tmp", "apex-clip");
const { mkdirSync } = await import("node:fs");
for (const [name, on] of [["today", false], ["redraw", true]] as const) {
  setRedrawPreview(on ? ["world-theme.apex.neon-night"] : null);
  mkdirSync(join(clipDir, name), { recursive: true });
  const list = states(6, 760, 45, 4);
  for (let i = 0; i < list.length; i++) writeFileSync(join(clipDir, name, `${String(i).padStart(3, "0")}.png`), await frame(list[i]!).encode("png"));
}
setRedrawPreview(null);
console.log(`apex-shots: stills in ${OUT}, clip frames in ${clipDir}`);
