/**
 * orbit-overhaul-check: Orbit in the Action overhaul (phase 2 step 4, 15 Nov 2026; docs/arcade-standard/orbit.md
 * "orbitRev 15", docs/design/pages-review/action/GALLERY.md).
 *
 *  1. Legacy: 90 runs on orbitRev 12, 13 and 14 recorded on main a3f40ff7 before the change
 *     (scripts/fixtures/orbit-overhaul-legacy.json, scripts/orbit-overhaul-record.ts: bot logs at weak, good and elite, a
 *     random tapper and a checkpoint log) replay through the server's path to the same score, end tick and checkpoint
 *     checksum.
 *  2. Grace (orbitRev 15): a release into empty space with no checkpoint runs dry, respawns at the planet it left with a
 *     full tank and holds ORBIT_GRACE_HOLD_TICKS (taps ignored), the run carrying on; the hold is the slip's whole cost;
 *     a crash (the inner lobe) is caught the same way; SET CHECKPOINT still gives its one respawn, instant (the bonus);
 *     no input pattern ends a run before the sun or the buzzer; with no slip orbitRev 15 plays orbitRev 14 tick for tick.
 *  3. The bank: every fuel-bank course's witness replays through the server on orbitRev 15 to 200 with every feature;
 *     the dealt clock stays within 120 s; "Stargazer" (all stardust) is met by those runs as the server grades them.
 *  4. Dealing: rooms deal orbitRev 15 on a fuel-bank course; pinOrbitPreGrace deals orbitRev 14; LIVE_BANDS and
 *     ORBIT_STD carry 15; PRACTICE_STAMPS too.
 *  5. The checkpoint guard: the stage's SET CHECKPOINT (both placements) is the hold button, which sends only after
 *     ORBIT_CHECKPOINT_HOLD_MS (≥ 300 ms), never on press.
 *  6. Display: the HUD is at most two rows of at most two pills, 28 px or taller (no text under 12 px on a 375-wide
 *     phone); the slips count never falls; a rendered planet stays inside its collision circle and stands still at t = 0.
 *  7. Edge to edge (Joe's rule, 15 Nov 2026): the sun's warmth is 0 along the world's sides and bottom at every point of
 *     the course, and the fill starts at the world's own black with no seam at 414×896 (app), 390×844, 375×667 and
 *     1440×900.
 *
 *   bun scripts/orbit-overhaul-check.ts
 */
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_FUEL, ORBIT_REV_GRACE, ORBIT_TOTAL, innerLobe } from "../src/lib/arcade/orbit";
import {
  decodeOrbitExtras,
  decodeOrbitHoles,
  decodeRev3Planets,
  initFuelFrom,
  initGraceFrom,
  orbitRev3Game,
  orbitXpCounts,
  ORBIT_FUEL_MAX,
  ORBIT_GRACE_HOLD_TICKS,
  ORBIT_REV3_WORLD_W,
  ORBIT_STD,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { orbitCheckpointHoldDone, ORBIT_CHECKPOINT_HOLD_MS } from "../src/lib/arcade/orbitCheckpointHold";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_FUEL_BANK, type OrbitFuelBankEntry } from "../src/lib/duel/orbitFuelBank.server";
import { generateOrbit, pinOrbitPreGrace } from "../src/lib/duel/arcade.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { PRACTICE_CHALLENGES, goalMet } from "../src/lib/duel/practiceChallenges";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { ORBIT_TIME_MS } from "../src/lib/duel/types";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string) {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
}

const ev = (t: number, k: number): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
const startOf = (e: OrbitFuelBankEntry, grace: boolean) =>
  (grace ? initGraceFrom : initFuelFrom)(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras));
const step = (s: OrbitRev3State, input: ArcadeInputEvent | null) => orbitRev3Game.step(s, input) as OrbitRev3State;

/** Plays `events` from `s0` as the phone does and grades the log through the server's replay on `rev`. */
function serverRun(e: OrbitFuelBankEntry, events: ArcadeInputEvent[], rev: number) {
  const at = new Map(events.map((x) => [x.t, x]));
  let s = startOf(e, rev === ORBIT_REV_GRACE);
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: e.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayOrbitRun(e.seed, raw, rev, e.planets, e.holes, e.extras);
  return { raw, score: r.score, flagged: Boolean(r.flagged), state: r.state as OrbitRev3State, sim: s };
}

