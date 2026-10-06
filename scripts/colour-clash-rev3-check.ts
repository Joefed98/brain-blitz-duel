/** Colour Clash 75 s / five-phase proof plus identity of all three older revisions. Colour Clash only. */
import {
  colourClashGameFor, colourClashRev3Game as G, CLASH_REV3_FALL_TICKS, CLASH_REV3_RUN_TICKS as RUN, clashQueueScoreOf, clashLaneCount, clashRuleAt, clashGatesAt,
  clashCheckpoint, CLASH_CHECKPOINT_INTERVAL, CLASH_QUEUE as N, CLASH_INPUT_LANE, CLASH_DROP, CLASH_SET_LANE, CLASH_WORLD_W, type ClashState,
} from "../src/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "../src/lib/duel/colourClash";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
function check(ok: boolean, m: string) { if (!ok) throw new Error(m); }
const prev = await import("/tmp/clash-v2.ts");
check(clashQueueScoreOf(N, 0, N, RUN / 2, RUN) === 140, "half-time anchor");
check(clashQueueScoreOf(N, 0, N, RUN, RUN) === 130, "no-time finish");
check(clashQueueScoreOf(0, 5, N, 0, RUN) === 0, "clamp");
function strong(s: ClashState): ArcadeInputEvent | null {
  const item = s.items.at(-1); if (!item || s.dropping) return null;
  const wanted = clashRuleAt(s, s.tick + 1) === 0 ? item.ink : item.word;
  const lane = clashGatesAt(s, s.tick + 1).indexOf(wanted);
  if (lane !== s.lane) return { t: s.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: Math.floor(((lane + 0.5) * CLASH_WORLD_W) / clashLaneCount(s.tick + 1)), c: 0, d: 0 };
  return { t: s.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 };
}
const SEEDS = Number(process.env["SEEDS"] ?? 200);
const last: number[] = [], sorted: number[] = [], bonus: number[] = [], strongFin: number[] = []; let counts: number[] = []; const actual = new Set<string>();
const olds = [prev.colourClashGame, prev.colourClashQueueV1Game, prev.colourClashQueueGame];
for (let seed = 1; seed <= SEEDS; seed++) {
  let s = G.init(seed); const events: ArcadeInputEvent[] = []; const cps: ReturnType<typeof clashCheckpoint>[] = [];
  while (!G.isOver(s)) { const e = strong(s); const use = e && e.t % 2 === 0 ? e : null; if (use) events.push(use); s = G.step(s, use); if (s.tick % CLASH_CHECKPOINT_INTERVAL === 0) cps.push(clashCheckpoint(s)); }
  check(s.correct + s.wrong === N && s.finishTick > 0, `seed ${seed} strong`); strongFin.push(s.finishTick);
  const raw = encodeColourClashRun({ seed, claimedScore: G.score(s), events, endTick: s.tick, checkpoints: cps });
  const rep = replayColourClashRun(seed, raw, 3);
  check(rep.score === G.score(s) && rep.finished && rep.correct === s.correct, `seed ${seed} replay ${rep.reason}`);
  // Idle: exact per-phase fall durations, five rule phases, 3→4 lanes at 30 s.
  let q = G.init(seed); let landTick = 0;
  while (!G.isOver(q)) { const before = q.items.length; const sp = q.items.at(-1)!.spawn; q = G.step(q, null); if (q.items.length > before || q.ended) { actual.add(`${Math.min(4, Math.floor(sp / 900))}:${q.tick - sp}`); landTick = q.tick; } }
  check(q.items.length <= N, "past queue");
  check(q.items.every((i) => i.fallTicks === CLASH_REV3_FALL_TICKS[Math.min(4, Math.floor(i.spawn / 900))]), "fall setting");
  check(q.gates.length === 5 && q.rules.length === 5 && q.gates[2]!.gates.length === 4 && q.gates[1]!.gates.length === 3, "phases/lanes");
  last.push(q.items[N - 1]?.spawn ?? -1); sorted.push(q.correct + q.wrong); bonus.push(G.score(q) - (Math.round(130 * q.correct / N) - 2 * q.wrong));
  counts = [0, 1, 2, 3, 4].map((p) => q.items.filter((i) => Math.min(4, Math.floor(i.spawn / 900)) === p).length);
  check(G.score(q) === clashQueueScoreOf(q.correct, q.wrong, N, q.finishTick, RUN), "idle score");
  void landTick;
  // Older revisions: byte-identical to the previous build.
  for (let v = 0; v < 3; v++) {
    const o = olds[v]!, c = colourClashGameFor(v); let a = o.init(seed), b = c.init(seed);
    for (let t = 1; t <= 3600 && !o.isOver(a); t++) {
      const e: ArcadeInputEvent | null = t % (23 + v * 7) === 0 ? { t, k: CLASH_INPUT_LANE, a: (seed + t) % 4, b: (seed * t) % CLASH_WORLD_W, c: 0, d: 0 } : null;
      a = o.step(a, e); b = c.step(b, e);
      if (t % 30 === 0) check(JSON.stringify(a) === JSON.stringify(b), `seed ${seed} v${v} diverged ${t}`);
    }
    check(JSON.stringify(a) === JSON.stringify(b) && o.score(a) === c.score(b), `v${v} final`);
  }
}
const f = (x: number[]) => `${(Math.min(...x) / 60).toFixed(2)}–${(Math.max(...x) / 60).toFixed(2)} s`;
console.log(`rev3 ${SEEDS}/${SEEDS}; last spawn ${f(last)}; idle sorted ${Math.min(...sorted)}–${Math.max(...sorted)}; idle bonus ${Math.min(...bonus)}–${Math.max(...bonus)}; strong finish ${f(strongFin)}; spawns/phase ${counts.join("/")}; durations ${[...actual].sort().join(",")}; older revisions identical ${SEEDS}/${SEEDS}`);
