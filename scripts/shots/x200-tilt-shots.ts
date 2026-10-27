/**
 * x200 Tilt review frames (26 Oct 2026, docs/expansions/x200-tilt.md): tiltRev 8 drawn by its real renderer
 * (@napi-rs/canvas) at the iPhone 11 play box (414 × 772 CSS px: the 440 × 820 world at its fitted scale,
 * top-anchored, the oak fill round it, 2× pixels), from an oracle-played bank run (its stored proof), on ticks
 * where a feature is on screen. A design tool, not a check; the game frame's header is not part of it.
 *
 *   bun scripts/shots/x200-tilt-shots.ts [--out=screenshots/x200-oct-2026] [--bank=0]
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

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/x200-oct-2026";
const BANK_N = Number(process.argv.find((a) => a.startsWith("--bank="))?.slice(7) ?? 0);
mkdirSync(OUT, { recursive: true });
const tilt = await import("../../src/lib/arcade/tilt");
const { tiltArtGameFor, tiltArenaSceneFor } = await import("../../src/lib/arcade/tiltArt.renderer");
const { decodeTiltRun } = await import("../../src/lib/duel/tilt");
const { TILT_BANK } = await import("../../src/lib/duel/tiltBank.server");

const BOX_W = 414;
const BOX_H = 772;
const DPR = 2;
const scale = Math.min(BOX_W / tilt.TILT_X_W, BOX_H / tilt.TILT_X_H);
const W = Math.round(tilt.TILT_X_W * scale);
const H = Math.round(tilt.TILT_X_H * scale);
const left = Math.round((BOX_W - W) / 2);

const seed = TILT_BANK[BANK_N]!;
const proofs = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/tilt-bank-runs.json.gz")).toString()) as { runs: { seed: number; raw: string }[] }).runs;
const raw = proofs.find((p) => p.seed === seed)!.raw;
const game = tilt.tiltGameFor(tilt.TILT_REV_EXPAND);
const art = tiltArtGameFor(tilt.TILT_REV_EXPAND);
const scene = tiltArenaSceneFor(tilt.TILT_REV_EXPAND);
const byTick = new Map(decodeTiltRun(raw).events.map((e: any) => [e.t, e]));
const states: any[] = [];
let s: any = game.init(seed);
while (!game.isOver(s)) {
  s = game.step(s, byTick.get(s.tick + 1) ?? null);
  states.push(s);
}
console.log(`seed ${seed}: ${states.length} ticks`);

/** Draws the 90 ticks up to states[i] (so effects and the camera settle) and saves the last frame. */
function shoot(name: string, i: number) {
  if (i < 0) return console.log(`${name}: no tick matched`);
  const canvas = createCanvas(BOX_W * DPR, BOX_H * DPR);
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
  ctx.fillRect(0, 0, BOX_W, BOX_H);
  // As ArcadeArenaSlot paints it: world units, the world's top-left at (left, 0) CSS px.
  ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * left, 0);
  scene(ctx, { worldW: tilt.TILT_X_W, worldH: tilt.TILT_X_H, left: -left / scale, top: 0, right: (BOX_W - left) / scale, bottom: BOX_H / scale, scale, boxTop: 0 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(world, left * DPR, 0);
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${name}: tick ${states[i].tick}, maze ${states[i].mazes + 1}`);
}

const firstIdx = (f: (a: any, b: any) => boolean) => states.findIndex((x, k) => k > 0 && f(states[k - 1], x));
// A quick star in its icy side passage with its ring running: 25 ticks before the second is taken
// (this run's first sits a few cells from the start).
shoot("tilt-quick-star-ice-414x896", firstIdx((a, b) => (b.quickTaken ?? 0) === 2 && (a.quickTaken ?? 0) === 1) - 25);
// A key and its gate: 20 ticks before the second maze's key (the camera on the bigger maze).
const keyIdx = states.findIndex((x, k) => k > 0 && x.mazes === 1 && (x.keysTaken ?? 0) > (states[k - 1].keysTaken ?? 0));
shoot("tilt-key-gate-414x896", keyIdx - 20);
// Maze 3's two marbles, each heading for its own cup.
const m3 = states.findIndex((x) => x.mazes === 2);
shoot("tilt-two-marbles-414x896", m3 < 0 ? -1 : Math.min(states.length - 1, m3 + 240));
