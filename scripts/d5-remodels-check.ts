/**
 * D5 remodels (25 Oct 2026; docs/depth/d5-remodels.md): Topsy-Turvy gravityRev 3 and Jumbled tilesRev 3.
 *
 *   1. Dealing: rooms and practice deal the new stamps (live, on the room's server call), with their own clocks;
 *      the minimums and routes stay server-only.
 *   2. Topsy-Turvy: 30 room-dealt rounds verify (three boards, exact breadth-first minimums in the band, every star
 *      reachable within the detour, the stored routes clear every board with every star, tilt limits); the rules
 *      (a ball drops as it rolls over its own hole, rolls over other holes, stars, the board's limit moves play on,
 *      Undo / Reset give no tilt back); scoring anchors (200 only for every star and a fast clear, 120 + stars at the
 *      buzzer, unfinished under 120); generation time.
 *   3. Jumbled: 30 room-dealt boards verify (the anchors in place, the meet-in-the-middle minimum proved again and
 *      equal to the stored one, par = minimum + 3, the stored route solves); random slides never move an anchor
 *      and every board stays solvable (its frame is a permutation of the movable tiles); scoring anchors; the
 *      gradient's colours under normal and simulated colour-blind vision.
 *   4. Tuning: the skill table (scripts/d5-remodels/tuning.ts) on 20 rounds each: random play stays low, each level
 *      above the one below, a solid player around today's Pattern scores, only strong, fast play at 190–200.
 *   5. New-stamp runs: scripts/fixtures/d5-remodels-runs.json.gz (bots at every level, recorded on this branch)
 *      regrade exactly, and reach 200.
 *
 *   bun scripts/d5-remodels-check.ts [--record]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { withSeededRandom } from "../src/lib/duel/random";
import type { GravityDir, GravityPuzzleData, PuzzleData, TilesPuzzleData } from "../src/lib/duel/types";
import {
  GRAVITY_REV_TOPSY,
  TOPSY_BOARDS,
  TOPSY_HOME,
  TOPSY_STARS,
  TOPSY_TIME_MS,
  replayTopsy,
  scoreTopsy,
  topsyStart,
  topsyTilt,
  topsyTiltLimit,
  type TopsyBoard,
} from "../src/lib/duel/topsy";
import { TOPSY_MAX_TILTS, TOPSY_MIN_TILTS, generateTopsy, verifyTopsyPuzzle } from "../src/lib/duel/topsy.server";
import {
  JUMBLED_CORNERS,
  JUMBLED_MOVES,
  JUMBLED_PAR_SLACK,
  JUMBLED_TIME_MS,
  TILES_REV_GRADIENT,
  decodeJumbled,
  encodeJumbled,
  jumbledPalette,
  jumbledSlide,
  replayJumbled,
  solvedJumbled,
} from "../src/lib/duel/jumbled";
import { JUMBLED_MIN_MOVES, generateJumbled, jumbledMinimum, jumbledSolutionMoves, verifyJumbledPuzzle } from "../src/lib/duel/jumbled.server";
import { paletteSpread } from "./d5-remodels/colour";
import { BOT_LEVELS, makeRng, playJumbled, playTopsy } from "./d5-remodels/bots";
import { rounds, table, tuning, type Row } from "./d5-remodels/tuning";

const RUNS_FIXTURE = "scripts/fixtures/d5-remodels-runs.json.gz";
const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}
const t0 = performance.now();

/* ------------------------------------------------------------------ 1. dealing */

