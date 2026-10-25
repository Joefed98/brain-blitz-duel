/**
 * Batch-4 arcade upgrades (Oct 2026): Scrumper snipRev 3, Junction
 * junctionRev 2, Tilt tiltRev 2, High Rise skylineRev 2.
 *
 *  1. Legacy identity: stored rounds of all four games (unstamped, and Scrumper
 *     snipRev 2) replay and score exactly as before (digest saved from the code
 *     before the upgrades).
 *  2. Per game, the new rules: determinism, the new elements, and proof that the
 *     score cap of 150 is reachable on the new revision by a real input log
 *     replayed through the server path.
 *  3. The intro's stated maximums are true, and the intro HOW / SCORE rules hold.
 *
 *   bun scripts/arcade-batch4-check.ts            (BATCH4_ONLY=snip,junction,tilt,skyline)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { recordTap, tapAt } from "../src/lib/arcade/engine";
import { legacyDigest } from "./arcade-batch4-legacy";
import {
  skylineCheckpoint,
  skylineFlagAt,
  skylineGame,
  skylineGameFor,
  skylineGustAt,
  skylineRev2Score,
  SKYLINE_CHECKPOINT_INTERVAL,
  SKYLINE_GUST_SPEED,
  SKYLINE_GUST_WARN_TICKS,
  SKYLINE_REV,
  SKYLINE_RUN_TICKS,
  SKYLINE_STREAK_FROM,
  SKYLINE_WIND_FROM,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline";
import {
  tiltCheckpoint,
  tiltGame,
  tiltGameFor,
  tiltRev2Score,
  tiltTotalStars,
  TILT_MAX_MAZES,
  TILT_REV,
  TILT_RUN_TICKS,
  TILT_STARS_PER_MAZE,
  TILT_TWO_FROM,
  TILT_V2_PARTIAL_MAX,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { playTilt } from "./tilt-bot";
import {
  juncApproachAtV2,
  juncBuildOrder,
  juncBuiltAt,
  juncCarPose,
  juncCarPoseV2,
  juncLanePoint,
  junctionGame,
  junctionGameFor,
  juncStopOf,
  JUNC_APPROACHES_V2,
  JUNC_BUILD_EVERY,
  JUNC_DIAG_FIRST_CAR,
  JUNC_INPUT_TAP,
  JUNC_LIGHT_AT_V2,
  JUNC_REV,
  JUNC_V2_BUS_POINTS,
  JUNC_V2_CAR_POINTS,
  JUNC_V2_SURVIVE_BONUS,
  type JuncCar,
  type JuncState,
} from "../src/lib/arcade/junction";
import { encodeJunctionRun, replayJunctionRun } from "../src/lib/duel/junction";
import { playJunction } from "./junction-bot";
import {
  snipGame,
  snipGameFor,
  snipLevelOrderV3,
  snipMouthAt,
  snipTestLevel,
  SNIP_BANDS,
  SNIP_BANDS_V3,
  SNIP_CONFIG,
  SNIP_LEVEL_TICKS,
  SNIP_REV,
  SNIP_REV3,
  SNIP_RUN_TICKS,
  SNIP_STUNG,
  type SnipState,
} from "../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../src/lib/duel/snip";
import { playSnipLevel } from "./snip-solver";
import { playSnipRun, SNIP_PROOFS } from "./snip-run-bot";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);
const ONLY = process.env.BATCH4_ONLY?.split(",");
const want = (key: string) => !ONLY || ONLY.includes(key);
const SEEDS = (count: number, step = 104_729) => Array.from({ length: count }, (_, i) => 1 + i * step);

/* ============================ 1. Legacy identity ============================ */
section("legacy identity");
{
  const saved = JSON.parse(readFileSync(new URL("./fixtures/arcade-batch4-legacy.json", import.meta.url), "utf8"));
  const now = await legacyDigest(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
  assert.deepEqual(now, saved, "stored rounds must replay exactly as before");
  checks += saved.length;
  console.log(`  ${saved.length} stored-rule runs (snip, snip/v2, junction, tilt, skyline) identical to the pre-upgrade code`);
}

/* =============================== 2a. High Rise =============================== */

/** Drops each block on the tick its left edge best lines up (wind included); `slip` ticks late every `every` drops. */
function playSkyline(seed: number, slipEvery = 0) {
  const game = skylineGameFor(SKYLINE_REV);
  let s = game.init(seed);
  const inputs: number[] = [];
  const checkpoints: ReturnType<typeof skylineCheckpoint>[] = [];
  let planned = -1;
  let drops = 0;
  while (!game.isOver(s)) {
    if (planned < 0) {
      const below = s.blocks[s.blocks.length - 1]!;
      let p = s;
      let best = Infinity;
      planned = s.tick + 1;
      for (let k = 1; k < 240; k++) {
        p = game.step(p, false);
        const d = Math.abs(p.x - below.x);
        if (d < best) {
          best = d;
          planned = p.tick + 1;
        }
        if (d < 128) break;
      }
      drops += 1;
      if (slipEvery && drops % slipEvery === 0) planned += 2;
    }
    const t = s.tick + 1;
    if (t === planned) {
      recordTap(inputs, t);
      planned = -1;
    }
    s = game.step(s, tapAt(inputs, t));
    if (s.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) checkpoints.push(skylineCheckpoint(s));
  }
  return { state: s, inputs, checkpoints, score: game.score(s) };
}

if (want("skyline")) {
  section("High Rise skylineRev 2 (wind gusts from block 20, perfect streak)");
  const game = skylineGameFor(SKYLINE_REV);
  ok(skylineGameFor(undefined) === skylineGame && skylineGame.init(5).rev === undefined, "unstamped High Rise keeps the original game");
  ok(game.init(5).rev === SKYLINE_REV, "the state carries the stamp");
  ok(JSON.stringify(game.init(99)) === JSON.stringify(game.init(99)), "gust schedule is seeded");
  ok(JSON.stringify(game.init(99).gusts) !== JSON.stringify(game.init(100).gusts), "different seeds get different gusts");
  // Gusts: never before block 20, all the same strength, flag waves a second before each.
  for (const seed of SEEDS(20)) {
    const s0 = game.init(seed);
    const g = s0.gusts ?? [];
    ok(g.length >= 9, `seed ${seed}: several gusts in the minute (${g.length / 3})`);
    for (let k = 0; k < g.length; k += 3) {
      const at = g[k]!;
      const late: SkylineState = { ...s0, placed: SKYLINE_WIND_FROM };
      const early: SkylineState = { ...s0, placed: SKYLINE_WIND_FROM - 1 };
      ok(skylineGustAt(early, at) === 0 && skylineFlagAt(early, at) === 0, "no wind and no flag before block 20");
      ok(Math.abs(skylineGustAt(late, at)) === 1, "a gust blows at its start");
      ok(skylineGustAt(late, at - 1) === 0 && skylineFlagAt(late, at - SKYLINE_GUST_WARN_TICKS) === g[k + 2], "the flag waves (the gust's way) a second before the gust");
      if (k > 0) ok(skylineFlagAt(late, at - SKYLINE_GUST_WARN_TICKS - 1) === 0 || g[k - 2]! >= at - SKYLINE_GUST_WARN_TICKS, "the flag is still between warnings");
    }
  }
  // The gust pushes the slide by exactly the gust speed.
  {
    const s0 = game.init(4242);
    const g = s0.gusts!;
    const at = g[0]!;
    const base: SkylineState = { ...s0, tick: at - 1, placed: SKYLINE_WIND_FROM, x: 30_000, dir: 1 };
    const calm = skylineGame.step({ ...base, rev: undefined }, false);
    const windy = game.step(base, false);
    ok(windy.x - calm.x === g[2]! * SKYLINE_GUST_SPEED, "a gust nudges the sliding block by the gust speed each tick");
  }
  // Streak: the 3rd perfect drop in a row and later earn the bonus; a non-perfect drop resets.
  {
    let s = game.init(7);
    const dropAt = (aligned: boolean) => {
      const below = s.blocks[s.blocks.length - 1]!;
      s = { ...s, x: aligned ? below.x : below.x + 4000 };
      s = game.step(s, true);
    };
    dropAt(true); dropAt(true);
    ok(s.streak === 2 && s.streakPoints === 0, "two perfect drops: streak 2, no bonus yet");
    dropAt(true);
    ok(s.streak === SKYLINE_STREAK_FROM && s.streakPoints === 1, "third perfect drop in a row earns the bonus");
    dropAt(true);
    ok(s.streakPoints === 2, "fourth earns it again");
    dropAt(false);
    ok(s.streak === 0 && s.bestStreak === 4, "a drop that isn't perfect resets the streak");
    ok(game.score(s) === skylineRev2Score(5, 4, 2), "score = 2.5/block + 2.5/perfect (floor) + streak points");
  }
  // 150 through the server replay; a run without the streak bonus (a slip every 3rd drop) still reachable.
  let best = 0;
  for (const seed of SEEDS(6, 7_919)) {
    const run = playSkyline(seed);
    const raw = encodeSkylineRun({ seed, claimedScore: run.score, inputs: run.inputs, endTick: run.state.tick, checkpoints: run.checkpoints });
    const replay = replaySkylineRun(seed, raw, SKYLINE_REV);
    ok(replay.score === run.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: server replay agrees`);
    ok(run.state.placed > SKYLINE_WIND_FROM, `seed ${seed}: the run reaches the wind (${run.state.placed} blocks)`);
    best = Math.max(best, replay.score);
  }
  ok(best === 150, "150 is reachable on skylineRev 2 through the server replay");
  const stale = replaySkylineRun(1, encodeSkylineRun({ seed: 1, claimedScore: 0, inputs: playSkyline(1).inputs, endTick: SKYLINE_RUN_TICKS }), undefined);
  ok(stale.state.rev === undefined, "an unstamped replay never picks up the new rules");
}


/* ================================= 2b. Tilt ================================= */
if (want("tilt")) {
  section("Tilt tiltRev 2 (bonus stars, two marbles from maze 3, rimmed cups)");
  const game = tiltGameFor(TILT_REV);
  ok(tiltGameFor(undefined) === tiltGame && tiltGame.init(5).rev === undefined, "unstamped Tilt keeps the original game");
  ok(game.init(5).rev === TILT_REV, "the state carries the stamp");
  ok(JSON.stringify(game.init(99)) === JSON.stringify(game.init(99)), "stars, amber starts and cups are seeded");
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  for (const seed of SEEDS(30)) {
    const v1 = tiltGame.init(seed);
    const s0 = game.init(seed);
    ok(s0.list.length === TILT_MAX_MAZES, "four mazes");
    s0.list.forEach((m, i) => {
      const o = v1.list[i]!;
      ok(JSON.stringify([m.n, m.wallR, m.wallD, m.pits, m.start, m.exit, m.exitDir]) === JSON.stringify([o.n, o.wallR, o.wallD, o.pits, o.start, o.exit, o.exitDir]), `seed ${seed} maze ${i + 1}: same walls, holes and blue cup as the original`);
      ok((m.stars ?? []).length === TILT_STARS_PER_MAZE, `seed ${seed} maze ${i + 1}: ${TILT_STARS_PER_MAZE} stars`);
      for (const c of m.stars ?? []) {
        let open = 0;
        for (let d = 0; d < 4; d++) {
          const ni = (c % m.n) + DX[d]!;
          const nj = Math.trunc(c / m.n) + DY[d]!;
          if (ni < 0 || nj < 0 || ni >= m.n || nj >= m.n || !m.inside[nj * m.n + ni]) continue;
          const nc = nj * m.n + ni;
          const wall = d === 0 ? m.wallR[c] : d === 1 ? m.wallD[c] : d === 2 ? m.wallR[nc] : m.wallD[nc];
          if (!wall) open += 1;
        }
        ok(open === 1 && !m.pits.includes(c) && c !== m.start && c !== m.start2 && c !== m.exit && c !== m.exit2, "each star sits at the end of a side passage, never on a hole, start or cup cell");
      }
      const two = i + 1 >= TILT_TWO_FROM;
      ok(two ? (m.start2 ?? -1) >= 0 && (m.exit2 ?? -1) >= 0 && m.exit2 !== m.exit && m.crevice < 0 : (m.start2 ?? -1) < 0, `seed ${seed} maze ${i + 1}: ${two ? "two marbles, two cups, no chaser" : "one marble"}`);
      if (two) ok(!m.pits.includes(m.start2!) && !m.pits.includes(m.exit2!) && m.start2 !== m.start, "the amber marble starts on its own safe cell and its cup is not on a hole");
      if (i === 1) ok(m.crevice === o.crevice, "maze 2 keeps the original red chaser");
    });
    ok(tiltTotalStars(s0) === TILT_MAX_MAZES * TILT_STARS_PER_MAZE, "eight stars in all");
  }
  // Each marble leaves only through its own cup: put the blue marble at the amber exit, rolling out.
  {
    const s0 = game.init(4242);
    const m = s0.list[2]!;
    const at = { x: (m.exit2! % m.n) * m.cs + (m.cs >> 1), y: Math.trunc(m.exit2! / m.n) * m.cs + (m.cs >> 1) };
    const angle = [16384, 0, 49152, 32768][m.exitDir2!]!;
    let s: TiltState = { ...s0, level: 2, x: at.x, y: at.y, vx: 0, vy: 0, angle, b: { x: (m.start2! % m.n) * m.cs + (m.cs >> 1), y: Math.trunc(m.start2! / m.n) * m.cs + (m.cs >> 1), vx: 0, vy: 0 }, aHome: 0, bHome: 0, chaser: null, starGot: [0, 0] };
    for (let k = 0; k < 120; k++) s = game.step(s, null);
    ok(!s.aHome && s.level === 2, "the blue marble cannot leave through the amber cup's gap");
    let t: TiltState = { ...s, b: { x: at.x, y: at.y, vx: 0, vy: 0 } };
    for (let k = 0; k < 120 && !t.bHome; k++) t = game.step(t, null);
    ok(t.bHome === 1, "the amber marble drops into its own cup");
  }
  // Scoring: the partial maximum stays at or under 130; 150 needs all four mazes.
  ok(TILT_V2_PARTIAL_MAX <= 130, `unfinished maximum ${TILT_V2_PARTIAL_MAX} ≤ 130`);
  ok(tiltRev2Score(TILT_MAX_MAZES - 1, TILT_MAX_MAZES * TILT_STARS_PER_MAZE, TILT_RUN_TICKS) === TILT_V2_PARTIAL_MAX, "three mazes and every star scores exactly the stated partial maximum");
  ok(tiltRev2Score(TILT_MAX_MAZES, 0, TILT_RUN_TICKS) < 150, "150 needs more than finishing at the buzzer");
  let best = 0;
  for (const seed of [1, 77, 5]) {
    const run = playTilt(game, seed, { horizon: 36 });
    const score = game.score(run.state);
    const raw = encodeTiltRun({ seed, claimedScore: score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
    const replay = replayTiltRun(seed, raw, TILT_REV);
    ok(replay.score === score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: server replay agrees (${score}, ${run.state.mazes} mazes, ${run.state.stars} stars)`);
    ok(run.state.mazes === TILT_MAX_MAZES, `seed ${seed}: the bot (4°/tick drags) finishes all four mazes`);
    best = Math.max(best, replay.score);
  }
  ok(best === 150, "150 is reachable on tiltRev 2 through the server replay");
  void tiltCheckpoint;
}


/* =============================== 2c. Junction =============================== */
if (want("junction")) {
  section("Junction junctionRev 2 (diagonal roads every 12 s, lights at their lanes, buses)");
  const game = junctionGameFor(JUNC_REV);
  ok(junctionGameFor(undefined) === junctionGame && junctionGame.init(5).rev === undefined, "unstamped Junction keeps the original game");
  ok(game.init(5).rev === JUNC_REV && game.inputRanges![0]!.a[1] === JUNC_APPROACHES_V2 - 1, "the state carries the stamp; lights 0–7 are valid inputs");
  ok(JSON.stringify(game.init(99)) === JSON.stringify(game.init(99)), "roads and traffic are seeded");
  const orders = new Set<string>();
  for (const seed of SEEDS(40)) {
    const s0 = game.init(seed);
    const builds = s0.builds!;
    orders.add(builds.join());
    ok(builds.slice().sort().join() === "4,5,6,7" && builds.join() === juncBuildOrder(seed).join(), `seed ${seed}: every diagonal is built once, in the seeded order`);
    builds.forEach((ap, k) => ok(juncBuiltAt(builds, ap) === (k + 1) * JUNC_BUILD_EVERY, "a road is built at 12, 24, 36 and 48 s"));
    for (const a of s0.arrivals) {
      if (a.ap >= 4) ok(a.tick >= juncBuiltAt(builds, a.ap) + JUNC_DIAG_FIRST_CAR && !a.amb && !a.kind && !a.turn, "diagonal cars arrive only after their road is built (no buses, ambulances or turns on them)");
      if (a.kind === 1) ok(a.ap < 4 && !a.turn, "buses use the main roads, straight on");
    }
    for (const ap of builds) ok(s0.arrivals.some((a) => a.ap === ap), `seed ${seed}: cars arrive on road ${ap}`);
    ok(s0.arrivals.some((a) => a.kind === 1), `seed ${seed}: buses in the traffic`);
  }
  ok(orders.size > 6, `the build order varies by room seed (${orders.size} orders in 40 seeds)`);
  // A tap on a road not built yet switches nothing; once built it switches.
  {
    let s = game.init(4242);
    const first = s.builds![0]!;
    s = game.step(s, { t: 1, k: JUNC_INPUT_TAP, a: first, b: 0, c: 0, d: 0 });
    ok(((s.lights >> first) & 1) === 0, "tapping an unbuilt road does nothing");
    s = { ...s, tick: JUNC_BUILD_EVERY, cars: [], next: s.arrivals.length };
    s = game.step(s, { t: s.tick + 1, k: JUNC_INPUT_TAP, a: first, b: 0, c: 0, d: 0 });
    ok(((s.lights >> first) & 1) === 1, "once built, its light switches");
  }
  // Box time: a bus keeps the middle longer than a car.
  const boxTicks = (car: Partial<JuncCar>) => {
    let s: JuncState = { ...game.init(1), next: 1e9, lights: 255, cars: [{ id: 1, ap: 0, turn: 0, s: 0, wait: 0, patience: 999, cleared: 0, colour: 0, amb: 0, stopped: 0, kind: 0, ...car }] };
    let n = 0;
    for (let k = 0; k < 400 && s.cars.length; k++) {
      s = game.step(s, null);
      const c = s.cars[0];
      if (c && c.s > juncStopOf(c.ap) && !c.cleared) n += 1;
    }
    return n;
  };
  const carBox = boxTicks({});
  const busBox = boxTicks({ kind: 1 });
  ok(busBox > carBox + 8, `a bus blocks the middle longer than a car (${busBox} vs ${carBox} ticks)`);
  // Crash rules: diagonal + anything crashes; opposite straight main roads share.
  {
    const base: JuncState = { ...game.init(1), next: 1e9, lights: 255 };
    const mk = (ap: number, s: number): JuncCar => ({ id: ap, ap, turn: 0, s, wait: 0, patience: 999, cleared: 0, colour: 0, amb: 0, stopped: 0, kind: 0 });
    const inside = (ap: number) => juncStopOf(ap) + 20 * 256;
    ok(game.step({ ...base, cars: [mk(0, inside(0)), mk(1, inside(1))] }, null).ended === 0, "opposite straight-on main-road cars share the middle");
    ok(game.step({ ...base, cars: [mk(0, inside(0)), mk(2, inside(2))] }, null).ended === 2, "crossing main roads crash");
    for (const d of [4, 5, 6, 7]) ok(game.step({ ...base, cars: [mk(0, inside(0)), mk(d, inside(d))] }, null).ended === 2, `a diagonal car (${d}) and a main-road car in the middle crash`);
  }
  // Lights: by their own stop line, clear of every lane, far apart, and a tap on each picks it.
  {
    const paths: [number, number][] = [];
    for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++)
      for (let s = 0; s < 700; s += 4) {
        const p = ap < 4 ? juncCarPose({ id: 0, ap, turn: 0, s: s * 256 } as JuncCar) : juncCarPoseV2({ id: 0, ap, turn: 0, s: s * 256 } as JuncCar);
        paths.push([p.x, p.y]);
      }
    const all = [4, 5, 6, 7];
    for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) {
      const [lx, ly] = JUNC_LIGHT_AT_V2[ap]!;
      const stop = juncLanePoint(ap, juncStopOf(ap) / 256);
      ok(Math.hypot(lx - stop.x, ly - stop.y) <= 45, `light ${ap} stands by its own stop line`);
      ok(Math.min(...paths.map(([x, y]) => Math.hypot(x - lx, y - ly))) >= 24, `light ${ap} is clear of every lane`);
      for (let o = ap + 1; o < JUNC_APPROACHES_V2; o++) ok(Math.hypot(lx - JUNC_LIGHT_AT_V2[o]![0], ly - JUNC_LIGHT_AT_V2[o]![1]) >= 60, `lights ${ap} and ${o} are at least 60 px apart`);
      ok(juncApproachAtV2(lx, ly, all, 3600) === ap && juncApproachAtV2(lx + 20, ly - 20, all, 3600) === ap, `a tap on (or 28 px around) light ${ap} picks it`);
      const lane = juncLanePoint(ap, juncStopOf(ap) / 256 - 90);
      ok(juncApproachAtV2(lane.x, lane.y, all, 3600) === ap, `a tap on lane ${ap}'s queue picks its light`);
      if (ap >= 4) ok(juncApproachAtV2(lx, ly, [], 3600) !== ap, `an unbuilt road's light cannot be picked`);
    }
    ok(JUNC_LIGHT_AT_V2.every(([x, y]) => x > 0 && x < 390 && y > 40 && y < 620), "every light is on screen below the HUD");
  }
  // Points: 150 reachable with the full junction, through the server replay, but not easy.
  let best = 0;
  let total = 0;
  const raws: number[] = [];
  for (const seed of [1, 77, 4242, 31337]) {
    const run = playJunction(game, seed, {});
    const score = game.score(run.state);
    const raw = encodeJunctionRun({ seed, claimedScore: score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
    const replay = replayJunctionRun(seed, raw, JUNC_REV);
    ok(replay.score === score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: server replay agrees (${score})`);
    ok((run.state.diagCleared ?? 0) > 0 && (run.state.busCleared ?? 0) > 0, `seed ${seed}: the run clears diagonal cars and buses`);
    const s = run.state;
    raws.push(JUNC_V2_CAR_POINTS * (s.cleared - (s.busCleared ?? 0)) + JUNC_V2_BUS_POINTS * (s.busCleared ?? 0) - s.gaveUp + 4 * (s.ambThrough - s.ambStopped) + (s.ended === 1 ? JUNC_V2_SURVIVE_BONUS : 0));
    best = Math.max(best, replay.score);
    total += replay.score;
  }
  ok(best === 150, "150 is reachable on junctionRev 2 through the server replay");
  ok(Math.min(...raws) < 175, `the look-ahead bot's uncapped totals (${raws.join(", ")}) stay near the cap (original: about 175 for every seed)`);
  console.log(`  look-ahead bot: mean ${(total / 4).toFixed(1)}, uncapped ${raws.join(", ")}`);
}


/* =============================== 2d. Scrumper =============================== */
if (want("snip")) {
  section("Scrumper snipRev 3 (60 templates, orchard elements, 2–4 ropes)");
  const game = snipGameFor(SNIP_REV3);
  ok(snipGameFor(undefined) === snipGame && snipGame.init(5).rev === undefined, "unstamped Scrumper keeps the original game");
  ok(snipGameFor(SNIP_REV).init(5).rev === undefined && snipGameFor(SNIP_REV).init(5).order.every((t) => t < 30), "snipRev 2 keeps its 30 templates");
  ok(game.init(5).rev === SNIP_REV3, "the state carries the stamp");
  // Tuning E appends its tall templates after these 60 (snipRev 5 only; rev 3 never draws them).
  ok(SNIP_CONFIG.templates.length >= 60 && SNIP_CONFIG.templates.slice(0, 60).every((t) => !t.h && !t.hooks), "the orchard bank keeps its 60 templates");
  const fresh = (t: number) => t >= 30;
  const orchard = (t: number) => {
    const tpl = SNIP_CONFIG.templates[t]!;
    return !!(tpl.planks || tpl.gutters || tpl.springs || tpl.nests || tpl.slide);
  };
  for (let t = 0; t < 60; t++) ok(fresh(t) === orchard(t), `template ${t}: orchard elements only on the new templates`);
  const kinds = { planks: 0, gutters: 0, springs: 0, nests: 0, slide: 0 };
  for (let t = 30; t < 60; t++) for (const k of Object.keys(kinds) as (keyof typeof kinds)[]) if (SNIP_CONFIG.templates[t]![k]) kinds[k] += 1;
  ok(Object.values(kinds).every((n) => n >= 4), `every element appears on several levels (${JSON.stringify(kinds)})`);
  const ropes = (band: readonly number[]) => band.filter(fresh).map((t) => SNIP_CONFIG.templates[t]!.pins.length);
  ok(Math.min(...ropes(SNIP_BANDS_V3.medium)) >= 2 && Math.min(...ropes(SNIP_BANDS_V3.hard)) >= 3 && Math.max(...ropes(SNIP_BANDS_V3.hard)) === 4, "new medium levels hang from 2–3 ropes, new hard ones from 3–4");
  let newDrawn = 0;
  for (const seed of SEEDS(200, 7_919)) {
    const order = snipLevelOrderV3(seed);
    newDrawn += order.filter(fresh).length;
    ok(order.join() === game.init(seed).order.join(), "the order comes from the seed");
  }
  ok(newDrawn / 200 > 4, `half the levels of a run are new orchard levels on average (${(newDrawn / 200).toFixed(1)} of 10)`);
  // Elements behave as described.
  {
    const find = (key: "planks" | "gutters" | "springs" | "nests" | "slide") => SNIP_CONFIG.templates.findIndex((tpl) => !!tpl[key]);
    // A plank: an apple set on it rolls downhill.
    const pt = find("planks");
    const plank = SNIP_CONFIG.templates[pt]!.planks![0]!;
    const mid = { x: (plank[0] + plank[2]) / 2, y: (plank[1] + plank[3]) / 2 };
    let s: SnipState = { ...snipTestLevel(pt, 0), ropes: [] };
    s = { ...s, sx: mid.x * 256, sy: (mid.y - 13) * 256, sox: mid.x * 256, soy: (mid.y - 13) * 256 };
    for (let k = 0; k < 30; k++) s = snipGame.step(s, null);
    const downhill = Math.sign(plank[3] > plank[1] ? plank[2] - plank[0] : plank[0] - plank[2]);
    ok(Math.sign(s.sx - mid.x * 256) === downhill && Math.abs(s.sy - mid.y * 256) < 40 * 256, "an apple on a plank rolls down it");
    // A spring: an apple dropped on it leaves faster than the kick.
    const st = find("springs");
    const spring = SNIP_CONFIG.templates[st]!.springs![0]!;
    const sm = { x: (spring[0] + spring[2]) / 2, y: (spring[1] + spring[3]) / 2 };
    let b: SnipState = { ...snipTestLevel(st, 0), ropes: [] };
    b = { ...b, sx: sm.x * 256, sy: (sm.y - 40) * 256, sox: sm.x * 256, soy: (sm.y - 40) * 256 - 512 };
    let up = 0;
    for (let k = 0; k < 40; k++) {
      b = snipGame.step(b, null);
      up = Math.max(up, b.soy - b.sy);
    }
    ok((b.springHits ?? 0) >= 1 && up >= SNIP_CONFIG.springKick - 400, "a springy branch kicks the apple back up hard");
    // A gutter carries it without a bounce.
    const gt = find("gutters");
    const gut = SNIP_CONFIG.templates[gt]!.gutters![0]!;
    const gm = { x: (gut[0] + gut[2]) / 2, y: (gut[1] + gut[3]) / 2 };
    let g: SnipState = { ...snipTestLevel(gt, 0), ropes: [] };
    g = { ...g, sx: gm.x * 256, sy: (gm.y - 20) * 256, sox: gm.x * 256, soy: (gm.y - 20) * 256 - 1024 };
    let rise = 0;
    for (let k = 0; k < 30; k++) {
      g = snipGame.step(g, null);
      rise = Math.max(rise, g.soy - g.sy);
    }
    ok(rise < 200, "a gutter takes the apple without a bounce");
    // A nest: touching it loses the level.
    const nt = find("nests");
    const [nx, ny] = SNIP_CONFIG.templates[nt]!.nests![0]!;
    let w: SnipState = { ...snipTestLevel(nt, 0), ropes: [] };
    w = { ...w, sx: nx * 256, sy: (ny - 40) * 256, sox: nx * 256, soy: (ny - 40) * 256 };
    for (let k = 0; k < 40 && w.level === 0; k++) w = snipGame.step(w, null);
    ok(w.level === 1 && w.lastOutcome === SNIP_STUNG && w.eaten === 0, "touching a wasp nest loses the level");
    // A sliding basket moves within its range and feeds at its moving position.
    const lt = find("slide");
    const tpl = SNIP_CONFIG.templates[lt]!;
    const xs = Array.from({ length: tpl.slide![1] }, (_, k) => snipMouthAt(tpl, k).x / 256);
    ok(Math.abs(Math.min(...xs) - (tpl.mouth[0] - tpl.slide![0])) <= 1 && Math.abs(Math.max(...xs) - (tpl.mouth[0] + tpl.slide![0])) <= 1, "the basket slides ± its amplitude");
    let m: SnipState = { ...snipTestLevel(lt, 0), ropes: [] };
    const at = snipMouthAt(tpl, 61);
    m = { ...m, levelTick: 60, sx: at.x, sy: at.y - 10 * 256, sox: at.x, soy: at.y - 10 * 256 };
    m = snipGame.step(m, null);
    ok(m.eaten === 1, "the apple is caught where the basket is now");
  }
  // Every template is proven at pin wobble −10, 0 and +10 by a stored human-paced plan.
  const worst: number[] = [];
  const worstLeaf: number[] = [];
  for (let t = 0; t < 60; t++) {
    let w = 0;
    let wl = 0;
    for (const jit of [-10, 0, 10]) {
      const proof = SNIP_PROOFS[String(t)]?.[String(jit)];
      ok(!!proof?.fast, `template ${t} wobble ${jit}: a stored winning plan`);
      const res = playSnipLevel(t, jit, proof!.fast!.plan);
      ok(res.eaten && res.tick === proof!.fast!.tick, `template ${t} wobble ${jit}: the plan feeds the apple at tick ${proof!.fast!.tick}`);
      w = Math.max(w, res.tick);
      if (proof!.leaf) {
        const lr = playSnipLevel(t, jit, proof!.leaf.plan);
        ok(lr.eaten && lr.star, `template ${t} wobble ${jit}: the leaf plan takes the leaf and feeds the apple`);
        wl = Math.max(wl, lr.tick);
      } else wl = Infinity;
    }
    worst.push(w);
    worstLeaf.push(wl);
    ok(w <= SNIP_LEVEL_TICKS, `template ${t}: fed within the 12 s level`);
  }
  // Strong player, every mix: the 3 slowest easy + 4 slowest medium + 3 slowest hard still fit the minute.
  const slowest = (band: readonly number[], k: number, by: number[]) => band.map((t) => by[t]!).sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0);
  const bound = slowest(SNIP_BANDS_V3.easy, 3, worst) + slowest(SNIP_BANDS_V3.medium, 4, worst) + slowest(SNIP_BANDS_V3.hard, 3, worst);
  ok(bound <= SNIP_RUN_TICKS, `every ten-level mix can be finished in the minute (worst mix ${(bound / 60).toFixed(1)} s with stored plans)`);
  console.log(`  worst mix, fastest plans: ${(bound / 60).toFixed(1)} s; slowest single level ${(Math.max(...worst) / 60).toFixed(1)} s`);
  const leafBound = slowest(SNIP_BANDS_V3.easy, 3, worstLeaf) + slowest(SNIP_BANDS_V3.medium, 4, worstLeaf) + slowest(SNIP_BANDS_V3.hard, 3, worstLeaf);
  console.log(`  worst mix taking every leaf: ${Number.isFinite(leafBound) ? (leafBound / 60).toFixed(1) + " s" : "not every leaf proven"}`);
  void SNIP_BANDS;
  // 150 through the server replay on a real seeded run (actual pin wobble).
  let best = 0;
  for (const seed of [1, 77, 4242]) {
    const run = playSnipRun(game, seed, {});
    const raw = encodeSnipRun({ seed, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
    const replay = replaySnipRun(seed, raw, SNIP_REV3);
    ok(replay.score === run.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: server replay agrees (${run.score}: ${run.state.eaten} apples, ${run.state.stars} leaves, done at ${(run.state.finishTick / 60).toFixed(1)} s)`);
    ok(run.state.eaten === SNIP_CONFIG.levels, `seed ${seed}: the bot feeds all ten apples`);
    best = Math.max(best, replay.score);
  }
  ok(best === 150, "150 is reachable on snipRev 3 through the server replay");
}

/* ============================ 3. Intro text rules ============================ */
section("intro text");
for (const type of (["skyline", "tilt", "junction", "snip"] as const).filter(want)) {
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines (${intro.length})`);
  // One phone line each at 375 px (as batch 2: READY fully visible at 375×667 with these lengths).
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 46, `${type}: intro HOW line fits one line: ${line.action} ${line.detail}`);
  ok(help.goal.length <= 34, `${type}: intro GOAL fits one line: ${help.goal}`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro SCORE within 90 characters (${INTRO_SCORE[type].length})`);
}
// skylineRev 7 (E4, 25 Oct 2026) raised High Rise to 200 (roundMax.ts); e4-expansion-check proves a bot reaches it.
if (want("skyline")) ok(/up to 200/i.test(INTRO_SCORE.skyline), "High Rise intro states the 200 maximum (skylineRev 7)");
if (want("snip")) ok(PUZZLE_INSTRUCTIONS.snip.how.some((l) => !l.helpOnly && `${l.action} ${l.detail}`.includes("up to 12 s each")), "Scrumper intro says up to 12 s each");
if (want("junction")) ok(/minute for 10 more/i.test(INTRO_SCORE.junction), "Junction intro states the 10 for lasting the minute (score bands)");
if (want("tilt")) ok(!INTRO_SCORE.tilt.includes(`up to ${TILT_V2_PARTIAL_MAX}`) && /up to 150/.test(INTRO_SCORE.tilt), "Tilt intro states the 150 and no partial cap (score bands)");

console.log(`arcade batch 4: ${checks} checks passed`);
