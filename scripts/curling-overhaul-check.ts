/**
 * curling-overhaul-check (the Sports overhaul, phase 2 step 4, stage 1; display and input mapping only, no stamp):
 *
 *   1. Captain Joulz's delivery never covers what the player needs: on every frame he is drawn (aiming, and the throw's
 *      slide and fade) in real runs on every view (curlRev 2–3's and curlRev 4's), none of his opaque pixels (the
 *      sprites' own alpha, public/sports/curling/) touch the stone's path ahead (every later position of the throw's
 *      stone, its full width), the far house, the inset, the power bar and its label, or (curlRev 4) the In / Out /
 *      Throw row; and he is drawn only while aiming or in the first moments of a throw.
 *   2. Throw reads disabled exactly while a stone travels (and after the last stone): curlThrowState over every tick of
 *      real runs is "live" only in the aim phase with a weight set.
 *   3. The larger inset maps taps both ways: every sheet point it shows maps to its px and back within half a px; its
 *      box stays clear of the stone chip, the power bar's touch area and the far house; the wider touch area still
 *      ends at the bar's right and never reaches the far house.
 *   4. The reveal's run summary agrees with the sim: on stored runs of every revision (scripts/fixtures/curling-v*-legacy.json,
 *      the curlRev 4 witnesses and nudged copies of them) its counting stones are the replay's own count and its
 *      takeouts the replay's, every stone it draws is a live stone, and each legacy run still replays to its stored
 *      score (the overhaul changed no rule).
 *   5. The effects (stage 2, display only): over curlRev 4 runs with brushing added, observing and drawing them never
 *      changes the sim's state; a broom stroke is laid only on a tick a stroke landed on a travelling stone, ahead of
 *      it on the side brushed; a contact ring only on a hit, between two touching stones; a gold ring exactly on a
 *      stone the sim scored and a grey ring exactly on the near-miss rule (curlShortBy, also unit-tested), each at the
 *      settle; the end lights exactly the counting stones in throw order, one tick each, inside the stage's hold and
 *      the 2 s of full-rate frames, its house clear above the In / Out / Throw row; reduced motion draws each effect
 *      still at its final size (no growing ring, no zoom).
 *
 *   bun scripts/curling-overhaul-check.ts   (~10 s, no browser)
 */
import { readFileSync } from "node:fs";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { CURL_AIM, CURL_INPUT_SWEEP, CURL_TRAVEL, CURLING_H_V4, CURLING_REV, CURLING_RUN_TICKS, CURLING_STONES, CURLING_W, CU, HOG_NEAR, STONE_R, curlingGameFor, type CurlingState } from "../src/lib/arcade/curling";
import { CURL_FX_END_HOLD_MS, CURL_FX_LIGHT_MS, CURL_FX_ZOOM_MS, CurlFxTracker, NEAR_MISS_CM, curlEndCounting, curlEndHoldMs, curlEndLit, curlShortBy } from "../src/lib/arcade/curlingFx";
import { decodeSportsRun } from "../src/lib/arcade/sportsKit";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  CURL_CAPTAIN,
  CURL_END_HOUSE,
  drawCurlingFx,
  CURL_INSET,
  CURL_INSET_V4,
  curlInsetFor,
  CURL_METER_HIT_V4,
  CURL_METER_V4,
  CURL_METER,
  curlCaptainPlace,
  curlFarHouse,
  curlInsetToSheet,
  curlProject,
  curlViewFor,
  type CurlView,
} from "../src/lib/arcade/curling.renderer";
import { curlingSummary } from "../src/lib/arcade/curlingSummary.renderer";
import { replayCurlingRun } from "../src/lib/duel/curling";
import { CURL_TURN_ROW_MID, curlThrowState } from "../src/puzzles/curling";
import { witnessPlan, witnessRaw, type WitnessV2 } from "./curling-bank";

let passes = 0;
const failures: string[] = [];
const ok = (cond: boolean, what: string) => {
  if (cond) passes++;
  else if (failures.length < 40) failures.push(what);
  else failures.length++;
};

/* ------------------------------------------------------------ fixtures */

