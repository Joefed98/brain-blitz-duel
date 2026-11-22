/**
 * Integer Pyramid depthRev 3 (D2, 22 Nov 2026; src/lib/duel/pyramidPartial.ts, plan section 8.2 I3).
 *
 *   1. depthRev 2 rounds score exactly as before: every case of scripts/fixtures/number-pyramid-partial-legacy.json.gz
 *      (recorded on main 969e7bb5 by scripts/number-pyramid-partial-record.ts, Normal and every level) regrades to the same
 *      score, correctness and extra on its stored puzzle.
 *   2. The deal: every level deals depthRev 3 on depthRev 2's board, seed for seed (the stamp is the only difference); the
 *      prePyramidPartial pin deals depthRev 2 exactly as recorded.
 *   3. The rule: unfinished credit is 130 × the stones placed right ÷ the round's stones (pyramids done and the current
 *      one), rising stone by stone along a flawless line, always under 150; a finish scores exactly as depthRev 2's; later
 *      pyramids' tiles never count; spam stays low.
 *   4. The help and intro describe it, and the pin restores the old text.
 *
 *   bun scripts/number-pyramid-partial-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { npEncodeRound, type NpPlacements } from "../src/lib/duel/numberPyramid";
import { PYRAMID_PARTIAL_POINTS, PYRAMID_REV_BEFORE, PYRAMID_REV_PARTIAL, pinPrePyramidPartial, usesPyramidPartial } from "../src/lib/duel/pyramidPartial";
import { standardNumberHelp } from "../src/lib/duel/standard/numberText";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import type { NumberPyramidPuzzleData, PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { PYRAMID_LEGACY_LEVELS, PYRAMID_LEGACY_SEEDS, keyOf, type PyramidLegacyFixture } from "./number-pyramid-partial-record";

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
  withSeededRandom(seed, () => generatePuzzle("numpyramid", { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }, pins === "pre" ? { pins: ["prePyramidPartial"] } : undefined));

const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/number-pyramid-partial-legacy.json.gz", import.meta.url))).toString("utf8")) as PyramidLegacyFixture;

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
  ok(stamps.size === 1 && stamps.has(PYRAMID_REV_BEFORE), `1. the fixture's puzzles are all depthRev ${PYRAMID_REV_BEFORE}`);
  ok(fixture.cases.length >= 2000 && same === fixture.cases.length, `1. every recorded depthRev 2 case regrades exactly (${same} of ${fixture.cases.length})`);
}

/* 2. The deal. */
{
  let sameBoard = 0, rev3 = 0, preSame = 0, total = 0;
  for (const level of PYRAMID_LEGACY_LEVELS)
    for (const seed of PYRAMID_LEGACY_SEEDS) {
      total++;
      const live = deal(level, seed) as NumberPyramidPuzzleData;
      const pre = deal(level, seed, "pre");
      const recorded = fixture.puzzles[keyOf(level, seed)]!;
      if (live.depthRev === PYRAMID_REV_PARTIAL && usesPyramidPartial(live)) rev3++;
      if (json({ ...live, depthRev: PYRAMID_REV_BEFORE }) === json(recorded)) sameBoard++;
      if (json(pre) === json(recorded)) preSame++;
    }
  ok(rev3 === total, `2. every level deals depthRev ${PYRAMID_REV_PARTIAL} (${rev3} of ${total})`);
  ok(sameBoard === total, `2. on depthRev 2's board, seed for seed; the stamp is the only difference (${sameBoard} of ${total})`);
  ok(preSame === total, `2. the prePyramidPartial pin deals depthRev 2 exactly as recorded (${preSame} of ${total})`);
}

