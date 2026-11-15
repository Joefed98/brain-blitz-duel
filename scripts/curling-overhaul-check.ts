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
 *
 *   bun scripts/curling-overhaul-check.ts   (~10 s, no browser)
 */
import { readFileSync } from "node:fs";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { CURL_AIM, CURL_TRAVEL, CURLING_REV, CURLING_STONES, CU, HOG_NEAR, STONE_R, curlingGameFor, type CurlingState } from "../src/lib/arcade/curling";
import {
  CURL_CAPTAIN,
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

if (failures.length) {
  console.log(`curling-overhaul-check: FAIL (${failures.length} of ${passes + failures.length})`);
  for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`curling-overhaul-check: PASS (${passes} checks; the Captain on ${captainFrames} frames, Throw on ${throwTicks} ticks, ${summaries} summaries)`);
process.exit(0);
