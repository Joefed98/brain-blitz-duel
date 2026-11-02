/**
 * Orbit on the arcade scoring standard (orbitRev 13, 29 Oct 2026; orbitRev 14, the fuel meter, 1 Nov 2026;
 * docs/arcade-standard/orbit.md).
 *
 * Rooms deal orbitRev 14: the fuel bank's zigzag courses (src/lib/duel/orbitFuelBank.server.ts,
 * scripts/orbit-fuel-bank.ts), scored on orbitRev 13's parts.
 * perfect(): the fuel bank's witness tap logs (scripts/orbit-fuel-lib.ts, the oracle) replayed through the server on
 * orbitRev 14: every bank course's witness takes every mote, slingshot and field (and 2 or 3 black holes) and at least 21 perfect orbits and
 * reaches the sun with half the run or more left (the bank keeps only such courses), so it scores 200; the first 40 are
 * replayed here (orbit-fuel-check replays every one). One built state (the sun with every feature taken, quickly) is
 * scored by the sim as well.
 * played(): SET CHECKPOINT only (one input, no flight), and a single release into empty space that runs dry.
 * idle(): no input at all.
 */
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_FUEL, ORBIT_REV_STD } from "../../src/lib/arcade/orbit";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initFuelFrom, orbitRev3Game, ORBIT_REV3_WORLD_W, ORBIT_STD, type OrbitRev3State } from "../../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../../src/lib/duel/orbit";
import { ORBIT_FUEL_BANK, type OrbitFuelBankEntry } from "../../src/lib/duel/orbitFuelBank.server";
import type { StdEntry, StdRun } from "./entry";

const ev = (t: number, k: number): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
const startOf = (e: OrbitFuelBankEntry) => initFuelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras));

/** Plays an input log on the sim as the phone does (checkpoints every 300 ticks) and grades it through the server's replay. */
export function orbitFuelServerScore(e: OrbitFuelBankEntry, events: ArcadeInputEvent[]): { score: number; flagged: boolean; state: OrbitRev3State } {
  const at = new Map(events.map((x) => [x.t, x]));
  let s = startOf(e);
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = orbitRev3Game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: e.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayOrbitRun(e.seed, raw, ORBIT_REV_FUEL, e.planets, e.holes, e.extras);
  return { score: r.flagged ? -1 : r.score, flagged: Boolean(r.flagged), state: r.state as OrbitRev3State };
}

export const entry: StdEntry = {
  type: "orbit",
  field: "orbitRev",
  rev: ORBIT_REV_FUEL,
  before: ORBIT_REV_STD,
  parts: ORBIT_STD.parts,
  spec: ORBIT_STD,
  perfect: () => {
    const runs: StdRun[] = [];
    for (const e of ORBIT_FUEL_BANK.slice(0, 40)) {
      const r = orbitFuelServerScore(e, e.taps.map((t) => ev(t, ORBIT_INPUT_TAP)));
      runs.push({ label: `witness of fuel-bank course ${e.seed} (server replay)`, score: r.score });
    }
    // Built: the sun reached with 50 s left, every mote, slingshot and field taken and 21 perfect orbits.
    const s0 = startOf(ORBIT_FUEL_BANK[0]!);
    const built = { ...s0, finished: 1, ended: 1, endedTick: 2400, best: 40, dustGot: 2 ** 30 - 1, slung: 15, threaded: 7, perfect: 21, acted: 1 } as OrbitRev3State;
    runs.push({ label: "built: the sun with 50 s left and every feature", score: orbitRev3Game.score(built) });
    return runs;
  },
  played: () => {
    const e = ORBIT_FUEL_BANK[0]!;
    const runs: StdRun[] = [{ label: "SET CHECKPOINT only, then no release", score: orbitFuelServerScore(e, [ev(5, ORBIT_INPUT_CHECKPOINT)]).score }];
    // A single release that flies no sixteenth toward planet 1 and ends (dry or a crash): the first such delay.
    for (let d = 1; d < 400; d++) {
      const r = orbitFuelServerScore(e, [ev(d, ORBIT_INPUT_TAP)]);
      if (r.state.best === 0 && (r.state.reach ?? 0) === 0 && r.state.ended === 2) {
        runs.push({ label: `one release at tick ${d} that ends at once`, score: r.score });
        break;
      }
    }
    return runs;
  },
  idle: () => [{ label: "no input (server replay)", score: orbitFuelServerScore(ORBIT_FUEL_BANK[0]!, []).score }],
  help: { terms: ["Planets", "130", "half the time left"] },
};
