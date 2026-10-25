/**
 * scoring-batch2-check (20 Oct 2026): batch 2 of the scoring report (docs/scoring-report-oct-2026.md, #119;
 * docs/scoring-targets.md "Scoring report batch 2"): open, speed and engine games on new stamps.
 *
 *  1. Rooms deal the new stamps: Nucleus wordsmithRev 2, Forage wordHuntRev 2, Flash and Bang On tapRev 4,
 *     Tenfall tenRev 3, Pull! clayRev 8, Mixed Signals clashRev 7; Letterfall is practice only (registry,
 *     still playable) on its current wordfallRev 3, and Word keeps at least 6 active games.
 *  2. The rules: Nucleus' one curve (never falls, at most 140 without a word using every tile, 150 only with it,
 *     the open-game knots pass it through); Forage's misses (only real non-word paths of 4+ letters count, older
 *     rounds ignore "!" entries); Flash's decoy cut (none up to half the decoys, a miss at all of them, older
 *     stamps never read decoys); Bang On's curve; Tenfall's raw shape with no cliff (10/10 at the buzzer 120, nine
 *     110, every tick earlier never less, at most the speed part's own step between ticks); Pull!'s quick part
 *     (150 only for a perfect quick run, more credit or more clays never less); Mixed Signals' map (rises, unfinished
 *     at most 110 and a finish 120+, also on every stored run, 150
 *     only at 150). Older stamps score as before (their own functions, unchanged).
 *  3. Stored runs on the new stamps (scripts/fixtures/scoring-batch2-runs.json.gz, recorded with --record from
 *     the puzzle-fairness kits on the scoring report's seeds): each grades to its stored score and verdict, and
 *     identically as a room (a time-out received in the reveal phase).
 *  4. The report's pass marks on those runs: the worst spam strategy's median ≤ 10 and 90th percentile ≤ 25,
 *     the average player 60–79 (Tenfall excepted: its raw shape puts 8 of 10 targets at 97, a decision for
 *     Joe), and each level no lower than the one below.
 *
 *   bun scripts/scoring-batch2-check.ts            # ~10 s
 *   bun scripts/scoring-batch2-check.ts --record   # re-record the fixture (only when a stamp here changes)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import "../src/lib/duel/wordfallDict.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { ACTIVE_PUZZLE_TYPES, isRetired, PUZZLE_REGISTRY, puzzleTimeLimitMs, typesInCategory } from "../src/lib/duel/registry";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import {
  scoreReaction,
  scoreStopWatch,
  scoreWordHunt,
  scoreWordsmith,
  STOPWATCH_REV4_CURVE,
  WORDHUNT_MISS_MARK,
  WORDHUNT_REV_MISSES,
  WORDSMITH_REV_ONE_CURVE,
  WORDSMITH_V2_CAP,
  wordHuntMissKeptPct,
} from "../src/lib/duel/scoring";
import { REV2_IDENTITY_KNOTS, rev2KnotsFor, rev2KnotsForPuzzle } from "../src/lib/duel/puzzleScoreRev2";
import { flashDecoyCut, replayFlash, TAP_REV_ONE_CURVE, TAP_REV_SPEED_TUNING } from "../src/lib/duel/tapLog";
import { isWordHuntMiss, wordFromPath } from "../src/lib/duel/wordHunt.server";
import { isWord } from "../src/lib/duel/dictionary.server";
import { TEN_DROP_RAW_REV, tenDropScore, TD_RUN_TICKS } from "../src/lib/arcade/tenDrop";
import { CLAY_QUICK_STEPS, CLAY_REV_DEPTH, CLAY_REV_QUICK, clayQuickScore } from "../src/lib/arcade/clayShoot";
import { CLASH_GREAT_MAP, CLASH_REV_DEPTH, CLASH_REV_GREAT } from "../src/lib/arcade/colourClash";
import { bandMapTotal } from "../src/lib/arcade/scoreBands";
import { WORDFALL_REV_BANDS } from "../src/lib/arcade/wordfall";
import type { PuzzleData, PuzzleType, ReactionPuzzleData, WordHuntPuzzleData, WordsmithPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { PROFILES } from "./arcade-skill-bands/human";
import { pinPreDepthTapRev } from "../src/lib/duel/tapLog";

// Flash, Bang On and Ascend deal tapRev 5 (Depth to 200, depth-*-check proves it); this check proves the stamps before it.
pinPreDepthTapRev(true);

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

/* ============================== 1. Stamps and rotation ============================== */
const dealt = (type: PuzzleType, field: string) => (generatePuzzle(type) as unknown as Record<string, unknown>)[field];
ok(dealt("wordsmith", "wordsmithRev") === WORDSMITH_REV_ONE_CURVE, "Nucleus: rooms deal wordsmithRev 2");
ok(dealt("wordhunt", "wordHuntRev") === WORDHUNT_REV_MISSES, "Forage: rooms deal wordHuntRev 2");
ok(dealt("reaction", "tapRev") === TAP_REV_ONE_CURVE && dealt("stopwatch", "tapRev") === TAP_REV_ONE_CURVE, "Flash and Bang On: rooms deal tapRev 4");
ok(dealt("tendrop", "tenRev") === TEN_DROP_RAW_REV, "Tenfall: rooms deal tenRev 3");
// Depth to 200 (25 Oct 2026): rooms deal clayRev 9 (clayRev 8 play and base, depth-pull-check); clayRev 8 is proved on its stored runs.
ok(dealt("clayshoot", "clayRev") === CLAY_REV_QUICK || dealt("clayshoot", "clayRev") === CLAY_REV_DEPTH, "Pull!: rooms deal clayRev 8 or 9");
// Depth to 200 (25 Oct 2026): rooms deal clashRev 8 (depth-mixedsignals-check); clashRev 7 is proved on its stored runs.
ok(dealt("stroop", "clashRev") === CLASH_REV_GREAT || dealt("stroop", "clashRev") === CLASH_REV_DEPTH, "Mixed Signals: rooms deal clashRev 7 or 8");
ok(isRetired("wordfall") && !ACTIVE_PUZZLE_TYPES.includes("wordfall") && PUZZLE_REGISTRY.wordfall !== undefined, "Letterfall: practice only, still registered");
ok(dealt("wordfall", "wordfallRev") === WORDFALL_REV_BANDS, "Letterfall: practice deals its current wordfallRev 3");
ok(typesInCategory("word").length >= 6, "Word keeps at least 6 active games");
for (const type of ["wordsmith", "reaction", "stopwatch"] as const) ok(rev2KnotsFor(type) === REV2_IDENTITY_KNOTS, `${type}: its own curve passes through the open-game knots`);
ok(rev2KnotsForPuzzle({ ...(generatePuzzle("wordsmith") as object), wordsmithRev: 1 } as unknown as PuzzleData) !== REV2_IDENTITY_KNOTS, "Nucleus wordsmithRev 1 keeps its fitted knots");
ok(rev2KnotsForPuzzle({ ...(generatePuzzle("reaction") as object), tapRev: TAP_REV_SPEED_TUNING } as unknown as PuzzleData) !== REV2_IDENTITY_KNOTS, "Flash tapRev 3 keeps its fitted knots");