const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;
const legacy: { rev: number; runs: { seed: number; raw: string; score: number }[] }[] = [1, 2, 3].map((rev) => ({ rev, runs: read(`curling-v${rev}-legacy.json`) }));
const witnesses = read<WitnessV2[]>("curling-witness-v4.json");
/** Nudged copies of the witnesses (deterministic): weights and brooms off a little, so stones miss, count or get taken out. */
function nudged(w: WitnessV2, k: number): WitnessV2 {
  let h = (w.seed ^ (k * 0x9e3779b9)) >>> 0;
  const r = (n: number) => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return (h % (2 * n + 1)) - n;
  };
  return { seed: w.seed, throws: w.throws.map((t) => [t[0], t[1] + r(40), t[2] + r(60), Math.max(1, Math.min(1000, t[3] + r(90))), t[4]] as [number, number, number, number, number]) };
}
const v4Runs: { seed: number; raw: string; plan: WitnessV2 }[] = [];
for (const w of witnesses.slice(0, 18)) v4Runs.push({ seed: w.seed, raw: witnessRaw(w, CURLING_REV), plan: w });
for (const w of witnesses.slice(0, 18)) for (const k of [1, 2]) {
  const n = nudged(w, k);
  v4Runs.push({ seed: n.seed, raw: witnessRaw(n, CURLING_REV), plan: n });
}

/* ------------------------------------------------------------ 1. the Captain */

interface Mask {
  w: number;
  h: number;
  a: Uint8ClampedArray;
}
async function mask(name: string): Promise<Mask> {
  const img = await loadImage(readFileSync(new URL(`../public/sports/curling/${name}.webp`, import.meta.url)));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const a = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]!;
  return { w: img.width, h: img.height, a };
}
const masks = { slide: await mask("slide"), release: await mask("release") };
ok(masks.slide.w === CURL_CAPTAIN.slide.w && masks.slide.h === CURL_CAPTAIN.slide.h, `slide.webp is ${masks.slide.w}×${masks.slide.h}, CURL_CAPTAIN says ${CURL_CAPTAIN.slide.w}×${CURL_CAPTAIN.slide.h}`);
ok(masks.release.w === CURL_CAPTAIN.release.w && masks.release.h === CURL_CAPTAIN.release.h, `release.webp is ${masks.release.w}×${masks.release.h}, CURL_CAPTAIN says ${CURL_CAPTAIN.release.w}×${CURL_CAPTAIN.release.h}`);
// The hand anchors sit on opaque pixels (his hand, at the stone).
for (const pose of ["slide", "release"] as const) {
  const m = masks[pose];
  const [hx, hy] = CURL_CAPTAIN[pose].hand;
  let near = 0;
  for (let y = hy - 6; y <= hy + 6; y++) for (let x = hx - 6; x <= Math.min(m.w - 1, hx + 6); x++) if (m.a[y * m.w + x]! > 128) near++;
  ok(near > 20, `${pose}: the hand anchor (${hx}, ${hy}) is on the sprite's hand`);
}

/** The Captain's opaque pixels this frame, in world px, sampled every 2 sprite px (a 1-px dilation covers the gaps). */
function captainPixels(place: NonNullable<ReturnType<typeof curlCaptainPlace>>): { x: number; y: number }[] {
  const m = masks[place.pose];
  const out: { x: number; y: number }[] = [];
  const sx = place.w / m.w;
  const sy = place.h / m.h;
  for (let y = 0; y < m.h; y += 2) for (let x = 0; x < m.w; x += 2) {
    if (m.a[y * m.w + x]! < 64) continue;
    const u = place.flip ? m.w - 1 - x : x;
    out.push({ x: place.x + u * sx, y: place.y + y * sy });
  }
  return out;
}

type Rect = { x: number; y: number; w: number; h: number; name: string };
function zonesFor(v: CurlView): Rect[] {
  const f = curlFarHouse(v);
  const zones: Rect[] = [
    { x: f.sx - f.rx - 4, y: f.top, w: 2 * f.rx + 8, h: f.bottom - f.top, name: "the far house" },
    { x: curlInsetFor(v.rev).x - 3, y: curlInsetFor(v.rev).y - 3, w: curlInsetFor(v.rev).w + 6, h: curlInsetFor(v.rev).h + 6, name: "the inset" },
  ];
  if (v.rev >= 4) {
    const m = CURL_METER_V4;
    zones.push({ x: m.x - 3, y: m.y - 24, w: m.w + 6, h: m.h + 27, name: "the power bar" });
    const rowTop = CURL_TURN_ROW_MID * v.h - 24;
    zones.push({ x: 0, y: rowTop, w: v.w, h: 48, name: "the In / Out / Throw row" });
  } else if (v.rev >= 3) zones.push({ x: CURL_METER.x - 3, y: CURL_METER.y - 24, w: CURL_METER.w + 6, h: CURL_METER.h + 27, name: "the weight meter" });
  return zones;
}
const inRect = (p: { x: number; y: number }, r: Rect, pad = 1) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

