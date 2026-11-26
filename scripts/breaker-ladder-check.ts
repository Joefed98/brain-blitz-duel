/**
 * breaker-ladder-check (D5's ladder, 23 Nov 2026; docs/arcade-standard/breaker.md "brkRev 13" and "Levels (D5, 23 Nov
 * 2026)"): Breaker's brkRev 13, Normal's refit and the four-level ladder.
 *
 *  1. Legacy: every start (brkRev 12 at every level, brkRev 11) and every run recorded before brkRev 13
 *     (scripts/fixtures/breaker-ladder-legacy.json.gz, scripts/breaker-ladder-legacy-record.ts) starts, replays and grades
 *     exactly as recorded: the server's score and verdict, a digest of its stored extra, the replayed state and checkpoints.
 *  2. The stamp and the pin: rooms and every level deal brkRev 13 from the level's proved list; `breakerPreLadder` deals
 *     brkRev 12 (and `preRetro` brkRev 11); a Normal deal is byte for byte the deal with no level asked; LIVE_BANDS, the
 *     practice definition, the intro still and the practice stamps follow the dealt stamp.
 *  3. Normal: brkRev 12's game exactly (the same start, the same play tick for tick, its own checksum), on the refitted
 *     lines (Bricks full at 79 of 81, gold 15 a brick, the full speed part for a clear by 80 s); the help states them.
 *  4. The levels as dealt: each level's state is its row of BREAKER_LEVELS (rows, paddle, one-hit bricks, sliding rows and
 *     their start, lives, ball), the registry mirrors the table, brkRev 12's table is kept for brkRev 12; a 9-row ladder
 *     wall is brkRev 12's wall brick for brick; a level's last ball lost ends the run; the parts' maximums sum to 200 at
 *     every level.
 *  5. The proof: the deal file rebuilds from its witnesses byte for byte, every dealt seed has one, and every witness
 *     (a sample at default depth, all with CHECKS_FULL=1) scores exactly 200 through the server's grade; on a sample the
 *     flawless player held to the human limits plays exactly the stored witness.
 *  6. The ladder: Joe's ladder test on the recorded 96-deal table (scripts/fixtures/d5-ladder-breaker.json.gz) and a live
 *     re-play of two recorded runs a level and player.
 *
 *   bun scripts/breaker-ladder-check.ts            (CHECKS_FULL=1: every witness)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  brkCheckpoint,
  breakerGameFor,
  breakerLadderParts,
  brkLadderDropRows,
  brkLadderSpeed,
  brkPaddleWOf,
  brkRowOffset,
  BRK_PADDLE_W,
  BRK_REV_CLEAR,
  BRK_REV_LADDER,
  BRK_REV_STD,
  BRK_RUN_TICKS,
  BRK_V11_MAX,
  BRK_V13_BAND_CURVE,
  BRK_V13_CORE_SHORT,
  BRK_V13_GOLD_EACH,
  BRK_V13_SPEED_FULL_S,
  type BrkState,
} from "../src/lib/arcade/breaker";
import { breakerArtGameFor } from "../src/lib/arcade/breaker.renderer";
import { ARCADE_INPUT_DRAG, TICKS_PER_SECOND } from "../src/lib/arcade/engine";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { BREAKER_LEVELS, BREAKER_LEVELS_V12 } from "../src/lib/arcade/retroLevels";
import { BREAKER_LEVEL_DEALS } from "../src/lib/duel/breakerLevelDeals.server";
import { replayBreakerRun } from "../src/lib/duel/breaker";
import { activeDealPins, DEAL_PINS, withDealOptions } from "../src/lib/duel/dealEra";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { breakerPuzzle } from "../src/puzzles/breaker";
import { BREAKER_LADDER_LEGACY, digest, stableExtra, type BreakerLegacyRun } from "./breaker-ladder-legacy-record";
import { breakerDealSource, breakerProofLog, BRK_DEAL_FILE, BRK_DEAL_LEVELS, checkBreakerWitnesses, readBreakerWitnesses } from "./breaker-level-deal";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";

const t0 = Date.now();
let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const section = (name: string) => console.log(`\n== ${name}`);
const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v);
const sorted = (v: unknown) => JSON.stringify(canon(v));
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
const FULL = process.env["CHECKS_FULL"] === "1";

/* ============================== 1. Legacy ============================== */
section("brkRev 12 (every level) and 11 start, replay and grade exactly as recorded");
{
  const fixture = JSON.parse(gunzipSync(readFileSync(BREAKER_LADDER_LEGACY)).toString()) as { inits: { rev: number; level: Level; seed: number; digest: string }[]; runs: BreakerLegacyRun[] };
  ok(fixture.inits.length === 90 && fixture.runs.length === 75, `the fixture holds 90 starts and 75 runs (${fixture.inits.length}, ${fixture.runs.length})`);
  ok(new Set(fixture.runs.map((r) => `${r.rev}:${r.level}`)).size === 5, "the runs cover brkRev 12 at every level and brkRev 11");
  let starts = 0;
  for (const i of fixture.inits) if (digest(breakerGameFor(i.rev, i.level).init(i.seed)) === i.digest) starts++;
  ok(starts === fixture.inits.length, `${starts} of ${fixture.inits.length} recorded starts identical`);
  let same = 0;
  for (const r of fixture.runs) {
    const replay = replayBreakerRun(r.seed, r.raw, r.rev, r.level);
    const puzzle = { type: "breaker", seed: r.seed, brkRev: r.rev, ...(r.level !== "normal" ? { level: r.level } : {}) } as unknown as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    const exact = replay.score === r.score && !!replay.flagged === r.flagged && digest(replay.state) === r.state && digest(replay.checkpoints ?? null) === r.checkpoints && g.score === r.grade.score && g.isCorrect === r.grade.isCorrect && digest(stableExtra(g.extra)) === r.grade.extra;
    if (exact) same++;
    else ok(false, `brkRev ${r.rev} ${r.level} seed ${r.seed} ${r.player}: replays to ${r.score} and grades ${r.grade.score} as recorded (got ${replay.score}, ${g.score})`);
  }
  ok(same === fixture.runs.length, `${same} of ${fixture.runs.length} recorded runs identical`);
}

