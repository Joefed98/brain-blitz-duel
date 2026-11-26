/**
 * Ballpark depthRev 3 (D2, 22 Nov 2026; src/lib/duel/ballparkBullseyes.ts, Joe's approval of 22 Nov 2026).
 *
 *   1. depthRev 2 rounds score exactly as before: every case of scripts/fixtures/number-ballpark-bulls-legacy.json.gz
 *      (recorded on main 3025ef03 by scripts/number-ballpark-bulls-record.ts, Normal and every level) regrades to the
 *      same score, correctness and extra on its stored puzzle.
 *   2. The deal: every level deals depthRev 3, the same seed's board as the preBallparkBullseyes pin deals (depthRev 2),
 *      the stamp the only difference; on Normal both are the board recorded on main.
 *   3. The rule: a bullseye is worth 2½ on Easy and Normal and 3 on Hard and Expert, still up to 30, finished or not;
 *      200 takes twelve bullseyes on Easy and Normal and ten on Hard and Expert; accuracy, speed and the rest score
 *      exactly as depthRev 2's; an unfinished round stays under 150; spam stays low.
 *   4. The help describes it, and the pin restores the old text; the intro line is unchanged.
 *
 *   bun scripts/number-ballpark-bulls-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeNumline } from "../src/lib/duel/numline";
import {
  BALLPARK_REV_BEFORE,
  BALLPARK_REV_BULLS,
  BALLPARK_V3_BULL_POINTS,
  ballparkBullPoints,
  pinPreBallparkBullseyes,
  usesBallparkBullseyes,
} from "../src/lib/duel/ballparkBullseyes";
import { BALLPARK_STD_BULL_MAX, BALLPARK_STD_BULL_POINTS } from "../src/lib/duel/standard/number";
import { standardNumberHelp } from "../src/lib/duel/standard/numberText";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import type { NumlinePuzzleData, PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { BALLPARK_LEGACY_LEVELS, BALLPARK_LEGACY_SEEDS, ballparkOff, ballparkTruths, keyOf, type BallparkLegacyFixture } from "./number-ballpark-bulls-record";

let failures = 0;
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${label}`);
  }
};
const json = (v: unknown) => JSON.stringify(v);
const deal = (level: Level, seed: number, pins: "pre" | "live" = "live"): PuzzleData =>
  withSeededRandom(seed, () => generatePuzzle("numline", { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }, pins === "pre" ? { pins: ["preBallparkBullseyes"] } : undefined));

const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/number-ballpark-bulls-legacy.json.gz", import.meta.url))).toString("utf8")) as BallparkLegacyFixture;

/* 1. depthRev 2 rounds score exactly as before. */
{
  let same = 0;
  for (const c of fixture.cases) {
    const p = fixture.puzzles[keyOf(c.level, c.seed)]!;
    const g = gradeAnswer(p, c.answer, c.msLeft);
    if (g.score === c.score && g.isCorrect === c.isCorrect && json(g.extra ?? null) === json(c.extra)) same++;
    else if (same + 5 > fixture.cases.length) console.log(`  ${c.level} ${c.seed} ${c.label}: ${g.score} (was ${c.score})`);
  }
  const stamps = new Set(Object.values(fixture.puzzles).map((p) => (p as { depthRev?: number }).depthRev));
  ok(stamps.size === 1 && stamps.has(BALLPARK_REV_BEFORE), `1. the fixture's puzzles are all depthRev ${BALLPARK_REV_BEFORE}`);
  ok(fixture.cases.length >= 1400 && same === fixture.cases.length, `1. every recorded depthRev 2 case regrades exactly (${same} of ${fixture.cases.length})`);
  ok(Object.values(fixture.puzzles).every((p) => ballparkBullPoints(p) === BALLPARK_STD_BULL_POINTS), `1. a depthRev 2 bullseye is worth ${BALLPARK_STD_BULL_POINTS}`);
}