/** Every frame of a run (the sim's own steps) with each throw's start x and its stone's later positions. */
function frames(seed: number, raw: string, rev: number, plan: WitnessV2): { s: CurlingState; startX: number; broomX: number; ahead: { x: number; y: number }[] }[] {
  const run = replayCurlingRun(seed, raw, rev);
  void run;
  const game = curlingGameFor(rev);
  const events = new Map<number, { t: number; k: number; a: number; b: number; c: number; d?: number }>();
  for (const part of raw.split("|")[2]!.split(",").filter(Boolean)) {
    const [t, k, a, b, c, d] = part.split(":").map(Number);
    events.set(t!, { t: t!, k: k!, a: a!, b: b!, c: c!, d: d ?? 0 });
  }
  const states: CurlingState[] = [];
  let s = game.init(seed);
  states.push(structuredClone(s));
  while (!game.isOver(s)) {
    s = game.step(s, (events.get(s.tick + 1) ?? null) as never);
    states.push(structuredClone(s));
  }
  const starts = witnessPlan(plan).map((t) => ("sx" in t ? (t.sx ?? 0) : 0));
  const brooms = witnessPlan(plan).map((t) => t.bx);
  // Each throw's stone path (world cm), from its release to its rest.
  const paths: { x: number; y: number }[][] = [];
  for (const st of states) {
    if (st.phase !== CURL_TRAVEL || st.active < 0) continue;
    const n = st.active - st.theirs;
    (paths[n] ??= []).push({ x: st.x[st.active]! / CU, y: st.y[st.active]! / CU });
  }
  return states.map((st) => {
    const n = st.phase === CURL_AIM ? st.thrown : Math.max(0, st.active - st.theirs);
    const path = paths[n] ?? [];
    const here = st.phase === CURL_TRAVEL && st.active >= 0 ? st.y[st.active]! / CU : HOG_NEAR;
    return { s: st, startX: starts[n] ?? 0, broomX: brooms[n] ?? 0, ahead: path.filter((p) => p.y <= here) };
  });
}

