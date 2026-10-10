/**
 * Proof checks for Bin Toss and Bullseye:
 *  1. every value in each sim state stays an integer (no floats in physics)
 *  2. client and server final states/checkpoints match across 200 random logs
 *     with random aim vectors and random release points
 *  3. the server replay reproduces the score the phone would have claimed
 *  4. the declared input ranges reject out-of-range payloads, unknown kinds,
 *     ticks outside the run, ticks out of order, and oversized logs
 *  5. both games sit in the arcade category, are core and are not retired
 */

import {
  checkInputEvents,
  dragScale256,
  DRAG_FULL_PX,
  DRAG_MIN_PX,
  MAX_INPUT_EVENTS,
  type ArcadeInputEvent,
} from "../src/lib/arcade/engine.ts";
import {
  binTossBinCentre,
  binTossCheckpoint,
  binTossDrag,
  binTossGame,
  binTossHalf,
  binTossPredict,
  BINTOSS_BALL_R,
  BINTOSS_BALL_X,
  BINTOSS_RIM_INSET,
  BINTOSS_THROWS,
  BINTOSS_BIN_HALF,
  BINTOSS_WIND_MAX,
  BINTOSS_FIRST_DIST,
  BINTOSS_DIST_STEP,
  BINTOSS_AIM,
  BINTOSS_CHECKPOINT_INTERVAL,
  BINTOSS_INPUT_RANGES,
  BINTOSS_RUN_TICKS,
  BINTOSS_VX_MAX,
  BINTOSS_VY_MAX,
  type BinTossCheckpoint,
  type BinTossState,
} from "../src/lib/arcade/binToss.ts";
import {
  bullseyeCheckpoint,
  bullseyeDrag,
  bullseyeGame,
  bullseyeInit,
  bullseyeAimPoint,
  bullseyeLanding,
  bullseyeSway,
  bullseyeWindShiftPx,
  bullseyeWinds,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_ARROWS,
  BULLSEYE_CHECKPOINT_INTERVAL,
  BULLSEYE_INPUT_RANGES,
  BULLSEYE_RUN_TICKS,
  BULLSEYE_V_MAX,
  BULLSEYE_OUTER_R,
  BULLSEYE_SCALE_PCT,
  BULLSEYE_SWAY_PERIOD,
  type BullseyeCheckpoint,
  type BullseyeState,
} from "../src/lib/arcade/bullseye.ts";
import { encodeBinTossRun, replayBinTossRun } from "../src/lib/duel/binToss.ts";
import { encodeBullseyeRun, replayBullseyeRun } from "../src/lib/duel/bullseye.ts";
import { puzzleDef } from "../src/lib/duel/registry.ts";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};
let firstFailingTick: number | null = null;

const randomInt = (low: number, high: number) => low + Math.floor(Math.random() * (high - low + 1));

/**
 * A random aim vector: 10–260 px of drag (so some are under the 20 px cancel
 * distance, and some past full power) at any angle, including downward ones,
 * which the mapping clamps to horizontal.
 */
function randomDrag(): { dx: number; dy: number } {
  const length = randomInt(10, 260);
  const angle = (randomInt(0, 359) * Math.PI) / 180;
  return { dx: Math.cos(angle) * length, dy: Math.sin(angle) * length };
}

/** An aim vector of an exact length and angle, for the calibration checks. */
function dragAt(lengthPx: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return { dx: Math.cos(angle) * lengthPx, dy: -Math.sin(angle) * lengthPx };
}

/** The drag length that produces the reference launch (scale 256). */
const REFERENCE_DRAG_PX = (() => {
  for (let length = DRAG_MIN_PX; length <= DRAG_FULL_PX; length++) {
    if (dragScale256(length) === 256) return length;
  }
  return DRAG_FULL_PX;
})();

function binTossIntegers(state: BinTossState): boolean {
  const values = [
    state.tick,
    state.phase,
    state.throwIndex,
    state.resolved,
    state.baskets,
    state.x,
    state.y,
    state.vx,
    state.vy,
    state.readyTick,
    state.wobbleTick,
    ...state.winds,
    ...state.results,
  ];
  return values.every((value) => Number.isInteger(value));
}