/* ============================== 2. Rules ============================== */
// Nucleus.
for (let p = 0; p <= 80; p++) {
  if (p > 0) ok(scoreWordsmith(p, 2) >= scoreWordsmith(p - 1, 2) && scoreWordsmith(p, 2, true) >= scoreWordsmith(p - 1, 2, true), `Nucleus: more points never score less (${p})`);
  ok(scoreWordsmith(p, 2) <= WORDSMITH_V2_CAP, `Nucleus: 140 at most without the all-letters word (${p})`);
  ok(scoreWordsmith(p, 2, true) >= scoreWordsmith(p, 2), `Nucleus: the all-letters word never costs (${p})`);
  ok(p >= 60 || scoreWordsmith(p, 2, true) < 150, `Nucleus: 150 only at 60 points (${p})`);
}
ok(scoreWordsmith(60, 2, true) === 150 && scoreWordsmith(11, 2) === 70 && scoreWordsmith(18, 2) === 90 && scoreWordsmith(32, 2) === 130 && scoreWordsmith(3, 2) < 10, "Nucleus anchors: 3 → under 10, 11 → 70, 18 → 90, 32 → 130, 60 with every tile → 150");
{
  const p = generatePuzzle("wordsmith") as WordsmithPuzzleData & { words: { word: string; points: number }[] };
  const full = p.words.find((w) => w.word.length === p.letters.length);
  ok(full !== undefined, "Nucleus: the board has a word using every tile");
  const all = p.words.map((w) => w.word);
  const points = p.words.reduce((s, w) => s + w.points, 0);
  const g = gradeAnswer(p, all.join(","), 0);
  ok(g.score === scoreWordsmith(points, 2, true), `Nucleus: every word including the long one grades ${g.score}`);
  const without = p.words.filter((w) => w !== full);
  ok(gradeAnswer(p, without.map((w) => w.word).join(","), 0).score <= WORDSMITH_V2_CAP, "Nucleus: without the long word at most 140");
  const old = { ...p, wordsmithRev: 1, puzzleScoreRev: 1 } as unknown as PuzzleData;
  ok(gradeAnswer(old, all.join(","), 0).score === scoreWordsmith(points, 1), "Nucleus wordsmithRev 1 grades on its own curve");
}
// Forage.
{
  const p = generatePuzzle("wordhunt") as WordHuntPuzzleData & { words: { word: string; path: number[] }[] };
  const words = p.words.slice(0, 5).map((w) => `${w.word}:${w.path.join("-")}`);
  // A non-word path of four letters (searched on the grid), a word path and a broken path.
  let miss: number[] | null = null;
  for (let a = 0; a < 25 && !miss; a++)
    for (let b = 0; b < 25 && !miss; b++)
      for (let c = 0; c < 25 && !miss; c++)
        for (let d = 0; d < 25 && !miss; d++) {
          const path = [a, b, c, d];
          const w = wordFromPath(p.grid, path);
          if (w && w.length >= 4 && !isWord(w)) miss = path;
        }
  ok(miss !== null && isWordHuntMiss(p.grid, miss), "Forage: a real non-word path is a miss");
  ok(!isWordHuntMiss(p.grid, p.words[0]!.path), "Forage: a word path is never a miss");
  ok(!isWordHuntMiss(p.grid, [0, 24]), "Forage: a broken path is never a miss");
  const misses = (n: number) => Array.from({ length: n }, () => `${WORDHUNT_MISS_MARK}${miss!.join("-")}`);
  const base = gradeAnswer(p, words.join(","), 0).score;
  ok(gradeAnswer(p, [...words, ...misses(20)].join(","), 0).score === base, "Forage: 10 + 2 per word misses are free");
  ok(gradeAnswer(p, [...words, ...misses(60)].join(","), 0).score < base, "Forage: many misses cost");
  ok(gradeAnswer(p, [...words, ...misses(120)].join(","), 0).score === 0, "Forage: tracing at random scores 0");
  const old = { ...p, wordHuntRev: 1 } as unknown as PuzzleData;
  ok(gradeAnswer(old, [...words, ...misses(120)].join(","), 0).score === gradeAnswer(old, words.join(","), 0).score, "Forage wordHuntRev 1 ignores misses");
  for (let m = 0; m <= 80; m++) ok(wordHuntMissKeptPct(m + 1, 5) <= wordHuntMissKeptPct(m, 5), `Forage: a miss never adds (${m})`);
  ok(scoreWordHunt(15, 2, 0, 10) === scoreWordHunt(15, 1), "Forage: with no misses it scores as wordHuntRev 1");
}
// Flash.
for (let t = 0; t <= 16; t++) for (let n = 1; n <= 16; n++) if (t <= n) {
  const cut = flashDecoyCut(t, n);
  ok(cut >= 0 && cut <= 1 && (2 * t > n || cut === 0) && (t < n || cut === 1), `Flash: decoy cut ${t} of ${n} = ${cut}`);
}
for (let seed = 1; seed <= 60; seed++) {
  const p = roomPuzzle("reaction", seed) as ReactionPuzzleData;
  const every = [...p.flashes.map((f) => f + 190), ...p.decoys.map((d) => d.at + 190)].sort((a, b) => a - b);
  const now = replayFlash(p, every, 60_000);
  ok(now.decoysTapped === p.decoys.length && now.times.every((t) => t === 1_200), `Flash ${seed}: tapping on every colour credits nothing`);
  const honest = p.flashes.map((f) => f + 230);
  ok(JSON.stringify(replayFlash(p, honest, 60_000).times) === JSON.stringify(replayFlash({ flashes: p.flashes }, honest, 60_000).times), `Flash ${seed}: no decoy tapped, no cut`);
  const old = { ...p, tapRev: TAP_REV_SPEED_TUNING };
  const a = replayFlash(old, every, 60_000);
  const b = replayFlash({ flashes: p.flashes }, every, 60_000);
  ok(JSON.stringify(a.times) === JSON.stringify(b.times) && a.falseStarts === b.falseStarts && a.decoyCut === 0, `Flash ${seed}: tapRev 3 never reads decoys`);
}
for (let ms = 100; ms <= 1_300; ms++) ok(scoreReaction(ms, 0, 4) <= scoreReaction(ms - 1, 0, 4), `Flash: a slower average never scores more (${ms})`);
ok(scoreReaction(150, 0, 4) === 150 && scoreReaction(200, 0, 4) === 120 && scoreReaction(800, 0, 4) === 0, "Flash anchors: 150 ms 150, 200 ms 120, 800 ms 0");
// Bang On.
for (let d = 1; d <= 500; d++) ok(scoreStopWatch(d, 4) <= scoreStopWatch(d - 1, 4), `Bang On: a larger average error never scores more (${d})`);
ok(STOPWATCH_REV4_CURVE.every(([x, y]) => scoreStopWatch(x, 4) === y), "Bang On: the curve's knots");
ok(scoreStopWatch(250, 4) === 0 && scoreStopWatch(5, 4) === 150, "Bang On: random tapping (about 250 ms off) scores 0; 150 at 5 ms");
// Tenfall.
ok(tenDropScore(10, TD_RUN_TICKS, 3, 0) === 120 && tenDropScore(9, TD_RUN_TICKS, 3, 0) === 110, "Tenfall: 10/10 at the buzzer 120, nine 110");
for (let tick = TD_RUN_TICKS; tick > 0; tick--) {
  const a = tenDropScore(10, tick, 3), b = tenDropScore(10, tick - 1, 3);
  ok(b >= a && b - a <= 1, `Tenfall: clearing a tick earlier never costs and never jumps (${tick})`);
}
for (let n = 1; n <= 10; n++) ok(tenDropScore(n, TD_RUN_TICKS, 3) > tenDropScore(n - 1, TD_RUN_TICKS, 3), `Tenfall: each target adds (${n})`);
for (let r = 1; r <= 30; r++) ok(tenDropScore(5, TD_RUN_TICKS, 3, r) <= tenDropScore(5, TD_RUN_TICKS, 3, r - 1), `Tenfall: a reset never adds (${r})`);
ok(tenDropScore(5, TD_RUN_TICKS, 3, 4) === tenDropScore(5, TD_RUN_TICKS, 3, 0) && tenDropScore(5, TD_RUN_TICKS, 3, 6) === tenDropScore(5, TD_RUN_TICKS, 3, 0) - 10, "Tenfall: 4 resets free, then 5 each");
// Pull!.
const QMAX = CLAY_QUICK_STEPS * 25;
ok(clayQuickScore(150, QMAX) === 150, "Pull!: a perfect quick run scores 150");
for (let total = 0; total <= 150; total++)
  for (let qk = 0; qk <= QMAX; qk += 5) {
    ok(clayQuickScore(total, qk) <= 150 && (total === 150 && qk === QMAX) === (clayQuickScore(total, qk) === 150), `Pull!: 150 only for a perfect quick run (${total}, ${qk})`);
    if (total > 0) ok(clayQuickScore(total, qk) >= clayQuickScore(total - 1, qk), `Pull!: a higher total never scores less (${total}, ${qk})`);
    if (qk > 0) ok(clayQuickScore(total, qk) >= clayQuickScore(total, qk - 5), `Pull!: quicker never scores less (${total}, ${qk})`);
  }