let captainFrames = 0;
for (const view of [2, 4]) {
  const v = curlViewFor(view);
  const zones = zonesFor(v);
  // Every v4 run plays on curlRev 4; the same plans are drawn in curlRev 2–3's view too (display: the view alone moves him).
  for (const run of v4Runs.slice(0, view === 4 ? v4Runs.length : 18)) {
    const fs = frames(run.seed, run.raw, CURLING_REV, run.plan);
    let bad = "";
    // Aiming frames repeat exactly (the same place, the same path ahead): each distinct one is judged once.
    const judged = new Set<string>();
    for (const f of fs) {
      const place = curlCaptainPlace(f.s, f.startX, v, f.broomX);
      const shouldShow = (f.s.phase === CURL_AIM && f.s.thrown < CURLING_STONES) || (f.s.phase === CURL_TRAVEL && f.s.travelTicks < 48);
      if (!!place !== shouldShow) bad ||= `tick ${f.s.tick}: drawn ${!!place}, expected ${shouldShow}`;
      if (!place || place.alpha <= 0) continue;
      captainFrames++;
      const key = `${place.pose}:${place.x.toFixed(3)}:${place.y.toFixed(3)}:${place.w.toFixed(3)}:${place.flip}:${f.ahead.length}:${f.ahead[0]?.y ?? 0}`;
      if (judged.has(key)) continue;
      judged.add(key);
      const px = captainPixels(place);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of px) {
        if (p.x < x0) x0 = p.x;
        if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.y > y1) y1 = p.y;
      }
      for (const z of zones) if (px.some((p) => inRect(p, z))) bad ||= `tick ${f.s.tick}: over ${z.name}`;
      // The path ahead: the stone's disc at every later position (its own width plus 2 px).
      for (const a of f.ahead) {
        const q = curlProject(a.x, a.y, v);
        const rx = STONE_R * q.k + 2;
        const lift = Math.max(1.2, 11 * q.k);
        // "Ahead" is what is drawn above the top of the stone in (or just leaving) his hand: the stone he holds is
        // under his hand by design; everything further up its line must stay clear of him.
        if (a.y >= HOG_NEAR - place.fwd - STONE_R) continue; // the held stone itself
        const held = curlProject(f.startX, HOG_NEAR - place.fwd, v);
        const heldTop = held.sy - Math.max(1.2, 11 * held.k) - STONE_R * held.k * 0.3 - 2;
        const lo = q.sy - lift - rx * 0.5;
        const hi = Math.min(q.sy + rx * 0.3, heldTop);
        if (hi <= lo) continue;
        if (q.sx + rx < x0 || q.sx - rx > x1 || hi < y0 || lo > y1) continue; // nowhere near him
        if (px.some((p) => Math.abs(p.x - q.sx) <= rx && p.y >= lo && p.y <= hi)) {
          bad ||= `tick ${f.s.tick}: over the stone's path ahead at (${a.x.toFixed(0)}, ${a.y.toFixed(0)}) cm`;
          break;
        }
      }
      if (bad) break;
    }
    ok(!bad, `view ${view}, sheet ${run.seed}: the Captain ${bad}`);
  }
}
ok(captainFrames > 2000, `the Captain was judged on ${captainFrames} frames`);
// Wide starts on both sides (he moves to the right of the line for a start far left, mirrored).
for (const view of [2, 4]) {
  const v = curlViewFor(view);
  for (let sx = -100; sx <= 100; sx += 5) {
    const st = { phase: CURL_AIM, thrown: 0, travelTicks: 0, active: -1 };
    const place = curlCaptainPlace(st, sx, v)!;
    const p = curlProject(sx, HOG_NEAR, v);
    const px = captainPixels(place);
    // Nothing of him above the waiting stone's top across its own width (the line it leaves along).
    const rx = STONE_R * p.k + 2;
    const lift = Math.max(1.2, 11 * p.k);
    ok(!px.some((q) => Math.abs(q.x - p.sx) <= rx * 0.45 && q.y < p.sy - lift - rx * 0.6), `view ${view}, start ${sx} cm: the Captain stays off the stone's line`);
    ok(px.every((q) => q.x >= -8 && q.x <= v.w + 8), `view ${view}, start ${sx} cm: the Captain stays on screen`);
  }
}

/* ------------------------------------------------------------ 2. Throw */

let throwTicks = 0;
for (const run of v4Runs) {
  const fs = frames(run.seed, run.raw, CURLING_REV, run.plan);
  let bad = "";
  for (const f of fs) {
    const aiming = f.s.phase === CURL_AIM;
    for (const weight of [null, 400]) {
      const state = curlThrowState(weight, aiming);
      const want = f.s.phase === CURL_TRAVEL || !aiming ? "travel" : weight === null ? "unset" : "live";
      if (state !== want) bad ||= `tick ${f.s.tick} (phase ${f.s.phase}, weight ${weight}): ${state}, expected ${want}`;
      if (state === "live" && f.s.phase !== CURL_AIM) bad ||= `tick ${f.s.tick}: live while not aiming`;
    }
    throwTicks++;
  }
  ok(!bad, `sheet ${run.seed}: Throw ${bad}`);
}
ok(throwTicks > 10000, `Throw judged on ${throwTicks} ticks`);

/* ------------------------------------------------------------ 3. the inset */