function bullseyeIntegers(state: BullseyeState): boolean {
  const values = [state.tick, state.arrowIndex, state.total, state.flightTick, ...state.winds];
  for (const hit of state.hits) values.push(hit.x, hit.y, hit.ring, hit.value, hit.arrow);
  return values.every((value) => Number.isInteger(value));
}

/* ------------------------------ Bin Toss ------------------------------- */

for (let sample = 0; sample < 200; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  let state = binTossGame.init(seed);
  if (!binTossIntegers(state)) fail(`bintoss ${seed}: non-integer initial state`);

  const events: ArcadeInputEvent[] = [];
  const checkpoints: BinTossCheckpoint[] = [];
  let ticks = 0;
  // A plausible player: a random aim vector whenever a ball is ready.
  let waitFor = randomInt(0, 40);
  for (let tick = 1; tick <= BINTOSS_RUN_TICKS; tick++) {
    let input: ArcadeInputEvent | null = null;
    if (state.phase === BINTOSS_AIM) {
      if (waitFor > 0) waitFor -= 1;
      else {
        // A random drag, mapped through the game's own aim calibration.
        const drag = randomDrag();
        const launch = binTossDrag(drag.dx, drag.dy);
        if (launch) {
          input = { t: tick, k: 1, a: launch.vx, b: launch.vy, c: 0, d: 0 };
          waitFor = randomInt(0, 40);
        }
      }
    }
    const before = state;
    state = binTossGame.step(state, input);
    if (input && before.phase === BINTOSS_AIM && state.phase !== BINTOSS_AIM) events.push(input);
    if (!binTossIntegers(state)) fail(`bintoss ${seed}: non-integer state at tick ${tick}`);
    if (state.tick % BINTOSS_CHECKPOINT_INTERVAL === 0) checkpoints.push(binTossCheckpoint(state));
    ticks = tick;
    if (binTossGame.isOver(state)) break;
  }

  const claimed = binTossGame.score(state);
  const encoded = encodeBinTossRun({
    seed,
    claimedScore: claimed,
    events,
    endTick: state.tick,
    checkpoints,
  });
  const replay = replayBinTossRun(seed, encoded);

  if (replay.score !== claimed)
    fail(`bintoss ${seed}: replay ${replay.score} vs client ${claimed}`);
  if (replay.baskets !== state.baskets) fail(`bintoss ${seed}: baskets differ`);
  if (replay.flagged) fail(`bintoss ${seed}: flagged (${replay.reason ?? "no reason"})`);
  if (replay.desyncTick !== null) {
    fail(`bintoss ${seed}: desync at tick ${replay.desyncTick}`);
    if (firstFailingTick === null) firstFailingTick = replay.desyncTick;
  }
  if (replay.checkpoints.length !== checkpoints.length) fail(`bintoss ${seed}: checkpoint count`);
  for (let index = 0; index < checkpoints.length; index++) {
    if (replay.checkpoints[index]!.checksum !== checkpoints[index]!.checksum) {
      fail(`bintoss ${seed}: checkpoint ${checkpoints[index]!.tick} differs`);
    }
  }
  if (ticks < 1) fail(`bintoss ${seed}: run never advanced`);
}

/* ------------------------------ Bullseye ------------------------------- */

