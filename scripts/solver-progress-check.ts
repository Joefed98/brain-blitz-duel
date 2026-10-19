/**
 * Solver-distance progress (19 Oct 2026, docs/scoring-targets.md): Topsy-Turvy `gravityRev 2` and Polypotions
 * `tubesRev 2` score an unfinished board on how much closer it is to solved by the solver, net of waste
 * (src/lib/duel/solverProgress.server.ts), instead of balls parked / flasks corked.
 *
 *   1. Rooms deal the new stamps with the same limits as before; the knots they score on are their own rows.
 *   2. The measure: the stored solution's first k moves are worth exactly k / minimum; a wasted move cancels one
 *      (tilts) or three (pours) good ones. The fast searches (packTilt and breadth-first within the round's node
 *      budget; A* on a lower bound that never overestimates) give exactly the generators' breadth-first answers on
 *      every board the kits stand on. A board made unsolvable keeps the best board before it, less the waste.
 *   3. Older stamps: the same answers on gravityRev 1 / tubesRev 1 grade exactly as before (the scoring-bands
 *      fixture's rows, recorded before this change, and unstamped boards).
 *   4. Runs recorded on the new stamps (scripts/fixtures/solver-progress-runs.json.gz: the puzzle-fairness kits at
 *      four levels, every spam strategy and doing nothing) grade to their stored scores.
 *   5. Bands: on the fit seeds the average kits' median lands in 60–79; random tilts and pours keep a median of 0
 *      (12 room seeds) and doing nothing scores 0.
 *
 *   bun scripts/solver-progress-check.ts            # check
 *   bun scripts/solver-progress-check.ts --record   # re-record the fixture (only when the measure changes on purpose)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { GRAVITY_DIRS, decodeGravityTilts, encodeGravityTilts, gravitySolved, replayGravity, tilt } from "../src/lib/duel/gravity";
import { gravityMinimum } from "../src/lib/duel/gravity.server";
import { decodeTubeLog, decodeTubeMoves, encodeTubeLog, replayTubeLog, replayTubes } from "../src/lib/duel/tubes";
import { tubesMinimum } from "../src/lib/duel/tubes.server";
import { GRAVITY_PROGRESS_REV, TUBES_PROGRESS_REV, gravityTiltLimit, tubesPourLimit } from "../src/lib/duel/moveLimits";
import {
  GRADE_NODE_BUDGET,
  GRAVITY_WASTE_WEIGHT,
  TUBES_WASTE_WEIGHT,
  gravityDistance,
  gravityWallGrid,
  packTilt,
  solverProgress,
  tubesDistance,
  tubesLowerBound,
} from "../src/lib/duel/solverProgress.server";
import { rev2KnotsForPuzzle, rev2KnotsKey } from "../src/lib/duel/puzzleScoreRev2";
import { PUZZLE_REV2_KNOTS } from "../src/lib/duel/puzzleBands.data";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roomPuzzle, runPlay, runSpam } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { FIXTURE as BANDS_FIXTURE, type AnswerRun } from "./scoring-bands-record";
import type { GravityPuzzleData, PuzzleData, TubesPuzzleData } from "../src/lib/duel/types";

const FIXTURE = "scripts/fixtures/solver-progress-runs.json.gz";
const GAMES = ["gravity", "tubes"] as const;
type Game = (typeof GAMES)[number];
const OLD: Record<Game, Record<string, number>> = { gravity: { gravityRev: 1 }, tubes: { tubesRev: 1 } };

let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? 0;
const withStamps = (p: PuzzleData, stamps: Record<string, number | undefined>) => ({ ...(p as object), ...stamps }) as unknown as PuzzleData;

if (process.argv.includes("--record")) {
  const answers: AnswerRun[] = [];
  for (const type of GAMES) {
    for (let k = 0; k < 4; k++) {
      const seed = 9201 + k;
      const puzzle = roomPuzzle(type, seed);
      for (const level of LEVELS) {
        const r = runPlay(KITS[type]!, puzzle, seed, level);
        answers.push({ kind: "puzzle", type, seed, label: level, answer: r.answer, ms: r.msRemaining, score: r.score });
      }
      for (const s of runSpam(KITS[type]!, puzzle, seed)) answers.push({ kind: "puzzle", type, seed, label: `spam:${s.label}`, answer: s.answer, ms: 0, score: s.score });
      answers.push({ kind: "puzzle", type, seed, label: "nothing", answer: KITS[type]!.nothing(puzzle), ms: puzzleTimeLimitMs(puzzle), score: 0 });
    }
  }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: new Date().toISOString().slice(0, 10), answers })));
  console.log(`wrote ${FIXTURE}: ${answers.length} answers`);
  process.exit(0);
}

/* 1. Stamps, limits and knots */
for (const type of GAMES) {
  const p = roomPuzzle(type, 4242) as any;
  const rev = type === "gravity" ? GRAVITY_PROGRESS_REV : TUBES_PROGRESS_REV;
  ok(p[type === "gravity" ? "gravityRev" : "tubesRev"] === rev, `${type}: rooms deal stamp ${rev}`);
  const limit = type === "gravity" ? gravityTiltLimit(p) : tubesPourLimit(p);
  const expect = Math.max(5, Math.ceil((p.minMoves + 6) / 5) * 5);
  ok(limit === expect, `${type}: the limit is unchanged (minimum + 6, up to a multiple of 5: ${limit})`);
  ok(rev2KnotsKey(p) === `${type}:${rev}` && rev2KnotsForPuzzle(p) === PUZZLE_REV2_KNOTS[`${type}:${rev}`], `${type}: the new stamp scores on its own knots`);
  ok(rev2KnotsForPuzzle(withStamps(p, OLD[type])) === PUZZLE_REV2_KNOTS[type], `${type}: the older stamp keeps its knots`);
}