for (const rev of [1, 2, 3, 4]) {
  const i = curlInsetFor(rev);
  ok(i === (rev >= 4 ? CURL_INSET_V4 : CURL_INSET), `curlRev ${rev}: its inset`);
  let worst = 0;
  for (let y = -200; y <= 200; y += 4) for (let x = -200; x <= 200; x += 4) {
    const px = i.x + i.w / 2 + x * i.scale;
    const py = i.y + i.h / 2 + y * i.scale;
    const back = curlInsetToSheet(px, py, rev);
    if (!back) {
      ok(false, `curlRev ${rev} inset: sheet (${x}, ${y}) shown at (${px.toFixed(1)}, ${py.toFixed(1)}) maps to nothing`);
      continue;
    }
    worst = Math.max(worst, Math.abs(back.x - x) * i.scale, Math.abs(back.y - y) * i.scale);
  }
  ok(worst < 0.5, `curlRev ${rev} inset: round trip within half a px (worst ${worst.toFixed(3)})`);
  ok(Math.abs(i.scale - i.w / 2 / 205) < 1e-9 && i.w === i.h, `curlRev ${rev} inset: square, the house and 22 cm round it`);
  ok(curlInsetToSheet(i.x - 1, i.y + 5, rev) === null && curlInsetToSheet(i.x + i.w + 1, i.y + 5, rev) === null && curlInsetToSheet(i.x + 5, i.y + i.h + 1, rev) === null, `curlRev ${rev} inset: nothing maps outside its box`);
  ok(i.x + i.w + 3 <= 390 && i.y - 3 >= 0, `curlRev ${rev} inset: on screen with its frame`);
  ok(i.x > 10 + 180, `curlRev ${rev} inset clear of the stone and brush chips`);
  const f = curlFarHouse(curlViewFor(rev));
  ok(i.y + i.h + 3 < f.top || i.x - 3 > f.sx + f.rx, `curlRev ${rev}: inset clear of the far house`);
  if (rev >= 4) {
    const hit = CURL_METER_HIT_V4;
    ok(i.y + i.h + 3 < hit.y, `inset (bottom ${i.y + i.h + 3}) clear of the power bar's touch area (top ${hit.y})`);
    ok(i.y + i.h + 3 < CURL_METER_V4.y - 24 + 1, "inset clear of the POWER label");
    ok(hit.x > f.sx + f.rx + 4, `the wider power-bar touch area (from x ${hit.x}) clear of the far house (to ${(f.sx + f.rx).toFixed(0)})`);
    ok(hit.x + hit.w === 390 && hit.x <= CURL_METER_V4.x - 46, "the power bar's touch area runs 46 px left of the bar to the edge");
  }
}
ok(CURL_INSET_V4.w > CURL_INSET.w * 1.12, "curlRev 4's inset is larger");

/* ------------------------------------------------------------ 4. the run summary */

let summaries = 0;
for (const { rev, runs } of legacy) {
  for (const run of runs) {
    const r = replayCurlingRun(run.seed, run.raw, rev);
    ok(r.score === run.score && !r.flagged, `curlRev ${rev} sheet ${run.seed}: replays to ${r.score}, stored ${run.score}`);
    const sum = curlingSummary(run.seed, run.raw, rev);
    ok(sum.counting === r.counted && sum.takeouts === r.takeouts && sum.thrown === r.thrown, `curlRev ${rev} sheet ${run.seed}: summary counting ${sum.counting} / takeouts ${sum.takeouts}, replay ${r.counted} / ${r.takeouts}`);
    ok(sum.stones.length === r.state.live.filter((l) => l === 1).length, `curlRev ${rev} sheet ${run.seed}: every live stone drawn`);
    summaries++;
  }
}
const counts = new Set<number>();
for (const run of v4Runs) {
  const r = replayCurlingRun(run.seed, run.raw, CURLING_REV);
  const sum = curlingSummary(run.seed, run.raw, CURLING_REV);
  counts.add(sum.counting);
  const drawnCounting = sum.stones.filter((s) => s.counting).length;
  const liveCounted = r.state.pts.filter((p, n) => p > 0 && r.state.live[r.state.theirs + n] === 1).length;
  ok(sum.counting === r.counted && sum.takeouts === r.takeouts, `curlRev 4 sheet ${run.seed}: summary ${sum.counting}/${sum.takeouts}, replay ${r.counted}/${r.takeouts}`);
  ok(drawnCounting === liveCounted, `curlRev 4 sheet ${run.seed}: gold rings on ${drawnCounting} stones, ${liveCounted} counted stones still on the sheet`);
  ok(sum.stones.every((s) => !(s.counting && s.nearMiss)), `curlRev 4 sheet ${run.seed}: no stone both counting and a near miss`);
  ok(sum.stones.filter((s) => s.mine).every((s) => s.throw !== null && s.throw >= 1 && s.throw <= CURLING_STONES), `curlRev 4 sheet ${run.seed}: your stones numbered 1–8`);
  const mineD = sum.stones.filter((s) => s.mine).map((s) => s.dist);
  ok(sum.closestCm === (mineD.length ? Math.round(Math.min(...mineD)) : null), `curlRev 4 sheet ${run.seed}: closest is the nearest of your stones`);
  summaries++;
}
ok(counts.size >= 3, `the runs cover several outcomes (counting ${[...counts].sort().join(", ")})`);
ok(summaries >= 100, `${summaries} summaries judged`);