/* ============================== 2. The stamp and the pin ============================== */
section("Rooms and every level deal brkRev 13 from the level's proved list; breakerPreLadder deals brkRev 12");
{
  ok(BRK_REV_LADDER === 13 && BRK_REV_LADDER === BRK_REV_CLEAR + 1, "brkRev 13 is one above brkRev 12");
  for (const level of LEVELS) {
    for (const n of [0, 7, 31, 88]) {
      const opts = level === "normal" ? {} : { level };
      const p = withSeededRandom(7000 + n, () => generatePuzzle("breaker", opts as never)) as any;
      ok(p.brkRev === BRK_REV_LADDER && (level === "normal" ? p.level === undefined : p.level === level), `${level} deal ${n}: brkRev 13 at ${p.level ?? "normal"}`);
      ok(BREAKER_LEVEL_DEALS[level].includes(p.seed), `${level} deal ${n}: the seed ${p.seed} is on the level's proved list`);
      const pinned = withSeededRandom(7000 + n, () => withDealOptions({ pins: ["breakerPreLadder"] }, () => generatePuzzle("breaker", opts as never))) as any;
      ok(pinned.brkRev === BRK_REV_CLEAR, `${level} deal ${n}: breakerPreLadder deals brkRev 12 (${pinned.brkRev})`);
    }
  }
  ok(withDealOptions({ pins: ["preRetro"] }, () => (generatePuzzle("breaker") as any).brkRev) === BRK_REV_STD, "preRetro still deals brkRev 11");
  ok("breakerPreLadder" in DEAL_PINS && DEAL_PINS.breakerPreLadder.texts === false, "DEAL_PINS has breakerPreLadder (no text rebuild)");
  ok(activeDealPins().length === 0, "nothing left pinned");
  for (const seed of [7, 99, 4242, 123456]) {
    const a = withSeededRandom(seed, () => generatePuzzle("breaker", { bankSeed: seed }));
    const b = withSeededRandom(seed, () => generatePuzzle("breaker", { bankSeed: seed, level: "normal" }));
    ok(JSON.stringify(a) === JSON.stringify(b), `seed ${seed}: a Normal deal is byte for byte the deal with no level asked`);
  }
  ok(LIVE_BANDS.breaker.rev === BRK_REV_LADDER && LIVE_BANDS.breaker.curve === BRK_V13_BAND_CURVE, "LIVE_BANDS reads brkRev 13 and its core line");
  ok((breakerPuzzle.generate() as any).brkRev === BRK_REV_LADDER, "the practice definition deals brkRev 13");
  ok(/breakerArtGameFor\(BRK_REV_LADDER\)/.test(readFileSync("src/puzzles/breaker.tsx", "utf8")), "the intro still is drawn on brkRev 13");
  ok(/brkRev=13\b/.test(PRACTICE_STAMPS.breaker ?? ""), `the practice stamps name brkRev 13 (${PRACTICE_STAMPS.breaker})`);
  const art = breakerArtGameFor(BRK_REV_LADDER);
  ok(art === breakerArtGameFor(BRK_REV_LADDER) && art !== breakerArtGameFor(BRK_REV_CLEAR) && (art.init(5) as BrkState).lad === 1, "the stage's art game for brkRev 13 is its own (cached) and starts with the ladder's marker");
}