for (let sample = 0; sample < 200; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const storedWinds = bullseyeWinds(seed);
  let state = bullseyeInit(seed, storedWinds);
  if (!bullseyeIntegers(state)) fail(`bullseye ${seed}: non-integer initial state`);

  const events: ArcadeInputEvent[] = [];
  const checkpoints: BullseyeCheckpoint[] = [];
  let waitFor = randomInt(0, 30);
  for (let tick = 1; tick <= BULLSEYE_RUN_TICKS; tick++) {
    let input: ArcadeInputEvent | null = null;
    if (state.flightTick === 0 && state.arrowIndex < BULLSEYE_ARROWS) {
      if (waitFor > 0) waitFor -= 1;
      else {
        const drag = randomDrag();
        const launch = bullseyeDrag(drag.dx, drag.dy);
        if (launch) {
          input = { t: tick, k: 2, a: launch.vx, b: launch.vy, c: 0, d: 0 };
          waitFor = randomInt(0, 30);
        }
      }
    }
    const before = state;
    state = bullseyeGame.step(state, input);
    if (input && state.arrowIndex > before.arrowIndex) events.push(input);
    if (!bullseyeIntegers(state)) fail(`bullseye ${seed}: non-integer state at tick ${tick}`);
    if (state.tick % BULLSEYE_CHECKPOINT_INTERVAL === 0) {
      checkpoints.push(bullseyeCheckpoint(state));
    }
    if (bullseyeGame.isOver(state)) break;
  }

  const claimed = bullseyeGame.score(state);
  const encoded = encodeBullseyeRun({
    seed,
    claimedScore: claimed,
    events,
    endTick: state.tick,
    checkpoints,
  });
  const replay = replayBullseyeRun(seed, encoded, storedWinds);

  if (replay.score !== claimed) {
    fail(`bullseye ${seed}: replay ${replay.score} vs client ${claimed}`);
  }
  if (replay.total !== state.total) fail(`bullseye ${seed}: ring totals differ`);
  for (let index = 0; index < replay.hits.length; index++) {
    if (replay.hits[index]?.wind !== storedWinds[replay.hits[index]?.arrow ?? index]) {
      fail(`bullseye ${seed}: hit ${index + 1} did not retain its stored wind`);
    }
  }
  if (replay.flagged) fail(`bullseye ${seed}: flagged (${replay.reason ?? "no reason"})`);
  if (replay.desyncTick !== null) {
    fail(`bullseye ${seed}: desync at tick ${replay.desyncTick}`);
    if (firstFailingTick === null) firstFailingTick = replay.desyncTick;
  }
  for (let index = 0; index < checkpoints.length; index++) {
    if (replay.checkpoints[index]!.checksum !== checkpoints[index]!.checksum) {
      fail(`bullseye ${seed}: checkpoint ${checkpoints[index]!.tick} differs`);
    }
  }
  if (replay.score > 150 || replay.score < 0) fail(`bullseye ${seed}: score out of range`);
}

/* -------------------------- Range validation --------------------------- */

const rejected: [string, ArcadeInputEvent[], readonly typeof BINTOSS_INPUT_RANGES][] = [];
const bt = BINTOSS_INPUT_RANGES;
const be = BULLSEYE_INPUT_RANGES;

rejected.push([
  "flick vx above the clamp",
  [{ t: 10, k: 1, a: BINTOSS_VX_MAX + 1, b: -1000, c: 0, d: 0 }],
  bt,
]);
rejected.push([
  "flick vx below the clamp",
  [{ t: 10, k: 1, a: -BINTOSS_VX_MAX - 1, b: -1000, c: 0, d: 0 }],
  bt,
]);
rejected.push(["flick vy downwards", [{ t: 10, k: 1, a: 500, b: 1, c: 0, d: 0 }], bt]);
rejected.push([
  "flick vy above the clamp",
  [{ t: 10, k: 1, a: 500, b: -BINTOSS_VY_MAX - 1, c: 0, d: 0 }],
  bt,
]);
rejected.push(["flick with a payload in c", [{ t: 10, k: 1, a: 500, b: -1000, c: 3, d: 0 }], bt]);
rejected.push(["flick of an unknown kind", [{ t: 10, k: 7, a: 0, b: 0, c: 0, d: 0 }], bt]);
rejected.push(["flick before the run", [{ t: 0, k: 1, a: 500, b: -1000, c: 0, d: 0 }], bt]);
rejected.push([
  "flick after the run",
  [{ t: BINTOSS_RUN_TICKS + 1, k: 1, a: 500, b: -1000, c: 0, d: 0 }],
  bt,
]);
rejected.push([
  "flicks out of order",
  [
    { t: 400, k: 1, a: 500, b: -1000, c: 0, d: 0 },
    { t: 399, k: 1, a: 500, b: -1000, c: 0, d: 0 },
  ],
  bt,
]);
rejected.push(["non-integer flick", [{ t: 10, k: 1, a: 500.5, b: -1000, c: 0, d: 0 }], bt]);
rejected.push([
  "shot vx above the clamp",
  [{ t: 10, k: 2, a: BULLSEYE_V_MAX + 1, b: -1000, c: 0, d: 0 }],
  be,
]);
rejected.push([
  "shot vx below the clamp",
  [{ t: 10, k: 2, a: -BULLSEYE_V_MAX - 1, b: -1000, c: 0, d: 0 }],
  be,
]);
rejected.push(["shot vy downwards", [{ t: 10, k: 2, a: 100, b: 1, c: 0, d: 0 }], be]);
rejected.push([
  "shot vy above the clamp",
  [{ t: 10, k: 2, a: 100, b: -BULLSEYE_V_MAX - 1, c: 0, d: 0 }],
  be,
]);
rejected.push(["shot with a payload in d", [{ t: 10, k: 2, a: 100, b: -1000, c: 0, d: 5 }], be]);
rejected.push(["shot of an unknown kind", [{ t: 10, k: 1, a: 100, b: -100, c: 0, d: 0 }], be]);
rejected.push([
  "an oversized log",
  Array.from({ length: MAX_INPUT_EVENTS + 1 }, (_, index) => ({
    t: 1 + index,
    k: 2,
    a: 100,
    b: -1000,
    c: 0,
    d: 0,
  })),
  be,
]);

