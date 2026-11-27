/**
 * skyline-ladder-check (~1.5 min; D5, 23 Nov 2026; docs/arcade-standard/skyline.md "Levels (D5, 23 Nov 2026)"): High
 * Rise's difficulty ladder on skylineRev 12, the width of the blocks.
 *
 *  1. The stamp and the pin: every level deals skylineRev 12 (the level stamped off Normal, a Normal deal byte for byte the
 *     deal with no level asked); skylinePreCount deals skylineRev 11 at every level, its levels on SKYLINE_LEVEL_RULES.
 *  2. The level rules as dealt: each level's state starts with its own block width (260, 110 and 50 px), slide, tolerance,
 *     lives, wind start and rescue count; a perfect drop and a wide block grow the tower back only to the level's width;
 *     Easy has no wind; the registry (GAME_LEVELS.skyline) mirrors SKYLINE_V12_LEVEL_RULES; each level scores its four
 *     parts on its own full lines (200 in all).
 *  3. The proved deal: src/lib/duel/skylineDealV12.server.ts rebuilds byte for byte (scripts/skyline-ladder-deal.ts), so
 *     every seed it deals at every level was taken to exactly 200 through the server replay by the oracle held to the human
 *     limits (no drop sooner than 0.25 s after its block came in, taps at least 0.15 s apart); a sample re-proved here
 *     through gradeAnswer, the taps checked against the limits.
 *  4. the recorded ladder (scripts/fixtures/d5-ladder-skyline.json.gz, 96 deals a level, both
 *     players): the average player steps down every level, no cliff, the realistic elite reaches 200 strictly less often
 *     each level up and on at least a fifth of Expert runs; and the recorded table is today's game (two runs a level and
 *     player re-played live score exactly as recorded).
 *  5. Grace and the 120 s rule at every level; the Expert challenge Skyscraper (61 floors) stays possible: the limited
 *     oracle builds 61+ floors on every Expert seed it plays here.
 */