ok(clayQuickScore(0, QMAX) === 0, "Pull!: a total of 0 earns no quick part");
// Mixed Signals.
for (let x = 1; x <= 150; x++) ok(bandMapTotal(CLASH_GREAT_MAP, x) >= bandMapTotal(CLASH_GREAT_MAP, x - 1), `Mixed Signals: the map rises (${x})`);
ok(bandMapTotal(CLASH_GREAT_MAP, 149) < 150 && bandMapTotal(CLASH_GREAT_MAP, 150) === 150 && bandMapTotal(CLASH_GREAT_MAP, 0) === 0, "Mixed Signals: 0 → 0, 150 only at 150");
// An unfinished run is at most 110 (clashRev 5's unfinished credit tops out at 110), a finish at least 120.
for (let x = 0; x <= 110; x++) ok(bandMapTotal(CLASH_GREAT_MAP, x) <= 110, `Mixed Signals: unfinished capped at 110 (${x})`);
for (let x = 120; x <= 150; x++) ok(bandMapTotal(CLASH_GREAT_MAP, x) >= 120, `Mixed Signals: a finish scores 120+ (${x})`);
ok(bandMapTotal(CLASH_GREAT_MAP, 110) === 110 && bandMapTotal(CLASH_GREAT_MAP, 120) === 120, "Mixed Signals: raw 110 → 110, a finish as time runs out → 120");

