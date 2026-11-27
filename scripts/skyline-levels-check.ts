/**
 * High Rise's difficulty levels (15 Nov 2026; docs/arcade-standard/skyline.md "Levels", docs/design/difficulty/README.md).
 *
 *  1. Normal is today's game: Normal deals are byte for byte the deals recorded before the levels
 *     (scripts/fixtures/levels-action-legacy.json.gz, recorded on de3bec96's tree), and runs recorded there on skylineRev 9,
 *     10 and 11 replay to the same score and checkpoint.
 *  2. Each level's rules and stamped settings: the deal stamps `level` on skylineRev 11 (the same seed as Normal's), the
 *     state carries its code, lives, slide, tolerance and wind start, and gameLevels.ts mirrors the sim's table.
 *  3. The 120 s rule: every level's run is 60 s and its clock at most 120 s.
 *  4. Grace at every level: at least 2 lives, and a miss with a life left never ends the run.
 *  5. 200 is reachable at every level: the oracle (scripts/skyline-oracle.ts) scores exactly 200 through the server
 *     replay on tuning seeds 0–29 and fresh seeds 10000–10019 (CHECKS_FULL=1: 0–59 and 10000–10199).
 *  6. Identical worlds: a level's deal and its gusts and block kinds come from the room seed alone; the same log replays
 *     the same for every player; the level changes play (a level's log replayed as Normal is flagged).
 *  7. The switched-off Expert challenge "Skyscraper" (61 floors on Expert) is possible: the oracle builds 61+ floors on
 *     Expert on every seed checked and the challenge's goal is that number.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  skylineCheckpoint,
  skylineGameFor,
  skylineGusts,
  skylineSpeedOf,
  skylineStdParts,
  skylineTolOf,
  skylineWindFrom,
  SKYLINE_LEVEL_CODE,
  SKYLINE_LEVEL_RULES,
  SKYLINE_V12_LEVEL_RULES, // Changed with Joe's approval, 27 Nov 2026 (D5's skylineRev 12: the dealt level rules)
  SKYLINE_PERFECT_TOL,
  SKYLINE_REV_LIVES,
  SKYLINE_REV_FLOORS, // Changed with Joe's approval, 23 Nov 2026 (D5's skylineRev 12)
  SKYLINE_RUN_TICKS,
  SKYLINE_V11_LIVES,
  SKYLINE_V9_FULL_AT,
  SKYLINE_WIND_FROM,
  skylineSpeed,
  type SkylineLevel,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline";
import { pinSkylinePreCount } from "../src/lib/duel/arcade.server"; // Changed with Joe's approval, 23 Nov 2026 (D5's skylineRev 12)
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { CATALOGUE } from "../src/lib/duel/practiceChallenges.data";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { LEVELS_ACTION_LEGACY, type LegacyFixture } from "./levels-action-legacy-record";
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

const LEVELS: SkylineLevel[] = ["easy", "hard", "expert"];
const full = process.env["CHECKS_FULL"] === "1";
const fixture = JSON.parse(gunzipSync(readFileSync(LEVELS_ACTION_LEGACY)).toString()) as LegacyFixture;
const deal = (n: number, level?: SkylineLevel) => {
  const seed = roomSeed(n);
  return withSeededRandom(seed, () => generatePuzzle("skyline", { bankSeed: seed, ...(level ? { level } : {}) }));
};

/* 1. Normal is today's game. */
{
  const deals = fixture.deals["skyline"]!;
  // Changed with Joe's approval, 23 Nov 2026 (routine consequence of D5's skylineRev 12): the fixture's deals are
  // skylineRev 11, so both Normal-deal comparisons deal under the skylinePreCount pin, restored after.
  const wasCount = pinSkylinePreCount(true);
  ok(deals.every((d, n) => JSON.stringify(deal(n)) === d), `Normal deals match the ${deals.length} recorded before the levels, byte for byte`);
  ok(deals.every((d, n) => JSON.stringify(withSeededRandom(roomSeed(n), () => generatePuzzle("skyline", { bankSeed: roomSeed(n), level: "normal" }))) === d), "a deal asked for at Normal is the same");
  pinSkylinePreCount(wasCount); // Changed with Joe's approval, 23 Nov 2026 (D5's skylineRev 12)
  const runs = fixture.runs.filter((r) => r.game === "skyline");
  let same = 0;
  for (const r of runs) {
    const out = replaySkylineRun(r.seed, r.raw, r.rev);
    if (out.score === r.score && JSON.stringify(skylineCheckpoint(out.state)) === JSON.stringify(r.checkpoint) && !out.flagged) same++;
  }
  ok(runs.length >= 30 && same === runs.length, `${same} of ${runs.length} runs recorded before the levels (skylineRev 9–11) replay to the same score and checkpoint`);
  const normal = skylineGameFor(SKYLINE_REV_LIVES).init(roomSeed(1));
  ok(normal.lvl === undefined && skylineGameFor(SKYLINE_REV_LIVES, "normal") === skylineGameFor(SKYLINE_REV_LIVES), "Normal states carry no level and Normal is the skylineRev 11 game itself");
  ok(skylineSpeedOf(normal) === skylineSpeed(0) && skylineTolOf(normal) === SKYLINE_PERFECT_TOL && skylineWindFrom(normal) === SKYLINE_WIND_FROM && normal.lives === SKYLINE_V11_LIVES, "Normal is today's slide, 3 px, wind from 20 and 3 lives");
  ok(SKYLINE_PERFECT_TOL === 3 * 256 && SKYLINE_WIND_FROM === 20 && SKYLINE_V11_LIVES === 3, "today's Normal really is 3 px, wind from block 20, 3 lives");
  for (const older of [9, 10]) ok(skylineGameFor(older, "expert") === skylineGameFor(older), `skylineRev ${older} ignores a level (only skylineRev 11 has levels)`);
}

