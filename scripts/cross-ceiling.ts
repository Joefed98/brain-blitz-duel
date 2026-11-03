/**
 * Jaywalk crossRev 9: the perfect-play ceiling (the 26 Oct 2026 arcade rule). For a seed, an oracle plays
 * every crossing on the shortest path that collects every coin the crossing holds (a time-layered
 * breadth-first search over lane, column, hop and coins taken, against the course's own traffic, which is
 * timed from the crossing's start, so each crossing's best path depends on the course alone), then the last
 * crossing as deep as the clock allows. The path is turned into an input log and played through the real
 * sim (`game.step`) and the server replay, so the ceiling reported is a score the server gives a real log.
 *
 *   bun scripts/cross-ceiling.ts [--from=0] [--seeds=260] [--gap=1] [--rev=9|10]
 *
 * `--gap=n` keeps at least n ticks between any two inputs (1 = the sim's own limit; 8 ≈ 7.5 swipes a second).
 * Not a check: cross-x200-check runs a sample of seeds through `crossCeilingRun`.
 */
import {
  crossBlocked,
  crossCheckpoint,
  CROSS_CHECKPOINT_INTERVAL,
  type CrossCheckpoint,
  crossClosed,
  crossColumnCentreFp,
  crossGameFor,
  crossPlayerHalfFp,
  crossRowsOf,
  CROSS_COLS,
  CROSS_COURSES,
  CROSS_HOP_TICKS,
  CROSS_INPUT_MOVE,
  CROSS_PAUSE_TICKS,
  CROSS_REV_EXPAND,
  CROSS_RUN_TICKS,
  CROSS_V11_STOP_TICKS,
  CROSS_X_ISLAND,
  type CrossCourse,
  type CrossState,
} from "../src/lib/arcade/cross";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import { roomSeed } from "./arcade-skill-bands/games";

interface Step {
  rel: number;
  a: number;
}

/**
 * The quickest way across one course from `rel0` (the first tick inputs land, relative to the crossing's
 * start) collecting every coin in `want` (a bit mask over course.coins), or, when the crossing cannot be
 * finished by `deadlineRel`, the deepest lane reachable by then. Mirrors step(): an input lands only while
 * standing; a hop lands 5 ticks after the tick it was sent on; a standing walker in a lane is hit when
 * blocked; a coin is taken standing on its cell. `gap` is the least number of ticks between inputs.
 *
 * `stop` (crossRev 11, the no-stop streak; 0 = off): the longest the walker may stand on the start kerb or the island
 * (`island`, a row number) in a row, side-steps included, as step() counts it. The search then carries that count in
 * place of the coin mask (crossRev 11 has no coins) and never lets it pass `stop`, so the path found is the quickest
 * no-stop crossing.
 */
