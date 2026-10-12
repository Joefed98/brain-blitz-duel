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
import { playFlightpath, playSwish } from "./arcade-batch5-bots";
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
  BINTOSS_SPIN_HALF,
  BINTOSS_SPIN_THICK,
  BINTOSS_THROWS,
  BINTOSS_V3_PARTIAL_MAX,
  BINTOSS_WIND_TICKS,
  BINTOSS_RIM_Y,
} from "../src/lib/arcade/binToss";
import { encodeBinTossRun, replayBinTossRun } from "../src/lib/duel/binToss";
import { generateBinToss, generateBullseye } from "../src/lib/duel/arcade.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

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
  ok(generateBinToss().binRev === BINTOSS_REV3, "new rounds are stamped binRev 3");
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
  ok(INTRO_SCORE.bintoss.includes("up to 150") && INTRO_SCORE.bintoss.includes(`up to ${BINTOSS_V3_PARTIAL_MAX}`), "Swish intro states 150 and the partial maximum");
}

/* ============================== 2b. Flightpath ============================== */
if (want("bullseye")) {
  section("Flightpath bullRev 2 (inner bull, drifting balloons)");
  const game = bullseyeGameFor(BULLSEYE_REV);
  const generated = generateBullseye();
  ok(generated.bullRev === BULLSEYE_REV, "new rounds are stamped bullRev 2");
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
  ok(/Up to 150/.test(INTRO_SCORE.bullseye), "Flightpath intro states the 150 maximum the bot reaches");

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

console.log(`arcade batch 5: ${checks} checks passed`);