/* ============================== 3. Stored runs ============================== */
const FIXTURE = "scripts/fixtures/scoring-batch2-runs.json.gz";
const GAMES: PuzzleType[] = ["wordsmith", "wordhunt", "reaction", "stopwatch", "tendrop", "clayshoot", "stroop"];
const SEEDS = Array.from({ length: 15 }, (_, n) => 9001 + n * 7);
const LEVELS: Record<string, Skill> = {
  careless: { level: "careless" as Skill["level"], pace: 2.6, err: 0.45, reactionMs: 420, reactionSd: 90 },
  below: { level: "below" as Skill["level"], pace: 2.1, err: 0.3, reactionMs: 350, reactionSd: 70 },
  average: { level: "average", pace: 1.7, err: 0.2, reactionMs: 300, reactionSd: 55 },
  good: { level: "good", pace: 1.0, err: 0.1, reactionMs: 230, reactionSd: 40 },
  great: { level: "great", pace: 0.72, err: 0.05, reactionMs: 190, reactionSd: 30 },
  near: { level: "near", pace: 0.5, err: 0.015, reactionMs: 160, reactionSd: 20 },
};
interface Run { type: PuzzleType; seed: number; label: string; answer: string; score: number; isCorrect: boolean }
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};

if (process.argv.includes("--record")) {
  // Pull!'s kit reads the arcade humans' touch error by level; the two lower levels as the scoring report sets them.
  const P = PROFILES as Record<string, (typeof PROFILES)["average"]>;
  P.careless ??= { ...PROFILES.average, timingSdMs: 80, aimSdPx: 16, mistake: 0.25, lapse: 0.2, reactionMs: [420, 90] };
  P.below ??= { ...PROFILES.average, timingSdMs: 60, aimSdPx: 12, mistake: 0.17, lapse: 0.13, reactionMs: [350, 70] };
  const runs: Run[] = [];
  for (const type of GAMES) {
    const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)[type]!;
    for (const seed of SEEDS) {
      const p = roomPuzzle(type, seed);
      const limit = puzzleTimeLimitMs(p);
      const answers: [string, string][] = Object.entries(LEVELS).map(([lv, skill]) => {
        const steps = kit.play(p, makeRng(hashText(`${type}:play:${seed}:${lv}`)), skill, limit).steps.filter((s) => s.atMs <= limit);
        return [lv, steps.at(-1)?.answer ?? kit.nothing(p)];
      });
      for (const s of kit.spam(p, makeRng(hashText(`${type}:spam:${seed}`)), limit)) answers.push([`spam:${s.label}`, s.answer]);
      for (const [label, answer] of answers) {
        const g = quiet(() => gradeAnswer(p, answer, 0));
        runs.push({ type, seed, label, answer, score: g.score, isCorrect: g.isCorrect });
      }
    }
  }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: "scoring report batch 2, 20 Oct 2026", runs })));
  console.log(`recorded ${runs.length} runs → ${FIXTURE}`);
}

