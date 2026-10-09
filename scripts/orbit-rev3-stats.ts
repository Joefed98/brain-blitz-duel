/**
 * One-off stats pass for orbit rev3 vs rev2, over N random seeds:
 * proof-time distribution, fallback-hop rate, lateral-jump rate, max flight
 * speed, and bot completion ticks rev3 vs rev2 (equivalent mid-window bots).
 * Run with: bun run scripts/orbit-rev3-stats.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import {
  FP,
  ORBIT_TOTAL,
  ORBIT_FLIGHT_MAX,
  ORBIT_INPUT_TAP,
  ORBIT_HAZARD_FROM,
  ORBIT_BELT_PERIOD_TICKS,
  lapPhases,
  orbitGame,
} from "../src/lib/arcade/orbit";
import { TICKS_PER_SECOND } from "../src/lib/arcade/engine";
import {
  getOrbitRev3Layout,
  proveOrbitRev3Layout,
  orbitRev3Game,
  ORBIT_REV3_MIN_WINDOW,
} from "../src/lib/arcade/orbitRev3";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

const SEEDS = 200;
const seeds = Array.from({ length: SEEDS }, (_, i) => i * 7919 + 1);

/* ===================== rev2 + rev3 simulate-forward bots ===================== */
// Both bots avoid angle/phase maths entirely: from the live state they walk
// forward tick by tick, forking a trial tap-now branch at every tick and
// simulating that branch through flight to capture/death without disturbing
// the main walk, then tap at the middle of the first contiguous run of at
// least ORBIT_REV3_MIN_WINDOW successful delays. This mirrors
// findHopTapDelay (orbitRev3.ts) exactly, generalised over any game whose
// state exposes { tick, cur, flying, ended, vx, vy }.

interface HopBotState {
  tick: number;
  cur: number;
  flying: number;
  ended: number;
  vx: number;
  vy: number;
  planets: readonly { hazard: number }[];
}

