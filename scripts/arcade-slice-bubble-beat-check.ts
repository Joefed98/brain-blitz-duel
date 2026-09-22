/**
 * Proof checks for Slice, Bubble Pop and Beat:
 *  1. every value in each sim state stays an integer (no floats in physics)
 *  2. client and server final states, checkpoints and scores match across 200
 *     random swipe traces, aim vectors and tap patterns per game
 *  3. an inflated claimed score is caught
 *  4. a payload outside the declared range is refused
 *  5. a lagged phone stops the replay at the tick it reached
 */

import {
  checkInputEvents,
  MAX_INPUT_EVENTS,
  type ArcadeInputEvent,
} from "../src/lib/arcade/engine.ts";
import {
  sliceCheckpoint,
  sliceGame,
  SLICE_CHECKPOINT_INTERVAL,
  SLICE_INPUT_RANGES,
  SLICE_INPUT_SWIPE,
  SLICE_RUN_TICKS,
  SLICE_WORLD_H,
  SLICE_WORLD_W,
  type SliceCheckpoint,
  type SliceState,
} from "../src/lib/arcade/slice.ts";
import {
  bubCheckpoint,
  bubbleGame,
  BUB_CHECKPOINT_INTERVAL,
  BUB_INPUT_RANGES,
  BUB_INPUT_SHOT,
  BUB_RUN_TICKS,
  BUB_V_MAX,
  type BubCheckpoint,
  type BubState,
} from "../src/lib/arcade/bubble.ts";
import {
  beatCheckpoint,
  beatGame,
  BEAT_CHECKPOINT_INTERVAL,
  BEAT_INPUT_RANGES,
  BEAT_INPUT_TAP,
  BEAT_LANES,
  BEAT_RUN_TICKS,
  type BeatCheckpoint,
  type BeatState,
} from "../src/lib/arcade/beat.ts";
import { encodeSliceRun, replaySliceRun } from "../src/lib/duel/slice.ts";
import { encodeBubbleRun, replayBubbleRun } from "../src/lib/duel/bubble.ts";
import { encodeBeatRun, replayBeatRun } from "../src/lib/duel/beat.ts";

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.log("FAIL", message);
};
let firstFailingTick: number | null = null;

const SAMPLES = 200;
const randomInt = (max: number) => Math.floor(Math.random() * (max + 1));

function integers(values: readonly number[], label: string, tick: number): void {
  if (!values.every((value) => Number.isInteger(value))) {
    fail(`${label}: non-integer state at tick ${tick}`);
  }
}

/** A plausible swiping finger: runs of segments, one event a tick at most. */
function swipeTrace(): ArcadeInputEvent[] {
  const events: ArcadeInputEvent[] = [];
  let tick = 1 + randomInt(20);
  while (tick <= SLICE_RUN_TICKS && events.length < MAX_INPUT_EVENTS - 10) {
    let x = randomInt(SLICE_WORLD_W);
    let y = randomInt(SLICE_WORLD_H);
    const length = 2 + randomInt(10);
    for (let step = 0; step < length && tick <= SLICE_RUN_TICKS; step++) {
      const nx = Math.max(0, Math.min(SLICE_WORLD_W, x + Math.round((Math.random() - 0.5) * 80)));
      const ny = Math.max(0, Math.min(SLICE_WORLD_H, y + Math.round((Math.random() - 0.5) * 80)));
      events.push({ t: tick, k: SLICE_INPUT_SWIPE, a: x, b: y, c: nx, d: ny });
      x = nx;
      y = ny;
      tick += 1;
    }
    tick += 5 + randomInt(30);
  }
  return events;
}

/** Random upward aim vectors, released whenever the previous shot has landed. */
function shotTrace(): ArcadeInputEvent[] {
  const events: ArcadeInputEvent[] = [];
  let tick = 1 + randomInt(20);
  while (tick <= BUB_RUN_TICKS && events.length < MAX_INPUT_EVENTS - 10) {
    const vx = Math.round((Math.random() - 0.5) * 2 * 1200);
    const vy = -(400 + randomInt(1200));
    events.push({ t: tick, k: BUB_INPUT_SHOT, a: vx, b: vy, c: 0, d: 0 });
    tick += 20 + randomInt(60);
  }
  return events;
}