/* ------------------------------------------------------------ 5. the effects (stage 2) */

// Reduced motion stands in through window.matchMedia (art.renderer.ts reads it once and keeps the query).
const motion = { reduce: false };
(globalThis as unknown as { window: unknown }).window ??= {};
(globalThis as unknown as { window: { matchMedia: unknown } }).window.matchMedia = () => ({
  get matches() {
    return motion.reduce;
  },
});

let fxTicks = 0;
let fxStrokes = 0;
let fxContacts = 0;
let fxVerdicts = 0;
let fxNear = 0;
let fxEnds = 0;
const canvas = createCanvas(CURLING_W, CURLING_H_V4);
const fctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const game4 = curlingGameFor(CURLING_REV);
const view4 = curlViewFor(CURLING_REV);
/** The In / Out / Throw row's top (world px): its middle less half its 48 px height (curling.tsx CURL_TURN_ROW_TOP). */
const rowTop = view4.h * CURL_TURN_ROW_MID - 24;

for (const [n, run] of v4Runs.entries()) {
  // The witness throws with brushing added (every 6th tick of a stone's first 2 s, one side a throw, alternating), so
  // strokes, bends and their effects all happen; and every 3rd run drawn each tick with effects, the rest observed.
  const decoded = decodeSportsRun(run.raw, CURLING_RUN_TICKS);
  const byTick = new Map(decoded.events.map((e) => [e.t, e]));
  const fx = new CurlFxTracker();
  let s = game4.init(run.seed);
  let now = 0;
  const draw = n % 3 === 0;
  while (!game4.isOver(s)) {
    const t = s.tick + 1;
    let input = (byTick.get(t) ?? null) as ArcadeInputEvent | null;
    if (!input && s.phase === CURL_TRAVEL && s.travelTicks >= 10 && s.travelTicks <= 130 && t % 6 === 0) input = { t, k: CURL_INPUT_SWEEP, a: 40, b: s.thrown % 2 === 0 ? 1 : -1, c: 0, d: 0 };
    const prev = s;
    s = game4.step(s, input);
    now += 1000 / 60;
    const before = draw ? JSON.stringify(s) : "";
    fx.observe(s, now);
    if (draw) {
      drawCurlingFx(fctx, s, fx, now);
      ok(JSON.stringify(s) === before, `sheet ${run.seed} tick ${s.tick}: observing and drawing the effects left the sim's state as it was`);
    }
    fxTicks++;
    // Strokes: only on a tick a broom stroke landed, on a travelling stone, on the side brushed.
    // (Counted by tick: the observer forgets faded marks, so its lists shrink as well as grow.)
    const newStrokes = fx.strokes.filter((x) => x.tick === s.tick).length;
    const stroked = s.sweeps > prev.sweeps && prev.phase === CURL_TRAVEL;
    ok(newStrokes === (stroked && s.phase === CURL_TRAVEL && s.active >= 0 && s.live[s.active] ? 1 : 0), `sheet ${run.seed} tick ${s.tick}: ${newStrokes} strokes laid, a stroke ${stroked ? "landed" : "didn't land"}`);
    if (newStrokes === 1) {
      const st = fx.strokes[fx.strokes.length - 1]!;
      const side = Math.sign(s.bend);
      const off = st.x - s.x[s.active]! / CU;
      ok(st.side === side && (side === 0 ? Math.abs(off) < 1e-9 : Math.sign(off) === side), `sheet ${run.seed} tick ${s.tick}: the stroke lies on the side brushed (side ${st.side}, bend ${s.bend}, offset ${off.toFixed(1)} cm)`);
      ok(st.y < s.y[s.active]! / CU, `sheet ${run.seed} tick ${s.tick}: the stroke lies ahead of the stone`);
      fxStrokes++;
    }
    // A ring where stones met: on a tick with a hit only, at a point between two touching stones.
    const newContacts = fx.contacts.filter((x) => x.tick === s.tick).length;
    ok(newContacts === 0 || s.hits > prev.hits, `sheet ${run.seed} tick ${s.tick}: a contact ring only on a hit`);
    if (newContacts > 0) {
      const c = fx.contacts[fx.contacts.length - 1]!;
      let touching = 0;
      for (let i = 0; i < s.x.length; i++) if ((s.live[i] || prev.live[i]) && Math.hypot(s.x[i]! / CU - c.x, s.y[i]! / CU - c.y) <= STONE_R + 3 + 1e-6) touching++;
      ok(touching >= 2, `sheet ${run.seed} tick ${s.tick}: the contact point lies between two stones (${touching} within reach)`);
      fxContacts++;
    }
    if (s.hits > prev.hits) ok(newContacts === 1, `sheet ${run.seed} tick ${s.tick}: a hit gives one contact ring`);
    // Verdicts: at a stone's settle only; gold exactly when the sim scored it, grey exactly on the near-miss rule.
    const newVerdicts = fx.verdicts.filter((x) => x.tick === s.tick);
    if (s.pts.length > prev.pts.length) {
      const i = s.theirs + s.pts.length - 1;
      const scored = (s.pts[s.pts.length - 1] ?? 0) > 0;
      const near = !scored && curlShortBy(s, i) <= NEAR_MISS_CM;
      ok(newVerdicts.length === (scored || near ? 1 : 0), `sheet ${run.seed} throw ${s.pts.length}: ${newVerdicts.length} verdicts (scored ${scored}, near ${near})`);
      if (newVerdicts[0]) ok(newVerdicts[0].kind === (scored ? "count" : "near") && newVerdicts[0].stone === i, `sheet ${run.seed} throw ${s.pts.length}: a ${newVerdicts[0].kind} ring on stone ${newVerdicts[0].stone} (expected ${scored ? "count" : "near"} on ${i})`);
      if (scored) fxVerdicts++;
      if (near) fxNear++;
    } else ok(newVerdicts.length === 0, `sheet ${run.seed} tick ${s.tick}: no verdict between settles`);
  }
  // The end: the counting stones lit one by one, every one inside the stage's hold, never over the controls' row.
  fx.observe(s, now);
  const end = fx.end;
  ok(!!end, `sheet ${run.seed}: the end is seen`);
  if (end) {
    const want = curlEndCounting(s);
    ok(JSON.stringify(end.stones) === JSON.stringify(want), `sheet ${run.seed}: the end lights the counting stones in throw order`);
    ok(want.every((st) => (s.pts[st.stone - s.theirs] ?? 0) > 0 && s.live[st.stone] === 1), `sheet ${run.seed}: each lit stone scored and is still on the sheet`);
    const hold = curlEndHoldMs(s);
    ok(hold > CURL_FX_ZOOM_MS && hold <= CURL_FX_END_HOLD_MS, `sheet ${run.seed}: the hold ${hold} ms covers the zoom and is at most ${CURL_FX_END_HOLD_MS}`);
    let ticks = 0;
    let lastLit = 0;
    for (let ms = 0; ms <= hold; ms += 10) {
      fx.observe(s, end.at + ms);
      ticks += fx.cues.length;
      const lit = curlEndLit(end, end.at + ms);
      ok(lit >= lastLit, `sheet ${run.seed}: lights only go on`);
      lastLit = lit;
    }
    ok(lastLit === want.length && ticks === want.length, `sheet ${run.seed}: all ${want.length} counting stones lit (${lastLit}) with one tick each (${ticks}) inside the ${hold} ms hold`);
    ok(want.length === 0 || end.at + CURL_FX_ZOOM_MS + (want.length - 1) * end.gap <= end.at + 2000, `sheet ${run.seed}: the last light lands inside the 2 s the stage keeps drawing at full rate`);
    fxEnds++;
  }
}
// The end's house and its count line sit clear above the In / Out / Throw row.
ok(CURL_END_HOUSE.y + CURL_END_HOUSE.h + 12 + 34 <= rowTop, `the end's house and its line end at ${CURL_END_HOUSE.y + CURL_END_HOUSE.h + 46} px, above the In / Out / Throw row (${rowTop.toFixed(1)})`);
ok(CURL_END_HOUSE.x >= 0 && CURL_END_HOUSE.x + CURL_END_HOUSE.w <= CURLING_W, "the end's house fits the world's width");