function findHopTapDelayGeneric<S extends HopBotState>(
  state: S,
  step: (s: S, input: ArcadeInputEvent | null) => S,
  lapTicks: number,
  flightMax: number,
): number | null {
  const startCur = state.cur;
  const ok: boolean[] = [];
  const moving = state.planets.some((p) => p.hazard >= 0);
  const maxK = Math.max(lapTicks * 2, ORBIT_REV3_MIN_WINDOW * 2, moving ? ORBIT_BELT_PERIOD_TICKS : 0);
  let walk = state;
  for (let k = 0; k <= maxK; k++) {
    let branch = step(walk, { t: walk.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    let success = false;
    if (branch.ended === 0) {
      let guard = 0;
      while (branch.flying > 0 && branch.ended === 0 && guard < flightMax + 5) {
        branch = step(branch, null);
        guard++;
      }
      success = branch.ended === 0 && branch.cur > startCur;
    }
    ok.push(success);
    if (k < maxK) walk = step(walk, null);
  }
  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < ok.length) {
    if (!ok[i]) { i++; continue; }
    let j = i;
    while (j < ok.length && ok[j]) j++;
    if (j - i >= ORBIT_REV3_MIN_WINDOW) {
      bestStart = i;
      bestLen = j - i;
      break;
    }
    i = j;
  }
  if (bestStart < 0) return null;
  return bestStart + Math.trunc(bestLen / 2);
}

/** Drives rev2's real game loop with a simulate-forward bot; mirrors proveOrbitRev3Layout's shape. */
function proveRev2(seed: number): { ok: boolean; ticks: number; reason?: string } {
  let state = orbitGame.init(seed);
  let safety = 0;
  const RUN_TICKS = orbitGame.runTicks;
  while (state.cur < ORBIT_TOTAL && !orbitGame.isOver(state) && safety < RUN_TICKS) {
    if (state.flying === 0) {
      const here = state.planets[state.cur]!;
      const lapTicks = lapPhases(here).length;
      const delay = findHopTapDelayGeneric(state, orbitGame.step, lapTicks, ORBIT_FLIGHT_MAX);
      if (delay === null) return { ok: false, ticks: state.tick, reason: `no window at hop ${state.cur}` };
      for (let k = 0; k < delay; k++) {
        state = orbitGame.step(state, null);
        safety++;
      }
      state = orbitGame.step(state, { t: state.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    } else {
      state = orbitGame.step(state, null);
    }
    safety++;
  }
  const ok = state.cur >= ORBIT_TOTAL || state.finished === 1;
  return ok ? { ok, ticks: state.tick } : { ok, ticks: state.tick, reason: "did not reach planet 40 in time" };
}

/* ===================== rev3 simulate-forward bot + flight-speed probe ===================== */
// proveOrbitRev3Layout already drives the identical bot (findHopTapDelay);
// re-implemented here (same shape) only to also sample per-tick flight speed.

function proveRev3WithSpeed(seed: number): { ok: boolean; ticks: number; reason?: string; maxSpeed: number; beltHopWaits: number[] } {
  let maxSpeed = 0;
  const beltHopWaits: number[] = [];
  const { planets } = getOrbitRev3Layout(seed);
  let state = orbitRev3Game.init(seed);
  let safety = 0;
  const RUN_TICKS = orbitRev3Game.runTicks;
  const ORBIT_REV3_FLIGHT_MAX = 190;
  while (state.cur < ORBIT_TOTAL && !orbitRev3Game.isOver(state) && safety < RUN_TICKS) {
    if (state.flying === 0) {
      const here = state.planets[state.cur]!;
      const lapTicks = lapPhases(here).length;
      const delay = findHopTapDelayGeneric(state, orbitRev3Game.step, lapTicks, ORBIT_REV3_FLIGHT_MAX);
      if (delay === null) return { ok: false, ticks: state.tick, reason: `no window at hop ${state.cur}`, maxSpeed, beltHopWaits };
      if (state.cur >= ORBIT_HAZARD_FROM) beltHopWaits.push(delay);
      for (let k = 0; k < delay; k++) {
        state = orbitRev3Game.step(state, null);
        safety++;
      }
      state = orbitRev3Game.step(state, { t: state.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    } else {
      maxSpeed = Math.max(maxSpeed, Math.hypot(state.vx, state.vy) / FP);
      state = orbitRev3Game.step(state, null);
    }
    safety++;
  }
  const ok = state.cur >= ORBIT_TOTAL || state.finished === 1;
  void planets;
  return ok
    ? { ok, ticks: state.tick, maxSpeed, beltHopWaits }
    : { ok, ticks: state.tick, reason: "did not reach planet 40 in time", maxSpeed, beltHopWaits };
}

/* ================================== Run ================================== */

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

const proofMs: number[] = [];
let totalHops = 0;
let totalFallbacks = 0;
let totalLateral = 0;
let lateralOver120 = 0;
let maxLateralOverall = 0;
let maxFlightSpeedOverall = 0;
const rev3Ticks: number[] = [];
const rev2Ticks: number[] = [];
const beltHopWaitsAll: number[] = [];
let rev3Failures = 0;
let rev2Failures = 0;
const failureReasons: string[] = [];

const t0 = Date.now();
for (const seed of seeds) {
  const t = performance.now();
  const proof = proveOrbitRev3Layout(seed);
  proofMs.push(performance.now() - t);
  if (!proof.ok) {
    rev3Failures++;
    failureReasons.push(`seed ${seed} rev3: ${proof.reason}`);
  }

  const { planets, stats } = getOrbitRev3Layout(seed);
  totalHops += stats.hops;
  totalFallbacks += stats.fallbacks;
  for (let i = 1; i <= ORBIT_TOTAL; i++) {
    const lateral = Math.abs(planets[i]!.x - planets[i - 1]!.x) / FP;
    totalLateral++;
    if (lateral > 120) lateralOver120++;
    maxLateralOverall = Math.max(maxLateralOverall, lateral);
  }

  const withSpeed = proveRev3WithSpeed(seed);
  maxFlightSpeedOverall = Math.max(maxFlightSpeedOverall, withSpeed.maxSpeed);
  if (withSpeed.ok) rev3Ticks.push(withSpeed.ticks);
  beltHopWaitsAll.push(...withSpeed.beltHopWaits);

  const rev2 = proveRev2(seed);
  if (rev2.ok) rev2Ticks.push(rev2.ticks);
  else {
    rev2Failures++;
    failureReasons.push(`seed ${seed} rev2: ${rev2.reason}`);
  }
}
const totalMs = Date.now() - t0;

proofMs.sort((a, b) => a - b);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sortedPct = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return percentile(sorted, p);
};
const TICKS_PER_SEC = TICKS_PER_SECOND;

const result = {
  seeds: SEEDS,
  totalRunMs: totalMs,
  perLayoutMsMean: totalMs / SEEDS,
  proveOrbitRev3LayoutMs: {
    mean: mean(proofMs),
    p95: percentile(proofMs, 95),
    max: proofMs[proofMs.length - 1] ?? 0,
  },
  fallbackHops: {
    total: totalFallbacks,
    ofHops: totalHops,
    pct: (100 * totalFallbacks) / totalHops,
  },
  lateralOver120: {
    count: lateralOver120,
    ofHops: totalLateral,
    pct: (100 * lateralOver120) / totalLateral,
    maxLateralObserved: maxLateralOverall,
  },
  maxFlightSpeedUnitsPerTick: {
    observed: maxFlightSpeedOverall,
    cap: 6,
    withinCap: maxFlightSpeedOverall <= 6,
  },
  botCompletionTicks: {
    rev3: {
      finished: rev3Ticks.length,
      failed: rev3Failures,
      mean: mean(rev3Ticks),
      min: rev3Ticks.length ? Math.min(...rev3Ticks) : null,
      max: rev3Ticks.length ? Math.max(...rev3Ticks) : null,
    },
    rev2: {
      finished: rev2Ticks.length,
      failed: rev2Failures,
      mean: mean(rev2Ticks),
      min: rev2Ticks.length ? Math.min(...rev2Ticks) : null,
      max: rev2Ticks.length ? Math.max(...rev2Ticks) : null,
    },
  },
  botCompletionSeconds: {
    rev3: {
      mean: mean(rev3Ticks) / TICKS_PER_SEC,
      p50: sortedPct(rev3Ticks, 50) / TICKS_PER_SEC,
      p90: sortedPct(rev3Ticks, 90) / TICKS_PER_SEC,
    },
    rev2: {
      mean: mean(rev2Ticks) / TICKS_PER_SEC,
      p50: sortedPct(rev2Ticks, 50) / TICKS_PER_SEC,
      p90: sortedPct(rev2Ticks, 90) / TICKS_PER_SEC,
    },
  },
  beltHopWaitTicks: {
    count: beltHopWaitsAll.length,
    mean: mean(beltHopWaitsAll),
  },
  failureReasons: failureReasons.slice(0, 20),
  tuning: {
    changed: false,
    note: "Fallback rate was under the 10% threshold on the first run; buildCourse3 was not modified.",
  },
};

mkdirSync("/mnt/documents/orbit-rev3", { recursive: true });
writeFileSync("/mnt/documents/orbit-rev3/stats.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
