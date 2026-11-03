/**
 * Batch-5 arcade upgrades (Oct 2026): Swish binRev 3, Flightpath bullRev 2,
 * Rally rallyRev 2, Tempo beatRev 2, Rainbow Bridge inkRev 4, Orbit orbitRev 4.
 *
 *  1. Legacy identity: every revision these games had before batch 5 replays
 *     and scores exactly as before (digest saved from the code before it).
 *  2. Per game, the new rules: determinism, the new elements, and proof that
 *     150 is reachable on the new revision by a real input log replayed
 *     through the server path, and that the intro's stated maximums are true.
 *  3. The intro HOW / GOAL / SCORE rules and the wording rules.
 *
 *   bun scripts/arcade-batch5-check.ts        (BATCH5_ONLY=bintoss,bullseye,rally,beat,inkbridge,orbit)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { legacyDigest } from "./arcade-batch5-legacy";
import { playFlightpath, playInk, playRally, playSwish, playTempo } from "./arcade-batch5-bots";
import { inkBridgeGameFor, inkCheckpoint, inkStarCheck, INK_LEVELS, INK_REV3, INK_REV4, INK_REV_BAND, INK_REV_SPREAD, INK_REV_STRICT, INK_REV_TUNEC, INK_STAR_LEVELS, INK_V4_PARTIAL_MAX } from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { beatCheckpoint, beatGame, beatGameFor, beatSwipeCount, BEAT_REV, BEAT_REV_BAND, BEAT_REV_TUNEC, BEAT_REV_TUNEF, BEAT_SWIPE_FROM } from "../src/lib/arcade/beat";
import { encodeBeatRun, replayBeatRun } from "../src/lib/duel/beat";
import {
  rallyCheckpoint,
  rallyGame,
  rallyGameFor,
  rallyTargetLeft,
  RALLY_BALL_R,
  RALLY_BUMPER_FROM,
  RALLY_BUMPER_R,
  RALLY_PADDLE_Y,
  RALLY_REV,
  RALLY_REV_BAND,
  RALLY_REV_TUNED,
  RALLY_REV_TUNEF,
  RALLY_TARGET_W,
  RALLY_WALL,
  RALLY_WORLD_W,
} from "../src/lib/arcade/rally";
import { encodeRallyRun, replayRallyRun } from "../src/lib/duel/rally";
import {
  bullseyeCheckpoint,
  bullseyeGame,
  bullseyeGameFor,
  bullseyeInit,
  bullseyeInitRev2,
  bullseyeInInnerBull,
  bullseyeWinds,
  BULLSEYE_BALLOON_COUNT,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_REV,
  BULLSEYE_REV_BAND,
  BULLSEYE_REV_TUNED,
} from "../src/lib/arcade/bullseye";
import { encodeBullseyeRun, replayBullseyeRun } from "../src/lib/duel/bullseye";
import {
  binTossCheckpoint,
  binTossGame,
  binTossCentreAt,
  binTossGameFor,
  binTossHalf,
  binTossSpinPivot,
  binTossWindAcc,
  binTossWindSub,
  BINTOSS_BALL_R,
  BINTOSS_HOOP_CAP_R,
  BINTOSS_HOOP_COUNT,
  BINTOSS_HOOP_HALF,
  BINTOSS_REV2,
  BINTOSS_REV3,
  BINTOSS_REV_BAND,
  BINTOSS_SPIN_HALF,
  BINTOSS_SPIN_THICK,
  BINTOSS_THROWS,
  BINTOSS_V3_PARTIAL_MAX,
  BINTOSS_WIND_TICKS,
  BINTOSS_RIM_Y,
} from "../src/lib/arcade/binToss";
import { encodeBinTossRun, replayBinTossRun } from "../src/lib/duel/binToss";
import { BINTOSS_REV_EXPAND } from "../src/lib/arcade/binToss";
import { generateBeat, generateBinToss, generateBullseye, generateInkBridge, generateOrbit, generateRally, pinInkPreClover, pinOrbitPreFuel } from "../src/lib/duel/arcade.server";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV4, ORBIT_REV_SWEPT, ORBIT_REV_TUNED, ORBIT_REV_STD, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import { decodeOrbitHoles, decodeRev3Planets, initRev4From, orbitRev3Game, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../src/lib/arcade/orbitRev3";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { clearSpot, holeDelays, holeFork, HOLE_WINDOW_MAX, HOLE_WINDOW_MIN } from "./orbit-hole-lib";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { playRevOf } from "./scoring-targets-revs";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);
const ONLY = process.env.BATCH5_ONLY?.split(",");
const want = (key: string) => !ONLY || ONLY.includes(key);
const SEEDS = (count: number, step = 104_729) => Array.from({ length: count }, (_, i) => 1 + i * step);

/* ============================ 1. Legacy identity ============================ */
section("legacy identity");
{
  const saved = JSON.parse(readFileSync(new URL("./fixtures/arcade-batch5-legacy.json", import.meta.url), "utf8"));
  const now = await legacyDigest(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
  assert.deepEqual(now, saved, "stored rounds must replay exactly as before");
  checks += saved.length;
  console.log(`  ${saved.length} runs on every pre-batch-5 revision identical to the code before the upgrades`);
}

/* ================================ 2a. Swish ================================ */
if (want("bintoss")) {
  section("Swish binRev 3 (bonus hoops, spinners, wind on today's bucket)");
  const game = binTossGameFor(BINTOSS_REV3);
  ok([BINTOSS_REV_BAND + 2, BINTOSS_REV_EXPAND + 1, BINTOSS_REV_EXPAND + 2].includes(generateBinToss().binRev ?? -1), "new rounds are stamped binRev 6 (rev 4 play with the shorter spinner: binRev 5, scoring-targets-check; on the score bands: binRev 6, scoring-bands-check) or binRev 8 (binRev 7, the world expansion, with the smaller far bucket of the phone notes; expansion-e5-check) or binRev 9 (binRev 8 on the arcade scoring standard; bintoss-standard-check)");
  ok(binTossGameFor(undefined) === binTossGame && binTossGame.init(5).hoops === undefined, "unstamped rounds keep the original game");
  ok(binTossGameFor(BINTOSS_REV2).init(5).hoops === undefined, "rev-2 rounds have no hoops or spinners");
  ok(JSON.stringify(game.init(77)) === JSON.stringify(game.init(77)), "hoops and spinners are seeded");
  ok(JSON.stringify(game.init(77).winds) === JSON.stringify(binTossGame.init(77).winds), "winds are drawn exactly as before");
  // Wind: over the reference flight one point drifts exactly a quarter of this throw's bucket width.
  for (const index of [0, 3]) {
    const acc = binTossWindAcc(index, BINTOSS_REV3);
    const t = BINTOSS_WIND_TICKS;
    const drift = Math.trunc((acc * ((t * (t + 1)) / 2)) / binTossWindSub(BINTOSS_REV3));
    const quarter = (2 * binTossHalf(index, BINTOSS_REV3)) / 4;
    ok(drift === quarter, `throw ${index + 1}: one wind point = a quarter of the bucket (${(drift / 256).toFixed(2)} px vs ${(quarter / 256).toFixed(2)} px)`);
  }
  let hoopTotal = 0;
  for (const seed of SEEDS(200, 7919)) {
    const s = game.init(seed);
    const hoops = s.hoops!.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
    const spins = s.spinners!.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
    hoopTotal += hoops.length;
    ok(hoops.every((i) => i >= 1 && i <= 4) && spins.length === 3 && spins.every((i) => i >= 5), `seed ${seed}: hoops on throws 2-5, three spinners on throws 6-10`);
    ok(hoops.every((i) => !spins.includes(i)), `seed ${seed}: no throw has both`);
    for (const i of hoops) {
      const h = s.hoops![i]!;
      ok(h.y < BINTOSS_RIM_Y - 60 * 256, `seed ${seed}: hoop ${i + 1} sits well above the rim`);
    }
    for (const i of spins) {
      const pivot = binTossSpinPivot(s, i, 0);
      const centre = binTossCentreAt(s, i, 0);
      // A ball dropping straight into the middle of the bucket never touches the bar,
      // and the bar never dips to the rim, so a high lob always gets past it.
      ok(centre - pivot.x > BINTOSS_SPIN_HALF + BINTOSS_SPIN_THICK + BINTOSS_BALL_R, `seed ${seed}: a lob into the middle clears spinner ${i + 1}`);
      ok(pivot.y + BINTOSS_SPIN_HALF + BINTOSS_SPIN_THICK < BINTOSS_RIM_Y, `seed ${seed}: spinner ${i + 1} stays above the rim`);
    }
  }
  ok(hoopTotal === 200 * BINTOSS_HOOP_COUNT, `every run has ${BINTOSS_HOOP_COUNT} hoops (${hoopTotal} / ${200 * BINTOSS_HOOP_COUNT})`);
  ok(BINTOSS_HOOP_HALF - BINTOSS_HOOP_CAP_R - BINTOSS_BALL_R >= 12 * 256, "the hoop opening leaves the ball 12 px either side");

  // 150 through the server replay, every hoop taken; and the partial maximum (one miss).
  const runs = Number(process.env.BATCH5_SWISH_RUNS ?? 6);
  let best = 0;
  for (const seed of SEEDS(runs, 15_485_863)) {
    const run = playSwish(game, seed, binTossCheckpoint, { hoop: true });
    ok(run.unmade.length === 0, `seed ${seed}: the bot finds a scoring throw on every throw (unmade ${run.unmade.join(",")})`);
    const raw = encodeBinTossRun({ seed, claimedScore: game.score(run.state), events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints as never });
    const replay = replayBinTossRun(seed, raw, BINTOSS_REV3);
    ok(!replay.flagged && replay.score === game.score(run.state), `seed ${seed}: server replay agrees (${replay.score})`);
    ok(replay.baskets === BINTOSS_THROWS && replay.swishes === BINTOSS_HOOP_COUNT, `seed ${seed}: 10 buckets and every hoop bonus`);
    best = Math.max(best, replay.score);
    ok(replay.score === 150, `seed ${seed}: a perfect quick run scores 150`);
    const partial = playSwish(game, seed, binTossCheckpoint, { hoop: true, missThrow: 9 });
    const partialReplay = replayBinTossRun(seed, encodeBinTossRun({ seed, claimedScore: game.score(partial.state), events: partial.events, endTick: partial.state.tick, checkpoints: partial.checkpoints as never }), BINTOSS_REV3);
    ok(partialReplay.score === BINTOSS_V3_PARTIAL_MAX, `seed ${seed}: 9 buckets + every hoop = the intro's ${BINTOSS_V3_PARTIAL_MAX}`);
  }
  console.log(`  ${runs} bot runs reach ${best}; one miss caps at ${BINTOSS_V3_PARTIAL_MAX}`);
  ok(INTRO_SCORE.bintoss.includes(`up to ${roundMaxFor("bintoss")}`) && !INTRO_SCORE.bintoss.includes(`up to ${BINTOSS_V3_PARTIAL_MAX}`), "Swish intro states its maximum and no 99 cap (score bands)");
}

/* ============================== 2b. Flightpath ============================== */
if (want("bullseye")) {
  section("Flightpath bullRev 2 (inner bull, drifting balloons)");
  const game = bullseyeGameFor(BULLSEYE_REV);
  const generated = generateBullseye();
  // Expansion E9 (docs/expansions/e9.md) then moved Flightpath on to bullRev 8; expansion-e9-check covers it.
  ok(playRevOf("bullseye", generated.bullRev) === BULLSEYE_REV_TUNED + 4 && BULLSEYE_REV_BAND === 3, "new rounds are stamped bullRev 8 (expansion E9, after bullRev 4's Tuning B value balloons; bullRev 3 = rev 2 play on the score bands)");
  ok(bullseyeGameFor(undefined) === bullseyeGame && bullseyeInit(5).balloons === undefined, "unstamped rounds keep the original game");
  for (const seed of SEEDS(200, 7919)) {
    const a = bullseyeInitRev2(seed, bullseyeWinds(seed));
    const legacy = bullseyeInit(seed, bullseyeWinds(seed));
    ok(JSON.stringify(a) === JSON.stringify(bullseyeInitRev2(seed, bullseyeWinds(seed))), `seed ${seed}: balloons are seeded`);
    ok(JSON.stringify({ ...a, rng: 0, rev: undefined, balloons: undefined }) === JSON.stringify({ ...legacy, rng: 0 }), `seed ${seed}: winds, drift and ring swaps drawn exactly as before`);
    const darts = a.balloons!.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    ok(darts.length === BULLSEYE_BALLOON_COUNT && darts.every((i) => i >= 2), `seed ${seed}: three balloons on darts 3-10`);
  }
  // The inner bull is a third of the 10 ring's radius (about 5 px on dart 1).
  ok(bullseyeInInnerBull(BULLSEYE_CX + 5, BULLSEYE_CY, 100, [10]) && !bullseyeInInnerBull(BULLSEYE_CX + 6, BULLSEYE_CY, 100, [10]), "inner bull radius 5 px at full size");
  ok(!bullseyeInInnerBull(BULLSEYE_CX, BULLSEYE_CY, 100, [9, 10]), "no inner bull while the 10 is not the centre ring");

  const runs = Number(process.env.BATCH5_DART_RUNS ?? 20);
  let bullsMax = 0;
  for (const seed of SEEDS(runs, 15_485_863)) {
    const winds = bullseyeWinds(seed);
    for (const balloons of [false, true]) {
      const run = playFlightpath(game, seed, bullseyeCheckpoint, { balloons, init: bullseyeInitRev2(seed, winds) });
      const score = game.score(run.state);
      const raw = encodeBullseyeRun({ seed, claimedScore: score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints as never });
      const replay = replayBullseyeRun(seed, raw, winds, BULLSEYE_REV);
      ok(!replay.flagged && replay.score === score, `seed ${seed}: server replay agrees (${replay.score})`);
      ok(replay.hits.length === 10, `seed ${seed}: all ten darts thrown`);
      if (balloons) ok(replay.pops === BULLSEYE_BALLOON_COUNT, `seed ${seed}: every balloon can be popped (${replay.pops})`);
      else {
        ok(replay.score === 150, `seed ${seed}: a perfect run (inner bulls and tens) scores 150 (total ${replay.total})`);
        bullsMax = Math.max(bullsMax, replay.innerBulls);
      }
      ok(replay.score === 150, `seed ${seed}: ${balloons ? "popping every balloon" : "inner bulls"} still reaches 150`);
    }
  }
  console.log(`  ${runs} seeds: 150 with inner bulls (up to ${bullsMax} a run) and with every balloon popped`);
  ok(INTRO_SCORE.bullseye.includes(`Up to ${roundMaxFor("bullseye")}`), "Flightpath intro states its maximum (150 today, the maximum the bot reaches)");

  // Balance: the same unsteady thrower (aiming at the centre, ignoring balloons) on both rules.
  let state = 7;
  const noise = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return Math.round(((state / 2 ** 32) * 2 - 1) * 160);
  };
  let before = 0, after = 0;
  const N = 40;
  for (const seed of SEEDS(N, 7919)) {
    const winds = bullseyeWinds(seed);
    before += bullseyeGame.score(playFlightpath(bullseyeGame, seed, bullseyeCheckpoint, { balloons: false, init: bullseyeInit(seed, winds), noise }).state);
    after += game.score(playFlightpath(game, seed, bullseyeCheckpoint, { balloons: false, init: bullseyeInitRev2(seed, winds), noise }).state);
  }
  console.log(`  unsteady thrower, ${N} seeds: original mean ${(before / N).toFixed(1)}, rev 2 mean ${(after / N).toFixed(1)}`);
  ok(Math.abs(after - before) / N <= 10, "rev 2 stays within 10 points of the original for the same thrower");
}