/* 2. The measure */
ok(solverProgress(10, 0, 0, 1) === 0 && solverProgress(10, 10, 10, 1) === 1, "solverProgress: none, all");
ok(solverProgress(10, 4, 6, 1) === 0.2 && solverProgress(10, 7, 8, 3) === 0.4 && solverProgress(10, 4, 6, 3) === 0, "solverProgress: a wasted move cancels one good tilt or three good pours");
ok(GRAVITY_WASTE_WEIGHT === 1 && TUBES_WASTE_WEIGHT === 3, "waste weights: 1 per tilt, 3 per pour");
ok(GRADE_NODE_BUDGET === 12_000, "one round's searches share a 12,000-node budget");
for (let seed = 8301; seed <= 8306; seed++) {
  const g = roomPuzzle("gravity", seed) as GravityPuzzleData;
  const plan = decodeGravityTilts(g.solution ?? "");
  for (const k of [1, Math.floor(plan.length / 2), plan.length - 1]) {
    const graded = gradeAnswer(g, encodeGravityTilts(plan.slice(0, k)), 0);
    ok(!graded.isCorrect && Number((graded.extra as any)?.progress) === Math.round((100 * k) / g.minMoves!), `gravity ${seed}: the solution's first ${k} tilts are ${k}/${g.minMoves} (stored as progress)`);
  }
  const t = roomPuzzle("tubes", seed) as TubesPuzzleData;
  const pours = decodeTubeMoves(t.solution ?? "");
  for (const k of [1, Math.floor(pours.length / 2), pours.length - 1]) {
    const graded = gradeAnswer(t, encodeTubeLog(pours.slice(0, k)), 0);
    ok(!graded.isCorrect && Number((graded.extra as any)?.progress) === Math.round((100 * k) / t.minMoves!), `tubes ${seed}: the solution's first ${k} pours are ${k}/${t.minMoves} (stored as progress)`);
    // Pour, then Undo: the pour still counts (tubesRev 1) and is waste (not after the last pour, which solves the board).
    if (k + 1 >= pours.length) continue;
    const wasted = gradeAnswer(t, encodeTubeLog([...pours.slice(0, k), pours[k]!, "undo"]), 0);
    ok(Number((wasted.extra as any)?.progress) === Math.round((100 * Math.max(0, k - 3)) / t.minMoves!), `tubes ${seed}: an undone pour cancels three (${k})`);
  }
}

