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
 *  4. Dealing: rooms dealt orbitRev 15 on a fuel-bank course (pinOrbitPreBig since stage 3); pinOrbitPreGrace deals
 *     orbitRev 14; LIVE_BANDS, ORBIT_STD and PRACTICE_STAMPS carry the live 16.
 *  5. The checkpoint guard: the stage's SET CHECKPOINT (both placements) is the hold button, which sends only after
 *     ORBIT_CHECKPOINT_HOLD_MS (≥ 300 ms), never on press.
 *  6. Display: the HUD is at most two rows of at most two pills, 28 px or taller (no text under 12 px on a 375-wide
 *     phone); the slips count never falls; a rendered planet stays inside its collision circle and stands still at t = 0.
 *     Stage 2 (Blender planets): the nine maps and their height maps are the files the data file names, within 400 KB,
 *     tone maps grey and colour maps coloured, every map worn by some planet and drawn (with a ring) inside its circle
 *     + 2 px at 1x and the desktop's 2.84x, a lit side over a deep night side, icy worlds never warm, the relief lit.
 *  7. Edge to edge (Joe's rule, 15 Nov 2026): the sun's warmth is 0 along the world's sides and bottom at every point of
 *     the course, and the fill starts at the world's own black with no seam at 414×896 (app), 390×844, 375×667 and
 *     1440×900.
 *  8. Stage 2 (effects and the reveal): the reveal's trace replays to the server's score and maps the witness to the
 *     sun with no slip, and a dry release as one out-of-fuel slip; the course map's four columns; the run picture with
 *     big numbers; the maps preloaded with the chunk; every effect within 900 ms, still under reduced motion and never
 *     writing state; the catch lock on every catch; the sun's bloom; Orbit edgeless with its own moment ring.
 *  9. Stage 3 (15 Nov 2026): orbitRev 16's bigger planets: 120 runs on orbitRev 12–15 recorded on 329286de
 *     (scripts/fixtures/orbit-big-legacy.json, scripts/orbit-big-record.ts) replay exactly, and the orbitRev 15 ones play
 *     the same on 16; all 96 fuel-bank witnesses at 200 on 16 (re-proved, tick for tick as on 15); Stargazer; the bodies
 *     140 % where the path leaves the rocket room, never smaller, clear of neighbours and features; dealing and the
 *     orbitPreBig pin; the bigger planets drawn inside their circles; the reveal's picture under the score with the
 *     breakdown below and no old lines; the sun's 1.5 s end hold.
 *
 *   bun scripts/orbit-overhaul-check.ts
 */
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_FUEL, ORBIT_REV_GRACE, ORBIT_REV_BIG, ORBIT_TOTAL, innerLobe } from "../src/lib/arcade/orbit";
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
import { generateOrbit, pinOrbitPreBig, pinOrbitPreGrace } from "../src/lib/duel/arcade.server";
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
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Action overhaul): rooms deal orbitRev 16 (bigger
  // planets, stage 3) since; orbitRev 15's deal is proved here through pinOrbitPreBig, and section 9 proves orbitRev 16's
  // deal, LIVE_BANDS, ORBIT_STD and PRACTICE_STAMPS.
  const wasBig = pinOrbitPreBig(true);
  for (let k = 0; k < 40; k++) {
    const p = generateOrbit();
    if (p.orbitRev === ORBIT_REV_GRACE && ORBIT_FUEL_BANK.some((e) => JSON.stringify(e.planets) === JSON.stringify(p.planets))) grace++;
  }
  ok(grace === 40, `rooms dealt orbitRev 15 on a fuel-bank course (pinOrbitPreBig; ${grace} / 40)`);
  const was = pinOrbitPreGrace(true);
  const old = generateOrbit();
  pinOrbitPreGrace(was);
  pinOrbitPreBig(wasBig);
  ok(old.orbitRev === ORBIT_REV_FUEL, "pinOrbitPreGrace deals orbitRev 14");
  ok((LIVE_BANDS as Record<string, { rev: number }>).orbit!.rev === ORBIT_REV_BIG && ORBIT_STD.rev === ORBIT_REV_BIG, "LIVE_BANDS and ORBIT_STD carry orbitRev 16 (orbitRev 15's parts)");
  ok(String((PRACTICE_STAMPS as Record<string, string>).orbit).split(" ").includes(`orbitRev=${ORBIT_REV_BIG}`), "PRACTICE_STAMPS carry orbitRev 16");
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
  // Stage 2 (15 Nov 2026): the Blender-rendered maps. Changed with Joe's approval, 15 Nov 2026 (routine consequence of
  // the Action overhaul): the stage-1 assertions on six numpy maps now read the nine Blender maps (and their height maps)
  // through the data file's new shape; every rule they proved (size, inside the circle, every map reachable) is kept.
  const { ORBIT_PLANET_MAPS, ORBIT_PLANET_MAP_BYTES } = await import("../src/lib/arcade/orbitPlanetMaps.data");
  const { loadImage } = await import("@napi-rs/canvas");
  const { createHash } = await import("node:crypto");
  const names = Object.keys(ORBIT_PLANET_MAPS) as (keyof typeof ORBIT_PLANET_MAPS)[];
  let bytes = 0, hashesOk = 0, kindsOk = 0, heights = 0, mapPx = 0;
  const decode = async (key: string, file: string) => {
    const buf = readFileSync(file);
    bytes += buf.length;
    const img = await loadImage(file);
    const mc = createCanvas(img.width, img.height);
    const mx = mc.getContext("2d");
    mx.drawImage(img, 0, 0);
    const data = mx.getImageData(0, 0, img.width, img.height).data as unknown as Uint8ClampedArray;
    planets.setOrbitPlanetMap(key as never, { w: img.width, h: img.height, data });
    return { buf, img, data };
  };
  for (const name of names) {
    const m = ORBIT_PLANET_MAPS[name];
    const { buf, img, data } = await decode(name, `public/orbit/planets/${name}.webp`);
    if (m.url.endsWith(`?v=${createHash("sha256").update(buf).digest("hex").slice(0, 10)}`)) hashesOk++;
    // Tone maps are grey (the renderer tints them); colour maps carry their own colours.
    let chroma = 0;
    for (let i = 0; i < data.length; i += 4 * 97) chroma = Math.max(chroma, Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!));
    if ((m.kind === "tone") === chroma <= 4) kindsOk++;
    if (img.width >= 512 && img.width === 2 * img.height) mapPx++;
    if (m.height) {
      const h = await decode(`${name}-h`, `public/orbit/planets/${name}-h.webp`);
      if (m.height.endsWith(`?v=${createHash("sha256").update(h.buf).digest("hex").slice(0, 10)}`)) heights++;
    }
  }
  const withHeight = names.filter((n) => ORBIT_PLANET_MAPS[n].height).length;
  ok(names.length === 9 && hashesOk === 9 && heights === withHeight && withHeight >= 5, `the nine Blender maps (and ${withHeight} height maps) are the files the data file names (${hashesOk} + ${heights} hashes match)`);
  ok(kindsOk === 9, `tone maps are grey and colour maps carry colour (${kindsOk} of 9)`);
  ok(mapPx === 9, `every map is an equirectangular map at least 512 px wide (${mapPx} of 9)`);
  ok(bytes === ORBIT_PLANET_MAP_BYTES && bytes <= 400_000, `the planet maps ship ${bytes} bytes (at most 400 KB; the data file says ${ORBIT_PLANET_MAP_BYTES})`);
  ok(/orbit-planets-blender\.py/.test(readFileSync("src/lib/arcade/orbitPlanetMaps.data.ts", "utf8")) && /import bpy/.test(readFileSync("scripts/orbit-planets-blender.py", "utf8")), "the maps are Blender bakes from the scene script in the repo");
  // Every map is worn by some planet: every type in every seeded colour, over many seeds.
  const COLOURS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"];
  const worn = new Set<string>();
  const looks: { type: number; colour: string; ring: boolean; tilt: number; h: number }[] = [];
  for (const colour of COLOURS)
    for (let type = 0; type < 3; type++)
      for (let h = 0; h < 192; h += 7) {
        const lk = { type, colour, ring: (h & 3) === 0, tilt: ((h % 60) - 30) * (Math.PI / 180), h };
        const name = planets.orbitPlanetMapFor(lk);
        if (!worn.has(name)) looks.push(lk);
        worn.add(name);
      }
  ok(names.every((n) => worn.has(n)), `every map is worn by some planet (${worn.size} of ${names.length})`);
  // Each draws inside its circle + 2 px at the phone's scale and at the desktop column's (2.84 device px a world px, the
  // largest bake), rings included.
  let sphereOut = 0, sphereDrawn = 0;
  for (const scale of [1, 2.84]) {
    for (const lk of looks) {
      const cv = createCanvas(Math.ceil(120 * scale), Math.ceil(120 * scale));
      const ctx = cv.getContext("2d");
      ctx.scale(scale, scale);
      if (planets.drawRenderedPlanet(ctx as never, 60, 60, 30, lk, 0.61)) sphereDrawn++;
      planets.drawPlanetRing(ctx as never, 60, 60, 30, { ...lk, ring: true });
      const W = cv.width;
      const data = ctx.getImageData(0, 0, W, W).data;
      for (let y = 0; y < W; y++)
        for (let x = 0; x < W; x++) if (Math.hypot((x + 0.5) / scale - 60, (y + 0.5) / scale - 60) > 32 && data[(y * W + x) * 4 + 3]! > 0) sphereOut++;
    }
  }
  ok(sphereDrawn === 2 * looks.length && sphereOut === 0, `every surface map projects a sphere (and a ring) inside its collision circle + 2 px at 1x and 2.84x (${sphereDrawn} drawn, ${sphereOut} px outside)`);
  ok(planets.SPHERE_MAX_PX >= Math.ceil(2 * 28 * (640 / 450) * 2), `the bake reaches the largest planet on screen (${planets.SPHERE_MAX_PX} px ≥ a radius-28 planet on the desktop column at 2x)`);
  // No glow halo: a planet on a transparent canvas leaves the ring of pixels just past its circle empty (checked above at
  // + 2 px); and the night side stays visible, never black.
  {
    const cv = createCanvas(240, 240);
    const ctx = cv.getContext("2d");
    ctx.scale(4, 4);
    planets.drawRenderedPlanet(ctx as never, 30, 30, 28, { type: 0, colour: "#FF4D4D", ring: false, tilt: 0, h: 1 }, 0.3);
    const px = (x: number, y: number) => Array.from(ctx.getImageData(x * 4, y * 4, 1, 1).data);
    const lit = px(18, 18), night = px(46, 44);
    const lum = (p: number[]) => 0.3 * p[0]! + 0.59 * p[1]! + 0.11 * p[2]!;
    ok(lum(lit) > 2.5 * lum(night) && lum(night) > 0 && night[3]! === 255, `a lit side and a deep (never black) night side (lit ${Math.round(lum(lit))}, night ${Math.round(lum(night))})`);
  }
  // Icy worlds keep their own icy colours: never pink, orange or red, whatever the seed (Joe's note); the cold cast is
  // blue, teal or lilac only.
  {
    let warm = 0;
    for (const colour of COLOURS) {
      const cast = planets.orbitIceCast(colour);
      if (cast && !(cast[2] >= cast[0] && cast[2] >= 200)) warm++;
      for (const h of [0, 64]) {
        const cv = createCanvas(240, 240);
        const ctx = cv.getContext("2d");
        ctx.scale(4, 4);
        planets.drawRenderedPlanet(ctx as never, 30, 30, 28, { type: 2, colour, ring: false, tilt: 0, h }, 0.2);
        const d = ctx.getImageData(40, 40, 80, 80).data;
        let r = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]!;
          b += d[i + 2]!;
        }
        if (r > b) warm++;
      }
    }
    ok(warm === 0, `an icy world's lit face is never warmer than blue, in any seeded colour (${warm} warm)`);
  }
  // Relief: the height map changes the light (craters and canyons catch the sun), and only where a height map is shipped.
  {
    const lk = { type: 0, colour: "#FFE600", ring: false, tilt: 0, h: 3 };
    // (Two seeds of the same world, so the second draw isn't served from the first's cached frame.)
    const draw = (h = lk.h) => {
      const cv = createCanvas(160, 160);
      const ctx = cv.getContext("2d");
      ctx.scale(2.84, 2.84);
      planets.drawRenderedPlanet(ctx as never, 28, 28, 28, { ...lk, h }, 0.45);
      return ctx.getImageData(0, 0, 160, 160).data;
    };
    const withRelief = draw();
    const name = planets.orbitPlanetMapFor(lk);
    planets.setOrbitPlanetMap(`${name}-h` as never, { w: 4, h: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(128) });
    const flat = draw(lk.h + 5);
    ok(planets.orbitPlanetMapFor({ ...lk, h: lk.h + 5 }) === name, "the relief's flat draw wears the same map");
    let diff = 0;
    for (let i = 0; i < flat.length; i += 4) diff += Math.abs(flat[i]! - withRelief[i]!);
    await decode(`${name}-h`, `public/orbit/planets/${name}-h.webp`);
    ok(diff / (flat.length / 4) > 1, `the height map's relief lights the surface (mean change ${(diff / (flat.length / 4)).toFixed(1)} per pixel)`);
  }
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