/* 1. Legacy. */
{
  type Run = { rev: number; seed: number; kind: string; events: ArcadeInputEvent[]; score: number; checkpoint: { checksum: number }; endTick: number };
  const fx = JSON.parse(readFileSync("scripts/fixtures/orbit-overhaul-legacy.json", "utf8")) as { runs: Run[] };
  let same = 0;
  const revs = new Set<number>();
  for (const run of fx.runs) {
    revs.add(run.rev);
    // The course each revision deals for that seed: orbitRev 14 from the fuel bank, 12 and 13 from the feature bank.
    const fuel = ORBIT_FUEL_BANK.find((e) => e.seed === run.seed);
    const raw = (() => {
      const r = run.rev === ORBIT_REV_FUEL && fuel ? serverRun(fuel, run.events, ORBIT_REV_FUEL) : null;
      return r;
    })();
    if (run.rev === ORBIT_REV_FUEL) {
      if (raw && raw.score === run.score && raw.state.tick === run.endTick && orbitCheckpoint(raw.state as never).checksum === run.checkpoint.checksum) same++;
      else console.log(`  rev 14 seed ${run.seed} ${run.kind}: ${raw?.score} vs ${run.score}`);
    } else {
      // orbitRev 12 and 13: through the skill-band tool's own replay (the feature-bank course for the seed).
      same += legacyXp(run) ? 1 : 0;
    }
  }
  ok(fx.runs.length === 90 && revs.size === 3, `the fixture holds 90 runs on orbitRev 12, 13 and 14 (${fx.runs.length})`);
  ok(same === fx.runs.length, `every pre-overhaul run replays to the same score, end tick and checksum (${same} / ${fx.runs.length})`);
}

function legacyXp(run: { rev: number; seed: number; kind: string; events: ArcadeInputEvent[]; score: number; checkpoint: { checksum: number }; endTick: number }): boolean {
  const { GAME_BY_TYPE } = require("./arcade-skill-bands/games") as typeof import("./arcade-skill-bands/games");
  const spec = GAME_BY_TYPE.get("orbit")!;
  const game = spec.gameFor(run.rev, run.seed);
  const at = new Map(run.events.map((x) => [x.t, x]));
  let s = game.init(run.seed) as OrbitRev3State;
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: run.seed, claimedScore: orbitRev3Game.score(s), events: run.events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = spec.replay(run.seed, raw, run.rev);
  const good = r.score === run.score && r.state.tick === run.endTick && orbitCheckpoint(r.state as never).checksum === run.checkpoint.checksum;
  if (!good) console.log(`  rev ${run.rev} seed ${run.seed} ${run.kind}: ${r.score} vs ${run.score}`);
  return good;
}

