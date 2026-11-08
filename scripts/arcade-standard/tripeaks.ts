/**
 * arcade-standard-check's entry for `tripeaks` (Summit tripeaksRev 2, Cards & Board; docs/arcade-standard/tripeaks.md):
 * born on the standard at rev 1; rev 2 (3 Nov 2026) adds the stock par (each bank deal's fewest stock turns on a clear
 * with a run of ten, tripeaksStockPar.data.ts) and re-fits the parts: cards 80, peak tops 30, longest run 10, clear 10,
 * stock par 20, speed 50 (full by 20 s); rev 3 (7 Nov 2026) moves half the speed onto the cards: cards 105, peak tops
 * 30, longest run 10, clear 10, stock par 20, speed 25 (whole-number maths). Perfect runs are the deals' stock-par lines
 * through the server's replay on rev 3.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  TP_RUN_TICKS, TP_SPEED_FULL_S, TP_SPEED_MAX, TP_V2_CLEAR_MAX, TP_V2_PAR_MAX, TP_V2_SPEED_FULL_S, TP_V2_SPEED_MAX, TP_V3_CORE_MAX, TP_V3_SPEED_MAX, tripeaksGame, tripeaksGameFor, tripeaksStdParts, type TpState,
} from "../../src/lib/arcade/cards/tripeaks";
import { replayTripeaksRun } from "../../src/lib/duel/cards";
import { tripeaksFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.tripeaks!.spec!;
const game2 = tripeaksGameFor(2);
const game = tripeaksGameFor(3);
const rec = (s: TpState) => Object.fromEntries((tripeaksStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: TpState) => Object.fromEntries((tripeaksStdParts(s) ?? []).map((p) => [p.key, p.max]));
/** A rev-2 state (stored rounds): its own parts. */
const at2 = (over: Partial<TpState>): TpState => ({ ...game2.init(5), acted: 1, ...over });
const cleared2 = (v: number): TpState => at2({ clearedCount: v, cleared: Array.from({ length: 28 }, (_, i) => (i >= 28 - v ? 1 : 0)) });
const at = (over: Partial<TpState>): TpState => ({ ...game.init(5), acted: 1, ...over });
const cleared = (v: number): TpState => at({ clearedCount: v, cleared: Array.from({ length: 28 }, (_, i) => (i >= 28 - v ? 1 : 0)) });