/* 2. Each level's rules and stamped settings. */
{
  ok(JSON.stringify(levelsOf("skyline")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "High Rise offers Easy, Normal, Hard and Expert");
  for (const level of LEVELS) {
    const r = SKYLINE_LEVEL_RULES[level];
    const settings = gameLevelSettings<Record<string, number>>("skyline", level)!;
    // Changed with Joe's approval, 27 Nov 2026 (routine consequence of D5's skylineRev 12): the registry mirrors the dealt
    // SKYLINE_V12_LEVEL_RULES; skylineRev 11's SKYLINE_LEVEL_RULES is frozen with the sim.
    ok(JSON.stringify(Object.entries(settings).sort()) === JSON.stringify(Object.entries(SKYLINE_V12_LEVEL_RULES[level]).sort()), `${level}: gameLevels.ts mirrors the sim's dealt SKYLINE_V12_LEVEL_RULES`);
    const p = deal(3, level);
    const normalDeal = deal(3);
    ok(puzzleLevel(p) === level && p.type === "skyline" && p.skylineRev === SKYLINE_REV_FLOORS, `${level}: the deal stamps level "${level}" on skylineRev 12`); // Changed with Joe's approval, 23 Nov 2026 (D5's skylineRev 12)
    ok(p.type === "skyline" && normalDeal.type === "skyline" && p.seed === normalDeal.seed, `${level}: the same seed as Normal's deal for the room seed`);
    const s = skylineGameFor(SKYLINE_REV_LIVES, level).init(p.type === "skyline" ? p.seed : 1);
    ok(s.lvl === SKYLINE_LEVEL_CODE[level] && s.lives === r.lives, `${level}: the state carries its code and ${r.lives} lives`);
    ok(skylineSpeedOf(s) === r.speedStart && skylineSpeedOf({ ...s, placed: 10 }) === Math.min(r.speedMax, r.speedStart + 10 * r.speedStep) && skylineSpeedOf({ ...s, placed: 500 }) === r.speedMax, `${level}: slide ${r.speedStart} + ${r.speedStep} a floor up to ${r.speedMax}`);
    ok(skylineTolOf(s) === r.tol && skylineWindFrom(s) === r.windFrom, `${level}: ${r.tol / 256} px tolerance, wind from block ${r.windFrom}`);
  }
  const e = SKYLINE_LEVEL_RULES;
  ok(e.easy.tol === 5 * 256 && e.easy.windFrom === 30 && e.easy.lives === 3 && e.easy.speedMax < skylineSpeed(1000), "Easy: slower slide, 5 px, wind from 30, 3 lives (Joe's table)");
  // Changed with Joe's approval, 16 Nov 2026 (routine consequence of the Action overhaul): Hard and Expert keep 3 lives
  // (were 2); Expert stays harder than Hard by its slide, its 2 px tolerance and its earlier wind.
  ok(e.hard.tol === 3 * 256 && e.hard.windFrom === 15 && e.hard.lives === 3 && e.hard.speedStart > skylineSpeed(0) && e.hard.speedMax > skylineSpeed(1000), "Hard: faster slide, 3 px, wind from 15, 3 lives");
  ok(e.expert.tol === 2 * 256 && e.expert.windFrom === 10 && e.expert.lives === 3 && e.expert.speedStart > e.hard.speedStart && e.expert.speedMax > e.hard.speedMax, "Expert: the fastest slide, 2 px, wind from 10, 3 lives");
  // The tolerance decides a perfect drop: a block 4 px off the tower is perfect on Easy and not on Normal.
  const base = skylineGameFor(SKYLINE_REV_LIVES).init(7);
  const below = base.blocks[0]!;
  const at = (g: ReturnType<typeof skylineGameFor>, off: number) => {
    const st = { ...g.init(7), x: below.x + off };
    return g.step(st, true).perfects;
  };
  ok(at(skylineGameFor(SKYLINE_REV_LIVES, "easy"), 4 * 256) === 1 && at(skylineGameFor(SKYLINE_REV_LIVES), 4 * 256) === 0, "a drop 4 px off is perfect on Easy (5 px) and trimmed on Normal (3 px)");
  ok(at(skylineGameFor(SKYLINE_REV_LIVES, "expert"), 2 * 256 + 1) === 0 && at(skylineGameFor(SKYLINE_REV_LIVES, "hard"), 2 * 256 + 1) === 1, "a drop just over 2 px off is trimmed on Expert (2 px) and perfect on Hard (3 px)");
  // Wind: the flag rule reads the level's start.
  for (const level of LEVELS) {
    const g = skylineGameFor(SKYLINE_REV_LIVES, level);
    const st = g.init(11);
    const gusts = st.gusts ?? [];
    const t = gusts[0]!;
    const before = { ...st, placed: SKYLINE_LEVEL_RULES[level].windFrom - 1, tick: t };
    const after = { ...st, placed: SKYLINE_LEVEL_RULES[level].windFrom, tick: t };
    const gustAt = (s: SkylineState) => g.step({ ...s, x: 30_000, dir: 1 }, false).x - 30_000 - skylineSpeedOf(s);
    ok(gustAt(before) === 0 && gustAt(after) !== 0, `${level}: gusts blow from block ${SKYLINE_LEVEL_RULES[level].windFrom}, not before`);
  }
}

/* 3. The 120 s rule. */
for (const level of ["normal", ...LEVELS] as const) {
  const p = deal(5, level === "normal" ? undefined : level);
  const g = skylineGameFor(SKYLINE_REV_LIVES, level);
  ok(g.runTicks === SKYLINE_RUN_TICKS && SKYLINE_RUN_TICKS === 3600 && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level}: a 60 s run on a clock of ${puzzleTimeLimitMs(p) / 1000} s (at most 120 s)`);
}

/* 4. Grace at every level. */
for (const level of ["normal", ...LEVELS] as const) {
  const g = skylineGameFor(SKYLINE_REV_LIVES, level);
  const s0 = g.init(13);
  ok((s0.lives ?? 0) >= 2, `${level}: ${s0.lives} lives (at least 2: no run ends on the first miss)`);
  // A miss: the top block far right, the sliding block at the left edge.
  const tower = { ...s0, blocks: [...s0.blocks, { x: 90_000, w: 4_000 }], x: 0, w: 4_000, dir: 1 };
  const missed = g.step(tower, true);
  ok(!g.isOver(missed) && missed.lives === (s0.lives ?? 0) - 1 && missed.placed === 0, `${level}: a miss with lives left costs a life and the run goes on`);
}

/* 5. 200 is reachable at every level (the oracle through the server replay). */
const tuning = Array.from({ length: full ? 60 : 30 }, (_, n) => n);
const fresh = Array.from({ length: full ? 200 : 20 }, (_, n) => 10000 + n);
const floorsOnExpert: number[] = [];
for (const level of LEVELS) {
  let at200 = 0;
  let total = 0;
  const misses: string[] = [];
  for (const n of [...tuning, ...fresh]) {
    const p = deal(n, level);
    if (p.type !== "skyline") continue;
    const g = skylineGameFor(p.skylineRev, puzzleLevel(p));
    const run = skylineOracle(g, p.seed);
    let s = g.init(p.seed);
    const taps = new Set(run.taps);
    const checkpoints: unknown[] = [];
    while (!g.isOver(s)) {
      s = g.step(s, taps.has(s.tick + 1));
      if (s.tick % 300 === 0) checkpoints.push(skylineCheckpoint(s));
    }
    const raw = encodeSkylineRun({ seed: p.seed, claimedScore: g.score(s), inputs: run.taps, endTick: s.tick, checkpoints } as never);
    const graded = gradeAnswer(p, raw, 0);
    total++;
    if (graded.score === 200 && !(graded.extra as { flagged?: boolean } | undefined)?.flagged) at200++;
    else misses.push(`${n}=${graded.score}`);
    const parts = skylineStdParts(s)!;
    if (parts.reduce((a, q) => a + q.max, 0) !== 200) misses.push(`${n}: parts sum ${parts.reduce((a, q) => a + q.max, 0)}`);
    if (level === "expert") floorsOnExpert.push(s.placed);
    // 6. Identical worlds: the same log replays the same (two players), and as Normal it is flagged.
    if (n === tuning[0]) {
      const again = gradeAnswer(deal(n, level), raw, 0);
      ok(again.score === graded.score, `${level}: the same log on the same deal scores the same for every player`);
      const asNormal = replaySkylineRun(p.seed, raw, p.skylineRev);
      ok(asNormal.flagged, `${level}: the level's log replayed as Normal is flagged (the level changes play)`);
    }
  }
  ok(at200 === total, `${level}: the oracle scores exactly 200 through the server replay on ${at200} of ${total} seeds${misses.length ? ` (${misses.slice(0, 8).join(", ")})` : ""}`);
}

