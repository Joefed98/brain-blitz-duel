/**
 * round-time-check (18 Oct 2026, display only): the round leaderboard shows how each player did,
 * figure for figure, as stored. No grading or scoring is touched; every row here is graded by the
 * real grader (gradeAnswer) or built in the stored format, and the leaderboard's figures are read
 * through the real code (resultPresentation.ts, each game's roundSummary, buzzer.ts).
 *
 *  1. Time used: for every active game type, a player who reached the buzzer (no time left, or
 *     less than BUZZER_MARGIN_MS on the round's own clock, arcade runs included) shows the full
 *     clock in whole seconds ("90s"); one who finished earlier shows tenths ("88.5s"); an arcade
 *     run's time never passes its run length (a full run stored 0 ms left used the run, not the
 *     run plus the phase slack); Bang On shows no time (its stored figure is a distance) and
 *     Flash its average reaction.
 *  2. Verdicts: arcade runs, Flash and Bang On are judged by their score alone ("Scored" / "✗");
 *     a puzzle's "✓ Correct" stays a full solve.
 *  3. Summaries agree with the stored result: Ascend (tapRev tap logs) counts what the grader
 *     counted; Operator's tries suffix and try limit (equationRev 1) give the grader's count;
 *     Nucleus and Forage on their curves never print the old formula; Counterweight counts every
 *     balanced scale; Target (score rev 1) shows the distance it scored, never a starting tile;
 *     Hats (whackRev 1) drops the old formula; Lights Out never goes negative; Pull! shows its
 *     empty-shot cost.
 *  4. "Finished" pings (buzzer.ts finishedBeforeBuzzer): only an answer received in the puzzle
 *     phase with at least BUZZER_MARGIN_MS left on the round's own clock; never a time-out draft,
 *     a late answer in the reveal, or a run that played to the end of its clock.
 *
 *   bun scripts/round-time-check.ts
 */
import { readFileSync } from "node:fs";

import { BUZZER_MARGIN_MS, clockLeftMs, finishedBeforeBuzzer, roundClockMs } from "../src/lib/duel/buzzer";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { ACTIVE_PUZZLE_TYPES, puzzleDef, puzzleRunMs, puzzleTimeLimitMs, usesArcadeClock } from "../src/lib/duel/registry";
import { elapsedMs, formatElapsed, roundVerdict, scoreOnlyVerdict } from "../src/lib/duel/resultPresentation";
import type { PuzzleData, PuzzleType, RoundResultRow } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
}

const row = (extra: Partial<RoundResultRow> = {}): RoundResultRow =>
  ({
    id: "r", duel_id: "room", player_slot: 1, round_number: 1, answer: "", is_correct: false, ms_remaining: 0,
    reaction_avg_ms: null, correct_count: null, errors: null, extra: null, score: 0, submitted_at: "2026-10-18T12:00:00Z",
    ...extra,
  }) as RoundResultRow;
const gradedRow = (puzzle: PuzzleData, answer: string, ms: number): RoundResultRow => {
  const g = gradeAnswer(puzzle, answer, ms);
  return row({
    answer: g.answer || null, is_correct: g.isCorrect, score: g.score, ms_remaining: g.storedMs, reaction_avg_ms: g.reactionAvgMs,
    correct_count: g.correctCount, errors: g.errors, extra: g.extra as RoundResultRow["extra"],
  });
};
const summary = (puzzle: PuzzleData, r: RoundResultRow) => puzzleDef(puzzle.type).roundSummary(r, puzzle);
const gen = (type: PuzzleType, seed = 7) => withSeededRandom(seed, () => generatePuzzle(type)) as PuzzleData;

/* ------------------------------------------------------------ 1. time used, every active game */

