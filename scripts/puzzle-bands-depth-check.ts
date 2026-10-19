/**
 * Score bands at depth (optional, `--include-optional`; never run in CI): the 200-seed figures behind
 * docs/scoring-targets.md for Topsy-Turvy gravityRev 2, Polypotions tubesRev 2 and Jumbled tilesRev 2 (90 s).
 * solver-progress-check and jumbled-clock-check prove the same bands on the fit seeds in seconds; this re-measures
 * them on 200 test seeds (7001–7200), a few minutes.
 *
 *   - the average kits' median lands in 60–79 (the score bands' average);
 *   - each random strategy's median is 0 and its 90th percentile at most 10.
 *
 *   bun scripts/puzzle-bands-depth-check.ts [seeds]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { decodeGravityTilts, replayGravity } from "../src/lib/duel/gravity";
import { decodeTubeLog, replayTubeLog } from "../src/lib/duel/tubes";
import { decodeTileMoves, replayTiles, tilesLayout } from "../src/lib/duel/tiles";
import { gravityTiltLimit, tubesPourLimit } from "../src/lib/duel/moveLimits";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, TilesPuzzleData } from "../src/lib/duel/types";
import { roomPuzzle, runSpam } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";

// This check proves puzzleScoreRev 2 (the score bands): new deals are pinned to it. Rooms deal 3 (scoring-rev3-check).
pinDealtPuzzleScoreRev(2);

const SEEDS = Number(process.argv[2] ?? 200);
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (!cond) failures.push(label);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2;
};
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;

const lines: string[] = [];
/** Whether an answer has solved the board, by replay alone (grading every step would be slow). */
function solvedBy(p: PuzzleData, a: string): boolean {
  if (p.type === "gravity") return replayGravity(p.walls, p.starts, p.targets, decodeGravityTilts(a), gravityTiltLimit(p)).solved;
  if (p.type === "tubes") return replayTubeLog(p.tubes, decodeTubeLog(a), tubesPourLimit(p)).solved;
  const t = p as TilesPuzzleData;
  const layout = tilesLayout(t);
  return replayTiles(t.frame, decodeTileMoves(a, layout.count), layout).solved;
}

for (const type of ["gravity", "tubes", "tiles"] as const) {
  const average: number[] = [];
  const spam: Record<string, number[]> = {};
  for (let seed = 7001; seed < 7001 + SEEDS; seed++) {
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    const play = KITS[type]!.play(p, makeRng(hashText(`${type}:play:${seed}:average`)), SKILLS.average, limit);
    const inTime = play.steps.filter((s) => s.atMs <= limit);
    // The answer is sent the moment it solves the board, else at the buzzer.
    const win = inTime.find((s) => solvedBy(p, s.answer));
    average.push(win ? gradeAnswer(p, win.answer, limit - win.atMs).score : gradeAnswer(p, inTime.at(-1)?.answer ?? "", 0).score);
    for (const r of runSpam(KITS[type]!, p, seed)) (spam[r.label] ??= []).push(r.score);
  }
  ok(median(average) >= 60 && median(average) <= 79, `${type}: the average kits' median over ${SEEDS} seeds is ${median(average)} (60–79)`);
  for (const [label, xs] of Object.entries(spam)) ok(median(xs) === 0 && pct(xs, 0.9) <= 10, `${type}: random "${label}" median ${median(xs)}, p90 ${pct(xs, 0.9)} (0, at most 10)`);
  lines.push(`${type} average ${median(average)} (${average.filter((x) => x >= 60 && x <= 79).length}/${SEEDS} in 60–79); ${Object.entries(spam).map(([l, xs]) => `${l} ${median(xs)}/${pct(xs, 0.9)}`).join(", ")}`);
}
for (const l of lines) console.log(l);
if (failures.length) {
  console.log(`FAIL puzzle-bands-depth-check: ${failures.length} failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASS puzzle-bands-depth-check: ${SEEDS} seeds per game, average in 60–79, random input at 0`);
