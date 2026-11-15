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
 *  8. Stage 2 effects (display only, 15 Nov 2026): flipRev 13's world is the 730 px cave; near misses are spikes within
 *     FLIP_NEAR_MISS_PX at a take-off or landing, never a crash, at most 10 a run; a glint lasts its ticks; every landing
 *     puffs at its spot, gold on exactly the sweet spots (drawn: gold pixels there); each double flip's ring and each crash's
 *     flash start on their ticks; the flow counter ticks up on each clean landing, never rides ahead of the runner and is
 *     never under PERFECT; the stretch keeps inside the bounds rule; the end count and the stage's hold; earlier revisions
 *     draw none of it; drawing never writes to the state.
 *  9. The answer reveal: Roofbound's RunPicture (the shared hook ArcadeReveal draws); its moments are the server replay's (weak,
 *     average and elite runs on six courses), one mark each, the four numbers with plain labels, no "×", big type.
 *
 *   bun scripts/flip-overhaul-check.ts      # ~60 s
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

section("8. stage 2 effects (display only)");
{
  const FX = await import("../src/lib/arcade/flipFx");
  const { flipFlowChipAt, flipStretch, FLIP_STRETCH_Y, FLIP_STRETCH_X } = await import("../src/lib/arcade/flipArt.renderer");
  const { FLIP_FX } = await import("../src/lib/arcade/arcadeFxGames.renderer");
  ok(F.flipWorldHFor(FLIP_REV_GRACE) === F.FLIP_V8_WORLD_H, "flipRev 13's stage and replay world is the 730 px cave (flipWorldHFor)");
  // Every moment comes from one state and the effects never write to it.
  const seed = FLIP_DEAL_V13[0]!;
  const taps = witnesses.get(seed)!.taps.map(flipTap);
  const elite: FlipState[] = [game13.init(seed) as FlipState];
  play(FLIP_REV_GRACE, seed, taps, (s) => elite.push(s));
  const weakOut = bot({ game: game13, seed, rev: FLIP_REV_GRACE, human: new Human("flip", seed, "weak"), fixes: true } as any);
  const weak: FlipState[] = [game13.init(seed) as FlipState];
  play(FLIP_REV_GRACE, seed, (weakOut.events ?? []) as any, (s) => weak.push(s));
  // Near misses: a spike just ahead at take-off or just behind at landing, never on a crash, within the slot's 0–10 a round.
  for (const level of ["weak", "average", "good", "elite"] as const) {
    let most = 0;
    for (let n = 0; n < 6; n++) {
      const sd = FLIP_DEAL_V13[n * 23]!;
      const out = level === "elite" ? { events: witnesses.get(sd)!.taps.map(flipTap) } : bot({ game: game13, seed: sd, rev: FLIP_REV_GRACE, human: new Human("flip", sd, level), fixes: true } as any);
      const seen = new Set<number>();
      let bad = 0;
      play(FLIP_REV_GRACE, sd, (out.events ?? []) as any, (s) => {
        const m = FX.flipNearMiss(s);
        if (!m) return;
        seen.add(m.tick);
        const seg = s.segs[m.seg]!;
        const x = s.v8!.xs[m.tick]!;
        const half = F.FLIP_RUNNER_HALF_PX_V2 * 256;
        const d = F.flipSegShift(seg, m.tick);
        const gap = m.kind === "off" ? seg.x0 + d - (x + half) : x - half - (seg.x1 + d);
        if (seg.kind !== F.FLIP_SPIKE || gap < 0 || gap > FX.FLIP_NEAR_MISS_PX * 256) bad++;
        const crash = FX.flipCrashTick(s);
        if (crash !== null && crash >= m.tick) bad++;
      });
      most = Math.max(most, seen.size);
      ok(bad === 0, `${level} on course ${sd}: every near miss is a spike within ${FX.FLIP_NEAR_MISS_PX} px, never a crash`);
    }
    ok(most <= 10, `${level}: at most 10 near misses a run (the slot's 0–10; most ${most})`);
  }
  const shown = elite.map((s) => FX.flipNearMissShown(s));
  const firstMiss = shown.findIndex(Boolean);
  ok(firstMiss > 0 && shown.slice(firstMiss, firstMiss + FX.FLIP_NEAR_GLINT_TICKS).every(Boolean) && !shown[firstMiss + FX.FLIP_NEAR_GLINT_TICKS], `a near miss's glint lasts ${FX.FLIP_NEAR_GLINT_TICKS} ticks (from tick ${firstMiss})`);
  // Landings: a dust puff at every landing, gold exactly on the sweet-spot landings, for FLIP_PUFF_TICKS.
  let sweetPuffs = 0;
  let puffs = 0;
  for (let i = 1; i < elite.length; i++) {
    const s = elite[i]!;
    const p = elite[i - 1]!;
    const puff = FX.flipLandingPuff(s);
    if (p.flipT === 1 && s.flipT === 0) {
      puffs++;
      ok(puff !== null && puff.age === 0 && puff.x === s.x, `tick ${s.tick}: a landing puffs at the landing spot`);
      if ((s.sweetT ?? 0) > (p.sweetT ?? 0)) {
        sweetPuffs++;
        ok(Boolean(puff?.sweet), `tick ${s.tick}: a sweet-spot landing's puff is gold`);
      } else ok(puff !== null && !puff.sweet, `tick ${s.tick}: an ordinary landing's puff is dust`);
    }
  }
  ok(puffs > 50 && sweetPuffs === 8, `every landing puffs (${puffs}), gold on all 8 sweet spots (${sweetPuffs})`);
  // Double flips: the ring shows on each double flip's arc and only then.
  const doubles = elite.filter((s, i) => i > 0 && (s.combos ?? 0) > (elite[i - 1]!.combos ?? 0));
  ok(doubles.length > 0 && doubles.every((s) => FX.flipIsDouble(s) && FX.flipTakeoffTick(s) === s.tick), `each double flip's ring starts at its take-off (${doubles.length})`);
  ok(elite.every((s) => !FX.flipIsDouble(s) || (s.flipT > 0 && (s.chain ?? 0) > 0)), "no ring outside a double flip's arc");
  // Crashes: the flash sits on the crash tick, then the blink.
  const crashes = weak.filter((s, i) => i > 0 && (s.saves ?? 0) > (weak[i - 1]!.saves ?? 0));
  ok(crashes.length > 0 && crashes.every((s) => FX.flipCrashTick(s) === s.tick), `each crash's flash starts on its tick (${crashes.length})`);
  // The flow counter's tick-up follows each clean landing; its spot rides over the head and never ahead of the runner.
  const pops = elite.filter((s, i) => i > 0 && (s.streak ?? 0) > (elite[i - 1]!.streak ?? 0));
  ok(pops.length > 0 && pops.every((s) => FX.flipFlowPopAge(s) === 0), `the flow counter ticks up on each clean landing (${pops.length})`);
  const perfectAt = FLIP_FX.events.find((e) => e.label?.({} as any, 1, 1) === "PERFECT")!.at!;
  let ahead = 0;
  let overlap = 0;
  for (const s of elite) {
    const p = F.flipRunnerPoint(s);
    const chip = flipFlowChipAt(s, p.y);
    if (chip.x > p.x + 4.5) ahead++;
    if (s.sweetT === s.tick) {
      const word = perfectAt(s)!;
      // The PERFECT pop (about 80 × 18 px about its spot, 10 px above it) against the chip (≤ 48 × 22).
      const dx = Math.abs(word.x - chip.x);
      const dy = Math.abs(word.y - 10 - chip.y);
      if (dx < 40 + 24 && dy < 9 + 11) overlap++;
    }
  }
  ok(ahead === 0, `the flow counter never rides ahead of the runner, where the hazards come from (${ahead} frames)`);
  ok(overlap === 0, `PERFECT at the landing never covers the flow counter (${overlap})`);
  // Over the head on the floor (above), under it on the roof (below), 4 px off centre either way.
  ok(elite.every((s) => { const c = flipFlowChipAt(s, 300, true); return Math.abs(Math.abs(c.x - F.flipRunnerX(s)) - 4) < 1e-9 && Math.abs(c.y - 300 - (s.side === 0 ? -44 : 44)) < 1e-9; }), "reduced motion: the counter holds over the head on the cave side (no swing)");
  // The stretch stays inside the bounds rule: at most 2 px past the runner's 32 × 36 box.
  ok(elite.every((s) => flipStretch(s) >= 0 && flipStretch(s) <= 1) && (36 * FLIP_STRETCH_Y) / 2 <= 2 && FLIP_STRETCH_X > 0, "the flip's stretch is at most 1.3 px past the box (the bounds rule allows 2)");
  // The end card's count, and the stage's hold for it (inside the 3 s between the run and the clock).
  ok(FX.flipFlowCountShown(92, 0, false) === 0 && FX.flipFlowCountShown(92, FX.FLIP_FLOW_COUNT_MS, false) === 92 && FX.flipFlowCountShown(92, 0, true) === 92, "the flow best counts up over 800 ms (shown whole under reduced motion)");
  const end = elite[elite.length - 1]!;
  ok(FX.flipEndHoldMs(end) === FX.FLIP_END_HOLD_MS && FX.FLIP_END_HOLD_MS <= FLIP_TIME_MS - FLIP_RUN_TICKS * (1000 / 60) - 1000, "a survived flow run holds its answer 1.2 s for SURVIVED! (inside the clock's 3 s)");
  ok(FX.flipEndHoldMs({ ...end, ended: 0 } as FlipState) === 0 && FX.flipEndHoldMs(flipGameFor(8).init(seed) as FlipState) === 0, "no hold mid-run or on earlier revisions");
  ok([2, 8, 10].every((rev) => { const s0 = flipGameFor(rev).init(seed) as FlipState; return FX.flipNearMiss(s0) === null && FX.flipLandingPuff(s0) === null && !FX.flipIsDouble(s0); }), "earlier revisions draw none of it");
  // Drawing never writes to the state, and the effects show: a gold puff, the end card counting.
  const art = flipArtGameFor(FLIP_REV_GRACE);
  const W = F.FLIP_WORLD_W;
  const H = F.FLIP_V8_WORLD_H;
  const at = (list: FlipState[], i: number) => list[Math.min(list.length - 1, i)]!;
  const sweetI = elite.findIndex((s, i) => i > 0 && (s.sweetT ?? 0) > (elite[i - 1]!.sweetT ?? 0));
  const frame = (s: FlipState) => {
    const c = createCanvas(W, H);
    const cx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const before = JSON.stringify(s);
    art.draw(cx, s, { width: W, height: H });
    ok(JSON.stringify(s) === before, `tick ${s.tick}: drawing leaves the state as it was`);
    return cx.getImageData(0, 0, W, H).data as unknown as Uint8ClampedArray;
  };
  const sweetState = at(elite, sweetI + 4);
  const gold = frame(sweetState);
  const plain = frame({ ...sweetState, sweetT: 1 });
  const p = F.flipRunnerPoint(sweetState);
  let goldPx = 0;
  for (let y = Math.round(p.y); y < Math.round(p.y) + 30; y++)
    for (let x = 0; x < 110; x++) {
      const i = (y * W + x) * 4;
      if (gold[i]! > 220 && gold[i + 1]! > 160 && gold[i + 2]! < 140 && !(plain[i]! > 220 && plain[i + 1]! > 160 && plain[i + 2]! < 140)) goldPx++;
    }
  ok(goldPx > 12, `a sweet-spot landing's gold puff is drawn at the landing spot (${goldPx} gold px)`);
  for (const s of [at(elite, firstMiss + 2), at(elite, doubles[0]!.tick + 5), at(weak, crashes[0]!.tick + 3)]) frame(s);
  // No edge glow (the shared hook, ACTION_EDGELESS_GAMES): its replacement draws on the moment, not round the edge.
  const { edgelessGame } = await import("../src/lib/arcade/success.renderer");
  const { arcadeFxEdgeless } = await import("../src/lib/arcade/arcadeFx.renderer");
  const { flipMoment, flipFxFor } = await import("../src/lib/arcade/arcadeFxGames.renderer");
  ok(edgelessGame("flip") && arcadeFxEdgeless(FLIP_FX) && FLIP_FX.moment === flipMoment && flipFxFor(end).moment === flipMoment, "Roofbound draws no edge glow; the taller cave's spec carries the moment hook");
  const momentPx = (kind: string, p: number, still = false) => {
    const c = createCanvas(W, H);
    const cx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    flipMoment(cx, { kind: kind as any, x: W / 2, y: H / 2, colour: "#fff", ageMs: p * 600, p, still, lite: false });
    const d = cx.getImageData(0, 0, W, H).data;
    let lit = 0;
    let edge = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3]! === 0) continue;
        lit++;
        if (x < 6 || x >= W - 6 || y < 6 || y >= H - 6) edge++;
      }
    return { lit, edge };
  };
  for (const kind of ["streak", "final", "perfect"]) {
    const m = momentPx(kind, 0.4);
    ok(m.lit > 100 && m.edge === 0, `a ${kind} moment draws on the moment, never at the world's edge (${m.lit} px, ${m.edge} at the edge)`);
  }
  ok(momentPx("combo", 0.4).lit === 0, "a double flip's moment draws nothing here (the renderer's ring follows the runner)");
  ok(momentPx("streak", 0, true).lit > 100, "reduced motion: the rule shows whole at once");
}

