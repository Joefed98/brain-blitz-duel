/**
 * Proof checks for Snake, Cross, Dual and Ricochet:
 *  1. every value in the sim state stays an integer (no floats in physics)
 *  2. the client stepping path and the server replay reach the identical final
 *     state, the identical checkpoints and the identical score, over 200 random
 *     input logs per game
 *  3. an inflated claimed score is caught; a lagged phone is not given a crash
 *  4. input payloads outside a game's declared ranges are rejected
 */

import { TICKS_PER_SECOND, type ArcadeInputEvent } from "../src/lib/arcade/engine.ts";
import {
  snakeCheckpoint,
  snakeGame,
  SNAKE_CHECKPOINT_INTERVAL,
  SNAKE_INPUT_TURN,
  SNAKE_RUN_TICKS,
  type SnakeCheckpoint,
  type SnakeState,
} from "../src/lib/arcade/snake.ts";
import {
  crossCheckpoint,
  crossGame,
  crossPassable,
  CROSS_CHECKPOINT_INTERVAL,
  CROSS_INPUT_MOVE,
  CROSS_RUN_TICKS,
  type CrossCheckpoint,
  type CrossState,
} from "../src/lib/arcade/cross.ts";
import {
  dualCheckpoint,
  dualGame,
  dualSeparation,
  DUAL_CHECKPOINT_INTERVAL,
  DUAL_INPUT_JUMP,
  DUAL_RUN_TICKS,
  type DualCheckpoint,
  type DualState,
} from "../src/lib/arcade/dual.ts";
import {
  ricoCheckpoint,
  ricoGame,
  RICO_CHECKPOINT_INTERVAL,
  RICO_RUN_TICKS,
  RICO_SPIKE_H_FP as RICO_SPIKE_H_FP_4,
  RICO_CROSS_GAP_FP,
  ricoMinGapFp,
  ricoShaftReachable,
  type RicoCheckpoint,
} from "../src/lib/arcade/ricochet.ts";
import { encodeSnakeRun, replaySnakeRun } from "../src/lib/duel/snake.ts";
import { encodeCrossRun, replayCrossRun } from "../src/lib/duel/cross.ts";
import { encodeDualRun, replayDualRun } from "../src/lib/duel/dual.ts";
import { encodeRicoRun, replayRicoRun } from "../src/lib/duel/ricochet.ts";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};
let firstFailingTick: number | null = null;

const SAMPLES = 200;
const seedOf = () => 1 + Math.floor(Math.random() * 2_000_000_000);

function integers(values: readonly number[]): boolean {
  return values.every((value) => Number.isInteger(value));
}

function sameCheckpoints(
  mine: readonly { tick: number; checksum: number }[],
  theirs: readonly { tick: number; checksum: number }[],
  label: string,
): void {
  if (JSON.stringify(mine) === JSON.stringify(theirs)) return;
  const index = mine.findIndex((item, i) => item.checksum !== theirs[i]?.checksum);
  firstFailingTick = mine[index]?.tick ?? 0;
  fail(`${label}: checkpoints differ at tick ${firstFailingTick}`);
}

/* -------------------------------- Snake -------------------------------- */

function snakeIntegers(state: SnakeState): boolean {
  return integers([
    state.tick,
    state.dir,
    state.nextDir,
    state.eaten,
    state.cursor,
    state.pellet,
    state.sinceMove,
    ...state.body,
    ...state.queue,
  ]);
}

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = seedOf();
  const events: ArcadeInputEvent[] = [];
  for (let tick = 10; tick <= SNAKE_RUN_TICKS; tick += 12 + Math.floor(Math.random() * 40)) {
    events.push({
      t: tick,
      k: SNAKE_INPUT_TURN,
      a: Math.floor(Math.random() * 4),
      b: 0,
      c: 0,
      d: 0,
    });
  }
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = snakeGame.init(seed);
  const checkpoints: SnakeCheckpoint[] = [];
  if (!snakeIntegers(state)) fail(`snake ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= SNAKE_RUN_TICKS; tick++) {
    state = snakeGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % SNAKE_CHECKPOINT_INTERVAL === 0) checkpoints.push(snakeCheckpoint(state));
    if (!snakeIntegers(state)) fail(`snake ${seed}: non-integer state at tick ${tick}`);
    if (snakeGame.isOver(state)) break;
  }
  const claimed = snakeGame.score(state);
  const replayed = replaySnakeRun(
    seed,
    encodeSnakeRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`snake ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`snake ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.pellets !== state.eaten) fail(`snake ${seed}: pellet count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`snake ${seed}: final state differs`);
  }
  sameCheckpoints(checkpoints, replayed.checkpoints, `snake ${seed}`);
  if (replayed.desyncTick !== null) fail(`snake ${seed}: false desync`);
  if (replayed.endedSeconds !== Math.round((ticks / TICKS_PER_SECOND) * 10) / 10) {
    fail(`snake ${seed}: end time differs`);
  }

  const lied = replaySnakeRun(seed, encodeSnakeRun({ seed, claimedScore: 149, events }));
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`snake ${seed}: inflated claim not caught`);
  }
}

