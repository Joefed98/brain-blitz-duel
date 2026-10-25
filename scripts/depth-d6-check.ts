/**
 * Logic depth to 200 (25 Oct 2026, docs/depth/d6-logic.md; src/lib/duel/logicDepth.ts). Proves:
 *   1. Old rounds: every round of scripts/fixtures/depth-d6-legacy.json.gz (recorded on main before the change by
 *      scripts/depth-d6-record.ts: 11 games, kit plays, spam, unfinished and finished) regrades to the same score,
 *      correctness and stored detail on this tree, so stored rounds grade exactly as before.
 *   2. The deal: new rounds of the eleven games carry depthRev 1; Blackout and Polypotions carry their public par
 *      (the stored minimum); room seeds still decide every board.
 *   3. The scoring on depthRev 1: unfinished rounds score as rev 3; a finish is 120–200; the stretch games reach 150
 *      at their fast share and 200 only at their elite share with no mistakes; the par games score 200 only at par
 *      (over par stays at most 150); Safe Cracker's clean crack (all on try 1, half on try 2, none on try 3); Colour
 *      Flood's stretch needs par; more time left never scores less; every stored breakdown adds up to the score.
 *   4. The bigger boards: Mosaic 8 × 8, Tents and Trees 8 × 9, Shikaku 10 × 11, Lamplighter 9 × 10 (the bank), each
 *      board's stored solution solves it and its solver finds exactly one; the old sizes still grade; Shikaku's
 *      answer code decodes every older answer as before and reaches the new 11th row.
 *   5. ROUND_MAX is 200 for the eleven, the texts state it, the demos recorded before are stopped.
 *
 *   bun scripts/depth-d6-check.ts      (~3 s)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { ROUND_MAX, roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { DEPTH_DEMO_STOPS, DEPTH_GAMES, DEPTH_REV, DEPTH_TYPES, depthFinish, depthGame, depthStretchShare } from "../src/lib/duel/logicDepth";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { cluesFor, countNonoSolutions, encodeNonoCells, nonoSizeOf, NONO_DEPTH_SIZE, type NonoMarks } from "../src/lib/duel/nonogram";
import { countTentSolutions, encodeTents, tentsHeightOf, tentsLayoutValid, TENTS_DEPTH_HEIGHT } from "../src/lib/duel/tents";
import { countShikakuSolutions, decodeShikaku, encodeShikaku, shikakuHeightOf, shikakuSolved, SHIKAKU_DEPTH_HEIGHT } from "../src/lib/duel/shikaku";
import { countLightUpSolutions, encodeBulbs, lightUpHeightOf, lightUpValid, LIGHTUP_DEPTH_HEIGHT } from "../src/lib/duel/lightUp";
import { verifyLightUpPuzzle } from "../src/lib/duel/lightUp.server";
import { LIGHTUP_BANK } from "../src/lib/duel/lightUpBank.server";
import { encodePresses } from "../src/lib/duel/logic";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { legacyRoomPuzzle, stripDepth } from "./depth-d6-legacy";

let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}

/* 1. Old rounds grade as before. */
interface Recorded { type: PuzzleType; seed: number; puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; extra: Record<string, unknown> | null }
const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-d6-legacy.json.gz")).toString("utf8")) as { rounds: Recorded[] };
let same = 0;
const perGame = new Map<string, number>();
for (const r of fixture.rounds) {
  ok((r.puzzle as { depthRev?: number }).depthRev === undefined, `${r.type}: a legacy round carries no depth stamp`);
  const g = gradeAnswer(r.puzzle, r.answer, r.ms);
  const match = g.score === r.score && g.isCorrect === r.isCorrect && JSON.stringify(g.extra ?? null) === JSON.stringify(r.extra);
  if (match) same++;
  else ok(false, `${r.type} seed ${r.seed}: legacy round regraded ${g.score}${g.isCorrect ? "✓" : ""} (stored ${r.score}${r.isCorrect ? "✓" : ""})`);
  perGame.set(r.type, (perGame.get(r.type) ?? 0) + 1);
  ok(r.score <= 150, `${r.type}: a legacy round never scored above 150 (${r.score})`);
}
ok(fixture.rounds.length > 1500 && perGame.size === 11, `the legacy fixture covers the eleven games (${fixture.rounds.length} rounds, ${perGame.size} games)`);
ok(fixture.rounds.some((r) => r.isCorrect) && fixture.rounds.some((r) => !r.isCorrect && r.score > 0), "the legacy fixture holds finishes and unfinished credit");
// The kept legacy draw (scripts/depth-d6-legacy.ts, used by the checks that replay answers recorded before the change)
// rebuilds every recorded room puzzle exactly, the old boards included.
{
  const sorted = (p: unknown) => JSON.stringify(Object.entries(p as object).sort(([a], [b]) => (a < b ? -1 : 1)));
  const seen = new Set<string>();
  for (const r of fixture.rounds) {
    if (seen.has(`${r.type}:${r.seed}`)) continue;
    seen.add(`${r.type}:${r.seed}`);
    ok(sorted(legacyRoomPuzzle(r.type, r.seed)) === sorted(r.puzzle), `${r.type} seed ${r.seed}: the legacy draw rebuilds main's room puzzle`);
  }
}
// The old board sizes are in it (they still grade on this tree).
const legacyOf = (t: PuzzleType) => fixture.rounds.find((r) => r.type === t)!.puzzle;
ok(nonoSizeOf(legacyOf("nonogram") as Extract<PuzzleData, { type: "nonogram" }>) === 7, "legacy Mosaic rounds are 7 × 7");
ok(tentsHeightOf(legacyOf("tents") as Extract<PuzzleData, { type: "tents" }>) === 8, "legacy Tents rounds are 8 × 8");
ok(shikakuHeightOf(legacyOf("shikaku") as Extract<PuzzleData, { type: "shikaku" }>) === 10, "legacy Shikaku rounds are 10 × 10");
ok(lightUpHeightOf(legacyOf("lightup") as Extract<PuzzleData, { type: "lightup" }>) === 9, "legacy Lamplighter rounds are 9 × 9");