section("9. the answer reveal: a picture of the run");
{
  const { flipRunTimeline } = await import("../src/lib/duel/flipTimeline");
  const { FlipRunPicture } = await import("../src/components/puzzles/FlipRunPicture");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { flipPuzzle } = await import("../src/puzzles/flip");
  ok(Boolean(flipPuzzle.RunPicture) && /<GameRunPicture/.test(readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8")), "Roofbound's definition has a RunPicture, which the arcade reveal draws (GameRunPicture)");
  ok(/function RunPicture[\s\S]{0,600}<FlipRunPicture/.test(readFileSync("src/puzzles/flip.tsx", "utf8")), "the RunPicture draws the run picture from the stored answer");
  ok(/if \(timeline\) return <FlipRunPicture/.test(readFileSync("src/puzzles/flip.tsx", "utf8")), "Roofbound's Reveal draws the run picture on the flow revisions");
  for (const seed of FLIP_DEAL_V13.slice(0, 6)) {
    for (const level of ["weak", "average", "elite"] as const) {
      const events = level === "elite" ? witnesses.get(seed)!.taps.map(flipTap) : (bot({ game: game13, seed, rev: FLIP_REV_GRACE, human: new Human("flip", seed, level), fixes: true } as any).events ?? []);
      const { raw } = encodeFlipLog(FLIP_REV_GRACE, seed, events);
      const r = replayFlipRun(seed, raw, FLIP_REV_GRACE);
      const t = flipRunTimeline(seed, raw, FLIP_REV_GRACE)!;
      const s = r.state as FlipState;
      const tag = `${level} on course ${seed}`;
      ok(Boolean(t) && t.crashes.length === r.saves && t.perfects.length === r.sweets && t.doubles.length === r.combos && t.best.count === (r.streak ?? -1) && t.endTick === s.tick, `${tag}: the picture's moments are the server replay's (${t?.crashes.length} crashes, ${t?.perfects.length} perfect, ${t?.doubles.length} doubles, best ${t?.best.count})`);
      ok(t.cleanSeconds === Math.floor(F.flipGraceUnits(s) / 2) && t.best.from <= t.best.to && t.best.to <= t.endTick, `${tag}: clean time is the score's (${t.cleanSeconds} s) and the best streak lies inside the run`);
      const html = renderToStaticMarkup(React.createElement(FlipRunPicture, { timeline: t }));
      const count = (re: RegExp) => (html.match(re) ?? []).length;
      ok(count(/data-flip-run-crash=""/g) === t.crashes.length && count(/data-flip-run-perfect=""/g) === t.perfects.length && count(/data-flip-run-double=""/g) === t.doubles.length, `${tag}: one mark a crash, perfect landing and double flip on the strip`);
      ok(html.includes(`data-flip-stat="clean"`) && html.includes(`>${t.cleanSeconds} s<`) && html.includes(`>Best flow<`) && html.includes(`>Perfect landings<`) && html.includes(`>Double flips<`) && html.includes(`>Clean time<`), `${tag}: the four numbers the score is made of, each with its plain label`);
      ok(!html.includes("×") && !/core|features|units|full at/i.test(html), `${tag}: no stray "×" and no jargon in the picture`);
      ok(/font-size:34px/.test(html) && !/font-size:(?:[0-9]|1[0-2])px/.test(html) && !/font-size="(?:[0-9]|1[0-2])"/.test(html), `${tag}: big numbers (34 px) and nothing under 13 px`);
    }
  }
  ok(flipRunTimeline(FLIP_DEAL_V13[0]!, "", FLIP_REV_DEAL - 4) === null, "earlier revisions (no flow streak) keep their lines: no picture");
}

console.log(
  failures.length === 0
    ? `PASS flip-overhaul-check: ${passes} checks`
    : `FAIL flip-overhaul-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