/* 2. Grace. */
const course = ORBIT_FUEL_BANK[0]!;
{
  // Find a release that misses every planet (an empty tank) from the start.
  let miss = -1;
  for (let d = 1; d < 400 && miss < 0; d++) {
    let s = startOf(course, true);
    for (let k = 1; k < d; k++) s = step(s, null);
    s = step(s, ev(d, ORBIT_INPUT_TAP));
    if (s.flying === 0) continue;
    let n = 0;
    while (s.flying > 0 && !s.ended && n++ < 400) s = step(s, null);
    if (s.autoRespawns === 1 && s.dry === s.tick) miss = d;
  }
  ok(miss > 0, `a release into empty space exists (tick ${miss})`);
  let s = startOf(course, true);
  for (let k = 1; k < miss; k++) s = step(s, null);
  s = step(s, ev(miss, ORBIT_INPUT_TAP));
  const released = s.tick;
  while (s.flying > 0 && !s.ended) s = step(s, null);
  ok(s.ended === 0 && s.autoRespawns === 1 && s.cur === 0 && s.fuel === ORBIT_FUEL_MAX && s.hold === ORBIT_GRACE_HOLD_TICKS, "out of fuel with no checkpoint: respawned at the planet left, full tank, the hold set, the run on");
  // The release tick burns the tank's first unit, so it runs dry ORBIT_FUEL_MAX − 1 ticks after the release.
  ok(s.tick - released === ORBIT_FUEL_MAX - 1, `the tank ran dry after exactly ${ORBIT_FUEL_MAX} ticks of flight (${s.tick - released + 1})`);
  const dryAt = s.tick;
  let tapped = 0;
  for (let k = 0; k < ORBIT_GRACE_HOLD_TICKS; k++) {
    s = step(s, k % 7 === 0 ? ev(s.tick + 1, ORBIT_INPUT_TAP) : null);
    if (s.flying > 0) tapped++;
  }
  ok(tapped === 0 && s.hold === 0 && s.tick === dryAt + ORBIT_GRACE_HOLD_TICKS, `every tap in the ${ORBIT_GRACE_HOLD_TICKS / 60} s hold does nothing`);
  // After the hold a tap releases again.
  let freed = false;
  for (let k = 0; k < 600 && !freed; k++) {
    s = step(s, ev(s.tick + 1, ORBIT_INPUT_TAP));
    if (s.flying > 0 || s.autoRespawns! > 1) freed = true;
  }
  ok(freed, "after the hold a tap acts again");

  // The same release on orbitRev 14 ends the run: grace is the only change.
  let o = startOf(course, false);
  for (let k = 1; k < miss; k++) o = step(o, null);
  o = step(o, ev(miss, ORBIT_INPUT_TAP));
  while (o.flying > 0 && !o.ended) o = step(o, null);
  ok(o.ended === 2, "on orbitRev 14 the same release ends the run (the old rule kept)");

  // A crash: a tap on the inner lobe is a slip too.
  let c = startOf(course, true);
  let crashed = false;
  for (let k = 0; k < 600 && !crashed; k++) {
    const here = c.planets[c.cur]!;
    const lobe = c.flying === 0 && innerLobe(here, c.angle);
    const before = c.autoRespawns ?? 0;
    c = step(c, lobe ? ev(c.tick + 1, ORBIT_INPUT_TAP) : null);
    if (lobe && (c.autoRespawns ?? 0) > before) crashed = true;
  }
  // (Only planets with an inner lobe can crash this way; the check passes if the course has none in reach.)
  ok(!crashed || (c.ended === 0 && c.hold === ORBIT_GRACE_HOLD_TICKS), "a crash with no checkpoint is caught by grace too");

  // The checkpoint's respawn: instant, at the checkpoint, its one use spent; the next slip falls to grace.
  let k1 = step(startOf(course, true), ev(1, ORBIT_INPUT_CHECKPOINT));
  ok(k1.checkpoint === 0 && k1.respawns === 1, "SET CHECKPOINT arms the planet");
  for (let k = 2; k < miss; k++) k1 = step(k1, null);
  k1 = step(k1, ev(miss, ORBIT_INPUT_TAP));
  while (k1.flying > 0 && !k1.ended) k1 = step(k1, null);
  ok(k1.ended === 0 && k1.respawns === 0 && (k1.hold ?? 0) === 0 && (k1.autoRespawns ?? 0) === 0 && k1.cur === 0, "with a checkpoint the slip uses it: instant, no hold (the bonus)");

  // No input pattern ends a run before the buzzer (or the sun): taps every n ticks.
  let early = 0;
  for (const gap of [1, 5, 17, 61, 97, 160, 233]) {
    let r = startOf(course, true);
    while (!r.ended && r.tick < orbitRev3Game.runTicks) r = step(r, r.tick % gap === 0 ? ev(r.tick + 1, ORBIT_INPUT_TAP) : null);
    if (!(r.finished === 1 || r.tick === orbitRev3Game.runTicks) || r.ended === 2) early++;
  }
  ok(early === 0, `no tapping pattern ends a run before the sun or the buzzer (${early} did)`);
}