const ACTIVE: readonly PuzzleType[] = ACTIVE_PUZZLE_TYPES;
let typesTimed = 0;
for (const type of ACTIVE) {
  let puzzle: PuzzleData;
  try {
    puzzle = gen(type);
  } catch {
    puzzle = { type } as PuzzleData;
  }
  const limit = puzzleTimeLimitMs(puzzle);
  const clock = roundClockMs(puzzle);
  const full = `${Math.round(clock / 1000)}s`;
  const shown = (r: RoundResultRow) => formatElapsed(elapsedMs(r, limit, clock, type), clock);
  check(clock > 0 && clock <= limit, `${type}: round clock ${clock} ms outside its time limit ${limit} ms`);
  if (usesArcadeClock(type)) check(clock === puzzleRunMs(puzzle), `${type}: arcade clock is not the run length`);
  if (type === "stopwatch") {
    check(shown(row({ reaction_avg_ms: 85, ms_remaining: 0 })) === "—", `stopwatch: a distance shown as a time (${shown(row({ reaction_avg_ms: 85 }))})`);
    continue;
  }
  if (type === "reaction") {
    check(shown(row({ reaction_avg_ms: 312 })) === "0.3s", `reaction: average reaction not shown (${shown(row({ reaction_avg_ms: 312 }))})`);
    continue;
  }
  typesTimed++;
  // Stored with no time left (a time-out's draft, an unfinished run): the full clock.
  check(shown(row({ ms_remaining: 0 })) === full, `${type}: no time left shows ${shown(row({ ms_remaining: 0 }))}, not ${full}`);
  // Sent at the buzzer (0.6 s left on the round's own clock): the full clock, not "89.4s".
  const atBuzzer = limit - clock + 600;
  check(shown(row({ ms_remaining: atBuzzer })) === full, `${type}: 0.6 s left shows ${shown(row({ ms_remaining: atBuzzer }))}, not ${full}`);
  // Exactly the margin left: an early finish, in tenths.
  const early = limit - clock + 1500;
  const tenths = `${((clock - 1500) / 1000).toFixed(1)}s`;
  check(shown(row({ ms_remaining: early })) === tenths, `${type}: 1.5 s left shows ${shown(row({ ms_remaining: early }))}, not ${tenths}`);
  // No time used ever passes the clock.
  for (const ms of [0, 1, 500, limit - clock, limit]) {
    const used = elapsedMs(row({ ms_remaining: ms }), limit, clock, type)!;
    check(used >= 0 && used <= clock, `${type}: ${ms} ms left gives ${used} ms used on a ${clock} ms clock`);
  }
}
check(formatElapsed(null, 90_000) === "—", "no answer must show —");
check(formatElapsed(89_400, 90_000) === "90s" && formatElapsed(88_900, 90_000) === "88.9s", "the 90 s example");
check(formatElapsed(31_200) === "31.2s", "without a clock, tenths as before");

/* ------------------------------------------------------------ 2. verdicts */

for (const type of ACTIVE) {
  const scoreOnly = scoreOnlyVerdict(type);
  const expected = usesArcadeClock(type) || type === "reaction" || type === "stopwatch";
  check(scoreOnly === expected, `${type}: score-only verdict ${scoreOnly}, expected ${expected}`);
  if (scoreOnly) {
    check(roundVerdict({ roundCorrect: true, roundScore: 0 }, true) === "zero", `${type}: is_correct with 0 points read as correct`);
    check(roundVerdict({ roundCorrect: false, roundScore: 140 }, true) === "scored", `${type}: 140 points without is_correct read as partial`);
  }
}
check(roundVerdict({ roundCorrect: true, roundScore: 120 }) === "correct", "a puzzle solve must stay correct");
check(roundVerdict({ roundCorrect: false, roundScore: 40 }) === "partial", "a puzzle part-solve must stay partial");

/* ------------------------------------------------------------ 3. summaries vs the stored result */

