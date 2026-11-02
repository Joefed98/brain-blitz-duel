/**
 * Records curling-check's curlRev 2 legacy runs (scripts/fixtures/curling-v2-legacy.json): run on the tree before
 * curlRev 3 (main at ae1efbe), from the repo root:
 *
 *   bun scripts/curling-v2-legacy-record.ts scripts/fixtures/curling-v2-legacy.json
 *
 * Twenty-four runs on the curlRev 2 bank's sheets: seeded throws (start x on the near hog line, broom, weight, turn)
 * with seeded brush strokes while the stones travel (none, light or heavy; left, right or carry only), each as the
 * phone sends it (events and checkpoints) with the score the server stored. curling-check replays each on curlRev 2
 * today and fails unless it scores the same, unflagged (so the curlRev 2 sim, its checkpoints and its score are
 * unchanged by curlRev 3).
 */
import { writeFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { curlingCheckpoint, curlingGameFor, CURL_AIM, CURL_INPUT_SWEEP, CURL_INPUT_THROW, CURL_TRAVEL } from "../src/lib/arcade/curling";
import { encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { CURLING_BANK_V2 } from "../src/lib/duel/curlingBankV2.server";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";

function rng(seed: number): (n: number) => number {
  let a = seed >>> 0;
  return (n: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

const out: { seed: number; raw: string; score: number }[] = [];
for (let n = 0; n < 24; n++) {
  const seed = CURLING_BANK_V2[n % CURLING_BANK_V2.length]!;
  const r = rng(n * 104729 + 31);
  const sweepEvery = [0, 0, 6, 3][n % 4]!;
  const game = curlingGameFor(2);
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints = [];
  let waitUntil = -1;
  while (!game.isOver(s)) {
    let ev: ArcadeInputEvent | null = null;
    if (s.phase === CURL_AIM) {
      if (waitUntil < 0) waitUntil = s.tick + 20 + r(120);
      if (s.tick >= waitUntil) {
        ev = { t: s.tick + 1, k: CURL_INPUT_THROW, a: r(181) - 90, b: r(121) - 60, c: (250 + r(400)) * 2 + r(2), d: r(201) - 100 };
        waitUntil = -1;
      }
    } else if (s.phase === CURL_TRAVEL && sweepEvery > 0 && s.tick % sweepEvery === 0 && r(3) > 0) {
      ev = { t: s.tick + 1, k: CURL_INPUT_SWEEP, a: 1 + r(100), b: r(3) - 1, c: 0, d: 0 };
    }
    if (ev) events.push(ev);
    s = game.step(s, ev);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(curlingCheckpoint(s));
  }
  const raw = encodeCurlingRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const run = replayCurlingRun(seed, raw, 2);
  if (run.flagged || run.score !== game.score(s)) throw new Error(`run ${n} does not replay on this tree`);
  out.push({ seed, raw, score: run.score });
}
writeFileSync(process.argv[2]!, JSON.stringify(out) + "\n");
console.log(`recorded ${out.length} curlRev 2 runs: scores ${out.map((o) => o.score).join(", ")}`);