const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: Run[] };
const scores: Record<string, Record<string, number[]>> = {};
for (const run of fixture.runs) {
  const dealtP = roomPuzzle(run.type, run.seed);
  // Mixed Signals' stored runs are clashRev 7 runs (rooms deal clashRev 8 since depth to 200).
  // Pull!'s stored runs are clayRev 8 runs (rooms deal clayRev 9 since depth to 200).
  const p = run.type === "stroop" ? ({ ...(dealtP as object), clashRev: CLASH_REV_GREAT } as unknown as PuzzleData) : run.type === "clayshoot" ? ({ ...(dealtP as object), clayRev: CLAY_REV_QUICK } as unknown as PuzzleData) : dealtP;
  const g = quiet(() => gradeAnswer(p, run.answer, 0));
  ok(g.score === run.score && g.isCorrect === run.isCorrect, `${run.type} ${run.label} ${run.seed}: grades to its stored ${run.score} (got ${g.score})`);
  const room = quiet(() => gradeRoomAnswer(p, { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }, run.answer, 0).graded);
  ok(room.score === g.score && room.isCorrect === g.isCorrect, `${run.type} ${run.label} ${run.seed}: a room grades the same (${room.score})`);
  ((scores[run.type] ??= {})[run.label] ??= []).push(run.score);
}
for (const type of GAMES) ok(Object.values(scores[type] ?? {}).flat().length >= 15 * 8, `${type}: stored runs on the new stamp`);
// Mixed Signals: every stored unfinished run under every stored finish (grade.ts: a finish is all sorted, at most 2 wrong).
const clash = fixture.runs.filter((r) => r.type === "stroop");
const topUnfinished = Math.max(0, ...clash.filter((r) => !r.isCorrect).map((r) => r.score));
const lowFinish = Math.min(150, ...clash.filter((r) => r.isCorrect).map((r) => r.score));
ok(topUnfinished <= 110 && lowFinish >= 120 && clash.some((r) => r.isCorrect), `Mixed Signals: highest unfinished ${topUnfinished} (≤ 110), lowest finish ${lowFinish} (≥ 120)`);

