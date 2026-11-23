/**
 * skyline-rev12-check (~20 s): High Rise skylineRev 12 (D5 item I5, approved by Joe 20 Nov 2026;
 * docs/arcade-standard/skyline.md "skylineRev 12"): skylineRev 11's play at every level, Floors full at 45 floors and
 * perfect drops full at 30.
 *
 *  1. skylineRev 11 is untouched: the 144 runs recorded on it at every level before skylineRev 12
 *     (scripts/fixtures/skyline-rev12-legacy.json.gz, scripts/skyline-rev12-legacy-record.ts) regrade through gradeAnswer
 *     to the same score, verdict, count, stored extra and final checkpoint; the 60 older runs (unstamped and
 *     skylineRev 2–10, scripts/fixtures/skyline-overhaul-legacy.json) replay to the same score and checksum.
 *  2. The deal: Normal and every level deal skylineRev 12 on the same seed (and level) as skylineRev 11 did; the era pin
 *     skylinePreCount deals skylineRev 11 exactly as recorded; skylinePreLives still deals skylineRev 10.
 *  3. The same play: every recorded skylineRev 11 log replays on the skylineRev 12 copy of its puzzle tick for tick (the
 *     same final checkpoint and checksum, never flagged); `fullLines` stays out of the checksum.
 *  4. The new lines: every recorded run regraded on skylineRev 12 scores its parts on 45 floors and 30 perfect drops, the
 *     streak and gold unchanged, and never less than it scored on skylineRev 11; built states: 44 / 45 floors, 29 / 30
 *     perfect drops, more floors or perfect drops never lower the score.
 *  5. The spec, the live band and the help: the parts sum to 200 on skylineRev 12; LIVE_BANDS, the standard and the "?"
 *     help say 45 and 30.
 *  6. 200 through the server replay: the oracle scores exactly 200 on skylineRev 12 Normal deals and at every level, and
 *     a built state of 45 floors, 30 perfect drops, a streak of 10 and 5 gold blocks scores 200.
 *  7. Practice bests start fresh: PRACTICE_STAMPS reads skylineRev=12.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  skylineCheckpoint,
  skylineFloorsGame,
  skylineFloorsGameAt,
  skylineGameFor,
  skylineLivesGame,
  skylineStdParts,
  skylineWorldHFor,
  SKYLINE_REV_COUNT,
  SKYLINE_REV_FLOORS,
  SKYLINE_REV_LIVES,
  SKYLINE_STD_SPEC_V11,
  SKYLINE_STD_SPEC_V12,
  SKYLINE_V12_BAND_CURVE,
  SKYLINE_V12_FLOORS_FULL_AT,
  SKYLINE_V12_PERFECTS_FULL_AT,
  SKYLINE_V9_CORE_MAX,
  SKYLINE_V9_GOLD_COUNT,
  SKYLINE_V9_PERFECTS_MAX,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { stdScore } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS, liveStdHelp } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { replaySkylineRun } from "../src/lib/duel/skyline";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { pinSkylinePreCount, pinSkylinePreLives } from "../src/lib/duel/arcade.server";
import { DEAL_PINS } from "../src/lib/duel/dealEra";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { dealAt } from "./level-tune";
import { encodeTaps, SKYLINE_REV12_LEGACY, skylineFinalCheckpoint, stableExtra, type SkylineLegacyFixture } from "./skyline-rev12-legacy-record";
import { skylineOracle } from "./skyline-oracle";

let failures = 0;
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${label}`);
  }
};

const fixture = JSON.parse(gunzipSync(readFileSync(SKYLINE_REV12_LEGACY)).toString()) as SkylineLegacyFixture;
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
const asRev = (puzzle: PuzzleData, rev: number): PuzzleData => ({ ...(puzzle as object), skylineRev: rev }) as PuzzleData;
const loose = (p: PuzzleData) => p as unknown as { seed: number; skylineRev?: number; level?: string };

/* 1. skylineRev 11 is untouched, and every older stamp with it. */
{
  ok(fixture.runs.length === 144 && LEVELS.every((l) => fixture.runs.filter((r) => r.level === l).length === 36), "the legacy fixture holds 36 skylineRev 11 runs at each of the four levels");
  ok(fixture.runs.every((r) => loose(JSON.parse(r.puzzle) as PuzzleData).skylineRev === SKYLINE_REV_LIVES), "every legacy run's puzzle is skylineRev 11");
  let same = 0;
  const bad: string[] = [];
  for (const r of fixture.runs) {
    const puzzle = JSON.parse(r.puzzle) as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    const cp = skylineFinalCheckpoint(puzzle, r.raw);
    if (g.score === r.score && g.isCorrect === r.isCorrect && (g.correctCount ?? null) === r.correctCount && stableExtra(g.extra) === r.extra && JSON.stringify(cp) === JSON.stringify(r.checkpoint)) same++;
    else bad.push(`${r.level} #${r.n} ${r.kind}: ${r.score} → ${g.score}`);
  }
  ok(same === fixture.runs.length, `${same} of ${fixture.runs.length} skylineRev 11 runs regrade to the same score, verdict, extra and checkpoint${bad.length ? ` (${bad.slice(0, 4).join("; ")})` : ""}`);
  ok(fixture.runs.some((r) => r.score === 200) && fixture.runs.some((r) => JSON.parse(r.extra).livesLost > 0), "the fixture holds runs at 200 and runs that lost lives");

  const older = JSON.parse(readFileSync("scripts/fixtures/skyline-overhaul-legacy.json", "utf8")) as { runs: { rev: number | null; seed: number; raw: string; score: number; checksum: number; flagged: boolean; tick: number }[] };
  let olderSame = 0;
  for (const r of older.runs) {
    const out = replaySkylineRun(r.seed, r.raw, r.rev);
    if (out.score === r.score && skylineCheckpoint(out.state).checksum === r.checksum && out.flagged === r.flagged && out.state.tick === r.tick && out.state.fullLines === undefined) olderSame++;
  }
  ok(older.runs.length === 60 && olderSame === older.runs.length, `${olderSame} of ${older.runs.length} runs on unstamped and skylineRev 2–10 replay to the same score and checksum, without the new field`);
  ok(skylineGameFor(SKYLINE_REV_LIVES) === skylineLivesGame && skylineGameFor(SKYLINE_REV_LIVES).init(7).fullLines === undefined, "skylineGameFor(11) is still the lives game, its states without `fullLines`");
}

