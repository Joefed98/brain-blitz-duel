/**
 * depth-doubletake-check (25 Oct 2026, depth to 200; docs/depth/d3-speed-attention.md): Double Take `spotRev 2`.
 * About 6 s.
 *
 *  1. Legacy: every run in scripts/fixtures/depth-attention-legacy.json.gz (recorded on main: spotRev 1 on
 *     puzzleScoreRev 3) grades exactly as stored, as a room too.
 *  2. Rooms deal spotRev 2: the two pictures and twelve counted differences as spotRev 1, plus one hidden seventh
 *     difference in one picture (a shape drawn smaller in one panel, at least two cells from every counted one, the
 *     phone's six groups unchanged), stored in `bonus`, which the phone never receives before the reveal.
 *  3. The same taps on spotRev 1 (hidden difference removed) and spotRev 2: identical below 150 when the hidden one
 *     was not tapped; tapping it is never a wrong tap and never adds to an unfinished round; a finish with it adds
 *     25; without it a finish tops out at 175, so 200 needs it; wrong taps cut only the part above 150.
 *  4. The old-versus-new table (the kits spot the hidden difference with a chance that grows with skill).
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { spotScenes } from "../src/lib/duel/attentionRev";
import { DOUBLE_TAKE_BONUS, SPOT_DEPTH_REV } from "../src/lib/duel/depth/doubleTake";
import { differenceGroups, hiddenCells } from "../src/puzzles/spotTheDifference";
import type { PuzzleData, SpotPuzzleData, SpotShape } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { doubleTakeDepthIntro, doubleTakeDepthHelp } from "../src/lib/duel/depth/attentionTexts";
import { TABLE_SEEDS, checkTexts, finish, median, ok, printTable, replayLegacy, scoreTable, top10 } from "./depth-attention-lib";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";

// The scoring standard (27 Oct 2026) deals Double Take spotRev 3: this check proves spotRev 2, the stamp it was written for.
pinPreStandard(true);
const legacy = replayLegacy("spotdiff");

const unshrink = (shapes: SpotShape[]) => shapes.map(({ small: _small, ...rest }) => rest);
const toOld = (p: PuzzleData): PuzzleData => {
  const d = p as SpotPuzzleData;
  const { bonus: _bonus, ...rest } = d;
  return { ...rest, spotRev: 1, top: unshrink(d.top), bottom: unshrink(d.bottom), reef: d.reef ? { top: unshrink(d.reef.top), bottom: unshrink(d.reef.bottom) } : undefined } as PuzzleData;
};
const dropCells = (answer: string, scene: number, cells: number[]) =>
  answer.split("|").map((part, i) => (i === scene ? part.split(",").filter((c) => c !== "" && !cells.includes(Number(c))).join(",") : part)).join("|");

ok(roundMaxFor("spotdiff") === 200, "Double Take's maximum is 200");
let withBonus = 0;
for (let s = 0; s < 60; s++) {
  const p = roomPuzzle("spotdiff", 50_000 + s * 7) as SpotPuzzleData;
  ok(p.spotRev === SPOT_DEPTH_REV && (p as { puzzleScoreRev?: number }).puzzleScoreRev === 3 && puzzleTimeLimitMs(p) === 60_000, `seed ${s}: rooms deal spotRev 2, 60 s`);
  ok((p.differences ?? []).length === 12, `seed ${s}: twelve counted differences`);
  const scenes = spotScenes(p);
  ok(scenes.every((sc) => differenceGroups(sc.top, sc.bottom).length === 6), `seed ${s}: the phone still sees six groups a picture`);
  if (!p.bonus) continue;
  withBonus++;
  const scene = p.bonus.scene ?? 0;
  const hidden = scenes.map((sc) => hiddenCells(sc.top, sc.bottom));
  ok(JSON.stringify(hidden[scene]) === JSON.stringify(p.bonus.cells) && hidden.every((h, i) => i === scene || h.length === 0), `seed ${s}: exactly one hidden difference, where stored`);
  const own = (p.differences ?? []).filter((d) => (d.scene ?? 0) === scene).flatMap((d) => d.cells);
  const c = p.bonus.cells[0]!;
  ok(own.every((o) => Math.max(Math.abs((o % 8) - (c % 8)), Math.abs(Math.floor(o / 8) - Math.floor(c / 8))) >= 2), `seed ${s}: the hidden difference sits apart from the counted ones`);
  const { pub, priv } = splitPuzzle(p);
  ok(!("bonus" in (pub as object)) && "bonus" in priv && !("differences" in (pub as object)), `seed ${s}: the hidden difference stays server-side`);
}
ok(withBonus >= 58, `nearly every round hides a seventh difference (${withBonus} of 60)`);

const kit = KITS.spotdiff!;
for (let s = 0; s < 40; s++) {
  const seed = 60_000 + s * 17;
  const p = roomPuzzle("spotdiff", seed) as SpotPuzzleData;
  if (!p.bonus) continue;
  const o = toOld(p);
  const scene = p.bonus.scene ?? 0;
  const limit = 60_000;
  const steps = kit.play(p, makeRng(hashText(`depth-dt:${seed}`)), { level: "near", pace: 0.25 + 0.15 * (s % 5), err: 0.08 * (s % 3), reactionMs: 0, reactionSd: 0 }, limit).steps;
  for (const step of steps)
    for (const ms of [0, Math.max(0, limit - step.atMs)]) {
      const n = gradeAnswer(p, step.answer, ms);
      const tapped = (step.answer.split("|")[scene] ?? "").split(",").includes(String(p.bonus.cells[0]));
      const old = gradeAnswer(o, dropCells(step.answer, scene, p.bonus.cells), ms);
      ok(n.isCorrect === old.isCorrect, `seed ${seed}: the finish rule moved`);
      if (!n.isCorrect) ok(n.score === old.score, `seed ${seed}: an unfinished round scores differently (${old.score} → ${n.score})`);
      else {
        const plain = gradeAnswer(p, dropCells(step.answer, scene, p.bonus.cells), ms).score;
        ok(n.score === Math.min(200, plain + (tapped ? DOUBLE_TAKE_BONUS : 0)), `seed ${seed}: the hidden difference adds ${DOUBLE_TAKE_BONUS} on a finish (${plain} → ${n.score})`);
        if (old.score < 150) ok(plain === old.score, `seed ${seed}: below 150 a finish scores differently (${old.score} → ${plain})`);
        ok(plain >= old.score && plain <= 175, `seed ${seed}: without the hidden difference a finish is ${old.score}–175 (${plain})`);
      }
    }
}

// Anchors on a perfect answer, with and without the hidden difference, and with wrong taps.
const p0 = roomPuzzle("spotdiff", 4242) as SpotPuzzleData;
const scene0 = p0.bonus!.scene ?? 0;
const answerOf = (hiddenToo: boolean, wrong = 0) =>
  [0, 1].map((sc) => {
    const cells = (p0.differences ?? []).filter((d) => (d.scene ?? 0) === sc).map((d) => d.cells[0]!);
    const extra = hiddenToo && sc === scene0 ? [p0.bonus!.cells[0]!] : [];
    const used = new Set([...(p0.differences ?? []).filter((d) => (d.scene ?? 0) === sc).flatMap((d) => d.cells), ...(sc === scene0 ? p0.bonus!.cells : [])]);
    const wrongs = sc === 0 ? Array.from({ length: 48 }, (_, i) => i).filter((i) => !used.has(i)).slice(0, wrong) : [];
    return [...wrongs, ...extra, ...cells].join(",");
  }).join("|");
const at = (share: number, hiddenToo: boolean, wrong = 0) => gradeAnswer(p0, answerOf(hiddenToo, wrong), Math.round(60_000 * share)).score;
ok(at(0, false) === 120 && at(0.69, false) === 150 && at(0.84, false) === 175 && at(0.84, true) === 200, `anchors 120 / 150 / 175 / 200 (${at(0, false)} / ${at(0.69, false)} / ${at(0.84, false)} / ${at(0.84, true)})`);
ok(at(0.84, true, 3) < at(0.84, true) && at(0.84, true, 3) >= 175 && at(0.5, false, 3) === at(0.5, false), `wrong taps cut only the climb above 150 (${at(0.84, true, 3)})`);
ok(at(0, true) === 145, `the hidden difference adds 25 even at the buzzer (${at(0, true)})`);

const rows = scoreTable("spotdiff", TABLE_SEEDS, toOld);
printTable("Double Take, spotRev 1 (old) vs spotRev 2 (new), 40 room seeds", rows);
const row = (l: string) => rows.find((r) => r.label === l)!;
for (const l of ["average", "good"]) ok(Math.abs(median(row(l).now) - median(row(l).old)) <= Math.max(3, 0.1 * median(row(l).old)), `${l}: the median moves at most 10 % (${median(row(l).old)} → ${median(row(l).now)})`);
ok(median(row("elite").now) >= 185 && Math.max(...row("elite").now) >= 198, `elite play reaches 190–200 (median ${median(row("elite").now)}, top 10 % ${top10(row("elite").now)})`);
ok(rows.every((r) => Math.max(...r.old) <= 150), "no old-stamp run above 150");

await checkTexts("spotdiff", doubleTakeDepthIntro(), doubleTakeDepthHelp());
finish(`depth-doubletake-check (${legacy} legacy runs)`);