/* 3. The rule. */
const placementsFor = (p: NumberPyramidPuzzleData) =>
  p.pyramids.map((b, i) => {
    const used = new Set<number>();
    const pl: NpPlacements = {};
    b.givens.forEach((g, cell) => {
      if (g != null) return;
      const t = b.tray.findIndex((v, k) => v === p.solutions?.[i]?.[cell] && !used.has(k));
      used.add(t);
      pl[cell] = t;
    });
    return pl;
  });
{
  let rising = 0, exact = 0, finishSame = 0, under = 0, later = 0, lines = 0;
  const spam: Record<string, { rev3: number[]; rev2: number[] }> = {};
  for (const level of PYRAMID_LEGACY_LEVELS)
    for (const seed of [9000, 9011, 9022, 9033, 9044, 9055]) {
      lines++;
      const p = deal(level, seed) as NumberPyramidPuzzleData;
      const as2 = { ...p, depthRev: PYRAMID_REV_BEFORE } as PuzzleData;
      const full = placementsFor(p);
      const stones = p.pyramids.reduce((s, b) => s + b.givens.filter((g) => g == null).length, 0);
      const boards: NpPlacements[] = p.pyramids.map(() => ({}));
      let right = 0, last = -1, isRising = true, isExact = true, isUnder = true;
      p.pyramids.forEach((b, i) => {
        for (const [cell, tray] of Object.entries(full[i]!)) {
          boards[i]![Number(cell)] = tray;
          right++;
          const g = gradeAnswer(p, npEncodeRound(i, boards), 0);
          if (g.isCorrect) continue;
          if (g.score !== Math.round((PYRAMID_PARTIAL_POINTS * right) / stones)) isExact = false;
          if (g.score < last) isRising = false;
          if (g.score >= 150) isUnder = false;
          last = g.score;
        }
      });
      if (isRising) rising++;
      if (isExact) exact++;
      if (isUnder) under++;
      for (const ms of [0, 20_000, 60_000]) {
        const answer = npEncodeRound(p.pyramids.length, full);
        const a = gradeAnswer(p, answer, ms), b = gradeAnswer(as2, answer, ms);
        if (a.isCorrect && a.score === b.score) finishSame++;
      }
      // A later pyramid's tiles never count: the first left empty, the second full.
      const skip = full.map((pl, i) => (i === 1 ? pl : {}));
      if (gradeAnswer(p, npEncodeRound(0, skip), 0).score === 0) later++;
      for (const s of KITS.numpyramid!.spam(p, makeRng(hashText(`npp:${level}:${seed}`)), 120_000)) {
        const row = (spam[s.label] ??= { rev3: [], rev2: [] });
        row.rev3.push(gradeAnswer(p, s.answer, 0).score);
        row.rev2.push(gradeAnswer(as2, s.answer, 0).score);
      }
    }
  ok(exact === lines, `3. unfinished credit is 130 × right ÷ stones on every flawless line's prefix (${exact} of ${lines})`);
  ok(rising === lines, `3. the credit rises stone by stone along a flawless line (${rising} of ${lines})`);
  ok(under === lines, `3. an unfinished round always scores under 150 (${under} of ${lines})`);
  ok(finishSame === lines * 3, `3. a finish scores exactly as depthRev 2's (${finishSame} of ${lines * 3})`);
  ok(later === lines, `3. a later pyramid's tiles never count while the current one is empty (${later} of ${lines})`);
  // Spam: the fairness audit's rule (scripts/puzzle-fairness.ts b: each strategy's median at most 5), and on average no
  // more than depthRev 2 gave the same answers.
  for (const [label, row] of Object.entries(spam)) {
    const sorted = [...row.rev3].sort((a, b) => a - b);
    const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    ok(median <= 5 && mean(row.rev3) <= mean(row.rev2) + 0.5, `3. spam "${label}": median ${median} (at most 5), mean ${mean(row.rev3).toFixed(1)} against depthRev 2's ${mean(row.rev2).toFixed(1)}`);
  }
}

/* 4. The help and intro. */
{
  const help = standardNumberHelp("numpyramid");
  const intro = INTRO_SCORE.numpyramid;
  ok(/share of all the stones you placed right/.test(help), "4. the help says each stone placed right counts");
  ok(/each right stone counts/.test(intro) && intro.length <= 90, `4. the intro says it (${intro.length} chars)`);
  const was = pinPrePyramidPartial(true);
  const oldHelp = standardNumberHelp("numpyramid");
  const oldIntro = INTRO_SCORE.numpyramid;
  pinPrePyramidPartial(was);
  ok(/the pyramids done and the share right of the one you are on/.test(oldHelp) && !/each right stone/.test(oldIntro), "4. the pin restores depthRev 2's help and intro");
}

console.log(failures ? `FAIL number-pyramid-partial-check: ${failures} failed, ${passes} passed` : `number-pyramid-partial-check: all ${passes} passed`);
process.exit(failures ? 1 : 0);
