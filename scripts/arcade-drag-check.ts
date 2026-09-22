/**
 * Proof checks for the three drag games — Breaker, Rally and Steady:
 *  1. every value in each sim state stays an integer (no floats in physics)
 *  2. client and server final states, checkpoints and scores match across 200
 *     random drag traces per game
 *  3. an inflated claimed score is caught
 *  4. a drag position outside the declared range is refused
 *  5. a lagged phone stops the replay at the tick it reached
 */

import {
  ARCADE_INPUT_BUTTON,
  ARCADE_INPUT_DRAG,
  checkInputEvents,
  MAX_INPUT_EVENTS,
  type ArcadeInputEvent,
} from "../src/lib/arcade/engine.ts";
import {
  brkCheckpoint,
  breakerGame,
  BRK_CHECKPOINT_INTERVAL,
  BRK_INPUT_RANGES,
  BRK_RUN_TICKS,
  BRK_WORLD_W,
  type BrkCheckpoint,
  type BrkState,
} from "../src/lib/arcade/breaker.ts";
import {
  rallyCheckpoint,
  rallyGame,
  RALLY_CHECKPOINT_INTERVAL,
  RALLY_RUN_TICKS,
  RALLY_WORLD_W,
  type RallyCheckpoint,
  type RallyState,
} from "../src/lib/arcade/rally.ts";
import {
  stdCheckpoint,
  steadyGame,
  STD_CHECKPOINT_INTERVAL,
  STD_RUN_TICKS,
  STD_WORLD_W,
  type StdCheckpoint,
  type StdState,
} from "../src/lib/arcade/steady.ts";
import { encodeBreakerRun, replayBreakerRun } from "../src/lib/duel/breaker.ts";
import { encodeRallyRun, replayRallyRun } from "../src/lib/duel/rally.ts";
import { encodeSteadyRun, replaySteadyRun } from "../src/lib/duel/steady.ts";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};
let firstFailingTick: number | null = null;

const SAMPLES = 200;

/** A plausible finger: a new position every few ticks, one event a tick at most. */
function dragTrace(runTicks: number, maxX: number, maxY: number | null): ArcadeInputEvent[] {
  const events: ArcadeInputEvent[] = [];
  let x = Math.floor(maxX / 2);
  let y = maxY === null ? 0 : Math.floor(maxY / 2);
  let tick = 1 + Math.floor(Math.random() * 10);
  while (tick <= runTicks && events.length < MAX_INPUT_EVENTS - 10) {
    x = Math.max(0, Math.min(maxX, x + Math.round((Math.random() - 0.5) * 60)));
    if (maxY !== null) y = Math.max(0, Math.min(maxY, y + Math.round((Math.random() - 0.5) * 50)));
    events.push({ t: tick, k: ARCADE_INPUT_DRAG, a: x, b: maxY === null ? 0 : y, c: 0, d: 0 });
    tick += 1 + Math.floor(Math.random() * 9);
  }
  return events;
}

/** Sprinkles power-up button presses through a drag trace, one event a tick. */
function withButtonPresses(events: ArcadeInputEvent[]): ArcadeInputEvent[] {
  const used = new Set(events.map((event) => event.t));
  const presses: ArcadeInputEvent[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const tick = 1 + Math.floor(Math.random() * (BRK_RUN_TICKS - 1));
    if (used.has(tick)) continue;
    used.add(tick);
    presses.push({
      t: tick,
      k: ARCADE_INPUT_BUTTON,
      a: Math.random() < 0.5 ? 0 : 1,
      b: 0,
      c: 0,
      d: 0,
    });
  }
  return [...events, ...presses].sort((left, right) => left.t - right.t);
}

function integers(values: readonly number[], label: string, tick: number): void {
  if (!values.every((value) => Number.isInteger(value))) {
    fail(`${label}: non-integer state at tick ${tick}`);
  }
}

function brkValues(state: BrkState): number[] {
  return [
    state.tick,
    state.speed,
    state.paddleX,
    state.aimX,
    state.hits,
    state.losses,
    state.powerUps,
    state.held,
    state.charges,
    state.beam,
    state.pause,
    ...state.bricks,
    ...state.gold,
    ...state.balls.flatMap((ball) => [ball.x, ball.y, ball.vx, ball.vy, ball.spam]),
    ...state.capsules.flatMap((capsule) => [capsule.x, capsule.y, capsule.kind]),
  ];
}

function rallyValues(state: RallyState): number[] {
  return [
    state.tick,
    state.x,
    state.y,
    state.vx,
    state.vy,
    state.speed,
    state.paddleX,
    state.aimX,
    state.hits,
    state.goldHits,
    state.rng,
    ...state.entries.flatMap((entry) => [entry.tick, entry.x, entry.vx, entry.vy]),
    ...state.golds.flatMap((ball) => [ball.x, ball.y, ball.vx, ball.vy]),
  ];
}

function stdValues(state: StdState): number[] {
  return [
    state.tick,
    state.dx,
    state.travelled,
    state.aimX,
    state.touches,
    state.sinceTouch,
    state.flash,
    ...state.path,
  ];
}

