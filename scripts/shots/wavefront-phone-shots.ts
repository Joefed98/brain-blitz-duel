/**
 * Wavefront phone-notes review frames (27 Oct 2026, docs/phone-notes-oct-2026/wavefront.md): wavRev 11 drawn by its
 * real renderer (@napi-rs/canvas) at the iPhone 11 play box (414 × 772 CSS px: the 390 × 800 world at its fitted
 * scale, 376 × 772, 2× pixels), from a stored band-bot run (scripts/fixtures/wavefront-phone-runs.json.gz). The
 * "before" frames are scripts/shots/x200-wavefront-shots.ts run on the commit before. A design tool, not a check.
 *
 *   bun scripts/shots/wavefront-phone-shots.ts [--out=screenshots/phone-notes-oct-2026/wavefront] [--level=elite] [--seed=0]
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
const OUT = opt("out") ?? "screenshots/phone-notes-oct-2026/wavefront";
const LEVEL = opt("level") ?? "elite";
const SEED_N = Number(opt("seed") ?? 0);
mkdirSync(OUT, { recursive: true });
const wav = await import("../../src/lib/arcade/wavefront");
const { wavefrontArtGameFor } = await import("../../src/lib/arcade/wavefront.renderer");
const { decodeInputEvents } = await import("../../src/lib/arcade/engine");

/** The 390 × 800 world fitted into the iPhone 11 box, 414 × 772, top-anchored: 376 × 772 CSS px. */
const H = 772;
const W = Math.round((H * wav.WAV_WORLD_W) / wav.WAV_X_H);
const DPR = 2;

const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-phone-runs.json.gz")).toString()) as { runs: { level: string; n: number; seed: number; raw: string }[] };
const run = fixture.runs.find((r) => r.level === LEVEL && r.n === SEED_N)!;
const events = decodeInputEvents(run.raw.split("|")[2] ?? "");
const byTick = new Map(events.map((e: any) => [e.t, e]));
const game = wav.wavefrontGameFor(wav.WAV_REV_PHONE);
const draw = wavefrontArtGameFor(wav.WAV_REV_PHONE).draw;
const states: any[] = [];
let s: any = game.init(run.seed);
states.push(s);
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

// Wave 1 settled, its two carriers glowing in the formation.
shoot("after-wave1-carriers-414x896", (st) => st.wave === 1 && st.tick === 150);
// A carried power-up falling from where its ship was shot down.
shoot("after-powerup-falling-414x896", (st) => (st.pickups ?? []).some((p: any) => p.y > 300 * 256 && p.y < 380 * 256) && st.wave >= 2 && !st.boss);
// The gunship (graphite and silver).
shoot("after-gunship-414x896", (st) => st.boss?.mid && (st.enter ?? 0) === 0 && st.bolts.length >= 2);
// The mothership (black and silver), its core open.
shoot("after-mothership-414x896", (st) => st.boss && !st.boss.mid && (st.enter ?? 0) === 0 && wav.wavCoreOpen(st.boss, st.tick) && (st.boss.guns ?? []).some((g: number) => g > 0));