/* 2b. The fast searches give the generators' breadth-first answers */
const unlimited = () => ({ left: Number.MAX_SAFE_INTEGER, dead: new Set<string | number>() });
let tiltBoards = 0, gravityCompared = 0, tubesCompared = 0;
for (let seed = 8301; seed <= 8312; seed++) {
  const g = roomPuzzle("gravity", seed) as GravityPuzzleData;
  const walls = new Set(g.walls);
  const grid = gravityWallGrid(g.walls);
  const boards: number[][] = [g.starts];
  for (const level of LEVELS) for (const step of KITS.gravity!.play(g, makeRng(hashText(`gravity:play:${seed}:${level}`)), SKILLS[level], 90_000).steps)
    replayGravity(g.walls, g.starts, g.targets, decodeGravityTilts(step.answer), gravityTiltLimit(g), (b) => boards.push(b));
  for (const s of runSpam(KITS.gravity!, g, seed)) replayGravity(g.walls, g.starts, g.targets, decodeGravityTilts(s.answer), gravityTiltLimit(g), (b) => boards.push(b));
  for (const b of boards) {
    tiltBoards++;
    for (const dir of GRAVITY_DIRS) {
      const slow = tilt(walls, b, g.targets, dir);
      const fast = packTilt(grid, b, g.targets, dir);
      ok(slow.moved.some(Boolean) ? JSON.stringify(fast) === JSON.stringify(slow.balls) : fast === null, `gravity ${seed}: packTilt ${dir} matches tilt on ${b}`);
    }
  }
  for (const b of boards.filter((_, i) => i % 7 === 0)) {
    if (gravitySolved(b, g.targets)) continue;
    gravityCompared++;
    const bfs = gravityMinimum(walls, b, g.targets);
    const d = gravityDistance(grid, b, g.targets, unlimited() as any);
    ok(bfs ? d === bfs.minMoves : d === "dead", `gravity ${seed}: the search's distance (${d}) is breadth-first's (${bfs?.minMoves ?? "none"})`);
  }
  const t = roomPuzzle("tubes", seed) as TubesPuzzleData;
  const flasks: number[][][] = [];
  for (const s of runSpam(KITS.tubes!, t, seed)) replayTubeLog(t.tubes, decodeTubeLog(s.answer), tubesPourLimit(t), (b) => flasks.push(b));
  const pours = decodeTubeMoves(t.solution ?? "");
  for (let k = Math.floor(pours.length / 3); k < pours.length; k += 3) flasks.push(replayTubes(t.tubes, pours.slice(0, k)).tubes);
  for (const b of flasks.filter((_, i) => i % 5 === 0)) {
    tubesCompared++;
    const bfs = tubesMinimum(b);
    const d = tubesDistance(b, unlimited() as any);
    ok(bfs ? d === bfs.minMoves : d === "dead", `tubes ${seed}: A*'s distance (${d}) is breadth-first's (${bfs?.minMoves ?? "none"})`);
    ok(tubesLowerBound(b) <= (bfs?.minMoves ?? Infinity), `tubes ${seed}: the lower bound never overestimates`);
  }
}

/* 2c. A board made unsolvable keeps the best board before it, less the waste (Joe's ruling, 20 Oct 2026) */
let deadBoards = 0;
for (let seed = 8301; seed <= 8500 && deadBoards < 12; seed++) {
  const g = roomPuzzle("gravity", seed) as GravityPuzzleData;
  const walls = new Set(g.walls);
  const plan = decodeGravityTilts(g.solution ?? "");
  // Follow the solution part way, then tilt at random until the board can no longer be solved.
  const rng = makeRng(hashText(`dead:${seed}`));
  const tilts = plan.slice(0, Math.floor(plan.length / 2));
  let balls = replayGravity(g.walls, g.starts, g.targets, tilts).balls;
  for (let i = 0; i < 20 && gravityMinimum(walls, balls, g.targets); i++) {
    const options = GRAVITY_DIRS.filter((d) => tilt(walls, balls, g.targets, d).moved.some(Boolean));
    const d = rng.pick(options);
    tilts.push(d);
    balls = tilt(walls, balls, g.targets, d).balls;
  }
  if (gravitySolved(balls, g.targets) || gravityMinimum(walls, balls, g.targets)) continue;
  deadBoards++;
  const boards: number[][] = [g.starts];
  const r = replayGravity(g.walls, g.starts, g.targets, tilts, gravityTiltLimit(g), (b) => boards.push(b));
  let best = 0;
  for (const b of boards) {
    const m = gravitySolved(b, g.targets) ? { minMoves: 0 } : gravityMinimum(walls, b, g.targets);
    if (m) best = Math.max(best, g.minMoves! - m.minMoves);
  }
  const want = solverProgress(g.minMoves!, best, r.tilts, GRAVITY_WASTE_WEIGHT);
  const got = Number((gradeAnswer(g, encodeGravityTilts(tilts), 0).extra as any)?.progress);
  ok(got === Math.round(100 * want), `gravity ${seed}: a dead board keeps its best (${best} closer) less ${r.tilts - best} wasted: ${got}% (want ${Math.round(100 * want)}%)`);
}
ok(deadBoards >= 6, `gravity: dead boards tried (${deadBoards})`);

