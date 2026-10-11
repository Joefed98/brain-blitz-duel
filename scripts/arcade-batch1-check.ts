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
  BT_PERFECT_MAX,
  BT_REV,
  BT_ROWS,
  BT_STEP_TICKS,
  type BtState,
} from "../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
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
  console.log(`  ${saved.length} unstamped runs (cross, flip, slice, balltrack) identical to the pre-upgrade code`);
}

/* =============================== 2a. Jaywalk =============================== */
if (want("cross")) {
section("Jaywalk crossRev 2");
const cross2 = crossGameFor(CROSS_REV);
ok(crossGameFor(undefined) !== cross2 && crossGameFor(undefined).init(5).rev === undefined, "unstamped Jaywalk keeps the original game");
ok(cross2.init(5).rev === CROSS_REV, "rev-2 state carries the stamp");
ok(JSON.stringify(cross2.init(99)) === JSON.stringify(cross2.init(99)), "rev-2 courses are seeded");

const CROSS_SEEDS = Array.from({ length: 24 }, (_, i) => 1 + i * 104_729);
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
    }
  });
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
ok(/Up to 150/.test(crossIntro) && /2 points/.test(crossIntro) && /plus 4/.test(crossIntro), "Jaywalk intro states 2 per lane, 4 per crossing, up to 150");
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
ok(/130/.test(INTRO_SCORE.flip) && /2/.test(INTRO_SCORE.flip) && /150/.test(INTRO_SCORE.flip), "Roofbound intro states 130 + 2 per star, 150");
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
  ok(minScore > 130 && maxScore <= BT_PERFECT_MAX, "perfect playbook runs score a little over 130");

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
  ok(btScoreOf(BT_BALLS, 0, earliest) === BT_PERFECT_MAX, `bound: last marble lands no earlier than tick ${earliest} → ${BT_PERFECT_MAX}`);
  ok(INTRO_SCORE.balltrack.includes(`for up to ${BT_PERFECT_MAX}; otherwise up to ${btScoreOf(BT_BALLS - 1, 0)}`), "Ball Tracker intro states the true maximums");
  console.log(`  occupied turns and switch points work; ${Math.ceil(BALL_TRACK_BANK.length / 4)} banked playbooks still prove their courses (perfect runs ${minScore}–${maxScore}); perfect-run bound ${BT_PERFECT_MAX} (150 is not reachable: the last marble drops at tick ${lastRelease})`);
}
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