export const entry: StdEntry = {
  type: "tripeaks",
  field: "tripeaksRev",
  rev: 3,
  before: 2,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = tripeaksFlawless(seed, 15, 3);
      const r = replayTripeaksRun(seed, raw, 3);
      return { label: `bank deal ${seed}'s stock-par line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap on a covered card", score: game.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: game.score(game.init(12)) }],
  help: { terms: ["28", "run", "par"] },
  core: { fullAt: 28, at: (v) => cleared(v), parts: (s) => tripeaksStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: TpState, key: string) => tripeaksStdParts(s)!.find((p) => p.key === key)!.points;
    // Rev 2 (stored rounds) keeps its six parts exactly (asserted on rev-2 states).
    for (const [n, want] of [[0, 0], [1, 10], [2, 20], [3, 30]] as const) ok(part(at2({ peaks: n }), "peaks") === want, `tripeaks: ${n} peak tops pay ${want}`);
    for (const [n, want] of [[0, 0], [1, 1], [5, 5], [10, 10], [16, 10]] as const) ok(part(at2({ bestRun: n }), "run") === want, `tripeaks: a best run of ${n} pays ${want}`);
    const done2 = (tick: number, turns = 0) => at2({ ended: 1, finishTick: tick, clearedCount: 28, turns, stockPar: 12 });
    ok(part(done2(600), "clear") === TP_V2_CLEAR_MAX && part(cleared2(27), "clear") === 0, "tripeaks: clear 10 only with all 28 cleared");
    ok(part(done2(TP_V2_SPEED_FULL_S * 60), "speed") === TP_V2_SPEED_MAX && part(done2(TP_RUN_TICKS), "speed") === 0 && part(cleared2(27), "speed") === 0, `tripeaks: speed full by ${TP_V2_SPEED_FULL_S} s, 0 at the buzzer, none unfinished`);
    ok(part(done2(600, 12), "par") === TP_V2_PAR_MAX && part(done2(600, 9), "par") === TP_V2_PAR_MAX && part(done2(600, 23), "par") === 0 && part(done2(600, 18), "par") === Math.floor((TP_V2_PAR_MAX * 5) / 11) && part(cleared2(27), "par") === 0, "tripeaks: stock par full at or under par, even to 0 with the whole stock turned, none uncleared");
    ok(part(cleared2(28), "core") === 80 && part(cleared2(14), "core") === 40, "tripeaks rev 2: cards 80 on the 28");
    // Rev 1 (stored rounds) keeps its five parts: core 120, run 2 a card, speed 20 by 27 s.
    const v1 = { ...tripeaksGame.init(5), acted: 1, ended: 1, finishTick: TP_SPEED_FULL_S * 60, clearedCount: 28, bestRun: 10, peaks: 3 };
    ok(JSON.stringify(tripeaksStdParts(v1)!.map((p) => [p.key, p.points])) === JSON.stringify([["core", 120], ["peaks", 30], ["run", 20], ["clear", 10], ["speed", TP_SPEED_MAX]]), "tripeaks: rev 1 keeps its five parts (120, 30, 20, 10, 20)");

    // Rev 3: cards 105, speed 25 (whole-number maths); peaks, run, clear and stock par as rev 2.
    ok(TP_V3_CORE_MAX === 105 && TP_V3_SPEED_MAX === 25, "tripeaks rev 3: cards 105, speed 25");
    for (const [n, want] of [[0, 0], [1, 10], [2, 20], [3, 30]] as const) ok(part(at({ peaks: n }), "peaks") === want, `tripeaks rev 3: ${n} peak tops pay ${want}`);
    for (const [n, want] of [[0, 0], [1, 1], [5, 5], [10, 10], [16, 10]] as const) ok(part(at({ bestRun: n }), "run") === want, `tripeaks rev 3: a best run of ${n} pays ${want}`);
    const done = (tick: number, turns = 0) => at({ ended: 1, finishTick: tick, clearedCount: 28, turns, stockPar: 12 });
    ok(part(done(600), "clear") === TP_V2_CLEAR_MAX && part(cleared(27), "clear") === 0, "tripeaks rev 3: clear 10 only with all 28 cleared");
    ok(part(done(TP_V2_SPEED_FULL_S * 60), "speed") === TP_V3_SPEED_MAX && part(done(TP_RUN_TICKS), "speed") === 0 && part(cleared(27), "speed") === 0, `tripeaks rev 3: speed full by ${TP_V2_SPEED_FULL_S} s, 0 at the buzzer, none unfinished`);
    let exact = true;
    for (let t = TP_V2_SPEED_FULL_S * 60; t <= TP_RUN_TICKS; t++) if (part(done(t), "speed") !== Math.floor((25 * (TP_RUN_TICKS - t)) / (TP_RUN_TICKS - TP_V2_SPEED_FULL_S * 60))) exact = false;
    ok(exact, "tripeaks rev 3: speed is floor(25 × ticks to spare ÷ 2400) in whole numbers at every finish tick");
    let parExact = true;
    for (let turns = 13; turns <= 23; turns++) if (part(done(600, turns), "par") !== Math.floor((TP_V2_PAR_MAX * (23 - turns)) / 11)) parExact = false;
    ok(parExact && part(done(600, 12), "par") === TP_V2_PAR_MAX && part(done(600, 9), "par") === TP_V2_PAR_MAX && part(cleared(27), "par") === 0, "tripeaks rev 3: stock par full at or under par, floor(20 × turns to spare ÷ (23 − par)) in whole numbers, none uncleared");
    let rising = true;
    for (let v = 1; v <= 28; v++) if (game.score(cleared(v)) < game.score(cleared(v - 1))) rising = false;
    ok(rising && part(cleared(28), "core") === 105 && part(cleared(27), "core") === 101, "tripeaks rev 3: each card cleared never lowers the score (cards 105 on the 28)");
    const bestMiss = game.score({ ...cleared(27), peaks: 3, bestRun: 27 });
    const poorestClear = game.score({ ...done(TP_RUN_TICKS, 23), peaks: 3, bestRun: 1 });
    ok(poorestClear >= bestMiss, `tripeaks rev 3: the poorest clear (${poorestClear}) scores at least the best run that misses one (${bestMiss})`);
  },
};
