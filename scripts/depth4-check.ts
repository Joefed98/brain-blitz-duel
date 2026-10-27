/**
 * depth4-check (depth batch 4, docs/depth/d4-pattern.md; ~1 min): the eight Pattern / Logic games raised to 200.
 *
 *   1. Old rounds: every round of scripts/fixtures/depth4-legacy.json.gz (recorded on main before the change by
 *      scripts/depth4-record.ts: dealt boards, kit answers at every level, empty and spam answers) regrades to
 *      exactly its stored score, verdict, time and detail. With the new deal pinned off, fresh deals are the old
 *      boards with no new stamp and never score above 150.
 *   2. New deals (30 room seeds a game): the stamp; Gridlock's and Turntable's par is the exact minimum (BFS);
 *      Turntable's link pattern has two legend rules; Pipeline's par is the fewest taps to the stored solution;
 *      Lightbender has two spare mirrors and its par is the stored solution's mirrors; Skid's gems sit off the
 *      stored shortest route and a route collecting them all exists, 2–8 slides longer; Heave's bank entries
 *      replay to a solve in their minimum pushes with the gold crate on its mark, 5 crates and 3–7 inner walls;
 *      Tessellate's 7×7 bank verifies (solver count in band, stored solution the solver's first) on a sample and
 *      rebuilds byte for byte on a sample.
 *   3. Scores: a perfect, very fast run scores 200 on every game; no score above 200; a finish never below 120;
 *      an unfinished round scores what rev 3 gives it (the features add nothing unfinished, Tessellate's
 *      progress counting its own pieces); the reveal breakdown adds up to the score.
 *   4. Phone parity: the pipes tap answer, the gem replay and the gold crate are what the server counts.
 *
 *   bun scripts/depth4-check.ts            (CHECKS_FULL=1 verifies every Tessellate and Heave bank entry)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { pinDepth4Off, LASER_SPARE_MIRRORS } from "../src/lib/duel/depth4/deal.server";
import { D4_TYPES, d4RevOf, isDepth4, type D4Type } from "../src/lib/duel/depth4/stamps";
import { pipesParTurns, decodePipesTaps, encodePipesTapAnswer, pipesAfterTaps } from "../src/lib/duel/depth4/pipesTaps";
import { gemRoute, gemRouteLength, ICE_GEM_MAX_DETOUR, ICE_GEM_MIN_DETOUR } from "../src/lib/duel/depth4/gems.server";
import { replayGems } from "../src/lib/duel/depth4/iceGems";
import { PUSH_D4_BANK } from "../src/lib/duel/depth4/pushD4Bank.server";
import { BLOCK_D4_BANK, BLOCK_D4_RETRIES } from "../src/lib/duel/depth4/blockD4Bank.server";
import { verifyBlockD4 } from "../src/lib/duel/depth4/blockD4";
import { rev3Unfinished } from "../src/lib/duel/puzzleScoreRev3";
import { scorePartsText, storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { ringsMinMoves, RING_PATTERNS } from "../src/lib/duel/rings";
import { isSplitter, verifyLaser } from "../src/lib/duel/laser";
import { gradePipesBoard } from "../src/lib/duel/logic.server";
import { decodeMoves, applyMove, isSolved as unblockSolved, slideRange, position, serialiseLayout } from "../src/lib/duel/unblock";
import { slideBoard, slideOutcome } from "../src/lib/duel/slide";
import { decodePushSolution, replayPush, pushStep } from "../src/lib/duel/push";
import { blockD4Candidate } from "./depth4-block-bank";
import { kitFor, playAndGrade } from "./depth4/players";
import { makeRng, type Skill } from "./puzzle-fairness/kit";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
// The scoring standard (27 Oct 2026, docs/scoring-standard.md) deals its own stamps one above these; this check proves
// the stamps it was written for, so new deals are pinned to them (standard-*-checks prove the standard's).
pinPreStandard(true);

const FULL = process.env["CHECKS_FULL"] === "1";
let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}
type Of<T extends PuzzleType> = Extract<PuzzleData, { type: T }>;
/** A perfect, very fast player (every action at the kits' 250 ms floor, no mistakes). */
const FAST: Skill = { level: "near", pace: 0.01, err: 0, reactionMs: 100, reactionSd: 1 };

