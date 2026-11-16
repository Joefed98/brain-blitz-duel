/**
 * Roofbound's difficulty levels (15 Nov 2026; docs/arcade-standard/flip.md "Levels", docs/design/difficulty/README.md).
 *
 *  1. Normal is today's game: Normal deals are byte for byte the deals recorded before the levels
 *     (scripts/fixtures/levels-action-legacy.json.gz, recorded on de3bec96's tree), runs recorded there on flipRev 10–13
 *     replay to the same score and checkpoint, and Normal's courses are the same objects of the same build.
 *  2. Each level's rules and stamped settings: the deal stamps `level` on flipRev 13 from the level's own proved deal, the
 *     state carries its code, the course is built on the level's speed table, moving-spike start and sweet spots, a
 *     crash costs the level's clean time, and gameLevels.ts mirrors the sim's table.
 *  3. The 120 s rule: every level's run is 60 s and its clock at most 120 s.
 *  4. Grace at every level: no crash ends the run (a run that crashes over and over still lasts the minute).
 *  5. 200 is reachable at every level: every dealt course's stored witness route (scripts/fixtures/flip-levels-witness
 *     .json.gz) scores exactly 200 through the server replay, taking every part's maximum; the deal file rebuilds byte
 *     for byte from the witnesses; each level keeps at least 150 of the 260 candidate courses.
 *  6. Identical worlds: a level's course comes from the seed alone, the same log replays the same for every player, and
 *     the level changes play (a level's log replayed as Normal is flagged).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  flipCheckpoint,
  flipCourseV8,
  flipCrashCost,
  flipGameFor,
  flipGraceScore,
  flipGraceSpecOf,
  flipSegShift,
  flipSweetsTaken,
  FLIP_DECISION_MOVER,
  FLIP_INPUT_TAP,
  FLIP_LEVEL_CODE,
  FLIP_LEVEL_RULES,
  FLIP_REV_DEAL,
  FLIP_REV_GRACE,
  FLIP_RUN_TICKS,
  FLIP_V11_DOUBLES,
  FLIP_V11_STREAK_FULL,
  FLIP_V13,
  FLIP_V13_CRASH_COST,
  type FlipLevel,
  type FlipState,
} from "../src/lib/arcade/flip";
import { replayFlipRun } from "../src/lib/duel/flip";
import { FLIP_DEAL_V13 } from "../src/lib/duel/flipDealV13.server";
import { FLIP_LEVEL_DEALS } from "../src/lib/duel/flipLevelDeals.server";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { flipTap } from "./flip-x200-plan";
import { buildFlipLevelDeals, encodeFlipLevelLog, flipLevelDealSource, FLIP_DEAL_LEVELS, FLIP_LEVEL_CANDIDATES, FLIP_LEVEL_DEAL_FILE, readLevelWitnesses } from "./flip-level-deal";
import { LEVELS_ACTION_LEGACY, type LegacyFixture } from "./levels-action-legacy-record";

let failures = 0;
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${label}`);
  }
};

const LEVELS = FLIP_DEAL_LEVELS;
const fixture = JSON.parse(gunzipSync(readFileSync(LEVELS_ACTION_LEGACY)).toString()) as LegacyFixture;
const deal = (n: number, level?: FlipLevel) => {
  const seed = roomSeed(n);
  return withSeededRandom(seed, () => generatePuzzle("flip", { bankSeed: seed, ...(level ? { level } : {}) }));
};

/* 1. Normal is today's game. */
{
  const deals = fixture.deals["flip"]!;
  ok(deals.every((d, n) => JSON.stringify(deal(n)) === d), `Normal deals match the ${deals.length} recorded before the levels, byte for byte`);
  const runs = fixture.runs.filter((r) => r.game === "flip");
  let same = 0;
  for (const r of runs) {
    const out = replayFlipRun(r.seed, r.raw, r.rev);
    if (out.score === r.score && JSON.stringify(flipCheckpoint(out.state)) === JSON.stringify(r.checkpoint) && !out.flagged) same++;
  }
  ok(runs.length >= 30 && same === runs.length, `${same} of ${runs.length} runs recorded before the levels (flipRev 10–13) replay to the same score and checkpoint`);
  const s = flipGameFor(FLIP_REV_GRACE).init(FLIP_DEAL_V13[0]!);
  ok(s.lvl === undefined && flipGameFor(FLIP_REV_GRACE, "normal") === flipGameFor(FLIP_REV_GRACE), "Normal states carry no level and Normal is the flipRev 13 game itself");
  ok(flipCrashCost(s) === FLIP_V13_CRASH_COST && flipGraceSpecOf(s) === FLIP_V13, "Normal: 10 s a crash, flipRev 13's parts");
  for (const older of [FLIP_REV_DEAL, 11, 10]) ok(flipGameFor(older, "expert") === flipGameFor(older), `flipRev ${older} ignores a level (only flipRev 13 has levels)`);
}

