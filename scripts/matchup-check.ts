/**
 * Proof checks for Matchup:
 *  1. the column refill queues are generated identically on both sides
 *  2. 200 runs of random valid AND invalid swaps replay identically: same final
 *     state, same checkpoints every 300 ticks, same score
 *  3. no fresh PRNG call happens during play except the no-valid-swap reshuffle
 *  4. the declared input range (k = 3, rows/columns 0…6) rejects bad payloads
 *  5. the game sits in the arcade category, is core and is not retired
 */

import { checkInputEvents, MAX_INPUT_EVENTS, type ArcadeInputEvent } from "../src/lib/arcade/engine.ts";
import {
  matchupCheckpoint,
  matchupFindSwap,
  matchupGame,
  matchupHasLine,
  matchupIndex,
  MATCHUP_CHECKPOINT_INTERVAL,
  MATCHUP_INPUT_RANGES,
  MATCHUP_QUEUE_LEN,
  MATCHUP_RUN_TICKS,
  MATCHUP_SIZE,
  type MatchupCheckpoint,
  type MatchupState,
} from "../src/lib/arcade/matchup.ts";
import { encodeMatchupRun, replayMatchupRun } from "../src/lib/duel/matchup.ts";
import { puzzleDef } from "../src/lib/duel/registry.ts";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};
let firstFailingTick: number | null = null;

const randomInt = (low: number, high: number) => low + Math.floor(Math.random() * (high - low + 1));

function integers(state: MatchupState): boolean {
  const values = [
    state.tick,
    state.swaps,
    state.raw,
    state.bestLine,
    state.cascades,
    state.reshuffles,
    state.lastScoreTick,
    ...state.cells,
    ...state.heads,
    ...state.queues.flat(),
  ];
  return values.every((value) => Number.isInteger(value));
}

/* ------------------- Queues and board built identically ------------------ */

for (let sample = 0; sample < 50; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const a = matchupGame.init(seed);
  const b = matchupGame.init(seed);
  if (JSON.stringify(a.queues) !== JSON.stringify(b.queues)) {
    fail(`matchup ${seed}: queues differ between two inits`);
  }
  if (JSON.stringify(a.cells) !== JSON.stringify(b.cells)) {
    fail(`matchup ${seed}: boards differ between two inits`);
  }
  if (a.queues.length !== MATCHUP_SIZE) fail(`matchup ${seed}: ${a.queues.length} queues`);
  for (const queue of a.queues) {
    if (queue.length !== MATCHUP_QUEUE_LEN) fail(`matchup ${seed}: queue length ${queue.length}`);
  }
  if (matchupHasLine(a.cells)) fail(`matchup ${seed}: initial board already has a line`);
  if (!matchupFindSwap(a.cells)) fail(`matchup ${seed}: initial board has no valid swap`);
  if (!integers(a)) fail(`matchup ${seed}: non-integer initial state`);
}

/* ------------------------ 200-run identity proof ------------------------- */

let reshuffleRuns = 0;
let invalidSwaps = 0;

for (let sample = 0; sample < 200; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  let state = matchupGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: MatchupCheckpoint[] = [];
  let rngCalls = 0;
  let waitFor = randomInt(0, 20);

  for (let tick = 1; tick <= MATCHUP_RUN_TICKS; tick++) {
    let input: ArcadeInputEvent | null = null;
    if (waitFor > 0) waitFor -= 1;
    else {
      // Half the time a known valid swap, half the time a random (often
      // invalid) one, so the swap-back path is exercised too.
      const useValid = Math.random() < 0.5;
      const found = useValid ? matchupFindSwap(state.cells) : null;
      if (found) {
        input = { t: tick, k: 3, a: found.row1, b: found.col1, c: found.row2, d: found.col2 };
      } else {
        const row = randomInt(0, MATCHUP_SIZE - 1);
        const col = randomInt(0, MATCHUP_SIZE - 2);
        input = { t: tick, k: 3, a: row, b: col, c: row, d: col + 1 };
      }
      waitFor = randomInt(10, 30);
    }
    const before = state;
    state = matchupGame.step(state, input);
    if (input) {
      if (state.swaps > before.swaps) events.push(input);
      else invalidSwaps += 1;
    }
    if (state.rng !== before.rng) {
      rngCalls += 1;
      if (state.reshuffles === before.reshuffles) {
        fail(`matchup ${seed}: PRNG advanced at tick ${tick} without a reshuffle`);
      }
    }
    if (!integers(state)) fail(`matchup ${seed}: non-integer state at tick ${tick}`);
    if (state.tick % MATCHUP_CHECKPOINT_INTERVAL === 0) checkpoints.push(matchupCheckpoint(state));
    if (matchupGame.isOver(state)) break;
  }
  if (rngCalls > 0) reshuffleRuns += 1;
  // The board is always playable at the end of a resolved tick.
  if (!matchupFindSwap(state.cells)) fail(`matchup ${seed}: ended with no valid swap`);
  if (matchupHasLine(state.cells)) fail(`matchup ${seed}: ended with a line still on the board`);

  const claimed = matchupGame.score(state);
  const replay = replayMatchupRun(
    seed,
    encodeMatchupRun({ seed, claimedScore: claimed, events, endTick: state.tick, checkpoints }),
  );

  if (replay.score !== claimed) fail(`matchup ${seed}: replay ${replay.score} vs ${claimed}`);
  if (replay.raw !== state.raw) fail(`matchup ${seed}: raw points differ`);
  if (replay.swaps !== state.swaps) fail(`matchup ${seed}: swap counts differ`);
  if (replay.bestLine !== state.bestLine) fail(`matchup ${seed}: best line differs`);
  if (replay.reshuffles !== state.reshuffles) fail(`matchup ${seed}: reshuffle counts differ`);
  if (JSON.stringify(replay.state.cells) !== JSON.stringify(state.cells)) {
    fail(`matchup ${seed}: final boards differ`);
  }
  if (replay.flagged) fail(`matchup ${seed}: flagged (${replay.reason ?? "no reason"})`);
  if (replay.desyncTick !== null) {
    fail(`matchup ${seed}: desync at tick ${replay.desyncTick}`);
    if (firstFailingTick === null) firstFailingTick = replay.desyncTick;
  }
  if (replay.checkpoints.length !== checkpoints.length) fail(`matchup ${seed}: checkpoint count`);
  for (let index = 0; index < checkpoints.length; index++) {
    if (replay.checkpoints[index]!.checksum !== checkpoints[index]!.checksum) {
      fail(`matchup ${seed}: checkpoint ${checkpoints[index]!.tick} differs`);
    }
  }
  if (replay.score > 150 || replay.score < 0) fail(`matchup ${seed}: score out of range`);
}

