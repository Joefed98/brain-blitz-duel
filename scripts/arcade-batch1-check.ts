/**
 * Batch-1 arcade upgrades (Oct 2026): Jaywalk crossRev 2, Roofbound flipRev 2,
 * Ball Tracker btRev 2, Slice sliceRev 2.
 *
 *  1. Legacy identity: unstamped rounds of all four games replay and score exactly
 *     as before (digest saved from the code before the upgrades).
 *  2. Per game, the new rules: determinism, the new elements, and proof that the
 *     score cap of 150 is reachable on the new revision by a real input log
 *     replayed through the server path.
 *  3. The intro's stated maximums are true (and the intro HOW / SCORE rules hold).
 *
 *   bun scripts/arcade-batch1-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { decodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { legacyDigest } from "./arcade-batch1-legacy";
import {
  crossBlocked,
  crossCheckpoint,
  crossClosed,
  crossColumnCentreFp,
  crossCourse,
  crossFairPassable,
  crossGameFor,
  crossPaused,
  crossPassable,
  CROSS_COLS,
  CROSS_COURSES,
  CROSS_FAIR_COURSES,
  CROSS_FAIR_WINDOW_TICKS,
  CROSS_HOP_TICKS,
  CROSS_INPUT_MOVE,
  CROSS_KIND_CYCLE,
  CROSS_KIND_ROADWORKS,
  CROSS_LANES,
  CROSS_PLAYER_HALF_FP,
  CROSS_REV,
  CROSS_REV2,
  CROSS_CYCLE3_GAP_MIN_FP,
  CROSS_CYCLE3_RIDERS,
  CROSS_RUN_TICKS,
  type CrossState,
} from "../src/lib/arcade/cross";
import { encodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import {
  flipCheckpoint,
  flipCrackTick,
  flipGameFor,
  flipScoreOfV2,
  flipStarsTaken,
  flipWarpAmp,
  FLIP_CRUMBLE,
  FLIP_INPUT_TAP,
  FLIP_REV,
  FLIP_RUN_TICKS,
  FLIP_STARS,
  type FlipState,
} from "../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import {
  btCheckpoint,
  btNext,
  btRotatable,
  btScoreOf,
  makeBallTrackGame,
  BT_BALLS,
  BT_COLS,
  BT_HOPPER_COL,
  BT_K_ROTATE,
  BT_LAST_LAND_MIN,
  BT_LEGACY_PERFECT_MAX,
  btScoreOfV2,
  BT_REV,
  BT_ROWS,
  BT_STEP_TICKS,
  BT_TURN_TICKS,
  type BtState,
} from "../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { btArtBallPoint } from "../src/lib/arcade/ballTrackArt.renderer";
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import {
  sliceCheckpoint,
  sliceGameFor,
  sliceMayoCount,
  sliceMultiplier,
  sliceObjectAt,
  sliceSuppressed,
  SLICE_INPUT_SWIPE,
  SLICE_MAYO_TICKS,
  SLICE_R,
  SLICE_REV,
  SLICE_SPECIAL_MAYO,
  SLICE_SPECIAL_R,
  SLICE_WORLD_H,
  SLICE_WORLD_W,
  type SliceState,
} from "../src/lib/arcade/slice";
import { encodeSliceRun, replaySliceRun } from "../src/lib/duel/slice";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);
/** BATCH1_ONLY=cross,flip,balltrack,slice runs only those sections (legacy and intro always run). */
const ONLY = process.env.BATCH1_ONLY?.split(",");
const want = (key: string) => !ONLY || ONLY.includes(key);