/* ============================== 3. Normal ============================== */
section("Normal: brkRev 12's play exactly, on the refitted lines");
{
  const g12 = breakerGameFor(BRK_REV_CLEAR);
  const g13 = breakerGameFor(BRK_REV_LADDER);
  ok(g13 === breakerGameFor(BRK_REV_LADDER, "normal"), "Normal (asked or not) is the same game");
  for (const seed of [1, 99, 4242, 301794028]) {
    const a = g13.init(seed) as BrkState;
    const { lad, ...rest } = a;
    ok(lad === 1 && sorted(rest) === sorted(g12.init(seed)) && a.lv === undefined && a.lives === undefined && a.slideAt === undefined, `seed ${seed}: brkRev 13 starts from brkRev 12's exact start, plus lad: 1 (no level, lives or slide times)`);
    ok(brkCheckpoint(a).checksum !== brkCheckpoint(rest as BrkState).checksum, `seed ${seed}: its own checksum (brkRev 12's without the marker)`);
    // The same play: a seeded sweep of the paddle, tick for tick on both stamps.
    let s12 = g12.init(seed) as BrkState;
    let s13 = a;
    let x = seed | 1;
    let same = true;
    for (let t = 1; t <= BRK_RUN_TICKS && !g12.isOver(s12); t++) {
      x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
      const ev = t % 5 === 0 ? { t, k: ARCADE_INPUT_DRAG, a: 30 + (x % 360), b: 0, c: 0, d: 0 } : null;
      s12 = g12.step(s12, ev) as BrkState;
      s13 = g13.step(s13, ev) as BrkState;
      const { lad: _l, ...r13 } = s13;
      if (sorted(r13) !== sorted(s12)) {
        same = false;
        break;
      }
    }
    ok(same && g13.isOver(s13) === g12.isOver(s12), `seed ${seed}: the same play tick for tick (to tick ${s12.tick})`);
  }
  // The lines, on states built for them.
  const base = g13.init(4242) as BrkState;
  const at = (destroyed: number, gold: number, cleared: boolean, endedTick: number) => {
    const bricks = base.bricks.map((h, i) => (i < destroyed ? 0 : h));
    return breakerLadderParts({ ...base, bricks, goldBroken: gold, cleared, endedTick, acted: 1 } as BrkState);
  };
  ok(BRK_V13_CORE_SHORT === 2 && BRK_V13_GOLD_EACH === 15 && BRK_V13_SPEED_FULL_S === 80, "Normal's lines: the core 2 bricks short of the wall, gold 15, full speed by 80 s");
  ok(at(79, 0, false, 0).core === 140 && at(78, 0, false, 0).core === Math.floor((140 * 78) / 79) && at(81, 0, false, 0).core === 140, "Bricks: 140 at 79 of the 81, a straight line below");
  ok(at(10, 1, false, 0).gold === 15 && at(10, 2, false, 0).gold === 30 && at(10, 3, false, 0).gold === 30, "Gold: 15 a gold brick, 30 at 2 of 3");
  ok(brkLadderSpeed(80 * TICKS_PER_SECOND, 80) === 20 && brkLadderSpeed(40 * TICKS_PER_SECOND, 80) === 20 && brkLadderSpeed(BRK_RUN_TICKS, 80) === 0 && brkLadderSpeed(85 * TICKS_PER_SECOND, 80) === 10, "Speed: 20 for a clear by 80 s, falling evenly to 0 at the buzzer");
  ok(brkLadderSpeed(89 * TICKS_PER_SECOND, 90) === 20, "a speed line at the buzzer pays any clear in full");
  ok(at(81, 2, true, 60 * TICKS_PER_SECOND).sum === 200 && at(81, 2, true, 60 * TICKS_PER_SECOND).clear === 10, "a clear by 80 s with 2 gold scores 200");
  ok(at(78, 0, false, 0).speed === 0 && at(78, 0, false, 0).clear === 0, "no clear, no clear or speed part");
  const help = JSON.stringify(PUZZLE_INSTRUCTIONS.breaker);
  ok(/15 each \(30 for 2 of the 3\)/.test(help) && /all of it at 79 of the 81/.test(help) && /10 seconds left/.test(help), "the help states Normal's lines (15 a gold brick, 79 of 81, 10 seconds left)");
}

