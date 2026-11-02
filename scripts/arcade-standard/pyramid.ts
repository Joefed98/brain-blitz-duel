/**
 * arcade-standard-check's entry for `pyramid` (Pyramid pyramidRev 1, Cards & Board; docs/arcade-standard/pyramid.md):
 * born on the standard. Perfect runs are each deal's witness (a clear with ten pyramid pairs) through the server's replay.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { PY_CARDS, PY_CLEAR_MAX, PY_CORE_MAX, PY_RUN_TICKS, PY_SPEED_FULL_S, PY_SPEED_MAX, pyramidGame, pyramidStdParts, type PyState } from "../../src/lib/arcade/cards/pyramid";
import { replayPyramidRun } from "../../src/lib/duel/cards";
import { pyramidFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.pyramid!.spec!;
const rec = (s: PyState) => Object.fromEntries((pyramidStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: PyState) => Object.fromEntries((pyramidStdParts(s) ?? []).map((p) => [p.key, p.max]));
const at = (over: Partial<PyState>): PyState => ({ ...pyramidGame.init(5), acted: 1, ...over });
const removed = (v: number): PyState => at({ removed: v, gone: Array.from({ length: PY_CARDS }, (_, i) => (i >= PY_CARDS - v ? 1 : 0)) });

export const entry: StdEntry = {
  type: "pyramid",
  field: "pyramidRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 77, 10000, 123456789].map((seed) => {
      const { raw } = pyramidFlawless(seed);
      const r = replayPyramidRun(seed, raw);
      return { label: `seed ${seed}'s witness through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap on a covered card", score: pyramidGame.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: pyramidGame.score(pyramidGame.init(12)) }],
  help: { terms: ["28", "pair"] },
  core: { fullAt: PY_CARDS, at: (v) => removed(v), parts: (s) => pyramidStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: PyState, key: string) => pyramidStdParts(s)!.find((p) => p.key === key)!.points;
    for (const [n, want] of [[0, 0], [1, 2], [5, 10], [10, 20], [12, 20]] as const) ok(part(at({ ppPairs: n }), "pairs") === want, `pyramid: ${n} pyramid pairs pay ${want}`);
    const done = (tick: number) => at({ ended: 1, finishTick: tick, removed: PY_CARDS });
    ok(part(done(600), "clear") === PY_CLEAR_MAX && PY_CLEAR_MAX === 10 && part(removed(27), "clear") === 0, "pyramid: cleared 10 only with all 28 removed");
    ok(PY_CORE_MAX === 120 && PY_SPEED_MAX === 50, "pyramid: core 120 and speed 50 (Joe's split, 2 Nov 2026)");
    const mid = part(done(((PY_SPEED_FULL_S * 60 + PY_RUN_TICKS) / 2) | 0), "speed");
    ok(mid >= 24 && mid <= 25, `pyramid: speed falls on a straight line, half way between full and the buzzer pays half (${mid})`);
    ok(part(done(PY_SPEED_FULL_S * 60), "speed") === PY_SPEED_MAX && part(done(PY_RUN_TICKS), "speed") === 0 && part(removed(27), "speed") === 0, `pyramid: speed full by ${PY_SPEED_FULL_S} s, 0 at the buzzer, none uncleared`);
  },
};