/* 2. The deal. */
const deal = (type: PuzzleType, seed: number) => withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
for (const type of DEPTH_TYPES) {
  for (const seed of [11, 4242, 987_654]) {
    const p = deal(type, seed) as PuzzleData & { depthRev?: number; par?: number };
    ok(p.depthRev === DEPTH_REV, `${type} seed ${seed}: dealt on depthRev 1`);
    ok(JSON.stringify(deal(type, seed)) === JSON.stringify(p), `${type} seed ${seed}: the room seed alone decides the board`);
    if (p.type === "lightsout") ok(p.par === p.minPresses && (p.par ?? 0) > 0, `Blackout seed ${seed}: par is public and is the minimum`);
    if (p.type === "tubes") ok(p.par === p.minMoves && (p.par ?? 0) > 0, `Polypotions seed ${seed}: par is public and is the minimum`);
  }
}
ok(!("depthRev" in (deal("maze", 5) as object)), "other games are not stamped");

/* 3. Scoring on depthRev 1. */
// Formula properties.
for (const type of DEPTH_TYPES) {
  const g = depthGame(type);
  let prev = 0;
  for (let i = 0; i <= 100; i++) {
    const left = i / 100;
    const input = { left, efficiency: 1, moves: 10, par: 10, openedOn: 1 };
    const r = depthFinish(type, input);
    ok(r.score >= 120 && r.score <= 200 && r.score === 120 + r.speed + r.top, `${type}: a finish is 120–200 and adds up (${left}: ${r.score})`);
    ok(r.score >= prev, `${type}: more time left never scores less (${left}: ${r.score} < ${prev})`);
    prev = r.score;
  }
  ok(depthFinish(type, { left: g.fast, efficiency: 1, moves: 12, par: 11, openedOn: 3 }).score === 150, `${type}: the fast share with no mistakes is 150 off the top route`);
  if (g.route === "par") {
    ok(depthFinish(type, { left: g.fast, efficiency: 1, moves: 10, par: 10 }).score === 200, `${type}: par at the fast share is 200`);
    ok(depthFinish(type, { left: 1, efficiency: 1, moves: 11, par: 10 }).score <= 150, `${type}: one over par is at most 150`);
    ok(depthFinish(type, { left: 0, efficiency: 1, moves: 10, par: 10 }).score === 140, `${type}: par at the buzzer is 140`);
  } else {
    ok(depthFinish(type, { left: g.elite, efficiency: 1, moves: 10, par: 10, openedOn: 1 }).score === 200, `${type}: the elite share with no mistakes is 200`);
    ok(depthFinish(type, { left: (g.fast + g.elite) / 2, efficiency: 1, moves: 10, par: 10, openedOn: 1 }).score <= 170, `${type}: halfway to elite is at most 170`);
    ok(depthStretchShare(type, g.fast) === 0, `${type}: the stretch starts at the fast share`);
    if (g.route === "stretch" && type !== "flood") ok(depthFinish(type, { left: 1, efficiency: 0.8 }).score < 200 - 10, `${type}: mistakes cut the top`);
  }
  if (g.route === "clean") {
    ok(depthFinish(type, { left: 1, efficiency: 0.53, openedOn: 2 }).score <= 120 + 16 + 25, "safe: a second-try crack earns half the top");
    ok(depthFinish(type, { left: 1, efficiency: 0, openedOn: 3 }).score === 120, "safe: a last-try crack keeps rev 3's flat 120");
  }
}
ok(depthFinish("flood", { left: 1, efficiency: 1, moves: 12, par: 10 }).score === 150, "Colour Flood: two over par earns no stretch");
ok(depthFinish("flood", { left: 1, efficiency: 1, moves: 11, par: 10 }).score === 175, "Colour Flood: one over par earns half the stretch");