// Ascend, tapRev tap logs: the summary counts what the grader counted.
{
  const puzzle = gen("numhunt");
  const tapRev = (puzzle as { tapRev?: number }).tapRev;
  const log = (n: number) => `log1:${Array.from({ length: n }, (_, i) => `${i + 1}@${600 + i * 900}`).join(",")}`;
  for (const n of [0, 7, 24]) {
    const r = gradedRow(puzzle, tapRev ? log(n) : `${n},0,${600 + n * 900}`, 30_000);
    const s = summary(puzzle, r).summary;
    const reached = Number(r.extra?.["reached"] ?? r.correct_count ?? 0);
    check(r.is_correct ? s.startsWith("Finished") : s === `Reached ${reached} of 24`, `numhunt: ${n} taps graded ${reached} (correct ${r.is_correct}) but summary says "${s}"`);
  }
}
// Operator, equationRev 1: the tries suffix and the limit.
{
  const puzzle = gen("equation") as Extract<PuzzleData, { type: "equation" }>;
  const ops = puzzle.operators ?? [];
  if (!ops.length) failures.push("equation: generated puzzle has no stored operators (fixture)");
  else {
    const right = ops.map((o) => o.join(","));
    const limited = puzzle.tryLimit !== undefined && puzzle.equationRev !== undefined;
    const cases: [string, string][] = limited
      ? [
          ["all right", `${right.join("|")}#1,1,1,1`],
          ["last over the limit", `${right.join("|")}#1,1,1,${(puzzle.tryLimit ?? 3) + 1}`],
          ["two right", `${right.slice(0, 2).join("|")}||#1,1,0,0`],
        ]
      : [["all right", right.join("|")]];
    for (const [name, answer] of cases) {
      const r = gradedRow(puzzle, answer, 40_000);
      const s = summary(puzzle, r).summary;
      const shown = Number(/^(\d+) \/ 4 equations/.exec(s)?.[1] ?? -1);
      check(shown === r.correct_count, `equation (${name}): grader counted ${r.correct_count}, summary "${s}"`);
    }
  }
}
// Nucleus and Forage on their curves: never the old formula.
{
  const ws = row({ score: 135, extra: { words: ["STAR", "TRAIN"], points: 34 } });
  const wsNew = summary({ ...gen("wordsmith"), wordsmithRev: 1 } as PuzzleData, ws).summary;
  check(wsNew.startsWith("34 word points → 135") && !wsNew.includes("2.5"), `wordsmith rev 1 summary: "${wsNew}"`);
  const wsOld = summary({ ...gen("wordsmith"), wordsmithRev: undefined } as PuzzleData, ws).summary;
  check(wsOld.startsWith("2.5 × 34"), `wordsmith legacy summary: "${wsOld}"`);
  const wh = gen("wordhunt");
  const whRow = row({ score: 90, answer: "STAR,RATS" });
  const whNew = summary({ ...wh, wordHuntRev: 1 } as PuzzleData, whRow).summary;
  check(/word points → 90/.test(whNew) && !whNew.includes("× 2"), `wordhunt rev 1 summary: "${whNew}"`);
  const whOld = summary({ ...wh, wordHuntRev: undefined } as PuzzleData, whRow).summary;
  check(/points × 2 = 90/.test(whOld), `wordhunt legacy summary: "${whOld}"`);
}
// Counterweight: every balanced scale, not the leading run.
{
  const puzzle = gen("balance");
  const r = row({ correct_count: 3, score: 80, extra: { solved: 0, scales: [false, true, true, true] } });
  const s = summary(puzzle, r).summary;
  check(s.startsWith("3 /"), `balance: scales 2–4 balanced shows "${s}"`);
  const legacy = summary(puzzle, row({ correct_count: 2, extra: { solved: 2 } })).summary;
  check(legacy.startsWith("2 /"), `balance legacy: "${legacy}"`);
}
// Target, score rev 1: no number made is never "N away" from a starting tile.
{
  const puzzle = gen("target");
  const r = gradedRow(puzzle, "", 20_000);
  if (r.answer) {
    const s = summary(puzzle, r).summary;
    check(!/away/.test(s) || r.score > 0, `target: no steps scored ${r.score} but summary "${s}"`);
  }
  const tiles = (puzzle as { tiles: number[] }).tiles;
  const stepRow = row({ answer: JSON.stringify([]), score: 0, extra: { value: tiles[0], steps: [] } });
  const s = summary(puzzle, stepRow).summary;
  if ((puzzle as { puzzleScoreRev?: number }).puzzleScoreRev) check(s === "No number made", `target rev 1 with no steps: "${s}"`);
}
// Hats, whackRev 1: no old formula line.
{
  const r = row({ extra: { hits: 20, wrong: 1, totalTargets: 30, empty: 0, bombs: 0 } });
  check(summary({ type: "whack", seed: 1, whackRev: 1 } as unknown as PuzzleData, r).detail.length === 0, "whack rev 1 still prints the old formula");
  check(/135 ×/.test(summary({ type: "whack", seed: 1 } as unknown as PuzzleData, r).detail[0] ?? ""), "whack legacy lost its formula");
}
// Lights Out: never a negative count.
{
  const puzzle = gen("lightsout");
  const s = summary(puzzle, row({ is_correct: false, extra: { presses: 9, lightsAtStart: 5, lightsLeft: 8 } })).summary;
  check(!/-\d/.test(s), `lightsout: negative count "${s}"`);
}
// Pull!: the empty-shot cost explains a full house below 150.
{
  const s = summary({ type: "clayshoot", seed: 1, clayRev: 6 } as unknown as PuzzleData, row({ score: 138, extra: { hits: 25, total: 25, shots: 31, emptyShots: 6, emptyShotCost: 12 } }));
  check(/6 empty shots \(−12\)/.test(s.detail[0] ?? ""), `clayshoot: empty-shot cost missing: "${s.detail[0]}"`);
}
// Bang On: "off", never a bare figure that reads as a time.
check(summary(gen("stopwatch"), row({ reaction_avg_ms: 85 })).summary === "avg 85 ms off", "stopwatch summary must say 'off'");

