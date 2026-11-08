/**
 * arcade-standard-check's entry for `pyramid` (Thirteen pyramidRev 2, Cards & Board; docs/arcade-standard/pyramid.md):
 * born on the standard at rev 1 (core 120, cleared 10, speed 50, pyramid pairs 20); rev 2 (7 Nov 2026) moves half the
 * speed onto the cards: core 140, cleared 15, speed 25 (whole-number maths), pyramid pairs 20. Perfect runs are each
 * deal's witness (a clear with ten pyramid pairs) through the server's replay on rev 2.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { PY_CARDS, PY_CLEAR_MAX, PY_CORE_MAX, PY_RUN_TICKS, PY_SPEED_FULL_S, PY_SPEED_MAX, PY_V2_CLEAR_MAX, PY_V2_CORE_MAX, PY_V2_SPEED_MAX, pyramidGame, pyramidGameFor, pyramidStdParts, type PyState } from "../../src/lib/arcade/cards/pyramid";
import { replayPyramidRun } from "../../src/lib/duel/cards";
import { pyramidFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.pyramid!.spec!;
const rec = (s: PyState) => Object.fromEntries((pyramidStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: PyState) => Object.fromEntries((pyramidStdParts(s) ?? []).map((p) => [p.key, p.max]));
const game = pyramidGameFor(2);
/** A rev-1 state (stored rounds): its own parts. */
const at1 = (over: Partial<PyState>): PyState => ({ ...pyramidGame.init(5), acted: 1, ...over });
const removed1 = (v: number): PyState => at1({ removed: v, gone: Array.from({ length: PY_CARDS }, (_, i) => (i >= PY_CARDS - v ? 1 : 0)) });
const at = (over: Partial<PyState>): PyState => ({ ...game.init(5), acted: 1, ...over });
const removed = (v: number): PyState => at({ removed: v, gone: Array.from({ length: PY_CARDS }, (_, i) => (i >= PY_CARDS - v ? 1 : 0)) });

export const entry: StdEntry = {
  type: "pyramid",
  field: "pyramidRev",
  rev: 2,
  before: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 77, 10000, 123456789].map((seed) => {
      const { raw } = pyramidFlawless(seed, 15, 2);
      const r = replayPyramidRun(seed, raw, 2);
      return { label: `seed ${seed}'s witness through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap on a covered card", score: game.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: game.score(game.init(12)) }],
  help: { terms: ["28", "pair"] },
  core: { fullAt: PY_CARDS, at: (v) => removed(v), parts: (s) => pyramidStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: PyState, key: string) => pyramidStdParts(s)!.find((p) => p.key === key)!.points;
    // Rev 1 (stored rounds) keeps its parts exactly (asserted on rev-1 states).
    for (const [n, want] of [[0, 0], [1, 2], [5, 10], [10, 20], [12, 20]] as const) ok(part(at1({ ppPairs: n }), "pairs") === want, `pyramid: ${n} pyramid pairs pay ${want}`);
    const done1 = (tick: number) => at1({ ended: 1, finishTick: tick, removed: PY_CARDS });
    ok(part(done1(600), "clear") === PY_CLEAR_MAX && PY_CLEAR_MAX === 10 && part(removed1(27), "clear") === 0, "pyramid: cleared 10 only with all 28 removed");
    ok(PY_CORE_MAX === 120 && PY_SPEED_MAX === 50, "pyramid: core 120 and speed 50 (Joe's split, 2 Nov 2026)");
    const mid1 = part(done1(((PY_SPEED_FULL_S * 60 + PY_RUN_TICKS) / 2) | 0), "speed");
    ok(mid1 >= 24 && mid1 <= 25, `pyramid: speed falls on a straight line, half way between full and the buzzer pays half (${mid1})`);
    ok(part(done1(PY_SPEED_FULL_S * 60), "speed") === PY_SPEED_MAX && part(done1(PY_RUN_TICKS), "speed") === 0 && part(removed1(27), "speed") === 0, `pyramid: speed full by ${PY_SPEED_FULL_S} s, 0 at the buzzer, none uncleared`);
    ok(part(removed1(28), "core") === 120 && part(removed1(14), "core") === 60, "pyramid rev 1: the core 120 on the 28 cards");

    // Rev 2: core 140 (5 a card), cleared 15, speed 25 in whole-number maths, pairs 20 as before.
    for (const [n, want] of [[0, 0], [1, 2], [5, 10], [10, 20], [12, 20]] as const) ok(part(at({ ppPairs: n }), "pairs") === want, `pyramid rev 2: ${n} pyramid pairs pay ${want}`);
    ok(PY_V2_CORE_MAX === 140 && PY_V2_CLEAR_MAX === 15 && PY_V2_SPEED_MAX === 25, "pyramid rev 2: core 140, cleared 15, speed 25");
    ok(part(removed(1), "core") === 5 && part(removed(27), "core") === 135 && part(removed(28), "core") === 140, "pyramid rev 2: 5 a card removed");
    const done = (tick: number, pairs = 0) => at({ ended: 1, finishTick: tick, removed: PY_CARDS, ppPairs: pairs, gone: new Array<number>(PY_CARDS).fill(1) });
    ok(part(done(600), "clear") === PY_V2_CLEAR_MAX && part(removed(27), "clear") === 0, "pyramid rev 2: cleared 15 only with all 28 removed");
    ok(part(done(PY_SPEED_FULL_S * 60), "speed") === PY_V2_SPEED_MAX && part(done(PY_RUN_TICKS), "speed") === 0 && part(removed(27), "speed") === 0, `pyramid rev 2: speed full by ${PY_SPEED_FULL_S} s, 0 at the buzzer, none uncleared`);
    // Whole-number speed: floor(25 × (5400 − t) ÷ 4200) exactly, at every tick.
    let exact = true;
    for (let t = PY_SPEED_FULL_S * 60; t <= PY_RUN_TICKS; t++) if (part(done(t), "speed") !== Math.floor((25 * (PY_RUN_TICKS - t)) / (PY_RUN_TICKS - PY_SPEED_FULL_S * 60))) exact = false;
    ok(exact, "pyramid rev 2: speed is floor(25 × ticks to spare ÷ 4200) in whole numbers at every finish tick");
    // No inversions: more cards never lower the score, and the poorest clear scores at least the best run that misses one.
    let rising = true;
    for (let v = 1; v <= PY_CARDS; v++) if (game.score(removed(v)) < game.score(removed(v - 1))) rising = false;
    ok(rising, "pyramid rev 2: each card removed never lowers the score");
    const bestMiss = game.score({ ...removed(27), ppPairs: 10 });
    const poorestClear = game.score(done(PY_RUN_TICKS, 0));
    ok(poorestClear >= bestMiss, `pyramid rev 2: the poorest clear (${poorestClear}) scores at least the best run that misses one (${bestMiss})`);
  },
};