const topsyRounds = rounds("gravity", 30) as (GravityPuzzleData & { boards: TopsyBoard[] })[];
const jumbledRounds = rounds("tiles", 30) as TilesPuzzleData[];
ok(topsyRounds.every((p) => p.gravityRev === GRAVITY_REV_TOPSY && p.timeLimitMs === TOPSY_TIME_MS && puzzleTimeLimitMs(p) === 120_000), "Topsy-Turvy: rooms deal gravityRev 3 on its own 120 s clock");
ok(jumbledRounds.every((p) => p.tilesRev === TILES_REV_GRADIENT && p.timeLimitMs === JUMBLED_TIME_MS && puzzleTimeLimitMs(p) === 120_000), "Jumbled: rooms deal tilesRev 3 on its own 120 s clock");
ok(topsyRounds.every((p) => p.puzzleScoreRev === 3 && p.tiltLimit === undefined), "Topsy-Turvy: new rounds carry puzzleScoreRev 3 and no gravityRev 1 limit");
{
  const practice = generatePuzzle("gravity", { bankSeed: 4242 }) as GravityPuzzleData;
  ok(practice.gravityRev === GRAVITY_REV_TOPSY, "Topsy-Turvy: practice draws (a bank seed) deal gravityRev 3, not the old bank");
  const pub = splitPuzzle(practice).pub as Record<string, unknown>;
  ok(!("boardMins" in pub) && !("boardSolutions" in pub) && !("boardStarMins" in pub) && !("solution" in pub) && !("minMoves" in pub), "Topsy-Turvy: minimums and routes stay server-only");
  ok(Array.isArray(pub["boards"]) && Array.isArray(pub["tiltLimits"]), "Topsy-Turvy: boards and tilt limits are public");
  const jpub = splitPuzzle(jumbledRounds[0]!).pub as Record<string, unknown>;
  ok(!("solution" in jpub) && !("minMoves" in jpub) && typeof jpub["par"] === "number", "Jumbled: the minimum and route stay server-only, par is public");
}
ok(ROUND_MAX.gravity === 200 && ROUND_MAX.tiles === 200, "ROUND_MAX: both games are 200");

/* ------------------------------------------------------------------ 2. Topsy-Turvy */

let genMs = 0;
for (let i = 0; i < 5; i++) {
  const s = performance.now();
  generateTopsy();
  genMs = Math.max(genMs, performance.now() - s);
}
ok(genMs < 2_000, `Topsy-Turvy: a round generates live in under 2 s (slowest of 5: ${Math.round(genMs)} ms)`);
const mins: number[] = [];
for (const [i, p] of topsyRounds.entries()) {
  const why = verifyTopsyPuzzle(p);
  ok(why === null, `Topsy-Turvy round ${i}: ${why}`);
  mins.push(...(p.boardMins ?? []));
  ok(p.boardMins!.every((m) => m >= TOPSY_MIN_TILTS && m <= TOPSY_MAX_TILTS), `Topsy-Turvy round ${i}: minimums ${p.boardMins} in ${TOPSY_MIN_TILTS}–${TOPSY_MAX_TILTS}`);
  ok(p.tiltLimits!.every((l, b) => l === topsyTiltLimit(p.boardStarMins![b]!) && l >= p.boardStarMins![b]! + 5), `Topsy-Turvy round ${i}: every tilt limit leaves at least 5 spare tilts over the all-stars route`);
  // The stored routes, fast: 200.
  const route = p.boardSolutions!.join("");
  const g = gradeAnswer(p, route, Math.round(0.6 * TOPSY_TIME_MS));
  ok(g.isCorrect && g.score === 200, `Topsy-Turvy round ${i}: the all-stars routes with 60 % of the clock left score 200 (${g.score})`);
  const buzzer = gradeAnswer(p, route, 0);
  ok(buzzer.score === 120 + 5 * TOPSY_BOARDS * TOPSY_STARS, `Topsy-Turvy round ${i}: every star at the buzzer is 150 (${buzzer.score})`);
}
const dist: Record<number, number> = {};
for (const m of mins) dist[m] = (dist[m] ?? 0) + 1;
console.log(`Topsy-Turvy: ${topsyRounds.length} rounds, board minimums ${JSON.stringify(dist)}, slowest live round ${Math.round(genMs)} ms`);

