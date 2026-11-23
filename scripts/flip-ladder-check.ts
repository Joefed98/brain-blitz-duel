/**
 * flip-ladder-check (D5, 23 Nov 2026; docs/arcade-standard/flip.md "Levels (D5, 23 Nov 2026)"): Roofbound's difficulty
 * ladder on flipRev 14, the running speed. Normal stays flipRev 13.
 *
 *  1. flipRev 13 is untouched: the 114 runs recorded on it at every level before flipRev 14
 *     (scripts/fixtures/flip-ladder-legacy.json.gz, scripts/flip-ladder-legacy-record.ts) regrade through gradeAnswer to
 *     the same score, verdict, stored extra and final checkpoint.
 *  2. The stamp and the pin: Easy, Hard and Expert deal flipRev 14 (the level stamped) from the proved deal; Normal deals
 *     flipRev 13 exactly as before (the same deal with the pin on, and the deal with no level asked); flipPreLadder deals
 *     flipRev 13's levels from their old proved deal; the pin is DEAL_PINS' entry.
 *  3. The level rules as dealt: each level's course runs at its own start speed, step and top speed, with moving spikes
 *     from its own second (none on Easy), its sweet spots (10 ticks wide on Easy), its crash cost and its own full lines
 *     (200 in all); the registry (GAME_LEVELS.flip) mirrors FLIP_V14_LEVEL_RULES; a flipRev 14 state carries the ladder's
 *     mark, so its checksum is not flipRev 13's; grace at every level; the 120 s rule.
 *  4. The proved deal: every course dealt at a level has a witness held to the human limits (the flawless skill-band bot
 *     under HUMAN_LIMITS, its taps at least 0.15 s apart) that scores exactly 200 through the server replay; a sample of
 *     the witnesses is re-played here and is exactly that bot's run. CHECKS_FULL=1: every witness, and
 *     src/lib/duel/flipLadderDeals.server.ts rebuilds byte for byte (scripts/flip-ladder-deal.ts).
 *  5. Joe's ladder test on the recorded ladder (scripts/fixtures/d5-ladder-flip.json.gz, 96 deals a level, both players),
 *     and the table is today's game (two runs a level and player re-played live score exactly as recorded).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  flipCheckpoint,
  flipCourseV8,
  flipCrashCost,
  flipGameFor,
  flipGraceGame,
  flipGraceScore,
  flipGraceSpecOf,
  flipLadderGameAt,
  FLIP_DECISION_MOVER,
  FLIP_LEVEL_CODE,
  FLIP_LEVEL_RULES,
  FLIP_REV_GRACE,
  FLIP_REV_LADDER,
  FLIP_RUN_TICKS,
  FLIP_V14_LEVEL_RULES,
  type FlipLevel,
  type FlipState,
} from "../src/lib/arcade/flip";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { pinFlipPreLadder } from "../src/lib/duel/arcade.server";
import { DEAL_PINS } from "../src/lib/duel/dealEra";
import { FLIP_LADDER_DEALS } from "../src/lib/duel/flipLadderDeals.server";
import { FLIP_LEVEL_DEALS } from "../src/lib/duel/flipLevelDeals.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { FLIP_LADDER_LEGACY, flipFinalCheckpoint, stableFlipExtra, type FlipLegacyFixture } from "./flip-ladder-legacy-record";
import { buildFlipLadderDeals, flipLadderDealSource, flipLadderPuzzle, FLIP_LADDER_CANDIDATES, FLIP_LADDER_DEAL_FILE, FLIP_LADDER_LEVELS, gradeFlipWitness, playFlipWitness, readLadderWitnesses } from "./flip-ladder-deal";

let failures = 0;
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${label}`);
  }
};
const section = (s: string) => console.log(s);
const full = process.env["CHECKS_FULL"] === "1";
const LEVELS = FLIP_LADDER_LEVELS;
const loose = (p: PuzzleData) => p as unknown as { seed: number; flipRev?: number; level?: string };
const t0 = Date.now();

section("1. flipRev 13 is untouched");
{
  const fixture = JSON.parse(gunzipSync(readFileSync(FLIP_LADDER_LEGACY)).toString()) as FlipLegacyFixture;
  ok(fixture.runs.length === 114 && (["normal", "easy", "hard", "expert"] as const).every((l) => fixture.runs.filter((r) => r.level === l).length >= 24), "the legacy fixture holds 114 flipRev 13 runs, at least 24 at each level");
  let same = 0;
  const bad: string[] = [];
  for (const r of fixture.runs) {
    const puzzle = JSON.parse(r.puzzle) as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    if (loose(puzzle).flipRev === FLIP_REV_GRACE && g.score === r.score && g.isCorrect === r.isCorrect && stableFlipExtra(g.extra) === r.extra && JSON.stringify(flipFinalCheckpoint(puzzle, r.raw)) === JSON.stringify(r.checkpoint)) same++;
    else bad.push(`${r.level} #${r.n} ${r.kind}: ${r.score} → ${g.score}`);
  }
  ok(same === fixture.runs.length, `${same} of ${fixture.runs.length} flipRev 13 runs regrade to the same score, verdict, extra and checkpoint${bad.length ? ` (${bad.slice(0, 4).join("; ")})` : ""}`);
  ok(fixture.runs.some((r) => r.score === 200 && r.level === "expert") && fixture.runs.some((r) => r.kind === "random"), "the fixture holds Expert runs at 200 and random tappers");
  for (const level of LEVELS) {
    const s = flipGameFor(FLIP_REV_GRACE, level).init(FLIP_LEVEL_DEALS[level][0]!);
    ok(s.ladder === undefined && flipCrashCost(s) === FLIP_LEVEL_RULES[level].crashCost && flipGraceSpecOf(s).parts.find((p) => p.key === "sweets")!.of === FLIP_LEVEL_RULES[level].sweetsFull, `${level} on flipRev 13: no ladder mark, the frozen FLIP_LEVEL_RULES`);
  }
}

section("2. The stamp and the pin");
{
  for (const level of LEVELS) {
    for (let n = 0; n < 4; n++) {
      const p = dealAt("flip", level, n);
      ok(loose(p).flipRev === FLIP_REV_LADDER && puzzleLevel(p) === level && FLIP_LADDER_DEALS[level].includes(loose(p).seed), `${level} #${n}: flipRev 14, stamped "${level}", a course from the ladder's proved deal`);
    }
  }
  const prev = pinFlipPreLadder(true);
  let normals: string[] = [];
  try {
    for (const level of LEVELS) {
      const p = dealAt("flip", level, 2);
      ok(loose(p).flipRev === FLIP_REV_GRACE && puzzleLevel(p) === level && FLIP_LEVEL_DEALS[level].includes(loose(p).seed), `${level}: with flipPreLadder pinned the deal is flipRev 13 from its old proved deal`);
    }
    normals = Array.from({ length: 6 }, (_, n) => JSON.stringify(dealAt("flip", "normal", n)));
  } finally {
    pinFlipPreLadder(prev);
  }
  ok(normals.every((d, n) => JSON.stringify(dealAt("flip", "normal", n)) === d && loose(JSON.parse(d)).flipRev === FLIP_REV_GRACE), "Normal deals flipRev 13 exactly as before (the same deals with the pin on and off)");
  for (const seed of [7, 99, 4242]) {
    const a = withSeededRandom(seed, () => generatePuzzle("flip", { bankSeed: seed }));
    const b = withSeededRandom(seed, () => generatePuzzle("flip", { bankSeed: seed, level: "normal" }));
    ok(JSON.stringify(a) === JSON.stringify(b) && !("level" in (a as object)), `seed ${seed}: a Normal deal is the deal with no level asked`);
  }
  const keys = Object.keys(DEAL_PINS);
  ok(keys.includes("flipPreLadder") && DEAL_PINS.flipPreLadder.texts === false && keys.indexOf("flipPreLadder") > keys.indexOf("skylinePreCount"), "flipPreLadder is a DEAL_PINS entry added at the end (no text rebuild)");
  ok(flipGameFor(FLIP_REV_LADDER) === flipGraceGame && flipGameFor(FLIP_REV_LADDER, "normal") === flipGraceGame, "flipRev 14 without a level is flipRev 13's Normal (never dealt so)");
}

section("3. The level rules as dealt");
{
  ok(JSON.stringify(levelsOf("flip")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Roofbound offers Easy, Normal, Hard and Expert");
  const R = FLIP_V14_LEVEL_RULES;
  ok(R.easy.speedStart === 768 && R.easy.speedCap === 1792 && R.easy.moversFrom === null && R.easy.sweetTicks === 10 && R.easy.sweetsFull === 3 && R.easy.crashCost === 10, "Easy: starts at 3 px a tick, top 7, no moving spikes, sweet spots 10 ticks wide, perfect landings full at 3, 5 s a crash");
  ok(R.hard.speedStart === 1408 && R.hard.speedCap === 3072 && R.hard.moversFrom === 240 && R.hard.crashCost === 40 && R.hard.sweetsFull === 5, "Hard: starts at 5.5 px a tick, top 12, moving spikes from 4 s, 20 s a crash, perfect landings full at 5");
  ok(R.expert.speedStart === 1600 && R.expert.speedCap === 3328 && R.expert.moversFrom === 120 && R.expert.sweetSeconds.length === 10 && R.expert.crashCost === 50 && R.expert.sweetsFull === 5, "Expert: starts at 6.25 px a tick, top 13, moving spikes from 2 s, 10 sweet spots, 25 s a crash, perfect landings full at 5");
  ok(R.easy.crashCost < 20 && 20 < R.hard.crashCost && R.hard.crashCost < R.expert.crashCost && R.hard.stepTicks > R.expert.stepTicks, "a crash costs more each level up (Normal 10 s); Expert speeds up more often than Hard");
  ok(R.easy.speedStart < 1024 && R.hard.speedStart > 1024 && R.expert.speedStart > R.hard.speedStart, "the lever: Easy starts slower than Normal (4 px a tick), Hard faster, Expert fastest");
  for (const level of LEVELS) {
    const r = R[level];
    const settings = gameLevelSettings<Record<string, unknown>>("flip", level)!;
    const mirror = { speedStart: r.speedStart, speedStep: r.speedStep, stepTicks: r.stepTicks, speedCap: r.speedCap, moversFrom: r.moversFrom, sweetTicks: r.sweetTicks, sweetSpots: r.sweetSeconds.length, crashCost: r.crashCost, sweetsFull: r.sweetsFull, coreFull: r.coreFull, doublesFull: r.doublesFull, streakFull: r.streakFull };
    ok(JSON.stringify(Object.entries(settings).sort()) === JSON.stringify(Object.entries(mirror).sort()), `${level}: gameLevels.ts mirrors the sim's FLIP_V14_LEVEL_RULES`);
    const seed = FLIP_LADDER_DEALS[level][0]!;
    const g = flipGameFor(FLIP_REV_LADDER, level);
    const st = g.init(seed);
    ok(g === flipLadderGameAt(level) && st.lvl === FLIP_LEVEL_CODE[level] && st.ladder === 1 && st.grace === 1, `${level}: the state carries its code and the ladder's mark, with grace`);
    ok(flipCheckpoint(st).checksum !== flipCheckpoint({ ...st, ladder: undefined }).checksum, `${level}: the ladder's mark is in the checksum`);
    const xs = st.v8!.xs;
    const step = (t: number) => xs[t]! - xs[t - 1]!;
    const want = (t: number) => Math.min(r.speedCap, r.speedStart + r.speedStep * Math.trunc(t / r.stepTicks));
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
    ok(st.v8!.sweets.length === r.sweetSeconds.length && st.v8!.sweets.every((sw) => sw.x1 - sw.x0 >= r.sweetTicks * r.speedStart), `${level}: ${r.sweetSeconds.length} sweet spots, each ${r.sweetTicks} tick${r.sweetTicks === 1 ? "" : "s"} of travel long`);
    const movers = st.segs.filter((seg) => seg.decision === FLIP_DECISION_MOVER);
    if (r.moversFrom === null) ok(FLIP_LADDER_DEALS[level].slice(0, 10).every((sd) => !flipCourseV8(sd, level, true).segs.some((seg) => seg.decision === FLIP_DECISION_MOVER)), `${level}: no moving spikes`);
    else ok(movers.every((seg) => seg.x0 - (seg.amp ?? 0) >= xs[r.moversFrom!]!) && FLIP_LADDER_DEALS[level].slice(0, 10).some((sd) => flipCourseV8(sd, level, true).segs.some((seg) => seg.decision === FLIP_DECISION_MOVER)), `${level}: moving spikes only from ${r.moversFrom / 60} s (and courses carry them)`);
    ok(flipCrashCost(st) === r.crashCost, `${level}: a crash costs ${r.crashCost / 2} s of clean time`);
    const spec = flipGraceSpecOf(st);
    const of = (k: string) => spec.parts.find((q) => q.key === k)!.of;
    ok(spec.parts.reduce((a, q) => a + q.max, 0) === 200 && of("core") === r.coreFull && of("sweets") === r.sweetsFull && of("doubles") === r.doublesFull && of("flow") === r.streakFull, `${level}: the parts total 200 on the level's lines (clean time at ${r.coreFull / 2} s, ${r.sweetsFull} perfect landings, ${r.doublesFull} double flips, ${r.streakFull} in a row)`);
    const done = { ...st, ended: 1, tick: FLIP_RUN_TICKS, acted: 1, combos: r.doublesFull, bestStreak: r.streakFull, sweetGot: (1 << r.sweetsFull) - 1 } as FlipState;
    ok(g.score(done) === 200 && g.score({ ...done, saves: 2 }) < 200 && flipGraceScore({ ...done, saves: 1 }).core === Math.floor((100 * Math.min(r.coreFull, 120 - r.crashCost)) / r.coreFull), `${level}: every line met scores 200; a crash costs ${r.crashCost / 2} s of clean time (two cost the full line)`);
    // Grace: no input crashes again and again and still lasts the minute.
    let s = g.init(seed);
    while (!g.isOver(s)) s = g.step(s, null);
    ok(s.ended === 1 && (s.saves ?? 0) >= 2, `${level}: with no input the runner crashes ${s.saves} times and still lasts the minute`);
    const p = flipLadderPuzzle(level, seed);
    ok(g.runTicks === FLIP_RUN_TICKS && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level}: a 60 s run on a clock of ${puzzleTimeLimitMs(p) / 1000} s (at most 120 s)`);
  }
}

section("4. The proved deal");
{
  const witnesses = readLadderWitnesses();
  for (const level of LEVELS) {
    const dealt = FLIP_LADDER_DEALS[level];
    const mine = new Map(witnesses.filter((w) => w.level === level).map((w) => [w.seed, w]));
    ok(dealt.length >= 40 && dealt.every((sd) => FLIP_LADDER_CANDIDATES.includes(sd)) && mine.size === FLIP_LADDER_CANDIDATES.length, `${level}: ${dealt.length} of ${FLIP_LADDER_CANDIDATES.length} candidate courses dealt (at least 40), a witness for every candidate`);
    const stride = full ? 1 : Math.max(1, Math.floor(dealt.length / 6));
    let at200 = 0;
    let checked = 0;
    for (const seed of dealt.filter((_, i) => i % stride === 0)) {
      checked++;
      const r = gradeFlipWitness(mine.get(seed)!);
      if (r.score === 200 && !r.flagged && r.limits && r.spare) at200++;
    }
    ok(at200 === checked, `${level}: the witness held to the limits scores exactly 200 through the server replay, never flagged, taps 0.15 s apart, a perfect landing to spare, on ${at200} of ${checked} dealt courses${full ? " (all)" : " (a sample)"}`);
    const replay = full ? dealt : dealt.slice(0, 1);
    let same = 0;
    for (const seed of replay) if (JSON.stringify((await playFlipWitness(level, seed)).taps) === JSON.stringify(mine.get(seed)!.taps)) same++;
    ok(same === replay.length, `${level}: the stored witness is the flawless bot's run under HUMAN_LIMITS (${same} of ${replay.length} re-played)`);
  }
  if (full) {
    const built = buildFlipLadderDeals(witnesses);
    ok(readFileSync(FLIP_LADDER_DEAL_FILE, "utf8") === flipLadderDealSource(built), `${FLIP_LADDER_DEAL_FILE} rebuilds byte for byte from the stored witnesses`);
  }
}

section("5. Joe's ladder test on the recorded ladder");
{
  for (const [cond, label] of await ladderFixtureVerdicts("flip")) ok(cond, label);
  for (const [cond, label] of await replaySample("flip", 2)) ok(cond, label);
}

console.log(`flip-ladder-check: ${passes} passed, ${failures} failed (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
if (failures > 0) {
  console.log("FAIL flip-ladder-check");
  process.exit(1);
}