/** Taps across the four lanes, sometimes on time and sometimes stray. */
function tapTrace(): ArcadeInputEvent[] {
  const events: ArcadeInputEvent[] = [];
  let tick = 1 + randomInt(30);
  while (tick <= BEAT_RUN_TICKS && events.length < MAX_INPUT_EVENTS - 10) {
    events.push({ t: tick, k: BEAT_INPUT_TAP, a: randomInt(BEAT_LANES - 1), b: 0, c: 0, d: 0 });
    tick += 1 + randomInt(14);
  }
  return events;
}

function sliceValues(state: SliceState): number[] {
  return [
    state.tick,
    state.rng,
    state.slices,
    state.bonuses,
    state.bombsHit,
    state.flash,
    ...state.slicedAt,
    ...state.objects.flatMap((object) => [
      object.launchTick,
      object.lastTick,
      object.x,
      object.vx,
      object.vy,
    ]),
  ];
}

function bubValues(state: BubState): number[] {
  return [
    state.tick,
    state.rng,
    state.queueAt,
    state.descents,
    state.shots,
    state.popped,
    state.dropped,
    state.flightColour,
    state.x,
    state.y,
    state.vx,
    state.vy,
    ...state.grid,
  ];
}

function beatValues(state: BeatState): number[] {
  return [
    state.tick,
    state.rng,
    state.cursor,
    state.combo,
    state.maxCombo,
    state.perfect,
    state.good,
    state.ok,
    state.misses,
    state.strays,
    state.tenths,
    ...state.judged,
  ];
}

/* --------------------------------- Slice --------------------------------- */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const events = swipeTrace();
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = sliceGame.init(seed);
  const checkpoints: SliceCheckpoint[] = [];
  integers(sliceValues(state), `slice ${seed}`, 0);
  let ticks = 0;
  for (let tick = 1; tick <= SLICE_RUN_TICKS; tick++) {
    state = sliceGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % SLICE_CHECKPOINT_INTERVAL === 0) checkpoints.push(sliceCheckpoint(state));
    if (tick % 149 === 0) integers(sliceValues(state), `slice ${seed}`, tick);
    if (sliceGame.isOver(state)) break;
  }
  const claimed = sliceGame.score(state);

  const replayed = replaySliceRun(
    seed,
    encodeSliceRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`slice ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`slice ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.slices !== state.slices) fail(`slice ${seed}: slice count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`slice ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`slice ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`slice ${seed}: false desync`);

  const lied = replaySliceRun(
    seed,
    encodeSliceRun({ seed, claimedScore: 149, events, endTick: ticks, checkpoints }),
  );
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`slice ${seed}: inflated claim not caught`);
  }
}

/* ------------------- Slice: the two multicoloured specials ---------------- */

for (let sample = 0; sample < 40; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const start = sliceGame.init(seed);
  const specials = start.objects
    .map((object, index) => ({ object, index }))
    .filter((entry) => entry.object.special !== 0);
  if (specials.length < 2) fail(`slice ${seed}: fewer than two specials scheduled`);
  for (const entry of specials) {
    if (entry.object.launchTick < 10 * 60) fail(`slice ${seed}: a special lands in the first 10 s`);
  }

  // One swipe straight through each special, on a tick it is airborne.
  const events = [];
  for (const entry of specials) {
    for (let age = 4; age < 40; age++) {
      const tick = entry.object.launchTick + age;
      const at = sliceObjectAt(entry.object, tick);
      if (!at) break;
      const cx = Math.trunc(at.x / 256);
      const cy = Math.trunc(at.y / 256);
      if (cy < 60 || cy > 560 || cx < 40 || cx > 350) continue;
      if (events.some((event) => event.t === tick)) continue;
      events.push({ t: tick, k: 8, a: cx - 30, b: cy, c: cx + 30, d: cy });
      break;
    }
  }
  events.sort((a, b) => a.t - b.t);
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = start;
  const checkpoints: SliceCheckpoint[] = [];
  let ticks = 0;
  for (let tick = 1; tick <= SLICE_RUN_TICKS; tick++) {
    state = sliceGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % SLICE_CHECKPOINT_INTERVAL === 0) checkpoints.push(sliceCheckpoint(state));
    if (tick % 149 === 0) integers(sliceValues(state), `slice specials ${seed}`, tick);
    if (sliceGame.isOver(state)) break;
  }

  const frenzyCut = specials.filter(
    (entry) => entry.object.special === 1 && state.slicedAt[entry.index],
  ).length;
  const lineCut = specials.filter(
    (entry) => entry.object.special === 2 && state.slicedAt[entry.index],
  ).length;
  if (frenzyCut === 0 || lineCut === 0) fail(`slice ${seed}: specials were not sliced`);
  if (state.frenzyFrom.length !== frenzyCut) fail(`slice ${seed}: frenzy windows not recorded`);
  const expected =
    start.objects.length + frenzyCut * SLICE_FRENZY_COUNT + lineCut * SLICE_LINE_COUNT;
  if (state.objects.length !== expected) {
    fail(`slice ${seed}: spawned ${state.objects.length - start.objects.length}, expected extra`);
  }
  // No bomb may reach the board inside a frenzy.
  for (const object of state.objects) {
    if (!object.bomb) continue;
    const inside = state.frenzyFrom.some(
      (from) => object.launchTick >= from && object.launchTick < from + 300,
    );
    if (inside && !sliceSuppressed(state, object)) {
      fail(`slice ${seed}: a bomb survived a frenzy`);
    }
  }

  const claimed = sliceGame.score(state);
  const replayed = replaySliceRun(
    seed,
    encodeSliceRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`slice specials ${seed}: replay score differs`);
  if (replayed.flagged) fail(`slice specials ${seed}: honest run flagged (${replayed.reason})`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`slice specials ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    fail(`slice specials ${seed}: checkpoints differ`);
  }
}