// Rules on a hand-made board (10 wide, cells r*10+c).
{
  const board: TopsyBoard = { walls: [9], starts: [0, 20, 40, 60, 80, 99], holes: [5, 3, 77, 61, 88, 90], stars: [2, 45] };
  const walls = new Set(board.walls);
  const right = topsyTilt(board, walls, topsyStart(board), "R");
  ok(right.state.balls[0] === TOPSY_HOME && right.dropped.includes(0), "rules: a ball drops into its own hole as it rolls over it (it need not stop there)");
  ok(right.starsTaken.includes(0) && (right.state.starMask & 1) === 1, "rules: a ball rolling through a star takes it");
  ok(right.state.balls[1] === 29, "rules: a ball rolls over another colour's hole (teal over gold's hole … to the edge)");
  ok(right.paths[0]!.at(-1) === 5, "rules: the dropping ball's path ends in its hole");
  const again = topsyTilt(board, walls, right.state, "R");
  ok(again.state.balls[0] === TOPSY_HOME, "rules: a ball home stays home");
  // A ball stops against another; when the one ahead drops, the one behind rolls on.
  const train: TopsyBoard = { walls: [], starts: [10, 11, 50, 51, 90, 91], holes: [18, 15, 58, 52, 3, 4], stars: [70, 71] };
  const t = topsyTilt(train, new Set(), topsyStart(train), "R");
  ok(t.state.balls[0] === TOPSY_HOME && t.state.balls[1] === TOPSY_HOME, "rules: when the ball ahead drops, the one behind rolls on to its own hole further along");
  ok(t.state.balls[2] === TOPSY_HOME && t.state.balls[3] === TOPSY_HOME, "rules: the front ball drops early and the ball behind rolls on past it");
  ok(t.state.balls[4] === 98 && t.state.balls[5] === 99, "rules: a train of balls stops together against the edge");
  // The tilt limit moves play on; Undo and Reset give no tilt back.
  const limited = replayTopsy([board, board, board], ["U", "U", "D", "X", "Y", "D"] as GravityDir[], [2, 2, 2]);
  ok(limited.boards[0]!.outOfTilts && limited.current === 1, "rules: a board's tilt limit used up moves play to the next board");
  ok(limited.boards[1]!.tilts === 1, "rules: Undo and Reset never give a tilt back (board 2: one tilt counted after Undo and Reset)");
  const packed: TopsyBoard = { walls: [], starts: [0, 1, 2, 3, 4, 5], holes: [90, 91, 92, 93, 94, 95], stars: [50, 51] };
  const none = replayTopsy([packed], ["L", "U"] as GravityDir[]);
  ok(none.tilts === 0, "rules: a tilt that moves nothing does not count");
}
// Scoring anchors.
{
  ok(scoreTopsy({ solved: true, home: 18, stars: 6 }, 120_000, 120_000).score === 200, "score: every star and a clear with the whole clock left is 200");
  ok(scoreTopsy({ solved: true, home: 18, stars: 5 }, 120_000, 120_000).score === 195, "score: a missed star costs 5");
  ok(scoreTopsy({ solved: true, home: 18, stars: 6 }, 54_000, 120_000).score === 200, "score: 45 % of the clock left still earns every speed point");
  ok(scoreTopsy({ solved: true, home: 18, stars: 0 }, 0, 120_000).score === 120, "score: a clear at the buzzer with no stars is 120");
  ok(scoreTopsy({ solved: false, home: 17, stars: 6, clearedStars: 4 }, 0, 120_000).score === 114, "score: unfinished counts balls home and stars on cleared boards only");
  let maxUnfinished = 0;
  for (let home = 0; home < 18; home++) for (let s = 0; s <= 6; s++) maxUnfinished = Math.max(maxUnfinished, scoreTopsy({ solved: false, home, stars: s, clearedStars: s }, 0, 120_000).score);
  ok(maxUnfinished < 120, `score: no unfinished round reaches a clear's 120 (best ${maxUnfinished})`);
}

/* ------------------------------------------------------------------ 3. Jumbled */

