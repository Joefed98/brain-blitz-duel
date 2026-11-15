/**
 * flip-overhaul-check (15 Nov 2026, the Action overhaul stage 1; docs/arcade-standard/flip.md "flipRev 13"): Roofbound.
 *
 *  1. Wiring: rooms deal flipRev 13 on a course from FLIP_DEAL_V13 (built byte for byte by `bun scripts/flip-deal.ts
 *     --rev=13`); LIVE_BANDS and the arcade-standard entry name it; its parts total 200; the round is under 120 s.
 *  2. Older stamps replay exactly: 36 bot runs on unstamped rounds and flipRev 2, 8, 10, 11 and 12, recorded on main
 *     a3f40ff7 (scripts/fixtures/flip-overhaul-legacy.json.gz, scripts/flip-overhaul-legacy-record.ts), give the same score
 *     and the same end state and checkpoints through today's server replay.
 *  3. Grace at Normal: no flipRev 13 run ends on a crash. Weak and average bots on dealt courses, a run with no input and a
 *     run with one flip all reach the clock (ended 1 at 3,600 ticks), every crash counted and costing 10 s of clean time;
 *     a clean run plays tick for tick as flipRev 12 (the same course and moves); the checksum folds in grace.
 *  4. The proved deal: every dealt course's witness takes every flipRev 13 part's maximum and scores exactly 200 through
 *     the server replay.
 *  5. The challenges stay possible: on dealt courses' witnesses each Roofbound challenge's part is full.
 *  6. The reveal: no "Bonuses" tile; flipRev 13's line counts crashes.
 *  7. Edge to edge: the world's art meets the arena scene with no seam: drawn at three depths of the run (heat 0, ½, 1),
 *     the world's outer rows and columns are the bedrock colour FLIP_DEEP, and the scene round it at 414×896 (home-screen
 *     app), 390×844, 375×667 and 1366×768 steps by at most EDGE_STEP_MAX per channel across every edge it meets.
 *
 *   bun scripts/flip-overhaul-check.ts      # ~40 s
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 1,
    location: { pathname: "/", search: "", hash: "", href: "http://localhost/" },
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {},
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const F = await import("../src/lib/arcade/flip");
const { flipArtGameFor, flipArenaSceneFor, FLIP_DEEP, flipCaveHeat } = await import("../src/lib/arcade/flipArt.renderer");
const { replayFlipRun } = await import("../src/lib/duel/flip");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { FLIP_DEAL_V13 } = await import("../src/lib/duel/flipDealV13.server");
const { FLIP_TIME_MS } = await import("../src/lib/duel/types");
const { LIVE_BANDS } = await import("../src/lib/arcade/liveBands");
const { buildArcadeReveal } = await import("../src/lib/arcade/reveal");
const { PRACTICE_CHALLENGES } = await import("../src/lib/duel/practiceChallenges");
const { buildFlipDealV13, flipDealSourceV13, flipTakesAllV13, FLIP_DEAL_FILE_V13 } = await import("./flip-deal");
const { entry } = await import("./arcade-standard/flip");
const { encodeFlipLog, FLIP_WITNESS_FIXTURE } = await import("./flip-x200-record");
const { flipTap } = await import("./flip-x200-plan");
const { bot } = await import("./arcade-skill-bands/bots/flip");
const { Human } = await import("./arcade-skill-bands/human");
const { flipOverhaulDigest } = await import("./flip-overhaul-legacy-record");
type FlipState = import("../src/lib/arcade/flip").FlipState;

const LEGACY = "scripts/fixtures/flip-overhaul-legacy.json.gz";
/** Most the average colour may step across the world's edge where it meets the scene (per channel); arcade-fill-check allows 30. */
const EDGE_STEP_MAX = 8;
const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);
const { FLIP_REV_GRACE, FLIP_REV_DEAL, FLIP_RUN_TICKS, flipGameFor } = F;
const game13 = flipGameFor(FLIP_REV_GRACE);
const witnesses = new Map((JSON.parse(gunzipSync(readFileSync(FLIP_WITNESS_FIXTURE)).toString()) as { seed: number; taps: number[] }[]).map((w) => [w.seed, w]));

/** Steps a log on a stamp, calling `each` on every state. */
function play(rev: number, seed: number, events: { t: number }[], each?: (s: FlipState) => void): FlipState {
  const game = flipGameFor(rev);
  const by = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as FlipState;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, (by.get(s.tick + 1) as any) ?? null) as FlipState;
    each?.(s);
  }
  return s;
}