/* 2. The deal. */
{
  for (const level of LEVELS) {
    let same = 0;
    let pinnedSame = 0;
    for (let n = 0; n < 6; n++) {
      const recorded = fixture.runs.find((r) => r.level === level && r.n === n)!.puzzle;
      const now = dealAt("skyline", level, n);
      if (JSON.stringify(now) === JSON.stringify(asRev(JSON.parse(recorded) as PuzzleData, SKYLINE_REV_FLOORS)) && puzzleLevel(now) === level) same++;
      const prev = pinSkylinePreCount(true);
      try {
        if (JSON.stringify(dealAt("skyline", level, n)) === recorded) pinnedSame++;
      } finally {
        pinSkylinePreCount(prev);
      }
    }
    ok(same === 6, `${level}: ${same} of 6 deals are skylineRev 12 on the seed${level === "normal" ? "" : " and level"} skylineRev 11 dealt`);
    ok(pinnedSame === 6, `${level}: with skylinePreCount pinned, ${pinnedSame} of 6 deals are the recorded skylineRev 11 deals byte for byte`);
  }
  const prev = pinSkylinePreLives(true);
  try {
    ok(loose(dealAt("skyline", "normal", 0)).skylineRev === SKYLINE_REV_COUNT, "skylinePreLives still deals skylineRev 10");
  } finally {
    pinSkylinePreLives(prev);
  }
  ok(loose(dealAt("skyline", "normal", 0)).skylineRev === SKYLINE_REV_FLOORS, "the pins restore: the live deal is skylineRev 12");
  const keys = Object.keys(DEAL_PINS);
  ok(keys.indexOf("skylinePreCount") > keys.indexOf("racingPreCircuits") && keys.indexOf("racingPreCircuits") >= 0 && DEAL_PINS.skylinePreCount.texts === false, "skylinePreCount is a DEAL_PINS entry added at the end (after racingPreCircuits; no text rebuild)");
}

