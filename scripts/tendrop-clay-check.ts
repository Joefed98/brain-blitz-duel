/**
 * Self-replay proof for Ten Drop and Clay Shoot only, plus generator checks.
 * Each run drives the sim the way the phone does (random candidate inputs,
 * some out of range, through recordInput; the sim reads only the log). The
 * submitted string must replay to the identical final state and score.
 *
 *   bun scripts/tendrop-clay-check.ts [runs]
 */

import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import {
  tenDropCheckpoint,
  tenDropGame,
  tdGreedy,
  tdSegmentOk,
  TD_CHECKPOINT_INTERVAL,
  TD_CONFIG,
  TD_INPUT_TAP,
  TD_TARGETS,
} from "@/lib/arcade/tenDrop";
import {
  clayCheckpoint,
  clayGame,
  CLAY_CHECKPOINT_INTERVAL,
  CLAY_COUNT,
  CLAY_FLYING,
  CLAY_INPUT_SHOT,
} from "@/lib/arcade/clayShoot";
import { encodeTenDropRun, replayTenDropRun } from "@/lib/duel/tenDrop";
import { encodeClayRun, replayClayRun } from "@/lib/duel/clayShoot";

const RUNS = Number(process.argv[2] ?? 200);
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("FAIL", msg);
};

/* --------------------------- Ten Drop generator --------------------------- */
let fallbacks = 0;
let maxTries = 0;
for (let seed = 1; seed <= 2000; seed++) {
  const s = tenDropGame.init(seed * 7919);
  for (let i = 0; i < TD_TARGETS; i++) {
    const stage = TD_CONFIG.stages[i]!;
    const t = s.plan.targets[i]!;
    if (t < stage.lo || t > stage.hi) fail(`tendrop seed ${seed} target ${i} out of range ${t}`);
    if (tdGreedy(t, s.plan.queues[i]!) < 0) fail(`tendrop seed ${seed} target ${i} unreachable`);
    if (s.plan.tries[i]! > TD_CONFIG.maxSegmentTries) fallbacks++;
    else if (!tdSegmentOk(stage, t, s.plan.queues[i]!)) fail(`tendrop seed ${seed} segment ${i} rules`);
    maxTries = Math.max(maxTries, Math.min(s.plan.tries[i]!, TD_CONFIG.maxSegmentTries));
  }
}
console.log(`tendrop generator: 2000 seeds × 10 targets proven; fallbacks ${fallbacks}; max tries ${maxTries}`);

/* ------------------------------ Self-replay ------------------------------ */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

let tdTime = 0;
let tdBest = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = (run * 2654435761) | 0;
  let rng = seed ^ 0x5bd1e995;
  const r = (n: number) => {
    const x = rngBelow(rng, n);
    rng = x.state;
    return x.value;
  };
  let state = tenDropGame.init(seed);
  const log: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof tenDropCheckpoint>[] = [];
  // Half the runs aim at real tiles with a near-greedy policy; half tap at random.
  const smart = run % 2 === 0;
  while (!tenDropGame.isOver(state)) {
    let cand: ArcadeInputEvent | null = null;
    if (smart && state.tiles.length && r(4) === 0) {
      const target = state.plan.targets[state.stage]!;
      const t = state.tiles[r(state.tiles.length)]!;
      cand = { t: state.tick + 1, k: TD_INPUT_TAP, a: t.col, b: Math.floor(t.y / 256) + 40, c: 0, d: 0 };
      void target;
    } else if (!smart && r(10) === 0) {
      cand = { t: state.tick + 1, k: r(20) === 0 ? 99 : TD_INPUT_TAP, a: r(7) - 1, b: r(700) - 50, c: 0, d: 0 };
    }
    recordInput(log, cand, tenDropGame.inputRanges);
    state = tenDropGame.step(state, inputAt(log, state.tick + 1));
    if (state.tick % TD_CHECKPOINT_INTERVAL === 0) cps.push(tenDropCheckpoint(state));
  }
  const raw = appendClientCounters(
    encodeTenDropRun({ seed, claimedScore: tenDropGame.score(state), events: log, endTick: state.tick, checkpoints: cps }),
    arcadeCounters("tendrop", state, tenDropGame.score(state)),
  );
  const t0 = performance.now();
  const res = replayTenDropRun(seed, raw);
  tdTime = Math.max(tdTime, performance.now() - t0);
  tdBest = Math.max(tdBest, res.score);
  if (!same(res.state, state) || res.score !== tenDropGame.score(state) || res.flagged || res.inputDiag.clamped || res.inputDiag.dropped)
    fail(`tendrop run ${run} replay mismatch ${res.reason ?? ""} ${res.desyncTick}`);
}
console.log(`tendrop self-replay ${RUNS} runs ok (failures so far ${failures}); slowest replay ${tdTime.toFixed(1)}ms; best random score ${tdBest}`);