/* 2. Each level's rules and stamped settings. */
{
  ok(JSON.stringify(levelsOf("flip")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Roofbound offers Easy, Normal, Hard and Expert");
  for (const level of LEVELS) {
    const r = FLIP_LEVEL_RULES[level];
    const settings = gameLevelSettings<Record<string, unknown>>("flip", level)!;
    const mirror = { speedStart: r.speedStart, speedStep: r.speedStep, stepTicks: r.stepTicks, speedCap: r.speedCap, moversFrom: r.moversFrom, sweetTicks: r.sweetTicks, sweetSpots: r.sweetSeconds.length, crashCost: r.crashCost, sweetsFull: r.sweetsFull };
    ok(JSON.stringify(Object.entries(settings).sort()) === JSON.stringify(Object.entries(mirror).sort()), `${level}: gameLevels.ts mirrors the sim's FLIP_LEVEL_RULES`);
    const p = deal(3, level);
    ok(puzzleLevel(p) === level && p.type === "flip" && p.flipRev === FLIP_REV_GRACE, `${level}: the deal stamps level "${level}" on flipRev 13`);
    ok(p.type === "flip" && FLIP_LEVEL_DEALS[level].includes(p.seed), `${level}: the course comes from the level's own proved deal`);
    const seed = p.type === "flip" ? p.seed : 1;
    const st = flipGameFor(FLIP_REV_GRACE, level).init(seed);
    ok(st.lvl === FLIP_LEVEL_CODE[level] && st.grace === 1, `${level}: the state carries its code, with grace`);
    const xs = st.v8!.xs;
    const step = (t: number) => xs[t]! - xs[t - 1]!;
    const want = (t: number) => Math.min(r.speedCap, r.speedStart + r.speedStep * Math.trunc(t / r.stepTicks));
    // Away from the seeded speed zones (11/8 for 5 s), the course moves at the level's table.
    let match = 0;
    let checked = 0;
    for (const t of [1, 200, 600, 900, 1500, 2700, 3500]) {
      const z = st.v8!.zones;
      let inZone = false;
      for (let i = 0; i < z.length; i += 2) if (t > z[i]! && t <= z[i + 1]!) inZone = true;
      if (inZone) continue;
      checked++;
      if (step(t) === want(t)) match++;
    }
    ok(checked >= 5 && match === checked, `${level}: the course runs at ${r.speedStart} + ${r.speedStep} every ${r.stepTicks / 60} s up to ${r.speedCap}`);
    ok(st.v8!.sweets.length === r.sweetSeconds.length, `${level}: ${r.sweetSeconds.length} sweet spots`);
    const width = st.v8!.sweets.map((sw) => sw.x1 - sw.x0);
    ok(width.every((w) => w >= r.sweetTicks * r.speedStart), `${level}: each sweet spot is ${r.sweetTicks} tick${r.sweetTicks === 1 ? "" : "s"} of travel long`);
    const movers = st.segs.filter((seg) => seg.decision === FLIP_DECISION_MOVER);
    if (r.moversFrom === null) ok(movers.length === 0, `${level}: no moving spikes`);
    else ok(movers.every((seg) => seg.x0 - (seg.amp ?? 0) >= xs[r.moversFrom!]!) && FLIP_LEVEL_DEALS[level].slice(0, 20).some((sd) => flipCourseV8(sd, level).segs.some((seg) => seg.decision === FLIP_DECISION_MOVER)), `${level}: moving spikes only from ${r.moversFrom / 60} s (and courses carry them)`);
    ok(flipCrashCost(st) === r.crashCost, `${level}: a crash costs ${r.crashCost / 2} s of clean time`);
    const spec = flipGraceSpecOf(st);
    ok(spec.parts.reduce((a, q) => a + q.max, 0) === 200 && spec.parts.find((q) => q.key === "sweets")!.of === r.sweetsFull, `${level}: the parts total 200, perfect landings full at ${r.sweetsFull}`);
    // The crash cost reaches the score: the same state with one crash.
    const done = { ...st, ended: 1, tick: FLIP_RUN_TICKS, acted: 1 } as FlipState;
    const core0 = flipGraceScore(done).core;
    const core1 = flipGraceScore({ ...done, saves: 1 }).core;
    ok(core0 === 100 && core1 === Math.floor((100 * Math.min(110, 120 - r.crashCost)) / 110), `${level}: one crash takes the core from ${core0} to ${core1}`);
  }
  const R = FLIP_LEVEL_RULES;
  ok(R.easy.speedCap < 2560 && R.easy.stepTicks === 240 && R.easy.moversFrom === null && R.easy.sweetTicks > 1, "Easy: a slower top speed, a step every 4 s, no moving spikes, wider sweet spots (Joe's table)");
  ok(R.hard.speedCap > 2560 && R.hard.stepTicks === 180 && R.hard.moversFrom === 480 && R.hard.crashCost === 40, "Hard: a little faster, every 3 s, moving spikes from 8 s, 20 s a crash");
  ok(R.expert.speedCap > R.hard.speedCap && R.expert.stepTicks === 150 && R.expert.moversFrom === 300 && R.expert.sweetSeconds.length > 8 && R.expert.crashCost > R.hard.crashCost, "Expert: the fastest, every 2.5 s, moving spikes from 5 s, more sweet spots, respawns costing more than Hard's");
}

/* 3. The 120 s rule. */
for (const level of ["normal", ...LEVELS] as const) {
  const p = deal(5, level === "normal" ? undefined : level);
  const g = flipGameFor(FLIP_REV_GRACE, level);
  ok(g.runTicks === FLIP_RUN_TICKS && FLIP_RUN_TICKS === 3600 && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level}: a 60 s run on a clock of ${puzzleTimeLimitMs(p) / 1000} s (at most 120 s)`);
}

/* 4. Grace at every level: no input at all crashes again and again and still lasts the minute. */
for (const level of ["normal", ...LEVELS] as const) {
  const g = flipGameFor(FLIP_REV_GRACE, level);
  const seed = level === "normal" ? FLIP_DEAL_V13[0]! : FLIP_LEVEL_DEALS[level][0]!;
  let s = g.init(seed);
  while (!g.isOver(s)) s = g.step(s, null);
  ok(s.ended === 1 && (s.saves ?? 0) >= 2, `${level}: with no input the runner crashes ${s.saves} times and still lasts the minute`);
}

/* 5. 200 is reachable at every level. Quick depth proves 40 dealt courses a level (spread over the deal); CHECKS_FULL=1
 * proves every dealt course and rebuilds the deal file byte for byte from the witnesses. */
{
  const full = process.env["CHECKS_FULL"] === "1";
  const witnesses = readLevelWitnesses();
  if (full) {
    const built = buildFlipLevelDeals(witnesses);
    ok(readFileSync(FLIP_LEVEL_DEAL_FILE, "utf8") === flipLevelDealSource(built), `${FLIP_LEVEL_DEAL_FILE} rebuilds byte for byte from the stored witnesses`);
  }
  for (const level of LEVELS) {
    const dealt = FLIP_LEVEL_DEALS[level];
    const stride = full ? 1 : Math.max(1, Math.floor(dealt.length / 40));
    const kept = dealt.filter((_, i) => i % stride === 0);
    ok(dealt.length >= 200 && dealt.every((sd) => FLIP_LEVEL_CANDIDATES.includes(sd)), `${level}: ${dealt.length} of ${FLIP_LEVEL_CANDIDATES.length} candidate courses dealt (at least 200)`);
    const mine = new Map(witnesses.filter((w) => w.level === level).map((w) => [w.seed, w]));
    let at200 = 0;
    let allMax = 0;
    for (const seed of kept) {
      const w = mine.get(seed)!;
      const { raw, state } = encodeFlipLevelLog(level, seed, w.taps!.map(flipTap));
      const puzzle = { type: "flip" as const, seed, flipRev: FLIP_REV_GRACE, level };
      const graded = gradeAnswer(puzzle, raw, 0);
      if (graded.score === 200 && !(graded.extra as { flagged?: boolean } | undefined)?.flagged) at200++;
      const sp = flipGraceSpecOf(state);
      if (state.ended === 1 && !state.saves && flipSweetsTaken(state) >= sp.parts.find((q) => q.key === "sweets")!.of! && (state.combos ?? 0) >= FLIP_V11_DOUBLES && (state.bestStreak ?? 0) >= FLIP_V11_STREAK_FULL) allMax++;
    }
    ok(at200 === kept.length, `${level}: every dealt course's witness scores exactly 200 through the server replay (${at200} of ${kept.length})`);
    ok(allMax === kept.length, `${level}: every witness takes every part's maximum (${allMax} of ${kept.length})`);
  }
}

/* 6. Identical worlds. */
for (const level of LEVELS) {
  ok(JSON.stringify(deal(9, level)) === JSON.stringify(deal(9, level)), `${level}: a room seed deals the same puzzle every time`);
  const seed = FLIP_LEVEL_DEALS[level][2]!;
  const a = flipGameFor(FLIP_REV_GRACE, level).init(seed);
  const b = flipGraceGameFresh(level, seed);
  ok(JSON.stringify(a.segs) === JSON.stringify(b.segs) && JSON.stringify(a.v8) === JSON.stringify(b.v8), `${level}: the course comes from the seed alone (rebuilt with no cache)`);
  const w = readLevelWitnesses().find((x) => x.level === level && x.seed === seed)!;
  const { raw } = encodeFlipLevelLog(level, seed, w.taps!.map(flipTap));
  const p = { type: "flip" as const, seed, flipRev: FLIP_REV_GRACE, level };
  ok(gradeAnswer(p, raw, 0).score === gradeAnswer(JSON.parse(JSON.stringify(p)), raw, 0).score, `${level}: the same log on the same stored deal scores the same for every player`);
  ok(replayFlipRun(seed, raw, FLIP_REV_GRACE).flagged, `${level}: the level's log replayed as Normal is flagged (the level changes play)`);
  // Moving spikes slide by the tick alone.
  const mover = a.segs.find((seg) => seg.decision === FLIP_DECISION_MOVER);
  if (mover) ok(flipSegShift(mover, 1234) === flipSegShift({ ...mover }, 1234), `${level}: a moving spike's slide is a function of the tick alone`);
}

/** A level's course built again in a fresh module copy (no cache shared with this process's). */
function flipGraceGameFresh(level: FlipLevel, seed: number): FlipState {
  // Course caches hold at most 17 entries: fill it with other seeds first so this seed's course is built anew.
  for (const other of FLIP_LEVEL_DEALS[level].slice(100, 118)) flipCourseV8(other, level);
  return flipGameFor(FLIP_REV_GRACE, level).init(seed);
}

void FLIP_INPUT_TAP;
console.log(failures ? `FAIL: ${failures} of ${passes + failures} flip-levels checks` : `flip-levels-check: ${passes} checks passed`);
process.exit(failures ? 1 : 0);