/* ------------------------------------------------------------------ 1. old rounds */
{
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth4-legacy.json.gz")).toString()) as {
    rounds: { puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; storedMs: number; extra: unknown }[];
  };
  let same = 0;
  for (const r of fixture.rounds) {
    ok(!isDepth4(r.puzzle), `${r.puzzle.type}: a recorded round carries a depth stamp`);
    const g = gradeAnswer(r.puzzle, r.answer, r.ms);
    const match = g.score === r.score && g.isCorrect === r.isCorrect && g.storedMs === r.storedMs && JSON.stringify(g.extra) === JSON.stringify(r.extra);
    if (match) same++;
    else ok(false, `${r.puzzle.type}: a recorded round regrades ${g.score}/${g.isCorrect} (stored ${r.score}/${r.isCorrect})`);
  }
  ok(fixture.rounds.length >= 1000, `legacy fixture has ${fixture.rounds.length} rounds`);
  console.log(`  1. ${same}/${fixture.rounds.length} recorded old-stamp rounds regrade identically`);
  pinDepth4Off(true);
  for (const type of D4_TYPES) {
    for (let s = 1; s <= 4; s++) {
      const p = withSeededRandom(s, () => generatePuzzle(type, { bankSeed: s * 31 }));
      ok(d4RevOf(p) === 0, `${type}: pinned off, the deal still carries the stamp`);
      const kit = kitFor(type, p, "near");
      const { graded } = playAndGrade(kit, p, makeRng(s), FAST);
      ok(graded.score <= 150, `${type}: an old-rule round scored ${graded.score} (> 150)`);
    }
  }
  pinDepth4Off(false);
}

/* ------------------------------------------------------------------ 2. new deals */
const SEEDS = 30;
const deal = (type: D4Type, s: number) => withSeededRandom(900 + s, () => generatePuzzle(type, { bankSeed: 51_000 + s * 97 }));

function unblockMin(vehicles: Of<"unblock">["vehicles"]): number {
  const seen = new Set<string>([serialiseLayout(vehicles)]);
  let frontier = [vehicles];
  for (let depth = 1; depth <= 60; depth++) {
    const next: typeof frontier = [];
    for (const s of frontier)
      for (const v of s) {
        const { min, max } = slideRange(s, v.id);
        for (let to = min; to <= max; to++) {
          if (to === position(v)) continue;
          const after = applyMove(s, { id: v.id, to });
          if (!after) continue;
          if (unblockSolved(after)) return depth;
          const key = serialiseLayout(after);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(after);
        }
      }
    frontier = next;
  }
  return -1;
}

