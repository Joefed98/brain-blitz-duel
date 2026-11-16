/**
 * pattern-overhaul-blockparty-levels-check: Tessellate's levels (the Pattern overhaul, stage 3, 16 Nov 2026;
 * src/lib/levels/pattern/blockparty.levels.ts). The levels' `oneSolution` is open by design (any full packing counts);
 * this is the check that proves each level's boards instead.
 *
 * 1. The registry: Easy, Normal, Hard, Expert; each level's settings (size, pieces, pegs = cols² less the pieces'
 *    squares, solution band, clock ≤ 120 s, full-speed time) and its open oneSolution.
 * 2. Every level's deal: the level stamped, today's blockRev, the level's board (size, pieces, pegs), a board from that
 *    level's bank by the room seed, Expert's own 70 s clock; a seedless (practice) deal too.
 * 3. Normal is the deal before levels: a deal asked for at Normal is byte for byte a deal asked for with no level, and
 *    carries no `level`; its board and pieces are the 7×7 board's.
 * 4. The banks: every board (CHECKS_FULL=1; a sample of 60 a level otherwise) re-counted exhaustively and in its
 *    level's band, its stored solution the solver's first and a real packing, Hard's and Expert's finished by the
 *    human-like solver within 3 held guesses and needing at least 2 (Expert 3); no board twice; sampled entries (all with
 *    CHECKS_FULL=1, through the bank script) rebuild byte for byte from their seeds.
 * 5. Grading reads the level: a flawless solve scores 200 at every level; Expert's packing is correct on its own board
 *    and not on the 7×7 (a puzzle without the level); speed is full by the level's own time, Normal's 40 s unchanged.
 * 6. The grid fits: every level's square is at least 40 px on a 375 px phone's 351 px board; Expert's tray is four to a
 *    row (three rows for eleven pieces), every other board's three; Expert's stage draws its 64 squares and the U and
 *    P in their own colours (cyan, slate), whose sprites exist; the stage locks in on the level's own clock.
 * 7. The human-like solver is a person's (no search tree): on Expert boards it never needs more than 3 held guesses and
 *    the kit used for tuning plays the level's board (its answers legal there).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { BLOCK_GEOMETRY_D4, blockGeometry, decodePlacements, encodeBlockAnswer, verifyPlacements, type BlockLevelSettings } from "../src/lib/duel/blockParty";
import {
  BLOCK_LEVELS,
  HUMAN_LIMITS,
  blockLevelGeo,
  blockLevelSettings,
  humanDepthOf,
  verifyBlockLevel,
  type BlockLevel,
} from "../src/lib/duel/blockPartyLevels.server";
import { BLOCK_LEVEL_BANK, BLOCK_LEVEL_RETRIES } from "../src/lib/duel/blockPartyLevelBank.server";
import { patternFullByS } from "../src/lib/duel/standard/patternRules";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { BLOCK_ART_HASH, BLOCK_SPRITE_COLOURS } from "../src/components/puzzles/pattern/blockPartyArt";
import { BlockPartyPuzzle } from "../src/components/puzzles/BlockPartyPuzzle";
import { withSeededRandom } from "../src/lib/duel/random";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, makeRng } from "./puzzle-fairness/kit";
import { blockLevelCandidate } from "./blockparty-levels-bank";
import type { BlockPartyPuzzleData, PuzzleData } from "../src/lib/duel/types";

const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const failures: string[] = [];
let passed = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passed++;
  else failures.push(message);
};
const deal = (level: string | undefined, seed: number | undefined) =>
  withSeededRandom(seed ?? 7, () =>
    generatePuzzle("blockparty", { ...(seed !== undefined ? { bankSeed: seed } : {}), ...(level ? { level: level as never } : {}) }),
  ) as BlockPartyPuzzleData;

/* 1. The registry. */
{
  check(levelsOf("blockparty").join() === "easy,normal,hard,expert", `registry: levels ${levelsOf("blockparty").join()}`);
  const open = "any full packing counts; solution counts per level are proved in the bank";
  for (const level of BLOCK_LEVELS) {
    const s = gameLevelSettings<BlockLevelSettings>("blockparty", level)!;
    const geo = blockLevelGeo(level);
    check(JSON.stringify(levelProof("blockparty", level)) === JSON.stringify({ open }), `registry ${level}: oneSolution ${JSON.stringify(levelProof("blockparty", level))}`);
    check(s.pegs === geo.blockers && geo.cells === s.cols * s.cols && geo.free === geo.cells - s.pegs, `registry ${level}: pegs ${s.pegs} vs ${geo.blockers}`);
    check(geo.pieces.length === s.pieces.length && geo.pieces.every((p, i) => p.name === s.pieces[i]), `registry ${level}: pieces`);
    check(s.timeLimitMs <= MAX_ROUND_CLOCK_MS && s.speedFullByS * 1000 < s.timeLimitMs, `registry ${level}: clock ${s.timeLimitMs}, full by ${s.speedFullByS} s`);
    check(s.solutions.min >= 1, `registry ${level}: a band without a solution`);
  }
  const want: Record<BlockLevel, [number, number, number, number | null, number]> = {
    easy: [6, 6, 20, null, 60_000],
    hard: [7, 9, 2, 5, 60_000],
    expert: [8, 11, 1, 2, 70_000], // Joe's spec: 1–3 ways, 90 s; tightened for a clear step above Hard (16 Nov)
  };
  for (const level of BLOCK_LEVELS) {
    const s = blockLevelSettings(level);
    const [cols, pieces, min, max, clock] = want[level];
    check(s.cols === cols && s.pieces.length === pieces && s.solutions.min === min && s.solutions.max === max && s.timeLimitMs === clock, `registry ${level}: not the agreed settings`);
  }
  check(blockLevelGeo("hard") === BLOCK_GEOMETRY_D4, "registry: Hard is not Normal's board and pieces");
}

