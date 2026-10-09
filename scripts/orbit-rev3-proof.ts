/**
 * Re-verifies the whole Orbit rev3 bank fast: for every entry, decodes its
 * compact planets and replays its stored bot tap log through the real
 * orbitRev3Game loop (no search), checking it reaches planet 40. Also
 * live-proves 3 fresh seeds end to end (full salted search) as a sanity
 * check that the generator/prover themselves still agree with the bank.
 * Must finish well under 300s since replay (unlike proving) is just ticking
 * the game forward.
 *   bun run scripts/orbit-rev3-proof.ts
 */
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { decodeRev3Planets } from "../src/lib/duel/orbitRev3Course.server";
import { orbitRev3Game, initRev3From, proveOrbitRev3Layout, ORBIT_REV3_WORLD_W } from "../src/lib/arcade/orbitRev3";
import { ORBIT_TOTAL, ORBIT_INPUT_TAP } from "../src/lib/arcade/orbit";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

function replay(entry: (typeof ORBIT_REV3_BANK)[number]): { ok: boolean; reason?: string } {
  const planets = decodeRev3Planets(entry.planets);
  let state = initRev3From(planets, ORBIT_REV3_WORLD_W);
  const tapTicks = new Set(entry.taps);
  let safety = 0;
  const RUN_TICKS = orbitRev3Game.runTicks;
  while (!orbitRev3Game.isOver(state) && safety < RUN_TICKS + 5) {
    const nextTick = state.tick + 1;
    const input: ArcadeInputEvent | null = tapTicks.has(nextTick) ? { t: nextTick, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null;
    state = orbitRev3Game.step(state, input);
    safety++;
  }
  if (state.cur >= ORBIT_TOTAL || state.finished === 1) return { ok: true };
  return { ok: false, reason: `seed ${entry.seed}: replay stalled at planet ${state.cur}, tick ${state.tick}` };
}

const started = Date.now();
const failures: string[] = [];
for (const entry of ORBIT_REV3_BANK) {
  const result = replay(entry);
  if (!result.ok) failures.push(result.reason!);
}

const bankMs = Date.now() - started;

// Live sanity check: 3 fresh seeds proved from scratch (full salted search).
const liveSeeds = [0x1a2b3c4d, 987654321, 42424242].map((n) => n | 0);
const liveStarted = Date.now();
const liveResults = liveSeeds.map((seed) => ({ seed, proof: proveOrbitRev3Layout(seed) }));
const liveMs = Date.now() - liveStarted;
const liveFailures = liveResults.filter((r) => !r.proof.ok);

const totalMs = Date.now() - started;

console.log(
  JSON.stringify(
    {
      bankEntries: ORBIT_REV3_BANK.length,
      bankReplayMs: bankMs,
      bankReplayFailures: failures.length,
      bankReplayFailureSample: failures.slice(0, 10),
      liveSeeds: liveSeeds.length,
      liveProveMs: liveMs,
      liveFailures: liveFailures.map((r) => ({ seed: r.seed, reason: r.proof.reason })),
      totalMs,
      ok: failures.length === 0 && liveFailures.length === 0,
    },
    null,
    2,
  ),
);

if (failures.length > 0 || liveFailures.length > 0) {
  console.error(`FAIL: ${failures.length} bank replay failures, ${liveFailures.length} live-seed failures`);
  process.exit(1);
}
console.log("OK: all bank entries replayed cleanly and all live seeds proved.");