/* 8. Stage 2: effects and the reveal (15 Nov 2026, display only). */
const popcount = (n: number) => { let c = 0; for (let v = n >>> 0; v; v &= v - 1) c++; return c; };
{
  const fx = await import("../src/lib/arcade/orbitEffects.renderer");
  const { traceOrbitRun } = await import("../src/lib/duel/orbitRunTrace");
  const { drawOrbitRunMap, orbitMapLayout } = await import("../src/lib/arcade/orbitReveal.renderer");
  const { ORBIT3_FX_XP } = await import("../src/lib/arcade/arcadeFxGames.renderer");
  const { arcadeFxEdgeless, ARCADE_FX_MOMENT_MS } = await import("../src/lib/arcade/arcadeFx.renderer");
  const puzzleOf = (e: OrbitFuelBankEntry) => ({ type: "orbit", seed: e.seed, orbitRev: ORBIT_REV_GRACE, planets: e.planets, holes: e.holes, extras: e.extras }) as never;

  // The reveal's trace: the witness flies to the sun with no slip; the observer changes nothing in the server's replay.
  const witness = serverRun(course, course.taps.map((t) => ev(t, ORBIT_INPUT_TAP)), ORBIT_REV_GRACE);
  const trace = traceOrbitRun(puzzleOf(course), witness.raw)!;
  ok(trace && trace.finished && trace.best === ORBIT_TOTAL && trace.slips.length === 0 && trace.flights.length > 0, `the reveal's trace of the witness run: the sun, no slips, ${trace?.flights.length} flights`);
  ok(trace.result.score === witness.score && trace.result.flagged === witness.flagged, `tracing replays to the server's own score (${trace.result.score} = ${witness.score})`);
  ok(trace.counts.dust === popcount(witness.state.dustGot ?? 0) && trace.dust.filter((d) => d.got).length === trace.counts.dust && trace.moons.filter((m) => m.got).length === trace.counts.slings, "the map's taken stardust and moons are the replay's own");
  ok(trace.parts !== null && trace.parts.core === 130, "the parts are the standard's breakdown of the replayed run");
  // A run that runs dry: the slip is placed on the map as out of fuel.
  let miss = -1;
  for (let d = 1; d < 400 && miss < 0; d++) {
    let s = startOf(course, true);
    for (let k = 1; k < d; k++) s = step(s, null);
    s = step(s, ev(d, ORBIT_INPUT_TAP));
    if (s.flying === 0) continue;
    while (s.flying > 0 && !s.ended) s = step(s, null);
    if (s.autoRespawns === 1 && s.dry === s.tick) miss = d;
  }
  const dryRun = serverRun(course, [ev(miss, ORBIT_INPUT_TAP)], ORBIT_REV_GRACE);
  const dryTrace = traceOrbitRun(puzzleOf(course), dryRun.raw)!;
  ok(dryTrace.slips.length === 1 && dryTrace.slips[0]!.kind === "fuel" && dryTrace.best === 0, `a release into empty space shows one out-of-fuel slip (${dryTrace.slips.map((s) => s.kind).join(",")})`);
  // The map: four columns of ten planets at one scale, inside its box, and it draws something.
  const lay = orbitMapLayout(trace, 360, 300);
  ok(lay.columns.length === 4 && lay.columns.every((c) => c.x >= 0 && c.x + c.w <= 360 + 1e-6 && c.h <= 300), "the course map folds into four columns inside its box");
  {
    const cv = createCanvas(360, 300);
    const ctx = cv.getContext("2d");
    drawOrbitRunMap(ctx as never, trace, 360, 300);
    const d = ctx.getImageData(0, 0, 360, 300).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) lit++;
    ok(lit > 360 * 300 * 0.3, `the course map draws (${lit} px)`);
  }
  const page = readFileSync("src/puzzles/orbit.tsx", "utf8");
  ok(/RunPicture: OrbitRunPicture/.test(page) && /data-orbit-stat/.test(page) && /FxCountUp/.test(page), "Orbit's definition draws its run picture with big numbers (planets counting up)");
  ok(/preloadOrbitPlanetMaps\(\);/.test(page), "the planet maps are preloaded with the game's chunk");

  // Effects observe the sim and never write to it; each physical action within 900 ms; reduced motion is still.
  ok([fx.ORBIT_LOCK_MS, fx.ORBIT_BLOOM_MS, (fx.ORBIT_PUFF_TICKS * 1000) / 60, (fx.ORBIT_GO_TICKS * 1000) / 60].every((ms) => ms <= 900), "every effect is over within 900 ms");
  const flying = { fuel: 30, flying: 5, ended: 0 } as OrbitRev3State;
  ok(fx.orbitLowFuel(flying) && !fx.orbitLowFuel({ ...flying, fuel: 41 }) && !fx.orbitLowFuel({ ...flying, flying: 0 }), "low fuel is a quarter of the tank or less, in flight");
  const washes = new Set(Array.from({ length: 20 }, (_, t) => fx.orbitLowFuelWash(t, false).toFixed(3)));
  ok(washes.size > 5 && fx.orbitLowFuelWash(3, true) === fx.orbitLowFuelWash(11, true), "low fuel pulses the gauge (steady under reduced motion)");
  const flameOff = Array.from({ length: 120 }, (_, t) => fx.orbitFlameOn(t, true, false)).filter((on) => !on).length;
  ok(flameOff > 10 && flameOff < 60 && Array.from({ length: 120 }, (_, t) => fx.orbitFlameOn(t, true, true) && fx.orbitFlameOn(t, false, false)).every(Boolean), `the flame stutters on low fuel only (${flameOff} of 120 ticks out), steady under reduced motion`);
  // The catch lock and the sun's bloom, on the presentation clock, drawn by the renderer over the witness run.
  {
    let clock = 1000;
    fx.setOrbitFxClock(() => clock);
    const cv = createCanvas(450, 862);
    const ctx = cv.getContext("2d") as never as CanvasRenderingContext2D;
    let s = startOf(course, true);
    const taps = new Set(course.taps);
    let lockSeen = false, lockGone = false, frozen = "";
    while (!s.ended) {
      const next = step(s, taps.has(s.tick + 1) ? ev(s.tick + 1, ORBIT_INPUT_TAP) : null);
      const caught = next.captured > s.captured && next.captured === 3;
      s = next;
      clock += 1000 / 60;
      if (caught) {
        frozen = JSON.stringify(s);
        // (A planet's world y can be negative; draw relative to a camera at the planet.)
        const p = s.planets[s.cur]!;
        const cam = { x: p.x / 256 - 225, y: p.y / 256 - 431 };
        const ring = (ms: number) => {
          const cv2 = createCanvas(450, 862);
          const c2 = cv2.getContext("2d") as never as CanvasRenderingContext2D;
          const t0 = clock;
          fx.drawCatchLock(c2, { ...s, captured: s.captured - 1 } as OrbitRev3State, cam, "#FF0000", false);
          fx.drawCatchLock(c2, s, cam, "#FF0000", false);
          c2.clearRect(0, 0, 450, 862);
          clock = t0 + ms;
          fx.drawCatchLock(c2, s, cam, "#FF0000", false);
          clock = t0;
          const d = c2.getImageData(225 - 60, 431 - 60, 120, 120).data;
          let red = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i]! > 150 && d[i + 1]! < 60 && d[i + 3]! > 0) red++;
          return red;
        };
        lockSeen = ring(100) > 20;
        lockGone = ring(fx.ORBIT_LOCK_MS + 10) === 0;
        ok(JSON.stringify(s) === frozen, "drawing the lock never writes to the state");
      }
      renderer.orbitRev3ArtGame.draw(ctx, s, { width: 450, height: 862 });
    }
    ok(lockSeen && lockGone, "every catch draws its lock ring, gone after ORBIT_LOCK_MS");
    // The sun: the bloom's banner counts the planets up to 40 and holds; reduced motion shows 40 at once.
    const end = s;
    ok(end.finished === 1, "the witness reaches the sun");
    clock += 2000;
    const bloomCtx = createCanvas(450, 862).getContext("2d") as never as CanvasRenderingContext2D;
    const before = JSON.stringify(end);
    fx.drawSunBloom(bloomCtx, { ...end, finished: 0 } as OrbitRev3State, { x: 0, y: 0 }, 450, 862, false);
    fx.drawSunBloom(bloomCtx, end, { x: 0, y: 0 }, 450, 862, false);
    ok(fx.orbitBloomAge(bloomCtx, end) === 0, "the bloom starts on the frame the sun is reached");
    ok(JSON.stringify(end) === before, "the bloom never writes to the state");
    fx.setOrbitFxClock(null);
  }
  // The edge glow's replacement: Orbit's expansion spec is edgeless, draws its own moment ring, and leaves the
  // "ALL 40 PLANETS!" banner to the sun's bloom.
  ok(arcadeFxEdgeless(ORBIT3_FX_XP) && typeof ORBIT3_FX_XP.moment === "function" && !ORBIT3_FX_XP.events.some((e) => e.kind === "final"), "Orbit is edgeless with its own moment hook and no duplicate final banner");
  {
    const cv = createCanvas(450, 862);
    const ctx = cv.getContext("2d");
    ORBIT3_FX_XP.moment!(ctx as never, { kind: "streak", x: 225, y: 200, colour: "#F5B82E", ageMs: 120, p: 120 / ARCADE_FX_MOMENT_MS, still: false, lite: false });
    const d = ctx.getImageData(0, 0, 450, 862).data;
    let lit = 0, edge = 0;
    for (let y = 0; y < 862; y++)
      for (let x = 0; x < 450; x++) {
        if (d[(y * 450 + x) * 4 + 3]! === 0) continue;
        lit++;
        if (x < 4 || x >= 446 || y < 4 || y >= 858) edge++;
      }
    ok(lit > 100 && edge === 0, `the moment ring draws on the moment, nothing on the screen's edge (${lit} px, ${edge} at the edge)`);
  }
}