section("1. wiring");
{
  for (let k = 0; k < 30; k++) {
    const p = generatePuzzle("flip" as any) as any;
    ok(p.flipRev === FLIP_REV_GRACE && FLIP_DEAL_V13.includes(p.seed), `deal ${k}: flipRev 13 on a proved course (${p.flipRev}, ${p.seed})`);
  }
  const built = buildFlipDealV13();
  ok(readFileSync(FLIP_DEAL_FILE_V13, "utf8") === flipDealSourceV13(built.kept, built.total), `${FLIP_DEAL_FILE_V13} is what scripts/flip-deal.ts --rev=13 builds`);
  ok(FLIP_DEAL_V13.length === 260 && built.dropped.length === 0, `all 260 witness courses dealt (${FLIP_DEAL_V13.length}; left out ${built.dropped.join(", ")})`);
  ok(LIVE_BANDS.flip.rev === FLIP_REV_GRACE && LIVE_BANDS.flip.curve === F.FLIP_V13_BAND_CURVE, "LIVE_BANDS reads flipRev 13's core line");
  ok(entry.rev === FLIP_REV_GRACE && entry.before === FLIP_REV_DEAL && entry.spec === F.FLIP_V13, "the arcade-standard entry is flipRev 13, after 12");
  ok(F.FLIP_V13.parts.reduce((a, p) => a + p.max, 0) === 200, "flipRev 13's parts total 200");
  ok(JSON.stringify(F.FLIP_V13.parts.map((p) => [p.key, p.max, p.of])) === JSON.stringify([["core", 100, 110], ["sweets", 60, 5], ["doubles", 20, 8], ["flow", 20, 50]]), "parts: clean time 100 (of 110 half seconds), perfect landings 60 (of 5), double flips 20 (of 8), flow streak 20 (of 50)");
  ok(F.FLIP_V13_CRASH_COST === 20, "a crash costs 20 half seconds (10 s)");
  // The 120 s rule (Joe's brief): no level runs past two minutes.
  ok(FLIP_RUN_TICKS <= 120 * 60 && game13.runTicks <= 120 * 60 && FLIP_TIME_MS <= 120_000, `the round is at most 120 s (${FLIP_RUN_TICKS / 60} s run, ${FLIP_TIME_MS / 1000} s clock)`);
}

section("2. older stamps replay exactly (recorded on main a3f40ff7)");
{
  const legacy = JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as { runs: { rev: number | null; level: string; seed: number; raw: string; score: number; digest: string }[] };
  ok(legacy.runs.length === 36, `36 legacy runs (${legacy.runs.length})`);
  for (const run of legacy.runs) {
    const r = replayFlipRun(run.seed, run.raw, run.rev);
    const tag = `flipRev ${run.rev ?? "unstamped"} ${run.level} seed ${run.seed}`;
    ok(r.score === run.score && flipOverhaulDigest(r as any) === run.digest, `${tag}: the same score (${r.score} / ${run.score}) and end state as on main`);
    ok((r.state as FlipState).grace === undefined, `${tag}: no flipRev 13 field`);
  }
}

