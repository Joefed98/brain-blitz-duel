/**
 * Pattern / Logic batch, 14 Oct 2026 (Jumbled `tilesRev 1`, Colour Flood
 * `floodRev 2`, Box Six `sudokuRev 1`, Bomb Defusal `bombVersion 3`).
 *
 *   bun scripts/pattern-logic-oct14-check.ts
 *
 * 0. Stored rounds from before the batch: every answer in
 *    scripts/fixtures/pattern-logic-oct14-legacy.json.gz, recorded ON UNMODIFIED MAIN
 *    (pattern-logic-oct14-legacy-record.ts) on room puzzles as main dealt them (Jumbled's
 *    3×3 with no tilesRev, Colour Flood floodRev 1, Box Six with no sudokuRev, Bomb
 *    bombVersion 2) and on the same puzzles with every score / limit stamp removed,
 *    replays and grades exactly as main graded it.
 * 1. Stored-round identity: every answer in scripts/fixtures/pattern-logic-oct14.json.gz
 *    (recorded by pattern-logic-oct14-record.ts when the stamps shipped) grades
 *    exactly as recorded: score, verdict, counts, errors, stored time, extra.
 * 2. New rounds carry the stamps: Jumbled's extra-cell board (ten cells, 1–9, one
 *    line of four, a minimum of 18–24 proved by IDA*), Colour Flood's par + 2
 *    limit on a par 10–14 board, Box Six's 13–15 givens with exactly one
 *    solution (60 seeds), Bomb Defusal version 3 (proved card by card in
 *    bomb-v3-check).
 * 3. Older stamps unchanged: an unstamped (stored) Jumbled frame plays the 3×3
 *    rules (a "9" is dropped, as before); a floodRev 1 board keeps par + 2; an
 *    unstamped Box Six grades the same with or without the new field.
 * 4. Colour Flood floodRev 2 rules: the par route solves, a run that uses every
 *    tap without flooding scores 0, credit falls from full at par to 0 at the limit.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { countSudokuSolutions } from "../src/lib/duel/logic.server";
import { encodeFloodMoves, floodApply, floodSolved } from "../src/lib/duel/flood";
import { FLOOD_LIMIT_DEALT, FLOOD_REV2_SPARE_MOVES, floodMoveLimit } from "../src/lib/duel/moveLimits";
import { withSeededRandom } from "../src/lib/duel/random";
import { floodLimitWaste } from "../src/lib/duel/scoring";
import { decodeTileMoves, replayTiles, tilesLayout, TILES_REV_EXTRA } from "../src/lib/duel/tiles";
import { tilesMinMoves } from "../src/lib/duel/tiles.server";
import {
  FLOOD_COLOURS,
  SUDOKU_REV1_MAX_GIVENS,
  SUDOKU_REV1_MIN_GIVENS,
  TILES_EXTRA_MAX_MOVES,
  TILES_EXTRA_MIN_MOVES,
  type BombPuzzleData,
  type FloodPuzzleData,
  type SudokuPuzzleData,
  type TilesPuzzleData,
} from "../src/lib/duel/types";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";
import { OCT14_FIXTURE } from "./pattern-logic-oct14-record";
import { OCT14_LEGACY_FIXTURE } from "./pattern-logic-oct14-legacy-record";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";

// Written for the rev-1 puzzle shape: new puzzles here carry puzzleScoreRev 1 (rooms deal rev 2 since 19 Oct 2026, scoring-bands-check).
pinDealtPuzzleScoreRev(1);

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 30) console.log(`FAIL ${msg}`);
};

// 0. Rounds without the new stamps, recorded on unmodified main.
const legacy = JSON.parse(gunzipSync(readFileSync(OCT14_LEGACY_FIXTURE)).toString("utf8")) as { recordedOn: string; cases: LegacyCase[] };
let legacyAnswers = 0;
for (const c of legacy.cases) {
  const p = c.puzzle as unknown as Record<string, unknown>;
  if ("tilesRev" in p || "sudokuRev" in p || (p["floodRev"] ?? 1) !== 1 || (c.type === "bomb" && p["bombVersion"] !== 2)) fail(`${c.type} ${c.label}: legacy fixture puzzle carries a new stamp`);
  for (const e of c.entries) {
    legacyAnswers++;
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    const same = g.score === e.score && g.isCorrect === e.isCorrect && g.correctCount === e.correctCount && g.errors === e.errors && g.storedMs === e.storedMs && stableExtra(g.extra) === e.extra;
    if (!same) fail(`legacy ${c.type} ${c.label}: "${e.answer.slice(0, 40)}" at ${e.ms} ms now ${g.score} (${stableExtra(g.extra)}), main graded ${e.score} (${e.extra})`);
  }
}
for (const type of ["tiles", "flood", "sudoku", "bomb"]) if (!legacy.cases.some((c) => c.type === type && c.label.endsWith(":main")) || !legacy.cases.some((c) => c.type === type && c.label.endsWith(":unstamped"))) fail(`legacy fixture is missing ${type}`);
console.log(`stored rounds before the batch: ${legacyAnswers} answers on ${legacy.cases.length} puzzles (recorded on ${legacy.recordedOn}) replay and grade exactly as main graded them`);

// 1. Stored-round identity.
const fixture = JSON.parse(gunzipSync(readFileSync(OCT14_FIXTURE)).toString("utf8")) as { cases: LegacyCase[] };
let answers = 0;
for (const c of fixture.cases) {
  for (const e of c.entries) {
    answers++;
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    const same = g.score === e.score && g.isCorrect === e.isCorrect && g.correctCount === e.correctCount && g.errors === e.errors && g.storedMs === e.storedMs && stableExtra(g.extra) === e.extra;
    if (!same) fail(`${c.type} ${c.label}: "${e.answer.slice(0, 40)}" at ${e.ms} ms now ${g.score} (${stableExtra(g.extra)}), recorded ${e.score} (${e.extra})`);
  }
}
const stamps = (type: string) => fixture.cases.filter((c) => c.type === type).length;
if (stamps("tiles") < 4 || stamps("flood") < 4 || stamps("sudoku") < 4 || stamps("bomb") < 4) fail("fixture is missing a game");
for (const c of fixture.cases) {
  const p = c.puzzle as unknown as Record<string, unknown>;
  const ok = c.type === "tiles" ? p["tilesRev"] === 1 : c.type === "flood" ? p["floodRev"] === 2 : c.type === "sudoku" ? p["sudokuRev"] === 1 : p["bombVersion"] === 3;
  if (!ok) fail(`${c.type} ${c.label}: fixture puzzle lacks its new stamp`);
}
console.log(`stored-round identity: ${answers} answers on ${fixture.cases.length} new-stamp puzzles grade exactly as recorded`);

// 2. New rounds carry the stamps.
const histogram = new Map<number, number>();
for (let seed = 1; seed <= 40; seed++) {
  const t = withSeededRandom(seed, () => generatePuzzle("tiles")) as TilesPuzzleData;
  const layout = tilesLayout(t);
  // New rounds are tilesRev 2 since 20 Oct 2026: the same extra-cell board on a 90 s clock (jumbled-clock-check).
  if ((t.tilesRev ?? 0) < TILES_REV_EXTRA || !t.extra || t.frame.length !== 10 || layout.count !== 9) fail(`tiles seed ${seed}: not the extra-cell board`);
  if (new Set(t.frame).size !== 10 || Math.max(...t.frame) !== 9) fail(`tiles seed ${seed}: tiles are not 1–9 and a gap`);
  const proved = tilesMinMoves(t.frame, layout);
  if (proved?.min !== t.minMoves || t.minMoves! < TILES_EXTRA_MIN_MOVES || t.minMoves! > TILES_EXTRA_MAX_MOVES) fail(`tiles seed ${seed}: minimum ${t.minMoves}, proved ${proved?.min}`);
  histogram.set(t.minMoves!, (histogram.get(t.minMoves!) ?? 0) + 1);
  // Half of the round's own clock (60 s on tilesRev 1, 90 s on tilesRev 2 since 20 Oct 2026).
  const solved = gradeAnswer(t, t.solution!.join(","), puzzleTimeLimitMs(t) / 2);
  if (!solved.isCorrect || solved.score !== 150) fail(`tiles seed ${seed}: the minimum route at half time scored ${solved.score}`);
}
const sides = new Set<string>();
for (let seed = 1; seed <= 40; seed++) sides.add((withSeededRandom(seed, () => generatePuzzle("tiles")) as TilesPuzzleData).extra!.side);
if (sides.size !== 4) fail(`the extra cell used ${sides.size} sides on 40 seeds`);
console.log(`Jumbled (extra-cell board, tilesRev 2 since 20 Oct): 40 boards, minimum ${[...histogram].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join(" ")}, extra cell on all four sides`);

for (let seed = 1; seed <= 40; seed++) {
  const f = withSeededRandom(seed, () => generatePuzzle("flood")) as FloodPuzzleData;
  const lim = f.par + FLOOD_REV2_SPARE_MOVES;
  // New rounds are floodRev 3 since 19 Oct 2026: the same par + 2 limit on a cycle-proof board (flood-cycle-check).
  if (f.floodRev !== FLOOD_LIMIT_DEALT || f.moveLimit !== lim || floodMoveLimit(f) !== lim) fail(`flood seed ${seed}: limit ${f.moveLimit} rev ${f.floodRev} for par ${f.par}`);
  if (f.par < 10 || f.par > 14) fail(`flood seed ${seed}: par ${f.par}`);
  const route = gradeAnswer(f, encodeFloodMoves(f.solution!), 30_000);
  if (!route.isCorrect || route.score !== 150) fail(`flood seed ${seed}: the par route scored ${route.score}`);
  // A full limit of taps that never floods the board: the board ends and scores 0.
  let grid = f.grid;
  const taps: number[] = [];
  for (let i = 0; taps.length < lim && i < 200; i++) {
    const c = i % FLOOD_COLOURS === grid[0] ? (i + 1) % FLOOD_COLOURS : i % FLOOD_COLOURS;
    const next = floodApply(grid, c);
    if (floodSolved(next)) break;
    if (next === grid) continue;
    grid = next;
    taps.push(c);
  }
  if (taps.length === lim) {
    const out = gradeAnswer(f, encodeFloodMoves(taps), 0);
    if (out.isCorrect || out.score !== 0) fail(`flood seed ${seed}: ${lim} taps without a flood scored ${out.score}`);
    // Taps past the limit are ignored.
    const past = gradeAnswer(f, encodeFloodMoves([...taps, ...f.solution!]), 0);
    if (past.isCorrect) fail(`flood seed ${seed}: a tap past the limit counted`);
  }
}
if (floodLimitWaste(10, 10, 12) !== 1 || floodLimitWaste(12, 10, 12) !== 0 || Math.abs(floodLimitWaste(11, 10, 12) - 0.5) > 1e-9) fail("flood waste factor not full at par, half at par + 1 and 0 at the limit");
console.log("Colour Flood (floodRev 3 since 19 Oct): 40 boards, par 10–14, limit par + 2; par route 150, a full limit of taps without a flood 0, credit full at par falling to 0 at the limit");

const givens = new Map<number, number>();
for (let seed = 1; seed <= 60; seed++) {
  const s = withSeededRandom(seed, () => generatePuzzle("sudoku")) as SudokuPuzzleData;
  const n = s.givens.filter(Boolean).length;
  givens.set(n, (givens.get(n) ?? 0) + 1);
  if (s.sudokuRev !== 1 || n < SUDOKU_REV1_MIN_GIVENS || n > SUDOKU_REV1_MAX_GIVENS) fail(`sudoku seed ${seed}: ${n} givens, rev ${s.sudokuRev}`);
  if (countSudokuSolutions(s.givens, 3) !== 1) fail(`sudoku seed ${seed}: not exactly one solution`);
  if (!s.givens.every((g, i) => g === 0 || g === s.solution![i])) fail(`sudoku seed ${seed}: a given disagrees with the solution`);
  const done = gradeAnswer(s, s.solution!.join(""), 45_000);
  if (!done.isCorrect || done.score !== 150) fail(`sudoku seed ${seed}: the solution at half time scored ${done.score}`);
  // The new field changes nothing in grading.
  const { sudokuRev: _r, ...plain } = s;
  const half = s.givens.map((g, i) => (g ? g : i % 2 ? s.solution![i]! : 0)).join("");
  if (gradeAnswer(plain as SudokuPuzzleData, half, 0).score !== gradeAnswer(s, half, 0).score) fail(`sudoku seed ${seed}: the stamp changed grading`);
}
console.log(`Box Six sudokuRev 1: 60 boards, givens ${[...givens].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join(" ")}, each with exactly one solution`);

const bomb = withSeededRandom(7, () => generatePuzzle("bomb")) as BombPuzzleData;
if (bomb.bombVersion !== 3) fail("new bombs are not version 3");

// 3. Older stamps unchanged.
const classic: TilesPuzzleData = { type: "tiles", frame: [1, 2, 3, 4, 5, 6, 7, 0, 8], minMoves: 1, solution: [8] };
if (tilesLayout(classic).count !== 8 || !replayTiles(classic.frame, [8], tilesLayout(classic)).solved) fail("a stored 3×3 frame no longer plays the 3×3 rules");
if (decodeTileMoves("9,8").join(",") !== "8") fail("stored rounds' decode no longer drops a 9");
const stored = gradeAnswer({ ...classic, speedPar: 1, puzzleScoreRev: 1 } as TilesPuzzleData, "8", 30_000);
if (!stored.isCorrect || stored.score !== 150) fail(`stored 3×3 solve scored ${stored.score}`);
const rev1Flood = { ...(withSeededRandom(3, () => generatePuzzle("flood")) as FloodPuzzleData) };
rev1Flood.floodRev = 1;
rev1Flood.moveLimit = rev1Flood.par + 2;
if (floodMoveLimit(rev1Flood) !== rev1Flood.par + 2) fail("a floodRev 1 board lost its par + 2 limit");

console.log(failures ? `FAIL: ${failures} pattern-logic-oct14 failure(s)` : "All Pattern / Logic 14 Oct checks passed");
process.exit(failures ? 1 : 0);