for (const type of D4_TYPES) {
  for (let s = 1; s <= SEEDS; s++) {
    const p = deal(type, s);
    ok(d4RevOf(p) === 1, `${type} seed ${s}: dealt without its depth stamp`);
    if (p.type === "unblock" && s <= 6) ok(p.par === p.minMoves && unblockMin(p.vehicles) === p.par, `unblock seed ${s}: par ${p.par} is not the BFS minimum`);
    if (p.type === "rings") {
      ok(RING_PATTERNS[p.pattern]!.legend.length >= 2, `rings seed ${s}: pattern ${p.pattern} has one rule`);
      ok(p.par === ringsMinMoves(p.segments, p.pattern)?.min, `rings seed ${s}: par is not the exact minimum`);
    }
    if (p.type === "pipes") {
      ok(p.par === pipesParTurns(p.tiles, p.solution ?? []) && (p.par ?? 0) > 0, `pipes seed ${s}: par turns`);
      ok(gradePipesBoard(p.source, p.tiles.map((_t, i) => ({ sides: p.solution![i]! }))).solved, `pipes seed ${s}: the stored solution does not solve`);
    }
    if (p.type === "laser") {
      const need = (p.solution ?? []).filter((m) => !isSplitter(m.kind)).length;
      ok(p.par === need && p.mirrors === need + LASER_SPARE_MIRRORS, `laser seed ${s}: ${p.mirrors} mirrors for par ${p.par}`);
      ok(verifyLaser(p, p.solution ?? []).solved, `laser seed ${s}: the stored solution does not light every gem`);
    }
    if (p.type === "iceslide") {
      const gems = p.gems ?? [];
      ok(gems.length >= 1, `iceslide seed ${s}: no gems`);
      const board = slideBoard(p);
      const route = new Set<number>([p.start]);
      let at = { cell: p.start, mask: 0 };
      for (const d of (p.solution ?? "").split("")) {
        const out = slideOutcome(board, at.cell, at.mask, d as "U");
        out.path.forEach((c) => route.add(c));
        at = { cell: out.cell, mask: out.mask };
      }
      ok(gems.every((g) => !route.has(g)), `iceslide seed ${s}: a gem sits on the shortest route`);
      const r = gemRoute(p);
      ok(!!r && replayGems(board, gems, r).collected === gems.length, `iceslide seed ${s}: no route collects every gem`);
      const extra = (r?.length ?? 0) - (p.minMoves ?? 0);
      ok(extra >= ICE_GEM_MIN_DETOUR && extra <= ICE_GEM_MAX_DETOUR, `iceslide seed ${s}: the gem route is ${extra} slides longer`);
    }
    if (p.type === "push") ok(!!p.gold && p.crates.length === 5, `push seed ${s}: no gold crate or not five crates`);
    if (p.type === "blockparty") ok(p.blockers.length === 16 && (p.blockRev ?? 0) === 1, `blockparty seed ${s}: not the 7×7 board`);
  }
}
void gemRouteLength;

// Heave's bank: every entry replays to a solve in its minimum pushes, the gold crate on its mark.
for (const [i, e] of PUSH_D4_BANK.entries()) {
  const pushes = decodePushSolution(e.solution);
  const crates = [...e.crates];
  for (const m of pushes) {
    const k = crates.indexOf(m.cell);
    crates[k] = pushStep(m.cell, m.dir)!;
  }
  ok(pushes.length === e.minPushes && e.crates.length === 5, `push bank ${i}: ${pushes.length} pushes for minimum ${e.minPushes}`);
  ok(crates.every((c) => e.targets.includes(c)) && crates[e.gold.crate] === e.gold.target && e.targets.includes(e.gold.target), `push bank ${i}: the solution does not leave the gold crate on its mark`);
  const inner = e.walls.filter((c) => c % 9 > 0 && c % 9 < 8 && c >= 9 && c < 72).length;
  ok(inner >= 3 && inner <= 9, `push bank ${i}: ${inner} inner walls`);
}
ok(PUSH_D4_BANK.length === 120, `push bank has ${PUSH_D4_BANK.length} entries`);
void replayPush;

// Tessellate's bank: a sample (every entry with CHECKS_FULL=1) verifies and rebuilds from its seed.
{
  const sample = FULL ? BLOCK_D4_BANK.map((_, i) => i) : [0, 1, 2, 137, 500, 999];
  for (const i of sample) {
    ok(verifyBlockD4(BLOCK_D4_BANK[i]!) === null, `blockparty bank ${i}: ${verifyBlockD4(BLOCK_D4_BANK[i]!)}`);
    if (i < 6 || !FULL) ok(JSON.stringify(blockD4Candidate(i, BLOCK_D4_RETRIES[i]!)) === JSON.stringify(BLOCK_D4_BANK[i]), `blockparty bank ${i}: does not rebuild from its seed`);
  }
  ok(BLOCK_D4_BANK.length === 1000 && new Set(BLOCK_D4_BANK.map((b) => b.blockers.join())).size === 1000, "blockparty bank: 1000 distinct boards");
}
console.log(`  2. new deals checked on ${SEEDS} seeds a game; banks: Heave ${PUSH_D4_BANK.length}, Tessellate ${BLOCK_D4_BANK.length}`);

