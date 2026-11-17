/**
 * Curl Champ's stage-2 effects review (the Sports overhaul; a design tool, not a check): stills of each effect and a
 * short clip, drawn through the real renderer and the effects observer with the rendered images handed in, on a curlRev 4
 * witness run with brushing added (as curling-overhaul-check plays it).
 *
 *   bun scripts/shots/curling-fx-shots.ts [--out=<dir>]
 *
 * Writes fx-strokes.png, fx-clack.png, fx-takeout.png, fx-count.png, fx-near.png, fx-end-zoom.png, fx-end-lit.png and
 * clip-curling-fx.webp (≈ 15 fps, 300 px wide; ffmpeg).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;

const C = await import("../../src/lib/arcade/curling");
const R = await import("../../src/lib/arcade/curling.renderer");
const F = await import("../../src/lib/arcade/curlingFx");
const { setSportsSpriteForShots } = await import("../../src/lib/arcade/sportsSprites");
const { decodeSportsRun } = await import("../../src/lib/arcade/sportsKit");
const { witnessRaw } = await import("../curling-bank");

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/curling-fx";
mkdirSync(out, { recursive: true });
for (const n of ["arena", "stone-gold", "stone-red", "slide", "release"]) {
  setSportsSpriteForShots("curling", n, await loadImage(readFileSync(join("public/sports/curling", `${n}.webp`))));
}
const witnesses = JSON.parse(readFileSync("scripts/fixtures/curling-witness-v4.json", "utf8")) as { seed: number; throws: number[][] }[];
const H = C.CURLING_H_V4;
const W = C.CURLING_W;
const game = C.curlingGameFor(C.CURLING_REV);

type Frame = { s: any; fx: InstanceType<typeof F.CurlFxTracker>; now: number; aim: any };

/** Plays a witness with brushing added, keeping each tick's state; returns the frames and the tracker per tick. */
function play(w: { seed: number; throws: number[][] }) {
  const raw = witnessRaw(w as never, C.CURLING_REV);
  const byTick = new Map(decodeSportsRun(raw, C.CURLING_RUN_TICKS).events.map((e) => [e.t, e]));
  let s = game.init(w.seed);
  const fx = new F.CurlFxTracker();
  const states: any[] = [];
  let now = 0;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    let input: any = byTick.get(t) ?? null;
    if (!input && s.phase === C.CURL_TRAVEL && s.travelTicks >= 10 && s.travelTicks <= 130 && t % 6 === 0) input = { t, k: C.CURL_INPUT_SWEEP, a: 40, b: s.thrown % 2 === 0 ? 1 : -1, c: 0, d: 0 };
    s = game.step(s, input);
    now += 1000 / 60;
    fx.observe(s, now);
    states.push({ s, now, strokes: fx.strokes.length, contacts: fx.contacts.slice(), verdicts: fx.verdicts.slice(), takeouts: fx.takeouts.slice(), strokesList: fx.strokes.slice() });
  }
  return { w, raw, states, fx, end: s, now };
}

// The run with the most going on: a takeout, a near miss and counting stones.
let best: ReturnType<typeof play> | null = null;
let bestScore = -1;
for (const w of witnesses.slice(0, 40)) {
  const r = play(w);
  const last = r.states[r.states.length - 1]!;
  const score = (last.takeouts.length ? 4 : 0) + (last.verdicts.some((v: any) => v.kind === "near") ? 3 : 0) + F.curlEndCounting(r.end).length + (last.contacts.length ? 2 : 0);
  if (score > bestScore) {
    bestScore = score;
    best = r;
  }
}
const run = best!;
console.log(`  run ${run.w.seed}: ${F.curlEndCounting(run.end).length} counting at the end`);