// Real grades on dealt puzzles: the solution at chosen times.
const solutionAnswer = (p: PuzzleData): string | null => {
  switch (p.type) {
    case "lightsout": return encodePresses(p.solution ?? []);
    case "nonogram": {
      const marks = (p.pattern ?? []).map((on) => (on ? 1 : 0)) as NonoMarks;
      return encodeNonoCells(marks);
    }
    case "tents": return encodeTents(p.solution ?? []);
    case "shikaku": return encodeShikaku(p.solution ?? []);
    case "lightup": return encodeBulbs(p.solution ?? []);
    default: return null;
  }
};
for (const type of ["lightsout", "nonogram", "tents", "shikaku", "lightup"] as PuzzleType[]) {
  const p = deal(type, 31_337);
  const answer = solutionAnswer(p)!;
  const limit = puzzleTimeLimitMs(p);
  const g = depthGame(type);
  const atTop = gradeAnswer(p, answer, Math.ceil(limit * (g.route === "par" ? g.fast : g.elite)) + 1);
  ok(atTop.isCorrect && atTop.score === 200, `${type}: the solution at the top pace grades 200 (${atTop.score})`);
  const atFast = gradeAnswer(p, answer, Math.ceil(limit * g.fast) + 1);
  ok(atFast.score === (g.route === "par" ? 200 : 150), `${type}: the solution at the fast pace grades ${g.route === "par" ? 200 : 150} (${atFast.score})`);
  const atBuzzer = gradeAnswer(p, answer, 0);
  ok(atBuzzer.score === (g.route === "par" ? 140 : 120), `${type}: the solution at the buzzer grades ${g.route === "par" ? 140 : 120} (${atBuzzer.score})`);
  for (const graded of [atTop, atFast, atBuzzer]) {
    const parts = storedScoreParts(graded.extra);
    ok(!!parts && parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === graded.score, `${type}: the stored breakdown adds up to ${graded.score}`);
  }
  // The same board without the stamp scores as rev 3 (at most 150).
  ok(gradeAnswer(stripDepth(p), answer, limit).score === 150, `${type}: without the stamp the board tops out at 150`);
  // Unfinished: identical with and without the stamp.
  const half = answer.split(",").slice(0, Math.floor(answer.split(",").length / 2)).join(",");
  ok(gradeAnswer(p, half, 0).score === gradeAnswer(stripDepth(p), half, 0).score, `${type}: unfinished credit is rev 3's`);
}
// Blackout over par: an extra pair of presses on the same cell solves too but misses par.
{
  const p = deal("lightsout", 777) as Extract<PuzzleData, { type: "lightsout" }>;
  const sol = p.solution ?? [];
  const over = encodePresses([sol[0]!, sol[0]!, ...sol]);
  const g = gradeAnswer(p, over, puzzleTimeLimitMs(p));
  ok(g.isCorrect && g.score <= 150, `Blackout: solved two presses over par stays at most 150 (${g.score})`);
  const at = gradeAnswer(p, encodePresses(sol), puzzleTimeLimitMs(p));
  ok(at.score === 200 && (at.extra?.["depth"] as { atPar?: boolean } | undefined)?.atPar === true, `Blackout: solved at par with the clock full is 200 (${at.score})`);
}

