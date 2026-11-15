/**
 * Orbit's review frames without a browser (the Action overhaul's materials pass; a design tool, not a check): draws the
 * play screen below the game header as the arcade stage composes it (the screen fill round the world, then the world
 * scaled to the screen's width, top-anchored) with a tree's own sim, renderer and fill in @napi-rs/canvas, stepping the
 * sim on the fixed intro example with the elite skill-band bot's log (computed here, so every tree draws the same run).
 *
 *   bun scripts/shots/orbit-materials-frames.ts [--root=<tree, default .>] [--rev=15] --out=<dir>
 *       [--ticks=60,1300,2200,2651] [--size=390x844] [--clip --clip-every=45]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";

import { orbitRev3Game, orbitStartForPuzzle, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { bot } from "../arcade-skill-bands/bots/orbit";
import { Human } from "../arcade-skill-bands/human";
import { exampleFor } from "./examples";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ROOT = resolve(opt("root") ?? ".");
const REV = Number(opt("rev") ?? 15);
const OUT = opt("out") ?? ".shots/orbit-materials/after";
const [W, H] = (opt("size") ?? "390x844").split("x").map(Number) as [number, number];
const CLIP = args.includes("--clip");
const CLIP_EVERY = Number(opt("clip-every") ?? 45);
const HEADER = 60;

// A browser-shaped global for the renderers: canvases from @napi-rs/canvas, no reduced motion, the app's one font.
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const g = globalThis as Record<string, unknown>;
g.document = { createElement: () => createCanvas(1, 1), fonts: { load: async () => [], check: () => true }, documentElement: { dataset: {}, classList: { contains: () => false } }, hidden: false, addEventListener() {} };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.window = g.window ?? { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
g.matchMedia = (g.window as { matchMedia: unknown }).matchMedia;

const r3 = await import(join(ROOT, "src/lib/arcade/orbitRev3.ts"));
const art = await import(join(ROOT, "src/lib/arcade/orbit.renderer.ts"));
const fills = await import(join(ROOT, "src/lib/arcade/arenaFills.renderer.ts"));
// The materials pass's surface maps, decoded here (the page loads them as images).
try {
  const planets = await import(join(ROOT, "src/lib/arcade/orbitPlanets.renderer.ts"));
  const maps = (await import(join(ROOT, "src/lib/arcade/orbitPlanetMaps.data.ts"))).ORBIT_PLANET_MAPS as Record<string, string>;
  for (const name of Object.keys(maps)) {
    const img = await loadImage(join(ROOT, "public/orbit/planets", `${name}.webp`));
    const c = createCanvas(img.width, img.height);
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    planets.setOrbitPlanetMap(name, { w: img.width, h: img.height, data: cx.getImageData(0, 0, img.width, img.height).data });
  }
} catch {
  // An older tree: no maps.
}

mkdirSync(OUT, { recursive: true });
const puzzle = exampleFor("orbit" as never) as unknown as { seed: number; orbitRev: number };
const start = orbitStartForPuzzle(puzzle as never)!;
const game = { ...orbitRev3Game, init: start } as never;
const out = bot({ game, seed: puzzle.seed, rev: puzzle.orbitRev, human: new Human("orbit", puzzle.seed, "elite"), fixes: true } as never);
let probe = start() as OrbitRev3State;
const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
while (!probe.ended && probe.tick < orbitRev3Game.runTicks) probe = orbitRev3Game.step(probe, byTick.get(probe.tick + 1) ?? null) as OrbitRev3State;
const endTick = probe.tick;
const ticks = CLIP
  ? Array.from({ length: Math.floor(endTick / CLIP_EVERY) + 1 }, (_, i) => Math.min(endTick, i * CLIP_EVERY + 1))
  : (opt("ticks") ?? "60,1300,2200,2651").split(",").map(Number).map((t) => Math.min(t, endTick));

const startTree = r3.orbitStartForPuzzle({ ...puzzle, orbitRev: REV });
let s = startTree();
const drawH = art.orbitDrawHFor(REV);
const worldW = r3.orbitWorldWFor(REV);
const box = { w: W, h: H - HEADER };
const scale = Math.min(box.w / worldW, box.h / drawH);
const side = (box.w / scale - worldW) / 2;
const view = { worldW, worldH: drawH, left: -side, right: worldW + side, top: 0, bottom: box.h / scale, scale, boxTop: 0 };
for (const tick of ticks) {
  while (s.tick < tick && !s.ended) s = r3.orbitRev3Game.step(s, byTick.get(s.tick + 1) ?? null);
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(side * scale, HEADER);
  ctx.scale(scale, scale);
  fills.orbitFill(ctx, view);
  ctx.restore();
  const world = createCanvas(Math.round(worldW * scale * 2), Math.round(drawH * scale * 2));
  art.orbitRev3ArtGame.draw(world.getContext("2d"), s, { width: world.width, height: world.height });
  ctx.drawImage(world, Math.round(side * scale), HEADER, world.width / 2, world.height / 2);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "800 19px Archivo";
  ctx.fillText("Orbit", 14, 30);
  ctx.fillStyle = "#BDBDCC";
  ctx.font = "600 12px Archivo";
  ctx.fillText("Action · Practice", 14, 48);
  writeFileSync(join(OUT, `orbit-t${String(tick).padStart(4, "0")}.png`), c.toBuffer("image/png"));
}
console.log(`${ticks.length} frames in ${OUT} (run ends at tick ${endTick})`);