/* -------------------------------- Cross -------------------------------- */

function crossIntegers(state: CrossState): boolean {
  const values = [
    state.tick,
    state.crossings,
    state.lane,
    state.col,
    state.hop,
    state.reached,
    state.crossStart,
  ];
  for (const course of state.courses) {
    for (const lane of course.lanes) {
      values.push(lane.dir, lane.speed, lane.blockW, lane.period, lane.phase);
    }
  }
  return integers(values);
}

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = seedOf();
  const events: ArcadeInputEvent[] = [];
  for (let tick = 10; tick <= CROSS_RUN_TICKS; tick += 8 + Math.floor(Math.random() * 20)) {
    events.push({
      t: tick,
      k: CROSS_INPUT_MOVE,
      a: Math.floor(Math.random() * 3),
      b: 0,
      c: 0,
      d: 0,
    });
  }
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = crossGame.init(seed);
  for (const course of state.courses) {
    if (!crossPassable(course)) fail(`cross ${seed}: a crossing has no route`);
  }
  const checkpoints: CrossCheckpoint[] = [];
  if (!crossIntegers(state)) fail(`cross ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= CROSS_RUN_TICKS; tick++) {
    state = crossGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % CROSS_CHECKPOINT_INTERVAL === 0) checkpoints.push(crossCheckpoint(state));
    if (!crossIntegers(state)) fail(`cross ${seed}: non-integer state at tick ${tick}`);
    if (crossGame.isOver(state)) break;
  }
  const claimed = crossGame.score(state);
  const replayed = replayCrossRun(
    seed,
    encodeCrossRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`cross ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`cross ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.crossings !== state.crossings) fail(`cross ${seed}: crossing count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`cross ${seed}: final state differs`);
  }
  sameCheckpoints(checkpoints, replayed.checkpoints, `cross ${seed}`);
  if (replayed.desyncTick !== null) fail(`cross ${seed}: false desync`);

  const lied = replayCrossRun(seed, encodeCrossRun({ seed, claimedScore: 149, events }));
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`cross ${seed}: inflated claim not caught`);
  }
}

/* --------------------------------- Dual -------------------------------- */

function dualIntegers(state: DualState): boolean {
  return integers([
    state.tick,
    state.passed,
    state.jumps,
    state.leftUntil,
    state.rightUntil,
    ...state.left,
    ...state.right,
  ]);
}

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = seedOf();
  const events: ArcadeInputEvent[] = [];
  for (let tick = 10; tick <= DUAL_RUN_TICKS; tick += 6 + Math.floor(Math.random() * 30)) {
    events.push({
      t: tick,
      k: DUAL_INPUT_JUMP,
      a: Math.floor(Math.random() * 2),
      b: 0,
      c: 0,
      d: 0,
    });
  }
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = dualGame.init(seed);
  // Cross-side separation: every obstacle, either side, is far enough apart.
  const merged = [...state.left, ...state.right].sort((a, b) => a - b);
  for (let index = 1; index < merged.length; index++) {
    const gap = (merged[index] ?? 0) - (merged[index - 1] ?? 0);
    if (gap < dualSeparation(merged[index - 1] ?? 0)) {
      fail(`dual ${seed}: obstacles ${gap} ticks apart`);
    }
  }
  const checkpoints: DualCheckpoint[] = [];
  if (!dualIntegers(state)) fail(`dual ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= DUAL_RUN_TICKS; tick++) {
    state = dualGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % DUAL_CHECKPOINT_INTERVAL === 0) checkpoints.push(dualCheckpoint(state));
    if (!dualIntegers(state)) fail(`dual ${seed}: non-integer state at tick ${tick}`);
    if (dualGame.isOver(state)) break;
  }
  const claimed = dualGame.score(state);
  const replayed = replayDualRun(
    seed,
    encodeDualRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`dual ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`dual ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.passed !== state.passed) fail(`dual ${seed}: passed count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`dual ${seed}: final state differs`);
  }
  sameCheckpoints(checkpoints, replayed.checkpoints, `dual ${seed}`);
  if (replayed.desyncTick !== null) fail(`dual ${seed}: false desync`);

  const lied = replayDualRun(seed, encodeDualRun({ seed, claimedScore: 149, events }));
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`dual ${seed}: inflated claim not caught`);
  }
}

