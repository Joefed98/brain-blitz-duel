/**
 * Records scripts/fixtures/orbit-fuel-legacy.json on main before orbitRev 14 (the fuel meter, 1 Nov 2026,
 * docs/arcade-standard/orbit.md): runs on orbitRev 10, 12 and 13 (the feature-bank courses rooms dealt) played on the
 * sim as the phone does and graded through the server's replay, with each run's score and final state.
 * orbit-fuel-check replays every one and fails on any difference.
 *
 *   bun scripts/orbit-fuel-legacy.ts      # writes the fixture (run on unmodified main)
 */
import { writeFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP } from "../src/lib/arcade/orbit";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, orbitRev3Game, orbitRev3StartFor, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_XP_BANK } from "../src/lib/duel/orbitXpBank.server";

export interface OrbitLegacyRun {
  label: string;
  rev: number;
  seed: number;
  raw: string;
  score: number;
  state: Record<string, number>;
}

const ev = (t: number, k: number): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
export const planetsOf = (seed: number) => ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets;
export const holesOf = (seed: number) => ORBIT_HOLE_BANK.find((e) => e.seed === seed)!.holes;
export const extrasOf = (seed: number) => ORBIT_XP_BANK.find((e) => e.seed === seed)!.extras;
/** The fields a final state is compared on. */
export const LEGACY_KEYS = ["tick", "cur", "best", "finished", "ended", "endedTick", "reach", "dustGot", "slung", "threaded", "perfect", "jumps", "respawns", "x", "y", "captured"] as const;
export function pick(s: OrbitRev3State): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of LEGACY_KEYS) out[k] = Number((s as unknown as Record<string, number>)[k] ?? 0);
  return out;
}

function play(rev: number, seed: number, events: ArcadeInputEvent[]): { raw: string } {
  const start = orbitRev3StartFor(rev, rev >= 12 ? decodeOrbitExtras(extrasOf(seed)) : null)!;
  let s = start(decodeRev3Planets(planetsOf(seed)), ORBIT_REV3_WORLD_W, decodeOrbitHoles(holesOf(seed)));
  const at = new Map(events.map((x) => [x.t, x]));
  const checkpoints: unknown[] = [];
  const used: ArcadeInputEvent[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    const e = at.get(s.tick + 1) ?? null;
    if (e) used.push(e);
    s = orbitRev3Game.step(s, e);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  return { raw: encodeOrbitRun({ seed, claimedScore: orbitRev3Game.score(s), events: used, inputs: [], taps: [], endTick: s.tick, checkpoints } as never) };
}

export function grade(rev: number, seed: number, raw: string) {
  return replayOrbitRun(seed, raw, rev, planetsOf(seed), holesOf(seed), rev >= 12 ? extrasOf(seed) : undefined);
}

/** A small seeded PRNG for the scripted runs (the recorder only, never a sim). */
function lcg(seed: number) {
  let x = seed >>> 0 || 1;
  return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
}

if (import.meta.main) {
  const runs: OrbitLegacyRun[] = [];
  const courses = [0, 1, 2, 5, 11, 40, 97, 150, 233, 300].map((i) => ORBIT_XP_BANK[i % ORBIT_XP_BANK.length]!);
  for (const rev of [10, 12, 13]) {
    for (const [ci, e] of courses.entries()) {
      const r = lcg(e.seed ^ (rev * 7919));
      const half = Math.trunc(e.taps.length / 2);
      const scripted: [string, ArcadeInputEvent[]][] = [
        ["witness", e.taps.map((t) => ev(t, ORBIT_INPUT_TAP))],
        // The witness with every tap after the first third late by a few ticks: misses, crashes and skips.
        ["witness, late from a third", e.taps.map((t, i) => ev(i > e.taps.length / 3 ? t + 3 + (i % 5) : t, ORBIT_INPUT_TAP))],
        ["witness to half, then a checkpoint and random taps", [...e.taps.slice(0, half).map((t) => ev(t, ORBIT_INPUT_TAP)), ev(e.taps[half - 1]! + 120, ORBIT_INPUT_CHECKPOINT), ...Array.from({ length: 30 }, (_, k) => ev(e.taps[half - 1]! + 200 + k * 90 + Math.trunc(r() * 60), ORBIT_INPUT_TAP))]],
        ["random taps", Array.from({ length: 40 }, (_, k) => ev(20 + k * 120 + Math.trunc(r() * 100), ORBIT_INPUT_TAP))],
      ];
      if (ci >= 6) scripted.splice(1, 2);
      for (const [label, events] of scripted) {
        const dedup = [...new Map(events.filter((x) => x.t >= 1).map((x) => [x.t, x])).values()].sort((a, b) => a.t - b.t);
        const { raw } = play(rev, e.seed, dedup);
        const g = grade(rev, e.seed, raw);
        if (g.flagged) throw new Error(`flagged: rev ${rev} ${e.seed} ${label}`);
        runs.push({ label, rev, seed: e.seed, raw, score: g.score, state: pick(g.state as OrbitRev3State) });
      }
    }
  }
  writeFileSync("scripts/fixtures/orbit-fuel-legacy.json", JSON.stringify(runs) + "\n");
  console.log(`wrote ${runs.length} runs: ${runs.map((x) => `${x.rev}:${x.score}`).join(" ")}`);
}
