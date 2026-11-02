/**
 * arcade-standard-check's entry for `ricochet` (Ricochet ricoRev 2, the ninja wall-climb, Action;
 * docs/arcade-standard/ricochet.md): born on the standard (the old ball-and-spikes shaft, unstamped, never had a band
 * revision and scores as before). Perfect runs play each tower's witness (the route the deal proved) through the
 * server's replay: 24 seeds by default, `CHECKS_FULL=1` 200. The core is metres climbed on a straight line, full at
 * NINJA_CORE_FULL_M (the near-perfect skill-band median); coins, lanterns and scrolls split their caps evenly.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  ninjaCheckpoint,
  ninjaDeal,
  ninjaGame,
  ninjaStdParts,
  NINJA_CHECKPOINT_INTERVAL,
  NINJA_COINS,
  NINJA_CORE_FULL_M,
  NINJA_INPUT_TAP,
  NINJA_LANTERNS,
  NINJA_PX_PER_M,
  NINJA_SCROLLS,
  NINJA_START,
  type NinjaState,
} from "../../src/lib/arcade/ricochetNinja";
import { ricoGame } from "../../src/lib/arcade/ricochet";
import { encodeNinjaRun, replayNinjaRun } from "../../src/lib/duel/ricochet";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.ricochet!.spec!;
const rec = (s: NinjaState) => Object.fromEntries((ninjaStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: NinjaState) => Object.fromEntries((ninjaStdParts(s) ?? []).map((p) => [p.key, p.max]));
const FULL = process.env["CHECKS_FULL"] === "1";
const SEEDS = FULL ? Array.from({ length: 200 }, (_, i) => i * 7919 + 1) : [0, 1, 2, 3, 77, 10000, 123456789, ...Array.from({ length: 17 }, (_, i) => 5000 + i * 131)];

/** A tap list played as the phone would and sent through the server's replay. */
export function ninjaRaw(seed: number, taps: readonly number[]): string {
  const events: ArcadeInputEvent[] = taps.map((t) => ({ t, k: NINJA_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }));
  const at = new Map(events.map((e) => [e.t, e]));
  let s = ninjaGame.init(seed);
  const cps = [];
  while (!ninjaGame.isOver(s)) {
    s = ninjaGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(ninjaCheckpoint(s));
  }
  return encodeNinjaRun({ seed, claimedScore: ninjaGame.score(s), events, endTick: s.tick, checkpoints: cps });
}

export const entry: StdEntry = {
  type: "ricochet",
  field: "ricoRev",
  rev: 2,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    SEEDS.map((seed) => {
      const r = replayNinjaRun(seed, ninjaRaw(seed, ninjaDeal(seed).witnessTaps));
      return { label: `seed ${seed}'s witness through the server replay${r.flagged ? " (FLAGGED)" : ""}`, score: r.flagged ? -1 : r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [
    { label: "one tap, then idle", score: replayNinjaRun(4, ninjaRaw(4, [3])).score },
    { label: "a tap on the first tick", score: ninjaGame.score({ ...ninjaGame.init(9), acted: 1 }), want: 1 },
  ],
  idle: () => [
    { label: "an untouched init(12)", score: ninjaGame.score(ninjaGame.init(12)) },
    { label: "a whole run with no input", score: replayNinjaRun(5, ninjaRaw(5, [])).score },
  ],
  help: { terms: ["metre", "coins", "lanterns", "scrolls"] },
  core: {
    fullAt: NINJA_CORE_FULL_M,
    at: (m: number) => ({ ...ninjaGame.init(3), acted: 1, best: NINJA_START + m * NINJA_PX_PER_M * 256 }),
    parts: (s: NinjaState) => ninjaStdParts(s),
  },
  older: () => ninjaStdParts(ricoGame.init(1) as any) === null,
  extra(ok) {
    const d = ninjaDeal(31);
    ok(d.tower.coins.length === NINJA_COINS && d.tower.lanterns.length === NINJA_LANTERNS && d.tower.scrolls.length === NINJA_SCROLLS, "ricochet: every tower deals 60 coins, 10 lanterns and 4 scrolls");
    const one = (k: "coins" | "lanterns" | "scrolls", n: number) => rec({ ...ninjaGame.init(3), acted: 1, [k]: n } as NinjaState)[k];
    ok(one("coins", 2) === 1 && one("coins", NINJA_COINS) === 30 && one("lanterns", 1) === 2 && one("scrolls", 1) === 5, "ricochet: coins 0.5 each (floored on the line), lanterns 2 each, scrolls 5 each");
    ok(d.witnessMetres >= NINJA_CORE_FULL_M, `ricochet: seed 31's witness climbs at least ${NINJA_CORE_FULL_M} m (${d.witnessMetres})`);
  },
};