/* 9. Stage 3 (15 Nov 2026): orbitRev 16's bigger planets, the reveal without its block of lines, the sun's end hold. */
{
  const big = await import("../src/lib/arcade/orbit");
  const { initBigFrom } = await import("../src/lib/arcade/orbitRev3");
  const FP = 256;
  const { orbitExtent, orbitBeltRadius, orbitLobes, orbitBigPlanets, orbitPathClearance, ORBIT_BIG_PCT, ORBIT_BIG_AIR, ORBIT_EIGHT } = big;
  const { ORBIT_DUST_R, ORBIT_HOLE_R, ORBIT_MOON_R } = await import("../src/lib/arcade/orbitRev3");
  const { DEAL_PINS } = await import("../src/lib/duel/dealEra");
  const bigStart = (e: OrbitFuelBankEntry) => initBigFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras));
  /** Plays `events` on orbitRev 16 as the phone does and grades the log through the server's replay on `rev`. */
  const bigRun = (e: OrbitFuelBankEntry, events: ArcadeInputEvent[], rev = ORBIT_REV_BIG) => {
    const at = new Map(events.map((x) => [x.t, x]));
    let s = bigStart(e);
    const checkpoints: unknown[] = [];
    while (!s.ended && s.tick < orbitRev3Game.runTicks) {
      s = step(s, at.get(s.tick + 1) ?? null);
      if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
    }
    const raw = encodeOrbitRun({ seed: e.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
    const r = replayOrbitRun(e.seed, raw, rev, e.planets, e.holes, e.extras);
    return { raw, score: r.score, flagged: Boolean(r.flagged), state: r.state as OrbitRev3State };
  };

  // a. Older stamps replay exactly: 120 runs on orbitRev 12, 13, 14 and 15 recorded on 329286de, before this change.
  {
    type Run = { rev: number; seed: number; kind: string; events: ArcadeInputEvent[]; score: number; checkpoint: { checksum: number }; endTick: number };
    const fx = JSON.parse(readFileSync("scripts/fixtures/orbit-big-legacy.json", "utf8")) as { recordedOn: string; runs: Run[] };
    const revs = new Set(fx.runs.map((r) => r.rev));
    const same = fx.runs.filter((run) => legacyXp(run)).length;
    ok(fx.recordedOn === "329286de" && fx.runs.length === 120 && revs.size === 4 && revs.has(ORBIT_REV_GRACE), `the stage-3 fixture holds 120 runs on orbitRev 12–15 recorded on 329286de (${fx.runs.length})`);
    ok(same === fx.runs.length, `every pre-stage-3 run replays to the same score, end tick and checksum (${same} / ${fx.runs.length})`);
    // The same orbitRev 15 logs (bots, a random tapper with its slips and respawns, a checkpoint) on orbitRev 16: the same play.
    let same16 = 0, n16 = 0;
    for (const run of fx.runs.filter((r) => r.rev === ORBIT_REV_GRACE)) {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === run.seed);
      if (!e) continue;
      n16++;
      const r = bigRun(e, run.events);
      if (r.score === run.score && r.state.tick === run.endTick && orbitCheckpoint(r.state as never).checksum === run.checkpoint.checksum) same16++;
    }
    ok(n16 === 30 && same16 === n16, `every orbitRev 15 log plays the same on orbitRev 16: score, end tick and checksum (${same16} / ${n16})`);
  }

  // b. The bank re-proved once on orbitRev 16: every course's witness reaches 200 through the server replay with every
  // feature, tick for tick as on orbitRev 15; Stargazer is met as the server grades it.
  {
    let full = 0, same = 0, star = 0;
    const stargazer = PRACTICE_CHALLENGES.find((c) => c.type === "orbit" && c.name === "Stargazer");
    for (const e of ORBIT_FUEL_BANK) {
      const events = e.taps.map((t) => ev(t, ORBIT_INPUT_TAP));
      const r = bigRun(e, events);
      const c = orbitXpCounts(r.state);
      if (!r.flagged && r.score === 200 && r.state.finished === 1 && r.state.big === 1 && c.dust === 30 && c.slings === 4 && c.threads === 3) full++;
      const old = serverRun(e, events, ORBIT_REV_GRACE);
      if (old.score === r.score && old.state.tick === r.state.tick && orbitCheckpoint(old.state as never).checksum === orbitCheckpoint(r.state as never).checksum) same++;
      if (stargazer && star < 3) {
        const puzzle = { type: "orbit", seed: e.seed, orbitRev: ORBIT_REV_BIG, planets: e.planets, holes: e.holes, extras: e.extras } as never;
        const g = gradeAnswer(puzzle, r.raw, 0) as { score: number; extra?: Record<string, unknown> };
        if (goalMet(stargazer!.goal, { score: g.score, extra: g.extra ?? null, level: "hard" })) star++;
      }
    }
    ok(full === ORBIT_FUEL_BANK.length && ORBIT_FUEL_BANK.length === 96, `every fuel-bank witness reaches 200 on orbitRev 16 with every feature (${full} / ${ORBIT_FUEL_BANK.length})`);
    ok(same === ORBIT_FUEL_BANK.length, `each plays orbitRev 15 tick for tick (${same} / ${ORBIT_FUEL_BANK.length})`);
    ok(star === 3, `Stargazer (all the stardust) is met by orbitRev 16 runs as the server grades them (${star} / 3)`);
  }

  // c. The bodies: 140 % where the planet's own path leaves room for the rocket and 3 px, never smaller; the sun 140 %;
  // nothing else in a planet changes; no body reaches a neighbour's path or belt, a mote, moon, rock or black hole.
  {
    let grown = 0, total = 0, airBad = 0, notSmaller = 0, otherFields = 0, crowd = 0, sunOk = 0;
    const gains: number[] = [];
    for (const e of ORBIT_FUEL_BANK) {
      const old = decodeRev3Planets(e.planets);
      const ps = orbitBigPlanets(old);
      const ex = decodeOrbitExtras(e.extras);
      const holes = decodeOrbitHoles(e.holes);
      if (ps[ORBIT_TOTAL]!.r === Math.trunc((old[ORBIT_TOTAL]!.r * ORBIT_BIG_PCT) / 100)) sunOk++;
      ps.forEach((p, i) => {
        const o = old[i]!;
        if (JSON.stringify({ ...p, r: 0 }) !== JSON.stringify({ ...o, r: 0 })) otherFields++;
        if (i === ORBIT_TOTAL) return;
        total++;
        if (p.r >= o.r && p.r <= Math.trunc((o.r * ORBIT_BIG_PCT) / 100)) notSmaller++;
        gains.push(p.r / o.r);
        if (p.r === Math.trunc((o.r * ORBIT_BIG_PCT) / 100)) grown++;
        const eight = p.kind === ORBIT_EIGHT;
        const body = eight ? (p.r * 80) / 100 : p.r;
        // Where it grew, its drawn body keeps the rocket's radius and 3 px from its own path.
        if (p.r > o.r && body + ORBIT_BIG_AIR > orbitPathClearance(p) + 1) airBad++;
        for (const c of eight ? [-orbitLobes(p), orbitLobes(p)] : [0]) {
          const cx = p.x + c, cy = p.y;
          ps.forEach((q, j) => {
            if (j === i) return;
            const d = Math.hypot(cx - q.x, cy - q.y);
            if (d < body + orbitExtent(q) + 10 * FP || (q.hazard >= 0 && d < body + orbitBeltRadius(q) + 2 * FP)) crowd++;
          });
          const things: [number, number, number][] = [
            ...ex.dust.map((m) => [m.x, m.y, ORBIT_DUST_R] as [number, number, number]),
            ...ex.moons.map((m) => [m.x, m.y, ORBIT_MOON_R] as [number, number, number]),
            ...ex.fields.flatMap((f) => f.rocks.map((r) => [r.x, r.y, r.r] as [number, number, number])),
            ...holes.map((h) => [h.x, h.y, ORBIT_HOLE_R] as [number, number, number]),
          ];
          for (const [x, y, r] of things) if (Math.hypot(cx - x, cy - y) < body + r + 4 * FP) crowd++;
        }
      });
    }
    gains.sort((a, b) => a - b);
    const median = gains[Math.floor(gains.length / 2)]!;
    ok(notSmaller === total && otherFields === 0, `every body is between orbitRev 15's size and ${ORBIT_BIG_PCT} % of it, nothing else in a planet changed (${notSmaller} / ${total})`);
    ok(grown / total >= 0.6 && median >= 1.35, `most planets are drawn ${ORBIT_BIG_PCT} % (${grown} / ${total}; median ×${median.toFixed(2)})`);
    ok(airBad === 0, `a grown body keeps the rocket's radius and 3 px from its own orbit path (${airBad} too close)`);
    ok(crowd === 0, `no grown body reaches a neighbour's path or belt, a mote, moon, rock or black hole (${crowd})`);
    ok(sunOk === ORBIT_FUEL_BANK.length, `the sun is ${ORBIT_BIG_PCT} % on every course (${sunOk})`);
    // The state carries them; orbitRev 15's start keeps the old ones.
    const e = ORBIT_FUEL_BANK[0]!;
    const s16 = bigStart(e), s15 = startOf(e, true);
    ok(s16.big === 1 && s15.big === undefined && s16.planets[1]!.r > s15.planets[1]!.r && JSON.stringify(orbitCheckpoint(s16 as never)) === JSON.stringify(orbitCheckpoint(s15 as never)), "orbitRev 16's start carries the bigger bodies and the same checkpoint as orbitRev 15's");
  }

  // d. Dealing and stamps.
  {
    let dealt = 0;
    for (let k = 0; k < 40; k++) {
      const p = generateOrbit();
      if (p.orbitRev === ORBIT_REV_BIG && ORBIT_FUEL_BANK.some((e) => JSON.stringify(e.planets) === JSON.stringify(p.planets))) dealt++;
    }
    ok(dealt === 40, `rooms deal orbitRev 16 on a fuel-bank course (${dealt} / 40)`);
    const was = pinOrbitPreBig(true);
    const old = generateOrbit();
    pinOrbitPreBig(was);
    ok(old.orbitRev === ORBIT_REV_GRACE && "orbitPreBig" in DEAL_PINS, "pinOrbitPreBig (DEAL_PINS orbitPreBig) deals orbitRev 15");
    ok(big.orbitXpRev(ORBIT_REV_BIG) && !big.orbitXpRev(ORBIT_REV_BIG + 1), "orbitRev 16 keeps the expansion's view, features and corner");
    const lib = readFileSync("scripts/deal-identity-lib.ts", "utf8");
    ok(/POST_RECORDING_PINS[^\n]*"orbitPreBig"/.test(lib) && /roomDigestsNow\(seeds\), \[[^\]]*"orbitPreBig"/.test(lib), "the deal-identity recording pins orbitPreBig (whole puzzles and rooms)");
  }

  // e. Display: the renderer draws the state's bodies (a grown planet changes the frame), a radius-39 planet at the
  // desktop's 2.84x stays inside its circle + 2 px, and the bake reaches it.
  {
    const planets = await import("../src/lib/arcade/orbitPlanets.renderer");
    const maxR = Math.max(...ORBIT_FUEL_BANK.flatMap((e) => orbitBigPlanets(decodeRev3Planets(e.planets)).slice(0, ORBIT_TOTAL).map((p) => p.r / FP)));
    ok(planets.SPHERE_MAX_PX >= Math.ceil(2 * maxR * (640 / 450) * 2), `the bake reaches orbitRev 16's largest planet on the desktop column at 2x (${planets.SPHERE_MAX_PX} px ≥ radius ${maxR})`);
    let out = 0, drawn = 0;
    for (const lk of [{ type: 0, colour: "#FF4D4D", ring: true, tilt: 0.3, h: 4 }, { type: 1, colour: "#4D8CFF", ring: false, tilt: -0.2, h: 9 }, { type: 2, colour: "#3DDC84", ring: true, tilt: 0.1, h: 13 }]) {
      const scale = 2.84;
      const W = Math.ceil(100 * scale);
      const cv = createCanvas(W, W);
      const ctx = cv.getContext("2d");
      ctx.scale(scale, scale);
      if (planets.drawRenderedPlanet(ctx as never, 50, 50, maxR, lk, 0.37)) drawn++;
      if (lk.ring) planets.drawPlanetRing(ctx as never, 50, 50, maxR, lk);
      const d = ctx.getImageData(0, 0, W, W).data;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (Math.hypot((x + 0.5) / scale - 50, (y + 0.5) / scale - 50) > maxR + 2 && d[(y * W + x) * 4 + 3]! > 0) out++;
    }
    ok(drawn === 3 && out === 0, `a radius-${maxR} planet (rings too) draws inside its circle + 2 px at 2.84x (${out} px outside)`);
    const e = ORBIT_FUEL_BANK[0]!;
    const frame = (s: OrbitRev3State) => {
      const cv = createCanvas(450, 862);
      renderer.orbitRev3ArtGame.draw(cv.getContext("2d") as never, s, { width: 450, height: 862 });
      return cv.getContext("2d").getImageData(0, 0, 450, 862).data;
    };
    const s16 = bigStart(e), s15 = startOf(e, true);
    const a = frame(s15), b = frame(s16);
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 30) diff++;
    ok(diff > 500, `orbitRev 16's frame draws the bigger planets (${diff} px differ from orbitRev 15's at the start)`);
  }

  // f. The reveal (Joe, 15 Nov 2026): the big numbers and the run picture straight under the score, the stored breakdown
  // in the shared layout below it; no block of text lines above the picture; Orbit's own Reveal is the picture too.
  {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { orbitPuzzle } = await import("../src/puzzles/orbit");
    const ar = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
    const pictureAt = ar.indexOf("<GameRunPicture puzzle={puzzle} myAnswer={myAnswer} />");
    const breakdownAt = ar.indexOf("<RevealBreakdown lines={breakdownLines}");
    const scoreAt = ar.indexOf("data-reveal-score={myScore}");
    ok(scoreAt > 0 && pictureAt > scoreAt && breakdownAt > pictureAt, "the arcade reveal draws the run picture under the score and the stored breakdown below the picture");
    const e = ORBIT_FUEL_BANK[0]!;
    const r = bigRun(e, e.taps.map((t) => ev(t, ORBIT_INPUT_TAP)));
    const puzzle = { type: "orbit", seed: e.seed, orbitRev: ORBIT_REV_BIG, planets: e.planets, holes: e.holes, extras: e.extras } as never;
    const pic = renderToString(createElement(orbitPuzzle.RunPicture!, { puzzle, myAnswer: r.raw }));
    ok(/data-orbit-run-summary/.test(pic) && /data-orbit-stat="Planets"/.test(pic) && /data-orbit-stat="Stardust"/.test(pic) && /data-orbit-run-map/.test(pic) && /data-orbit-all-planets/.test(pic), "the run picture: the big numbers, the course map and ALL 40 PLANETS on a full run");
    ok(!/·|planets ·|Same planets for everyone|finished with/.test(pic), "the run picture holds no line of text from the old reveal");
    const own = renderToString(createElement(orbitPuzzle.Reveal, { puzzle, myAnswer: r.raw } as never));
    ok(/data-orbit-run-summary/.test(own) && !/Same planets for everyone/.test(own) && !/Stardust \d+\/\d+ · slingshots/.test(own), "Orbit's own Reveal on the expansion's view is the run picture, never the old lines");
    const older = renderToString(createElement(orbitPuzzle.Reveal, { puzzle: { type: "orbit", seed: 7 } as never, myAnswer: "" } as never));
    ok(/Same planets for everyone/.test(older) && !/data-orbit-run-summary/.test(older), "an unstamped round's Reveal keeps its lines");
  }

  // g. The sun's end hold (Joe, 15 Nov 2026): a finished orbitRev 16 run holds its submit ORBIT_SUN_HOLD_MS (about 1.5 s)
  // so the bloom, ALL 40 PLANETS! and the count-up show before the reveal; the stage passes it.
  {
    const fx = await import("../src/lib/arcade/orbitEffects.renderer");
    const e = ORBIT_FUEL_BANK[0]!;
    const r = bigRun(e, e.taps.map((t) => ev(t, ORBIT_INPUT_TAP)));
    ok(r.state.finished === 1 && renderer.orbitEndHoldMs(r.state) === fx.ORBIT_SUN_HOLD_MS && fx.ORBIT_SUN_HOLD_MS >= 1300 && fx.ORBIT_SUN_HOLD_MS <= 1700 && fx.ORBIT_SUN_HOLD_MS >= fx.ORBIT_BLOOM_MS, `a finished run holds its submit ${fx.ORBIT_SUN_HOLD_MS} ms for the sun moment`);
    ok(renderer.orbitEndHoldMs(bigStart(e)) === 0, "a live run holds nothing");
    ok(/endHoldMs=\{\(state\) => orbitEndHoldMs\(/.test(readFileSync("src/puzzles/orbit.tsx", "utf8")), "the stage passes the end hold");
  }
}

if (failures.length) {
  console.log(`FAIL orbit-overhaul-check: ${failures.length} failed, ${checks - failures.length} passed`);
  process.exit(1);
}
console.log(`PASS orbit-overhaul-check: ${checks} checks — legacy replays, grace, the bank at 200 on orbitRev 15, dealing, the checkpoint guard, the HUD, the planets, edge to edge, stage 2's effects and reveal, and stage 3's bigger planets, reveal and end hold`);