/* ============================ 1. Legacy identity ============================ */
section("legacy identity");
{
  const saved = JSON.parse(readFileSync(new URL("./fixtures/arcade-batch1-legacy.json", import.meta.url), "utf8"));
  const now = await legacyDigest(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
  assert.deepEqual(now, saved, "unstamped rounds must replay exactly as before");
  checks += saved.length;
  console.log(`  ${saved.length} unstamped and revision-2 runs (cross, flip, slice, balltrack) identical to the code that stored them`);
}

/* =============================== 2a. Jaywalk =============================== */
if (want("cross")) {
section("Jaywalk crossRev 2");
const cross2 = crossGameFor(CROSS_REV);
ok(crossGameFor(undefined) !== cross2 && crossGameFor(undefined).init(5).rev === undefined, "unstamped Jaywalk keeps the original game");
ok(cross2.init(5).rev === CROSS_REV && crossGameFor(CROSS_REV2).init(5).rev === CROSS_REV2, "each revision's state carries its stamp");
ok(JSON.stringify(cross2.init(99)) === JSON.stringify(cross2.init(99)), "rev-2 courses are seeded");

const CROSS_SEEDS = Array.from({ length: 24 }, (_, i) => 1 + i * 104_729);
const cycleGaps: number[] = [];
for (const seed of CROSS_SEEDS) {
  const s = cross2.init(seed);
  s.courses.forEach((course, index) => {
    ok(crossPassable(course), `seed ${seed} crossing ${index + 1} passable`);
    const cycles = course.lanes.filter((l) => l.kind === CROSS_KIND_CYCLE).length;
    const works = course.lanes.filter((l) => l.kind === CROSS_KIND_ROADWORKS);
    if (index < CROSS_FAIR_COURSES) {
      ok(cycles === 0 && works.length === 0, "crossings 1–2 are plain traffic");
      ok(crossFairPassable(course), `seed ${seed} crossing ${index + 1}: a straight-up walker crosses`);
      for (const lane of course.lanes) {
        const gap = lane.period - lane.blockW;
        ok((gap - 2 * CROSS_PLAYER_HALF_FP) / lane.speed >= CROSS_FAIR_WINDOW_TICKS, "every fair gap stays open 1.5 s");
      }
    }
    if (index >= 2) ok(cycles === (index >= 5 ? 2 : 1), `crossing ${index + 1}: cyclist lanes`);
    else ok(cycles === 0, "no cyclists before crossing 3");
    if (index >= 3) ok(works.length === (index >= 6 ? 2 : 1), `crossing ${index + 1}: roadworks`);
    else ok(works.length === 0, "no roadworks before crossing 4");
    for (const lane of works) {
      ok(lane.closed!.includes(CROSS_COLS >> 1), "roadworks force a sidestep off the middle column");
      ok(lane.closed!.length === CROSS_COLS - 3, "a three-position opening");
    }
    for (const lane of course.lanes.filter((l) => l.kind === CROSS_KIND_CYCLE)) {
      const car = course.lanes.filter((l) => !l.kind);
      ok(lane.blockW < Math.min(...car.map((l) => l.blockW)), "riders are narrower than any car");
      ok(lane.speed > Math.max(...car.map((l) => l.speed)), "riders are faster than the cars");
      // crossRev 3: a few riders per lane at seeded, uneven gaps of at least 400 px.
      const offs = lane.offsets ?? [];
      ok(offs.length === CROSS_CYCLE3_RIDERS, "rev 3: riders listed per lane");
      const gaps = offs.map((o, k) => ((k + 1 < offs.length ? offs[k + 1]! : lane.period) - o) - lane.blockW);
      ok(gaps.every((g) => g >= CROSS_CYCLE3_GAP_MIN_FP), "rev 3: riders at least 400 px apart");
      cycleGaps.push(...gaps);
    }
  });
}
ok(new Set(cycleGaps).size > cycleGaps.length / 2, "rev 3: rider gaps vary from the seed (no fixed rhythm)");
{
  // Riders now come far less often than on rev 2: compare passes per lane per second.
  const rate = (lane: { speed: number; period: number; offsets?: number[] }) => ((lane.offsets?.length ?? 1) * lane.speed * 60) / lane.period;
  const v2 = crossGameFor(CROSS_REV2).init(1).courses.flatMap((c) => c.lanes.filter((l) => l.kind === CROSS_KIND_CYCLE)).map(rate);
  const v3 = cross2.init(1).courses.flatMap((c) => c.lanes.filter((l) => l.kind === CROSS_KIND_CYCLE)).map(rate);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  ok(avg(v3) < avg(v2) / 2, "rev 3 riders arrive less than half as often as rev 2");
  console.log(`  riders per second per cyclist lane: rev 2 ${avg(v2).toFixed(2)}, rev 3 ${avg(v3).toFixed(2)}; rev-3 gaps ${Math.round(Math.min(...cycleGaps) / 256)}–${Math.round(Math.max(...cycleGaps) / 256)} px`);
}
console.log(`  ${CROSS_SEEDS.length} seeds × ${CROSS_COURSES} crossings: fair early gaps, cyclists from 3, roadworks from 4, all passable`);

/** Sim-exact forward planner over (lane, col, hop) for the crossing under way; returns ticked moves. */
function planCrossing(state: CrossState): Map<number, number> | null {
  const course = crossCourse(state);
  const start = state.tick;
  type Node = { lane: number; col: number; hop: number; parent: number; move: number };
  let layer: Node[] = [{ lane: state.lane, col: state.col, hop: state.hop, parent: -1, move: -1 }];
  const layers: Node[][] = [layer];
  for (let tick = start + 1; tick <= Math.min(CROSS_RUN_TICKS, start + 1200); tick++) {
    const seen = new Set<number>();
    const next: Node[] = [];
    for (let i = 0; i < layer.length; i++) {
      const n = layer[i]!;
      const moves = n.hop > 0 ? [-1] : [-1, 0, 2, 3];
      for (const move of moves) {
        let { lane, col, hop } = n;
        if (move === 0 && !crossClosed(course, lane + 1, col)) hop = CROSS_HOP_TICKS;
        else if (move === 2 && !crossClosed(course, lane, col - 1)) col = Math.max(0, col - 1);
        else if (move === 3 && !crossClosed(course, lane, col + 1)) col = Math.min(CROSS_COLS - 1, col + 1);
        if (hop > 0) {
          hop -= 1;
          if (hop === 0) lane += 1;
        }
        if (lane > CROSS_LANES) {
          // Arrived: walk back the parents into a tick → move map.
          const plan = new Map<number, number>();
          if (move >= 0) plan.set(tick, move);
          let at = i;
          for (let k = layers.length - 1, t = tick - 1; k > 0; k--, t--) {
            const node = layers[k]![at]!;
            if (node.move >= 0) plan.set(t, node.move);
            at = node.parent;
          }
          return plan;
        }
        if (hop === 0 && lane >= 1 && crossBlocked(course.lanes[lane - 1]!, crossColumnCentreFp(col), tick - state.crossStart)) continue;
        const key = (lane * CROSS_COLS + col) * 8 + hop;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ lane, col, hop, parent: i, move });
      }
    }
    if (!next.length) return null;
    layers.push(next);
    layer = next;
  }
  return null;
}