section("3. grace at Normal: no run ends on a crash");
{
  let crashes = 0;
  for (const level of ["weak", "average"] as const)
    for (let n = 0; n < 6; n++) {
      const seed = FLIP_DEAL_V13[n * 31]!;
      const out = bot({ game: game13, seed, rev: FLIP_REV_GRACE, human: new Human("flip", seed, level), fixes: true } as any);
      let crashed = false;
      const end = play(FLIP_REV_GRACE, seed, (out.events ?? []) as any, (s) => {
        if (s.ended === 2) crashed = true;
      });
      const { raw } = encodeFlipLog(FLIP_REV_GRACE, seed, out.events ?? []);
      const r = replayFlipRun(seed, raw, FLIP_REV_GRACE);
      crashes += end.saves ?? 0;
      ok(!crashed && end.ended === 1 && end.tick === FLIP_RUN_TICKS, `${level} on course ${seed}: runs to the clock (ended ${end.ended} at ${end.tick})`);
      ok(!r.flagged && r.survived && r.score === game13.score(end), `${level} on course ${seed}: the server replay agrees (${r.score})`);
      ok((end.respawns ?? 0) <= (end.saves ?? 0) && F.flipGraceUnits(end) === Math.max(0, 120 - 20 * (end.saves ?? 0)), `${level} on course ${seed}: each of ${end.saves ?? 0} crashes costs 10 s of clean time`);
    }
  ok(crashes > 0, `the weaker bots crash and run on (${crashes} crashes)`);
  // No input at all: the runner crashes again and again and still reaches the clock, scoring 0 (no input scores 0).
  const idle = play(FLIP_REV_GRACE, FLIP_DEAL_V13[0]!, []);
  ok(idle.ended === 1 && idle.tick === FLIP_RUN_TICKS && (idle.saves ?? 0) > 0 && game13.score(idle) === 0, `no input: runs to the clock with ${idle.saves} crashes and scores 0`);
  const one = encodeFlipLog(FLIP_REV_GRACE, FLIP_DEAL_V13[0]!, [flipTap(1)]);
  const oneR = replayFlipRun(FLIP_DEAL_V13[0]!, one.raw, FLIP_REV_GRACE);
  ok(!oneR.flagged && oneR.survived && oneR.score >= 1, `one flip then nothing: runs to the clock and scores at least 1 (${oneR.score})`);
  // A clean run plays flipRev 12's course and moves tick for tick.
  const moves = (s: FlipState) => JSON.stringify([s.tick, s.x, s.side, s.flipT, s.arcN, s.cursor, s.warpY, s.ended, s.rng, s.land, s.chain, s.combos, s.saves, s.inv, s.cpPassed, s.sweetGot, s.streak, s.bestStreak, s.segs.length]);
  for (const seed of FLIP_DEAL_V13.slice(0, 4)) {
    const taps = witnesses.get(seed)!.taps.map(flipTap);
    const a: string[] = [];
    const b: string[] = [];
    play(FLIP_REV_DEAL, seed, taps, (s) => a.push(moves(s)));
    play(FLIP_REV_GRACE, seed, taps, (s) => b.push(moves(s)));
    ok(a.length === b.length && a.every((m, i) => m === b[i]), `course ${seed}: a clean run is flipRev 12's tick for tick`);
  }
  const base = { ...(game13.init(FLIP_DEAL_V13[0]!) as FlipState), tick: 600 };
  ok(F.flipCheckpoint(base).checksum !== F.flipCheckpoint({ ...base, respawns: 1 }).checksum, "the checkpoint checksum folds in the respawns");
  const old = { ...(flipGameFor(FLIP_REV_DEAL).init(FLIP_DEAL_V13[0]!) as FlipState), tick: 600 };
  ok(old.grace === undefined && F.flipCheckpoint(old).checksum === F.flipCheckpoint({ ...old }).checksum, "flipRev 12 states carry no grace field");
}

section("4. the proved deal: every dealt course reaches 200");
{
  let at200 = 0;
  for (const seed of FLIP_DEAL_V13) {
    const w = witnesses.get(seed);
    if (!w) {
      ok(false, `course ${seed}: no stored witness`);
      continue;
    }
    const { raw, state } = encodeFlipLog(FLIP_REV_GRACE, seed, w.taps.map(flipTap));
    const r = replayFlipRun(seed, raw, FLIP_REV_GRACE);
    if (!r.flagged && r.score === 200 && flipTakesAllV13(state)) at200++;
    else ok(false, `course ${seed}: its witness scores ${r.score}${r.flagged ? " (flagged)" : ""}`);
  }
  ok(at200 === FLIP_DEAL_V13.length, `every dealt course's witness scores 200 with every part at its maximum (${at200} of ${FLIP_DEAL_V13.length})`);
}

section("5. the challenges stay possible");
{
  const mine = PRACTICE_CHALLENGES.filter((c) => c.type === "flip");
  ok(mine.length === 3, `three Roofbound challenges (${mine.length})`);
  const parts: Record<string, string> = { "Double flips": "doubles", "Perfect landings": "sweets", "Flow streak": "flow" };
  for (const seed of FLIP_DEAL_V13.slice(0, 20)) {
    const s = play(FLIP_REV_GRACE, seed, witnesses.get(seed)!.taps.map(flipTap));
    const b = F.flipGraceScore(s);
    for (const [label, key] of Object.entries(parts)) {
      const part = F.FLIP_V13.parts.find((p) => p.key === key)!;
      ok(b.features[key] === part.max, `course ${seed}: ${label} full (${b.features[key]} of ${part.max})`);
    }
  }
  ok(mine.some((c) => c.text === "Land five sweet spots."), "Sweet spot asks for five sweet spots (perfect landings are full at 5 on flipRev 13)");
}

section("6. the reveal");
{
  const st = { ...(game13.init(FLIP_DEAL_V13[0]!) as FlipState), tick: 3600, ended: 1, saves: 2, respawns: 2, sweetGot: 7, combos: 3, bestStreak: 20, acted: 1 };
  const r = buildArcadeReveal("flip", { state: st, survived: true, survivedSeconds: 60, saves: 2, sweets: 3, sweetsTotal: 8, streak: 20, skill: 50, flow: true, grace: true, std: true, starsTotal: 0 } as any, game13.score(st));
  ok(Boolean(r && !r.tiles.some((t) => t.label === "Bonuses") && r.tiles.some((t) => t.label === "Crashes" && t.value === "2")), `no "Bonuses" tile; the crashes counted: ${JSON.stringify(r?.tiles)}`);
  ok(Boolean(r && r.lines.some((l) => /2 crashes/.test(l)) && r.lines.some((l) => /Clean time: 40 s clean/.test(l))), `the line counts crashes and clean time: ${JSON.stringify(r?.lines)}`);
}

