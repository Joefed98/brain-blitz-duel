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

/* ============================ 3. Intro text rules ============================ */
section("intro text");
for (const type of (["skyline", "tilt"] as const).filter(want)) {
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines (${intro.length})`);
  // One phone line each at 375 px (as batch 2: READY fully visible at 375×667 with these lengths).
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 46, `${type}: intro HOW line fits one line: ${line.action} ${line.detail}`);
  ok(help.goal.length <= 34, `${type}: intro GOAL fits one line: ${help.goal}`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro SCORE within 90 characters (${INTRO_SCORE[type].length})`);
}
if (want("skyline")) ok(/up to 150/i.test(INTRO_SCORE.skyline), "High Rise intro states the 150 maximum the bot reaches");
if (want("tilt")) ok(INTRO_SCORE.tilt.includes(`up to ${TILT_V2_PARTIAL_MAX}`) && /up to 150/.test(INTRO_SCORE.tilt), "Tilt intro states the real partial maximum and the 150");

console.log(`arcade batch 4: ${checks} checks passed`);
