/** Colour Clash fixed-queue proof: queue end, scoring anchor, unchanged pattern/events and legacy identity. Colour Clash only. */
import {
  colourClashGame, colourClashQueueGame, colourClashQueueV1Game, CLASH_QUEUE_FALL_TICKS, clashQueueScoreOf, clashLaneCount, clashRuleAt, clashGatesAt, clashFallTicks,
  clashCheckpoint, CLASH_CHECKPOINT_INTERVAL, CLASH_QUEUE, CLASH_RUN_TICKS, CLASH_INPUT_LANE, CLASH_DROP, CLASH_SET_LANE, CLASH_WORLD_W, type ClashState,
} from "../src/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "../src/lib/duel/colourClash";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

function check(ok: boolean, message: string) { if (!ok) throw new Error(message); }
const legacyPath = process.argv[2];
const old = legacyPath ? (await import(legacyPath)).colourClashGame : null;

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

let finishMin = Infinity, finishMax = 0; const idleSpawn52: number[] = [], idleSorted: number[] = []; let phaseCounts: number[] = [];
const v1 = process.argv[3] ? (await import(process.argv[3])).colourClashQueueGame : null;
const SEEDS = Number(process.env["SEEDS"] ?? 200);
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = performance.now();
  // Strong run finishes the queue early with the right score, and replays identically.
  let s = colourClashQueueGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof clashCheckpoint>[] = [];
  let legacy = colourClashGame.init(seed);
  while (!colourClashQueueGame.isOver(s) && s.tick < CLASH_RUN_TICKS) {
    const e = strong(s); if (e && (e.t % 2 === 0)) events.push(e);
    s = colourClashQueueGame.step(s, e && e.t % 2 === 0 ? e : null);
    if (s.tick % CLASH_CHECKPOINT_INTERVAL === 0) cps.push(clashCheckpoint(s));
    legacy = colourClashGame.step(legacy, null);
  }
  check(s.items.length === CLASH_QUEUE && s.correct + s.wrong === CLASH_QUEUE && s.correct >= CLASH_QUEUE - 2 && s.finishTick > 0, `seed ${seed}: strong run did not sort all ${CLASH_QUEUE}: ${s.correct}/${s.wrong}/${s.items.length} tick ${s.tick}`);
  finishMin = Math.min(finishMin, s.finishTick); finishMax = Math.max(finishMax, s.finishTick);
  check(colourClashQueueGame.score(s) === clashQueueScoreOf(s.correct, s.wrong, CLASH_QUEUE, s.finishTick), "score formula");
  const raw = encodeColourClashRun({ seed, claimedScore: colourClashQueueGame.score(s), events, endTick: s.tick, checkpoints: cps });
  const rep = replayColourClashRun(seed, raw, 2);
  check(rep.score === colourClashQueueGame.score(s) && rep.correct === s.correct && rep.finished, `seed ${seed}: server replay differs ${JSON.stringify({rs: rep.score, s: colourClashQueueGame.score(s), rc: rep.correct, f: rep.finished, reason: rep.reason, ev: events.length, d: rep.inputDiag})}`);
  // Idle run: unchanged pattern, events, fall speeds; stops spawning at N and ends at 60 s.
  let q = colourClashQueueGame.init(seed), l = colourClashGame.init(seed);
  while (q.tick < CLASH_RUN_TICKS && !colourClashQueueGame.isOver(q)) {
    q = colourClashQueueGame.step(q, null); l = colourClashGame.step(l, null);
    check(q.items.length <= CLASH_QUEUE, "spawned past queue");
  }
  check(q.items.every((item) => item.fallTicks === CLASH_QUEUE_FALL_TICKS[Math.min(3, Math.floor(item.spawn / 900))]), "fall time per phase");
  check(q.ended === 1, "idle run did not end");
  idleSpawn52.push(q.items.length >= CLASH_QUEUE ? q.items[CLASH_QUEUE - 1]!.spawn : -1);
  idleSorted.push(q.correct + q.wrong);
  phaseCounts = [0, 1, 2, 3].map((p) => q.items.filter((item) => Math.min(3, Math.floor(item.spawn / 900)) === p).length);
  // 18-item revision replays exactly as built last revision.
  if (v1) {
    let a = v1.init(seed), c = colourClashQueueV1Game.init(seed);
    for (let t = 1; t <= CLASH_RUN_TICKS && !v1.isOver(a); t++) {
      const e: ArcadeInputEvent | null = t % 23 === 0 ? { t, k: CLASH_INPUT_LANE, a: (seed + t) % 4, b: (seed * t) % CLASH_WORLD_W, c: 0, d: 0 } : null;
      a = v1.step(a, e); c = colourClashQueueV1Game.step(c, e);
      if (t % 30 === 0) check(JSON.stringify(a) === JSON.stringify(c), `seed ${seed}: 18-item revision diverged at ${t}`);
    }
    check(JSON.stringify(a) === JSON.stringify(c) && v1.score(a) === colourClashQueueV1Game.score(c), "18-item revision score");
  }
  check(colourClashQueueGame.score(q) === clashQueueScoreOf(q.correct, q.wrong, CLASH_QUEUE, q.finishTick), "idle score");
  // Legacy identity: open-stream rounds replay exactly as the previous sim.
  if (old) {
    let a = old.init(seed), b2 = colourClashGame.init(seed);
    for (let t = 1; t <= CLASH_RUN_TICKS; t++) {
      const e: ArcadeInputEvent | null = t % 37 === 0 ? { t, k: CLASH_INPUT_LANE, a: (seed + t) % 4, b: (seed * t) % CLASH_WORLD_W, c: 0, d: 0 } : null;
      a = old.step(a, e); b2 = colourClashGame.step(b2, e);
      const { queue: _q, finishTick: _f, ...rest } = b2;
      if (t % 30 === 0 || t === CLASH_RUN_TICKS) check(JSON.stringify(a) === JSON.stringify(rest), `seed ${seed}: legacy diverged at ${t}`);
    }
    check(old.score(a) === colourClashGame.score(b2), "legacy score");
  }
}
console.log(`Colour Clash queue: ${SEEDS}/${SEEDS} seeds passed; N=${CLASH_QUEUE}; strong finish ${(finishMin / 60).toFixed(2)}–${(finishMax / 60).toFixed(2)} s; no-drop 52nd spawn ${(Math.min(...idleSpawn52) / 60).toFixed(2)}–${(Math.max(...idleSpawn52) / 60).toFixed(2)} s, no-drop sorted by 60 s ${Math.min(...idleSorted)}–${Math.max(...idleSorted)}, spawns per phase ${phaseCounts.join('/')}; 18-item revision ${v1 ? `${SEEDS}/${SEEDS}` : 'skipped'}; half-time anchor 140; legacy identity ${legacyPath ? `${SEEDS}/${SEEDS}` : "skipped"}`);