/* ------------------------------ Bubble Pop ------------------------------- */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const events = shotTrace();
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = bubbleGame.init(seed);
  const checkpoints: BubCheckpoint[] = [];
  integers(bubValues(state), `bubble ${seed}`, 0);
  let ticks = 0;
  for (let tick = 1; tick <= BUB_RUN_TICKS; tick++) {
    state = bubbleGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % BUB_CHECKPOINT_INTERVAL === 0) checkpoints.push(bubCheckpoint(state));
    if (tick % 149 === 0) integers(bubValues(state), `bubble ${seed}`, tick);
    if (bubbleGame.isOver(state)) break;
  }
  const claimed = bubbleGame.score(state);

  const replayed = replayBubbleRun(
    seed,
    encodeBubbleRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`bubble ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`bubble ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.popped !== state.popped) fail(`bubble ${seed}: pop count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`bubble ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`bubble ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`bubble ${seed}: false desync`);

  const lied = replayBubbleRun(
    seed,
    encodeBubbleRun({ seed, claimedScore: 149, events, endTick: ticks, checkpoints }),
  );
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`bubble ${seed}: inflated claim not caught`);
  }
}

/* --------------------------------- Beat ---------------------------------- */

for (let sample = 0; sample < SAMPLES; sample++) {
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  const events = tapTrace();
  const byTick = new Map(events.map((event) => [event.t, event]));

  let state = beatGame.init(seed);
  const checkpoints: BeatCheckpoint[] = [];
  integers(beatValues(state), `beat ${seed}`, 0);
  let ticks = 0;
  for (let tick = 1; tick <= BEAT_RUN_TICKS; tick++) {
    state = beatGame.step(state, byTick.get(tick) ?? null);
    ticks = tick;
    if (state.tick % BEAT_CHECKPOINT_INTERVAL === 0) checkpoints.push(beatCheckpoint(state));
    if (tick % 149 === 0) integers(beatValues(state), `beat ${seed}`, tick);
    if (beatGame.isOver(state)) break;
  }
  const claimed = beatGame.score(state);

  const replayed = replayBeatRun(
    seed,
    encodeBeatRun({ seed, claimedScore: claimed, events, endTick: ticks, checkpoints }),
  );
  if (replayed.score !== claimed) fail(`beat ${seed}: replay ${replayed.score} vs ${claimed}`);
  if (replayed.flagged) fail(`beat ${seed}: honest run flagged (${replayed.reason})`);
  if (replayed.perfect !== state.perfect) fail(`beat ${seed}: perfect count differs`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
    fail(`beat ${seed}: final state differs`);
  }
  if (JSON.stringify(replayed.checkpoints) !== JSON.stringify(checkpoints)) {
    const index = checkpoints.findIndex(
      (checkpoint, i) => checkpoint.checksum !== replayed.checkpoints[i]?.checksum,
    );
    firstFailingTick = checkpoints[index]?.tick ?? 0;
    fail(`beat ${seed}: checkpoints differ at tick ${firstFailingTick}`);
  }
  if (replayed.desyncTick !== null) fail(`beat ${seed}: false desync`);

  const lied = replayBeatRun(
    seed,
    encodeBeatRun({ seed, claimedScore: 149, events, endTick: ticks, checkpoints }),
  );
  if (claimed !== 149 && (!lied.flagged || lied.score !== claimed)) {
    fail(`beat ${seed}: inflated claim not caught`);
  }
}

/* ------------------------- Payload range checks -------------------------- */

{
  const offBoard: ArcadeInputEvent[] = [
    { t: 10, k: SLICE_INPUT_SWIPE, a: 0, b: 0, c: SLICE_WORLD_W + 1, d: 0 },
  ];
  if (checkInputEvents(offBoard, SLICE_RUN_TICKS, SLICE_INPUT_RANGES).ok) {
    fail("slice: a segment beyond the board was accepted");
  }
  const badKind: ArcadeInputEvent[] = [{ t: 10, k: 0, a: 0, b: 0, c: 0, d: 0 }];
  if (checkInputEvents(badKind, SLICE_RUN_TICKS, SLICE_INPUT_RANGES).ok) {
    fail("slice: an unknown input kind was accepted");
  }

  const wildShot: ArcadeInputEvent[] = [
    { t: 10, k: BUB_INPUT_SHOT, a: BUB_V_MAX + 1, b: -500, c: 0, d: 0 },
  ];
  if (checkInputEvents(wildShot, BUB_RUN_TICKS, BUB_INPUT_RANGES).ok) {
    fail("bubble: an over-fast shot was accepted");
  }
  const downShot: ArcadeInputEvent[] = [{ t: 10, k: BUB_INPUT_SHOT, a: 0, b: 500, c: 0, d: 0 }];
  if (checkInputEvents(downShot, BUB_RUN_TICKS, BUB_INPUT_RANGES).ok) {
    fail("bubble: a downward shot was accepted");
  }

  const badLane: ArcadeInputEvent[] = [
    { t: 10, k: BEAT_INPUT_TAP, a: BEAT_LANES, b: 0, c: 0, d: 0 },
  ];
  if (checkInputEvents(badLane, BEAT_RUN_TICKS, BEAT_INPUT_RANGES).ok) {
    fail("beat: a lane outside the board was accepted");
  }

  const seed = 777_777;
  const refused = replaySliceRun(
    seed,
    encodeSliceRun({
      seed,
      claimedScore: 100,
      events: [
        ...swipeTrace(),
        { t: SLICE_RUN_TICKS, k: SLICE_INPUT_SWIPE, a: -4, b: 0, c: 0, d: 0 },
      ],
    }),
  );
  if (!refused.flagged || refused.reason !== "input payload out of range") {
    fail("slice: an out-of-range swipe was not refused");
  }

  const refusedBeat = replayBeatRun(
    seed,
    encodeBeatRun({
      seed,
      claimedScore: 100,
      events: [...tapTrace(), { t: BEAT_RUN_TICKS, k: BEAT_INPUT_TAP, a: 9, b: 0, c: 0, d: 0 }],
    }),
  );
  if (!refusedBeat.flagged || refusedBeat.reason !== "input payload out of range") {
    fail("beat: an out-of-range lane was not refused");
  }
}

/* --------------------------- Lagged phones ------------------------------- */

{
  const seed = 8484;
  const sliceCut = replaySliceRun(
    seed,
    encodeSliceRun({ seed, claimedScore: 0, events: [], endTick: 1500 }),
  );
  if (!sliceCut.clientLag || sliceCut.clientTick !== 1500) fail("slice client lag not flagged");
  if (sliceCut.finished) fail("slice lagged run counted as a full minute");

  const beatCut = replayBeatRun(
    seed,
    encodeBeatRun({ seed, claimedScore: 0, events: [], endTick: 1500 }),
  );
  if (!beatCut.clientLag || beatCut.clientTick !== 1500) fail("beat client lag not flagged");
  if (beatCut.clean) fail("beat lagged run credited with a clean run");

  const bubbleCut = replayBubbleRun(
    seed,
    encodeBubbleRun({ seed, claimedScore: 0, events: [], endTick: 1500 }),
  );
  if (!bubbleCut.clientLag || bubbleCut.clientTick !== 1500) fail("bubble client lag not flagged");
  if (bubbleCut.survived) fail("bubble lagged run credited with surviving");
}

console.log(
  failures === 0
    ? `slice/bubble/beat checks passed: client and server states, checkpoints and scores identical over ${SAMPLES} random runs each; payload ranges enforced`
    : `${failures} failures; first failing tick ${firstFailingTick ?? "unknown"}`,
);