// The near-miss rule: 0 when it scored, the cm short of the edge with no red nearer, the margin past the nearest red.
{
  const base = game4.init(witnesses[0]!.seed);
  const st = (x: number, y: number, redsAt: [number, number][]): CurlingState => ({
    ...base,
    x: [...redsAt.map((r) => r[0] * CU), x * CU],
    y: [...redsAt.map((r) => r[1] * CU), y * CU],
    vx: [...redsAt.map(() => 0), 0],
    vy: [...redsAt.map(() => 0), 0],
    team: [...redsAt.map(() => 1), 0],
    live: [...redsAt.map(() => 1), 1],
    theirs: redsAt.length,
  });
  ok(curlShortBy(st(0, 50, []), 0) === 0, "near-miss rule: a stone inside the scoring edge with no reds needs nothing");
  ok(Math.abs(curlShortBy(st(0, 130, []), 0) - 10) < 0.01, "near-miss rule: 10 cm past the 120 cm edge needs 10 cm (a near miss)");
  ok(curlShortBy(st(0, 150, []), 0) > NEAR_MISS_CM, "near-miss rule: 30 cm past the edge is not a near miss");
  ok(Math.abs(curlShortBy(st(0, 60, [[0, 50]]), 1) - 11) < 0.01, "near-miss rule: 10 cm behind the nearest red in the house needs 11 cm");
  ok(curlShortBy(st(0, 60, [[0, 20]]), 1) > NEAR_MISS_CM, "near-miss rule: 40 cm behind the nearest red is not a near miss");
  ok(curlShortBy({ ...st(0, 50, []), live: [0] }, 0) === Infinity, "near-miss rule: a stone out of play is never a near miss");
}