if (invalidSwaps === 0) fail("no invalid swap was ever exercised");

/* -------------------------- Line scoring values -------------------------- */

{
  const state = matchupGame.init(7);
  // Three in a row scores 10, four scores 25, five or more scores 50.
  const board = [...state.cells];
  for (let col = 0; col < 5; col++) board[matchupIndex(3, col)] = 5;
  const runs = (await import("../src/lib/arcade/matchup.ts")).matchupRuns(board);
  const five = runs.find((run) => run.length >= 5);
  if (!five || five.points !== 50) fail("a line of five did not score 50");
}

/* -------------------------- Range validation ----------------------------- */

const rejected: [string, ArcadeInputEvent[]][] = [
  ["a row above the board", [{ t: 10, k: 3, a: MATCHUP_SIZE, b: 0, c: 0, d: 0 }]],
  ["a column above the board", [{ t: 10, k: 3, a: 0, b: MATCHUP_SIZE, c: 0, d: 0 }]],
  ["a negative row", [{ t: 10, k: 3, a: -1, b: 0, c: 0, d: 0 }]],
  ["a negative target column", [{ t: 10, k: 3, a: 0, b: 0, c: 0, d: -1 }]],
  ["an unknown kind", [{ t: 10, k: 4, a: 0, b: 0, c: 0, d: 1 }]],
  ["a swap before the run", [{ t: 0, k: 3, a: 0, b: 0, c: 0, d: 1 }]],
  ["a swap after the run", [{ t: MATCHUP_RUN_TICKS + 1, k: 3, a: 0, b: 0, c: 0, d: 1 }]],
  [
    "swaps out of order",
    [
      { t: 400, k: 3, a: 0, b: 0, c: 0, d: 1 },
      { t: 399, k: 3, a: 0, b: 0, c: 0, d: 1 },
    ],
  ],
  ["a non-integer payload", [{ t: 10, k: 3, a: 0.5, b: 0, c: 0, d: 1 }]],
  [
    "an oversized log",
    Array.from({ length: MAX_INPUT_EVENTS + 1 }, (_, index) => ({
      t: 1 + index,
      k: 3,
      a: 0,
      b: 0,
      c: 0,
      d: 1,
    })),
  ],
];

for (const [label, events] of rejected) {
  if (checkInputEvents(events, MATCHUP_RUN_TICKS, MATCHUP_INPUT_RANGES).ok) {
    fail(`range validation accepted ${label}`);
  }
}

// An out-of-range payload costs the player the whole run.
{
  const seed = 24_680;
  const cheated = encodeMatchupRun({
    seed,
    claimedScore: 150,
    events: [{ t: 10, k: 3, a: MATCHUP_SIZE + 3, b: 0, c: 0, d: 1 }],
    endTick: MATCHUP_RUN_TICKS,
    checkpoints: [],
  });
  const replay = replayMatchupRun(seed, cheated);
  if (!replay.flagged) fail("an out-of-range swap was not flagged");
  if (replay.reason !== "input payload out of range") {
    fail(`unexpected reason: ${replay.reason ?? "none"}`);
  }
  if (replay.raw !== 0 || replay.score !== 0) fail("an out-of-range swap still scored");
}

/* ----------------------------- Registration ------------------------------ */

{
  const def = puzzleDef("matchup");
  if (def.category !== "arcade") fail(`matchup: category is ${def.category}`);
  if (def.retired) fail("matchup: retired");
  if (def.revealMs !== 6_000) fail(`matchup: revealMs is ${def.revealMs}`);
  if (!def.instructions) fail("matchup: no instructions");
  if (!def.roundSummary) fail("matchup: no standings summary");
}

console.log(`runs needing a reshuffle: ${reshuffleRuns} / 200`);
console.log(`invalid swaps exercised: ${invalidSwaps}`);
console.log(`first failing tick: ${firstFailingTick ?? "none"}`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
