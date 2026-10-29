/**
 * Orbit on the arcade scoring standard (orbitRev 13, 29 Oct 2026; docs/arcade-standard/orbit.md).
 *
 * perfect(): the feature bank's witness tap logs (scripts/orbit-xp-lib.ts, the x200 oracle) replayed through the
 * server on orbitRev 13: every witness that reaches the sun with half the run or more left (342 of the 371 courses)
 * takes every mote, slingshot and field and at least 21 perfect orbits, so it scores 200; the first 40 of them are
 * replayed here. The other 29 witnesses reach the sun a little later (2,567–2,699 ticks left), so they miss part of
 * the speed share; one built state (the sun with every feature taken, quickly) is scored by the sim as well.
 * played(): SET CHECKPOINT only (one input, no flight), and a single release that crashes at once.
 * idle(): no input at all.
 */
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_STD, ORBIT_REV_XP } from "../../src/lib/arcade/orbit";
import {
  decodeOrbitExtras,
  decodeOrbitHoles,
  decodeRev3Planets,
  initStdFrom,
  orbitRev3Game,
  ORBIT_REV3_WORLD_W,
  ORBIT_STD,
  ORBIT_STD_SPEED_FULL_LEFT,
  type OrbitRev3State,
} from "../../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_XP_BANK, type OrbitXpBankEntry } from "../../src/lib/duel/orbitXpBank.server";
import type { StdEntry, StdRun } from "./entry";

const ev = (t: number, k: number): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
const planetsOf = (seed: number) => ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets;
const holesOf = (seed: number) => ORBIT_HOLE_BANK.find((e) => e.seed === seed)!.holes;
const startOf = (e: OrbitXpBankEntry) => initStdFrom(decodeRev3Planets(planetsOf(e.seed)), ORBIT_REV3_WORLD_W, decodeOrbitHoles(holesOf(e.seed)), decodeOrbitExtras(e.extras));

/** Plays an input log on the sim as the phone does (checkpoints every 300 ticks) and grades it through the server's replay. */
function serverScore(e: OrbitXpBankEntry, events: ArcadeInputEvent[]): { score: number; flagged: boolean; state: OrbitRev3State } {
  const at = new Map(events.map((x) => [x.t, x]));
  let s = startOf(e);
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = orbitRev3Game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: e.seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayOrbitRun(e.seed, raw, ORBIT_REV_STD, planetsOf(e.seed), holesOf(e.seed), e.extras);
  return { score: r.flagged ? -1 : r.score, flagged: Boolean(r.flagged), state: r.state as OrbitRev3State };
}

function witnessLeft(e: OrbitXpBankEntry): number {
  const taps = new Set(e.taps);
  let s = startOf(e);
  while (!s.ended) s = orbitRev3Game.step(s, taps.has(s.tick + 1) ? ev(s.tick + 1, ORBIT_INPUT_TAP) : null);
  return s.finished ? orbitRev3Game.runTicks - s.endedTick : -1;
}

export const entry: StdEntry = {
  type: "orbit",
  field: "orbitRev",
  rev: ORBIT_REV_STD,
  before: ORBIT_REV_XP,
  spec: ORBIT_STD,
  perfect: () => {
    const runs: StdRun[] = [];
    for (const e of ORBIT_XP_BANK) {
      if (runs.length >= 40) break;
      if (witnessLeft(e) < ORBIT_STD_SPEED_FULL_LEFT) continue;
      const r = serverScore(e, e.taps.map((t) => ev(t, ORBIT_INPUT_TAP)));
      runs.push({ label: `witness of feature-bank course ${e.seed} (server replay)`, score: r.score });
    }
    // Built: the sun reached with 50 s left, every mote, slingshot and field taken and 21 perfect orbits.
    const s0 = startOf(ORBIT_XP_BANK[0]!);
    const built = { ...s0, finished: 1, ended: 1, endedTick: 2400, best: 40, dustGot: 2 ** 30 - 1, slung: 15, threaded: 7, perfect: 21, acted: 1 } as OrbitRev3State;
    runs.push({ label: "built: the sun with 50 s left and every feature", score: orbitRev3Game.score(built) });
    return runs;
  },
  played: () => {
    const e = ORBIT_XP_BANK[0]!;
    const runs: StdRun[] = [{ label: "SET CHECKPOINT only, then no release", score: serverScore(e, [ev(5, ORBIT_INPUT_CHECKPOINT)]).score }];
    // A single release that crashes having flown no sixteenth toward planet 1 (the first such delay in the first lap).
    for (let d = 1; d < 400; d++) {
      const r = serverScore(e, [ev(d, ORBIT_INPUT_TAP)]);
      if (r.state.best === 0 && (r.state.reach ?? 0) === 0 && r.state.ended === 2) {
        runs.push({ label: `one release at tick ${d} that crashes at once`, score: r.score });
        break;
      }
    }
    return runs;
  },
  idle: () => [{ label: "no input (server replay)", score: serverScore(ORBIT_XP_BANK[0]!, []).score }],
  helpTerms: ["Planets", "130", "half the time left"],
};
