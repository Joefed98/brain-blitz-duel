/**
 * depth-tilegrid-check (word depth, 25 Oct 2026; docs/depth/d1-word.md): Interlock tileGridRev 1, the STRETCH route.
 *   1. Every pre-depth case in scripts/fixtures/depth-tilegrid-legacy.json.gz (kit answers on room seeds, recorded
 *      before the change; `--record` re-records) regrades exactly.
 *   2. New rounds deal tileGridRev 1 on the same board; unfinished grids score as before; a finish keeps today's
 *      score and adds the pace bonus (at most 50), 150 at today's pace, 200 only at the elite pace; more time left
 *      never scores less; the breakdown adds up.
 *   3. Bands (scripts/depth-word-bands.ts): a solid player unchanged, near-perfect about 150–165, elite 190–200.
 *   4. The intro and help state the curve.
 *
 *   bun scripts/depth-tilegrid-check.ts [--record]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
// Written for the stamps before the scoring standard (docs/scoring-standard.md): new deals keep them.
pinPreStandard(true);
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { rev3Game } from "../src/lib/duel/puzzleScoreRev3";
import { TILEGRID_STRETCH, TILEGRID_STRETCH_TOPUP, stretchSeconds } from "../src/lib/duel/depth/stretchShapes";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { runStretchCheck } from "./depth-stretch-lib";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, msg: string) => (cond ? passes++ : failures.length < 40 && failures.push(msg));

await runStretchCheck(
  { type: "tilegrid", fixture: "scripts/fixtures/depth-tilegrid-legacy.json.gz", stamp: { field: "tileGridRev", depth: 1, pre: undefined }, fast: rev3Game("tilegrid").fastShare, elite: TILEGRID_STRETCH.elite },
  ok,
  (p, old) => {
    const solution = (p as { solution?: string[] }).solution ?? [];
    const answer = solution.map((c) => c || ".").join("");
    const limit = puzzleTimeLimitMs(p);
    const at = (share: number) => gradeAnswer(p, answer, Math.round(limit * share));
    ok(at(rev3Game("tilegrid").fastShare).score === 150 && gradeAnswer(old, answer, Math.round(limit * rev3Game("tilegrid").fastShare)).score === 150, "today's 150 pace still scores 150");
    ok(at(TILEGRID_STRETCH.elite).score === 200 && at(1).score === 200, `the elite pace scores 200 (${at(TILEGRID_STRETCH.elite).score})`);
    ok(at(rev3Game("tilegrid").fastShare + 0.03).score <= 160, `a little faster than today's 150 pace stays near 150 (${at(rev3Game("tilegrid").fastShare + 0.03).score})`);
  },
);
// The intro states the stamp rooms deal: since the puzzle top-up (26 Oct 2026) tileGridRev 2's elite pace.
const s = stretchSeconds("tilegrid", TILEGRID_STRETCH_TOPUP);
ok(INTRO_SCORE.tilegrid.includes("200 in about") && INTRO_SCORE.tilegrid.includes(`${s.elite} s`), `the intro states the elite pace: ${INTRO_SCORE.tilegrid}`);
ok(PUZZLE_INSTRUCTIONS.tilegrid.score.includes("pace bonus") && PUZZLE_INSTRUCTIONS.tilegrid.score.includes("200 if you finish"), "the help explains the pace bonus");

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL depth-tilegrid-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS depth-tilegrid-check: ${passes} checks`);
