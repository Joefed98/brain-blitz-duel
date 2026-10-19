/**
 * room-late-run-check (19 Oct 2026, room flow only): an arcade run whose stage mounts late is no
 * longer cut short (src/lib/duel/roomClose.ts), #115's audit item 6.
 *
 *  1. Puzzles are unchanged: the time-out at the end of the phase (puzzleDurationMs), the room
 *     moving on 800 ms later.
 *  2. Every arcade-clock game in rooms (the active arcade games and the engine games): the time-out
 *     comes ARCADE_LATE_RUN_MS later, the room 800 ms after it. A run mounted L ms after the phase
 *     change ends on its own (L + its run length, plus a frame) before the time-out for every L up
 *     to ARCADE_PHASE_SLACK_MS + ARCADE_LATE_RUN_MS less a frame and the send; before, any L past
 *     ARCADE_PHASE_SLACK_MS was cut. A later run still sends its draft before the room moves on.
 *  3. The server (duel.functions.ts) and the room page close the phase at the same moment
 *     (roomPuzzleCloseMs) and the room page's time-out reads roomTimeoutMs.
 *
 *   bun scripts/room-late-run-check.ts
 */
import { readFileSync } from "node:fs";

import { ARCADE_LATE_RUN_MS, ROOM_CLOSE_GRACE_MS, roomPuzzleCloseMs, roomTimeoutMs } from "../src/lib/duel/roomClose";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import {
  ACTIVE_PUZZLE_TYPES,
  ARCADE_PHASE_SLACK_MS,
  puzzleDurationMs,
  puzzleRunMs,
  usesArcadeClock,
} from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
}

/** One 60 Hz frame for the stage to see the run is over, plus the time to encode and start the send. */
const FINISH_MS = 17 + 100;

let arcadeGames = 0;
let puzzleGames = 0;
for (const type of ACTIVE_PUZZLE_TYPES as readonly PuzzleType[]) {
  let puzzle: PuzzleData;
  try {
    puzzle = withSeededRandom(5, () => generatePuzzle(type)) as PuzzleData;
  } catch {
    puzzle = { type } as PuzzleData;
  }
  const duration = puzzleDurationMs(puzzle);
  if (!usesArcadeClock(type)) {
    puzzleGames++;
    check(roomTimeoutMs(puzzle) === duration, `${type}: a puzzle's time-out moved (${roomTimeoutMs(puzzle)} vs ${duration})`);
    check(roomPuzzleCloseMs(puzzle) === duration + 800, `${type}: a puzzle's phase end moved`);
    continue;
  }
  arcadeGames++;
  const run = puzzleRunMs(puzzle)!;
  const timeout = roomTimeoutMs(puzzle);
  const close = roomPuzzleCloseMs(puzzle);
  check(timeout === duration + ARCADE_LATE_RUN_MS, `${type}: time-out ${timeout}, not the phase end + ${ARCADE_LATE_RUN_MS}`);
  check(close === timeout + ROOM_CLOSE_GRACE_MS, `${type}: the room does not move on ${ROOM_CLOSE_GRACE_MS} ms after the time-out`);
  const lastOnTime = ARCADE_PHASE_SLACK_MS + ARCADE_LATE_RUN_MS - FINISH_MS;
  for (let late = 0; late <= 12_000; late += 250) {
    const ends = late + run + FINISH_MS;
    const before = ends <= duration; // the old time-out, at the phase end
    const now = ends <= timeout;
    if (late <= lastOnTime) check(now, `${type}: a run mounted ${late} ms late is still cut (ends ${ends}, time-out ${timeout})`);
    if (late <= ARCADE_PHASE_SLACK_MS - FINISH_MS) check(before && now, `${type}: an on-time run (${late} ms) is cut`);
    // Whatever the lateness, the phone's answer is on its way before the room moves on.
    check(Math.min(ends, timeout) < close, `${type}: ${late} ms late, nothing sent before the room moves on`);
  }
  // The old flow cut every run mounted past the phase slack.
  check(!(ARCADE_PHASE_SLACK_MS + 1000 + run + FINISH_MS <= duration), `${type}: the old time-out was not cutting late runs (setup)`);
}
check(arcadeGames >= 22, `only ${arcadeGames} arcade-clock games in rooms`);
check(puzzleGames >= 40, `only ${puzzleGames} puzzles`);

{
  const server = readFileSync(new URL("../src/lib/duel/duel.functions.ts", import.meta.url), "utf8");
  check(/const timeUp = elapsed > roomPuzzleCloseMs\(puzzle\);/.test(server), "the server does not close the puzzle phase at roomPuzzleCloseMs");
  check(!/puzzleDurationMs\(puzzle\) \+ 800/.test(server), "the server still closes at the old time");
  const route = readFileSync(new URL("../src/routes/duel.$code.tsx", import.meta.url), "utf8");
  check(/puzzleStart \+ roomTimeoutMs\(puzzle\)/.test(route), "the room page's time-out does not read roomTimeoutMs");
  check(/puzzleStart \+ roomPuzzleCloseMs\(puzzle\)/.test(route) && /closesAt !== null && now > closesAt/.test(route), "the room page does not move on at roomPuzzleCloseMs");
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`room-late-run-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`room-late-run-check: PASS (${passes} checks; ${arcadeGames} arcade-clock games, ${puzzleGames} puzzles)`);