/* ============================== 4. Pass marks ============================== */
const q = (xs: number[], at: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(at * xs.length))] ?? 0;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? 0;
const lines: string[] = [];
for (const type of GAMES) {
  const s = scores[type] ?? {};
  const spam = Object.keys(s).filter((k) => k.startsWith("spam:"));
  const worstMed = Math.max(0, ...spam.map((k) => median(s[k]!)));
  const worstP90 = Math.max(0, ...spam.map((k) => q(s[k]!, 0.9)));
  ok(worstMed <= 10 && worstP90 <= 25, `${type}: random median ${worstMed} (≤ 10), p90 ${worstP90} (≤ 25)`);
  const lv = Object.keys(LEVELS).map((k) => median(s[k] ?? []));
  if (type !== "tendrop") ok(lv[2]! >= 60 && lv[2]! <= 79, `${type}: average player ${lv[2]} in 60–79`);
  for (let i = 1; i < lv.length; i++) ok(lv[i]! >= lv[i - 1]!, `${type}: ${Object.keys(LEVELS)[i]} (${lv[i]}) no lower than the level below (${lv[i - 1]})`);
  lines.push(`${type}: random ${worstMed}/${worstP90}, levels ${lv.join(" / ")}`);
}

if (failures.length) {
  console.log(`FAIL scoring-batch2-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
for (const line of lines) console.log(`— ${line}`);
console.log(`— stroop: highest unfinished ${topUnfinished}, lowest finish ${lowFinish}`);
console.log(`PASS scoring-batch2-check: ${checks} checks — new stamps, Letterfall practice only, Nucleus, Forage, Flash, Bang On, Tenfall, Pull! and Mixed Signals rules, ${fixture.runs.length} stored runs (room = practice), the report's pass marks`);