let best150 = 0;
for (const seed of CROSS_SEEDS.slice(0, 12)) {
  let state = cross2.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof crossCheckpoint>[] = [];
  let plan: Map<number, number> | null = null;
  while (!cross2.isOver(state)) {
    const t = state.tick + 1;
    if (!plan && !crossPaused({ ...state, tick: t }) && state.lane === 0 && state.hop === 0) plan = planCrossing(state);
    const move = plan?.get(t);
    if (move !== undefined) recordInput(events, { t, k: CROSS_INPUT_MOVE, a: move, b: 0, c: 0, d: 0 }, cross2.inputRanges);
    const before = state.crossings;
    state = cross2.step(state, inputAt(events, t));
    if (state.crossings > before) plan = null;
    if (state.tick % 300 === 0) checkpoints.push(crossCheckpoint(state));
  }
  const score = cross2.score(state);
  const raw = encodeCrossRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
  const replay = replayCrossRun(seed, raw, CROSS_REV);
  ok(replay.score === score && !replay.flagged, `seed ${seed}: server replay agrees`);
  ok(state.lives === 3, `seed ${seed}: planner never hit`);
  ok(score === 150, `seed ${seed}: planned run reaches 150 (got ${score}, ${state.crossings} crossings)`);
  best150 += score === 150 ? 1 : 0;
}
console.log(`  150 reached through the server replay on ${best150} of 12 seeds (planner never loses a life)`);
const crossIntro = INTRO_SCORE.cross;
// The intro follows the revision rooms deal: crossRev 9 (x200) states rows, crossings, coins and streaks, up to its maximum.
ok(crossIntro.includes(`Up to ${roundMaxFor("cross")}`) && /rows/.test(crossIntro) && /crossings/.test(crossIntro) && /coins/.test(crossIntro), "Jaywalk intro states rows, crossings, coins, up to its maximum (crossRev 9)");
}