/* 4. The bigger boards. */
for (const seed of [3, 17, 2025, 90_001]) {
  const n = deal("nonogram", seed) as Extract<PuzzleData, { type: "nonogram" }>;
  ok(nonoSizeOf(n) === NONO_DEPTH_SIZE && n.cols.length === 8 && (n.pattern ?? []).length === 64, `Mosaic seed ${seed}: an 8 × 8 picture`);
  ok(countNonoSolutions(n.rows, n.cols, 2) === 1 && JSON.stringify(cluesFor(n.pattern ?? [], 8)) === JSON.stringify({ rows: n.rows, cols: n.cols }), `Mosaic seed ${seed}: its clues fit its picture only`);
  const t = deal("tents", seed) as Extract<PuzzleData, { type: "tents" }>;
  ok(t.size === 8 && tentsHeightOf(t) === TENTS_DEPTH_HEIGHT && t.rowCounts.length === 9 && t.colCounts.length === 8, `Tents seed ${seed}: an 8 × 9 field`);
  ok(tentsLayoutValid(t, t.solution ?? []) && countTentSolutions(t, 2) === 1, `Tents seed ${seed}: one layout, the stored one`);
  ok(t.trees.length >= 12 && t.trees.length <= 13, `Tents seed ${seed}: 12–13 pairs`);
  const s = deal("shikaku", seed) as Extract<PuzzleData, { type: "shikaku" }>;
  ok(s.size === 10 && shikakuHeightOf(s) === SHIKAKU_DEPTH_HEIGHT, `Shikaku seed ${seed}: a 10 × 11 grid`);
  ok(shikakuSolved(s.solution ?? [], s.clues, 10, 11) && countShikakuSolutions(s.clues, 2, 10, 11) === 1, `Shikaku seed ${seed}: one partition, the stored one`);
  ok(s.clues.length >= 17 && s.clues.length <= 21, `Shikaku seed ${seed}: 17–21 rectangles`);
  const l = deal("lightup", seed) as Extract<PuzzleData, { type: "lightup" }>;
  ok(l.size === 9 && lightUpHeightOf(l) === LIGHTUP_DEPTH_HEIGHT && lightUpValid(l, l.solution ?? []) && countLightUpSolutions(l, 2) === 1, `Lamplighter seed ${seed}: a 9 × 10 board with one layout`);
}
ok(LIGHTUP_BANK.length === 1000 && LIGHTUP_BANK.every((p) => lightUpHeightOf(p) === LIGHTUP_DEPTH_HEIGHT), "the Lamplighter bank is 1000 9 × 10 boards");
ok(LIGHTUP_BANK.slice(0, 40).every((p) => verifyLightUpPuzzle(p) === null), "the first 40 bank boards verify (puzzle-bank-check verifies all)");
// Shikaku's code: digits as before, "a" for row 10.
{
  const old = "0012,3345,9999";
  ok(JSON.stringify(decodeShikaku(old, 10, 10)) === JSON.stringify(decodeShikaku(old, 10)), "Shikaku: older answers decode as before");
  ok(decodeShikaku("90a3", 10, 10).length === 0 && decodeShikaku("90a3", 10, 11).length === 1, "Shikaku: row 10 ('a') is past a square board's edge and on the taller grid");
  ok(encodeShikaku([{ r0: 9, c0: 0, r1: 10, c1: 3 }]) === "90a3" && encodeShikaku([{ r0: 1, c0: 2, r1: 3, c1: 4 }]) === "1234", "Shikaku: the code writes digits, and 'a' only for row 10");
}

/* 5. Maximum, texts, demos. */
for (const type of DEPTH_TYPES) {
  ok(ROUND_MAX[type] === 200 && roundMaxFor(type) === 200, `${type}: ROUND_MAX is 200`);
  ok(/\b200\b/.test(INTRO_SCORE[type]) && INTRO_SCORE[type].length <= 90 && !/\bpar\b/i.test(INTRO_SCORE[type]), `${type}: the intro states 200 in two lines without "par" ("${INTRO_SCORE[type]}")`);
  ok(/120 to 200/.test(PUZZLE_INSTRUCTIONS[type].score) && /50 more|up to 50/.test(PUZZLE_INSTRUCTIONS[type].score), `${type}: the help states the 200 top and what earns it`);
}
ok(Object.keys(DEPTH_GAMES).length === 11, "eleven depth games");
for (const t of ["nonogram", "tents", "shikaku", "lightup", "lightsout", "tower", "tubes", "safe"]) ok(DEPTH_DEMO_STOPS.has(t), `${t}: an older intro demo is stopped`);
ok(/DEPTH_DEMO_STOPS\.has\(data\.type\) && depthRevOf\(demo\?\.puzzle\) < DEPTH_REV/.test(readFileSync("src/lib/duel/introDemo.functions.ts", "utf8")), "the intro demo reader stops them");

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL depth-d6-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS depth-d6-check: ${passes} checks — ${same} legacy rounds regrade exactly; the eleven Logic games deal depthRev 1 and score 120–200 on it (stretch, par, clean crack); the bigger boards are unique; ROUND_MAX, texts and demo stops follow`);