/* ================================ 2c. Rally ================================ */
if (want("rally")) {
  section("Rally rallyRev 2 (far-wall targets, bumper from 30 s)");
  const game = rallyGameFor(RALLY_REV);
  // Expansion E9 (docs/expansions/e9.md) then moved Rally on to rallyRev 10; expansion-e9-check covers it.
  ok(playRevOf("rally", generateRally().rallyRev) === RALLY_REV_TUNEF + 7 && RALLY_REV_TUNED === 4 && RALLY_REV_BAND === 3, "new rounds are stamped rallyRev 12 (the arcade scoring standard 29 Oct 2026, rally-standard-check; after rallyRev 11: phone notes 27 Oct 2026, after rallyRev 10: expansion E9, after rallyRev 6: the taller court, arcade-tuning-g1-check; rallyRev 5 = Tuning F second bumper, arcade-tuning-f-check; rallyRev 4 = Tuning B pads in their own halves; rallyRev 3 = rev 2 play on the score bands)");
  ok(rallyGameFor(undefined) === rallyGame && rallyGame.init(5).spots === undefined, "unstamped rounds keep the original game");
  for (const seed of SEEDS(200, 7919)) {
    const a = game.init(seed);
    const legacy = rallyGame.init(seed);
    ok(JSON.stringify(a) === JSON.stringify(game.init(seed)), `seed ${seed}: pads and bumper are seeded`);
    ok(JSON.stringify(a.entries) === JSON.stringify(legacy.entries) && a.vx === legacy.vx && a.vy === legacy.vy, `seed ${seed}: opening and gold schedule drawn exactly as before`);
    for (let k = 0; k + 1 < a.spots!.length; k++) {
      const l0 = rallyTargetLeft(a.spots!, k), l1 = rallyTargetLeft(a.spots!, k + 1);
      ok(Math.abs(l0 - l1) >= RALLY_TARGET_W && l0 >= RALLY_WALL && Math.max(l0, l1) + RALLY_TARGET_W <= RALLY_WORLD_W - RALLY_WALL, `seed ${seed}: live pads ${k}/${k + 1} sit on the wall and never overlap`);
    }
    const b = a.bumper!;
    ok(b.y + RALLY_BUMPER_R + 2 * RALLY_BALL_R + 60 < RALLY_PADDLE_Y && b.x - RALLY_BUMPER_R > RALLY_WALL + 2 * RALLY_BALL_R && b.x + RALLY_BUMPER_R < RALLY_WORLD_W - RALLY_WALL - 2 * RALLY_BALL_R, `seed ${seed}: the bumper leaves room to the walls and above the paddle`);
  }
  // The bumper is not there before 30 s: a tracking run's bounces all come after it appears.
  {
    const run = playRally(game, 77, rallyCheckpoint);
    const events = new Map(run.events.map((e) => [e.t, e]));
    let s = game.init(77);
    while (!game.isOver(s) && s.tick < RALLY_BUMPER_FROM - 1) s = game.step(s, events.get(s.tick + 1) ?? null);
    ok(s.tick === RALLY_BUMPER_FROM - 1 && (s.bounces ?? 0) === 0, "no bumper bounce before 30 s");
  }
  const runs = Number(process.env.BATCH5_RALLY_RUNS ?? 16);
  let reached = 0, targets = 0, bounces = 0;
  for (const seed of SEEDS(runs, 15_485_863)) {
    const run = playRally(game, seed, rallyCheckpoint);
    const score = game.score(run.state);
    const replay = replayRallyRun(seed, encodeRallyRun({ seed, claimedScore: score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints as never }), RALLY_REV);
    ok(!replay.flagged && replay.score === score, `seed ${seed}: server replay agrees (${replay.score})`);
    if (replay.score === 150) reached++;
    targets += replay.targetHits;
    bounces += replay.bounces;
  }
  console.log(`  ${runs} tracking-bot runs: ${reached} reach 150; ${targets} targets struck, ${bounces} bumper bounces`);
  ok(reached > 0, "150 is reachable on rev 2 through the server replay");
  ok(targets > 0 && bounces > 0, "targets and the bumper come into play");
  ok(new RegExp(`up to ${roundMaxFor("rally")}\\b`, "i").test(INTRO_SCORE.rally) && INTRO_SCORE.rally.includes("pink target"), "Rally intro states gold hits, targets and its maximum (score bands)");
}

