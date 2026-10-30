/**
 * Ball Tracker on the arcade scoring standard (btRev 8, docs/arcade-standard/balltrack.md): btRev 7's play scored as
 * marbles home 140 + gold marbles 25 + combos 20 + boosted marbles 15 = 200.
 *
 * Perfect runs: a boosted oracle (the bank's just-in-time playbook player, `playRoutes` in scripts/ball-track-bank.ts,
 * aiming every marble at its cup on the shortest route that passes a speed booster) brings all 36 marbles home in
 * release order, every one boosted, so all 6 gold marbles, 34 combo landings and 36 boosted marbles; its log goes
 * through the server's encode + replay on btRev 8. Plus one built final state with every item taken.
 */
import { btCheckpoint, btNext, btLayout, btRotatable, btTraysAt, makeBallTrackGame, BT_CHECKPOINT_INTERVAL, BT_HOPPER_COL, BT_K_ROTATE, BT_REV_RUSH, BT_REV_STD, BT_STD, BT_V7_BALLS, BT_V7_GOLDS, type BtCourse, type BtState } from "../../src/lib/arcade/ballTrack";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { encodeBallTrackRun, replayBallTrackRun } from "../../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK_V7 } from "../../src/lib/duel/ballTrackBankV7.server";
import { playRoutes, routeTo } from "../ball-track-bank";
import type { StdEntry, StdRun } from "./entry";

type Step = { cell: number; vert: number };

/** The shortest route from the hopper into column `col` that passes a speed booster (null if none). */
function boostedRouteTo(course: BtCourse, col: number, tick: number): Step[] | null {
  const rot = new Set(btRotatable(course));
  const { kind } = btLayout(course);
  const boost = new Set(course.boost ?? []);
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

/** The boosted oracle: every marble on a booster route to the cup its colour has when it lands (re-aimed after each trial). */
function boostedOracle(course: BtCourse): ArcadeInputEvent[] {
  const target = course.balls.map((c) => course.trays.indexOf(c));
  const when = course.balls.map(() => 0);
  const plan = () => target.map((col, id) => boostedRouteTo(course, col, when[id]!) ?? routeTo(course, col, false, when[id]) ?? routeTo(course, col)!);
  let run = playRoutes(course, plan());
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
    run = playRoutes(course, plan());
  }
  return run.log;
}

/** Plays `events` on btRev 8, then sends the log through the server's encode + replay; returns the replayed state and score. */
function replayed(course: BtCourse, seed: number, events: ArcadeInputEvent[]): { state: BtState; score: number; flagged: boolean } {
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
    // The first bank courses on which the boosted oracle boosts every marble home (two replayed runs).
    for (let i = 0; i < BALL_TRACK_BANK_V7.length && runs.length < 2; i++) {
      const course = BALL_TRACK_BANK_V7[i]!.course;
      const r = replayed(course, i + 1, boostedOracle(course));
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
    const one = replayed(course, 1, [{ k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0, t: 1 }]);
    const game = makeBallTrackGame(course, BT_REV_STD);
    return [
      { label: `one tap (server replay: ${one.state.home} home)`, score: one.score },
      { label: "a built state with an input and nothing home", score: game.score({ ...game.init(1), acted: 1 }) },
    ];
  },
  idle: () => {
    const course = BALL_TRACK_BANK_V7[0]!.course;
    return [{ label: "no input (server replay)", score: replayed(course, 1, []).score }];
  },
  help: { terms: ["Marbles home", "Gold marbles", "Combos", "Boosted marbles", "from the third in a row"] },
};
