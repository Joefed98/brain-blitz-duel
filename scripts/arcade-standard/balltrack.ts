/**
 * Ball Tracker on the arcade scoring standard (btRev 8, docs/arcade-standard/balltrack.md): btRev 7's play scored as
 * marbles home 140 + gold marbles 25 + combos 20 + boosted marbles 15 = 200.
 *
 * Perfect runs: a boosted oracle (the bank's just-in-time playbook player, `playRoutes` in scripts/ball-track-bank.ts,
 * aiming every marble at its cup on the shortest route that passes a speed booster, then a local search over each
 * missed marble's route and target) brings all 36 marbles home in release order, every one boosted, so all 6 gold
 * marbles, 34 combo landings and 36 boosted marbles; its log goes through the server's encode + replay on btRev 8. Plus
 * one built final state with every item taken. balltrack-deal-check runs the same oracle on every course btRev 8 deals.
 */
import { btCheckpoint, btNext, btLayout, btRotatable, btTraysAt, makeBallTrackGame, BT_CHECKPOINT_INTERVAL, BT_HOPPER_COL, BT_K_ROTATE, BT_REV_RUSH, BT_REV_STD, BT_STD, BT_V7_BALLS, BT_V7_GOLDS, type BtCourse, type BtState } from "../../src/lib/arcade/ballTrack";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { encodeBallTrackRun, replayBallTrackRun } from "../../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK_V7 } from "../../src/lib/duel/ballTrackBankV7.server";
import { BT_V8_DEAL } from "../../src/lib/duel/ballTrackDealV8.server";
import { playRoutes, routeTo } from "../ball-track-bank";
import type { StdEntry, StdRun } from "./entry";

type Step = { cell: number; vert: number };

/**
 * The shortest route from the hopper into column `col` that passes a speed booster (null if none); with `via`, the
 * shortest that passes that booster.
 */
