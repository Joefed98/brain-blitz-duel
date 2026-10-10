/** Lean orbitRev 3 stats: fallback hops, >120-unit sideways hops, bot completion ticks (rev3 proof bot vs classic careful bot).
 * Usage: bun scripts/orbit-rev3-quick-stats.ts <bank|random> <start> <end> */
import { buildCourse3, runRev3BotWithTaps, ORBIT_REV3_WORLD_W } from "../src/lib/arcade/orbitRev3";
import { orbitGame, ORBIT_TOTAL, ORBIT_FLIGHT_MAX, ORBIT_INPUT_TAP, ORBIT_BELT_PERIOD_TICKS, lapPhases } from "../src/lib/arcade/orbit";
import { ORBIT_REV3_MIN_WINDOW } from "../src/lib/arcade/orbitRev3";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";

const [mode, a, b] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const FP = 256;
const seeds =
  mode === "bank"
    ? ORBIT_REV3_BANK.slice(a, b).map((e) => e.seed)
    : Array.from({ length: b - a }, (_, i) => Number((BigInt(a + i + 1) * 2654435761n) % 2147483647n));
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
    if (branch.ended === 0 || branch.finished === 1) {
      let guard = 0;
      while (branch.flying > 0 && branch.ended === 0 && guard < flightMax + 5) {
        branch = step(branch, null);
        guard++;
      }
      success = (branch.ended === 0 || branch.finished === 1) && branch.cur > startCur;
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
const out: unknown[] = [];
for (const seed of seeds) {
  const { planets } = buildCourse3(seed, ORBIT_REV3_WORLD_W);
  const fb = (planets as any).__fallbacks ?? 0;
  let lat = 0;
  for (let i = 1; i < planets.length; i++) if (Math.abs(planets[i]!.x - planets[i - 1]!.x) / FP > 120) lat++;
  const bot = runRev3BotWithTaps(planets, ORBIT_REV3_WORLD_W);
  out.push({ seed, hops: planets.length - 1, fb, lat, r3: (bot.proof as any).ticks, r3ok: bot.proof.ok, old: proveRev2(seed) });
}
console.log(JSON.stringify(out));
