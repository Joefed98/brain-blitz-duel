/**
 * One-off recorder for scripts/fixtures/orbit-legacy/bot-runs.json: legacy (no orbitRev) Orbit runs
 * with full tap logs, recorded with the classic engine and scored by replayOrbitRun. Re-running this
 * would overwrite the frozen expectations, so only run it deliberately (pass --write).
 */
import { writeFileSync } from "node:fs";
import { orbitGame, orbitCheckpoint, ORBIT_CHECKPOINT_INTERVAL, orbitExtra } from "../src/lib/arcade/orbit";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { inputAt, recordInput } from "../src/lib/arcade/engine";

if (!process.argv.includes("--write")) {
  console.log("refusing to overwrite frozen fixtures without --write");
  process.exit(1);
}
const ev = (t: number, k: number) => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
function flight(state: any) {
  let p = orbitGame.step(state, ev(state.tick + 1, 0) as any);
  while (p.flying > 0 && !orbitGame.isOver(p)) p = orbitGame.step(p, null);
  return p;
}
function record(seed: number, mode: "careful" | "random") {
  let state: any = orbitGame.init(seed);
  const events: any[] = [];
  const checkpoints: any[] = [];
  let rng = seed >>> 0;
  let guard = 0;
  while (!orbitGame.isOver(state) && guard++ < 20000) {
    const tick = state.tick + 1;
    let tap = false;
    if (state.flying === 0) {
      if (mode === "careful") {
        const p = flight(state);
        tap = p.cur > state.cur && p.ended === 0;
      } else {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        tap = rng % 90 === 0;
      }
    }
    if (tap) recordInput(events, ev(tick, 0) as any, orbitGame.inputRanges);
    state = orbitGame.step(state, inputAt(events, tick));
    if (state.tick % ORBIT_CHECKPOINT_INTERVAL === 0) checkpoints.push(orbitCheckpoint(state));
  }
  const raw = encodeOrbitRun({ seed, events, checkpoints, endTick: state.tick, claimedScore: orbitGame.score(state) });
  const r = replayOrbitRun(seed, raw);
  if (r.flagged) throw new Error(`seed ${seed} flagged: ${r.reason}`);
  return { source: `bot-${mode}`, seed, raw, score: r.score, extra: orbitExtra(r.state) };
}
const out = [
  ...Array.from({ length: 20 }, (_, i) => record(1000 + i * 137, "careful")),
  ...Array.from({ length: 20 }, (_, i) => record(50_000 + i * 911, "random")),
];
writeFileSync("scripts/fixtures/orbit-legacy/bot-runs.json", JSON.stringify(out) + "\n");
console.log(`wrote ${out.length} runs`);
