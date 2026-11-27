/**
 * cross-ladder-check (D5, 23 Nov 2026; no browser, about a minute; `CHECKS_FULL=1` re-plays the proof walker on every
 * dealt seed): Spacewalk crossRev 14, the traffic ladder from the first crossing (docs/arcade-standard/cross.md
 * "Levels (D5, 23 Nov 2026)").
 *
 *  1. Older rounds: every run recorded before crossRev 14 (scripts/fixtures/cross-rev14-legacy.json.gz: crossRev 13 at
 *     Easy, Normal, Hard and Expert, crossRev 12) grades exactly as recorded (score, verdict, extra).
 *  2. The stamp: Easy, Hard and Expert deal crossRev 14 on a seed of the level's proved list; Normal deals crossRev 13 as
 *     before, and a Normal deal is byte for byte the deal with no level; with `preRetro` pinned every level deals
 *     crossRev 12; LIVE_BANDS still names crossRev 13 (Normal's).
 *  3. The levels as dealt: the registry is CROSS_LEVELS_V14 row for row; crossRev 13's table is unchanged; every crossing
 *     of a dealt seed is at exactly its row's density (no step back toward 12) and proved passable at it; the lives, the
 *     hit cost and the three parts' full lines are the row's; a level's Normal-stamped round plays crossRev 13.
 *  4. The deal: crossLevelDeals.server.ts is exactly what scripts/cross-level-deal.ts builds from the stored witnesses;
 *     every witness scores exactly 200 through the server replay and through gradeAnswer on its dealt puzzle; the proof
 *     walker re-played on a sample (every seed with CHECKS_FULL=1) walks exactly the witness, its swipes at least 0.15 s
 *     apart; every dealt seed is reachable.
 *  5. The ladder: the recorded table (scripts/fixtures/d5-ladder-cross.json.gz, 96 deals a level), and a
 *     sample of it re-played on today's code.
 *
 *   bun scripts/cross-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { CROSS_REV_DENSE, CROSS_REV_EXPAND, CROSS_REV_KEEP, CROSS_REV_LIGHT, crossDenseCourses, crossGameFor, crossHitCostOf, crossLivesOf, crossStdDensityOf, type CrossState } from "../src/lib/arcade/cross";
import { CROSS_LEVELS, CROSS_LEVELS_V14 } from "../src/lib/arcade/retroLevels";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { pinPreRetro } from "../src/lib/duel/arcade.server";
import { CROSS_LEVEL_DEALS, crossLevelDealSeed } from "../src/lib/duel/crossLevelDeals.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { replaySample } from "./d5-ladder-lib";
import { stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";
import { CROSS_DEAL_FILE, CROSS_DEAL_LEVELS, checkCrossWitnesses, crossDealSource, proofEventsAt, proveCrossWitness, readCrossWitnesses } from "./cross-level-deal";
import { CROSS_REV14_LEGACY } from "./cross-rev14-legacy-record";
import { roomSeed } from "./arcade-skill-bands/games";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);
const FULL = process.env.CHECKS_FULL === "1";
const deal = (level: Level | null, seed: number) => withSeededRandom(seed, () => generatePuzzle("cross", { bankSeed: seed, ...(level ? { level } : {}) })) as unknown as { seed: number; crossRev?: number; level?: string };
/** Swipes at least this many ticks apart (Joe's 0.15 s to move). */
const MOVE_TICKS = 9;

section("1. Older rounds grade exactly as recorded (crossRev 13 at every level, crossRev 12)");
{
  const legacy = (JSON.parse(gunzipSync(readFileSync(CROSS_REV14_LEGACY)).toString()) as { cases: D5LegacyCase[] }).cases;
  ok(legacy.length >= 80, `the legacy fixture holds ${legacy.length} runs`);
  for (const level of ["easy", "normal", "hard", "expert"]) ok(legacy.some((c) => c.level === level && (c.puzzle as unknown as { crossRev: number }).crossRev === CROSS_REV_LIGHT), `crossRev 13 ${level} runs recorded`);
  ok(legacy.some((c) => (c.puzzle as unknown as { crossRev: number }).crossRev === CROSS_REV_KEEP), "crossRev 12 runs recorded");
  let same = 0;
  for (const c of legacy) {
    const g = gradeAnswer(c.puzzle, c.answer, 0);
    if (g.score === c.score && g.isCorrect === c.isCorrect && stableExtra(g.extra) === c.extra) same++;
    else ok(false, `${c.level} ${c.who}: ${c.score} → ${g.score}${stableExtra(g.extra) === c.extra ? "" : " (extra differs)"}`);
  }
  ok(same === legacy.length, `${same} of ${legacy.length} legacy runs grade exactly as recorded`);
}

