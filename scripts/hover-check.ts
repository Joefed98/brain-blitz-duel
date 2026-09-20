/**
 * Proof checks for the arcade engine and Hover:
 *  1. every value in the sim state stays an integer (no floats in physics)
 *  2. the same seed and tap list always replay to the same score
 *  3. the server replay reproduces the score the phone would have claimed
 *  4. malformed tap logs are rejected
 */

import { checkInputLog, replayArcadeRun, TICKS_PER_SECOND } from "../src/lib/arcade/engine.ts";
import { hoverGame, HOVER_RUN_TICKS, type HoverState } from "../src/lib/arcade/hover.ts";
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

for (let sample = 0; sample < 40; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  // A plausible player: tap every 14–22 ticks (outside the sim, as a phone would).
  const inputs: number[] = [];
  for (let tick = 10; tick <= HOVER_RUN_TICKS; tick += 14 + Math.floor(Math.random() * 9)) {
    inputs.push(tick);
  }

  // Play it the way the client does, tick by tick, checking the state stays integral.
  const taps = new Set(inputs);
  let state = hoverGame.init(seed);
  if (!integers(state)) fail(`seed ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
    state = hoverGame.step(state, taps.has(tick));
    ticks = tick;
    if (!integers(state)) fail(`seed ${seed}: non-integer state at tick ${tick}`);
    if (hoverGame.isOver(state)) break;
  }
  const claimed = hoverGame.score(state);

  // The server path: replay the encoded log from the stored seed.
  const replayed = replayHoverRun(seed, encodeHoverRun({ seed, claimedScore: claimed, inputs }));
  if (replayed.score !== claimed) {
    fail(`seed ${seed}: replay ${replayed.score} vs claim ${claimed}`);
  }
  if (replayed.flagged) fail(`seed ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.gates !== state.gates) fail(`seed ${seed}: gate count differs`);
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

// Log validation.
if (checkInputLog([5, 5], HOVER_RUN_TICKS).ok) fail("repeated tick accepted");
if (checkInputLog([9, 4], HOVER_RUN_TICKS).ok) fail("decreasing ticks accepted");
if (checkInputLog([HOVER_RUN_TICKS + 1], HOVER_RUN_TICKS).ok) fail("tick past the run accepted");
if (
  checkInputLog(
    Array.from({ length: 2001 }, (_, i) => i + 1),
    HOVER_RUN_TICKS,
  ).ok
) {
  fail("over-long log accepted");
}

console.log(failures === 0 ? "hover checks passed" : `${failures} failures`);