/* 2. Every level's deal. */
for (const level of BLOCK_LEVELS) {
  const geo = blockLevelGeo(level);
  const bank = BLOCK_LEVEL_BANK[level];
  const keys = new Set(bank.map((p) => p.blockers.join(",")));
  for (let n = 0; n < 12; n++) {
    const seed = 0x51ed0000 + n * 7919;
    const p = deal(level, seed);
    check(puzzleLevel(p) === level && p.level === level, `deal ${level}: level ${String(p.level)}`);
    check(p.blockRev === 4, `deal ${level}: blockRev ${p.blockRev}`);
    check(blockGeometry(p) === geo, `deal ${level}: the board is not the level's`);
    check(p.blockers.length === geo.blockers && keys.has(p.blockers.join(",")), `deal ${level}: a board not from the level's bank`);
    check(puzzleTimeLimitMs(p as PuzzleData) === blockLevelSettings(level).timeLimitMs, `deal ${level}: clock ${puzzleTimeLimitMs(p as PuzzleData)}`);
    check(JSON.stringify(deal(level, seed)) === JSON.stringify(p), `deal ${level}: the same seed dealt differently`);
  }
  const practice = deal(level, undefined);
  check(practice.level === level && keys.has(practice.blockers.join(",")), `deal ${level}: practice (no seed)`);
}

/* 3. Normal is the deal before levels. */
for (let n = 0; n < 20; n++) {
  const seed = 0x0a0a0000 + n * 104729;
  const asked = deal("normal", seed);
  const none = deal(undefined, seed);
  check(JSON.stringify(asked) === JSON.stringify(none), `normal: seed ${seed} differs from a deal with no level`);
  check(!("level" in asked) && !("timeLimitMs" in asked), "normal: a Normal deal carries a level or a clock");
  check(blockGeometry(asked) === BLOCK_GEOMETRY_D4 && asked.blockers.length === 16, "normal: not the 7×7 board");
}