for (const [label, events, ranges] of rejected) {
  const runTicks = ranges === bt ? BINTOSS_RUN_TICKS : BULLSEYE_RUN_TICKS;
  const check = checkInputEvents(events, runTicks, ranges);
  if (check.ok) fail(`range validation accepted ${label}`);
}

// Two events on the same tick are allowed (non-decreasing, not increasing).
if (
  !checkInputEvents(
    [
      { t: 50, k: 2, a: 10, b: -10, c: 0, d: 0 },
      { t: 50, k: 2, a: 20, b: -20, c: 0, d: 0 },
    ],
    BULLSEYE_RUN_TICKS,
    be,
  ).ok
) {
  fail("range validation rejected two events on one tick");
}

// An out-of-range payload must also cost the player the run's score.
{
  const seed = 12_345;
  const cheated = encodeBinTossRun({
    seed,
    claimedScore: 100,
    events: [{ t: 10, k: 1, a: BINTOSS_VX_MAX * 4, b: -1000, c: 0, d: 0 }],
    endTick: BINTOSS_RUN_TICKS,
    checkpoints: [],
  });
  const replay = replayBinTossRun(seed, cheated);
  if (!replay.flagged) fail("an out-of-range flick was not flagged");
  if (replay.reason !== "input payload out of range") {
    fail(`unexpected reason: ${replay.reason ?? "none"}`);
  }
  if (replay.baskets !== 0 || replay.score !== 0) fail("an out-of-range flick still scored");
}

/* ---------------------------- Calibration ------------------------------ */

// Reference strength retains its historical integer launch and predicted
// landing; the October 4 distance increase did not change this input mapping.
{
  const drag = dragAt(REFERENCE_DRAG_PX, 60);
  const launch = binTossDrag(drag.dx, drag.dy);
  if (!launch) fail("the reference bin toss aim was ignored");
  else {
    const landing = binTossPredict(launch.vx, launch.vy, 0);
    if (launch.vx !== 585 || launch.vy !== -1012 || landing.x !== 202 || landing.y !== 432) {
      fail(`reference input calibration changed: velocity ${launch.vx},${launch.vy}; landing ${landing.x},${landing.y}`);
    }
  }
}