section("7. edge to edge");
{
  const W = F.FLIP_WORLD_W;
  const H = F.FLIP_V8_WORLD_H;
  const art = flipArtGameFor(FLIP_REV_GRACE);
  const deep = [0x12, 0x12, 0x16];
  const seed = FLIP_DEAL_V13[0]!;
  const states: FlipState[] = [];
  const want = [60, 1800, 3540];
  play(FLIP_REV_GRACE, seed, witnesses.get(seed)!.taps.map(flipTap), (s) => {
    if (want.includes(s.tick)) states.push(s);
  });
  ok(states.length === 3 && Math.abs(flipCaveHeat(states[2]!) - 1) < 0.02 && flipCaveHeat(states[0]!) < 0.02, "three depths of the run drawn (heat 0 → 1)");
  const avg = (d: Uint8ClampedArray, w: number, x0: number, y0: number, x1: number, y1: number) => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        sum[0] += d[i]!;
        sum[1] += d[i + 1]!;
        sum[2] += d[i + 2]!;
        n++;
      }
    return sum.map((v) => v / n);
  };
  const step = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
  // The four screen sizes as world views (scale to fit the arena under the 52 px header, top-anchored, centred).
  const sizes = [
    { name: "414x896 home-screen app", w: 414, h: 896 - 48 - 34 },
    { name: "390x844", w: 390, h: 844 },
    { name: "375x667", w: 375, h: 667 },
    { name: "desktop 1366x768", w: 1366, h: 768 },
  ];
  for (const s of states) {
    const world = createCanvas(W, H);
    const wctx = world.getContext("2d") as unknown as CanvasRenderingContext2D;
    art.draw(wctx, s, { width: W, height: H });
    const wd = wctx.getImageData(0, 0, W, H).data as unknown as Uint8ClampedArray;
    const heat = flipCaveHeat(s).toFixed(2);
    ok(step(avg(wd, W, 0, H - 1, W, H), deep) <= 3, `heat ${heat}: the world's bottom row is the bedrock (${avg(wd, W, 0, H - 1, W, H).map(Math.round)})`);
    ok(step(avg(wd, W, 0, 0, W, 1), deep) <= 3, `heat ${heat}: the world's top row is the bedrock (${avg(wd, W, 0, 0, W, 1).map(Math.round)})`);
    ok(step(avg(wd, W, 0, 60, 1, H - 60), deep) <= 3 && step(avg(wd, W, W - 1, 60, W, H - 60), deep) <= 3, `heat ${heat}: the world's side columns are the bedrock`);
    for (const size of sizes) {
      const box = { w: size.w, h: size.h - 52 };
      const scale = Math.min(box.w / W, box.h / H);
      const left = -((box.w / scale - W) / 2);
      const view = { worldW: W, worldH: H, left, top: 0, right: W - left, bottom: box.h / scale, scale };
      // The scene and the world in one picture, in world units, 1 unit a pixel, with 40 units of margin.
      const M = 40;
      const pic = createCanvas(W + 2 * M, H + M);
      const pctx = pic.getContext("2d") as unknown as CanvasRenderingContext2D;
      pctx.translate(M, 0);
      flipArenaSceneFor(FLIP_REV_GRACE)(pctx, view);
      pctx.drawImage(world as any, 0, 0);
      const pd = pctx.getImageData(0, 0, W + 2 * M, H + M).data as unknown as Uint8ClampedArray;
      const PW = W + 2 * M;
      const edges: [string, number[], number[]][] = [];
      if (view.bottom > H + 1) edges.push(["bottom", avg(pd, PW, M, H - 4, M + W, H), avg(pd, PW, M, H, M + W, H + 4)]);
      if (left < -1) {
        edges.push(["left", avg(pd, PW, M, 40, M + 4, H - 40), avg(pd, PW, M - 4, 40, M, H - 40)]);
        edges.push(["right", avg(pd, PW, M + W - 4, 40, M + W, H - 40), avg(pd, PW, M + W, 40, M + W + 4, H - 40)]);
      }
      for (const [side, a, b] of edges) ok(step(a, b) <= EDGE_STEP_MAX, `heat ${heat} ${size.name}: no seam at the world's ${side} edge (${a.map(Math.round)} → ${b.map(Math.round)}, step ${step(a, b).toFixed(1)})`);
      ok(edges.length > 0 || size.w === 390, `${size.name}: the scene meets the world somewhere`);
    }
  }
}

console.log(
  failures.length === 0
    ? `PASS flip-overhaul-check: ${passes} checks`
    : `FAIL flip-overhaul-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