/** One frame (2×) at state index i, with the tracker's lists as they were then. */
function frame(i: number, endMs?: number): Buffer {
  const st = run.states[i]!;
  const fx = new F.CurlFxTracker();
  fx.strokes = st.strokesList;
  fx.contacts = st.contacts;
  fx.verdicts = st.verdicts;
  fx.takeouts = st.takeouts;
  if (endMs !== undefined) {
    fx.end = { at: 0, stones: F.curlEndCounting(run.end), gap: F.CURL_FX_LIGHT_MS };
    const room = F.CURL_FX_END_HOLD_MS - F.CURL_FX_ZOOM_MS - 200;
    fx.end.gap = fx.end.stones.length ? Math.min(F.CURL_FX_LIGHT_MS, Math.floor(room / fx.end.stones.length)) : F.CURL_FX_LIGHT_MS;
  }
  const c = createCanvas(W * 2, H * 2);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  R.curlingScene(ctx, { worldW: W, worldH: H, left: 0, right: W, top: 0, bottom: H, scale: 2, boxTop: 0 } as never, C.CURLING_REV);
  const plan = run.w.throws[Math.min(st.s.thrown, 7)]!;
  const aim = { broomX: plan[1]!, broomY: plan[2]!, startX: plan[0]!, turn: plan[4]!, swipe: null, keyWeight: plan[3]!, zone: C.curlDrawZone(plan[0]!, plan[1]!, plan[2]!, plan[4]!, C.CURLING_REV), path: null, lastRelease: null };
  R.drawCurling(ctx, st.s, aim as never);
  R.drawCurlingFx(ctx, st.s, fx, endMs ?? 0);
  return c.toBuffer("image/png");
}

const find = (pred: (st: any, i: number) => boolean) => run.states.findIndex(pred);
const shots: [string, number][] = [];
const strokeAt = find((st) => st.s.phase === C.CURL_TRAVEL && st.strokesList.filter((x: any) => st.s.tick - x.tick < 30).length >= 4);
if (strokeAt >= 0) shots.push(["fx-strokes", strokeAt]);
const clackAt = find((st) => st.contacts.some((c: any) => st.s.tick - c.tick === 8));
if (clackAt >= 0) shots.push(["fx-clack", clackAt]);
const outAt = find((st) => st.takeouts.some((o: any) => st.s.tick - o.tick === 10));
if (outAt >= 0) shots.push(["fx-takeout", outAt]);
const countAt = find((st) => st.verdicts.some((v: any) => v.kind === "count" && st.s.tick - v.tick === 24));
if (countAt >= 0) shots.push(["fx-count", countAt]);
const nearAt = find((st) => st.verdicts.some((v: any) => v.kind === "near" && st.s.tick - v.tick === 20));
if (nearAt >= 0) shots.push(["fx-near", nearAt]);
for (const [name, i] of shots) {
  writeFileSync(join(out, `${name}.png`), frame(i));
  console.log(`  ${name}.png (tick ${run.states[i]!.s.tick})`);
}
const lastI = run.states.length - 1;
writeFileSync(join(out, "fx-end-zoom.png"), frame(lastI, F.CURL_FX_ZOOM_MS / 2));
writeFileSync(join(out, "fx-end-lit.png"), frame(lastI, F.CURL_FX_END_HOLD_MS));
console.log("  fx-end-zoom.png, fx-end-lit.png");

// The clip: a brushed throw, the takeout and the end's count (every 4th tick, then the end on the wall clock).
const frames: Buffer[] = [];
const span = (from: number, to: number) => {
  for (let i = Math.max(0, from); i < Math.min(lastI, to); i += 4) frames.push(frame(i));
};
if (strokeAt >= 0) span(strokeAt - 40, strokeAt + 60);
if (outAt >= 0) span(outAt - 50, outAt + 70);
for (let ms = 0; ms <= F.curlEndHoldMs(run.end); ms += 66) frames.push(frame(lastI, ms));
const dir = mkdtempSync(join(tmpdir(), "curl-fx-"));
frames.forEach((b, i) => writeFileSync(join(dir, `f${String(i).padStart(4, "0")}.png`), b));
const clip = join(out, "clip-curling-fx.webp");
const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "15", "-i", join(dir, "f%04d.png"), "-vf", "scale=300:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "60", "-compression_level", "6", "-loop", "0", clip]);
rmSync(dir, { recursive: true, force: true });
if (r.status !== 0) throw new Error(String(r.stderr));
console.log(`  ${clip}: ${frames.length} frames, ${(statSync(clip).size / 1024).toFixed(0)} KB`);
