/**
 * Checks for the arcade fixes: long input logs (the old 2,000-event cap made
 * the server replay with no inputs at all), the Breaker button, Dual's double
 * jump, Ricochet spacing and the shared par formula.
 *   bun run scripts/arcade-fixes-check.ts
 */
import { MAX_INPUT_EVENTS, parPoints, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  sliceCheckpoint,
  sliceGame,
  SLICE_CHECKPOINT_INTERVAL,
  SLICE_RUN_TICKS,
} from "@/lib/arcade/slice";
import { encodeSliceRun, replaySliceRun } from "@/lib/duel/slice";
import {
  brkCheckpoint,
  breakerGame,
  BRK_CHECKPOINT_INTERVAL,
  BRK_RUN_TICKS,
  brkDestroyed,
  BRK_POWER_SPAM,
} from "@/lib/arcade/breaker";
import { encodeBreakerRun, replayBreakerRun } from "@/lib/duel/breaker";
import { dualGame, DUAL_JUMP_TICKS } from "@/lib/arcade/dual";
import {
  ricoGame,
  RICO_BALL_R_FP,
  RICO_SPIKE_H_FP,
  ricoSlide,
  RICO_SLIDE_START_FP,
} from "@/lib/arcade/ricochet";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.error("FAIL", message);
};

let rng = 12345;
const rand = (n: number) => {
  rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
  return rng % n;
};

// 1. Slice: a swipe on every tick of the run — 3,600 events.
for (let run = 0; run < 20; run++) {
  const seed = 1 + rand(2_000_000_000);
  let state = sliceGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints = [];
  let x = rand(390);
  let y = rand(600);
  for (let t = 1; t <= SLICE_RUN_TICKS; t++) {
    const nx = rand(390);
    const ny = rand(600);
    const event = { t, k: 8, a: x, b: y, c: nx, d: ny };
    x = nx;
    y = ny;
    events.push(event);
    state = sliceGame.step(state, event);
    if (state.tick % SLICE_CHECKPOINT_INTERVAL === 0) checkpoints.push(sliceCheckpoint(state));
    if (sliceGame.isOver(state)) break;
  }
  const raw = encodeSliceRun({
    seed,
    claimedScore: sliceGame.score(state),
    events,
    endTick: state.tick,
    checkpoints,
  });
  const server = replaySliceRun(seed, raw);
  if (events.length <= 2000) fail("slice trace too short to exercise the cap");
  if (server.slices !== state.slices)
    fail(`slice ${seed}: HUD ${state.slices} vs server ${server.slices}`);
  if (server.flagged)
    fail(`slice ${seed}: flagged (${server.reason ?? "desync"} at ${server.desyncTick})`);
  if (run === 0) {
    console.log(
      `slice: ${events.length} events (cap ${MAX_INPUT_EVENTS}) — HUD ${state.slices}, server ${server.slices} / ${server.totalDiscs}`,
    );
  }
}

// 2. Breaker: a drag on almost every tick, then the button leaves the paddle alone.
for (let run = 0; run < 20; run++) {
  const seed = 1 + rand(2_000_000_000);
  let state = breakerGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints = [];
  for (let t = 1; t <= BRK_RUN_TICKS; t++) {
    // Follow the lowest ball roughly, so the run destroys bricks.
    const ball = (state as unknown as { balls?: { x: number }[] }).balls?.[0];
    const target = ball
      ? Math.max(0, Math.min(390, Math.trunc(ball.x / 256) + rand(9) - 4))
      : rand(390);
    const event = { t, k: 7, a: target, b: 0, c: 0, d: 0 };
    events.push(event);
    state = breakerGame.step(state, event);
    if (state.tick % BRK_CHECKPOINT_INTERVAL === 0) checkpoints.push(brkCheckpoint(state));
    if (breakerGame.isOver(state)) break;
  }
  const raw = encodeBreakerRun({
    seed,
    claimedScore: breakerGame.score(state),
    events,
    endTick: state.tick,
    checkpoints,
  });
  const server = replayBreakerRun(seed, raw);
  if (server.destroyed !== brkDestroyed(state))
    fail(`breaker ${seed}: HUD vs server bricks differ`);
  if (server.flagged) fail(`breaker ${seed}: flagged (${server.reason ?? "desync"})`);
  if (run === 0) {
    console.log(
      `breaker: ${events.length} events — HUD ${brkDestroyed(state)} bricks, server ${server.destroyed}`,
    );
  }
}
{
  let state = breakerGame.init(7);
  state = breakerGame.step(state, { t: 1, k: 7, a: 100, b: 0, c: 0, d: 0 });
  for (let i = 0; i < 60; i++) state = breakerGame.step(state, null);
  const before = { aim: state.aimX, paddle: state.paddleX };
  state = { ...state, held: BRK_POWER_SPAM, charges: 5 } as typeof state;
  state = breakerGame.step(state, { t: state.tick + 1, k: 10, a: 0, b: 0, c: 0, d: 0 });
  if (state.aimX !== before.aim || state.paddleX !== before.paddle) {
    fail("breaker: a button press moved the paddle");
  } else console.log("breaker: button press leaves the paddle where it is");
}

// 3. Dual double jump: one extra jump in the air, reset on landing.
{
  let state = dualGame.init(99);
  const tap = (t: number) => ({ t, k: 6, a: 0, b: 0, c: 0, d: 0 });
  state = dualGame.step(state, tap(1));
  for (let i = 0; i < 10; i++) state = dualGame.step(state, null);
  state = dualGame.step(state, tap(state.tick + 1));
  const extended = state.leftUntil;
  state = dualGame.step(state, tap(state.tick + 1));
  if (state.leftUntil !== extended) fail("dual: a third jump in the air was allowed");
  if (extended !== 12 + DUAL_JUMP_TICKS) fail(`dual: double jump airtime ${extended}`);
  while (state.tick < state.leftUntil) state = dualGame.step(state, null);
  state = dualGame.step(state, tap(state.tick + 1));
  if (state.leftDouble) fail("dual: double jump not reset on landing");
  console.log(`dual: double jump ok (${state.jumps} jumps)`);
}

// 4. Ricochet: 60 px of clear wall between spikes; slide keyed to height.
for (let run = 0; run < 200; run++) {
  const state = ricoGame.init(1 + rand(2_000_000_000));
  const last = [-1e9, -1e9];
  for (const spike of state.spikes) {
    const gap = spike.y - (last[spike.wall]! + RICO_SPIKE_H_FP);
    if (gap < 5 * RICO_BALL_R_FP) fail(`ricochet: edge gap ${gap / 256}px`);
    last[spike.wall] = spike.y;
  }
}
if (ricoSlide(599) !== RICO_SLIDE_START_FP || ricoSlide(600) <= RICO_SLIDE_START_FP) {
  fail("ricochet: slide does not step at 15 m");
}
console.log("ricochet: spike spacing and height-keyed slide ok");

// 5. Par: half of par scores about 55.
if (parPoints(14, 28) !== 55 || parPoints(28, 28) !== 110 || parPoints(40, 28) !== 110) {
  fail("par formula");
}

if (failures) {
  console.error(`${failures} failures`);
  process.exit(1);
}
console.log("arcade fix checks passed");
