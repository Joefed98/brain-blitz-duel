/**
 * arcade-standard-check's entry for `tripeaks` (Summit tripeaksRev 2, Cards & Board; docs/arcade-standard/tripeaks.md):
 * born on the standard at rev 1; rev 2 (3 Nov 2026) adds the stock par (each bank deal's fewest stock turns on a clear
 * with a run of ten, tripeaksStockPar.data.ts) and re-fits the parts: cards 80, peak tops 30, longest run 10, clear 10,
 * stock par 20, speed 50 (full by 20 s). Perfect runs are the deals' stock-par lines through the server's replay.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  TP_RUN_TICKS, TP_SPEED_FULL_S, TP_SPEED_MAX, TP_V2_CLEAR_MAX, TP_V2_PAR_MAX, TP_V2_SPEED_FULL_S, TP_V2_SPEED_MAX, tripeaksGame, tripeaksGameFor, tripeaksStdParts, type TpState,
} from "../../src/lib/arcade/cards/tripeaks";
import { replayTripeaksRun } from "../../src/lib/duel/cards";
import { tripeaksFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.tripeaks!.spec!;
const game = tripeaksGameFor(2);
const rec = (s: TpState) => Object.fromEntries((tripeaksStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: TpState) => Object.fromEntries((tripeaksStdParts(s) ?? []).map((p) => [p.key, p.max]));
const at = (over: Partial<TpState>): TpState => ({ ...game.init(5), acted: 1, ...over });
const cleared = (v: number): TpState => at({ clearedCount: v, cleared: Array.from({ length: 28 }, (_, i) => (i >= 28 - v ? 1 : 0)) });

export const entry: StdEntry = {
  type: "tripeaks",
  field: "tripeaksRev",
  rev: 2,
  before: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = tripeaksFlawless(seed, 15, 2);
      const r = replayTripeaksRun(seed, raw, 2);
      return { label: `bank deal ${seed}'s stock-par line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap on a covered card", score: game.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: game.score(game.init(12)) }],
  help: { terms: ["28", "run", "par"] },
  core: { fullAt: 28, at: (v) => cleared(v), parts: (s) => tripeaksStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: TpState, key: string) => tripeaksStdParts(s)!.find((p) => p.key === key)!.points;
    for (const [n, want] of [[0, 0], [1, 10], [2, 20], [3, 30]] as const) ok(part(at({ peaks: n }), "peaks") === want, `tripeaks: ${n} peak tops pay ${want}`);
    for (const [n, want] of [[0, 0], [1, 1], [5, 5], [10, 10], [16, 10]] as const) ok(part(at({ bestRun: n }), "run") === want, `tripeaks: a best run of ${n} pays ${want}`);
    const done = (tick: number, turns = 0) => at({ ended: 1, finishTick: tick, clearedCount: 28, turns, stockPar: 12 });
    ok(part(done(600), "clear") === TP_V2_CLEAR_MAX && part(cleared(27), "clear") === 0, "tripeaks: clear 10 only with all 28 cleared");
    ok(part(done(TP_V2_SPEED_FULL_S * 60), "speed") === TP_V2_SPEED_MAX && part(done(TP_RUN_TICKS), "speed") === 0 && part(cleared(27), "speed") === 0, `tripeaks: speed full by ${TP_V2_SPEED_FULL_S} s, 0 at the buzzer, none unfinished`);
    ok(part(done(600, 12), "par") === TP_V2_PAR_MAX && part(done(600, 9), "par") === TP_V2_PAR_MAX && part(done(600, 23), "par") === 0 && part(done(600, 18), "par") === Math.floor((TP_V2_PAR_MAX * 5) / 11) && part(cleared(27), "par") === 0, "tripeaks: stock par full at or under par, even to 0 with the whole stock turned, none uncleared");
    // Rev 1 (stored rounds) keeps its five parts: core 120, run 2 a card, speed 20 by 27 s.
    const v1 = { ...tripeaksGame.init(5), acted: 1, ended: 1, finishTick: TP_SPEED_FULL_S * 60, clearedCount: 28, bestRun: 10, peaks: 3 };
    ok(JSON.stringify(tripeaksStdParts(v1)!.map((p) => [p.key, p.points])) === JSON.stringify([["core", 120], ["peaks", 30], ["run", 20], ["clear", 10], ["speed", TP_SPEED_MAX]]), "tripeaks: rev 1 keeps its five parts (120, 30, 20, 10, 20)");
  },
};
