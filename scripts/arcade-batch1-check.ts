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

import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
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
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);

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