// Independently protect reachability of every current resting bin, including
// narrowed version-2 openings, without recalibrating the player's launch speed.
for (let index = 0; index < BINTOSS_THROWS; index++) {
  const centre = Math.round(binTossBinCentre(index) / 256);
  const tolerance = (binTossHalf(index, 2) - BINTOSS_RIM_INSET) / 256;
  let reachable = false;
  for (let length = DRAG_MIN_PX; length <= DRAG_FULL_PX; length++) {
    const drag = dragAt(length, 60);
    const launch = binTossDrag(drag.dx, drag.dy);
    if (!launch) continue;
    if (Math.abs(binTossPredict(launch.vx, launch.vy, 0).x - centre) <= tolerance) {
      reachable = true;
      break;
    }
  }
  if (!reachable) fail(`bin toss throw ${index + 1}: no legal 60-degree aim reaches the resting bin`);
}

// A reference-strength straight-up aim must land on the centre at arrow one.
{
  const drag = dragAt(REFERENCE_DRAG_PX, 90);
  const launch = bullseyeDrag(drag.dx, drag.dy);
  if (!launch) fail("the reference bullseye aim was ignored");
  else {
    const landing = bullseyeLanding(launch.vx, launch.vy);
    if (landing.x !== BULLSEYE_CX || landing.y !== BULLSEYE_CY) {
      fail(`reference shot landed at ${landing.x},${landing.y}`);
    }
  }
}

if (BINTOSS_FIRST_DIST !== 135 * 256 || BINTOSS_DIST_STEP !== 15 * 256 ||
    binTossBinCentre(BINTOSS_THROWS - 1) - BINTOSS_BALL_X !== 270 * 256) {
  fail("bin toss distances are not 135–270 px in 15 px steps");
}
if (BINTOSS_BIN_HALF !== 40 * 256) fail("bin toss opening is not 80 px");
if (BULLSEYE_OUTER_R !== 91) fail("bullseye outer radius is not 91 px");
if (BULLSEYE_SCALE_PCT.join(",") !== "100,96,92,88,84,80,77,74,71,68") {
  fail("bullseye shrink factors differ");
}

// One wind point must drift the ball a quarter of the bin opening (25 px) over
// the flight
// of a throw that lands on the bin, and the aim path must ignore the wind.
{
  const drag = dragAt(REFERENCE_DRAG_PX, 60);
  const launch = binTossDrag(drag.dx, drag.dy);
  if (!launch) fail("the reference bin toss aim was ignored");
  else {
    const still = binTossPredict(launch.vx, launch.vy, 0);
    for (let wind = -BINTOSS_WIND_MAX; wind <= BINTOSS_WIND_MAX; wind++) {
      const blown = binTossPredict(launch.vx, launch.vy, wind);
      const drift = blown.x - still.x;
      const expected = wind * 20;
      if (Math.abs(drift - expected) > 1) {
        fail(`wind ${wind} drifted ${drift} px, expected ${expected} px`);
      }
    }
  }
}

for (let seed = 1; seed <= 200; seed++) {
  const bin = binTossGame.init(seed);
  const expected = bullseyeWinds(seed);
  const bull = bullseyeInit(seed, expected);
  if (bin.winds.some((wind) => wind === 0 || wind < -4 || wind > 4)) fail(`bintoss ${seed}: wind out of range`);
  if (bull.winds.some((wind) => wind < -3 || wind > 3)) fail(`bullseye ${seed}: wind out of range`);
  if (bull.winds.join(",") !== expected.join(",")) fail(`bullseye ${seed}: stored winds differ`);
  for (let arrow = 0; arrow < BULLSEYE_ARROWS; arrow++) {
    const wind = bull.winds[arrow] ?? 0;
    const expectedShift = Math.round(
      (wind * BULLSEYE_OUTER_R * BULLSEYE_SCALE_PCT[arrow]!) / (6 * 100),
    );
    if (bullseyeWindShiftPx(arrow, wind) !== expectedShift) {
      fail(`bullseye ${seed}: arrow ${arrow + 1} wind shift differs`);
    }
  }
}

