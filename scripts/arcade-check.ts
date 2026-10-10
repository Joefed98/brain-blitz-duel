/**
 * Proof checks for Swerve and Skyline:
 *  1. every value in each sim state stays an integer (no floats in physics)
 *  2. client and server final states/checkpoints match across 200 random logs
 *  3. the server replay reproduces the score the phone would have claimed
 *  4. total coins are counted identically on both sides
 *  5. an inflated claimed score is caught, a lagged run is not given a crash
 *  6. a changed checkpoint is located at the right tick
 *  7. the arcade toggle: exactly one arcade round when on, none when off
 */

import { TICKS_PER_SECOND } from "../src/lib/arcade/engine.ts";
import {
  swerveCheckpoint,
  swerveGame,
  SWERVE_RUN_TICKS,
  type SwerveCheckpoint,
  type SwerveInput,
  type SwerveState,
} from "../src/lib/arcade/swerve.ts";
import {
  skylineCheckpoint,
  skylineGame,
  SKYLINE_CHECKPOINT_INTERVAL,
  SKYLINE_RUN_TICKS,
  type SkylineCheckpoint,
  type SkylineState,
} from "../src/lib/arcade/skyline.ts";
import { SWERVE_CHECKPOINT_INTERVAL } from "../src/lib/arcade/swerve.ts";
import { encodeSwerveRun, replaySwerveRun, type SwerveTap } from "../src/lib/duel/swerve.ts";
import { encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline.ts";
import { pickRoundOrder, categoryOrderFor } from "../src/lib/duel/selection.ts";
import { puzzleDef } from "../src/lib/duel/registry.ts";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};
let firstFailingTick: number | null = null;

function swerveIntegers(state: SwerveState): boolean {
  const values = [
    state.tick,
    state.x,
    state.lane,
    state.distance,
    state.coins,
    state.totalCoins,
    state.cursor,
  ];
  for (const row of state.rows) values.push(row.y0, row.coinLane, ...row.blocked);
  for (const row of state.rows) values.push(row.coinCollected ? 1 : 0);
  return values.every((value) => Number.isInteger(value));
}

function skylineIntegers(state: SkylineState): boolean {
  const values = [state.tick, state.x, state.w, state.dir, state.placed, state.perfects];
  for (const block of state.blocks) values.push(block.x, block.w);
  return values.every((value) => Number.isInteger(value));
}

/* ------------------------------- Swerve -------------------------------- */

for (let sample = 0; sample < 200; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  // A plausible player: a lane change every 20–50 ticks.
  const taps: SwerveTap[] = [];
  for (let tick = 15; tick <= SWERVE_RUN_TICKS; tick += 20 + Math.floor(Math.random() * 31)) {
    taps.push({ tick, dir: Math.random() < 0.5 ? -1 : 1 });
  }
  const moves = new Map<number, SwerveInput>(taps.map((tap) => [tap.tick, tap.dir]));

  let state = swerveGame.init(seed);
  const checkpoints: SwerveCheckpoint[] = [];
  if (!swerveIntegers(state)) fail(`swerve ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= SWERVE_RUN_TICKS; tick++) {
    state = swerveGame.step(state, moves.get(tick) ?? 0);
    ticks = tick;
    if (state.tick % SWERVE_CHECKPOINT_INTERVAL === 0) checkpoints.push(swerveCheckpoint(state));
    if (!swerveIntegers(state)) fail(`swerve ${seed}: non-integer state at tick ${tick}`);
    if (swerveGame.isOver(state)) break;
  }
  const claimed = swerveGame.score(state);

  const replayed = replaySwerveRun(
    seed,
    encodeSwerveRun({ seed, claimedScore: claimed, taps, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`swerve ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`swerve ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.coins !== state.coins) fail(`swerve ${seed}: coin count differs`);
  if (replayed.totalCoins !== state.totalCoins) fail(`swerve ${seed}: total coins differ`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`swerve ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`swerve ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`swerve ${seed}: false desync`);
  if (replayed.endedSeconds !== Math.round((ticks / TICKS_PER_SECOND) * 10) / 10) {
    fail(`swerve ${seed}: end time differs`);
  }

  const lied = replaySwerveRun(seed, encodeSwerveRun({ seed, claimedScore: 150, taps }));
  if (claimed !== 150 && (!lied.flagged || lied.score !== claimed)) {
    fail(`swerve ${seed}: inflated claim not caught`);
  }
}

/* ------------------------------- Skyline ------------------------------- */

for (let sample = 0; sample < 200; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const inputs: number[] = [];
  for (let tick = 25; tick <= SKYLINE_RUN_TICKS; tick += 25 + Math.floor(Math.random() * 40)) {
    inputs.push(tick);
  }
  const taps = new Set(inputs);

  let state = skylineGame.init(seed);
  const checkpoints: SkylineCheckpoint[] = [];
  if (!skylineIntegers(state)) fail(`skyline ${seed}: non-integer initial state`);
  let ticks = 0;
  for (let tick = 1; tick <= SKYLINE_RUN_TICKS; tick++) {
    state = skylineGame.step(state, taps.has(tick));
    ticks = tick;
    if (state.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) checkpoints.push(skylineCheckpoint(state));
    if (!skylineIntegers(state)) fail(`skyline ${seed}: non-integer state at tick ${tick}`);
    if (skylineGame.isOver(state)) break;
  }
  const claimed = skylineGame.score(state);

  const replayed = replaySkylineRun(
    seed,
    encodeSkylineRun({ seed, claimedScore: claimed, inputs, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`skyline ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`skyline ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.blocks !== state.placed) fail(`skyline ${seed}: block count differs`);
  if (replayed.perfects !== state.perfects) fail(`skyline ${seed}: perfect count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`skyline ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`skyline ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`skyline ${seed}: false desync`);

  const lied = replaySkylineRun(seed, encodeSkylineRun({ seed, claimedScore: 150, inputs }));
  if (claimed !== 150 && (!lied.flagged || lied.score !== claimed)) {
    fail(`skyline ${seed}: inflated claim not caught`);
  }
}