export function crossingPath(
  course: CrossCourse,
  half: number,
  rel0: number,
  deadlineRel: number,
  want: number,
  gap = 1,
  stop = 0,
  island = -1,
  survive = stop > 0,
): { steps: Step[]; finished: boolean; endRel: number; mask: number; lane: number } {
  const rows = course.lanes.length;
  const coins = stop ? [] : (course.coins ?? []);
  const nc = coins.length;
  const masks = stop ? stop + 1 : 1 << nc;
  const coinAt = new Int8Array(16 * 16).fill(-1);
  coins.forEach((cell, i) => (coinAt[cell] = i));
  const cools = Math.max(1, gap);
  // id = ((((lane * COLS) + col) * 13 + hop code) * cools + cool) * masks + mask; hop code 1–6 up, 7–12 down
  const N = (rows + 1) * CROSS_COLS * 13 * cools * masks;
  const enc = (lane: number, col: number, hop: number, cool: number, mask: number) => ((((lane * CROSS_COLS + col) * 13 + hop) * cools + cool) * masks) + mask;
  const stamp = new Int32Array(N).fill(-1);
  /** Per layer: state ids, parent index into the previous layer, input sent (-1 none). */
  const layers: { ids: Int32Array; parent: Int32Array; input: Int8Array; n: number }[] = [];
  const start = enc(0, CROSS_COLS >> 1, 0, 0, 0);
  layers.push({ ids: Int32Array.of(start), parent: Int32Array.of(-1), input: Int8Array.of(-1), n: 1 });
  let best: { layer: number; idx: number; lane: number } = { layer: 0, idx: 0, lane: 0 };
  let done: { layer: number; idx: number; mask: number } | null = null;
  const centres = Array.from({ length: CROSS_COLS }, (_, c) => crossColumnCentreFp(c));
  for (let rel = rel0; rel <= deadlineRel && !done; rel++) {
    const prev = layers[layers.length - 1]!;
    if (prev.n === 0) break;
    const cap = Math.min(N, prev.n * 5 + 8);
    const ids = new Int32Array(cap);
    const parent = new Int32Array(cap);
    const input = new Int8Array(cap);
    let n = 0;
    const L = layers.length;
    const blockedMemo = new Map<number, boolean>();
    const blocked = (lane: number, col: number) => {
      const k = lane * 16 + col;
      let v = blockedMemo.get(k);
      if (v === undefined) {
        v = crossBlocked(course.lanes[lane - 1]!, centres[col]!, rel, half);
        blockedMemo.set(k, v);
      }
      return v;
    };
    for (let i = 0; i < prev.n && !done; i++) {
      const id = prev.ids[i]!;
      let r = id;
      const mask0 = r % masks;
      r = (r - mask0) / masks;
      const cool0 = r % cools;
      r = (r - cool0) / cools;
      const hop0 = r % 13;
      r = (r - hop0) / 13;
      const col0 = r % CROSS_COLS;
      const lane0 = (r - col0) / CROSS_COLS;
      const moves = hop0 === 0 && cool0 === 0 ? [-1, 0, 1, 2, 3] : [-1];
      for (const a of moves) {
        let lane = lane0;
        let col = col0;
        let hop = hop0 > 6 ? hop0 - 6 : hop0;
        let dir = hop0 > 6 ? -1 : 1;
        let cool = Math.max(0, cool0 - 1);
        let mask = mask0;
        if (a >= 0) {
          cool = cools - 1;
          if (a === 0) {
            if (crossClosed(course, lane + 1, col)) continue;
            hop = CROSS_HOP_TICKS;
          } else if (a === 1) {
            if (lane === 0 || crossClosed(course, lane - 1, col)) continue;
            hop = CROSS_HOP_TICKS;
            dir = -1;
          } else if (a === 2) {
            if (col === 0 || crossClosed(course, lane, col - 1)) continue;
            col -= 1;
          } else {
            if (col === CROSS_COLS - 1 || crossClosed(course, lane, col + 1)) continue;
            col += 1;
          }
        }
        if (hop > 0) {
          hop -= 1;
          if (hop === 0) {
            lane = Math.max(0, lane + dir);
            if (lane > rows) {
              if ((mask & want) === want) {
                ids[n] = enc(rows, col, 0, 0, mask);
                parent[n] = i;
                input[n] = a;
                n++;
                done = { layer: L, idx: n - 1, mask };
                break;
              }
              continue;
            }
          }
        }
        if (hop === 0 && lane >= 1) {
          if (blocked(lane, col)) continue;
          const ci = coinAt[lane * 16 + col]!;
          if (ci >= 0) mask |= 1 << ci;
        }
        if (stop) {
          // crossRev 11: standing on the kerb or the island counts on; past `stop` the crossing would not be no-stop.
          if (hop === 0 && (lane === 0 || lane === island)) {
            mask += 1;
            if (mask > stop) continue;
          } else mask = 0;
        }
        const nid = enc(lane, col, hop === 0 ? 0 : dir > 0 ? hop : hop + 6, cool, mask);
        if (stamp[nid] === rel) continue;
        stamp[nid] = rel;
        ids[n] = nid;
        parent[n] = i;
        input[n] = a;
        n++;
        if (lane > best.lane) best = { layer: L, idx: n - 1, lane };
      }
    }
    layers.push({ ids, parent, input, n });
  }
  // crossRev 11 (`survive`, set with `stop`; a life lost costs points there): when the crossing can't be finished, the deepest lane among
  // the walkers still standing at the deadline, so the run's last seconds take no hit (`best` may be hit afterwards).
  if (!done && survive) {
    for (let li = layers.length - 1; li > 0; li--) {
      const layer = layers[li]!;
      if (!layer.n) continue;
      const per = masks * cools * 13 * CROSS_COLS;
      let pick = -1;
      let lane = -1;
      for (let i = 0; i < layer.n; i++) {
        const l = Math.floor(layer.ids[i]! / per);
        if (l > lane) {
          lane = l;
          pick = i;
        }
      }
      best = { layer: li, idx: pick, lane };
      break;
    }
  }
  const end = done ?? best;
  const steps: Step[] = [];
  let li = end.layer;
  let idx = end.idx;
  while (li > 0) {
    const layer = layers[li]!;
    const a = layer.input[idx]!;
    if (a >= 0) steps.push({ rel: rel0 + li - 1, a });
    idx = layer.parent[idx]!;
    li -= 1;
  }
  steps.reverse();
  const endRel = rel0 + end.layer - 1;
  return { steps, finished: !!done, endRel, mask: done ? done.mask : 0, lane: done ? rows + 1 : best.lane };
}

