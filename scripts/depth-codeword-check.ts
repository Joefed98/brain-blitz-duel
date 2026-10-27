/**
 * depth-codeword-check (word depth, 25 Oct 2026; docs/depth/d1-word.md): Cryptogrid codewordRev 4, the STRETCH route.
 *   1. Every pre-depth case in scripts/fixtures/depth-codeword-legacy.json.gz (kit answers on room seeds, recorded
 *      before the change; `--record` re-records) regrades exactly.
 *   2. New rounds deal codewordRev 4 on rev 3's board; unfinished grids score as before; a finish keeps today's
 *      score and adds the pace bonus (at most 50), 150 at today's pace, 200 only at the elite pace; more time left
 *      never scores less; the breakdown adds up.
 *   3. Bands (scripts/depth-word-bands.ts): a solid player unchanged, near-perfect about 150–165, elite 190–200.
 *   4. The intro and help state the curve.
 *
 *   bun scripts/depth-codeword-check.ts [--record]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
// Written for the stamps before the scoring standard (docs/scoring-standard.md): new deals keep them.
pinPreStandard(true);
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { rev3Game } from "../src/lib/duel/puzzleScoreRev3";
import { CODEWORD_STRETCH, stretchSeconds } from "../src/lib/duel/depth/stretchShapes";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { runStretchCheck } from "./depth-stretch-lib";
import { encodeCodeword } from "../src/lib/duel/codeword";
import type { CodewordPuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, msg: string) => (cond ? passes++ : failures.length < 40 && failures.push(msg));

await runStretchCheck(
  { type: "codeword", fixture: "scripts/fixtures/depth-codeword-legacy.json.gz", stamp: { field: "codewordRev", depth: 4, pre: 3 }, fast: rev3Game("codeword").fastShare, elite: CODEWORD_STRETCH.elite },
  ok,
  (p, old) => {
    const d = p as CodewordPuzzleData;
    const given = new Set(d.givens.map((g) => g.n));
    const answer = encodeCodeword(Array.from({ length: d.numbers }, (_, i) => i + 1).filter((n) => !given.has(n)).map((n) => ({ n, letter: d.solution![n - 1]! })));
    const limit = puzzleTimeLimitMs(p);
    const at = (share: number) => gradeAnswer(p, answer, Math.round(limit * share));
    ok(at(rev3Game("codeword").fastShare).score === 150 && gradeAnswer(old, answer, Math.round(limit * rev3Game("codeword").fastShare)).score === 150, "today's 150 pace still scores 150");
    ok(at(CODEWORD_STRETCH.elite).score === 200 && at(1).score === 200, `the elite pace scores 200 (${at(CODEWORD_STRETCH.elite).score})`);
    ok(at(rev3Game("codeword").fastShare + 0.03).score <= 160, `a little faster than today's 150 pace stays near 150 (${at(rev3Game("codeword").fastShare + 0.03).score})`);
  },
);
const s = stretchSeconds("codeword", CODEWORD_STRETCH);
ok(INTRO_SCORE.codeword.includes("200 in about") && INTRO_SCORE.codeword.includes(`${s.elite} s`), `the intro states the elite pace: ${INTRO_SCORE.codeword}`);
ok(PUZZLE_INSTRUCTIONS.codeword.score.includes("pace bonus") && PUZZLE_INSTRUCTIONS.codeword.score.includes("200 if you finish"), "the help explains the pace bonus");

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL depth-codeword-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS depth-codeword-check: ${passes} checks`);