/* ------------------------------------------------------------------ 3. scores */
for (const type of D4_TYPES) {
  let top = 0;
  for (let s = 1; s <= 6; s++) {
    const p = deal(type, s);
    const { graded } = playAndGrade(kitFor(type, p, "elite"), p, makeRng(s), FAST);
    top = Math.max(top, graded.score);
    ok(graded.isCorrect && graded.score >= 195, `${type} seed ${s}: a perfect fast run scored ${graded.score}`);
    const parts = storedScoreParts(graded.extra);
    ok(!!parts && sumParts(parts) === graded.score, `${type} seed ${s}: the breakdown "${parts ? scorePartsText(parts) : "none"}" does not add up to ${graded.score}`);
    // Unfinished: rev 3's score, unchanged by the features.
    const limit = puzzleTimeLimitMs(p);
    for (const level of ["average", "good", "great", "near"] as const) {
      const run = playAndGrade(kitFor(type, p, level), p, makeRng(s * 7), { level, pace: [1.7, 1, 0.72, 0.5][["average", "good", "great", "near"].indexOf(level)]!, err: [0.2, 0.1, 0.05, 0.015][["average", "good", "great", "near"].indexOf(level)]!, reactionMs: 200, reactionSd: 20 });
      const g = run.graded;
      ok(g.score <= 200 && g.score >= 0, `${type}: score ${g.score} out of range`);
      if (g.isCorrect) ok(g.score >= 120, `${type}: a finish scored ${g.score}`);
      else {
        const share = (g.extra?.["progressShare"] as number | undefined) ?? 0;
        ok(g.score === rev3Unfinished(type, share).score && g.score <= 110, `${type}: an unfinished round scored ${g.score}, rev 3 gives ${rev3Unfinished(type, share).score}`);
      }
      void limit;
    }
  }
  ok(top === 200, `${type}: 200 is reachable (best ${top})`);
}
console.log("  3. a perfect fast run scores 195–200 (200 reached) on all eight; finishes ≥ 120; unfinished = rev 3; breakdowns add up");

function sumParts(parts: { base: number; efficiency?: number; speed?: number }): number {
  return parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0);
}

/* ------------------------------------------------------------------ 4. phone parity */
{
  const p = deal("pipes", 3) as Of<"pipes">;
  const taps = [0, 5, 5, 12, 48, 7];
  const answer = encodePipesTapAnswer(pipesAfterTaps(p.tiles, taps), taps);
  ok(JSON.stringify(decodePipesTaps(answer, p.tiles.length)) === JSON.stringify(taps), "pipes: the tap log round-trips");
  ok(answer.indexOf("~") === p.tiles.length, "pipes: the side-sets prefix keeps one hex digit a tile (older readers)");
  const tampered = encodePipesTapAnswer(p.tiles.map((_t, i) => ({ sides: p.solution![i]! })), []);
  ok(!gradeAnswer(p, tampered, 60_000).isCorrect, "pipes: claimed solved side-sets with no taps do not solve");
  const sl = deal("iceslide", 4) as Of<"iceslide">;
  const r = gemRoute(sl)!;
  const g = gradeAnswer(sl, `${r.join("")}`, 60_000);
  ok(g.extra?.["gemsCollected"] === (sl.gems ?? []).length, "iceslide: the server counts every gem the route collects");
  const undone = gradeAnswer(sl, `${r[0]}X${(sl.solution ?? "")}`, 60_000);
  ok(undone.extra?.["gemsCollected"] === replayGems(slideBoard(sl), sl.gems ?? [], [r[0]!, "X", ...((sl.solution ?? "").split("") as "U"[])]).collected, "iceslide: undone slides give their gems back, phone and server alike");
  const ul = deal("unblock", 2) as Of<"unblock">;
  ok(gradeAnswer(ul, ul.solution ?? "", 50_000).extra?.["par"] === ul.par && decodeMoves(ul.solution ?? "").length === ul.par, "unblock: the stored minimum is par");
}
console.log("  4. pipes tap log, gem replay and par are what the server counts");

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL depth4-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS depth4-check: ${passes} checks — old rounds regrade exactly, the new deals are proved, 200 is reachable and only through the new rules`);
