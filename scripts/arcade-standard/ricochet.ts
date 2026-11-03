/**
 * arcade-standard-check's entry for `ricochet` (Moon Climb, ricoRev 3 since 3 Nov 2026, Action;
 * docs/arcade-standard/ricochet.md): the ninja wall-climb was born on the standard at ricoRev 2 (the old ball-and-spikes
 * shaft, unstamped, never had a band revision and scores as before). Perfect runs play each tower's witness (the route
 * the deal proved) through the server's replay: 24 seeds by default, `CHECKS_FULL=1` 200. The core is metres climbed
 * on a straight line, full at MOON_CORE_FULL_M; flow 3 for every 7 clean leaps in a row (up to 30), lantern rides 5
 * each (6), scrolls 5 each (3). ricoRev 2's coins, lanterns and scrolls still score its states.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  moonCheckpoint,
  moonDeal,
  moonGame,
  moonStdParts,
  ninjaGame,
  ninjaStdParts,
  NINJA_CHECKPOINT_INTERVAL,
  MOON_CORE_FULL_M,
  MOON_FLOW_EACH,
  MOON_RIDE_EACH,
  MOON_SCROLL_EACH,
  MOON_SCROLLS,
  MOON_SKY,
  NINJA_INPUT_TAP,
  NINJA_PX_PER_M,
  NINJA_START,
  type MoonEvent,
  type MoonState,
} from "../../src/lib/arcade/ricochetNinja";
import { ricoGame } from "../../src/lib/arcade/ricochet";
import { encodeMoonRun, replayMoonRun } from "../../src/lib/duel/ricochet";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.ricochet!.spec!;
const rec = (s: MoonState) => Object.fromEntries((moonStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: MoonState) => Object.fromEntries((moonStdParts(s) ?? []).map((p) => [p.key, p.max]));
const FULL = process.env["CHECKS_FULL"] === "1";
const SEEDS = FULL ? Array.from({ length: 200 }, (_, i) => i * 7919 + 1) : [0, 1, 2, 3, 77, 10000, 123456789, ...Array.from({ length: 17 }, (_, i) => 5000 + i * 131)];

/** A tap list (tick and direction) played as the phone would and sent through the server's replay. */
export function moonRaw(seed: number, taps: readonly MoonEvent[]): string {
  const events: ArcadeInputEvent[] = taps.map((e) => ({ t: e.t, k: NINJA_INPUT_TAP, a: e.a, b: 0, c: 0, d: 0 }));
  const at = new Map(events.map((e) => [e.t, e]));
  let s = moonGame.init(seed);
  const cps = [];
  while (!moonGame.isOver(s)) {
    s = moonGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: moonGame.score(s), events, endTick: s.tick, checkpoints: cps });
}

export const entry: StdEntry = {
  type: "ricochet",
  field: "ricoRev",
  rev: 3,
  before: 2,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    SEEDS.map((seed) => {
      const r = replayMoonRun(seed, moonRaw(seed, moonDeal(seed).witness));
      return { label: `seed ${seed}'s witness through the server replay${r.flagged ? " (FLAGGED)" : ""}`, score: r.flagged ? -1 : r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [
    { label: "one tap, then idle", score: replayMoonRun(4, moonRaw(4, [{ t: 3, a: 0 }])).score },
    { label: "a tap on the first tick", score: moonGame.score({ ...moonGame.init(9), acted: 1 }), want: 1 },
  ],
  idle: () => [
    { label: "an untouched init(12)", score: moonGame.score(moonGame.init(12)) },
    { label: "a whole run with no input", score: replayMoonRun(5, moonRaw(5, [])).score },
  ],
  help: { terms: ["metre", "Flow", "lantern", "scrolls"] },
  core: {
    fullAt: MOON_CORE_FULL_M,
    at: (m: number) => ({ ...moonGame.init(3), acted: 1, best: NINJA_START + m * NINJA_PX_PER_M * 256 }),
    parts: (s: MoonState) => moonStdParts(s),
  },
  older: () => moonStdParts(ninjaGame.init(1) as any) === null && moonStdParts(ricoGame.init(1) as any) === null && (ninjaStdParts(ninjaGame.init(1)) ?? []).length === 4,
  extra(ok) {
    const d = moonDeal(31);
    ok(d.tower.coins.length === 0 && d.tower.lanterns.length === 0 && d.tower.sky.length === MOON_SKY && d.tower.scrolls.length === MOON_SCROLLS, "ricochet: every tower deals no coins or gold lanterns, 6 sky lanterns and 3 scrolls");
    const one = (k: "flow" | "rides" | "scrolls", n: number) => rec({ ...moonGame.init(3), acted: 1, [k]: n } as MoonState)[k];
    ok(one("flow", 1) === MOON_FLOW_EACH && one("flow", 40) === 30 && one("rides", 1) === MOON_RIDE_EACH && one("scrolls", 1) === MOON_SCROLL_EACH, "ricochet: flow 3 a step (held to 30), rides 5 each, scrolls 5 each");
    ok(d.witnessMetres >= MOON_CORE_FULL_M, `ricochet: seed 31's witness climbs at least ${MOON_CORE_FULL_M} m (${d.witnessMetres})`);
  },
};