/* 4. The banks. */
for (const level of BLOCK_LEVELS) {
  const bank = BLOCK_LEVEL_BANK[level];
  const s = blockLevelSettings(level);
  check(bank.length === 300 && BLOCK_LEVEL_RETRIES[level].length === bank.length, `bank ${level}: ${bank.length} boards`);
  check(new Set(bank.map((p) => p.blockers.join(","))).size === bank.length, `bank ${level}: a board twice`);
  const step = FULL ? 1 : Math.ceil(bank.length / 60);
  const counts: number[] = [];
  for (let i = 0; i < bank.length; i += step) {
    const p = bank[i]!;
    const why = verifyBlockLevel(level, p);
    check(why === null, `bank ${level}[${i}]: ${why}`);
    check(p.solutions! >= 1 && p.solutions! >= s.solutions.min && (s.solutions.max === null || p.solutions! <= s.solutions.max), `bank ${level}[${i}]: ${p.solutions} solutions`);
    counts.push(p.solutions!);
  }
  console.log(`bank ${level}: ${counts.length} boards re-counted, solutions ${Math.min(...counts)}–${Math.max(...counts)}`);
  // Rebuilds: a few sampled entries from their own seeds (the whole bank: bun scripts/blockparty-levels-bank.ts --check).
  const sample = FULL ? [0, 1, 2, 50, 100, 150, 200, 250, 299] : [0, 137, 299];
  for (const i of sample) {
    const again = blockLevelCandidate(level, i, BLOCK_LEVEL_RETRIES[level][i]!);
    check(JSON.stringify(again) === JSON.stringify(bank[i]), `bank ${level}[${i}]: does not rebuild from its seed`);
  }
}
if (FULL) {
  const run = Bun.spawnSync(["bun", "scripts/blockparty-levels-bank.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  check(run.exitCode === 0, `bank: the whole build differs (${run.stdout.toString().trim()})`);
}

/* 5. Grading reads the level. */
{
  for (const level of [...BLOCK_LEVELS, "normal"] as const) {
    const p = deal(level, 0x7e57);
    const limit = puzzleTimeLimitMs(p as PuzzleData);
    const flawless = gradeAnswer(p as PuzzleData, encodeBlockAnswer(p.solution ?? [], 0), limit - 5_000);
    check(flawless.isCorrect && flawless.score === 200, `grade ${level}: a flawless solve scored ${flawless.score}`);
    const fullBy = patternFullByS("blockparty", p as never);
    check(fullBy === (level === "normal" ? 40 : blockLevelSettings(level).speedFullByS), `grade ${level}: full by ${fullBy}`);
    // Finishing a moment after the level's full-speed time costs a little speed; a moment before costs none.
    const before = gradeAnswer(p as PuzzleData, encodeBlockAnswer(p.solution ?? [], 0), limit - (fullBy - 1) * 1000);
    const after = gradeAnswer(p as PuzzleData, encodeBlockAnswer(p.solution ?? [], 0), limit - (fullBy + 6) * 1000);
    check(before.score === 200 && after.score < 200 && after.isCorrect, `grade ${level}: speed by ${fullBy} s: ${before.score}, ${after.score}`);
  }
  const expert = deal("expert", 0xbeef);
  const answer = encodeBlockAnswer(expert.solution ?? [], 0);
  check(gradeAnswer(expert as PuzzleData, answer, 60_000).isCorrect, "grade expert: its packing is not correct on its own board");
  const { level: _l, timeLimitMs: _t, ...asNormal } = expert;
  check(!gradeAnswer(asNormal as PuzzleData, answer, 60_000).isCorrect, "grade expert: its packing is correct on the 7×7 board too");
  check(!verifyPlacements(expert.blockers, decodePlacements(answer), BLOCK_GEOMETRY_D4).solved, "grade expert: read without its level");
}

/* 6. The grid fits; the stage draws the level. */
{
  for (const level of BLOCK_LEVELS) check(351 / blockLevelSettings(level).cols >= 40, `grid ${level}: ${(351 / blockLevelSettings(level).cols).toFixed(1)} px a square`);
  const props = { phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {}, onDraftAnswer: () => {} };
  const expert = deal("expert", 0xabc);
  const html = renderToStaticMarkup(<BlockPartyPuzzle puzzle={expert} {...props} />);
  check(html.includes("grid-cols-4") && !html.includes("grid-cols-3"), "stage expert: the tray is not four to a row");
  check((html.match(/(well|peg)\.webp/g) ?? []).length === 64, `stage expert: ${(html.match(/(well|peg)\.webp/g) ?? []).length} squares drawn`);
  check(html.includes("tray-cyan.webp") && html.includes("tray-slate.webp"), "stage expert: the U and the P have no colours of their own");
  for (const c of ["cyan", "slate"]) for (const k of ["block", "tray"]) check(statSync(`public/pattern-art/blockparty/${k}-${c}.webp`).size <= 25_000, `art: ${k}-${c}`);
  check(BLOCK_SPRITE_COLOURS.length >= 11 && new Set(BLOCK_SPRITE_COLOURS).size === BLOCK_SPRITE_COLOURS.length, "art: eleven distinct piece colours");
  // Every sprite URL carries the files' version, so a phone never keeps an older render from its cache (Joe, 16 Nov).
  const dir = "public/pattern-art/blockparty";
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(readFileSync(`${dir}/${f}`));
  const want = hash.digest("hex").slice(0, 8);
  check(BLOCK_ART_HASH === want, `art: BLOCK_ART_HASH ${BLOCK_ART_HASH}, the files' ${want}: update it after re-rendering`);
  const urls = [...html.matchAll(/href="([^"]*pattern-art\/blockparty[^"]*)"/g)].map((m) => m[1]!);
  check(urls.length > 64 && urls.every((u) => u.endsWith(`.webp?v=${BLOCK_ART_HASH}`)), "art: a sprite URL without the version");
  check(urls.some((u) => /\/peg\.webp\?/.test(u)) && urls.some((u) => /\/tray-red\.webp\?/.test(u)), "art: the stage draws no stud or tray block");
  for (const level of ["easy", "hard"] as const) {
    const h = renderToStaticMarkup(<BlockPartyPuzzle puzzle={deal(level, 0xabc)} {...props} />);
    check(h.includes("grid-cols-3") && !h.includes("grid-cols-4"), `stage ${level}: the tray is not three to a row`);
    check((h.match(/(well|peg)\.webp/g) ?? []).length === blockLevelSettings(level).cols ** 2, `stage ${level}: squares drawn`);
  }
  const normal = renderToStaticMarkup(<BlockPartyPuzzle puzzle={deal("normal", 0xabc)} {...props} />);
  check(normal.includes("grid-cols-3") && (normal.match(/(well|peg)\.webp/g) ?? []).length === 49, "stage normal: changed");
  const src = readFileSync("src/components/puzzles/BlockPartyPuzzle.tsx", "utf8");
  check(/phaseStartedAt \+ \(puzzle\.timeLimitMs \?\? BLOCK_TIME_MS\) - now/.test(src), "stage: the lock-in ignores the level's clock");
}

/* 7. The human-like solver and the tuning kit. */
{
  check(HUMAN_LIMITS.width === 4 && HUMAN_LIMITS.depth === 3, "human: limits moved");
  for (const level of ["hard", "expert"] as const) {
    const s = blockLevelSettings(level);
    const least = level === "expert" ? 3 : 2;
    check(s.humanDepth?.max === 3 && s.humanDepth.min === least, `human ${level}: band`);
    for (let i = 0; i < 300; i += FULL ? 1 : 25) {
      const d = humanDepthOf(blockLevelGeo(level), BLOCK_LEVEL_BANK[level][i]!.blockers, 3);
      check(d !== null && d >= least && d <= 3, `human ${level}[${i}]: depth ${d}`);
    }
  }
  const kit = KITS.blockparty!;
  for (const level of BLOCK_LEVELS) {
    const p = deal(level, 0x1234);
    const play = kit.play(p as PuzzleData, makeRng(1), SKILLS.near, puzzleTimeLimitMs(p as PuzzleData));
    const last = play.steps[play.steps.length - 1]!.answer;
    check(verifyPlacements(p.blockers, decodePlacements(last), blockGeometry(p)).solved, `kit ${level}: the near-perfect play does not fill the level's board`);
    for (const spam of kit.spam(p as PuzzleData, makeRng(2), 60_000)) {
      const legal = verifyPlacements(p.blockers, decodePlacements(spam.answer), blockGeometry(p)).legal.length;
      check(legal === decodePlacements(spam.answer).length, `kit ${level}: spam ${spam.label} drops a piece off the level's board`);
    }
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`\nFAIL: pattern-overhaul-blockparty-levels-check, ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nPASS: pattern-overhaul-blockparty-levels-check, ${passed} passed, 0 failed${FULL ? " (full)" : ""}`);
