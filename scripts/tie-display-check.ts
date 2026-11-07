/**
 * How ties are shown (Polish batch R, 25 Oct 2026, display only; src/lib/duel/tieDisplay.ts). The ranking
 * itself is tie-break-check's: rooms break a tie on points by the time used and players level on both
 * share a position (scoring.ts `rank`); the daily board the same (daily.ts `rankBoard`). This proves the
 * display follows that ranking and never reorders it:
 *  - a row level on points but placed apart by time says "Level on N · ahead on time" (the best placed of
 *    the level group) or "· behind on time";
 *  - rows level on points and time share the place: "=1", shared, "Level on N";
 *  - a row on its own points has no note and no "="; level on 0 shares the place but has no note;
 *  - the round results' places (roundPlaces) follow the round score then the time used, a dead heat shared;
 *  - on real standings() rows: positions are untouched and the marks agree with them.
 *
 *   bun scripts/tie-display-check.ts
 */
import { roundPlaces, tieMarks } from "../src/lib/duel/tieDisplay";
import { standings } from "../src/lib/duel/scoring";
import type { DuelPlayerRow, RoundResultRow } from "../src/lib/duel/types";

let passes = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string) => (ok ? passes++ : failures.push(message));

// Level on 230, split by time, then a dead heat on 195, then one alone.
const marks = tieMarks([
  { slot: 1, points: 230, position: 1 },
  { slot: 2, points: 230, position: 2 },
  { slot: 3, points: 230, position: 3 },
  { slot: 4, points: 195, position: 4 },
  { slot: 5, points: 195, position: 4 },
  { slot: 6, points: 150, position: 6 },
]);
check(marks.get(1)?.note === "Level on 230, ahead on time" && marks.get(1)?.label === "1" && !marks.get(1)?.shared, `first of a time-split tie: ${JSON.stringify(marks.get(1))}`);
check(marks.get(2)?.note === "Level on 230, behind on time" && marks.get(2)?.label === "2", `second of a time-split tie: ${JSON.stringify(marks.get(2))}`);
check(marks.get(3)?.note === "Level on 230, behind on time", `third of a time-split tie: ${JSON.stringify(marks.get(3))}`);
check(marks.get(4)?.label === "=4" && marks.get(4)?.shared === true && marks.get(4)?.note === "Level on 195", `dead heat: ${JSON.stringify(marks.get(4))}`);
check(marks.get(5)?.label === "=4" && marks.get(5)?.shared === true, `dead heat (second): ${JSON.stringify(marks.get(5))}`);
check(marks.get(6)?.note === null && marks.get(6)?.label === "6" && !marks.get(6)?.shared, `alone: ${JSON.stringify(marks.get(6))}`);

// Shared first place: the same medal for both.
const first = tieMarks([
  { slot: 1, points: 300, position: 1 },
  { slot: 2, points: 300, position: 1 },
  { slot: 3, points: 200, position: 3 },
]);
check(first.get(1)?.label === "=1" && first.get(2)?.label === "=1" && first.get(3)?.label === "3", "shared first place");

// Level on 0: shared, no note.
const zero = tieMarks([
  { slot: 1, points: 0, position: 1 },
  { slot: 2, points: 0, position: 1 },
]);
check(zero.get(1)?.shared === true && zero.get(1)?.note === null, "level on 0 has no note");

// The round results: the round score, then the time used; a dead heat shares the place.
const places = roundPlaces(
  [
    { slot: 1, roundScore: 120 },
    { slot: 2, roundScore: 120 },
    { slot: 3, roundScore: 120 },
    { slot: 4, roundScore: 90 },
  ],
  new Map([
    [1, 40_000],
    [2, 30_000],
    [3, 40_000],
    [4, null],
  ]),
);
const at = (slot: number) => places.find((p) => p.slot === slot)?.position;
check(at(2) === 1 && at(1) === 2 && at(3) === 2 && at(4) === 4, `round places ${JSON.stringify(places)}`);
const roundMarks = tieMarks(places);
check(roundMarks.get(2)?.note === "Level on 120, ahead on time" && roundMarks.get(1)?.label === "=2" && roundMarks.get(1)?.note === "Level on 120, behind on time", "round marks");

// Real standings(): the marks only describe the positions the ranking already gave.
const players = [1, 2, 3, 4].map(
  (slot) => ({ id: `p${slot}`, duel_id: "d", user_id: `u${slot}`, player_slot: slot, display_name: `P${slot}`, status: "active" }) as unknown as DuelPlayerRow,
);
const result = (slot: number, score: number, msRemaining: number): RoundResultRow =>
  ({ id: `r${slot}`, duel_id: "d", player_slot: slot, round_number: 1, score, is_correct: true, ms_remaining: msRemaining, reaction_avg_ms: null, answer: "", extra: null }) as unknown as RoundResultRow;
const table = standings(players, [result(1, 120, 10_000), result(2, 120, 20_000), result(3, 120, 10_000), result(4, 60, 0)], 1);
const before = table.map((r) => `${r.slot}:${r.position}`).join(",");
const tableMarks = tieMarks(table.map((r) => ({ slot: r.slot, points: r.total, position: r.position })));
check(table.map((r) => `${r.slot}:${r.position}`).join(",") === before, "tieMarks changed a position");
for (const row of table) {
  const mark = tableMarks.get(row.slot)!;
  check(Number(mark.label.replace("=", "")) === row.position, `slot ${row.slot}: label ${mark.label} for position ${row.position}`);
}
const quick = table.find((r) => r.slot === 2)!;
check(quick.position === 1 && tableMarks.get(2)?.note === "Level on 120, ahead on time", `the quicker of three on 120 is first, ahead on time (${before})`);
check(tableMarks.get(1)?.label === "=2" && tableMarks.get(3)?.label === "=2", `level on points and time share 2nd (${before})`);

for (const f of failures) console.log(`  FAIL ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} tie display checks`);
  process.exit(1);
}
console.log(`PASS: ${passes} tie display checks (time-split ties say ahead or behind on time, dead heats share the place and medal, ranking untouched)`);
