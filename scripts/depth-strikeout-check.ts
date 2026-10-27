/**
 * depth-strikeout-check (word depth, 25 Oct 2026; docs/depth/d1-word.md): Strikeout strikeoutRev 5, STRETCH + the
 * early-solve bonus.
 *   1. Every pre-depth case in scripts/fixtures/depth-strikeout-legacy.json.gz (kit answers on rev-4 room seeds,
 *      recorded before the change; `--record` re-records) regrades exactly; so2Rules(5) is rev 4's.
 *   2. New rounds deal rev 5 on rev 4's draw; unfinished rounds score as before; a finish keeps today's score and
 *      adds the pace and early-solve bonuses (at most 50); more time left never scores less; the breakdown adds up.
 *   3. Early solves: so2EarlySolves counts the tiles still hidden at each right Solve; guessing every word out earns
 *      no early points; more hidden at the solves never scores less; Solve on every word at its start with the
 *      elite pace scores 200, at today's pace 150 + the early points only.
 *   4. Bands (scripts/depth-word-bands.ts): a solid player unchanged, near-perfect about 150–165, elite 190–200.
 *   5. The intro and help state it.
 *
 *   bun scripts/depth-strikeout-check.ts [--record]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
// Written for the stamps before the scoring standard (docs/scoring-standard.md): new deals keep them.
pinPreStandard(true);
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { rev3Game } from "../src/lib/duel/puzzleScoreRev3";
import { STRIKEOUT_EARLY_POINTS, STRIKEOUT_STRETCH } from "../src/lib/duel/depth/stretchShapes";
import { strikeoutEarlyPoints } from "../src/lib/duel/depth/strikeout.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { SO4_RULES, encodeStrikeout2, so2EarlySolves, so2Rules, type So2Action } from "../src/lib/duel/strikeout";
import type { StrikeoutPuzzleData } from "../src/lib/duel/types";
import { runStretchCheck } from "./depth-stretch-lib";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, msg: string) => (cond ? passes++ : failures.length < 40 && failures.push(msg));
const yes = () => true;

ok(so2Rules(5) === SO4_RULES, "rev 5 plays rev 4's rules");

await runStretchCheck(
  { type: "strikeout", fixture: "scripts/fixtures/depth-strikeout-legacy.json.gz", stamp: { field: "strikeoutRev", depth: 5, pre: 4 }, fast: rev3Game("strikeout").fastShare, elite: STRIKEOUT_STRETCH.elite },
  ok,
  (p) => {
    const d = p as StrikeoutPuzzleData;
    const words = d.words ?? [];
    const givens = d.givens ?? [];
    const limit = puzzleTimeLimitMs(p);
    // Solve every word at its start: everything still hidden.
    const allEarly: So2Action[] = words.map((w, i) => ({ kind: "solve", word: i, guess: w }));
    const e = so2EarlySolves(words, givens, allEarly, yes, SO4_RULES);
    ok(e.share === 1 && e.hiddenAtSolve.every((h, i) => h === e.openAtStart[i]), "Solve at each word's start: every hidden tile counts");
    // Guess every letter out: no early solve.
    const guessed: So2Action[] = words.flatMap((w, i) => [...new Set(w)].filter((ch) => (givens[i] ?? "").indexOf(ch) < 0).map((letter) => ({ kind: "guess" as const, word: i, letter })));
    const g = so2EarlySolves(words, givens, guessed, yes, SO4_RULES);
    ok(g.share === 0, `guessed out: no early share (${g.share})`);
    const fast = rev3Game("strikeout").fastShare;
    const at = (answer: So2Action[], share: number) => gradeAnswer(p, encodeStrikeout2(answer), Math.round(limit * share));
    ok(at(allEarly, STRIKEOUT_STRETCH.elite).score === 200, `all early at the elite pace scores 200 (${at(allEarly, STRIKEOUT_STRETCH.elite).score})`);
    ok(at(allEarly, fast).score === 150 + STRIKEOUT_EARLY_POINTS, `all early at today's 150 pace: 150 + the early points (${at(allEarly, fast).score})`);
    const out = at(guessed, STRIKEOUT_STRETCH.elite);
    if (out.isCorrect) ok(out.score <= 175 && Number((out.extra as { earlyBonus?: number }).earlyBonus) === 0, `guessed out at the elite pace: no early points (${out.score})`);
    // Half the words early, the rest guessed out, scores between the two.
    const mixed: So2Action[] = words.flatMap((w, i) => (i % 2 === 0 ? [{ kind: "solve" as const, word: i, guess: w }] : guessed.filter((a) => a.word === i)));
    const m = at(mixed, STRIKEOUT_STRETCH.elite);
    if (out.isCorrect) ok(m.score >= out.score && m.score <= 200, `more early solves never score less (${out.score} ≤ ${m.score} ≤ 200)`);
  },
);
let prev = -1;
for (let k = 0; k <= 20; k++) {
  const pts = strikeoutEarlyPoints(k / 20, 0.7);
  ok(pts >= prev && pts <= STRIKEOUT_EARLY_POINTS, `early points rise with the share (${prev} → ${pts})`);
  prev = pts;
}
ok(strikeoutEarlyPoints(1, 0) === 0 && strikeoutEarlyPoints(1, 1) === STRIKEOUT_EARLY_POINTS, "early points need a quick finish");
ok(INTRO_SCORE.strikeout.includes("200 needs early solves"), `the intro states the early solves: ${INTRO_SCORE.strikeout}`);
ok(/early solves/.test(PUZZLE_INSTRUCTIONS.strikeout.score) && PUZZLE_INSTRUCTIONS.strikeout.how.some((l) => /early/i.test(l.detail) && !l.helpOnly), "the help and the intro's how lines explain early solves");

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL depth-strikeout-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS depth-strikeout-check: ${passes} checks`);