/* 3. Older stamps grade as before */
const bands = JSON.parse(gunzipSync(readFileSync(BANDS_FIXTURE)).toString()) as { answers: AnswerRun[] };
for (const type of GAMES) {
  const rows = bands.answers.filter((a) => a.type === type);
  ok(rows.length >= 10, `${type}: scoring-bands rows recorded before the change (${rows.length})`);
  for (const a of rows) {
    const p = withStamps(roomPuzzle(type, a.seed), OLD[type]);
    const g = gradeAnswer(p, a.answer, a.ms);
    ok(g.score === a.score, `${type} ${a.label} ${a.seed}: on ${JSON.stringify(OLD[type])} it grades to its stored ${a.score} (got ${g.score})`);
    ok((g.extra as any)?.progress === undefined, `${type} ${a.label} ${a.seed}: an older stamp stores no solver progress`);
    // Unstamped (stored before the limits): no limit, no solver progress.
    const bare = withStamps(roomPuzzle(type, a.seed), { gravityRev: undefined, tubesRev: undefined });
    ok((gradeAnswer(bare, a.answer, a.ms).extra as any)?.progress === undefined, `${type} ${a.label} ${a.seed}: unstamped boards keep the old measure`);
  }
}

/* 4. Recorded runs on the new stamps */
const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { answers: AnswerRun[] };
for (const type of GAMES) {
  const rows = fixture.answers.filter((a) => a.type === type);
  ok(rows.length >= 20, `${type}: runs recorded on the new stamp (${rows.length})`);
  for (const a of rows) {
    const g = gradeAnswer(roomPuzzle(type, a.seed), a.answer, a.ms);
    ok(g.score === a.score, `${type} ${a.label} ${a.seed}: grades to its stored ${a.score} (got ${g.score})`);
    if (a.label === "nothing") ok(g.score === 0, `${type} ${a.seed}: doing nothing scores 0`);
  }
}

/* 5. Bands: average 60–79 on the fit seeds, random input about 0 */
for (const type of GAMES) {
  const avg: number[] = [];
  const fitSeeds = type === "gravity" ? 80 : 40;
  for (let seed = 5001; seed < 5001 + fitSeeds; seed++) avg.push(runPlay(KITS[type]!, roomPuzzle(type, seed), seed, "average").score);
  ok(median(avg) >= 60 && median(avg) <= 79, `${type}: the average kits' median is in 60–79 on the fit seeds (${median(avg)})`);
  const spam: Record<string, number[]> = {};
  for (let seed = 6101; seed <= 6112; seed++) for (const r of runSpam(KITS[type]!, roomPuzzle(type, seed), seed)) (spam[r.label] ??= []).push(r.score);
  for (const [label, xs] of Object.entries(spam)) ok(median(xs) === 0, `${type}: random "${label}" median ${median(xs)} (0)`);
}

if (failures.length) {
  console.log(`FAIL solver-progress-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASS solver-progress-check: ${checks} checks — Topsy-Turvy gravityRev ${GRAVITY_PROGRESS_REV} and Polypotions tubesRev ${TUBES_PROGRESS_REV}: stamps, limits and knots, the measure, older stamps unchanged, ${fixture.answers.length} recorded runs, average and random bands`);
