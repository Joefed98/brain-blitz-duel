/**
 * depth-tally-check (25 Oct 2026, depth to 200; docs/depth/d3-speed-attention.md): Tally `countRev 3`. About 5 s.
 *
 *  1. Legacy: every run in scripts/fixtures/depth-attention-legacy.json.gz (recorded on main: countRev 2 on
 *     puzzleScoreRev 3) grades exactly as stored, as a room too.
 *  2. Rooms deal countRev 3 (puzzleScoreRev 3, the same four trays and 60 s), the maximum is 200.
 *  3. The same answer on countRev 2 and countRev 3: identical below 150; never lower on countRev 3.
 *  4. Anchors: a finish at the old 150 pace is 150, with 83 % left 200; guesses score as on countRev 2.
 *  5. The old-versus-new table.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { rev3Game } from "../src/lib/duel/puzzleScoreRev3";
import { countUpStageTruth } from "../src/lib/duel/attentionRev";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { COUNT_DEPTH_CURVE, COUNT_DEPTH_REV } from "../src/lib/duel/depth/tally";
import type { CountUpPuzzleData, PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { tallyDepthIntro, tallyDepthHelp } from "../src/lib/duel/depth/attentionTexts";
import { TABLE_SEEDS, checkTexts, finish, median, ok, printTable, replayLegacy, scoreTable, top10 } from "./depth-attention-lib";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const legacy = replayLegacy("countup");
const toOld = (p: PuzzleData) => ({ ...(p as CountUpPuzzleData), countRev: 2 }) as PuzzleData;

const p0 = roomPuzzle("countup", 4242) as CountUpPuzzleData;
ok(p0.countRev === COUNT_DEPTH_REV && (p0 as { puzzleScoreRev?: number }).puzzleScoreRev === 3 && p0.stages.length === 4 && puzzleTimeLimitMs(p0) === 60_000, `rooms deal countRev ${COUNT_DEPTH_REV}: four trays, 60 s (${p0.countRev})`);
ok(roundMaxFor("countup") === 200, "Tally's maximum is 200");
ok(COUNT_DEPTH_CURVE.fastShare === rev3Game("countup").fastShare, "the stretch starts at rev 3's own 150 pace");

const kit = KITS.countup!;
for (let s = 0; s < 40; s++) {
  const seed = 40_000 + s * 13;
  const p = roomPuzzle("countup", seed);
  const o = toOld(p);
  const limit = puzzleTimeLimitMs(p);
  const steps = kit.play(p, makeRng(hashText(`depth-tally:${seed}`)), { level: "near", pace: 0.25 + 0.15 * (s % 5), err: 0.1 * (s % 3), reactionMs: 0, reactionSd: 0 }, limit).steps;
  for (const step of steps)
    for (const ms of [0, Math.max(0, limit - step.atMs)]) {
      const n = gradeAnswer(p, step.answer, ms);
      const old = gradeAnswer(o, step.answer, ms);
      if (old.score < 150) ok(n.score === old.score && n.isCorrect === old.isCorrect, `seed ${seed}: below 150 the scores differ (${old.score} → ${n.score})`);
      ok(n.score >= old.score && n.score <= 200, `seed ${seed}: countRev 3 scored below countRev 2 or above 200 (${old.score} → ${n.score})`);
    }
}

const right = joinStages(p0.stages.map((st) => String(countUpStageTruth(st))), 4);
const at = (share: number) => gradeAnswer(p0, right, Math.round(60_000 * share)).score;
ok(at(0) === 120 && at(0.72) === 150 && at(0.83) === 200 && at(0.95) === 200, `anchors 120 / 150 / 200 (${at(0)} / ${at(0.72)} / ${at(0.83)})`);
ok(at(0.76) >= 150 && at(0.76) <= 165, `just past the old pace stays 150–165 (${at(0.76)})`);
for (let s = 0; s < 20; s++) {
  const p = roomPuzzle("countup", 41_000 + s);
  for (const spam of kit.spam(p, makeRng(s), 60_000)) ok(gradeAnswer(p, spam.answer, 0).score === gradeAnswer(toOld(p), spam.answer, 0).score, `guess ${spam.label} scores differently from countRev 2`);
}

const rows = scoreTable("countup", TABLE_SEEDS, toOld);
printTable("Tally, countRev 2 (old) vs countRev 3 (new), 40 room seeds", rows);
const row = (l: string) => rows.find((r) => r.label === l)!;
for (const l of ["average", "good", "great"]) ok(Math.abs(median(row(l).now) - median(row(l).old)) <= Math.max(3, 0.1 * median(row(l).old)), `${l}: the median moves at most 10 % (${median(row(l).old)} → ${median(row(l).now)})`);
const pace = row("150 pace");
ok(median(pace.now) >= 150 && median(pace.now) <= 165, `a player at the old 150 pace lands 150–165 (median ${median(pace.now)})`);
ok(median(row("elite").now) >= 185 && Math.max(...row("elite").now) === 200, `elite play reaches 190–200 (median ${median(row("elite").now)}, top 10 % ${top10(row("elite").now)})`);
ok(rows.every((r) => Math.max(...r.old) <= 150), "no old-stamp run above 150");

await checkTexts("countup", tallyDepthIntro(), tallyDepthHelp());
finish(`depth-tally-check (${legacy} legacy runs)`);