// Reduced motion: the effects drawn still at their final size (no ring growing, no zoom), so two moments of one
// effect differ only in how faded they are; full motion animates them.
{
  const s0 = game4.init(witnesses[0]!.seed);
  const fx = new CurlFxTracker();
  fx.contacts.push({ tick: s0.tick, x: 0, y: 0 });
  const frame = (age: number) => {
    const c = createCanvas(CURLING_W, CURLING_H_V4);
    const cx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawCurlingFx(cx, { ...s0, tick: s0.tick + age }, fx, 0);
    const d = c.getContext("2d").getImageData(0, 0, CURLING_W, CURLING_H_V4).data;
    // The ring's horizontal extent (any painted pixel).
    let lo = CURLING_W;
    let hi = -1;
    for (let y = 0; y < CURLING_H_V4; y++) for (let x = 0; x < CURLING_W; x++) if (d[(y * CURLING_W + x) * 4 + 3]! > 0) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    return hi - lo;
  };
  motion.reduce = true;
  const still = [frame(1), frame(20)];
  motion.reduce = false;
  const moving = [frame(1), frame(20)];
  ok(still[0] === still[1] && still[0]! > 0, `reduced motion: the contact ring is drawn at one size (${still.join(" and ")} px wide)`);
  ok(moving[1]! > moving[0]!, `full motion: the contact ring opens (${moving.join(" → ")} px)`);
  // The end: no zoom under reduced motion (the house is at its full size from the first frame).
  const ended = { ...s0, over: 1 };
  const fe = new CurlFxTracker();
  fe.end = { at: 0, stones: [], gap: CURL_FX_LIGHT_MS };
  const pixels = (ms: number) => {
    const c = createCanvas(CURLING_W, CURLING_H_V4);
    drawCurlingFx(c.getContext("2d") as unknown as CanvasRenderingContext2D, ended, fe, ms);
    return c.toBuffer("image/png").toString("base64");
  };
  motion.reduce = true;
  ok(pixels(1) === pixels(CURL_FX_ZOOM_MS + 50), "reduced motion: the end's house is drawn at its full size at once (no zoom)");
  motion.reduce = false;
  ok(pixels(1) !== pixels(CURL_FX_ZOOM_MS + 50), "full motion: the end's house zooms");
}
ok(fxStrokes >= 50 && fxContacts >= 10 && fxVerdicts >= 10 && fxNear >= 1 && fxEnds === v4Runs.length, `the effects runs cover every effect (${fxStrokes} strokes, ${fxContacts} contact rings, ${fxVerdicts} gold rings, ${fxNear} near misses, ${fxEnds} ends over ${fxTicks} ticks)`);

if (failures.length) {
  console.log(`curling-overhaul-check: FAIL (${failures.length} of ${passes + failures.length})`);
  for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`curling-overhaul-check: PASS (${passes} checks; the Captain on ${captainFrames} frames, Throw on ${throwTicks} ticks, ${summaries} summaries, the effects on ${fxTicks} ticks)`);
process.exit(0);
