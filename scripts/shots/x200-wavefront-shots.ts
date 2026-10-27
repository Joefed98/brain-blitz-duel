/**
 * x200 Wavefront review frames (26 Oct 2026, docs/expansions/x200-wavefront.md): wavRev 10 drawn by its real
 * renderer (@napi-rs/canvas) at the iPhone 11 play box (414 × 772 CSS px: the 390 × 800 world at its fitted scale,
 * 376 × 772, 2× pixels), from the stored look-ahead oracle runs (scripts/fixtures/wavefront-expand-oracle.json.gz),
 * on ticks where a feature is on screen. A design tool, not a check; the game frame's header is not part of it.
 *
 *   bun scripts/shots/x200-wavefront-shots.ts [--out=screenshots/x200-oct-2026] [--seed=<n>]
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

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? "screenshots/x200-oct-2026";
const SEED_N = Number(opt("seed") ?? 0);
mkdirSync(OUT, { recursive: true });
const wav = await import("../../src/lib/arcade/wavefront");
const { wavefrontArtGameFor } = await import("../../src/lib/arcade/wavefront.renderer");
const { decodeInputEvents } = await import("../../src/lib/arcade/engine");

/** The 390 × 800 world fitted into the iPhone 11 box, 414 × 772, top-anchored: 376 × 772 CSS px. */
const H = 772;
const W = Math.round((H * wav.WAV_WORLD_W) / wav.WAV_X_H);
const DPR = 2;

const oracle = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-expand-oracle.json.gz")).toString()) as { runs: { n: number; seed: number; log: string }[] };
const run = oracle.runs.find((r) => r.n === SEED_N)!;
const events = decodeInputEvents(run.log.split("|")[2] ?? "");
const byTick = new Map(events.map((e: any) => [e.t, e]));
const game = wav.wavefrontGameFor(wav.WAV_REV_EXPAND);
const draw = wavefrontArtGameFor(wav.WAV_REV_EXPAND).draw;
const states: any[] = [];
let s: any = game.init(run.seed);
while (!game.isOver(s) && s.tick < game.runTicks) {
  s = game.step(s, byTick.get(s.tick + 1) ?? null);
  states.push(s);
}

/** Draws the 90 ticks up to the first state `pick` accepts (so the renderer's memory is warm) and saves it. */
function shoot(name: string, pick: (s: any, prev: any) => boolean) {
  const found = states.findIndex((st, i) => i > 0 && pick(st, states[i - 1]));
  if (found < 0) {
    console.log(`${name}: no tick matched`);
    return;
  }
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as any;
  for (let i = Math.max(0, found - 90); i <= found; i++) {
    clock += 1000 / 60;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw(ctx, states[i], { width: W, height: H });
  }
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png: tick ${states[found].tick}`);
}

// A planned power-up halfway down, with the streak HUD at ×2 or more.
shoot("wavefront-powerup-streak-414x896", (st) => st.drop && st.drop.y > 330 * 256 && st.drop.y < 420 * 256 && wav.wavStreakMult(st.streak ?? 0) >= 2);
// The gunship with both cannons standing.
shoot("wavefront-gunship-414x896", (st) => st.boss?.mid && (st.enter ?? 0) === 0 && (st.boss.guns ?? []).every((g: number) => g > 0) && st.bolts.length >= 2);
// The mothership's core open, a cannon still standing, on the tick a precise weak-point hit lands.
shoot("wavefront-mothership-precise-414x896", (st, prev) => st.boss && !st.boss.mid && wav.wavCoreOpen(st.boss, st.tick) && (st.boss.guns ?? []).some((g: number) => g > 0) && (st.precise ?? 0) - (prev.precise ?? 0) >= 3);