/* ============================== 4. The levels ============================== */
section("The levels as dealt: rows, paddle, bricks, sliding rows, lives and ball");
{
  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = BREAKER_LEVELS[level];
    ok(sorted(GAME_LEVELS.breaker?.levels?.[level]?.settings) === sorted(lv), `${level}: the registry mirrors the sim's table`);
    const game = breakerGameFor(BRK_REV_LADDER, level);
    ok(game === breakerGameFor(BRK_REV_LADDER, level), `${level}: one cached game object`);
    for (const seed of [3, 4242, 301794028]) {
      const s = game.init(seed) as BrkState;
      const tag = `${level} seed ${seed}`;
      ok(s.lad === 1 && s.clear9 === 1 && sorted(s.lv) === sorted(lv), `${tag}: brkRev 13's marker, brkRev 12's ball and multi-ball, the level's row`);
      ok(s.bricks.length === 9 * lv.rows && s.maxHp.length === s.bricks.length && s.gold.length === s.bricks.length && (s.gild ?? []).length === s.bricks.length, `${tag}: ${lv.rows} rows of 9 (${s.bricks.length} bricks)`);
      ok(brkPaddleWOf(s) === lv.paddle, `${tag}: a ${lv.paddle} px paddle`);
      const plain = s.bricks.filter((_, i) => !(s.gild?.[i] === 1) && !((s.gold[i] ?? 0) > 0));
      ok(!lv.oneHit || plain.every((h) => h === 1), `${tag}: every plain brick one hit`);
      ok(s.gild!.filter((g) => g === 1).length === 3, `${tag}: the 3 gold bricks kept`);
      ok((s.slide ?? []).length === (lv.slideRows ?? 2) && new Set(s.slide).size === (s.slide ?? []).length && (s.slide ?? []).every((r) => r >= 3 && r < lv.rows), `${tag}: ${lv.slideRows} distinct sliding rows below the gold (${s.slide})`);
      if (lv.slideFromS !== undefined && (s.slide ?? []).length) {
        const from = lv.slideFromS * TICKS_PER_SECOND;
        ok((s.slide ?? []).every((row) => brkRowOffset(s, row, from) === 0 && brkRowOffset(s, row, from + 30) !== 0), `${tag}: every sliding row moves from ${lv.slideFromS} s`);
      }
      ok(lv.lives ? s.lives === lv.lives : s.lives === undefined, `${tag}: ${lv.lives || "no"} lives`);
      ok(s.speed === Math.trunc((1296 * lv.speedPct) / 100), `${tag}: the ball at ${lv.speedPct} %`);
    }
    // The last ball lost ends the run (a still paddle at the left wall loses the ball).
    if (lv.lives) {
      let s = game.init(4242) as BrkState;
      s = game.step(s, { t: 1, k: ARCADE_INPUT_DRAG, a: 0, b: 0, c: 0, d: 0 }) as BrkState;
      while (!game.isOver(s)) s = game.step(s, null) as BrkState;
      ok(s.out === 1 && s.lives === 0 && s.losses === lv.lives && s.tick < BRK_RUN_TICKS && s.endedTick === s.tick && !s.cleared, `${level}: the run ends when the last of ${lv.lives} balls is lost (at ${(s.tick / 60).toFixed(1)} s, ${s.losses} lost)`);
    }
    const p = breakerLadderParts(game.init(9) as BrkState);
    ok(p.all === 9 * lv.rows && 140 + 10 + 20 + 30 === BRK_V11_MAX, `${level}: four parts of 140, 10, 20 and 30, 200 in all, on the level's own wall`);
  }
  ok(BREAKER_LEVELS.easy.rows < 9 && 9 < BREAKER_LEVELS.hard.rows && BREAKER_LEVELS.hard.rows < BREAKER_LEVELS.expert.rows, "the lever: the wall's rows rise every level (Easy 6, Normal 9, Hard 11, Expert 12)");
  ok(BREAKER_LEVELS.easy.paddle > BRK_PADDLE_W && BRK_PADDLE_W > BREAKER_LEVELS.hard.paddle && BREAKER_LEVELS.hard.paddle > BREAKER_LEVELS.expert.paddle, "the paddle narrows every level");
  ok(!BREAKER_LEVELS.easy.lives && (BREAKER_LEVELS.hard.lives ?? 0) >= (BREAKER_LEVELS.expert.lives ?? 0) && (BREAKER_LEVELS.expert.lives ?? 0) > 0, "a lost ball costs a life on Hard and Expert only (Expert no more lives than Hard)");
  ok(sorted(BREAKER_LEVELS_V12) === sorted({ easy: { speedPct: 108, paddle: 100, rows: 9, cap2: 1, toughRows: 0 }, hard: { speedPct: 104, paddle: 76, rows: 9, cap2: 0, toughRows: 4 }, expert: { speedPct: 108, paddle: 68, rows: 9, cap2: 0, toughRows: 9 } }), "brkRev 12's table kept for brkRev 12's rounds");
  ok(JSON.stringify(brkLadderDropRows(9)) === "[3,4,5]" && brkLadderDropRows(12).length === 0 && JSON.stringify(brkLadderDropRows(11)) === "[3]" && brkLadderDropRows(6).length === 6, "the middle rows left out: 9 rows brkRev 12's [3, 4, 5]");
}

