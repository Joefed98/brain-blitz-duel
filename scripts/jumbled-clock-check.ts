/**
 * Jumbled tilesRev 2 (20 Oct 2026, Joe's ruling; docs/scoring-targets.md): the extra-cell board on a 90 s clock,
 * stored on the puzzle (`timeLimitMs`), scoring on its own knots row (`tiles:2`).
 *
 *   1. Rooms deal tilesRev 2 with a 90 s clock; the round's clock, the knots and the phone's own time-out read it.
 *   2. Older stamps grade exactly as before: the scoring-bands fixture's Jumbled rows (recorded on tilesRev 1, 60 s)
 *      on their stamp; unstamped boards keep the classic frame and 60 s.
 *   3. Runs recorded on tilesRev 2 (scripts/fixtures/jumbled-clock-runs.json.gz: the kits at four levels, every spam
 *      strategy and doing nothing) grade to their stored scores.
 *   4. Bands: on the fit seeds (80) the average kits' median lands in 60–79; random slides keep a median of 0.
 *
 *   bun scripts/jumbled-clock-check.ts            # check
 *   bun scripts/jumbled-clock-check.ts --record   # re-record the fixture (only when Jumbled's scoring changes on purpose)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { TILES_REV_CLOCK, TILES_REV2_TIME_MS } from "../src/lib/duel/tiles";
import { TILES_TIME_MS, type PuzzleData } from "../src/lib/duel/types";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { rev2KnotsFor, rev2KnotsForPuzzle } from "../src/lib/duel/puzzleScoreRev2";
import { PUZZLE_REV2_KNOTS } from "../src/lib/duel/puzzleBands.data";
import { roomPuzzle, runPlay, runSpam } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS } from "./puzzle-fairness/kit";
import { FIXTURE as BANDS_FIXTURE, type AnswerRun } from "./scoring-bands-record";

const FIXTURE = "scripts/fixtures/jumbled-clock-runs.json.gz";
let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? 0;
const withStamps = (p: PuzzleData, stamps: Record<string, unknown>) => ({ ...(p as object), ...stamps }) as unknown as PuzzleData;
const OLD = { tilesRev: 1, timeLimitMs: undefined };

if (process.argv.includes("--record")) {
  const answers: AnswerRun[] = [];
  for (let k = 0; k < 4; k++) {
    const seed = 9201 + k;
    const puzzle = roomPuzzle("tiles", seed);
    for (const level of LEVELS) {
      const r = runPlay(KITS.tiles!, puzzle, seed, level);
      answers.push({ kind: "puzzle", type: "tiles", seed, label: level, answer: r.answer, ms: r.msRemaining, score: r.score });
    }
    for (const s of runSpam(KITS.tiles!, puzzle, seed)) answers.push({ kind: "puzzle", type: "tiles", seed, label: `spam:${s.label}`, answer: s.answer, ms: 0, score: s.score });
    answers.push({ kind: "puzzle", type: "tiles", seed, label: "nothing", answer: KITS.tiles!.nothing(puzzle), ms: puzzleTimeLimitMs(puzzle), score: 0 });
  }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: new Date().toISOString().slice(0, 10), answers })));
  console.log(`wrote ${FIXTURE}: ${answers.length} answers`);
  process.exit(0);
}

/* 1. The stamp, the clock and the knots */
for (const seed of [4242, 4243, 4244]) {
  const p = roomPuzzle("tiles", seed) as any;
  ok(p.tilesRev === TILES_REV_CLOCK && p.timeLimitMs === TILES_REV2_TIME_MS && TILES_REV2_TIME_MS === 90_000, `tiles ${seed}: rooms deal tilesRev ${TILES_REV_CLOCK} on a 90 s clock`);
  ok(puzzleTimeLimitMs(p) === 90_000, `tiles ${seed}: the round's clock is 90 s`);
  ok(!!p.extra && p.frame.length === 10, `tiles ${seed}: the same extra-cell board`);
  ok(rev2KnotsForPuzzle(p) === PUZZLE_REV2_KNOTS[`tiles:${TILES_REV_CLOCK}`] && rev2KnotsFor("tiles") === PUZZLE_REV2_KNOTS[`tiles:${TILES_REV_CLOCK}`], `tiles ${seed}: scores on the tiles:${TILES_REV_CLOCK} knots (and the help states them)`);
  const old = withStamps(p, OLD);
  ok(puzzleTimeLimitMs(old) === TILES_TIME_MS && rev2KnotsForPuzzle(old) === PUZZLE_REV2_KNOTS["tiles"], `tiles ${seed}: tilesRev 1 keeps 60 s and its knots`);
  // A finish with a third of the clock left scores more than the same finish at the buzzer.
  const solution = (p.solution as number[]).join(",");
  ok(gradeAnswer(p, solution, 30_000).score > gradeAnswer(p, solution, 0).score, `tiles ${seed}: time left still pays`);
}
const stage = readFileSync("src/puzzles/slidingTiles.tsx", "utf8");
ok(stage.includes("data.timeLimitMs ?? TILES_TIME_MS"), "the phone's own time-out reads the round's clock");

/* 2. Older stamps grade as before */
const bands = JSON.parse(gunzipSync(readFileSync(BANDS_FIXTURE)).toString()) as { answers: AnswerRun[] };
const rows = bands.answers.filter((a) => a.type === "tiles");
ok(rows.length >= 10, `tiles: scoring-bands rows recorded on tilesRev 1 (${rows.length})`);
for (const a of rows) {
  const g = gradeAnswer(withStamps(roomPuzzle("tiles", a.seed), OLD), a.answer, a.ms);
  ok(g.score === a.score, `tiles ${a.label} ${a.seed}: on tilesRev 1 it grades to its stored ${a.score} (got ${g.score})`);
}

/* 3. Recorded runs on tilesRev 2 */
const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { answers: AnswerRun[] };
ok(fixture.answers.length >= 20, `tiles: runs recorded on tilesRev 2 (${fixture.answers.length})`);
for (const a of fixture.answers) {
  const g = gradeAnswer(roomPuzzle("tiles", a.seed), a.answer, a.ms);
  ok(g.score === a.score, `tiles ${a.label} ${a.seed}: grades to its stored ${a.score} (got ${g.score})`);
  if (a.label === "nothing") ok(g.score === 0, `tiles ${a.seed}: doing nothing scores 0`);
}

/* 4. Bands */
const avg: number[] = [];
for (let seed = 5001; seed < 5081; seed++) avg.push(runPlay(KITS.tiles!, roomPuzzle("tiles", seed), seed, "average").score);
ok(median(avg) >= 60 && median(avg) <= 79, `tiles: the average kits' median is in 60–79 on the fit seeds (${median(avg)})`);
const spam: Record<string, number[]> = {};
for (let seed = 6101; seed <= 6112; seed++) for (const r of runSpam(KITS.tiles!, roomPuzzle("tiles", seed), seed)) (spam[r.label] ??= []).push(r.score);
for (const [label, xs] of Object.entries(spam)) ok(median(xs) === 0, `tiles: random "${label}" median ${median(xs)} (0)`);

if (failures.length) {
  console.log(`FAIL jumbled-clock-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASS jumbled-clock-check: ${checks} checks — tilesRev ${TILES_REV_CLOCK} on 90 s, its knots and time-out, tilesRev 1 unchanged, ${fixture.answers.length} recorded runs, average ${median(avg)}, random 0`);