/* ------------------------------------------------------------ 4. pings: before the buzzer only */

for (const type of ACTIVE) {
  const puzzle = { type } as PuzzleData;
  const limit = puzzleTimeLimitMs(puzzle);
  const clock = roundClockMs(puzzle);
  const ownLeft = (left: number) => limit - clock + left;
  check(finishedBeforeBuzzer(puzzle, "puzzle", ownLeft(5_000)), `${type}: a finish with 5 s left must ping`);
  check(finishedBeforeBuzzer(puzzle, "puzzle", ownLeft(BUZZER_MARGIN_MS)), `${type}: a finish with exactly the margin left must ping`);
  check(!finishedBeforeBuzzer(puzzle, "puzzle", 0), `${type}: a time-out's draft (0 ms) pinged`);
  check(!finishedBeforeBuzzer(puzzle, "puzzle", ownLeft(BUZZER_MARGIN_MS - 1)), `${type}: an answer at the buzzer pinged`);
  check(!finishedBeforeBuzzer(puzzle, "reveal", limit), `${type}: a late answer in the reveal pinged`);
  if (usesArcadeClock(type)) check(!finishedBeforeBuzzer(puzzle, "puzzle", limit - clock), `${type}: a run to the end of its clock pinged`);
  check(clockLeftMs(puzzle, limit) === clock, `${type}: clockLeftMs of a full limit is not the clock`);
}
const fnSrc = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
check(/if \(finishedBeforeBuzzer\(puzzle, room\.phase, msLeft\)\) await markSubmitted\(/.test(fnSrc), "submitAnswerFn must mark a ping only for a finish before the buzzer");
check((fnSrc.match(/markSubmitted\(/g) ?? []).length === 1, "markSubmitted must be called exactly once, behind the buzzer gate");
const gradeSrc = readFileSync("src/lib/duel/roomGrade.server.ts", "utf8");
check(/msLeft: ms/.test(gradeSrc) && /gradeAnswer\(puzzle, answer, ms, extra, received\)/.test(gradeSrc), "the ping's time left must be the one the grade used");

/* ------------------------------------------------------------ summary */

console.log(`${ACTIVE.length} active game types (${typesTimed} with a time column), buzzer margin ${BUZZER_MARGIN_MS} ms`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks`);