/* =============================== 2b. Roofbound =============================== */
if (want("flip")) {
section("Roofbound flipRev 2");
const flip2 = flipGameFor(FLIP_REV);
ok(flipGameFor(undefined).init(5).rev === undefined && flip2.init(5).rev === FLIP_REV, "stamp gates the new rules");
ok(flipWarpAmp(15 * 60, FLIP_REV) === 0 && flipWarpAmp(15 * 60 + 30, FLIP_REV) > 0, "rev 2 bends from 15 s");
ok(flipWarpAmp(20 * 60, null) === 0 && flipWarpAmp(15 * 60 + 30, null) === 0, "original still bends from 20 s");
ok(flipScoreOfV2(FLIP_RUN_TICKS, 0) === 130 && flipScoreOfV2(FLIP_RUN_TICKS, FLIP_STARS) === 150, "survival up to 130, stars up to 20");
ok(flipScoreOfV2(1800, 10) === 32 + 20, "survival keeps the squared curve, rescaled");

/** Sim-exact planner: per dynamics key keep the run with the most stars (stars never change dynamics). */
function planFlip(seed: number): ArcadeInputEvent[] {
  type Node = { state: FlipState; parent: number; tap: boolean };
  const layers: Node[][] = [[{ state: flip2.init(seed), parent: -1, tap: false }]];
  for (let tick = 1; tick <= FLIP_RUN_TICKS; tick++) {
    const best = new Map<string, Node>();
    const prev = layers[tick - 1]!;
    prev.forEach((node, index) => {
      for (const tap of [false, true]) {
        const next = flip2.step(node.state, tap ? { t: tick, k: FLIP_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
        if (next.ended === 2) continue;
        const cracks = next.cracks ?? [];
        const key = `${next.side}:${next.flipT}:${cracks.at(-2)}:${cracks.at(-1)}`;
        const held = best.get(key);
        if (!held || flipStarsTaken(next) > flipStarsTaken(held.state)) best.set(key, { state: next, parent: index, tap });
      }
    });
    if (!best.size) throw new Error(`seed ${seed}: no surviving run at tick ${tick}`);
    layers.push([...best.values()]);
  }
  const last = layers[FLIP_RUN_TICKS]!;
  let at = last.indexOf(last.reduce((a, b) => (flipStarsTaken(b.state) > flipStarsTaken(a.state) ? b : a)));
  const events: ArcadeInputEvent[] = [];
  for (let tick = FLIP_RUN_TICKS; tick > 0; tick--) {
    const node = layers[tick]![at]!;
    if (node.tap) events.unshift({ t: tick, k: FLIP_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    at = node.parent;
  }
  return events;
}

let flip150 = 0;
const FLIP_SEEDS = [1, 7_654_322, 15_308_643];
let flipCracked = 0;
for (const seed of FLIP_SEEDS) {
  const course = flip2.init(seed);
  ok(course.stars?.length === FLIP_STARS, `seed ${seed}: ten stars`);
  ok(course.segs.some((seg) => seg.kind === FLIP_CRUMBLE), `seed ${seed}: crumbling tiles present`);
  const planned = planFlip(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof flipCheckpoint>[] = [];
  let state = flip2.init(seed);
  let cracked = 0;
  while (!flip2.isOver(state)) {
    const t = state.tick + 1;
    const want = planned.find((e) => e.t === t);
    if (want) recordInput(events, want, flip2.inputRanges);
    state = flip2.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
  }
  for (let i = 0; i < state.segs.length; i++) if (flipCrackTick(state, i) !== null) cracked += 1;
  const score = flip2.score(state);
  const replay = replayFlipRun(seed, encodeFlipRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }), FLIP_REV);
  ok(replay.score === score && !replay.flagged && replay.stars === FLIP_STARS, `seed ${seed}: server replay agrees`);
  ok(score === 150, `seed ${seed}: survive + all stars = 150 (got ${score})`);
  flipCracked += cracked;
  flip150 += score === 150 ? 1 : 0;
}
ok(flipCracked > 0, "the winning runs stood on crumbling tiles and flipped off in time");
console.log(`  150 reached through the server replay on ${flip150} of ${FLIP_SEEDS.length} seeds (survived 60 s, all 10 stars; ${flipCracked} crumbling tiles survived)`);
ok(/gold star/.test(INTRO_SCORE.flip) && /minute for 10 more/.test(INTRO_SCORE.flip), "Roofbound intro states seconds, stars and the 10 for the minute (score bands, flipRev 3)");
}

/* ============================= 2c. Ball Tracker ============================= */
if (want("balltrack")) {
section("Ball Tracker btRev 2");
{
  const course = BALL_TRACK_BANK[0]!.course;
  const v1 = makeBallTrackGame(course);
  const v2 = makeBallTrackGame(course, BT_REV);
  ok(v1.init(1).rev === undefined && v2.init(1).rev === BT_REV, "stamp gates the new rules");
  const tap = (t: number, a: number): ArcadeInputEvent => ({ t, k: BT_K_ROTATE, a, b: 0, c: 0, d: 0 });
  // Find a marble sitting in a rotatable horizontal tube, then turn the tube under it.
  const rot = v2.rotatable;
  let probe: BtState = v2.init(1);
  let target = -1;
  while (probe.tick < 3000 && target < 0) {
    probe = v2.step(probe, null);
    const b = probe.balls.find((ball) => rot.has(ball.cell) && probe.vert[ball.cell] === 0 && ball.above === 0 && probe.tick < ball.at - 2);
    if (b) target = b.id;
  }
  ok(target >= 0, "a marble reaches a turnable tube");
  const ball = probe.balls.find((b) => b.id === target)!;
  const cell = ball.cell;
  const legacyTry = v1.step({ ...probe, rev: undefined }, tap(probe.tick + 1, cell));
  ok(legacyTry.vert[cell] === 0, "original rules still lock an occupied tube");
  let turned = v2.step(probe, tap(probe.tick + 1, cell));
  ok(turned.vert[cell] === 1 && turned.turned![cell] === turned.tick, "rev 2 turns the tube with the marble inside");
  while (turned.balls.find((b) => b.id === target)?.cell === cell) turned = v2.step(turned, null);
  const moved = turned.balls.find((b) => b.id === target);
  ok(!moved || moved.cell === cell + BT_COLS, "the marble leaves by the new (lower) exit");
  ok(!moved || ((moved.via ?? 0) & 1) === 1, "the marble remembers riding the turn");
  ok(JSON.stringify(v2.step(probe, tap(probe.tick + 1, cell))) === JSON.stringify(v2.step(probe, tap(probe.tick + 1, cell))), "deterministic");

  // Switch points: only on a live tray drop; a switched drop sends the marble on along the row.
  const bottom = (BT_ROWS - 1) * BT_COLS;
  const s0 = v2.init(1);
  const live = course.trays.findIndex((tray, col) => col > 0 && tray >= 0);
  const dead = course.trays.findIndex((tray, col) => col > 0 && tray < 0);
  ok(v2.step(s0, tap(1, bottom + live)).sw === 1 << live, "tap toggles a live switch point");
  ok(dead < 0 || v2.step(s0, tap(1, bottom + dead)).sw === 0, "no switch point where no cup is live");
  ok(btNext(bottom + live, true, false, course, 1, 0).cell >= 100, "open switch: the marble drops into the cup");
  ok(btNext(bottom + live, true, false, course, 1, 1 << live).cell === bottom + live + 1 || live === BT_COLS - 1, "switched: the marble rolls on");
  ok(v1.step(v1.init(1), tap(1, bottom + live)).sw === undefined, "original rules ignore bottom-row taps");

  // Every banked playbook (proved under the original locks) still gets all 30 home under rev 2.
  let minScore = 999, maxScore = 0;
  for (const [index, entry] of BALL_TRACK_BANK.entries()) {
    if (index % 4 !== 0) continue;
    const game = makeBallTrackGame(entry.course, BT_REV);
    const playbook = decodeInputEvents(entry.playbook);
    const byTick = new Map(playbook.map((e) => [e.t, e]));
    let st = game.init(1);
    const events: ArcadeInputEvent[] = [];
    const checkpoints: ReturnType<typeof btCheckpoint>[] = [];
    while (!game.isOver(st)) {
      const t = st.tick + 1;
      const e = byTick.get(t);
      if (e) recordInput(events, e, game.inputRanges);
      st = game.step(st, inputAt(events, t));
      if (st.tick % 300 === 0) checkpoints.push(btCheckpoint(st));
    }
    const score = game.score(st);
    const seed = index + 1;
    const replay = replayBallTrackRun(entry.course, seed, encodeBallTrackRun(entry.course, { seed, claimedScore: score, events, endTick: st.tick, checkpoints }, BT_REV), BT_REV);
    ok(st.home === BT_BALLS && replay.score === score && !replay.flagged, `bank course ${index}: playbook still gets all 30 home under rev 2`);
    minScore = Math.min(minScore, score);
    maxScore = Math.max(maxScore, score);
  }
  // Drawn marbles never jump: replay playbooks (they turn tiles all the time) and follow every
  // marble's drawn point tick to tick. Rolling is 100/16 px a tick; a swing with its tube adds at
  // most a quarter-turn of up to one tile pitch (100 px) over BT_TURN_TICKS. Hopper entry and cup drops are
  // excluded (those moves are in the sim's own straight lines anyway).
  {
    let worst = 0;
    for (const entry of BALL_TRACK_BANK.slice(0, 40)) {
      const game = makeBallTrackGame(entry.course, BT_REV);
      const byTick = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
      // Extra taps on occupied tubes so marbles really ride turns too.
      let st = game.init(1);
      const last = new Map<number, { x: number; y: number }>();
      while (!game.isOver(st)) {
        const t = st.tick + 1;
        let input = byTick.get(t) ?? null;
        if (!input && t % 97 === 0) {
          const riding = st.balls.find((b) => game.rotatable.has(b.cell));
          if (riding) input = { t, k: BT_K_ROTATE, a: riding.cell, b: 0, c: 0, d: 0 };
        }
        st = game.step(st, input);
        for (const b of st.balls) {
          const p = btArtBallPoint(st, b, game.rotatable);
          const q = last.get(b.id);
          if (q && b.cell >= 0 && b.from >= 0) worst = Math.max(worst, Math.hypot(p.x - q.x, p.y - q.y));
          last.set(b.id, p);
        }
      }
    }
    ok(worst <= 100 / BT_STEP_TICKS + (100 * Math.PI) / 2 / BT_TURN_TICKS + 0.5, `drawn marbles move smoothly (largest step ${worst.toFixed(1)} px a tick)`);
    console.log(`  drawn marble paths: largest per-tick step ${worst.toFixed(1)} px over 40 courses with turns while occupied`);
  }
  ok(minScore > 140 && maxScore === 150, "perfect playbook runs reach 150 under rev 2 when the last marble lands by 56.5 s");

  // The bound: shortest possible route for the last marble with every tube and switch set ideally.
  const rotatableAll = new Set(BALL_TRACK_BANK.flatMap((e) => btRotatable(e.course)));
  let frontier = [{ cell: BT_HOPPER_COL, above: true }];
  let moves = 1;
  let minMoves = Infinity;
  for (; moves < 40 && minMoves === Infinity; moves++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const options = rotatableAll.has(node.cell) ? [false, true] : [false];
      for (const vertical of options) for (const sw of [0, 0x7f]) {
        const n = btNext(node.cell, node.above, vertical, { ...course, trays: [-1, 0, 0, 0, 0, 0, 0] }, 0, sw);
        if (n.cell >= 100) minMoves = Math.min(minMoves, moves + 1);
        else if (n.cell >= 0) next.push({ cell: n.cell, above: n.fromAbove });
      }
    }
    frontier = next;
  }
  let lastRelease = 0;
  for (let st = v2.init(1); st.tick < 3000; ) {
    const before = st.next;
    st = v2.step(st, null);
    if (st.next > before) lastRelease = st.tick;
  }
  const earliest = lastRelease + BT_STEP_TICKS * (minMoves + 1);
  ok(earliest === BT_LAST_LAND_MIN, `the last marble lands no earlier than tick ${earliest}`);
  ok(btScoreOfV2(BT_BALLS, earliest) === 150 && btScoreOf(BT_BALLS, 0, earliest) === BT_LEGACY_PERFECT_MAX, "rev 2 perfect max 150; original stays 135");
  // The top is the game's maximum (200 since expansion E6's btRev 7, docs/scoring-200.md).
  ok(new RegExp(`up to ${roundMaxFor("balltrack")}`, "i").test(INTRO_SCORE.balltrack) && !/otherwise up to/.test(INTRO_SCORE.balltrack), "Ball Tracker intro states its maximum and no partial cap (score bands, btRev 3)");
  console.log(`  occupied turns and switch points work; ${Math.ceil(BALL_TRACK_BANK.length / 4)} banked playbooks still prove their courses (perfect runs score ${minScore}–${maxScore} under rev 2; earliest last landing tick ${BT_LAST_LAND_MIN}, last release ${lastRelease})`);
}
}

/* ================================ 2d. Slice ================================ */
if (want("slice")) {
section("Slice sliceRev 2");
const slice1 = sliceGameFor(undefined);
const slice2 = sliceGameFor(SLICE_REV);
ok(slice1.init(5).rev === undefined && slice2.init(5).rev === SLICE_REV, "stamp gates the new rules");
for (const seed of [3, 4242, 99_001, 123_456_789]) {
  const a = slice1.init(seed), b2 = slice2.init(seed);
  const mayos = b2.objects.filter((o) => o.special === SLICE_SPECIAL_MAYO);
  ok(mayos.length >= 1 && mayos.length <= 2, `seed ${seed}: one or two mayonnaise bottles`);
  ok(mayos.every((o) => o.launchTick >= 600 && o.launchTick <= 3600 - 240), "same appearance window as the other specials");
  // Everything the original schedule had is still there, unchanged (mayo is drawn after it).
  const key = (o: { launchTick: number; x: number; vx: number; vy: number; special: number }) => `${o.launchTick}:${o.x}:${o.vx}:${o.vy}:${o.special}`;
  ok(a.objects.every((o) => b2.objects.some((m) => key(m) === key(o))), `seed ${seed}: original objects unchanged`);
}

/** One-tick swipe segment that a bot picks: cuts the most foods, never a chilli. */
type Seg = [number, number, number, number];
function hits(state: SliceState, tick: number, seg: Seg) {
  let foods = 0, bombs = 0, specials = 0;
  const [x1, y1, x2, y2] = seg;
  const ax = x2 - Math.trunc(((x2 - x1) * 5) / 4), ay = y2 - Math.trunc(((y2 - y1) * 5) / 4);
  state.objects.forEach((o, i) => {
    if (state.slicedAt[i] || sliceSuppressed(state, o)) return;
    const at = sliceObjectAt(o, tick, state.slowFrom, state.mayo);
    if (!at) return;
    const cx = Math.trunc(at.x / 256), cy = Math.trunc(at.y / 256), r = o.special ? SLICE_SPECIAL_R : SLICE_R;
    if (cy - r > SLICE_WORLD_H || cy + r < 44) return;
    const dx = x2 - ax, dy = y2 - ay, fx = cx - ax, fy = cy - ay, len2 = dx * dx + dy * dy;
    const dot = fx * dx + fy * dy;
    let d2: number;
    if (dot <= 0) d2 = fx * fx + fy * fy;
    else if (dot >= len2) d2 = (cx - x2) ** 2 + (cy - y2) ** 2;
    else d2 = (fx * dy - fy * dx) ** 2 / len2;
    if (d2 > (r - 2) * (r - 2)) return;
    if (o.bomb) bombs++;
    else if (o.special) specials++;
    else foods++;
  });
  return { foods, bombs, specials };
}
function botRun(game: typeof slice2, seed: number) {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof sliceCheckpoint>[] = [];
  let lastEnd: [number, number] = [-1, -1];
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    let best: { seg: Seg; score: number } | null = null;
    // Airborne foods' centres next tick; try lines through pairs and flat lines through each.
    const pts: [number, number][] = [];
    state.objects.forEach((o, i) => {
      if (state.slicedAt[i] || o.bomb || sliceSuppressed(state, o)) return;
      const at = sliceObjectAt(o, t, state.slowFrom, state.mayo);
      if (at && at.y / 256 < SLICE_WORLD_H - 10 && at.y / 256 > 60) pts.push([Math.trunc(at.x / 256), Math.trunc(at.y / 256)]);
    });
    const consider = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const half = 170;
      const seg: Seg = [mx - ux * half, my - uy * half, mx + ux * half, my + uy * half].map((v, k) =>
        Math.max(0, Math.min(k % 2 ? SLICE_WORLD_H : SLICE_WORLD_W, Math.round(v)))) as Seg;
      if (seg[0] === lastEnd[0] && seg[1] === lastEnd[1]) seg[0] += seg[0] > 0 ? -1 : 1;
      const h = hits(state, t, seg);
      if (h.bombs) return;
      const value = h.foods * 10 + h.specials * 25;
      if (value > 0 && (!best || value > best.score)) best = { seg, score: value };
    };
    for (let i = 0; i < pts.length; i++) {
      const [px0, py0] = pts[i]!;
      consider(px0 - 50, py0, px0 + 50, py0);
      consider(px0, py0 - 50, px0, py0 + 50);
      consider(px0 - 40, py0 - 40, px0 + 40, py0 + 40);
      consider(px0 - 40, py0 + 40, px0 + 40, py0 - 40);
      for (let j = i + 1; j < pts.length; j++) consider(px0, py0, pts[j]![0], pts[j]![1]);
    }
    // Wait for a 3+ cut while the combo can still be fed; otherwise take what is there before it drops.
    const chosen = best as { seg: Seg; score: number } | null;
    const urgent = state.objects.some((o, i) => {
      if (state.slicedAt[i] || o.bomb) return false;
      const now = sliceObjectAt(o, t, state.slowFrom, state.mayo);
      const later = sliceObjectAt(o, t + 8, state.slowFrom, state.mayo);
      return !!now && (!later || later.y / 256 > SLICE_WORLD_H - 30);
    });
    // With ×3 banked and over five seconds left, every food is worth taking now.
    const relaxed = state.comboLive === 1 && sliceMultiplier(state.streak) >= 3 && state.comboUntil - t > 300;
    if (chosen && (chosen.score >= 25 || urgent || relaxed)) {
      recordInput(events, { t, k: SLICE_INPUT_SWIPE, a: chosen.seg[0], b: chosen.seg[1], c: chosen.seg[2], d: chosen.seg[3] }, game.inputRanges);
      lastEnd = [chosen.seg[2], chosen.seg[3]];
    }
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(sliceCheckpoint(state));
  }
  return { state, events, checkpoints, score: game.score(state) };
}
const SLICE_SEEDS = [11, 222, 3_333, 44_444, 555_555, 6_666_666, 77_777_777, 888];
const totals = { v1: [] as number[], v2: [] as number[] };
let slice150: number | null = null;
for (const seed of SLICE_SEEDS) {
  totals.v1.push(botRun(slice1, seed).score);
  const run = botRun(slice2, seed);
  totals.v2.push(run.score);
  const raw = encodeSliceRun({ seed, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
  const replay = replaySliceRun(seed, raw, SLICE_REV);
  ok(replay.score === run.score && !replay.flagged, `seed ${seed}: server replay agrees`);
  if (run.score === 150 && slice150 === null) slice150 = seed;
  if (sliceMayoCount(run.state) > 0) ok(replay.mayo === sliceMayoCount(run.state), "reveal mayo counter matches");
}
// Reachability: scan further seeds for a rev-2 bot log that hits the cap.
for (let seed = 1; seed <= 60 && slice150 === null; seed++) {
  const run = botRun(slice2, seed * 7_919);
  if (run.score !== 150) continue;
  const raw = encodeSliceRun({ seed: seed * 7_919, claimedScore: 150, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
  const replay = replaySliceRun(seed * 7_919, raw, SLICE_REV);
  if (replay.score === 150 && !replay.flagged) slice150 = seed * 7_919;
}
console.log(`  150 reached through the server replay on rev 2 (seed ${slice150})`);
const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
console.log(`  bot scores — original: ${totals.v1.join(", ")} (mean ${mean(totals.v1).toFixed(1)}); rev 2: ${totals.v2.join(", ")} (mean ${mean(totals.v2).toFixed(1)})`);
ok(slice150 !== null, "a real rev-2 log reaches 150 through the server replay");
ok(totals.v2.filter((x) => x === 150).length <= totals.v1.filter((x) => x === 150).length + 2, "mayo does not make 150 routine");

// Chilli ends the combo on rev 2 only.
{
  const base = slice2.init(4242);
  const live = { ...base, comboLive: 1, streak: 2, comboUntil: 900, tick: 300 };
  const chilli = base.objects.findIndex((o) => o.bomb);
  const o = base.objects[chilli]!;
  const tick = o.launchTick + 30;
  const at = sliceObjectAt(o, tick, [])!;
  const x = Math.trunc(at.x / 256), y = Math.trunc(at.y / 256);
  const swipe = (st: SliceState) => ({ ...st, tick: tick - 1, comboUntil: tick + 600 });
  const cut: ArcadeInputEvent = { t: tick, k: SLICE_INPUT_SWIPE, a: Math.max(0, x - 30), b: y, c: Math.min(SLICE_WORLD_W, x + 30), d: y };
  const after2 = slice2.step(swipe(live), cut);
  const after1 = slice1.step(swipe({ ...live, rev: undefined, mayo: undefined }), cut);
  ok(after2.bombsHit === 1 && after2.comboLive === 0 && sliceMultiplier(after2.streak) === 1, "rev 2: a chilli ends the combo");
  ok(after1.bombsHit === 1 && after1.comboLive === 1, "original: a chilli only costs points");
}
ok(SLICE_MAYO_TICKS > 60 && SLICE_MAYO_TICKS < 90, "the squeeze lasts just over a second");
ok(INTRO_SCORE.slice.includes(`Up to ${roundMaxFor("slice")}`) && /lose 10/.test(INTRO_SCORE.slice), "Slice intro: up to its maximum, chilli loses 10");
}

/* ============================ 3. Intro rules ============================ */
section("intro text");
for (const type of ["cross", "flip", "balltrack", "slice"] as const) {
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines`);
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 110, `${type}: short intro line "${line.action}"`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: SCORE within 90 characters`);
}

console.log(`Arcade batch 1: ${checks} checks passed`);