import { readFileSync } from "node:fs";
import {
  skylineCheckpoint,
  skylineGameFor,
  skylineGustAt,
  skylineKindWidth,
  skylineLinesOf,
  skylineMaxWOf,
  skylineSpeedOf,
  skylineStdParts,
  skylineTolOf,
  skylineTrimRunOf,
  skylineWindFrom,
  SKYLINE_KIND_WIDE,
  SKYLINE_LEVEL_CODE,
  SKYLINE_LEVEL_RULES,
  SKYLINE_REV_FLOORS,
  SKYLINE_REV_LIVES,
  SKYLINE_RUN_TICKS,
  SKYLINE_START_W,
  SKYLINE_STD_SPEC_V12,
  SKYLINE_V12_LEVEL_RULES,
  SKYLINE_V12_LINES,
  SKYLINE_WORLD_RIGHT,
  type SkylineLevel,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { pinSkylinePreCount } from "../src/lib/duel/arcade.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { SKYLINE_V12_DEAL } from "../src/lib/duel/skylineDealV12.server";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { replaySample } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { buildSkylineDeal, skylineDealSource, skylineDealtPuzzle, skylineProofRun, SKYLINE_DEAL_CANDIDATES, SKYLINE_DEAL_FILE, SKYLINE_DEAL_LEVELS } from "./skyline-ladder-deal";

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
const LEVELS: SkylineLevel[] = ["easy", "hard", "expert"];
const loose = (p: unknown) => p as { seed: number; skylineRev?: number; level?: string };
const t0 = Date.now();

section("1. The stamp and the pin");
{
  for (const level of ["normal", ...LEVELS] as const) {
    const p = dealAt("skyline", level, 3);
    ok(loose(p).skylineRev === SKYLINE_REV_FLOORS && puzzleLevel(p) === level, `${level}: the deal is skylineRev 12${level === "normal" ? "" : ` stamped "${level}"`}`);
    ok((SKYLINE_V12_DEAL[level] as readonly number[]).includes(loose(p).seed), `${level}: its seed is on the level's proved deal`);
  }
  for (const seed of [7, 99, 4242]) {
    const a = withSeededRandom(seed, () => generatePuzzle("skyline", { bankSeed: seed }));
    const b = withSeededRandom(seed, () => generatePuzzle("skyline", { bankSeed: seed, level: "normal" }));
    ok(JSON.stringify(a) === JSON.stringify(b) && !("level" in (a as object)), `seed ${seed}: a Normal deal is the deal with no level asked`);
  }
  const prev = pinSkylinePreCount(true);
  try {
    for (const level of ["normal", ...LEVELS] as const) {
      const p = dealAt("skyline", level, 3);
      ok(loose(p).skylineRev === SKYLINE_REV_LIVES && puzzleLevel(p) === level, `${level}: with skylinePreCount pinned the deal is skylineRev 11`);
    }
  } finally {
    pinSkylinePreCount(prev);
  }
  for (const level of LEVELS) {
    const s = skylineGameFor(SKYLINE_REV_LIVES, level).init(11);
    const r = SKYLINE_LEVEL_RULES[level];
    ok(s.ladder === undefined && s.blocks[0]!.w === SKYLINE_START_W && skylineSpeedOf(s) === r.speedStart && skylineTolOf(s) === r.tol && skylineWindFrom(s) === r.windFrom, `${level} on skylineRev 11: 200 px blocks and the frozen SKYLINE_LEVEL_RULES (slide ${r.speedStart}, ${r.tol / 256} px, wind from ${r.windFrom})`);
  }
}

section("2. The level rules as dealt");
{
  ok(JSON.stringify(levelsOf("skyline")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "High Rise offers Easy, Normal, Hard and Expert");
  const sorted = (o: unknown): unknown => (o && typeof o === "object" ? Object.fromEntries(Object.entries(o as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, sorted(v)])) : o);
  const px = (fp: number) => fp / 256;
  ok(px(SKYLINE_V12_LEVEL_RULES.easy.startW) === 260 && px(SKYLINE_V12_LEVEL_RULES.hard.startW) === 110 && px(SKYLINE_V12_LEVEL_RULES.expert.startW) === 50, "the lever: blocks start 260 px (Easy), 110 px (Hard) and 50 px (Expert) wide (Normal 200)");
  const e = SKYLINE_V12_LEVEL_RULES.easy;
  ok(e.speedStart === 320 && e.speedMax === 640 && e.tol === 5 * 256 && e.windFrom === null && e.trimRun === 3 && e.lives === 3, "Easy: slide 1.25 px a tick rising to 2.5, perfect within 5 px, no wind, the rescue after 3 trims, 3 lives");
  for (const level of ["hard", "expert"] as const) {
    const r = SKYLINE_V12_LEVEL_RULES[level];
    ok(r.speedStart === 768 && r.speedStep === 26 && r.speedMax === 1536 && r.tol === 3 * 256 && r.trimRun === 5 && r.lives === 3, `${level}: Normal's slide (3 → 6 px a tick) and 3 px window, the rescue after 5 trims, 3 lives`);
  }
  ok(SKYLINE_V12_LEVEL_RULES.hard.windFrom === 8 && SKYLINE_V12_LEVEL_RULES.expert.windFrom === 0, "wind from block 8 on Hard and from the first block on Expert");
  for (const level of LEVELS) {
    const r = SKYLINE_V12_LEVEL_RULES[level];
    ok(JSON.stringify(sorted(gameLevelSettings("skyline", level))) === JSON.stringify(sorted(r)), `${level}: gameLevels.ts mirrors the sim's SKYLINE_V12_LEVEL_RULES`);
    const g = skylineGameFor(SKYLINE_REV_FLOORS, level);
    const s = g.init(4242);
    ok(s.lvl === SKYLINE_LEVEL_CODE[level] && s.ladder === 1 && s.fullLines === 1 && s.lives === r.lives, `${level}: the state carries its code, the ladder's mark and ${r.lives} lives`);
    ok(s.blocks.length === 1 && s.blocks[0]!.w === r.startW && s.blocks[0]!.x === (SKYLINE_WORLD_RIGHT - r.startW) >> 1 && s.w === r.startW && (s.x === 0 || s.x === SKYLINE_WORLD_RIGHT - r.startW), `${level}: the base and the first block are ${r.startW / 256} px, the base centred`);
    ok(skylineMaxWOf(s) === r.startW && skylineTrimRunOf(s) === r.trimRun && JSON.stringify(skylineLinesOf(s)) === JSON.stringify(r.lines), `${level}: the cap, the rescue's count and the full lines are the table's`);
    ok(skylineSpeedOf(s) === r.speedStart && skylineSpeedOf({ ...s, placed: 10 }) === Math.min(r.speedMax, r.speedStart + 10 * r.speedStep) && skylineSpeedOf({ ...s, placed: 500 }) === r.speedMax && skylineTolOf(s) === r.tol, `${level}: slide ${r.speedStart} + ${r.speedStep} a floor up to ${r.speedMax}, ${r.tol / 256} px`);
    // A perfect drop on a full-width tower stays at the level's width; a wide block never goes past it.
    const below = s.blocks[0]!;
    const perfect = g.step({ ...s, x: below.x }, true);
    ok(perfect.perfects === 1 && perfect.blocks[1]!.w === r.startW, `${level}: a perfect drop at full width keeps the tower at ${r.startW / 256} px (no regrowth past the level's width)`);
    ok(skylineKindWidth(SKYLINE_KIND_WIDE, r.startW - 256, skylineMaxWOf(s)) === r.startW && skylineKindWidth(SKYLINE_KIND_WIDE, r.startW - 20 * 256, skylineMaxWOf(s)) === Math.min(r.startW, r.startW - 20 * 256 + 12_288), `${level}: a wide block is capped at the level's width`);
    // The gusts: blowing from the level's block on, never on Easy.
    const gusts = s.gusts ?? [];
    const t = gusts[0]! + 1;
    const blows = (placed: number) => skylineGustAt({ ...s, placed }, t) !== 0;
    if (r.windFrom === null) ok(!blows(0) && !blows(40) && !blows(95) && skylineWindFrom(s) > 1000, `${level}: no wind at any height`);
    else ok((r.windFrom === 0 || !blows(r.windFrom - 1)) && blows(r.windFrom), `${level}: gusts blow from block ${r.windFrom}${r.windFrom ? ", not before" : ""}`);
    // The rescue: the next block is wide after the level's count of trims in a row.
    const trims = r.trimRun;
    let st: SkylineState = { ...s, kinds: (s.kinds ?? []).map(() => 0) };
    for (let k = 0; k < trims; k++) {
      const top = st.blocks[st.blocks.length - 1]!;
      st = g.step({ ...st, x: top.x + r.tol + 2 * 256, w: top.w }, true);
    }
    ok(st.rescues === 1 && st.trimRun === 0, `${level}: the wide-block rescue after ${trims} trims in a row`);
    // The parts: four, 200 in all, on the level's lines.
    const L = r.lines;
    const at = (over: Partial<SkylineState>) => ({ ...s, acted: 1, ...over });
    const top = at({ placed: L.floors, perfects: L.perfects, bestStreak: L.streak, golds: L.gold });
    const short = at({ placed: L.floors - 1, perfects: L.perfects, bestStreak: L.streak, golds: L.gold });
    ok(skylineStdParts(top)!.reduce((a, p) => a + p.max, 0) === 200 && g.score(top) === 200 && g.score(short) < 200, `${level}: ${L.floors} floors, ${L.perfects} perfect drops, ${L.streak} in a row and ${L.gold} gold blocks score 200 (one floor less does not)`);
  }
  ok(JSON.stringify(skylineLinesOf(skylineGameFor(SKYLINE_REV_FLOORS).init(1))) === JSON.stringify(SKYLINE_V12_LINES) && SKYLINE_STD_SPEC_V12.parts.length === 4, "Normal scores on SKYLINE_V12_LINES");
  ok(skylineMaxWOf(skylineGameFor(SKYLINE_REV_FLOORS).init(1)) === SKYLINE_START_W && skylineTrimRunOf(skylineGameFor(SKYLINE_REV_FLOORS).init(1)) === 5, "Normal: 200 px and the rescue after 5 trims, as skylineRev 11");
}

section("3. The proved deal");
{
  const built = buildSkylineDeal();
  ok(readFileSync(SKYLINE_DEAL_FILE, "utf8") === skylineDealSource(built), `${SKYLINE_DEAL_FILE} rebuilds byte for byte from the oracle held to the limits (scripts/skyline-ladder-deal.ts)`);
  for (const level of SKYLINE_DEAL_LEVELS) {
    ok(SKYLINE_V12_DEAL[level].length >= 200 && SKYLINE_V12_DEAL[level].every((s) => SKYLINE_DEAL_CANDIDATES.includes(s)), `${level}: ${SKYLINE_V12_DEAL[level].length} of ${SKYLINE_DEAL_CANDIDATES.length} candidates dealt (at least 200)`);
    const sample = full ? SKYLINE_V12_DEAL[level] : SKYLINE_V12_DEAL[level].filter((_, i) => i % 26 === 0);
    let good = 0;
    for (const seed of sample) {
      const r = skylineProofRun(skylineDealtPuzzle(level, seed));
      if (r.score === 200 && !r.flagged && r.limits) good++;
    }
    ok(good === sample.length, `${level}: the oracle held to the limits scores exactly 200 through the server replay on ${good} of ${sample.length} dealt seeds${full ? " (all)" : " (a sample)"}`);
  }
}

section("4. the recorded ladder");
{
  // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
  // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
  for (const [cond, label] of await replaySample("skyline", 2)) ok(cond, label);
}

section("5. Grace, the clock and Skyscraper");
{
  for (const level of ["normal", ...LEVELS] as const) {
    const p = dealAt("skyline", level, 5);
    const g = skylineGameFor(SKYLINE_REV_FLOORS, level === "normal" ? null : level);
    const s0 = g.init(13);
    ok(g.runTicks === SKYLINE_RUN_TICKS && SKYLINE_RUN_TICKS === 3600 && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level}: a 60 s run on a clock of ${puzzleTimeLimitMs(p) / 1000} s (at most 120 s)`);
    const tower = { ...s0, blocks: [...s0.blocks, { x: 90_000, w: 4_000 }], x: 0, w: 4_000, dir: 1 };
    const missed = g.step(tower, true);
    ok((s0.lives ?? 0) >= 2 && !g.isOver(missed) && missed.lives === (s0.lives ?? 0) - 1, `${level}: ${s0.lives} lives; a miss with lives left costs one and the run goes on`);
  }
  const floors: number[] = [];
  for (const seed of SKYLINE_V12_DEAL.expert.slice(0, full ? undefined : 12)) floors.push(skylineProofRun(skylineDealtPuzzle("expert", seed)).state.placed);
  ok(floors.length > 0 && Math.min(...floors) >= 61, `Skyscraper (61 floors on Expert) is possible: the limited oracle builds 61+ floors on every Expert seed played (fewest ${Math.min(...floors)})`);
  ok(skylineCheckpoint(skylineGameFor(SKYLINE_REV_FLOORS, "expert").init(9)).checksum !== skylineCheckpoint(skylineGameFor(SKYLINE_REV_LIVES, "expert").init(9)).checksum, "a skylineRev 12 level's checksum differs from skylineRev 11's (the ladder's mark)");
  ok(roomSeed(0) === SKYLINE_DEAL_CANDIDATES[0], "the candidates start at room seed 0");
}

console.log(`skyline-ladder-check: ${passes} passed, ${failures} failed (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
if (failures > 0) {
  console.log("FAIL skyline-ladder-check");
  process.exit(1);
}