/* ================================ 2d. Tempo ================================ */
if (want("beat")) {
  section("Tempo beatRev 2 (swipe notes in the second half)");
  const game = beatGameFor(BEAT_REV);
  // Expansion E2 (25 Oct 2026) then moved Tempo on to beatRev 9 (expansion-e2-check), and Joe's phone notes
  // (27 Oct 2026) to beatRev 10 (tempo-ease-check).
  ok(playRevOf("beat", generateBeat().beatRev) === BEAT_REV_TUNEF + 5 && BEAT_REV_TUNEC === 4, "new rounds are stamped beatRev 10 (the phone notes, after expansion E2's beatRev 9 and after beatRev 6: rev 2 play on the score bands; Tuning C curve; Tuning F thinner chart, arcade-tuning-f-check; the taller lanes, arcade-tuning-g2-check)");
  ok(beatGameFor(undefined) === beatGame && beatGame.init(5).chart.swipes === undefined, "unstamped rounds keep the original game");
  let swipeTotal = 0;
  for (const seed of SEEDS(200, 7919)) {
    const a = game.init(seed);
    const legacy = beatGame.init(seed);
    const { ticks, lanes, holds, swipes } = a.chart;
    ok(JSON.stringify({ ticks, lanes, holds }) === JSON.stringify(legacy.chart), `seed ${seed}: the notes are exactly the original chart`);
    ok(JSON.stringify(a) === JSON.stringify(game.init(seed)), `seed ${seed}: swipe notes are seeded`);
    swipes!.forEach((d, i) => {
      if (!d) return;
      ok(ticks[i]! >= BEAT_SWIPE_FROM && holds[i] === 0 && ticks[i - 1] !== ticks[i] && ticks[i + 1] !== ticks[i], `seed ${seed}: swipe note ${i} is a single tap note in the second half`);
    });
    swipeTotal += beatSwipeCount(a);
  }
  console.log(`  ${(swipeTotal / 200).toFixed(1)} swipe notes per chart on average`);
  const runs = Number(process.env.BATCH5_TEMPO_RUNS ?? 8);
  for (const seed of SEEDS(runs, 15_485_863)) {
    const replayOf = (run: ReturnType<typeof playTempo>) =>
      replayBeatRun(seed, encodeBeatRun({ seed, claimedScore: game.score(run.state), events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints as never }), BEAT_REV);
    const perfect = replayOf(playTempo(game, seed, beatCheckpoint));
    ok(!perfect.flagged && perfect.score === 150 && perfect.misses === 0 && perfect.swipesHit === perfect.swipes, `seed ${seed}: every note perfect (swipes included) scores 150 through the server replay`);
    const wrong = replayOf(playTempo(game, seed, beatCheckpoint, { wrongSwipes: true }));
    ok(!wrong.flagged && wrong.misses === wrong.swipes && wrong.swipesHit === 0, `seed ${seed}: a swipe the wrong way is a miss`);
    const tapped = replayOf(playTempo(game, seed, beatCheckpoint, { tapSwipes: true }));
    ok(!tapped.flagged && tapped.misses === tapped.swipes && tapped.swipesHit === 0, `seed ${seed}: a tap does not hit a swipe note`);
  }
  console.log(`  ${runs} perfect runs score 150; wrong-way swipes and taps on swipe notes are misses`);
}