/* 6. Identical worlds. */
for (const level of LEVELS) {
  ok(JSON.stringify(deal(9, level)) === JSON.stringify(deal(9, level)), `${level}: a room seed deals the same puzzle every time`);
  const a = skylineGameFor(SKYLINE_REV_LIVES, level).init(4242);
  const b = skylineGameFor(SKYLINE_REV_LIVES, level).init(4242);
  ok(JSON.stringify(a) === JSON.stringify(b), `${level}: the world (gusts, block kinds) comes from the seed alone`);
  ok(JSON.stringify(a.gusts) === JSON.stringify(skylineGusts(4242)) && JSON.stringify(a.kinds) === JSON.stringify(skylineGameFor(SKYLINE_REV_LIVES).init(4242).kinds), `${level}: the same gusts and block kinds as Normal for the seed`);
}

/* 7. The Expert challenge "Skyscraper" is possible. */
{
  const ch = CATALOGUE.find((c) => c.type === "skyline" && c.name === "Skyscraper");
  ok(ch && ch.level === "expert" && /61 floors on Expert/.test(ch.text) && SKYLINE_V9_FULL_AT === 61, "Skyscraper is 61 floors on Expert (the Floors part full)");
  const short = floorsOnExpert.filter((f) => f < 61).length;
  ok(floorsOnExpert.length > 0 && short === 0, `the oracle builds 61+ floors on Expert on every seed checked (fewest ${Math.min(...floorsOnExpert)})`);
}

console.log(failures ? `FAIL: ${failures} of ${passes + failures} skyline-levels checks` : `skyline-levels-check: ${passes} checks passed`);
process.exit(failures ? 1 : 0);
