/**
 * Whack-a-Target: client/server identity proof with random taps.
 * Tents and Trees: every generated puzzle has exactly one solution.
 *   bun scripts/whack-tents-check.ts
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import {
  whackCheckpoint,
  whackGame,
  WHACK_CHECKPOINT_INTERVAL,
  WHACK_INPUT_TAP,
} from "@/lib/arcade/whack";
import { encodeWhackRun, replayWhackRun } from "@/lib/duel/whack";
import { generateTents } from "@/lib/duel/tents.server";
import { countTentSolutions, lineCounts, tentsLayoutValid } from "@/lib/duel/tents";
import { gradeAnswer } from "@/lib/duel/generate.server";

let failures = 0;
const rand = (n: number) => Math.floor(Math.random() * n);
const totals: number[] = [];
for (let run = 0; run < 200; run++) {
  const seed = 1 + rand(0x7ffffffe);
  let state = whackGame.init(seed);
  totals.push(state.schedule.totalTargets);
  const events: ArcadeInputEvent[] = [];
  const checkpoints = [];
  while (!whackGame.isOver(state)) {
    const t = state.tick + 1;
    if (rand(1000) < 120) {
      recordInput(events, { t, k: WHACK_INPUT_TAP, a: rand(20) - 2, b: 0, c: 0, d: 0 }, whackGame.inputRanges);
    }
    state = whackGame.step(state, inputAt(events, t));
    if (state.tick % WHACK_CHECKPOINT_INTERVAL === 0) checkpoints.push(whackCheckpoint(state));
  }
  const score = whackGame.score(state);
  const raw = appendClientCounters(
    encodeWhackRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }),
    arcadeCounters("whack", state, score),
  );
  const result = replayWhackRun(seed, raw);
  const graded = gradeAnswer({ type: "whack", seed }, raw, 0);
  if (
    result.score !== score ||
    graded.score !== score ||
    result.flagged ||
    result.desyncTick !== null ||
    JSON.stringify(whackCheckpoint(result.state)) !== JSON.stringify(whackCheckpoint(state))
  ) {
    failures++;
    console.log("whack FAIL", seed, score, result.score, result.reason);
  }
}
console.log(
  `whack identity: ${failures ? "FAIL" : "ok 200/200"} · targets ${Math.min(...totals)}–${Math.max(...totals)}`,
);

let tentFails = 0;
const started = performance.now();
for (let i = 0; i < 50; i++) {
  const p = generateTents();
  const n = countTentSolutions(p, 5);
  const ok =
    n === 1 &&
    p.trees.length >= 8 &&
    p.trees.length <= 9 &&
    tentsLayoutValid(p, p.solution ?? []) &&
    JSON.stringify(lineCounts(p.solution ?? []).rows) === JSON.stringify(p.rowCounts);
  if (!ok) {
    tentFails++;
    console.log("tents FAIL", n, p);
  }
}
console.log(
  `tents unique: ${tentFails ? `FAIL ${tentFails}` : "ok 50/50"} · ${(performance.now() - started).toFixed(0)}ms`,
);
if (failures || tentFails) process.exit(1);
