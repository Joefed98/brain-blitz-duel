/**
 * depth-eagleeye-check (25 Oct 2026, depth to 200; docs/depth/d3-speed-attention.md): Eagle Eye `scanRev 2`. About 5 s.
 *
 *  1. Legacy: every run in scripts/fixtures/depth-attention-legacy.json.gz (recorded on main: scanRev 1 on
 *     puzzleScoreRev 3, every kit level, a clean fast player, spam, nothing) grades exactly as stored, as a room too.
 *  2. Rooms deal scanRev 2 (puzzleScoreRev 3), the maximum is 200 and the curve's fast share is rev 3's own.
 *  3. The same answer on scanRev 1 and scanRev 2: identical below 150 (every unfinished round, every finish slower
 *     than the old 150 pace); never lower on scanRev 2; taps taken back only cut the part above 150.
 *  4. Bands: a clean finish at the old 150 pace scores 150, at 76 % left 200; spam scores as on scanRev 1.
 *  5. The old-versus-new table: the kits' players, a clean player at the old 150 pace and an elite player.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { rev3Game } from "../src/lib/duel/puzzleScoreRev3";
import { SCAN_DEPTH_CURVE, SCAN_DEPTH_REV } from "../src/lib/duel/depth/eagleEye";
import type { PuzzleData, SymbolScanPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { eagleEyeDepthIntro, eagleEyeDepthHelp } from "../src/lib/duel/depth/attentionTexts";
import { TABLE_SEEDS, checkTexts, finish, median, ok, printTable, replayLegacy, scoreTable, top10 } from "./depth-attention-lib";

const legacy = replayLegacy("symscan");

const toOld = (p: PuzzleData) => ({ ...(p as SymbolScanPuzzleData), scanRev: 1 }) as PuzzleData;
const strip = (answer: string) => answer.split("|").slice(0, 3).join("|");

const p0 = roomPuzzle("symscan", 4242) as SymbolScanPuzzleData;
ok(p0.scanRev === SCAN_DEPTH_REV && (p0 as { puzzleScoreRev?: number }).puzzleScoreRev === 3, `rooms deal scanRev ${SCAN_DEPTH_REV} on puzzleScoreRev 3 (${p0.scanRev})`);
ok(roundMaxFor("symscan") === 200, "Eagle Eye's maximum is 200");
ok(SCAN_DEPTH_CURVE.fastShare === rev3Game("symscan").fastShare, "the stretch starts at rev 3's own 150 pace");

// 3. Same answers, both stamps.
const kit = KITS.symscan!;
for (let s = 0; s < 30; s++) {
  const seed = 30_000 + s * 11;
  const p = roomPuzzle("symscan", seed);
  const o = toOld(p);
  const limit = puzzleTimeLimitMs(p);
  const rng = makeRng(hashText(`depth-eagle:${seed}`));
  const steps = kit.play(p, rng, { level: "near", pace: 0.3 + 0.1 * (s % 5), err: 0.08 * (s % 3), reactionMs: 0, reactionSd: 0 }, limit).steps;
  for (const step of steps) {
    for (const ms of [0, Math.max(0, limit - step.atMs)]) {
      const n = gradeAnswer(p, step.answer, ms);
      const old = gradeAnswer(o, strip(step.answer), ms);
      if (old.score < 150) ok(n.score === old.score && n.isCorrect === old.isCorrect, `seed ${seed}: below 150 the scores differ (${old.score} → ${n.score})`);
      ok(n.score >= old.score && n.score <= 200, `seed ${seed}: scanRev 2 scored below scanRev 1 or above 200 (${old.score} → ${n.score})`);
      if (n.isCorrect && ms > 0) {
        const undo = (k: number) => gradeAnswer(p, `${strip(step.answer)}|${k}`, ms).score;
        ok(undo(1) <= undo(0) && undo(2) <= undo(1) && undo(4) <= undo(2), `seed ${seed}: taps taken back raised the score`);
        ok(undo(9) === Math.max(150, Math.min(old.score, 150)) || undo(9) === old.score, `seed ${seed}: 9 taps taken back still climbed above 150 (${undo(9)}, old ${old.score})`);
      }
    }
  }
}

// 4. Anchors on a perfect answer.
const perfect = (p: SymbolScanPuzzleData) => [...p.stages.map((_, i) => (p.targets?.[i] ?? []).join(",")), "0"].join("|");
const limit0 = puzzleTimeLimitMs(p0);
const at = (share: number) => gradeAnswer(p0, perfect(p0), Math.round(limit0 * share)).score;
ok(at(0) === 120, `a finish at the buzzer is 120 (${at(0)})`);
ok(at(0.55) === 150, `a clean finish at the old 150 pace is 150 (${at(0.55)})`);
ok(at(0.76) === 200 && at(0.9) === 200, `a clean finish with 76 % left is 200 (${at(0.76)})`);
ok(at(0.65) >= 150 && at(0.65) <= 165, `a clean finish just past the old pace stays 150–165 (${at(0.65)})`);
for (let s = 0; s < 20; s++) {
  const p = roomPuzzle("symscan", 31_000 + s);
  for (const spam of kit.spam(p, makeRng(s), puzzleTimeLimitMs(p))) ok(gradeAnswer(p, spam.answer, 0).score === gradeAnswer(toOld(p), spam.answer, 0).score, `spam ${spam.label} scores differently from scanRev 1`);
}

// 5. Table.
const rows = scoreTable("symscan", TABLE_SEEDS, toOld);
printTable("Eagle Eye, scanRev 1 (old) vs scanRev 2 (new), 40 room seeds", rows);
const row = (l: string) => rows.find((r) => r.label === l)!;
for (const l of ["average", "good", "great"]) ok(median(row(l).now) === median(row(l).old), `${l}: the median is unchanged below the old 150 pace`);
const pace = row("150 pace");
ok(median(pace.now) >= 150 && median(pace.now) <= 165, `a player at the old 150 pace lands 150–165 (median ${median(pace.now)})`);
ok(median(row("elite").now) >= 180 && Math.max(...row("elite").now) === 200, `elite play reaches 190–200 (median ${median(row("elite").now)}, top 10 % ${top10(row("elite").now)})`);
ok(rows.every((r) => Math.max(...r.old) <= 150), "no old-stamp run above 150");

await checkTexts("symscan", eagleEyeDepthIntro(), eagleEyeDepthHelp());
finish(`depth-eagleeye-check (${legacy} legacy runs)`);