/* 2. The deal. Every level: the live deal is the pinned (depthRev 2) deal of the same seed with only the stamp moved.
 * Normal: both are the board recorded on main (the levels' own boards have changed since the recording, D2's level work,
 * so only Normal is held to it). */
{
  let sameBoard = 0, rev3 = 0, total = 0, normalSame = 0, normals = 0;
  for (const level of BALLPARK_LEGACY_LEVELS)
    for (const seed of BALLPARK_LEGACY_SEEDS) {
      total++;
      const live = deal(level, seed) as NumlinePuzzleData;
      const pre = deal(level, seed, "pre") as NumlinePuzzleData;
      if (live.depthRev === BALLPARK_REV_BULLS && usesBallparkBullseyes(live) && pre.depthRev === BALLPARK_REV_BEFORE && !usesBallparkBullseyes(pre)) rev3++;
      if (json({ ...live, depthRev: BALLPARK_REV_BEFORE }) === json(pre)) sameBoard++;
      if (level === "normal") {
        normals++;
        const recorded = fixture.puzzles[keyOf(level, seed)]!;
        if (json(pre) === json(recorded) && json({ ...live, depthRev: BALLPARK_REV_BEFORE }) === json(recorded)) normalSame++;
      }
    }
  ok(rev3 === total, `2. every level deals depthRev ${BALLPARK_REV_BULLS}, and depthRev ${BALLPARK_REV_BEFORE} under the preBallparkBullseyes pin (${rev3} of ${total})`);
  ok(sameBoard === total, `2. on the pinned deal's board, seed for seed; the stamp is the only difference (${sameBoard} of ${total})`);
  ok(normals > 0 && normalSame === normals, `2. Normal: the live and pinned deals are the board recorded on main (${normalSame} of ${normals})`);
}

