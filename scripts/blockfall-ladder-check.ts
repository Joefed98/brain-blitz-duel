/**
 * blockfall-ladder-check (~35 s; CHECKS_FULL=1 ~25 min, by hand): Blockzone's levels on blockfallRev 3 (D5's ladder, 23 Nov 2026;
 * docs/arcade-standard/blockfall.md "Levels (D5, 23 Nov 2026)"). Normal is unchanged (blockfallRev 2, its own deal).
 *
 *  1. Older rounds: the legacy fixture (scripts/fixtures/blockfall-ladder-legacy.json.gz, recorded before blockfallRev 3
 *     by scripts/blockfall-ladder-legacy-record.ts: blockfallRev 2 at every level, blockfallRev 1 at Normal) regrades
 *     exactly: score, verdict, stored extra and the replay's final checkpoint. blockfallRev 2's level table is unchanged.
 *  2. The stamp and the pin: Normal deals blockfallRev 2 from its deal with no level field (byte for byte the deal with
 *     no level asked); Easy, Hard and Expert deal blockfallRev 3, each a seed from its own proved list; the era pin
 *     blockfallPreLevels deals the levels on blockfallRev 2 from Normal's deal exactly as before; DEAL_PINS lists it.
 *  3. The levels as dealt: the registry (GAME_LEVELS) is the sim's table (BLOCKFALL_LEVELS_V3); the gravity at each of
 *     the six steps (Easy 72 → 36 ticks a row, Hard 12 → 6, Expert 7 → 4), the lock delay, the previews (the queue always
 *     holds them), the lines and Easy's low stack; Hard and Expert add no aid; the play is Blockzone's otherwise.
 *  4. The proof: the oracle held to the human limits (scripts/blockfall-limited-oracle.ts) scores exactly 200 through the
 *     server replay, its log keeping the limits, on a sample of every level's dealt seeds; with CHECKS_FULL=1 the deal
 *     file is rebuilt byte for byte (scripts/blockfall-level-deal.ts --check), which re-runs the oracle on every
 *     candidate, so every dealt seed is re-proved.
 *  5. The ladder: Joe's ladder test on the recorded 288-deal ladder (scripts/fixtures/d5-ladder-blockfall.json.gz,
 *     `bun scripts/d5-ladder-record.ts blockfall --deals=288`), and a sample re-played live scoring as recorded.
 *  6. The lever picture draws the level's own gravity and previews.
 *
 *   bun scripts/blockfall-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  BF_INPUT_DROP, BF_LOCK_TICKS, BF_PREVIEW, BF_ZONE_CORE_FULL, BF_ZONE_GRAVITY, BLOCKFALL_REV_LEVELS, BLOCKFALL_REV_ZONE, bfApply, bfCheckpoint, bfPreviewsOf, bfZoneGravityOf,
  bfZoneLowPoints, blockfallGameFor, blockfallStdParts, type BfState,
} from "../src/lib/arcade/blockfall";
import { BLOCKFALL_LEVELS, BLOCKFALL_LEVELS_V3, RETRO_LEVEL_TABLES } from "../src/lib/arcade/retroLevels";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { pinBlockfallPreLevels } from "../src/lib/duel/arcade.server";
import { BLOCKFALL_DEAL_V2 } from "../src/lib/duel/blockfallDealV2.server";
import { BLOCKFALL_LEVEL_DEALS } from "../src/lib/duel/blockfallLevelDeals.server";
import { DEAL_PINS } from "../src/lib/duel/dealEra";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS, levelsOf } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { BlockfallPicture, blockfallWords } from "../src/lib/levels/pictures/retro-action/blockfall";
import { BLOCKFALL_LADDER_LEGACY, blockfallFinalCheckpoint, stableExtra, type BlockfallLegacyFixture } from "./blockfall-ladder-legacy-record";
import { BLOCKFALL_LEVEL_DEAL_SIZE, blockfallLevelProof } from "./blockfall-level-deal";
import { hashSeed } from "./blockfall-deal";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

console.error = () => {};
const FULL = process.env.CHECKS_FULL === "1";
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
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
const OFF = ["easy", "hard", "expert"] as const;
const loose = (p: PuzzleData) => p as unknown as { seed: number; blockfallRev?: number; level?: string };
const json = (x: unknown) => JSON.stringify(x);

section("1. Older rounds grade exactly as recorded (blockfallRev 2 at every level, 1 at Normal)");
const legacy = JSON.parse(gunzipSync(readFileSync(BLOCKFALL_LADDER_LEGACY)).toString()) as BlockfallLegacyFixture;
{
  ok(legacy.runs.length === 129 && LEVELS.every((l) => legacy.runs.filter((r) => r.level === l && r.rev === 2).length === 30), `the legacy fixture holds 30 blockfallRev 2 runs at each level and 9 blockfallRev 1 ones (${legacy.runs.length})`);
  let same = 0;
  for (const r of legacy.runs) {
    const p = JSON.parse(r.puzzle) as PuzzleData;
    const g = gradeAnswer(p, r.raw, 0);
    if (g.score === r.score && g.isCorrect === r.isCorrect && stableExtra(g.extra) === r.extra && json(blockfallFinalCheckpoint(p, r.raw)) === json(r.checkpoint)) same++;
    else ok(false, `legacy ${r.level} blockfallRev ${r.rev} deal ${r.n} ${r.kind}: ${r.score} → ${g.score}`);
  }
  ok(same === legacy.runs.length, `${same} of ${legacy.runs.length} legacy runs regrade exactly (score, verdict, extra, final checkpoint)`);
  ok(
    json(BLOCKFALL_LEVELS) === json({ easy: { gravityPct: 125, lockDelay: 40, previews: 3, fullAt: 40 }, hard: { gravityPct: 80, lockDelay: 24, previews: 2, fullAt: 57 }, expert: { gravityPct: 60, lockDelay: 18, previews: 1, fullAt: 62 } }),
    "blockfallRev 2's level table (stored level rounds replay on it) is unchanged",
  );
  for (const level of OFF) ok(json(blockfallGameFor(2, level).init(77).lv) === json(BLOCKFALL_LEVELS[level]), `blockfallRev 2 ${level} still plays its own row`);
}

section("2. The stamp and the pin");
{
  ok(BLOCKFALL_REV_LEVELS === 3 && BLOCKFALL_REV_ZONE === 2, "blockfallRev 3 for the levels, 2 for Normal");
  const deal = (level: Level | null, seed: number) => withSeededRandom(seed, () => generatePuzzle("blockfall", { bankSeed: seed, ...(level ? { level } : {}) }));
  for (const seed of [7, 99, 4242, 31337]) {
    const n = deal("normal", seed);
    ok(json(deal(null, seed)) === json(n) && !("level" in (n as object)) && loose(n).blockfallRev === 2 && BLOCKFALL_DEAL_V2.includes(loose(n).seed), `seed ${seed}: Normal is blockfallRev 2 from its deal, the deal with no level asked, with no level field`);
    for (const level of OFF) {
      const p = loose(deal(level, seed));
      ok(p.blockfallRev === 3 && p.level === level && BLOCKFALL_LEVEL_DEALS[level].includes(p.seed), `seed ${seed} ${level}: blockfallRev 3 on a seed of its own proved list`);
    }
  }
  const was = pinBlockfallPreLevels(true);
  try {
    const rec = legacy.runs.filter((r) => r.rev === 2 && r.kind === "average");
    ok(rec.length === 24 && rec.every((r) => json(dealAt("blockfall", r.level, r.n)) === r.puzzle), `pinned blockfallPreLevels, every recorded blockfallRev 2 deal is dealt again byte for byte (${rec.length})`);
  } finally {
    pinBlockfallPreLevels(was);
  }
  ok("blockfallPreLevels" in DEAL_PINS, "DEAL_PINS lists blockfallPreLevels");
  ok(LIVE_BANDS.blockfall.rev === 2 && PRACTICE_STAMPS.blockfall.includes("blockfallRev=2"), "Normal's stamp is still blockfallRev 2 (LIVE_BANDS, practice stamps)");
}

section("3. The levels as dealt");
{
  ok(json(levelsOf("blockfall")) === json(["easy", "normal", "hard", "expert"]), "Blockzone offers all four levels");
  ok(RETRO_LEVEL_TABLES.blockfall === BLOCKFALL_LEVELS_V3, "the Retro table is blockfallRev 3's");
  for (const level of OFF) ok(json(GAME_LEVELS.blockfall!.levels[level]!.settings) === json(BLOCKFALL_LEVELS_V3[level]), `the registry's ${level} is the sim's row`);
  const steps = (level: (typeof OFF)[number]) => {
    const s = blockfallGameFor(3, level).init(1);
    return BF_ZONE_GRAVITY.map((_, i) => bfZoneGravityOf(s, i));
  };
  ok(json(steps("easy")) === json([72, 63, 54, 47, 41, 36]), `Easy: a row every 72 ticks quickening to 36 (${steps("easy").join(", ")})`);
  ok(json(steps("hard")) === json([12, 11, 9, 8, 7, 6]), `Hard: a row every 12 ticks quickening to 6 (${steps("hard").join(", ")})`);
  ok(json(steps("expert")) === json([7, 6, 5, 5, 4, 4]), `Expert: a row every 7 ticks quickening to 4 (${steps("expert").join(", ")})`);
  const want = { easy: { lock: 45, previews: 5, full: 15 }, hard: { lock: 15, previews: 2, full: 51 }, expert: { lock: 12, previews: 1, full: 51 } };
  for (const level of OFF) {
    const lv = BLOCKFALL_LEVELS_V3[level];
    const s = blockfallGameFor(3, level).init(5);
    ok(lv.lockDelay === want[level].lock && bfPreviewsOf(s) === want[level].previews && lv.fullAt === want[level].full, `${level}: lock delay ${lv.lockDelay}, ${bfPreviewsOf(s)} previews, lines full at ${lv.fullAt}`);
    ok(s.rev === BLOCKFALL_REV_ZONE && s.lv === lv, `${level}: Blockzone's play (the state's rules) with the level's row on it`);
    // The queue always holds the previews shown: drop pieces on an empty well for three bags.
    let st: BfState = s;
    let held = true;
    for (let i = 0; i < 24; i++) {
      st = bfApply({ ...st, board: st.board.map(() => 0) }, { k: BF_INPUT_DROP, a: 0 });
      if (st.queue.length < bfPreviewsOf(st)) held = false;
    }
    ok(held, `${level}: the queue always holds the ${bfPreviewsOf(s)} pieces shown`);
  }
  for (const level of ["hard", "expert"] as const) {
    const lv = BLOCKFALL_LEVELS_V3[level];
    ok(lv.gravityPct < 100 && lv.lockDelay <= BF_LOCK_TICKS && lv.previews <= BF_PREVIEW && lv.fullAt >= BF_ZONE_CORE_FULL, `${level} adds no aid: faster, a lock delay no longer, no more previews, Normal's lines`);
  }
  const xs = blockfallGameFor(3, "expert").init(1);
  ok(bfZoneLowPoints(xs, 5) === 16 && bfZoneLowPoints(xs, 6) < 16 && bfZoneLowPoints(xs, 11) === 0, "Expert's low stack is full in the bottom 5 rows, nothing from row 11");
  const e = BLOCKFALL_LEVELS_V3.easy;
  const es = blockfallGameFor(3, "easy").init(1);
  ok(e.gravityPct > 100 && e.lockDelay > BF_LOCK_TICKS && e.previews > BF_PREVIEW && bfZoneLowPoints(es, 10) === 16 && bfZoneLowPoints(es, 16) === 0 && bfZoneLowPoints(blockfallGameFor(3, "hard").init(1), 4) === 16 && bfZoneLowPoints(blockfallGameFor(3, "hard").init(1), 5) < 16, "Easy is welcoming (slower, a longer lock delay, more previews, the low stack full in the bottom 10 rows); Hard's low stack is Normal's (full at 4)");
  const parts = blockfallStdParts({ ...blockfallGameFor(3, "expert").init(3), lines: 51, pieces: 65, quads: 2, ended: 1, acted: 1 });
  ok(parts!.reduce((a, p) => a + p.max, 0) === 200, "the parts' maxima sum to 200");
}

section("4. The proof: the oracle held to the human limits, 200 through the server replay");
{
  for (const level of OFF) {
    const list = BLOCKFALL_LEVEL_DEALS[level];
    ok(list.length === BLOCKFALL_LEVEL_DEAL_SIZE && new Set(list).size === list.length, `${level}: ${list.length} distinct proved seeds`);
    // CHECKS_FULL=1 re-proves every seed through the rebuild below; here a tenth of each list.
    const sample = list.filter((_, i) => i % 30 === 0);
    let at200 = 0;
    for (const seed of sample) if (blockfallLevelProof(seed, level) === 200) at200++;
    ok(at200 === sample.length, `${level}: the oracle held to the human limits scores 200 (its log within the limits) on ${at200}/${sample.length} dealt seeds`);
    if (!FULL) {
      let n = 0;
      let first = 0;
      while (!first) {
        if (blockfallLevelProof(hashSeed(n), level) === 200) first = hashSeed(n);
        n++;
      }
      ok(list[0] === first, `${level}: the list starts at the builder's first proved candidate (${first})`);
    }
  }
  if (FULL) {
    const r = spawnSync("bun", ["scripts/blockfall-level-deal.ts", "--check"], { encoding: "utf8" });
    ok(r.status === 0, `the deal file rebuilds byte for byte, every dealt seed re-proved (${(r.stdout ?? "").trim().split("\n").pop()})`);
  }
  // The checkpoint folds Blockzone's own fields (a level state's run is replay-checked like Normal's).
  const s = blockfallGameFor(3, "hard").init(9);
  ok(typeof bfCheckpoint(s).checksum === "number", "a level state checkpoints as Blockzone's");
}

section("5. The ladder (288 deals a level, recorded) and a live re-play of it");
{
  for (const [cond, label] of await ladderFixtureVerdicts("blockfall")) ok(cond, label);
  for (const [cond, label] of await replaySample("blockfall", 2)) ok(cond, label);
}

section("5b. The phone and the server agree on every level (random play, blockfallRev 3)");
{
  const { encodeEvents, randomBlockfallEvents } = await import("./blockfall-ladder-legacy-record");
  for (const level of OFF) {
    let agree = 0;
    for (let k = 0; k < 4; k++) {
      const seed = BLOCKFALL_LEVEL_DEALS[level][k * 37]!;
      const puzzle = { type: "blockfall", seed, blockfallRev: 3, level } as unknown as PuzzleData;
      const raw = encodeEvents(puzzle, randomBlockfallEvents(seed + k, blockfallGameFor(3, level).runTicks, 2));
      const r = gradeAnswer(puzzle, raw, 0);
      const extra = r.extra as { flagged?: boolean; desyncTick?: number | null };
      if (!extra.flagged && extra.desyncTick == null && r.score >= 1) agree++;
    }
    ok(agree === 4, `${level}: random play replays on the server with no desync, unflagged (${agree}/4)`);
  }
}

section("6. The lever picture");
{
  for (const level of LEVELS) {
    const ticks = level === "normal" ? 48 : Math.round((48 * BLOCKFALL_LEVELS_V3[level].gravityPct) / 100);
    const previews = level === "normal" ? 3 : BLOCKFALL_LEVELS_V3[level].previews;
    for (const size of ["l", "s"] as const) {
      const html = renderToStaticMarkup(createElement(BlockfallPicture, { level, size }));
      ok(html.includes(`data-ticks-a-row="${ticks}"`) && html.includes(`data-previews="${previews}"`) && (html.match(/key=|<rect/g) ?? []).length >= previews + 9 && !/#[0-9a-fA-F]{3,6}\b/.test(html), `the lever picture at ${level} (${size}): a row every ${ticks} ticks, ${previews} previews, colours only through tokens`);
    }
    ok(blockfallWords(level).length > 0 && blockfallWords(level).length <= 40, `the lever's words at ${level}: "${blockfallWords(level)}"`);
  }
}

console.log(`\n${failures.length ? "FAIL" : "PASS"} blockfall-ladder-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