let jMs = 0;
for (let i = 0; i < 5; i++) {
  const s = performance.now();
  generateJumbled();
  jMs = Math.max(jMs, performance.now() - s);
}
ok(jMs < 1_500, `Jumbled: a board generates and is proved live in under 1.5 s (slowest of 5: ${Math.round(jMs)} ms)`);
const jdist: Record<number, number> = {};
for (const [i, p] of jumbledRounds.entries()) {
  const why = verifyJumbledPuzzle(p);
  ok(why === null, `Jumbled board ${i}: ${why}`);
  jdist[p.minMoves!] = (jdist[p.minMoves!] ?? 0) + 1;
  ok(p.minMoves! >= JUMBLED_MIN_MOVES && p.par === p.minMoves! + JUMBLED_PAR_SLACK, `Jumbled board ${i}: minimum ${p.minMoves}, par ${p.par}`);
  const route = encodeJumbled(jumbledSolutionMoves(p.solution ?? []));
  const g = gradeAnswer(p, route, Math.round(0.7 * JUMBLED_TIME_MS));
  ok(g.isCorrect && g.score === 200, `Jumbled board ${i}: the shortest route with 70 % of the clock left scores 200 (${g.score})`);
  ok(gradeAnswer(p, route, 0).score === 160, `Jumbled board ${i}: at par at the buzzer is 160`);
  ok(gradeAnswer(p, "", 0).score === 0, `Jumbled board ${i}: nothing scores 0`);
}
console.log(`Jumbled: ${jumbledRounds.length} boards, minimums ${JSON.stringify(jdist)}, slowest live board ${Math.round(jMs)} ms`);
{
  // Anchors never move; any slide sequence is undone by solving (the frame stays a permutation of its tiles).
  const rng = makeRng(77);
  let frame = solvedJumbled();
  let anchorsKept = true;
  for (let i = 0; i < 2_000; i++) {
    frame = jumbledSlide(frame, JUMBLED_MOVES[Math.floor(rng() * JUMBLED_MOVES.length)]!);
    if (JUMBLED_CORNERS.some((c) => frame[c] !== c)) anchorsKept = false;
  }
  ok(anchorsKept, "rules: 2,000 random slides never move an anchor");
  ok(new Set(frame).size === 25, "rules: slides only permute the tiles");
  // Every scramble the generator can make is solvable: each slide has its inverse.
  let inverses = true;
  for (const m of JUMBLED_MOVES) {
    const len = m.index === 0 || m.index === 4 ? 3 : 5;
    const back = jumbledSlide(jumbledSlide(solvedJumbled(), m), { ...m, shift: len - m.shift });
    if (back.join() !== solvedJumbled().join()) inverses = false;
  }
  ok(inverses, "rules: every slide is undone by the opposite slide (every scramble is solvable)");
  ok(JUMBLED_MOVES.length === 32, `rules: 32 distinct slides (${JUMBLED_MOVES.length})`);
  ok(decodeJumbled("R21,C34,U,X,R04,Q9,R03").length === 4, "rules: the answer decoder keeps legal slides, Undo and Reset only (an edge row has shifts 1–2)");
  const r = replayJumbled(solvedJumbled(), decodeJumbled("R21"));
  ok(r.solved && r.moves === 0, "rules: nothing counts once the board is solved");
  ok(jumbledMinimum(jumbledSlide(solvedJumbled(), { kind: "C", index: 2, shift: 3 }))?.min === 1, "solver: one slide off is a minimum of 1");
}
{
  const spread = paletteSpread(jumbledPalette());
  console.log(`Jumbled gradient, smallest ΔE2000 (neighbours / any two): ${Object.entries(spread).map(([v, s]) => `${v} ${s.neighbour} / ${s.any}`).join(", ")}`);
  ok(spread.normal!.neighbour >= 6, `colour: neighbours at least 6 ΔE2000 apart with normal vision (${spread.normal!.neighbour})`);
  for (const v of ["protanopia", "deuteranopia", "tritanopia"]) ok(spread[v]!.neighbour >= 4, `colour: neighbours at least 4 ΔE2000 apart with ${v} (${spread[v]!.neighbour})`);
  ok(new Set(jumbledPalette()).size === 25, "colour: 25 distinct colours");
}

/* ------------------------------------------------------------------ 4. tuning */