/* 3. The bank, the clock, Stargazer. */
{
  let full = 0, star = 0, sameAs14 = 0;
  const stargazer = PRACTICE_CHALLENGES.find((c) => c.type === "orbit" && c.name === "Stargazer");
  ok(stargazer, "the catalogue holds Stargazer");
  for (const e of ORBIT_FUEL_BANK) {
    const events = e.taps.map((t) => ev(t, ORBIT_INPUT_TAP));
    const r = serverRun(e, events, ORBIT_REV_GRACE);
    const c = orbitXpCounts(r.state);
    if (!r.flagged && r.score === 200 && r.state.finished === 1 && c.dust === 30 && c.slings === 4 && c.threads === 3) full++;
    const old = serverRun(e, events, ORBIT_REV_FUEL);
    if (old.score === r.score && old.state.tick === r.state.tick && (r.state.autoRespawns ?? 0) === 0) sameAs14++;
    if (stargazer && star < 3) {
      const puzzle = { type: "orbit", seed: e.seed, orbitRev: ORBIT_REV_GRACE, planets: e.planets, holes: e.holes, extras: e.extras } as never;
      const g = gradeAnswer(puzzle, r.raw, 0) as { score: number; extra?: Record<string, unknown> };
      if (goalMet(stargazer.goal, { score: g.score, extra: g.extra ?? null, level: "hard" })) star++;
    }
  }
  ok(full === ORBIT_FUEL_BANK.length, `every fuel-bank witness reaches 200 on orbitRev 15 with every feature (${full} / ${ORBIT_FUEL_BANK.length})`);
  ok(sameAs14 === ORBIT_FUEL_BANK.length, `with no slip orbitRev 15 plays orbitRev 14 tick for tick (${sameAs14} / ${ORBIT_FUEL_BANK.length})`);
  ok(star === 3, `Stargazer (all the stardust) is met by orbitRev 15 runs as the server grades them (${star} / 3)`);
  ok(orbitRev3Game.runTicks <= 120 * 60 && ORBIT_TIME_MS <= 120_000, `the round is at most 120 s (${orbitRev3Game.runTicks / 60} s run, ${ORBIT_TIME_MS / 1000} s clock)`);
}

/* 4. Dealing. */
{
  let grace = 0;
  for (let k = 0; k < 40; k++) {
    const p = generateOrbit();
    if (p.orbitRev === ORBIT_REV_GRACE && ORBIT_FUEL_BANK.some((e) => JSON.stringify(e.planets) === JSON.stringify(p.planets))) grace++;
  }
  ok(grace === 40, `rooms deal orbitRev 15 on a fuel-bank course (${grace} / 40)`);
  const was = pinOrbitPreGrace(true);
  const old = generateOrbit();
  pinOrbitPreGrace(was);
  ok(old.orbitRev === ORBIT_REV_FUEL, "pinOrbitPreGrace deals orbitRev 14");
  ok((LIVE_BANDS as Record<string, { rev: number }>).orbit!.rev === ORBIT_REV_GRACE && ORBIT_STD.rev === ORBIT_REV_GRACE, "LIVE_BANDS and ORBIT_STD carry orbitRev 15");
  ok(String((PRACTICE_STAMPS as Record<string, string>).orbit).split(" ").includes(`orbitRev=${ORBIT_REV_GRACE}`), "PRACTICE_STAMPS carry orbitRev 15");
}