export interface CeilingResult {
  seed: number;
  score: number;
  crossings: number;
  coins: number;
  coinsOffered: number;
  streakPts: number;
  flagged: boolean;
  raw: string;
}

/** The oracle's run on a seed (crossRev 9, crossRev 10's busier-each-crossing courses, or crossRev 11's no-stop crossings), replayed through the server. */
export function crossCeilingRun(seed: number, gap = 1, rev: number = CROSS_REV_EXPAND): CeilingResult & { closeCalls: number } {
  const game = crossGameFor(rev);
  const init = game.init(seed) as CrossState;
  const half = crossPlayerHalfFp(init);
  void crossRowsOf;
  const events: ArcadeInputEvent[] = [];
  let crossStart = 0;
  let first = 1;
  let offered = 0;
  for (let k = 0; ; k++) {
    const course = init.courses[Math.min(k, CROSS_COURSES - 1)]!;
    const nc = course.coins?.length ?? 0;
    offered += nc;
    const rel0 = first - crossStart;
    const deadlineRel = CROSS_RUN_TICKS - crossStart;
    // crossRev 11: the quickest no-stop crossing (never more than CROSS_V11_STOP_TICKS on the kerb or the island).
    const stop = init.flow ? CROSS_V11_STOP_TICKS : 0;
    let path = crossingPath(course, half, rel0, deadlineRel, (1 << nc) - 1, gap, stop, CROSS_X_ISLAND);
    // Not every coin can be taken (or no no-stop way found) in time on the last crossing: then the deepest lane.
    if (!path.finished) path = crossingPath(course, half, rel0, deadlineRel, 0, gap, 0, -1, stop > 0);
    for (const s of path.steps) events.push({ t: crossStart + s.rel, k: CROSS_INPUT_MOVE, a: s.a, b: 0, c: 0, d: 0 });
    if (!path.finished) break;
    const endTick = crossStart + path.endRel;
    crossStart = endTick + CROSS_PAUSE_TICKS;
    first = crossStart;
    if (crossStart >= CROSS_RUN_TICKS) break;
  }
  let state = init;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: CrossCheckpoint[] = [];
  while (!game.isOver(state)) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % CROSS_CHECKPOINT_INTERVAL === 0) checkpoints.push(crossCheckpoint(state));
  }
  const score = game.score(state);
  const raw = encodeCrossRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
  const server = replayCrossRun(seed, raw, rev);
  return {
    seed,
    score: server.score,
    crossings: state.crossings,
    coins: state.coinTotal ?? 0,
    coinsOffered: offered,
    streakPts: state.streakPts ?? 0,
    closeCalls: state.closeCalls ?? 0,
    flagged: server.score !== score,
    raw,
  };
}

if (import.meta.main) {
  const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const from = Number(opt("from") ?? 0);
  const count = Number(opt("seeds") ?? 260);
  const gap = Number(opt("gap") ?? 1);
  const rev = Number(opt("rev") ?? CROSS_REV_EXPAND);
  const rows: CeilingResult[] = [];
  const t0 = Date.now();
  for (let i = from; i < from + count; i++) {
    const r = crossCeilingRun(roomSeed(i), gap, rev);
    rows.push(r);
    if (process.argv.includes("--verbose")) console.log(`#${i} seed ${r.seed}: ${r.score} (crossings ${r.crossings}, coins ${r.coins}/${r.coinsOffered}, streak ${r.streakPts}, close calls ${r.closeCalls})`);
  }
  const scores = rows.map((r) => r.score).sort((a, b) => a - b);
  const min = rows.reduce((m, r) => (r.score < m.score ? r : m), rows[0]!);
  console.log(`seeds ${from}–${from + count - 1}, gap ${gap}: ceiling min ${scores[0]} (seed ${min.seed}), median ${scores[scores.length >> 1]}, below 200: ${rows.filter((r) => r.score < 200).length}; crossings min ${Math.min(...rows.map((r) => r.crossings))}; coins min ${Math.min(...rows.map((r) => r.coins))}; streak min ${Math.min(...rows.map((r) => r.streakPts))}; close calls min ${Math.min(...rows.map((r) => r.closeCalls))}; flagged ${rows.filter((r) => r.flagged).length}; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
