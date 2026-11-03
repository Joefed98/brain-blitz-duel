/**
 * Tilt tiltRev 11 review frame (3 Nov 2026, docs/arcade-standard/tilt.md "tiltRev 11"): the real renderer
 * (@napi-rs/canvas) at the iPhone 11 screen (414 × 896 CSS px, 2× pixels): the game frame's 60 px header band left
 * plain, then the play box (414 × 836) with the 440 × 820 world at its fitted scale, top-anchored, the oak fill round
 * it. The run is the stored oracle run (scripts/fixtures/tilt-rev11-runs.json.gz) mid-way through maze 2: no gold
 * stars, the par countdown and "Clean" top right. A design tool, not a check.
 *
 *   bun scripts/shots/tilt-rev11-shots.ts [--out=screenshots/arcade-batch-nov-2026]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: (el: any) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as any).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/arcade-batch-nov-2026";
mkdirSync(OUT, { recursive: true });
const tilt = await import("../../src/lib/arcade/tilt");
const { tiltArtGameFor, tiltArenaSceneFor } = await import("../../src/lib/arcade/tiltArt.renderer");
const { decodeTiltRun } = await import("../../src/lib/duel/tilt");

const SCREEN_W = 414;
const SCREEN_H = 896;
const HEADER = 60;
const BOX_W = SCREEN_W;
const BOX_H = SCREEN_H - HEADER;
const DPR = 2;
const rev = tilt.TILT_REV_PAR;
const scale = Math.min(BOX_W / tilt.TILT_X_W, BOX_H / tilt.TILT_X_H);
const W = Math.round(tilt.TILT_X_W * scale);
const H = Math.round(tilt.TILT_X_H * scale);
const left = Math.round((BOX_W - W) / 2);

const runs = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/tilt-rev11-runs.json.gz")).toString()) as { runs: { seed: number; kind: string; raw: string }[] }).runs;
const run = runs.find((r) => r.kind === "oracle")!;
const game = tilt.tiltGameFor(rev);
const art = tiltArtGameFor(rev);
const scene = tiltArenaSceneFor(rev);
const byTick = new Map(decodeTiltRun(run.raw).events.map((e: any) => [e.t, e]));
const states: any[] = [];
let s: any = game.init(run.seed);
while (!game.isOver(s)) {
  s = game.step(s, byTick.get(s.tick + 1) ?? null);
  states.push(s);
}

/** Draws the 90 ticks up to states[i] (so effects and the camera settle) and saves the last frame. */
function shoot(name: string, i: number) {
  const canvas = createCanvas(SCREEN_W * DPR, SCREEN_H * DPR);
  const ctx = canvas.getContext("2d") as any;
  const world = createCanvas(W * DPR, H * DPR);
  const wctx = world.getContext("2d") as any;
  for (let k = Math.max(0, i - 90); k <= i; k++) {
    clock += 1000 / 60;
    wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    art.draw(wctx, states[k], { width: W, height: H });
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  // As ArcadeArenaSlot paints it under the header: world units, the world's top-left at (left, HEADER) CSS px.
  ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * left, DPR * HEADER);
  scene(ctx, { worldW: tilt.TILT_X_W, worldH: tilt.TILT_X_H, left: -left / scale, top: 0, right: (BOX_W - left) / scale, bottom: BOX_H / scale, scale, boxTop: HEADER });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(world, left * DPR, HEADER * DPR);
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png: seed ${run.seed}, tick ${states[i].tick}, maze ${states[i].mazes + 1}, par left ${tilt.tiltParLeftX(states[i])} ticks`);
}

// Mid-way through maze 2 (a second or so after it began).
const m2 = states.findIndex((x) => x.mazes === 1);
shoot("tilt-rev11-midrun", Math.min(states.length - 1, m2 + 180));
