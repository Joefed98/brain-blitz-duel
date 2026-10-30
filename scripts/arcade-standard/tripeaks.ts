/**
 * arcade-standard-check's entry for `tripeaks` (TriPeaks tripeaksRev 1, Cards & Board; docs/arcade-standard/tripeaks.md):
 * born on the standard. Perfect runs are the bank's clearing lines (a run of ten) through the server's replay.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { TP_RUN_TICKS, TP_SPEED_FULL_S, TP_SPEED_MAX, tripeaksGame, tripeaksStdParts, type TpState } from "../../src/lib/arcade/cards/tripeaks";
import { replayTripeaksRun } from "../../src/lib/duel/cards";
import { tripeaksFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.tripeaks!.spec!;
const rec = (s: TpState) => Object.fromEntries((tripeaksStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: TpState) => Object.fromEntries((tripeaksStdParts(s) ?? []).map((p) => [p.key, p.max]));
const at = (over: Partial<TpState>): TpState => ({ ...tripeaksGame.init(5), acted: 1, ...over });
const cleared = (v: number): TpState => at({ clearedCount: v, cleared: Array.from({ length: 28 }, (_, i) => (i >= 28 - v ? 1 : 0)) });

export const entry: StdEntry = {
  type: "tripeaks",
  field: "tripeaksRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = tripeaksFlawless(seed);
      const r = replayTripeaksRun(seed, raw);
      return { label: `bank deal ${seed}'s clearing line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap on a covered card", score: tripeaksGame.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: tripeaksGame.score(tripeaksGame.init(12)) }],
  help: { terms: ["28", "run"] },
  core: { fullAt: 28, at: (v) => cleared(v), parts: (s) => tripeaksStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: TpState, key: string) => tripeaksStdParts(s)!.find((p) => p.key === key)!.points;
    for (const [n, want] of [[0, 0], [1, 10], [2, 20], [3, 30]] as const) ok(part(at({ peaks: n }), "peaks") === want, `tripeaks: ${n} peak tops pay ${want}`);
    for (const [n, want] of [[0, 0], [1, 2], [5, 10], [10, 20], [16, 20]] as const) ok(part(at({ bestRun: n }), "run") === want, `tripeaks: a best run of ${n} pays ${want}`);
    const done = (tick: number) => at({ ended: 1, finishTick: tick, clearedCount: 28 });
    ok(part(done(600), "clear") === 10 && part(cleared(27), "clear") === 0, "tripeaks: clear 10 only with all 28 cleared");
    ok(part(done(TP_SPEED_FULL_S * 60), "speed") === TP_SPEED_MAX && part(done(TP_RUN_TICKS), "speed") === 0 && part(cleared(27), "speed") === 0, `tripeaks: speed full by ${TP_SPEED_FULL_S} s, 0 at the buzzer, none unfinished`);
  },
};