/* ------------------------------- Ricochet ------------------------------ */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = seedOf();
  const inputs: number[] = [];
  for (let tick = 8; tick <= RICO_RUN_TICKS; tick += 14 + Math.floor(Math.random() * 16)) {
    inputs.push(tick);
  }
  const taps = new Set(inputs);

  let state = ricoGame.init(seed);
  // Spikes: ascending, at least 90 px apart on a wall, never on both walls at
  // the same height.
  const lastOnWall = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const spike of state.spikes) {
    if (!Number.isInteger(spike.y) || !Number.isInteger(spike.wall)) {
      fail(`ricochet ${seed}: non-integer spike`);
    }
    const previous = lastOnWall[spike.wall] ?? 0;
    if (
      Number.isFinite(previous) &&
      spike.y - (previous + RICO_SPIKE_H_FP_4) < ricoMinGapFp(previous)
    ) {
      fail(`ricochet ${seed}: spikes too close on one wall`);
    }
    if (
      state.spikes.some(
        (other) =>
          other.wall !== spike.wall &&
          Math.abs(other.y - spike.y) < RICO_SPIKE_H_FP_4 + RICO_CROSS_GAP_FP,
      )
    ) {
      fail(`ricochet ${seed}: spikes face each other`);
    }
    lastOnWall[spike.wall] = spike.y;
  }

  if (!ricoShaftReachable(state.spikes)) fail(`ricochet ${seed}: shaft not climbable`);
  const checkpoints: RicoCheckpoint[] = [];
  let ticks = 0;
  for (let tick = 1; tick <= RICO_RUN_TICKS; tick++) {
    state = ricoGame.step(state, taps.has(tick));
    ticks = tick;
    if (state.tick % RICO_CHECKPOINT_INTERVAL === 0) checkpoints.push(ricoCheckpoint(state));
    if (!integers([state.tick, state.y, state.best, state.flight, state.fromY, state.toY])) {
      fail(`ricochet ${seed}: non-integer state at tick ${tick}`);
    }
    if (ricoGame.isOver(state)) break;
  }
  const claimed = ricoGame.score(state);
  const replayed = replayRicoRun(
    seed,
    encodeRicoRun({ seed, claimedScore: claimed, inputs, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`ricochet ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`ricochet ${seed}: honest run flagged (${replayed.reason})`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`ricochet ${seed}: final state differs`);
  }
  sameCheckpoints(checkpoints, replayed.checkpoints, `ricochet ${seed}`);
  if (replayed.desyncTick !== null) fail(`ricochet ${seed}: false desync`);

  const lied = replayRicoRun(seed, encodeRicoRun({ seed, claimedScore: 149, inputs }));
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`ricochet ${seed}: inflated claim not caught`);
  }
}

/* --------------------------- Lagged phones ----------------------------- */

{
  const events: ArcadeInputEvent[] = [];
  for (let tick = 10; tick <= 1500; tick += 40) {
    events.push({ t: tick, k: SNAKE_INPUT_TURN, a: tick % 4, b: 0, c: 0, d: 0 });
  }
  const cut = replaySnakeRun(
    4242,
    encodeSnakeRun({ seed: 4242, claimedScore: 0, events, endTick: 1500 }),
  );
  if (!cut.clientLag || cut.clientTick !== 1500) fail("snake client lag not flagged");
  if (cut.survived) fail("snake lagged run credited with survival");

  const taps: number[] = [];
  for (let tick = 8; tick <= 1500; tick += 20) taps.push(tick);
  const cut2 = replayRicoRun(
    4242,
    encodeRicoRun({ seed: 4242, claimedScore: 0, inputs: taps, endTick: 1500 }),
  );
  if (!cut2.clientLag || cut2.clientTick !== 1500) fail("ricochet client lag not flagged");
  if (cut2.survived) fail("ricochet lagged run credited with survival");
}

/* ------------------------ Out-of-range payloads ------------------------ */

{
  const bad = [
    {
      label: "snake turn 4",
      run: replaySnakeRun(
        99,
        encodeSnakeRun({
          seed: 99,
          claimedScore: 0,
          events: [{ t: 20, k: SNAKE_INPUT_TURN, a: 4, b: 0, c: 0, d: 0 }],
        }),
      ),
    },
    {
      label: "cross move 4",
      run: replayCrossRun(
        99,
        encodeCrossRun({
          seed: 99,
          claimedScore: 0,
          events: [{ t: 20, k: CROSS_INPUT_MOVE, a: 4, b: 0, c: 0, d: 0 }],
        }),
      ),
    },
    {
      label: "dual side 2",
      run: replayDualRun(
        99,
        encodeDualRun({
          seed: 99,
          claimedScore: 0,
          events: [{ t: 20, k: DUAL_INPUT_JUMP, a: 2, b: 0, c: 0, d: 0 }],
        }),
      ),
    },
    {
      label: "snake unknown kind",
      run: replaySnakeRun(
        99,
        encodeSnakeRun({
          seed: 99,
          claimedScore: 0,
          events: [{ t: 20, k: 9, a: 0, b: 0, c: 0, d: 0 }],
        }),
      ),
    },
  ];
  for (const item of bad) {
    if (!item.run.flagged || item.run.reason === undefined) {
      fail(`${item.label}: out-of-range payload accepted`);
    }
  }
}

console.log(
  failures === 0
    ? `four-game arcade checks passed: Snake, Cross, Dual and Ricochet client/server states, checkpoints and scores identical over ${SAMPLES} runs each; courses proved passable and payload ranges enforced`
    : `${failures} failures; first failing tick ${firstFailingTick ?? "unknown"}`,
);