let clayTime = 0;
let clayPerfect = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = (run * 40503 + 17) | 0;
  let rng = seed ^ 0x1234567;
  const r = (n: number) => {
    const x = rngBelow(rng, n);
    rng = x.state;
    return x.value;
  };
  let state = clayGame.init(seed);
  const log: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof clayCheckpoint>[] = [];
  const aimed = run % 2 === 0;
  while (!clayGame.isOver(state)) {
    let cand: ArcadeInputEvent | null = null;
    if (aimed) {
      // Aim at a flying clay's current position plus one tick of travel.
      const i = state.status.findIndex((s) => s === CLAY_FLYING);
      if (i >= 0 && r(3) === 0) {
        const x = Math.round((state.x[i]! + state.schedule.vx[i]!) / 256);
        const y = Math.round((state.y[i]! + state.vy[i]! + 20) / 256);
        cand = { t: state.tick + 1, k: CLAY_INPUT_SHOT, a: x, b: y, c: 0, d: 0 };
      }
    } else if (r(8) === 0) {
      cand = { t: state.tick + 1, k: r(20) === 0 ? 3 : CLAY_INPUT_SHOT, a: r(500) - 70, b: r(700) - 70, c: 0, d: 0 };
    }
    recordInput(log, cand, clayGame.inputRanges);
    state = clayGame.step(state, inputAt(log, state.tick + 1));
    if (state.tick % CLAY_CHECKPOINT_INTERVAL === 0) cps.push(clayCheckpoint(state));
  }
  if (state.hits + state.missed !== CLAY_COUNT) fail(`clay run ${run}: ${state.hits}+${state.missed} != 15`);
  if (aimed && state.hits === CLAY_COUNT) clayPerfect++;
  const raw = appendClientCounters(
    encodeClayRun({ seed, claimedScore: clayGame.score(state), events: log, endTick: state.tick, checkpoints: cps }),
    arcadeCounters("clayshoot", state, clayGame.score(state)),
  );
  const t0 = performance.now();
  const res = replayClayRun(seed, raw);
  clayTime = Math.max(clayTime, performance.now() - t0);
  if (!same(res.state, state) || res.score !== clayGame.score(state) || res.flagged || res.inputDiag.clamped || res.inputDiag.dropped)
    fail(`clay run ${run} replay mismatch ${res.reason ?? ""} ${res.desyncTick}`);
}
console.log(`clay self-replay ${RUNS} runs ok; slowest replay ${clayTime.toFixed(1)}ms; aimed bot 150s ${clayPerfect}/${RUNS / 2}`);

/* Clay schedule shape: two in the air at once only in the later half. */
let maxEarly = 0;
let maxLate = 0;
for (let seed = 1; seed <= 500; seed++) {
  let s = clayGame.init(seed * 31);
  let flightMin = 1e9;
  let flightMax = 0;
  const start: number[] = [];
  while (!clayGame.isOver(s)) {
    s = clayGame.step(s, null);
    const flying = s.status.filter((x) => x === CLAY_FLYING).length;
    if (s.tick < 1320) maxEarly = Math.max(maxEarly, flying);
    else maxLate = Math.max(maxLate, flying);
    s.status.forEach((x, i) => {
      if (x === CLAY_FLYING && start[i] === undefined) start[i] = s.tick;
      if (x !== CLAY_FLYING && start[i] !== undefined && s.doneTick[i] === s.tick) {
        flightMin = Math.min(flightMin, s.tick - start[i]!);
        flightMax = Math.max(flightMax, s.tick - start[i]!);
      }
    });
  }
  if (s.missed !== CLAY_COUNT) fail(`clay seed ${seed}: idle run lost ${s.missed}`);
  if (seed === 1) console.log(`clay flight time ${flightMin}–${flightMax} ticks`);
}
console.log(`clay max in air: first half ${maxEarly}, later half ${maxLate}`);

console.log(failures ? `${failures} FAILURES` : "ALL OK");
process.exit(failures ? 1 : 0);
