/**
 * Orbit's planet contact sheet (the stage-2 look pass; a design tool, not a check): every planet type in each of the
 * eight seeded colours, drawn by the real renderer from the shipped Blender maps at a chosen device scale and turn.
 *
 *   bun scripts/shots/orbit-planet-sheet.ts [--scale=2.84] [--turn=0.1] [--ring] --out=<file.png>
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const g = globalThis as Record<string, unknown>;
g.document = { createElement: () => createCanvas(1, 1), documentElement: { dataset: {}, classList: { contains: () => false } } };
g.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
g.matchMedia = (g.window as { matchMedia: unknown }).matchMedia;
const P = await import("../../src/lib/arcade/orbitPlanets.renderer");
const { ORBIT_PLANET_MAPS } = await import("../../src/lib/arcade/orbitPlanetMaps.data");
const put = async (k: string, f: string) => {
  const im = await loadImage(`public/orbit/planets/${f}`);
  const c = createCanvas(im.width, im.height);
  const x = c.getContext("2d");
  x.drawImage(im, 0, 0);
  P.setOrbitPlanetMap(k as never, { w: im.width, h: im.height, data: x.getImageData(0, 0, im.width, im.height).data as never });
};
for (const [n, m] of Object.entries(ORBIT_PLANET_MAPS)) {
  await put(n, `${n}.webp`);
  if (m.height) await put(`${n}-h`, `${n}-h.webp`);
}
const COLS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"];
const scale = Number(opt("scale") ?? 2.84);
const turn = Number(opt("turn") ?? 0.1);
const R = 28, cell = 70;
const c = createCanvas(Math.round(cell * 8 * scale), Math.round(cell * 4 * scale));
const ctx = c.getContext("2d");
ctx.fillStyle = "#06060c";
ctx.fillRect(0, 0, c.width, c.height);
ctx.scale(scale, scale);
for (let row = 0; row < 4; row++)
  for (let i = 0; i < 8; i++) {
    const type = row === 3 ? 0 : row;
    // Row 4: the rocky worlds' other draws (a red or orange seed's volcanic world).
    const h = row === 3 ? i * 3 * 97 : i * 37 + row * 101 + 32;
    const look = { type, colour: COLS[i]!, ring: args.includes("--ring") && type === 1, tilt: (i - 4) * 0.12, h };
    P.drawRenderedPlanet(ctx as never, cell * i + cell / 2, cell * row + cell / 2, R, look, turn);
    if (look.ring) P.drawPlanetRing(ctx as never, cell * i + cell / 2, cell * row + cell / 2, R, look);
    ctx.fillStyle = "#999";
    ctx.font = "6px sans-serif";
    ctx.fillText(P.orbitPlanetMapFor(look), cell * i + 3, cell * row + 7);
  }
writeFileSync(opt("out") ?? ".shots/orbit-planet-sheet.png", c.toBuffer("image/png"));