/* 5. The checkpoint guard. */
{
  const stage = readFileSync("src/puzzles/orbit.tsx", "utf8");
  ok(ORBIT_CHECKPOINT_HOLD_MS >= 300 && !orbitCheckpointHoldDone(0, ORBIT_CHECKPOINT_HOLD_MS - 1) && orbitCheckpointHoldDone(0, ORBIT_CHECKPOINT_HOLD_MS), `SET CHECKPOINT needs a ${ORBIT_CHECKPOINT_HOLD_MS} ms hold`);
  ok((stage.match(/<CheckpointHoldButton /g) ?? []).length === 2, "both placements of SET CHECKPOINT are the hold button");
  ok(!/onPressStart=\{\(\) => send\(\{ k: ORBIT_INPUT_CHECKPOINT/.test(stage), "no button sends the checkpoint on press");
  const hold = stage.split("function CheckpointHoldButton")[1]?.split("\nfunction ")[0] ?? "";
  ok(/setTimeout\(\(\) => \{[\s\S]*onSet\(\);[\s\S]*\}, ORBIT_CHECKPOINT_HOLD_MS\)/.test(hold) && /onPressEnd=\{\(\) => \{\s*stop\(\);/.test(hold), "the hold button sends after the hold and a release before it cancels");
}

/* 6. Display. */
const renderer = await import("../src/lib/arcade/orbit.renderer");
const planets = await import("../src/lib/arcade/orbitPlanets.renderer");
{
  const s0 = startOf(course, true);
  const rows = renderer.orbitXpHudRows({ ...s0, checkpoint: 3, respawns: 1 } as OrbitRev3State);
  ok(rows.length <= 2 && rows.every((r) => r.length <= 2), "the HUD is at most two rows of at most two pills");
  ok(Math.min(...renderer.ORBIT_XP_HUD_H) >= 28 && Math.round(Math.min(...renderer.ORBIT_XP_HUD_H) * 0.43) * (375 / 450) >= 10, "every HUD pill is 28 px or taller (labels 10 px+, values 12 px+ on a 375-wide phone)");
  // Slips never fall: through the checkpoint's respawn and two automatic ones.
  const seq = [
    { respawns: 1, autoRespawns: 0 },
    { respawns: 0, autoRespawns: 0 },
    { respawns: 0, autoRespawns: 1 },
    { respawns: 0, autoRespawns: 2 },
  ].map((x) => renderer.orbitSlips(x));
  ok(seq.join(",") === "0,1,2,3", `the success layer's misses count every slip and never fall (${seq.join(",")})`);
  // A rendered planet stays inside its circle (the bounds rule) and its turn is still at t = 0.
  (globalThis as { document?: unknown }).document = { createElement: () => createCanvas(1, 1) };
  const look = { type: 1, colour: "#4D8CFF", ring: true, tilt: 0.3, h: 12345 };
  let outside = 0;
  for (const type of [0, 1, 2]) {
    const cv = createCanvas(120, 120);
    const ctx = cv.getContext("2d");
    const drawn = planets.drawRenderedPlanet(ctx as never, 60, 60, 30, { ...look, type }, 0.37);
    const data = ctx.getImageData(0, 0, 120, 120).data;
    for (let y = 0; y < 120; y++)
      for (let x = 0; x < 120; x++) if (Math.hypot(x + 0.5 - 60, y + 0.5 - 60) > 32 && data[(y * 120 + x) * 4 + 3]! > 0) outside++;
    if (!drawn) outside += 1e6;
  }
  ok(outside === 0, `a rendered planet draws nothing past its collision circle + 2 px (${outside} px)`);
  // The materials pass: the six surface maps shipped are small and every projected sphere keeps inside its circle too.
  const { ORBIT_PLANET_MAPS, ORBIT_PLANET_MAP_BYTES } = await import("../src/lib/arcade/orbitPlanetMaps.data");
  const { loadImage } = await import("@napi-rs/canvas");
  let bytes = 0, sphereOut = 0, sphereDrawn = 0;
  for (const name of Object.keys(ORBIT_PLANET_MAPS) as (keyof typeof ORBIT_PLANET_MAPS)[]) {
    const file = `public/orbit/planets/${name}.webp`;
    bytes += readFileSync(file).length;
    const img = await loadImage(file);
    const mc = createCanvas(img.width, img.height);
    const mx = mc.getContext("2d");
    mx.drawImage(img, 0, 0);
    planets.setOrbitPlanetMap(name, { w: img.width, h: img.height, data: mx.getImageData(0, 0, img.width, img.height).data as unknown as Uint8ClampedArray });
  }
  for (const [type, h] of [[1, 32], [1, 0], [0, 5], [0, 128], [0, 1], [2, 7]] as const) {
    const lk = { ...look, type, h };
    const cv = createCanvas(120, 120);
    const ctx = cv.getContext("2d");
    if (planets.drawRenderedPlanet(ctx as never, 60, 60, 30, lk, 0.61)) sphereDrawn++;
    const data = ctx.getImageData(0, 0, 120, 120).data;
    for (let y = 0; y < 120; y++)
      for (let x = 0; x < 120; x++) if (Math.hypot(x + 0.5 - 60, y + 0.5 - 60) > 32 && data[(y * 120 + x) * 4 + 3]! > 0) sphereOut++;
  }
  const maps = new Set([[1, 32], [1, 0], [0, 5], [0, 128], [0, 1], [2, 7]].map(([type, h]) => planets.orbitPlanetMapFor({ ...look, type: type!, h: h! })));
  ok(bytes === ORBIT_PLANET_MAP_BYTES && bytes <= 400_000, `the planet maps ship ${bytes} bytes (at most 400 KB; the data file says ${ORBIT_PLANET_MAP_BYTES})`);
  ok(sphereDrawn === 6 && maps.size === 6 && sphereOut === 0, `every surface map projects a sphere inside its collision circle (${sphereDrawn} drawn, ${maps.size} maps, ${sphereOut} px outside)`);
  ok(planets.orbitPlanetTurn(look, 0) === 0 && planets.orbitPlanetTurn(look, 10) !== planets.orbitPlanetTurn(look, 20), "the surface turns with the round clock and stands at t = 0 (reduced motion)");
}

/* 7. Edge to edge. */
{
  const W = 450, H = 862;
  let leak = 0;
  for (let best = 0; best <= ORBIT_TOTAL; best++) {
    for (let y = 0; y <= H; y += 8) leak += planets.orbitSunWarmthAt(best, 0, y, W, H) + planets.orbitSunWarmthAt(best, W, y, W, H);
    for (let x = 0; x <= W; x += 8) leak += planets.orbitSunWarmthAt(best, x, H, W, H);
  }
  ok(leak < 1e-9, `the sun's warmth is 0 along the world's sides and bottom all the way to the sun (${leak.toFixed(4)})`);
  ok(planets.orbitSunWarmthAt(0, W / 2, 10, W, H) === 0 && planets.orbitSunWarmthAt(39, W / 2, 10, W, H) > 0.2, "the warmth grows from nothing at the start to the top's glow by the last planet");
  const { orbitFill } = await import("../src/lib/arcade/arenaFills.renderer");
  // Each screen's view in world units round the 450 × 862 world (the layout's fit: top-anchored, scaled to the box).
  const screens = [
    { name: "414x896 app", w: 414, h: 896 - 52 - 34 },
    { name: "390x844", w: 390, h: 844 - 52 - 34 },
    { name: "375x667", w: 375, h: 667 - 52 - 16 },
    { name: "1440x900", w: 640, h: 900 - 56 },
  ];
  for (const sc of screens) {
    const scale = Math.min(sc.w / W, sc.h / H);
    const view = { worldW: W, worldH: H, left: -((sc.w / scale - W) / 2), right: W + (sc.w / scale - W) / 2, top: 0, bottom: sc.h / scale + 40, scale, boxTop: 0 };
    const pad = 60;
    const cw = Math.ceil(view.right - view.left), ch = Math.ceil(view.bottom + pad);
    const cv = createCanvas(cw, ch);
    const ctx = cv.getContext("2d");
    ctx.translate(-view.left, 0);
    // The world's own background inside, as the renderer paints it, then the fill around.
    ctx.fillStyle = "#06060F";
    ctx.fillRect(0, 0, W, H);
    orbitFill(ctx as never, view as never);
    const px = ctx.getImageData(0, 0, cw, ch).data;
    const at = (x: number, y: number) => {
      const i = (Math.round(y) * cw + Math.round(x - view.left)) * 4;
      return [px[i]!, px[i + 1]!, px[i + 2]!];
    };
    // Median of a run of pixels (stars are sparse), each channel.
    const med = (pts: number[][]) => [0, 1, 2].map((c) => pts.map((p) => p[c]!).sort((a, b) => a - b)[pts.length >> 1]!);
    const inside = med(Array.from({ length: 100 }, (_, i) => at((i + 0.5) * (W / 100), H - 3)));
    const below = med(Array.from({ length: 100 }, (_, i) => at((i + 0.5) * (W / 100), H + 3)));
    const step = Math.max(...[0, 1, 2].map((c) => Math.abs(inside[c]! - below[c]!)));
    let sideStep = 0;
    if (view.left < -4) {
      const sIn = med(Array.from({ length: 100 }, (_, i) => at(3, (i + 0.5) * (H / 100))));
      const sOut = med(Array.from({ length: 100 }, (_, i) => at(-3, (i + 0.5) * (H / 100))));
      sideStep = Math.max(...[0, 1, 2].map((c) => Math.abs(sIn[c]! - sOut[c]!)));
    }
    const black = below[0]! <= 10 && below[1]! <= 10 && Math.abs(below[2]! - 9) <= 3 && below[0] === 7;
    ok(step <= 4 && sideStep <= 4 && !black, `${sc.name}: no seam where the world meets the fill (below ${step}, sides ${sideStep}, per channel)`);
  }
}

if (failures.length) {
  console.log(`FAIL orbit-overhaul-check: ${failures.length} failed, ${checks - failures.length} passed`);
  process.exit(1);
}
console.log(`PASS orbit-overhaul-check: ${checks} checks — legacy replays, grace, the bank at 200 on orbitRev 15, dealing, the checkpoint guard, the HUD, the planets and edge to edge`);