/* 3. The same play. */
{
  let same = 0;
  for (const r of fixture.runs) {
    const puzzle = asRev(JSON.parse(r.puzzle) as PuzzleData, SKYLINE_REV_FLOORS);
    const out = replaySkylineRun(loose(puzzle).seed, r.raw, SKYLINE_REV_FLOORS, puzzleLevel(puzzle));
    // The log's own checkpoints all match (no desync); the only flag a rev-11 log can raise on rev 12 is its claimed
    // score (rev 11's), when the lower lines score it differently (or the flag it already carried).
    const flaggedBefore = (JSON.parse(r.extra) as { flagged?: boolean }).flagged === true;
    if (out.desyncTick === null && out.flagged === (flaggedBefore || out.score !== r.score) && JSON.stringify(skylineCheckpoint(out.state)) === JSON.stringify(r.checkpoint) && out.state.fullLines === 1) same++;
  }
  ok(same === fixture.runs.length, `${same} of ${fixture.runs.length} skylineRev 11 logs replay on skylineRev 12 tick for tick (every checkpoint matches, the same final one; flagged only for rev 11's claimed score)`);
  for (const level of ["easy", "hard", "expert"] as const) {
    const a = skylineGameFor(SKYLINE_REV_LIVES, level).init(99);
    const b = skylineGameFor(SKYLINE_REV_FLOORS, level).init(99);
    ok(skylineGameFor(SKYLINE_REV_FLOORS, level) === skylineFloorsGameAt(level) && b.lvl === a.lvl && b.lives === a.lives && b.fullLines === 1, `${level}: skylineRev 12 carries skylineRev 11's level code and lives`);
    ok(skylineCheckpoint(a).checksum === skylineCheckpoint(b).checksum, `${level}: the same checksum (fullLines stays out of it)`);
  }
  ok(skylineGameFor(SKYLINE_REV_FLOORS) === skylineFloorsGame && skylineGameFor(SKYLINE_REV_FLOORS, "normal") === skylineFloorsGame, "Normal is the skylineRev 12 game itself");
  ok(skylineCheckpoint(skylineFloorsGame.init(5)).checksum === skylineCheckpoint(skylineLivesGame.init(5)).checksum, "Normal: the same checksum as skylineRev 11");
  ok(skylineWorldHFor(SKYLINE_REV_FLOORS) === skylineWorldHFor(SKYLINE_REV_LIVES) && skylineFloorsGame.init(5).worldH === skylineLivesGame.init(5).worldH, "the same view (390 × 735) as skylineRev 11");
}

/* 4. The new lines. */
{
  const expected = (s: SkylineState) =>
    stdScore(
      [
        { key: "core", label: "", detail: "", points: Math.floor((SKYLINE_V9_CORE_MAX * Math.min(s.placed, 45)) / 45), max: 140 },
        { key: "perfects", label: "", detail: "", points: Math.floor((SKYLINE_V9_PERFECTS_MAX * Math.min(s.perfects, 30)) / 30), max: 30 },
        { key: "streak", label: "", detail: "", points: Math.min(s.bestStreak ?? 0, 10), max: 10 },
        { key: "gold", label: "", detail: "", points: 4 * (s.golds ?? 0), max: 20 },
      ],
      Boolean(s.acted),
    );
  let lines = 0;
  let never = 0;
  let higher = 0;
  for (const r of fixture.runs) {
    const puzzle = asRev(JSON.parse(r.puzzle) as PuzzleData, SKYLINE_REV_FLOORS);
    const g = gradeAnswer(puzzle, r.raw, 0);
    const state = replaySkylineRun(loose(puzzle).seed, r.raw, SKYLINE_REV_FLOORS, puzzleLevel(puzzle)).state;
    if (g.score === expected(state)) lines++;
    if (g.score >= r.score) never++;
    if (g.score > r.score) higher++;
  }
  ok(lines === fixture.runs.length, `${lines} of ${fixture.runs.length} runs score on 45 floors and 30 perfect drops (streak and gold unchanged)`);
  ok(never === fixture.runs.length && higher > 50, `no run scores less on skylineRev 12 (${higher} score more)`);

  const at = (over: Partial<SkylineState>) => ({ ...skylineFloorsGame.init(4242), acted: 1, ...over });
  const pts = (s: SkylineState, key: string) => skylineStdParts(s)!.find((p) => p.key === key)!.points;
  ok(pts(at({ placed: 45 }), "core") === 140 && pts(at({ placed: 44 }), "core") === Math.floor((140 * 44) / 45) && pts(at({ placed: 120 }), "core") === 140, "Floors: 140 at 45 floors, 136 at 44, still 140 at 120");
  ok(pts(at({ placed: 45, perfects: 30 }), "perfects") === 30 && pts(at({ placed: 45, perfects: 29 }), "perfects") === 29 && pts(at({ placed: 90, perfects: 61 }), "perfects") === 30, "Perfect drops: 30 at 30, 29 at 29, still 30 at 61");
  ok(pts(at({ bestStreak: 25 }), "streak") === 10 && pts(at({ golds: 3 }), "gold") === 12, "the streak (full at 10) and gold (4 each) are unchanged");
  let rising = true;
  for (let placed = 0; placed <= 90; placed++)
    for (let perfects = 0; perfects <= placed; perfects += 3) {
      const s = skylineFloorsGame.score(at({ placed, perfects }));
      if (skylineFloorsGame.score(at({ placed: placed + 1, perfects })) < s || skylineFloorsGame.score(at({ placed: placed + 1, perfects: perfects + 1 })) < s) rising = false;
    }
  ok(rising, "another floor, perfect or not, never lowers the score (0–90 floors)");
  const old = { ...skylineLivesGame.init(4242), acted: 1, placed: 45, perfects: 30 };
  ok(skylineLivesGame.score(old) === Math.floor((140 * 45) / 61) + Math.floor((30 * 30) / 61), "skylineRev 11 still scores 45 floors and 30 perfect drops on 61 (103 + 14)");
  ok(skylineFloorsGame.score(at({ placed: 0, perfects: 0 })) === 1 && skylineFloorsGame.score(skylineFloorsGame.init(1)) === 0, "a played run with nothing scores 1, an untouched one 0");
}