/* ============================ 2e. Rainbow Bridge ============================ */
if (want("inkbridge")) {
  section("Rainbow Bridge inkRev 4 (optional gold stars)");
  const game = inkBridgeGameFor(INK_REV4);
  // Rooms dealt rev 4 play (inkRev 6 to 8) until x200 moved them on to inkRev 10 (ink-x200-check).
  // inkRev 13 (Nov 2026: clovers, ink par, more birds; ink-v13-check) moved rooms on: pinned, the deal before it.
  const wasInk = pinInkPreClover(true);
  ok(playRevOf("inkbridge", generateInkBridge().inkRev) === INK_REV_SPREAD && playRevOf("inkbridge", INK_REV_STRICT) === INK_REV_TUNEC, "rooms deal inkRev 11's play (phone notes, on x200's inkRev 10 world; inkRev 12 re-scores it on the arcade standard); inkRev 8 kept rev 4 play on the score bands (Tuning C curve)");
  pinInkPreClover(wasInk);
  ok(inkBridgeGameFor(INK_REV3).init(5).stars === undefined, "rev-3 rounds have no stars");
  const seeds = SEEDS(Number(process.env.BATCH5_INK_SEEDS ?? 12), 7919);
  for (const seed of seeds) {
    const a = game.init(seed);
    const b = inkBridgeGameFor(INK_REV3).init(seed);
    const strip = (list: typeof a.list) => list.map(({ star: _s, starRef: _r, starT0: _t, ...rest }) => rest);
    ok(JSON.stringify(strip(a.list)) === JSON.stringify(b.list) && a.rng === b.rng, `seed ${seed}: the ten levels are exactly inkRev 3's`);
    const starred = a.list.map((l, i) => (l.star ? i : -1)).filter((i) => i >= 0);
    ok(starred.length === INK_STAR_LEVELS && starred.every((i) => i < 8), `seed ${seed}: four gold stars, all on levels 1-8 (${starred.map((i) => i + 1).join(",")})`);
    const proof = inkStarCheck(seed);
    ok(proof.proved === proof.stars, `seed ${seed}: every star's own line pots the coin through it within the level's ink`);
    ok(proof.offRoute === proof.stars, "every star sits off the easy reference route");
  }
  const runs = Number(process.env.BATCH5_INK_RUNS ?? 4);
  for (const seed of SEEDS(runs, 15_485_863)) {
    const replayOf = (run: ReturnType<typeof playInk>) =>
      replayInkBridgeRun(seed, encodeInkBridgeRun({ seed, claimedScore: game.score(run.state), events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints as never }), INK_REV4);
    const plain = replayOf(playInk(game, seed, inkCheckpoint, { stars: false }));
    ok(!plain.flagged && plain.levels === INK_LEVELS && plain.stars === 0, `seed ${seed}: all ten levels without a single star (stars are never needed)`);
    const full = replayOf(playInk(game, seed, inkCheckpoint, { stars: true }));
    ok(!full.flagged && full.levels === INK_LEVELS && full.stars === INK_STAR_LEVELS && full.score === 150, `seed ${seed}: all levels and stars score 150 through the server replay (${full.score})`);
    const partial = replayOf(playInk(game, seed, inkCheckpoint, { stars: true, failFrom: 9 }));
    ok(!partial.flagged && partial.levels === 9 && partial.score === INK_V4_PARTIAL_MAX, `seed ${seed}: nine levels and every star = the intro's ${INK_V4_PARTIAL_MAX}`);
    const reveal = buildArcadeReveal("inkbridge", partial as never, partial.score);
    ok(reveal && !JSON.stringify(reveal).includes("Standard") && JSON.stringify(reveal).includes("live drawing"), "the reveal explains the level kind in plain words");
  }
  console.log(`  ${seeds.length} seeds: four proved off-route stars each; ${runs} bot runs reach 150, ${INK_V4_PARTIAL_MAX} one level short, all levels without stars`);
  ok(INTRO_SCORE.inkbridge.includes(`up to ${roundMaxFor("inkbridge")}`) && !INTRO_SCORE.inkbridge.includes(`up to ${INK_V4_PARTIAL_MAX}`), "Rainbow Bridge intro states its maximum and no partial cap (score bands)");
}