section("2. The stamp");
{
  for (const level of CROSS_DEAL_LEVELS) {
    for (const s of [3, 77, 4242]) {
      const p = deal(level, s);
      ok(p.crossRev === CROSS_REV_DENSE && p.level === level, `${level} seed ${s}: deals crossRev 14 at ${level} (${p.crossRev}, ${p.level})`);
      ok(CROSS_LEVEL_DEALS[level].includes(p.seed), `${level} seed ${s}: the seed is on ${level}'s proved list`);
    }
  }
  for (const s of [7, 99, 4242]) {
    ok(deal(null, s).crossRev === CROSS_REV_LIGHT, `Normal seed ${s}: deals crossRev 13 as before`);
    ok(JSON.stringify(deal(null, s)) === JSON.stringify(deal("normal", s)), `seed ${s}: a Normal deal is the deal with no level`);
  }
  const was = pinPreRetro(true);
  ok(deal("hard", 11).crossRev === CROSS_REV_KEEP && deal(null, 11).crossRev === CROSS_REV_KEEP, "preRetro pinned: every level deals crossRev 12");
  pinPreRetro(was);
  ok(LIVE_BANDS.cross.rev === CROSS_REV_LIGHT, "LIVE_BANDS names Normal's crossRev 13");
  for (const level of CROSS_DEAL_LEVELS) {
    ok(CROSS_LEVEL_DEALS[level].length >= 60, `${level}: ${CROSS_LEVEL_DEALS[level].length} proved seeds (at least 60)`);
    const list = CROSS_LEVEL_DEALS[level];
    ok(list.every((seed, i) => crossLevelDealSeed(level, i) === seed), `${level}: every proved seed is dealt by some room seed`);
  }
}

section("3. The levels as dealt");
{
  for (const level of CROSS_DEAL_LEVELS) {
    const reg = GAME_LEVELS.cross?.levels[level]?.settings;
    ok(JSON.stringify(reg) === JSON.stringify(CROSS_LEVELS_V14[level]), `${level}: the registry is CROSS_LEVELS_V14's row (${JSON.stringify(reg)})`);
  }
  ok(
    JSON.stringify(CROSS_LEVELS) ===
      JSON.stringify({
        easy: { density: [5, 6, 6, 7, 7, 8, 8, 9, 9, 10], lives: 4, hitCost: 10, fullAt: 70 },
        hard: { density: [8, 10, 12, 13, 14, 15, 15, 15, 15, 15], lives: 3, hitCost: 15, fullAt: 76 },
        expert: { density: [10, 12, 14, 15, 16, 17, 18, 18, 18, 18], lives: 2, hitCost: 20, fullAt: 80 },
      }),
    "crossRev 13's table is unchanged (stored level rounds replay on it)",
  );
  const lv = CROSS_LEVELS_V14;
  ok(lv.easy.density[0]! < 6 && lv.hard.density[0]! > 6 && lv.expert.density[0]! > lv.hard.density[0]!, `the lever: the first crossing's traffic ${lv.easy.density[0]} / 6 / ${lv.hard.density[0]} / ${lv.expert.density[0]} twelfths`);
  ok(lv.easy.lives > 3 && lv.hard.lives === 3 && lv.expert.lives < 3, `lives ${lv.easy.lives} / 3 / ${lv.hard.lives} / ${lv.expert.lives}`);
  for (const level of CROSS_DEAL_LEVELS) {
    const row = lv[level];
    for (const seed of CROSS_LEVEL_DEALS[level].slice(0, FULL ? undefined : 3)) {
      const state = crossGameFor(CROSS_REV_DENSE, level).init(seed) as CrossState;
      ok(state.lv === row && crossLivesOf(state) === row.lives && state.lives === row.lives && crossHitCostOf(state) === row.hitCost && state.dense === 1, `${level} ${seed}: the row's lives and hit cost`);
      // Each crossing is crossRev 9's own for the seed at exactly the row's density for it (never stepped back).
      const rev9 = crossGameFor(CROSS_REV_EXPAND, null).init(seed) as CrossState;
      const got = state.courses.map((c, k) => crossStdDensityOf(c, rev9.courses[k]!));
      const want = state.courses.map((_, k) => row.density[Math.min(k, row.density.length - 1)]!);
      ok(JSON.stringify(got) === JSON.stringify(want), `${level} ${seed}: every crossing at exactly its row's density (${got.join(" ")})`);
      ok(JSON.stringify(crossDenseCourses(seed, row)) === JSON.stringify(state.courses), `${level} ${seed}: the deal's proof reads the courses the run plays`);
    }
  }
  // A Normal round mis-stamped crossRev 14 plays crossRev 13's Normal.
  ok(JSON.stringify((crossGameFor(CROSS_REV_DENSE, null).init(5) as CrossState).courses) === JSON.stringify((crossGameFor(CROSS_REV_LIGHT, null).init(5) as CrossState).courses), "crossRev 14 at Normal plays crossRev 13's Normal");
}