/* ------------------------------- Breaker -------------------------------- */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const events = withButtonPresses(dragTrace(BRK_RUN_TICKS, BRK_WORLD_W, null));
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = breakerGame.init(seed);
  const checkpoints: BrkCheckpoint[] = [];
  integers(brkValues(state), `breaker ${seed}`, 0);
  let ticks = 0;
  for (let tick = 1; tick <= BRK_RUN_TICKS; tick++) {
    state = breakerGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % BRK_CHECKPOINT_INTERVAL === 0) checkpoints.push(brkCheckpoint(state));
    integers(brkValues(state), `breaker ${seed}`, tick);
    if (breakerGame.isOver(state)) break;
  }
  const claimed = breakerGame.score(state);

  const replayed = replayBreakerRun(
    seed,
    encodeBreakerRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`breaker ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`breaker ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.hits !== state.hits) fail(`breaker ${seed}: hit count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`breaker ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`breaker ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`breaker ${seed}: false desync`);

  const lied = replayBreakerRun(
    seed,
    encodeBreakerRun({ seed, claimedScore: 149, events, endTick: ticks, checkpoints }),
  );
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`breaker ${seed}: inflated claim not caught`);
  }
}

/* -------------------------------- Rally --------------------------------- */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const events = dragTrace(RALLY_RUN_TICKS, RALLY_WORLD_W, null);
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = rallyGame.init(seed);
  const checkpoints: RallyCheckpoint[] = [];
  integers(rallyValues(state), `rally ${seed}`, 0);
  let ticks = 0;
  for (let tick = 1; tick <= RALLY_RUN_TICKS; tick++) {
    state = rallyGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % RALLY_CHECKPOINT_INTERVAL === 0) checkpoints.push(rallyCheckpoint(state));
    integers(rallyValues(state), `rally ${seed}`, tick);
    if (rallyGame.isOver(state)) break;
  }
  const claimed = rallyGame.score(state);

  const replayed = replayRallyRun(
    seed,
    encodeRallyRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`rally ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`rally ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.hits !== state.hits) fail(`rally ${seed}: rally count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`rally ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`rally ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`rally ${seed}: false desync`);

  const lied = replayRallyRun(
    seed,
    encodeRallyRun({ seed, claimedScore: 149, events, endTick: ticks, checkpoints }),
  );
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`rally ${seed}: inflated claim not caught`);
  }
}

/* -------------------------------- Steady -------------------------------- */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const events = dragTrace(STD_RUN_TICKS, STD_WORLD_W, null);
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = steadyGame.init(seed);
  const checkpoints: StdCheckpoint[] = [];
  integers(stdValues(state), `steady ${seed}`, 0);
  let ticks = 0;
  for (let tick = 1; tick <= STD_RUN_TICKS; tick++) {
    state = steadyGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % STD_CHECKPOINT_INTERVAL === 0) checkpoints.push(stdCheckpoint(state));
    if (tick % 137 === 0) integers(stdValues(state), `steady ${seed}`, tick);
    if (steadyGame.isOver(state)) break;
  }
  const claimed = steadyGame.score(state);

  const replayed = replaySteadyRun(
    seed,
    encodeSteadyRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`steady ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`steady ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.touches !== state.touches) fail(`steady ${seed}: touch count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`steady ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`steady ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`steady ${seed}: false desync`);

  const lied = replaySteadyRun(
    seed,
    encodeSteadyRun({ seed, claimedScore: 149, events, endTick: ticks, checkpoints }),
  );
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`steady ${seed}: inflated claim not caught`);
  }
}

/* ------------------------- Payload range checks -------------------------- */

{
  const outside: ArcadeInputEvent[] = [
    { t: 10, k: ARCADE_INPUT_DRAG, a: BRK_WORLD_W + 1, b: 0, c: 0, d: 0 },
  ];
  if (checkInputEvents(outside, BRK_RUN_TICKS, BRK_INPUT_RANGES).ok) {
    fail("breaker: an x beyond the board was accepted");
  }
  const withY: ArcadeInputEvent[] = [{ t: 10, k: ARCADE_INPUT_DRAG, a: 100, b: 5, c: 0, d: 0 }];
  if (checkInputEvents(withY, BRK_RUN_TICKS, BRK_INPUT_RANGES).ok) {
    fail("breaker: a y payload was accepted where none is declared");
  }
  const badKind: ArcadeInputEvent[] = [{ t: 10, k: 9, a: 0, b: 0, c: 0, d: 0 }];
  if (checkInputEvents(badKind, BRK_RUN_TICKS, BRK_INPUT_RANGES).ok) {
    fail("breaker: an unknown input kind was accepted");
  }

  const seed = 555_555;
  const events = dragTrace(BRK_RUN_TICKS, BRK_WORLD_W, null);
  const refused = replayBreakerRun(
    seed,
    encodeBreakerRun({
      seed,
      claimedScore: 100,
      events: [...events, { t: BRK_RUN_TICKS, k: ARCADE_INPUT_DRAG, a: -4, b: 0, c: 0, d: 0 }],
    }),
  );
  if (!refused.flagged || refused.reason !== "input payload out of range") {
    fail("breaker: an out-of-range drag was not refused");
  }
}

/* --------------------------- Lagged phones ----------------------------- */

{
  const seed = 4242;
  const cut = replayRallyRun(
    seed,
    encodeRallyRun({
      seed,
      claimedScore: 0,
      events: dragTrace(1500, RALLY_WORLD_W, null),
      endTick: 1500,
    }),
  );
  if (!cut.clientLag || cut.clientTick !== 1500) fail("rally client lag not flagged");
  if (cut.survived) fail("rally lagged run credited with survival");

  const steadyCut = replaySteadyRun(
    seed,
    encodeSteadyRun({
      seed,
      claimedScore: 0,
      events: dragTrace(1500, STD_WORLD_W, null),
      endTick: 1500,
    }),
  );
  if (!steadyCut.clientLag || steadyCut.clientTick !== 1500) fail("steady client lag not flagged");
  if (steadyCut.clean) fail("steady lagged run credited with a clean minute");
}

console.log(
  failures === 0
    ? `drag arcade checks passed: Breaker, Rally and Steady client/server states, checkpoints and scores identical over ${SAMPLES} random drag traces each; payload ranges enforced`
    : `${failures} failures; first failing tick ${firstFailingTick ?? "unknown"}`,
);