/* 5. The spec, the live band and the help. */
{
  ok(SKYLINE_STD_SPEC_V12.rev === SKYLINE_REV_FLOORS && SKYLINE_STD_SPEC_V12.parts.reduce((a, p) => a + p.max, 0) === 200, "skylineRev 12's parts sum to 200");
  ok(JSON.stringify(SKYLINE_STD_SPEC_V12.parts.map((p) => [p.key, p.label, p.max])) === JSON.stringify(SKYLINE_STD_SPEC_V11.parts.map((p) => [p.key, p.label, p.max])), "the same four parts and maximums as skylineRev 11");
  const how = (key: string) => SKYLINE_STD_SPEC_V12.parts.find((p) => p.key === key)!.how ?? "";
  ok(how("core").includes(`${SKYLINE_V12_FLOORS_FULL_AT} floors`) && how("perfects").includes(`${SKYLINE_V12_PERFECTS_FULL_AT} perfect drops`) && !how("core").includes("61") && !how("perfects").includes("61"), "the parts' words say 45 floors and 30 perfect drops, never 61");
  ok(LIVE_BANDS.skyline.rev === SKYLINE_REV_FLOORS && LIVE_BANDS.skyline.curve === SKYLINE_V12_BAND_CURVE && (LIVE_BANDS.skyline as { std?: unknown }).std === SKYLINE_STD_SPEC_V12, "LIVE_BANDS lists skylineRev 12, its curve and spec");
  ok(JSON.stringify(SKYLINE_V12_BAND_CURVE).includes("45") && JSON.stringify(SKYLINE_V12_BAND_CURVE).includes("140"), "the live curve ends at 140 on 45 floors");
  ok(ARCADE_STANDARD.skyline.spec === SKYLINE_STD_SPEC_V12, "the standard's spec is skylineRev 12's");
  const help = liveStdHelp("skyline");
  ok(help.includes("45 floors") && help.includes("30 perfect drops") && !help.includes("61"), `the "?" help says 45 floors and 30 perfect drops (${help.slice(0, 120)}…)`);
}

/* 6. 200 through the server replay. */
{
  for (const level of LEVELS) {
    let full = 0;
    const n0 = level === "normal" ? 0 : 20;
    for (let n = n0; n < n0 + 6; n++) {
      const puzzle = dealAt("skyline", level, n);
      const seed = loose(puzzle).seed;
      const run = skylineOracle(skylineGameFor(SKYLINE_REV_FLOORS, puzzleLevel(puzzle)), seed);
      if (gradeAnswer(puzzle, encodeTaps(puzzle, run.taps).raw, 0).score === 200) full++;
    }
    ok(full === 6, `${level}: the oracle scores exactly 200 through the server replay on ${full} of 6 skylineRev 12 deals`);
  }
  const perfect = { ...skylineFloorsGame.init(4242), acted: 1, placed: SKYLINE_V12_FLOORS_FULL_AT, perfects: SKYLINE_V12_PERFECTS_FULL_AT, bestStreak: 10, golds: SKYLINE_V9_GOLD_COUNT };
  ok(skylineFloorsGame.score(perfect) === 200, "45 floors, 30 perfect drops, a streak of 10 and 5 gold blocks score 200");
}

/* 7. Practice bests start fresh. */
ok(/skylineRev=12\b/.test(PRACTICE_STAMPS["skyline"] ?? ""), `PRACTICE_STAMPS reads skylineRev=12 (${PRACTICE_STAMPS["skyline"]})`);

console.log(`skyline-rev12-check: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log("FAIL skyline-rev12-check");
  process.exit(1);
}