/* ================================ 2f. Orbit ================================ */
if (want("orbit")) {
  section("Orbit orbitRev 4 (black holes about every ten planets)");
  ok(ORBIT_HOLE_BANK.length >= ORBIT_REV3_BANK.length * 0.6, `most proved courses carry holes (${ORBIT_HOLE_BANK.length} / ${ORBIT_REV3_BANK.length})`);
  {
    let stamped = 0;
    // The fuel meter (orbitRev 14, 1 Nov 2026) moved rooms to its own bank (orbit-fuel-check covers it); pinned, the
    // deal before it is still the feature bank's on orbitRev 13.
    const wasFuel = pinOrbitPreFuel(true);
    for (let k = 0; k < 40; k++) {
      const p = generateOrbit();
      // Score bands (Oct 2026), Tuning A, Tuning F, then taller worlds batch 3: every bank course is stamped orbitRev 8
      // (rev-7 play, swept holes, in the taller view; arcade-tuning-g3-check), with its holes when it has them.
      // The expansion to 200 (docs/expansions/x200-orbit.md) then moved every room to orbitRev 12 on a feature-bank
      // course (all of them carry holes); orbit-expand-check covers it. The arcade scoring standard (29 Oct 2026) then
      // moved rooms to orbitRev 13, orbitRev 12's play on the standard (arcade-standard-check covers it).
      ok(p.orbitRev === ORBIT_REV_STD && ORBIT_REV_TUNED === 6 && p.planets?.length === ORBIT_TOTAL + 1, "new rounds are stamped orbitRev 13 (orbitRev 12's play) and ship their planets");
      if ((p.holes?.length ?? 0) > 0) {
        stamped++;
        ok(p.holes?.length === 3, "courses with holes ship all three");
      }
    }
    pinOrbitPreFuel(wasFuel);
    ok(stamped > 0, `new rounds carry holes when the course has them (${stamped} / 40)`);
  }
  const bankBySeed = new Map(ORBIT_REV3_BANK.map((e) => [e.seed, e]));
  const tap = (t: number) => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
  const play = (start: OrbitRev3State, pick: (s: OrbitRev3State, t: number) => ReturnType<typeof tap> | null) => {
    const events: ReturnType<typeof tap>[] = [];
    const checkpoints: unknown[] = [];
    let s = start;
    while (!orbitRev3Game.isOver(s)) {
      const t = s.tick + 1;
      const ev = pick(s, t);
      if (ev) events.push(ev);
      s = orbitRev3Game.step(s, ev);
      if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
    }
    return { s, events, checkpoints };
  };
  const runs = Number(process.env.BATCH5_ORBIT_RUNS ?? 6);
  for (const entry of ORBIT_HOLE_BANK.filter((_, i) => i % Math.max(1, Math.floor(ORBIT_HOLE_BANK.length / runs)) === 0).slice(0, runs)) {
    const course = bankBySeed.get(entry.seed)!;
    const planets = decodeRev3Planets(course.planets);
    const holes = decodeOrbitHoles(entry.holes);
    const start = () => initRev4From(planets, ORBIT_REV3_WORLD_W, holes);
    ok(holes.length === 3 && holes.every((h, i) => h.from >= [9, 19, 28][i]! && h.from <= [9, 19, 28][i]! + 2 && (h.to - h.from === 5 || h.to - h.from === 6)), `course ${entry.seed}: holes about every ten planets, each 5 or 6 planets on`);
    ok(holes.every((h) => clearSpot(planets, h.x, h.y)), `course ${entry.seed}: every hole sits clear of all orbits and belts`);
    const replay = (events: ReturnType<typeof tap>[], s: OrbitRev3State, checkpoints: unknown[]) =>
      replayOrbitRun(entry.seed, encodeOrbitRun({ seed: entry.seed, claimedScore: orbitRev3Game.score(s), events, endTick: s.tick, checkpoints: checkpoints as never }), ORBIT_REV4, course.planets, entry.holes);
    // The witness takes every hole and reaches the sun, through the server replay.
    const witness = new Set(entry.taps);
    const w = play(start(), (_s, t) => (witness.has(t) ? tap(t) : null));
    const wr = replay(w.events, w.s, w.checkpoints);
    ok(!wr.flagged && wr.finished && wr.jumps === 3 && wr.score === 150, `course ${entry.seed}: all three holes taken and the sun reached = 150 through the server replay (${wr.score})`);
    ok(wr.skipped === holes.reduce((n, h) => n + h.to - h.from - 1, 0), "skipped planets are counted");
    // The course's own planet-by-planet proof still reaches the sun with the holes in place.
    const plainTaps = new Set(course.taps);
    const p = play(start(), (_s, t) => (plainTaps.has(t) ? tap(t) : null));
    ok(p.s.finished === 1 && (p.s.jumps ?? 0) === 0, `course ${entry.seed}: the holes never block the normal route`);
    // Each hole is a narrow, timed approach: 2-6 consecutive release ticks a lap.
    {
      let s = start();
      let checked = 0;
      while (!orbitRev3Game.isOver(s) && checked < 3) {
        const hole = holes.find((h) => h.from === s.cur);
        if (hole && s.flying === 0 && (s.jumps ?? 0) === checked) {
          const kinds: boolean[] = [];
          for (let d = 0; d <= holeDelays(s); d++) kinds.push(holeFork(s, d).kind === "hole");
          let run = 0, best = 0;
          for (const k of kinds) best = Math.max(best, (run = k ? run + 1 : 0));
          ok(best >= HOLE_WINDOW_MIN && best <= HOLE_WINDOW_MAX, `course ${entry.seed}: hole at planet ${hole.from} opens for ${best} release ticks`);
          checked++;
        }
        s = orbitRev3Game.step(s, witness.has(s.tick + 1) ? tap(s.tick + 1) : null);
      }
      ok(checked === 3, "all three hole windows measured");
    }
    // Checkpoint across a jump: set it before the hole, jump, crash, and come back to it.
    {
      const first = holes[0]!;
      let crashed = false;
      let crashAt = -1;
      let cpPlanet = -1;
      const c = play(start(), (s, t) => {
        // A checkpoint on the last planet before the hole planet, on a tick with no witness tap.
        if (s.cur < first.from && s.cur >= first.from - 3 && s.flying === 0 && s.checkpoint < 0 && !witness.has(t)) {
          cpPlanet = s.cur;
          return { t, k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0, d: 0 };
        }
        if (!crashed && s.cur === first.to && s.flying === 0 && (s.jumps ?? 0) === 1) {
          // Find a release that crashes from here.
          if (crashAt < 0) for (let d = 0; d < 200 && crashAt < 0; d++) if (holeFork(s, d).kind === "die") crashAt = t + d;
          if (t === crashAt) {
            crashed = true;
            return tap(t);
          }
          return null;
        }
        if (crashed) return null;
        return witness.has(t) ? tap(t) : null;
      });
      const cr = replay(c.events, c.s, c.checkpoints);
      ok(cpPlanet >= 0 && !cr.flagged && cr.checkpoint === cpPlanet && cr.passed === first.to && cr.respawned && !cr.finished, `course ${entry.seed}: a crash after the jump returns to the checkpoint (planet ${cpPlanet}) and keeps the skipped planets (best ${cr.passed})`);
    }
  }
  console.log(`  ${runs} courses: witness runs take all three holes and score 150; normal routes unaffected; checkpoints work across a jump`);
  ok(INTRO_SCORE.orbit.includes(`up to ${roundMaxFor("orbit")}`) && !/117/.test(INTRO_SCORE.orbit), "Orbit intro: its maximum for the sun, no partial cap (score bands)");
}

/* ============================ 3. Intro text rules ============================ */
section("intro text");
const BATCH = ["bintoss", "bullseye", "rally", "beat", "inkbridge", "orbit"] as const;
for (const type of BATCH.filter(want)) {
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines (${intro.length})`);
  // One phone line each at 375 px, as in batch 2 (READY fully visible at 375×667).
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 46, `${type}: intro HOW line fits one line: ${line.action} ${line.detail}`);
  ok(help.goal.length <= 34, `${type}: intro GOAL fits one line: ${help.goal}`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro SCORE within 90 characters`);
}
const words = (type: (typeof BATCH)[number]) => JSON.stringify(PUZZLE_INSTRUCTIONS[type]) + INTRO_SCORE[type];
if (want("bintoss")) ok(!/\bbins?\b/i.test(words("bintoss")), 'Swish says "bucket", never "bin"');
if (want("bullseye")) ok(!/\barrows?\b/i.test(words("bullseye")), 'Flightpath says "darts", never "arrows"');
if (want("inkbridge")) ok(!/\brounds?\b/i.test(words("inkbridge")), 'Rainbow Bridge says "levels", never "rounds"');

console.log(`arcade batch 5: ${checks} checks passed`);
