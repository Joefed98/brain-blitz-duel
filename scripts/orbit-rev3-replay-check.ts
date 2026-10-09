/**
 * Rev3 end-to-end replay check: for 5 seeds, build+prove a course, record a
 * real bot's tap log the way ArcadeCanvasStage/encodeOrbitRun does, replay it
 * through replayOrbitRun(seed, raw, 3, planets) and assert the server replay's
 * end state (score/extra fields) matches the client-side sim run to the same
 * taps.
 *   bun run scripts/orbit-rev3-replay-check.ts
 */
import { strict as assert } from "node:assert";
import {
  buildCourse3,
  runRev3BotWithTaps,
  orbitRev3Game,
  orbitRev3Extra,
  initRev3From,
  encodeRev3Planets,
  decodeRev3Planets,
  ORBIT_REV3_WORLD_W,
} from "../src/lib/arcade/orbitRev3";
import { orbitCheckpoint, ORBIT_CHECKPOINT_INTERVAL, ORBIT_CHECKPOINT_KEYS, ORBIT_REV3, ORBIT_INPUT_TAP, type OrbitState, type OrbitCheckpoint } from "../src/lib/arcade/orbit";
import { recordInput, inputAt, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";

const started = Date.now();
const seeds = [1, 2, 3, 4, 5];
let checked = 0;

for (const seed of seeds) {
  const { planets, proof } = buildCourse3(seed, ORBIT_REV3_WORLD_W);
  assert.equal(proof.ok, true, `seed ${seed} course must be provable`);

  const { proof: botProof, taps } = runRev3BotWithTaps(planets, ORBIT_REV3_WORLD_W);
  assert.equal(botProof.ok, true, `seed ${seed} bot must finish the run`);
  assert(taps.length > 0, `seed ${seed} bot should tap at least once`);

  // Build the run string exactly like the client: an input log recorded tick
  // by tick (ArcadeCanvasStage calls recordInput per tap) plus periodic
  // checkpoints, then simulate the client-side state via orbitRev3Game.step.
  const tapTicks = new Set(taps);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: OrbitCheckpoint[] = [];
  // Mirror the real client (src/puzzles/orbit.tsx): once planets are stamped
  // (via encodeRev3Planets/decodeRev3Planets), the client inits straight from
  // them with initRev3From, never re-running buildCourse3/orbitRev3Game.init.
  let state = initRev3From(decodeRev3Planets(encodeRev3Planets(planets)), ORBIT_REV3_WORLD_W);

  while (!orbitRev3Game.isOver(state)) {
    const tick = state.tick + 1;
    if (tapTicks.has(tick)) {
      recordInput(events, { t: tick, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }, orbitRev3Game.inputRanges);
    }
    state = orbitRev3Game.step(state, inputAt(events, tick));
    if (state.tick % ORBIT_CHECKPOINT_INTERVAL === 0) {
      checkpoints.push(orbitCheckpoint(state as unknown as OrbitState));
    }
  }
  assert(state.cur >= 40 || state.finished === 1, `seed ${seed} client sim must finish`);

  const claimedScore = orbitRev3Game.score(state);
  const raw = encodeOrbitRun({ seed, events, checkpoints, endTick: state.tick, claimedScore });
  const result = replayOrbitRun(seed, raw, ORBIT_REV3, encodeRev3Planets(planets));

  assert.equal(result.flagged, false, `seed ${seed} must not be flagged: ${result.reason ?? ""}`);
  assert.equal(result.desyncTick, null, `seed ${seed} must not desync`);
  assert.equal(result.score, claimedScore, `seed ${seed} score mismatch`);
  assert.deepEqual(result.state, state, `seed ${seed} end state mismatch`);
  const clientExtra = orbitRev3Extra(state);
  const serverExtra = orbitRev3Extra(result.state as any);
  assert.deepEqual(serverExtra, clientExtra, `seed ${seed} extra mismatch`);
  // Also cross-check against the FlatReplay's own merged extra fields.
  for (const key of Object.keys(clientExtra) as (keyof typeof clientExtra)[]) {
    assert.equal((result as any)[key], clientExtra[key], `seed ${seed} result.${key} mismatch`);
  }
  checked++;
  console.log(`seed ${seed}: taps=${taps.length} score=${result.score} cur=${state.cur} finished=${state.finished} ticks=${state.tick}`);
}

const ms = Date.now() - started;
console.log(`Orbit rev3 replay check: ${checked}/${seeds.length} seeds matched client/server end state. ${ms}ms`);
assert(ms < 300_000, "must finish under 300s");
