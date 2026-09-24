/**
 * Proof checks for the arcade engine and Hover:
 *  1. every value in the sim state stays an integer (no floats in physics)
 *  2. the same seed and tap list always replay to the same score
 *  3. the server replay reproduces the score the phone would have claimed
 *  4. client and server final states/checkpoints match across 200 random logs
 *  5. malformed tap logs are rejected
 */

import { checkInputLog, replayArcadeRun, TICKS_PER_SECOND } from "../src/lib/arcade/engine.ts";
import {
  hoverCheckpoint,
  hoverGame,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_RUN_TICKS,
  type HoverCheckpoint,
  type HoverState,
} from "../src/lib/arcade/hover.ts";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover.ts";

function integers(state: HoverState): boolean {
  const values = [state.tick, state.y, state.vy, state.distance, state.gates, state.totalGates];
  for (const pillar of state.pillars) values.push(pillar.x0, pillar.gapTop, pillar.gapH);
  return values.every((value) => Number.isInteger(value));
}

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};

let firstFailingTick: number | null = null;

for (let sample = 0; sample < 200; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  // A plausible player: tap every 14–22 ticks (outside the sim, as a phone would).
  const inputs: number[] = [];
  for (let tick = 10; tick <= HOVER_RUN_TICKS; tick += 14 + Math.floor(Math.random() * 9)) {
    inputs.push(tick);
  }

  // Play it the way the client does, tick by tick, checking the state stays integral.
  const taps = new Set(inputs);
  let state = hoverGame.init(seed);
  const checkpoints: HoverCheckpoint[] = [];
  if (!integers(state)) fail(`seed ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
    state = hoverGame.step(state, taps.has(tick));
    ticks = tick;
    if (state.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(state));
    if (!integers(state)) fail(`seed ${seed}: non-integer state at tick ${tick}`);
    if (hoverGame.isOver(state)) break;
  }
  const claimed = hoverGame.score(state);

  // The server path: replay the encoded log from the stored seed.
  const replayed = replayHoverRun(
    seed,
    encodeHoverRun({ seed, claimedScore: claimed, inputs, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) {
    fail(`seed ${seed}: replay ${replayed.score} vs claim ${claimed}`);
  }
  if (replayed.flagged) fail(`seed ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.gates !== state.gates) fail(`seed ${seed}: gate count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`seed ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const mismatchIndex = checkpoints.findIndex(
      (checkpoint, index) => checkpoint.checksum !== replayed.checkpoints[index]?.checksum,
    );
    firstFailingTick =
      checkpoints[mismatchIndex]?.tick ?? replayed.checkpoints[mismatchIndex]?.tick ?? 0;
    fail(`seed ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`seed ${seed}: false desync at ${replayed.desyncTick}`);
  if (replayed.endedSeconds !== Math.round((ticks / TICKS_PER_SECOND) * 10) / 10) {
    fail(`seed ${seed}: end time differs`);
  }

  // Determinism: a second replay of the same inputs gives the same result.
  const again = replayArcadeRun(hoverGame, seed, inputs);
  if (again.score !== claimed) fail(`seed ${seed}: not deterministic`);

  // A lie about the score is caught and the replayed score is kept.
  const lied = replayHoverRun(seed, encodeHoverRun({ seed, claimedScore: 150, inputs }));
  if (claimed !== 150 && (!lied.flagged || lied.score !== claimed)) {
    fail(`seed ${seed}: inflated claim not caught`);
  }
}

// A phone that lagged: the run is cut at its tick, with no crash invented after
// its last tap and no survival bonus.
{
  const seed = 987_654;
  const inputs: number[] = [];
  for (let tick = 10; tick <= 2000; tick += 16) inputs.push(tick);
  const cut = replayHoverRun(
    seed,
    encodeHoverRun({ seed, claimedScore: 0, inputs, endTick: 2000 }),
  );
  if (cut.endedSeconds > 2000 / TICKS_PER_SECOND) fail("lagged run ran past the client tick");
  if (!cut.clientLag || cut.clientTick !== 2000) fail("client lag not flagged");
  if (cut.survived) fail("lagged run credited with survival");
}

// A changed client state is located at the first affected checkpoint.
{
  const seed = 123_456;
  const inputs = Array.from({ length: 180 }, (_, index) => 10 + index * 17).filter(
    (tick) => tick <= HOVER_RUN_TICKS,
  );
  const taps = new Set(inputs);
  const checkpoints: HoverCheckpoint[] = [];
  let state = hoverGame.init(seed);
  for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
    state = hoverGame.step(state, taps.has(tick));
    if (state.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(state));
    if (hoverGame.isOver(state)) break;
  }
  const altered = checkpoints.map((checkpoint, index) =>
    index === 0 ? { ...checkpoint, checksum: (checkpoint.checksum ^ 1) >>> 0 } : checkpoint,
  );
  const checked = replayHoverRun(
    seed,
    encodeHoverRun({
      seed,
      claimedScore: hoverGame.score(state),
      inputs,
      endTick: state.tick,
      checkpoints: altered,
    }),
  );
  const expected = checkpoints[0]?.tick ?? null;
  if (checked.desyncTick !== expected) fail("first changed checkpoint was not detected");
}

// Log validation.
if (checkInputLog([5, 5], HOVER_RUN_TICKS).ok) fail("repeated tick accepted");
if (checkInputLog([9, 4], HOVER_RUN_TICKS).ok) fail("decreasing ticks accepted");
if (checkInputLog([HOVER_RUN_TICKS + 1], HOVER_RUN_TICKS).ok) fail("tick past the run accepted");
if (
  checkInputLog(
    Array.from({ length: 6001 }, (_, i) => i + 1),
    HOVER_RUN_TICKS,
  ).ok
) {
  fail("over-long log accepted");
}

console.log(
  failures === 0
    ? "hover checks passed: 200 client/server paths and checkpoints identical"
    : `${failures} failures; first failing tick ${firstFailingTick ?? "unknown"}`,
);
