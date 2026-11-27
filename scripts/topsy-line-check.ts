/**
 * topsy-line-check (D4, 22 Nov 2026): Topsy-Turvy's Normal scoring stamp gravityRev 9 (src/lib/duel/topsyLine.ts;
 * Joe's option A: Normal's full-speed time 32 s → 40 s, nothing else changed).
 *
 *  1. Every gravityRev 8 grade recorded before the stamp (scripts/fixtures/topsy-line-legacy.json.gz, by
 *     scripts/topsy-line-legacy-record.ts) regrades exactly: score, correctness and extra.
 *  2. Normal deals gravityRev 9, the same puzzle as gravityRev 8 but for the stamp; the era pin (preTopsyLine) deals
 *     gravityRev 8 and restores; a level deal keeps gravityRev 8 and its level.
 *  3. gravityRev 9 Normal: a flawless solve is 200 with 40 s used, less with 45 s used; the same answer on gravityRev 8
 *     is less than 200 with 40 s used (its 32 s line); a level round grades on its own level line, the same on either.
 *  4. The texts: the "?" help names 40 s on gravityRev 9 and 32 s under the pin; the Classic "Head rush" challenge
 *     asks for 40 s.
 *
 * Fast (no browser): bun scripts/topsy-line-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { PRACTICE_CHALLENGES } from "../src/lib/duel/practiceChallenges";
import { withSeededRandom } from "../src/lib/duel/random";
import { parMovesPatternHelp } from "../src/lib/duel/standard/patternText";
import { TOPSY_LINE_REV, TOPSY_NORMAL_FULL_BY_S, pinPreTopsyLine, topsyLineDealt, usesTopsyLine } from "../src/lib/duel/topsyLine";
import type { GravityPuzzleData } from "../src/lib/duel/types";

let passes = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else if (failures.length < 40) failures.push(message);
  else failures.length++;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const deal = (seed: number, level?: string) =>
  withSeededRandom(0x70b5 + seed, () => generatePuzzle("gravity", { bankSeed: (seed * 7919 + 13) >>> 0, ...(level ? { level } : {}) } as never)) as GravityPuzzleData;
const used = (s: number) => 120_000 - s * 1000;

/* 1. The recorded gravityRev 8 grades. */
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/topsy-line-legacy.json.gz")).toString()) as {
    puzzles: Record<string, GravityPuzzleData>;
    cases: { seed: number; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }[];
  };
  check(fx.cases.length === 1440 && Object.keys(fx.puzzles).length === 40, `the fixture holds 40 deals and 1,440 grades (${Object.keys(fx.puzzles).length}, ${fx.cases.length})`);
  check(Object.values(fx.puzzles).every((p) => p.gravityRev === 8), "every recorded deal is gravityRev 8");
  let bad = 0;
  for (const c of fx.cases) {
    const g = gradeAnswer(fx.puzzles[c.seed]!, c.answer, c.msLeft);
    if (g.score !== c.score || g.isCorrect !== c.isCorrect || !same(g.extra ?? null, c.extra)) bad++;
  }
  check(bad === 0, `gravityRev 8: ${bad} of ${fx.cases.length} recorded grades differ`);
  check(fx.cases.some((c) => c.score === 200) && fx.cases.some((c) => c.isCorrect && c.score < 200), "the fixture holds 200s and finishes that lost speed");
}

/* 2. The deal. */
{
  check(topsyLineDealt(), "gravityRev 9 is dealt with nothing pinned");
  for (let seed = 0; seed < 12; seed++) {
    const now = deal(seed);
    const was = pinPreTopsyLine(true);
    const before = deal(seed);
    pinPreTopsyLine(was);
    check(now.gravityRev === TOPSY_LINE_REV && usesTopsyLine(now), `seed ${seed}: Normal deals gravityRev ${now.gravityRev}`);
    check(before.gravityRev === 8 && !usesTopsyLine(before), `seed ${seed}: the pin deals gravityRev ${before.gravityRev}`);
    check(same({ ...now, gravityRev: 8 }, before), `seed ${seed}: gravityRev 9 is gravityRev 8's puzzle but for the stamp`);
  }
  check(topsyLineDealt(), "the pin restores");
  for (const level of ["easy", "hard", "expert"]) {
    const p = deal(3, level);
    check(p.gravityRev === 8 && (p as { level?: string }).level === level, `${level}: a level deal keeps gravityRev 8 (${p.gravityRev}) and its level`);
  }
}

/* 3. The grade. */
{
  for (let seed = 0; seed < 8; seed++) {
    const p = deal(seed);
    const answer = (p.boardSolutions ?? []).join("");
    check(gradeAnswer(p, answer, used(TOPSY_NORMAL_FULL_BY_S)).score === 200, `seed ${seed}: gravityRev 9 isn't 200 with 40 s used`);
    check(gradeAnswer(p, answer, used(TOPSY_NORMAL_FULL_BY_S + 5)).score < 200, `seed ${seed}: gravityRev 9 is still 200 with 45 s used`);
    check(gradeAnswer({ ...p, gravityRev: 8 }, answer, used(TOPSY_NORMAL_FULL_BY_S)).score < 200, `seed ${seed}: gravityRev 8 is 200 with 40 s used (its line is 32 s)`);
    check(gradeAnswer({ ...p, gravityRev: 8 }, answer, used(30)).score === 200, `seed ${seed}: gravityRev 8 isn't 200 with 30 s used`);
    const h = deal(seed, "hard");
    const ha = (h.boardSolutions ?? []).join("");
    for (const s of [30, 50, 70]) check(gradeAnswer(h, ha, used(s)).score === gradeAnswer({ ...h, gravityRev: 9 }, ha, used(s)).score, `seed ${seed}: a Hard round's grade at ${s} s depends on the stamp`);
  }
}

/* 4. The texts. */
{
  check(parMovesPatternHelp("gravity").includes(`${TOPSY_NORMAL_FULL_BY_S} s`) && !parMovesPatternHelp("gravity").includes("32 s"), `help: gravityRev 9 doesn't name 40 s (${parMovesPatternHelp("gravity")})`);
  const was = pinPreTopsyLine(true);
  check(parMovesPatternHelp("gravity").includes("32 s"), "help: under the pin it doesn't name gravityRev 8's 32 s");
  pinPreTopsyLine(was);
  check(parMovesPatternHelp("iceslide").includes("30 s"), "help: Skid's 30 s moved");
  const rush = PRACTICE_CHALLENGES.find((c) => c.id === "gravity.head-rush");
  check(!!rush && rush.text.includes(`${TOPSY_NORMAL_FULL_BY_S} s`) && rush.goal.kind === "speed" && rush.goal.withinS === TOPSY_NORMAL_FULL_BY_S, `Head rush asks for 40 s (${rush?.text})`);
}

if (failures.length) {
  for (const f of failures.filter(Boolean)) console.log(`FAIL ${f}`);
  console.log(`topsy-line-check: ${passes} passed, ${failures.length} failed`);
  console.log("FAIL");
  process.exit(1);
}
console.log(`PASS topsy-line-check: ${passes} checks (gravityRev 8 regrades exactly; gravityRev 9 deals, grades and reads 40 s)`);