section("4. The deal: every dealt seed's proof run scores 200");
{
  const w = readCrossWitnesses();
  ok(readFileSync(CROSS_DEAL_FILE, "utf8") === crossDealSource(w), "crossLevelDeals.server.ts is exactly what cross-level-deal.ts builds from the witnesses");
  for (const level of CROSS_DEAL_LEVELS) ok(JSON.stringify((w.levels[level]?.witnesses ?? []).map((x) => x.seed)) === JSON.stringify(CROSS_LEVEL_DEALS[level]), `${level}: one witness a dealt seed, in order`);
  // Every witness replays to 200 (and its crossings re-proved) at full depth; a sample at default depth (the proofs are slow).
  const bad = checkCrossWitnesses(w, FULL ? undefined : (_level, i) => i % 10 === 0);
  ok(bad.length === 0, `the stored witnesses score exactly 200 through the server replay, every crossing proved (${bad.slice(0, 3).join("; ") || "all"})`);
  for (const level of CROSS_DEAL_LEVELS) {
    const list = w.levels[level]?.witnesses ?? [];
    for (const x of list) {
      const ts = x.events.map((e) => e.t);
      if (ts.slice(1).some((t, i) => t - ts[i]! < MOVE_TICKS)) ok(false, `${level} ${x.seed}: a swipe sooner than 0.15 s after the last`);
    }
    const x = list[0];
    if (x) {
      const puzzle = { type: "cross", seed: x.seed, crossRev: CROSS_REV_DENSE, level } as unknown as PuzzleData;
      const g = gradeAnswer(puzzle, proveCrossWitness(x.seed, level, x.events).raw, 0);
      ok(g.score === 200, `${level} ${x.seed}: the proof run scores 200 through gradeAnswer (${g.score})`);
    }
    const sample = FULL ? list : [list[Math.floor(list.length / 2)]!].filter(Boolean);
    let alike = 0;
    for (const y of sample) if (JSON.stringify(await proofEventsAt(y.seed, level)) === JSON.stringify(y.events)) alike++;
    ok(sample.length > 0 && alike === sample.length, `${level}: the proof walker re-plays ${alike} of ${sample.length} sampled witnesses exactly`);
  }
  void roomSeed;
}

section("5. The ladder (the recorded 96 deals a level, and a live re-play sample)");
{
  try {
    // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
    // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
    for (const [cond, label] of await replaySample("cross", 2)) ok(cond, label);
  } catch (e) {
    ok(false, `the recorded ladder (scripts/fixtures/d5-ladder-cross.json.gz) reads: ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log(`\n${failures.length ? "FAIL" : "PASS"}: ${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