// The aim sway: one full circle every 120 ticks, radius 0.6 of a ring width at
// that arrow's scale, from the fixed table — no randomness, tick only.
for (let arrow = 0; arrow < BULLSEYE_ARROWS; arrow++) {
  const ringWidth = (BULLSEYE_OUTER_R * BULLSEYE_SCALE_PCT[arrow]!) / (6 * 100);
  const radius = 0.6 * ringWidth;
  for (let tick = 1; tick <= BULLSEYE_SWAY_PERIOD; tick++) {
    const sway = bullseyeSway(arrow, tick);
    if (!Number.isInteger(sway.dx) || !Number.isInteger(sway.dy)) {
      fail(`bullseye sway is not integer at arrow ${arrow + 1}, tick ${tick}`);
    }
    const length = Math.hypot(sway.dx, sway.dy);
    if (Math.abs(length - radius) > 1) {
      fail(`bullseye sway radius ${length.toFixed(2)} px, expected ${radius.toFixed(2)} px`);
    }
    const wrapped = bullseyeSway(arrow, tick + BULLSEYE_SWAY_PERIOD);
    if (wrapped.dx !== sway.dx || wrapped.dy !== sway.dy) {
      fail(`bullseye sway does not repeat every ${BULLSEYE_SWAY_PERIOD} ticks`);
    }
  }
  if (bullseyeSway(arrow, 30).dx === bullseyeSway(arrow, 0).dx) {
    fail("bullseye sway does not move with the tick");
  }
}

// The aim point carries the sway and never the wind.
{
  const drag = dragAt(REFERENCE_DRAG_PX, 90);
  const launch = bullseyeDrag(drag.dx, drag.dy)!;
  for (const tick of [1, 17, 44, 90, 119]) {
    const point = bullseyeAimPoint(0, tick, launch.vx, launch.vy);
    const sway = bullseyeSway(0, tick);
    if (point.x !== BULLSEYE_CX + sway.dx || point.y !== BULLSEYE_CY + sway.dy) {
      fail(`bullseye aim point ignored the sway at tick ${tick}`);
    }
  }
}

// Strength comes from the drag LENGTH: a longer drag always launches harder.
{
  let previous = 0;
  for (let length = DRAG_MIN_PX; length <= DRAG_FULL_PX; length += 10) {
    const drag = dragAt(length, 90);
    const launch = bullseyeDrag(drag.dx, drag.dy);
    if (!launch) {
      fail(`a ${length} px drag was ignored`);
      break;
    }
    const strength = Math.abs(launch.vy);
    if (strength < previous) fail(`a longer drag launched softer at ${length} px`);
    previous = strength;
  }
  // Past full power the launch stops growing, so the aim cannot be overdriven.
  const fullDrag = dragAt(DRAG_FULL_PX, 90);
  const beyondDrag = dragAt(400, 90);
  const full = bullseyeDrag(fullDrag.dx, fullDrag.dy)!;
  const beyond = bullseyeDrag(beyondDrag.dx, beyondDrag.dy)!;
  if (full.vy !== beyond.vy) fail("a drag past full power kept growing");
}

// Under the 20 px cancel distance nothing is thrown or shot.
{
  const drag = dragAt(15, 90);
  if (binTossDrag(drag.dx, drag.dy)) fail("a 15 px drag threw a ball");
  if (bullseyeDrag(drag.dx, drag.dy)) fail("a 15 px drag fired an arrow");
}

// A downward-pointing vector is clamped to horizontal.
{
  const drag = dragAt(120, -60);
  const launch = bullseyeDrag(drag.dx, drag.dy);
  if (!launch) fail("a downward drag was ignored");
  else if (launch.vy < -1) fail(`a downward drag still launched upwards (${launch.vy})`);
  const bin = binTossDrag(drag.dx, drag.dy);
  if (bin && bin.vy < -1) fail(`a downward bin toss drag still launched upwards (${bin.vy})`);
}

/* ----------------------------- Registration ---------------------------- */

for (const key of ["bintoss", "bullseye"] as const) {
  const def = puzzleDef(key);
  if (def.category !== "arcade") fail(`${key}: category is ${def.category}`);
  if (def.retired) fail(`${key}: retired`);
  if (def.revealMs !== 6_000) fail(`${key}: revealMs is ${def.revealMs}`);
  if (!def.instructions) fail(`${key}: no instructions`);
  if (!def.roundSummary) fail(`${key}: no standings summary`);
}

console.log(`first failing tick: ${firstFailingTick ?? "none"}`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
