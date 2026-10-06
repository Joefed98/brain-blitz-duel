/** Colour Clash fixed-queue proof: queue end, scoring anchor, unchanged pattern/events and legacy identity. Colour Clash only. */
import {
  colourClashGame, colourClashQueueGame, clashQueueScoreOf, clashLaneCount, clashRuleAt, clashGatesAt, clashFallTicks,
  CLASH_QUEUE, CLASH_RUN_TICKS, CLASH_INPUT_LANE, CLASH_DROP, CLASH_SET_LANE, CLASH_WORLD_W, type ClashState,
} from "../src/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "../src/lib/duel/colourClash";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

function check(ok: boolean, message: string) { if (!ok) throw new Error(message); }
const legacyPath = process.argv[2];

// Anchor: all N correct at half time = 140; full at tick 0 would be 150; zero-time finish = 130.
check(clashQueueScoreOf(CLASH_QUEUE, 0, CLASH_QUEUE, CLASH_RUN_TICKS / 2) === 140, "half-time anchor");
check(clashQueueScoreOf(CLASH_QUEUE, 0, CLASH_QUEUE, CLASH_RUN_TICKS) === 130, "no-time finish");
check(clashQueueScoreOf(0, 5, CLASH_QUEUE, 0) === 0, "clamp at 0");

/** A strong player: steer to the right gate immediately, then drop. */
function strong(state: ClashState): ArcadeInputEvent | null {
  const item = state.items.at(-1);
  if (!item || state.dropping) return null;
  const gates = clashGatesAt(state, state.tick + 1);
  const wanted = clashRuleAt(state, state.tick + 1) === 0 ? item.ink : item.word;
  const lane = gates.indexOf(wanted);
  if (lane !== state.lane) {
    const lanes = clashLaneCount(state.tick + 1);
    return { t: state.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: Math.floor(((lane + 0.5) * CLASH_WORLD_W) / lanes), c: 0, d: 0 };
  }
  return { t: state.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 };
}

let finishMin = Infinity, finishMax = 0, idleSorted48: number[] = [];
for (let seed = 1; seed <= 200; seed++) {
  // Strong run finishes the queue early with the right score, and replays identically.
  let s = colourClashQueueGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  let legacy = colourClashGame.init(seed);
  while (!colourClashQueueGame.isOver(s) && s.tick < CLASH_RUN_TICKS) {
    const e = strong(s); if (e && (e.t % 2 === 0)) events.push(e);
    s = colourClashQueueGame.step(s, e && e.t % 2 === 0 ? e : null);
    legacy = colourClashGame.step(legacy, null);
  }
  check(s.items.length === CLASH_QUEUE && s.correct === CLASH_QUEUE && s.finishTick > 0, `seed ${seed}: strong run did not sort all ${CLASH_QUEUE}`);
  finishMin = Math.min(finishMin, s.finishTick); finishMax = Math.max(finishMax, s.finishTick);
  check(colourClashQueueGame.score(s) === clashQueueScoreOf(s.correct, s.wrong, CLASH_QUEUE, s.finishTick), "score formula");
  const raw = encodeColourClashRun({ seed, claimedScore: colourClashQueueGame.score(s), events, endTick: s.tick, checkpoints: [] });
  const rep = replayColourClashRun(seed, raw, CLASH_QUEUE);
  check(rep.score === colourClashQueueGame.score(s) && rep.correct === CLASH_QUEUE && rep.finished, `seed ${seed}: server replay differs ${JSON.stringify({rs: rep.score, s: colourClashQueueGame.score(s), rc: rep.correct, f: rep.finished, reason: rep.reason, ev: events.length, d: rep.inputDiag})}`);
  // Idle run: unchanged pattern, events, fall speeds; stops spawning at N and ends at 60 s.
  let q = colourClashQueueGame.init(seed), l = colourClashGame.init(seed);
  while (q.tick < CLASH_RUN_TICKS) {
    q = colourClashQueueGame.step(q, null); l = colourClashGame.step(l, null);
    const n = Math.min(q.items.length, l.items.length);
    check(JSON.stringify(q.items.slice(0, n)) === JSON.stringify(l.items.slice(0, n)), "item pattern changed");
    check(q.items.length <= CLASH_QUEUE, "spawned past queue");
    if (q.tick === 2880) idleSorted48.push(q.correct + q.wrong);
  }
  check(q.items.every((item) => item.fallTicks === clashFallTicks(item.spawn)), "fall speed changed");
  check(q.ended === 1, "did not end at 60 s");
  check(colourClashQueueGame.score(q) === clashQueueScoreOf(q.correct, q.wrong, CLASH_QUEUE, q.finishTick), "idle score");
  // Legacy identity: open-stream rounds replay exactly as the previous sim.
  if (legacyPath) {
    const old = (await import(legacyPath)).colourClashGame;
    let a = old.init(seed), b2 = colourClashGame.init(seed);
    for (let t = 1; t <= CLASH_RUN_TICKS; t++) {
      const e: ArcadeInputEvent | null = t % 37 === 0 ? { t, k: CLASH_INPUT_LANE, a: (seed + t) % 4, b: (seed * t) % CLASH_WORLD_W, c: 0, d: 0 } : null;
      a = old.step(a, e); b2 = colourClashGame.step(b2, e);
      const { queue: _q, finishTick: _f, ...rest } = b2;
      check(JSON.stringify(a) === JSON.stringify(rest), `seed ${seed}: legacy diverged at ${t}`);
    }
    check(old.score(a) === colourClashGame.score(b2), "legacy score");
  }
}
console.log(`Colour Clash queue: 200/200 seeds passed; N=${CLASH_QUEUE}; strong finish ${(finishMin / 60).toFixed(2)}–${(finishMax / 60).toFixed(2)} s; idle sorted by 48 s ${Math.min(...idleSorted48)}–${Math.max(...idleSorted48)}; half-time anchor 140; legacy identity ${legacyPath ? "200/200" : "skipped"}`);