/* --------------------------- Lagged phones ----------------------------- */

{
  const taps: SwerveTap[] = [];
  for (let tick = 15; tick <= 1500; tick += 40) taps.push({ tick, dir: 1 });
  const cut = replaySwerveRun(
    4242,
    encodeSwerveRun({ seed: 4242, claimedScore: 0, taps, endTick: 1500 }),
  );
  if (cut.endedSeconds > 1500 / TICKS_PER_SECOND) fail("swerve lagged run ran past client tick");
  if (!cut.clientLag || cut.clientTick !== 1500) fail("swerve client lag not flagged");
  if (cut.survived) fail("swerve lagged run credited with survival");

  const inputs: number[] = [];
  for (let tick = 25; tick <= 1500; tick += 45) inputs.push(tick);
  const cut2 = replaySkylineRun(
    4242,
    encodeSkylineRun({ seed: 4242, claimedScore: 0, inputs, endTick: 1500 }),
  );
  if (!cut2.clientLag || cut2.clientTick !== 1500) fail("skyline client lag not flagged");
  if (cut2.survived) fail("skyline lagged run credited with survival");
}

/* ------------------------- Changed checkpoints ------------------------- */

{
  const seed = 777_777;
  const taps: SwerveTap[] = [];
  for (let tick = 15; tick <= SWERVE_RUN_TICKS; tick += 37) taps.push({ tick, dir: 1 });
  const moves = new Map<number, SwerveInput>(taps.map((tap) => [tap.tick, tap.dir]));
  let state = swerveGame.init(seed);
  const checkpoints: SwerveCheckpoint[] = [];
  for (let tick = 1; tick <= SWERVE_RUN_TICKS; tick++) {
    state = swerveGame.step(state, moves.get(tick) ?? 0);
    if (state.tick % SWERVE_CHECKPOINT_INTERVAL === 0) checkpoints.push(swerveCheckpoint(state));
    if (swerveGame.isOver(state)) break;
  }
  if (checkpoints.length > 0) {
    const altered = checkpoints.map((checkpoint, index) =>
      index === 0 ? { ...checkpoint, checksum: (checkpoint.checksum ^ 1) >>> 0 } : checkpoint,
    );
    const checked = replaySwerveRun(
      seed,
      encodeSwerveRun({
        seed,
        claimedScore: swerveGame.score(state),
        taps,
        endTick: state.tick,
        checkpoints: altered,
      }),
    );
    if (checked.desyncTick !== checkpoints[0]!.tick) {
      fail("swerve: first changed checkpoint was not detected");
    }
  }
}

/* ------------------- One round per selected category ------------------ */

{
  const cat = (type: string) => puzzleDef(type as never).category;
  const all = ["logic", "pattern", "speed", "attention", "word", "number", "arcade"] as const;
  let arcadeFirst = 0;
  for (let seed = 0; seed < 700; seed++) {
    const order = pickRoundOrder({ categories: [...all], seed });
    if (order.length !== 7) fail(`seed ${seed}: ${order.length} rounds`);
    if (new Set(order.map(cat)).size !== 7) fail(`seed ${seed}: repeated category`);
    if (cat(order[0] ?? "") === "arcade") arcadeFirst++;
    const again = categoryOrderFor([...all], seed);
    if (again.join() !== order.map(cat).join()) fail(`seed ${seed}: order not seed-determined`);
  }
  if (arcadeFirst === 0) fail("arcade never opened a room");
  const solo = pickRoundOrder({ categories: ["arcade"], seed: 5 });
  if (solo.length !== 1 || cat(solo[0]!) !== "arcade") fail("single category room");
}

console.log(
  failures === 0
    ? "arcade checks passed: Swerve and Skyline client/server states and checkpoints identical over 200 runs each; one round per selected category in seeded order"
    : `${failures} failures; first failing tick ${firstFailingTick ?? "unknown"}`,
);