/* 3. The rule. Finished lines with exactly n bullseyes (0.4 % off) and the rest inside full accuracy but outside the
 * bullseye (1.5 % off), and every prefix of an exact line, on depthRev 3 against the same answers on depthRev 2. */
{
  const WORTH: Record<Level, number> = { easy: 2.5, normal: 2.5, hard: 3, expert: 3 };
  const FILL: Record<Level, number> = { easy: 12, normal: 12, hard: 10, expert: 10 };
  let worth = 0, fills = 0, short = 0, partsSame = 0, unfinishedUnder = 0, unfinishedWorth = 0, lines = 0;
  for (const level of BALLPARK_LEGACY_LEVELS)
    for (const seed of [9100, 9113, 9126, 9139, 9152]) {
      lines++;
      const p = deal(level, seed) as NumlinePuzzleData;
      const as2 = { ...p, depthRev: BALLPARK_REV_BEFORE } as PuzzleData;
      const limit = puzzleTimeLimitMs(p);
      if (ballparkBullPoints(p) === WORTH[level] && BALLPARK_V3_BULL_POINTS[level] === WORTH[level]) worth++;
      const truths = ballparkTruths(p);
      const near = ballparkOff(truths, 0.004);
      const outside = ballparkOff(truths, 0.015);
      let fillOk = true, shortOk = true, sameOk = true;
      for (let n = 0; n <= truths.length; n++) {
        const places = truths.map((_, k) => (k < n ? near[k]! : outside[k]!));
        const answer = encodeNumline(places);
        const a = gradeAnswer(p, answer, limit);
        const b = gradeAnswer(as2, answer, limit);
        const bonus3 = Math.min(BALLPARK_STD_BULL_MAX, WORTH[level] * n);
        const bonus2 = Math.min(BALLPARK_STD_BULL_MAX, BALLPARK_STD_BULL_POINTS * n);
        // Every number inside full accuracy and the clock full: 150 + 20 + the bullseyes.
        if (Math.abs(a.score - b.score - Math.round(bonus3 - bonus2)) > 1) sameOk = false;
        if (n >= FILL[level] && a.score !== 200) fillOk = false;
        if (n === FILL[level] - 1 && a.score >= 200) shortOk = false;
      }
      if (fillOk) fills++;
      if (shortOk) short++;
      if (sameOk) partsSame++;
      // Unfinished: every prefix of an exact line (each number a bullseye) under 150, its bullseyes at the level's worth.
      let under = true, unf = true;
      for (let n = 1; n < truths.length; n++) {
        const answer = encodeNumline(truths.slice(0, n));
        const a = gradeAnswer(p, answer, 0);
        const b = gradeAnswer(as2, answer, 0);
        if (a.isCorrect || a.score >= 150) under = false;
        const gain = Math.min(BALLPARK_STD_BULL_MAX, WORTH[level] * n) - Math.min(BALLPARK_STD_BULL_MAX, BALLPARK_STD_BULL_POINTS * n);
        if (Math.abs(Math.min(130, a.score) - Math.min(130, b.score + gain)) > 1) unf = false;
      }
      if (under) unfinishedUnder++;
      if (unf) unfinishedWorth++;
    }
  ok(worth === lines, `3. a bullseye is worth 2½ on Easy and Normal, 3 on Hard and Expert (${worth} of ${lines})`);
  ok(fills === lines, `3. 200 once twelve numbers (Easy, Normal) or ten (Hard, Expert) are bullseyes, every number in full and the clock full (${fills} of ${lines})`);
  ok(short === lines, `3. one bullseye short of that is under 200 (${short} of ${lines})`);
  ok(partsSame === lines, `3. accuracy and speed score exactly as depthRev 2's; only the bullseyes move (${partsSame} of ${lines})`);
  ok(unfinishedUnder === lines, `3. an unfinished round always scores under 150 (${unfinishedUnder} of ${lines})`);
  ok(unfinishedWorth === lines, `3. an unfinished round's bullseyes count at the level's worth, finished or not (${unfinishedWorth} of ${lines})`);
  // Spam: placements near the middle already earn some accuracy on depthRev 2 (an estimate counts for being near), so
  // the stamp must add next to nothing to them: each strategy's median and mean at most 1 above depthRev 2's.
  const spam: Record<string, { rev3: number[]; rev2: number[] }> = {};
  for (const level of BALLPARK_LEGACY_LEVELS)
    for (const seed of [9200, 9211, 9222, 9233, 9244, 9255]) {
      const p = deal(level, seed);
      const as2 = { ...p, depthRev: BALLPARK_REV_BEFORE } as PuzzleData;
      for (const s of KITS.numline!.spam(p, makeRng(hashText(`bpb:${level}:${seed}`)), puzzleTimeLimitMs(p))) {
        const row = (spam[s.label] ??= { rev3: [], rev2: [] });
        row.rev3.push(gradeAnswer(p, s.answer, 0).score);
        row.rev2.push(gradeAnswer(as2, s.answer, 0).score);
      }
    }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  for (const [label, row] of Object.entries(spam)) {
    const sorted = [...row.rev3].sort((a, b) => a - b);
    const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
    const sorted2 = [...row.rev2].sort((a, b) => a - b);
    const median2 = sorted2[Math.floor((sorted2.length - 1) / 2)]!;
    ok(median <= median2 + 1 && mean(row.rev3) <= mean(row.rev2) + 1, `3. spam "${label}": median ${median} against depthRev 2's ${median2}, mean ${mean(row.rev3).toFixed(1)} against ${mean(row.rev2).toFixed(1)} (at most 1 more)`);
  }
}

/* 4. The help and intro. */
{
  const help = standardNumberHelp("numline");
  const intro = INTRO_SCORE.numline;
  ok(/2½ for each number within 1% \(3 on Hard and Expert\)/.test(help), "4. the help gives a bullseye's worth at every level");
  const was = pinPreBallparkBullseyes(true);
  const oldHelp = standardNumberHelp("numline");
  const oldIntro = INTRO_SCORE.numline;
  pinPreBallparkBullseyes(was);
  ok(/Bullseyes: 2 for each number within 1%, finished or not/.test(oldHelp) && !/2½/.test(oldHelp), "4. the pin restores depthRev 2's help");
  ok(intro === oldIntro && /bullseyes/.test(intro), "4. the intro line is unchanged (it names bullseyes, not their worth)");
}

console.log(failures ? `FAIL number-ballpark-bulls-check: ${failures} failed, ${passes} passed` : `number-ballpark-bulls-check: all ${passes} passed`);
process.exit(failures ? 1 : 0);