function boostedRouteTo(course: BtCourse, col: number, tick: number, via?: number): Step[] | null {
  const rot = new Set(btRotatable(course));
  const { kind } = btLayout(course);
  const boost = new Set(via === undefined ? (course.boost ?? []) : [via]);
  type Q = { cell: number; above: boolean; on: boolean; path: Step[] };
  const queue: Q[] = [{ cell: BT_HOPPER_COL, above: true, on: false, path: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const q = queue.shift()!;
    const key = `${q.cell}|${q.above}|${q.on}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const v of kind[q.cell] === 2 ? [-1] : rot.has(q.cell) ? [0, 1] : [0]) {
      const next = btNext(q.cell, q.above, v === 1, course, tick);
      const path = [...q.path, { cell: q.cell, vert: v }];
      if (next.cell >= 100) {
        if (next.cell - 100 === col && q.on) return path;
        continue;
      }
      if (next.cell < 0) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, on: q.on || boost.has(next.cell), path });
    }
  }
  return null;
}

/**
 * Boosted routes from the hopper into column `col` for the oracle's search: the shortest through each booster, then
 * up to `more` of other lengths (a breadth-first walk that never re-enters a tube, at most 8 steps longer than the
 * shortest), so a marble can take another booster or land earlier or later.
 */
function boostedRoutes(course: BtCourse, col: number, tick: number, more = 8): Step[][] {
  const out: Step[][] = [];
  const keys = new Set<string>();
  const add = (path: Step[] | null) => {
    if (!path) return;
    const key = JSON.stringify(path);
    if (keys.has(key)) return;
    keys.add(key);
    out.push(path);
  };
  for (const v of course.boost ?? []) add(boostedRouteTo(course, col, tick, v));
  const shortest = out.reduce((m, p) => Math.min(m, p.length), Infinity);
  if (!Number.isFinite(shortest)) return out;
  const rot = new Set(btRotatable(course));
  const { kind } = btLayout(course);
  const boost = new Set(course.boost ?? []);
  type Q = { cell: number; above: boolean; on: number; path: Step[]; seen: Set<number> };
  const queue: Q[] = [{ cell: BT_HOPPER_COL, above: true, on: -1, path: [], seen: new Set([BT_HOPPER_COL]) }];
  const lengths = new Set(out.map((p) => `${p.length}`));
  let budget = 30_000;
  for (let qi = 0; qi < queue.length && budget-- > 0 && out.length < (course.boost?.length ?? 0) + more; qi++) {
    const q = queue[qi]!;
    if (q.path.length >= shortest + 8) continue;
    for (const v of kind[q.cell] === 2 ? [-1] : rot.has(q.cell) ? [0, 1] : [0]) {
      const next = btNext(q.cell, q.above, v === 1, course, tick);
      const path = [...q.path, { cell: q.cell, vert: v }];
      if (next.cell >= 100) {
        const key = `${path.length}|${q.on}`;
        if (next.cell - 100 === col && q.on >= 0 && !lengths.has(key)) {
          lengths.add(key);
          add(path);
        }
        continue;
      }
      if (next.cell < 0 || q.seen.has(next.cell)) continue;
      const seen = new Set(q.seen).add(next.cell);
      queue.push({ cell: next.cell, above: next.fromAbove, on: q.on >= 0 ? q.on : boost.has(next.cell) ? next.cell : -1, path, seen });
    }
  }
  return out;
}

type OracleRun = ReturnType<typeof playRoutes> & { good: boolean[] };

/**
 * `playRoutes`, then which marbles went home boosted: the log replayed on btRev 7's rules, a marble judged good when
 * the home and boosted counts rise by the number of marbles leaving the board that tick.
 */
function playJudged(course: BtCourse, routes: Step[][]): OracleRun {
  const run = playRoutes(course, routes);
  const game = makeBallTrackGame(course, BT_REV_RUSH);
  const byTick = new Map(run.log.map((e) => [e.t, e]));
  let s = game.init(1);
  const good = course.balls.map(() => false);
  while (!game.isOver(s)) {
    const before = s.balls.map((b) => b.id);
    const home = s.home;
    const boosts = s.boosts ?? 0;
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    const gone = before.filter((id) => !s.balls.some((b) => b.id === id));
    if (gone.length && s.home - home === gone.length && (s.boosts ?? 0) - boosts === gone.length) for (const id of gone) good[id] = true;
  }
  return { ...run, good };
}

const quality = (r: OracleRun) => r.state.home * 1000 + (r.state.boosts ?? 0) * 10 + (r.state.golds ?? 0);

/**
 * The boosted oracle: every marble on the shortest booster route to the cup its colour has when it lands (re-aimed
 * after each trial); then, while a marble misses its cup or its boost, it and the two marbles before it try other
 * boosted routes (other boosters, longer or shorter) aimed at each tray layout's cup, keeping a change only when more
 * marbles go home or home boosted (a greedy local search).
 */
export function boostedOracle(course: BtCourse): ArcadeInputEvent[] {
  const target = course.balls.map((c) => course.trays.indexOf(c));
  const when = course.balls.map(() => 0);
  // A marble's route: the shortest boosted one, or (alt ≥ 0) one of `boostedRoutes` picked by the search below.
  const alt: number[] = course.balls.map(() => -1);
  const routesCache = new Map<string, Step[][]>();
  const routesFor = (col: number, tick: number) => {
    const key = `${col}|${tick}`;
    if (!routesCache.has(key)) routesCache.set(key, boostedRoutes(course, col, tick));
    return routesCache.get(key)!;
  };
  const routeOf = (id: number) => {
    const col = target[id]!;
    return (alt[id]! >= 0 ? routesFor(col, when[id]!)[alt[id]!] : null) ?? boostedRouteTo(course, col, when[id]!) ?? routeTo(course, col, false, when[id]) ?? routeTo(course, col)!;
  };
  const plan = () => target.map((_, id) => routeOf(id));
  let run = playJudged(course, plan());
  for (let pass = 0; pass < 10 && run.state.home !== BT_V7_BALLS; pass++) {
    let changed = false;
    course.balls.forEach((c, id) => {
      const t = run.landed[id] ?? 0;
      const col = btTraysAt(course, t).indexOf(c);
      if (col !== target[id] || btTraysAt(course, t) !== btTraysAt(course, when[id]!)) {
        target[id] = col;
        when[id] = t;
        changed = true;
      }
    });
    if (!changed) break;
    run = playJudged(course, plan());
  }
  // Then each marble that misses: it and the two before it try aiming for their colour's cup in each of the course's
  // three tray layouts (start, relay, shuffle), on each of their boosted routes, keeping only improvements.
  const phases = [0, course.relay.tick, course.shuffle.tick];
  for (let round = 0; round < 6 && run.good.some((g) => !g); round++) {
    let improved = false;
    for (let id = 0; id < run.good.length; id++) {
      if (run.good[id]) continue;
      for (const j of [id, id - 1, id - 2]) {
        if (j < 0 || run.good[id]) continue;
        for (const at of phases) {
          const col = btTraysAt(course, at).indexOf(course.balls[j]!);
          if (col < 0) continue;
          const count = routesFor(col, at).length;
          for (let a = 0; a < count; a++) {
            if (a === alt[j] && col === target[j] && at === when[j]) continue;
            const old = [alt[j]!, target[j]!, when[j]!] as const;
            [alt[j], target[j], when[j]] = [a, col, at];
            const next = playJudged(course, plan());
            if (quality(next) > quality(run)) {
              run = next;
              improved = true;
            } else [alt[j], target[j], when[j]] = old;
          }
        }
      }
    }
    if (!improved) break;
  }
  return run.log;
}

/** Plays `events` on btRev 8, then sends the log through the server's encode + replay; returns the replayed state and score. */
export function replayedBtStd(course: BtCourse, seed: number, events: ArcadeInputEvent[]): { state: BtState; score: number; flagged: boolean } {
  const game = makeBallTrackGame(course, BT_REV_STD);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % BT_CHECKPOINT_INTERVAL === 0) checkpoints.push(btCheckpoint(s));
  }
  const raw = encodeBallTrackRun(course, { seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints }, BT_REV_STD);
  const result = replayBallTrackRun(course, seed, raw, BT_REV_STD);
  return { state: result.state, score: result.score, flagged: Boolean(result.flagged) };
}

export const entry: StdEntry = {
  type: "balltrack",
  field: "btRev",
  rev: BT_REV_STD,
  before: BT_REV_RUSH,
  parts: BT_STD.parts,
  spec: BT_STD,
  perfect: () => {
    const runs: StdRun[] = [];
    // The first courses btRev 8 deals on which the boosted oracle boosts every marble home (two replayed runs).
    for (const i of BT_V8_DEAL) {
      if (runs.length >= 2) break;
      const course = BALL_TRACK_BANK_V7[i]!.course;
      const r = replayedBtStd(course, i + 1, boostedOracle(course));
      if (r.state.home !== BT_V7_BALLS || r.state.boosts !== BT_V7_BALLS || r.flagged) continue;
      runs.push({ label: `bank course ${i}: the boosted oracle, ${r.state.home} home, ${r.state.golds} gold, ${r.state.combos} combos, ${r.state.boosts} boosted (server replay)`, score: r.score });
    }
    // A built final state: every marble home, every gold, 20+ combos, every marble boosted.
    const game = makeBallTrackGame(BALL_TRACK_BANK_V7[0]!.course, BT_REV_STD);
    const s0 = game.init(1);
    runs.push({ label: "a built state with every part full", score: game.score({ ...s0, acted: 1, home: BT_V7_BALLS, golds: BT_V7_GOLDS, combos: BT_V7_BALLS - 2, boosts: BT_V7_BALLS }) });
    return runs;
  },
  played: () => {
    // One tap on the first rotatable tube in the first tick, then nothing: marbles may roll home on the default tracks,
    // which would only add; and a built state with an input and nothing home.
    const course = BALL_TRACK_BANK_V7[0]!.course;
    const cell = btRotatable(course)[0]!;
    const one = replayedBtStd(course, 1, [{ k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0, t: 1 }]);
    const game = makeBallTrackGame(course, BT_REV_STD);
    return [
      { label: `one tap (server replay: ${one.state.home} home)`, score: one.score },
      { label: "a built state with an input and nothing home", score: game.score({ ...game.init(1), acted: 1 }) },
    ];
  },
  idle: () => {
    const course = BALL_TRACK_BANK_V7[0]!.course;
    return [{ label: "no input (server replay)", score: replayedBtStd(course, 1, []).score }];
  },
  help: { terms: ["Marbles home", "Gold marbles", "Combos", "Boosted marbles", "from the third in a row"] },
};