const { topsy, jumbled } = tuning(20);
console.log(`\n${table("Topsy-Turvy (tilts)", topsy)}\n\n${table("Jumbled (slides)", jumbled)}\n`);
function bands(game: string, rows: Row[]): void {
  const by = Object.fromEntries(rows.map((r) => [r.label, r]));
  const [spam, novice, average, solid, strong, near] = ["Random spam", "Novice", "Average", "Solid", "Strong", "Near-perfect"].map((l) => by[l]!);
  ok(spam!.median <= 50 && spam!.p90 < 80 && spam!.median < average!.median, `${game}: random play stays low, under an average player (median ${spam!.median}, p90 ${spam!.p90})`);
  ok(novice!.mean < average!.mean && average!.mean < solid!.mean && solid!.mean < strong!.mean && strong!.mean <= near!.mean, `${game}: each level scores above the one below`);
  ok(solid!.median >= 120 && solid!.median <= 160, `${game}: a solid player lands around today's Pattern scores (median ${solid!.median})`);
  ok(near!.median >= 190, `${game}: near-perfect play reaches 190–200 (median ${near!.median})`);
  ok(solid!.p90 < 200 || solid!.median < 160, `${game}: 200 stays rare for a solid player`);
  ok(rows.every((r) => r.p90 <= 200), `${game}: no score above 200`);
}
bands("Topsy-Turvy", topsy);
bands("Jumbled", jumbled);

/* ------------------------------------------------------------------ 5. new-stamp runs */

interface Run { type: "gravity" | "tiles"; puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; extra: string }
function record(): Run[] {
  const runs: Run[] = [];
  const tp = rounds("gravity", 6, 900);
  const jp = rounds("tiles", 6, 900);
  for (const level of BOT_LEVELS) {
    tp.forEach((p, i) => {
      const r = playTopsy(p, level, makeRng(31 * i + level.length));
      runs.push({ type: "gravity", puzzle: p, answer: r.answer, ms: r.msRemaining, score: r.score, isCorrect: r.solved, extra: "" });
    });
    jp.forEach((p, i) => {
      const r = playJumbled(p, level, makeRng(31 * i + level.length));
      runs.push({ type: "tiles", puzzle: p, answer: r.answer, ms: r.msRemaining, score: r.score, isCorrect: r.solved, extra: "" });
    });
  }
  // Perfect runs: the stored routes, fast.
  for (const p of tp) runs.push({ type: "gravity", puzzle: p, answer: (p as GravityPuzzleData).boardSolutions!.join(""), ms: 80_000, score: 0, isCorrect: true, extra: "" });
  for (const p of jp) runs.push({ type: "tiles", puzzle: p, answer: encodeJumbled(jumbledSolutionMoves((p as TilesPuzzleData).solution ?? [])), ms: 90_000, score: 0, isCorrect: true, extra: "" });
  for (const run of runs) {
    const g = gradeAnswer(run.puzzle, run.answer, run.ms);
    run.score = g.score;
    run.isCorrect = g.isCorrect;
    run.extra = JSON.stringify(g.extra);
  }
  return runs;
}
if (process.argv.includes("--record")) {
  const runs = withSeededRandom(2510, record);
  writeFileSync(RUNS_FIXTURE, gzipSync(JSON.stringify({ recordedOn: process.env["RECORDED_ON"] ?? "branch", runs })));
  console.log(`recorded ${runs.length} new-stamp runs to ${RUNS_FIXTURE}`);
}
{
  const fixture = JSON.parse(gunzipSync(readFileSync(RUNS_FIXTURE)).toString("utf8")) as { runs: Run[] };
  let same = 0;
  for (const run of fixture.runs) {
    const g = gradeAnswer(run.puzzle, run.answer, run.ms);
    if (g.score === run.score && g.isCorrect === run.isCorrect && JSON.stringify(g.extra) === run.extra) same++;
    else if (failures.length < 50) failures.push(`fixture: ${run.type} "${run.answer.slice(0, 30)}" @${run.ms}: ${run.score} → ${g.score}`);
  }
  passes += same;
  ok(fixture.runs.some((r) => r.type === "gravity" && r.score === 200) && fixture.runs.some((r) => r.type === "tiles" && r.score === 200), "fixture: runs on both new stamps reach 200");
  ok(fixture.runs.every((r) => r.score >= 0 && r.score <= 200), "fixture: every stored score is 0–200");
  console.log(`new-stamp fixture: ${same} / ${fixture.runs.length} runs regrade identically`);
}

const secs = ((performance.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL d5-remodels-check: ${failures.length} of ${passes + failures.length} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS d5-remodels-check: ${passes} checks (${secs} s) — both remodels deal, verify, score to 200 and tune as documented`);