/* ============================== 5. The proof ============================== */
section("The proof: every dealt seed's witness, the human-limited flawless player, scores 200 through the server");
{
  const sets = readBreakerWitnesses();
  ok(sets.map((s) => s.level).join() === BRK_DEAL_LEVELS.join(), "a witness set for every level");
  ok(readFileSync(BRK_DEAL_FILE, "utf8") === breakerDealSource(sets), `${BRK_DEAL_FILE} rebuilds from the witnesses byte for byte`);
  for (const set of sets) {
    ok(sorted(set.witnesses.map((w) => w.seed)) === sorted(BREAKER_LEVEL_DEALS[set.level]) && set.witnesses.length >= 60, `${set.level}: the dealt list is exactly the ${set.witnesses.length} witnessed seeds (at least 60)`);
  }
  const { bad, replayed } = checkBreakerWitnesses(FULL ? undefined : 6);
  ok(bad.length === 0, `${replayed} witnesses replayed through the server's grade at 200 (${bad.slice(0, 5).join("; ")})`);
  for (const set of sets) {
    const w = set.witnesses[Math.floor(set.witnesses.length / 3)]!;
    const log = await breakerProofLog(w.seed, set.level);
    ok(JSON.stringify(log) === JSON.stringify(w.events), `${set.level} seed ${w.seed}: the flawless player held to the human limits plays exactly the stored witness`);
  }
}

/* ============================== 6. The ladder ============================== */
section("Joe's ladder test on the recorded 96-deal table, and a live re-play of it");
{
  for (const [cond, label] of await ladderFixtureVerdicts("breaker")) ok(cond, label);
  for (const [cond, label] of await replaySample("breaker", 2)) ok(cond, label);
}

console.log(`\n${failures.length ? "FAIL" : "PASS"}: ${checks - failures.length} passed, ${failures.length} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (failures.length) process.exit(1);
