/**
 * cards-nov7-check (7 Nov 2026; scoring audit issues 6 and 22, docs/audit-nov-2026/scoring.md; docs/arcade-standard/
 * pyramid.md, tripeaks.md, freecell.md): Thirteen pyramidRev 2, Summit tripeaksRev 3 and Free Cell freecellRev 5, the
 * stamps on which a partial clear earns in proportion.
 *
 *  1. Older stamps exactly as on main: 70 runs recorded on main before the change (scripts/fixtures/cards-nov7-legacy.json,
 *     scripts/cards-nov7-legacy-record.ts: pyramidRev 1, tripeaksRev 2 and freecellRev 4, skill-band bots at four levels
 *     and the flawless lines) replay to the same score, final-state checksum and tick.
 *  2. Rooms deal the new stamps; pinCardsPreShare(true) deals the stamps before them (for checks written for those).
 *  3. 200 on every dealt deal: all 300 Free Cell bank deals' par lines (rev 5), all 300 Summit bank deals' stock-par lines
 *     (rev 3) and 460 Thirteen seeds' witnesses (rev 2; Thirteen deals any seed: tuning 0–59, fresh 10000–10199 and 200
 *     room-style seeds) replay through the server's replay to exactly 200, every part at its maximum.
 *  4. The parts: each spec's maximums sum to 200, every replayed run's parts add up to its score (at least 1 when
 *     played), and the new parts are what the docs state.
 *  5. Proportional partial credit and no inversions: each card removed / cleared / home never lowers the score, along
 *     every bot run's own history too; the poorest clear scores at least the best run that misses one (worked out from
 *     the parts' own maximums, and on the bots' runs); Free Cell's core keeps rising to all 40 home (39 home beats 25).
 *  6. Whole-number speed (issue 22): stdSpeedInt is floor(max × (v − z) ÷ (f − z)) exactly on every input tried, the new
 *     stamps' speed and par lines use it, and the audit's example (max 50, 348 of 600) pays 29 where stdSpeed pays 28.
 *
 *   bun scripts/cards-nov7-check.ts
 */
import { readFileSync } from "node:fs";
import { stdSpecMax, stdSpeed, stdSpeedInt, stdSum, type StdPart } from "../src/lib/arcade/arcadeStandard";
import {
  FC_CORE_MAX_V5, FC_CORE_UNITS_V5, FC_PAR_MAX_V5, FC_REV, FC_REV_SHORT, FC_RUN_TICKS, FC_SPEED_FULL_S_V4, FC_SPEED_MAX_V5, FC_STD_SPEC, FC_STD_SPEC_V4,
  fcCheckpoint, fcInitFrom, freecellGameFor, freecellStdParts, type FcState,
} from "../src/lib/arcade/cards/freecell";
import { FC_DEALS_V4 } from "../src/lib/arcade/cards/freecellDealsV4.data";
import {
  TP_REV, TP_REV_PAR, TP_RUN_TICKS, TP_STD_SPEC, TP_STD_SPEC_V2, TP_V2_CLEAR_MAX, TP_V2_PAR_MAX, TP_V2_PEAK_MAX, TP_V2_RUN_MAX, TP_V2_SPEED_FULL_S, TP_V3_CORE_MAX, TP_V3_SPEED_MAX,
  tpCheckpoint, tripeaksGameFor, tripeaksStdParts, type TpState,
} from "../src/lib/arcade/cards/tripeaks";
import { TP_DEALS } from "../src/lib/arcade/cards/tripeaksDeals.data";
import {
  PY_CARDS, PY_PAIR_MAX, PY_REV, PY_RUN_TICKS, PY_SPEED_FULL_S, PY_STD_SPEC, PY_STD_SPEC_V1, PY_V2_CLEAR_MAX, PY_V2_CORE_MAX, PY_V2_SPEED_MAX,
  pyCheckpoint, pyramidGameFor, pyramidStdParts, type PyState,
} from "../src/lib/arcade/cards/pyramid";
import { encodeFreecellRun, encodePyramidRun, encodeTripeaksRun, replayFreecellRun, replayPyramidRun, replayTripeaksRun } from "../src/lib/duel/cards";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { pinCardsPreShare } from "../src/lib/duel/arcade.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { freecellFlawless, pyramidFlawless, tripeaksFlawless } from "./cards/flawless";
import { Human } from "./arcade-skill-bands/human";
import { bot as fcBot } from "./arcade-skill-bands/bots/freecell";
import { bot as tpBot } from "./arcade-skill-bands/bots/tripeaks";
import { bot as pyBot } from "./arcade-skill-bands/bots/pyramid";
import type { ArcadeGame, ArcadeInputEvent } from "../src/lib/arcade/engine";

// The replay logs a desync for a log sent without checkpoints; the scores are the replay's own either way.
console.error = () => {};
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const sumOk = (parts: StdPart[] | null, score: number) => parts !== null && Math.max(1, Math.min(200, stdSum(parts))) === score;

/* 1. Older stamps exactly as on main. */
{
  type LegacyRun = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
  const fx = JSON.parse(readFileSync(new URL("./fixtures/cards-nov7-legacy.json", import.meta.url), "utf8")) as { runs: LegacyRun[] };
  let same = 0;
  const revs = new Set<string>();
  for (const run of fx.runs) {
    revs.add(`${run.type}:${run.rev}`);
    const r = run.type === "freecell" ? replayFreecellRun(run.seed, run.raw, run.rev) : run.type === "tripeaks" ? replayTripeaksRun(run.seed, run.raw, run.rev) : replayPyramidRun(run.seed, run.raw, run.rev);
    const cp = run.type === "freecell" ? fcCheckpoint(r.state as FcState) : run.type === "tripeaks" ? tpCheckpoint(r.state as TpState) : pyCheckpoint(r.state as PyState);
    if (r.score === run.score && cp.checksum === run.checksum && r.state.tick === run.tick) same++;
    else failures.push(`${run.type} rev ${run.rev}: seed ${run.seed} ${run.label} replays to ${r.score} (main ${run.score})`);
  }
  ok(same === fx.runs.length && fx.runs.length === 70, `nov 7: all ${fx.runs.length} Free Cell rev-4, Summit rev-2 and Thirteen rev-1 runs recorded on main replay to the same score and final state (${same} of ${fx.runs.length})`);
  ok(revs.size === 3 && revs.has("freecell:4") && revs.has("tripeaks:2") && revs.has("pyramid:1"), "nov 7: the fixture holds the three revisions rooms dealt before the change");
}

/* 2. Rooms deal the new stamps; the pin deals the stamps before them. */
{
  ok(FC_REV === 5 && TP_REV === 3 && PY_REV === 2, "the dealt stamps: freecellRev 5, tripeaksRev 3, pyramidRev 2");
  let dealt = true;
  for (let k = 0; k < 20; k++) {
    const fc = generatePuzzle("freecell") as { freecellRev: number; seed: number };
    const tp = generatePuzzle("tripeaks") as { tripeaksRev: number; seed: number };
    const py = generatePuzzle("pyramid") as { pyramidRev: number; seed: number };
    if (fc.freecellRev !== 5 || tp.tripeaksRev !== 3 || py.pyramidRev !== 2 || fc.seed < 0 || fc.seed >= FC_DEALS_V4.length || tp.seed < 0 || tp.seed >= TP_DEALS.length || !(py.seed > 0)) dealt = false;
  }
  ok(dealt, "rooms deal freecellRev 5 (a bank index), tripeaksRev 3 (a bank index) and pyramidRev 2 (any seed)");
  const prev = pinCardsPreShare(true);
  const fc = generatePuzzle("freecell") as { freecellRev: number };
  const tp = generatePuzzle("tripeaks") as { tripeaksRev: number };
  const py = generatePuzzle("pyramid") as { pyramidRev: number };
  pinCardsPreShare(prev);
  ok(fc.freecellRev === FC_REV_SHORT && tp.tripeaksRev === TP_REV_PAR && py.pyramidRev === 1, "pinCardsPreShare(true) deals freecellRev 4, tripeaksRev 2 and pyramidRev 1");
  ok(LIVE_BANDS.freecell?.std === FC_STD_SPEC && LIVE_BANDS.tripeaks?.std === TP_STD_SPEC && LIVE_BANDS.pyramid?.std === PY_STD_SPEC && LIVE_BANDS.freecell?.rev === 5 && LIVE_BANDS.tripeaks?.rev === 3 && LIVE_BANDS.pyramid?.rev === 2, "LIVE_BANDS carries the new stamps and specs");
  // The same deal on the new and the old stamp.
  ok(JSON.stringify({ ...freecellGameFor(5).init(9), rev: 0, start: [] }) === JSON.stringify({ ...freecellGameFor(4).init(9), rev: 0, start: [] }), "freecell rev 5: rev 4's deal and par");
  ok(JSON.stringify({ ...tripeaksGameFor(3).init(9), rev: 0 }) === JSON.stringify({ ...tripeaksGameFor(2).init(9), rev: 0 }), "tripeaks rev 3: rev 2's deal and stock par");
  ok(JSON.stringify({ ...pyramidGameFor(2).init(9), rev: 0 }) === JSON.stringify({ ...pyramidGameFor(1).init(9), rev: 0 }), "pyramid rev 2: rev 1's deal");
}

/* 3. 200 on every dealt deal, through the server's replay. */
{
  let all = true;
  for (let i = 0; i < FC_DEALS_V4.length; i++) {
    const { raw } = freecellFlawless(i, 20, 5);
    const r = replayFreecellRun(i, raw, 5);
    const parts = freecellStdParts(r.state)!;
    if (r.score !== 200 || !r.finished || r.home !== 40 || r.flagged || parts.some((p) => p.points !== p.max) || !sumOk(parts, r.score)) {
      all = false;
      failures.push(`freecell rev 5: bank deal ${i}'s par line replays to ${r.score} (${r.home} home)`);
    }
  }
  ok(all, `freecell rev 5: all ${FC_DEALS_V4.length} bank deals' par lines replay to 200, every part full`);
  all = true;
  for (let i = 0; i < TP_DEALS.length; i++) {
    const { raw } = tripeaksFlawless(i, 15, 3);
    const r = replayTripeaksRun(i, raw, 3);
    const parts = tripeaksStdParts(r.state)!;
    if (r.score !== 200 || r.cleared !== 28 || r.flagged || parts.some((p) => p.points !== p.max) || !sumOk(parts, r.score)) {
      all = false;
      failures.push(`tripeaks rev 3: bank deal ${i}'s stock-par line replays to ${r.score} (${r.cleared} cleared)`);
    }
  }
  ok(all, `tripeaks rev 3: all ${TP_DEALS.length} bank deals' stock-par lines replay to 200, every part full`);
  const seeds: number[] = [];
  for (let s = 0; s < 60; s++) seeds.push(s);
  for (let s = 10000; s < 10200; s++) seeds.push(s);
  for (let i = 0, x = 0x2545f491; i < 200; i++) {
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x6b43a9b5) | 0;
    seeds.push(x >>> 1);
  }
  all = true;
  for (const seed of seeds) {
    const { raw } = pyramidFlawless(seed, 15, 2);
    const r = replayPyramidRun(seed, raw, 2);
    const parts = pyramidStdParts(r.state)!;
    if (r.score !== 200 || !r.finished || r.flagged || parts.some((p) => p.points !== p.max) || !sumOk(parts, r.score)) {
      all = false;
      failures.push(`pyramid rev 2: seed ${seed}'s witness replays to ${r.score} (${r.removed} removed)`);
    }
  }
  ok(all, `pyramid rev 2: ${seeds.length} seeds' witnesses replay to 200, every part full`);
}

/* 4. The parts. */
{
  const shape = (spec: typeof FC_STD_SPEC) => spec.parts.map((p) => `${p.key}:${p.max}`).join(" ");
  ok(stdSpecMax(FC_STD_SPEC) === 200 && stdSpecMax(TP_STD_SPEC) === 200 && stdSpecMax(PY_STD_SPEC) === 200, "the three new specs' maximums sum to 200");
  ok(shape(FC_STD_SPEC) === "core:105 par:50 speed:45" && FC_STD_SPEC.rev === 5 && FC_STD_SPEC.parts[0]!.of === 80, "freecell rev 5: cards 105 (full at 80 units, all 40 home), par 50, speed 45");
  ok(shape(TP_STD_SPEC) === "core:105 peaks:30 run:10 clear:10 par:20 speed:25" && TP_STD_SPEC.rev === 3, "tripeaks rev 3: cards 105, peak tops 30, longest run 10, clear 10, stock par 20, speed 25");
  ok(shape(PY_STD_SPEC) === "core:140 clear:15 speed:25 pairs:20" && PY_STD_SPEC.rev === 2, "pyramid rev 2: pyramid cards 140, cleared 15, speed 25, pyramid pairs 20");
  ok(shape(FC_STD_SPEC_V4) === "core:60 par:50 speed:90" && shape(TP_STD_SPEC_V2) === "core:80 peaks:30 run:10 clear:10 par:20 speed:50" && shape(PY_STD_SPEC_V1) === "core:120 clear:10 speed:50 pairs:20", "the older stamps keep their specs (Free Cell rev 4, Summit rev 2, Thirteen rev 1)");
}

/* 5. Proportional partial credit and no inversions; the bots' runs. */
type AnyGame = ArcadeGame<unknown, ArcadeInputEvent | null>;
{
  // From the parts' own maximums: the best run that misses a clear against the poorest clear.
  const pyMiss = Math.floor((PY_V2_CORE_MAX * (PY_CARDS - 1)) / PY_CARDS) + PY_PAIR_MAX;
  const pyClear = PY_V2_CORE_MAX + PY_V2_CLEAR_MAX;
  ok(pyClear >= pyMiss, `pyramid rev 2: the poorest clear (${pyClear}: every card, the clear, no speed, no pyramid pair) at least the best miss (${pyMiss}: 27 cards and every pair)`);
  const tpMiss = Math.floor((TP_V3_CORE_MAX * 27) / 28) + TP_V2_PEAK_MAX + TP_V2_RUN_MAX;
  const tpClear = TP_V3_CORE_MAX + TP_V2_PEAK_MAX + 1 + TP_V2_CLEAR_MAX;
  ok(tpClear >= tpMiss, `tripeaks rev 3: the poorest clear (${tpClear}: every card and top, a run of 1, the clear, no par or speed) at least the best miss (${tpMiss})`);
  const fcMiss = Math.floor((FC_CORE_MAX_V5 * (FC_CORE_UNITS_V5 - 2)) / FC_CORE_UNITS_V5);
  ok(FC_CORE_MAX_V5 >= fcMiss && fcMiss === 102, `freecell rev 5: an unfinished position holds 78 units at most (${fcMiss} points), a finish ${FC_CORE_MAX_V5} or more`);
  // The share locked behind a clear, before → after (issue 6).
  ok(PY_V2_CLEAR_MAX + PY_V2_SPEED_MAX === 40 && TP_V2_CLEAR_MAX + TP_V2_PAR_MAX + TP_V3_SPEED_MAX === 55 && FC_PAR_MAX_V5 + FC_SPEED_MAX_V5 === 95, "the points locked behind a clear: Thirteen 60 → 40, Summit 80 → 55, Free Cell 140 → 95");

  // Free Cell: 39 home beats 25 home; every card home raises the core.
  const fcHome = (home: number): FcState => {
    const s = { ...fcInitFrom(7, 20, 0, 5), acted: 1, cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1] } as FcState;
    s.home = [0, 1, 2, 3].map((k) => Math.max(0, Math.min(10, home - 10 * k)));
    return s;
  };
  const g5 = freecellGameFor(5);
  let strictly = true;
  for (let h = 1; h <= 40; h++) if (freecellStdParts(fcHome(h))![0]!.points <= freecellStdParts(fcHome(h - 1))![0]!.points) strictly = false;
  ok(strictly && g5.score(fcHome(39)) > g5.score(fcHome(25)), `freecell rev 5: each card home raises the core (25 home ${g5.score(fcHome(25))}, 39 home ${g5.score(fcHome(39))})`);

  // The bots, weak to elite, on 12 deals each: along each run's own history (the bots never undo) the score never falls
  // on Thirteen and Summit, and on Free Cell never falls on a move that sends a card home (a card taken off a sorted run
  // to a free cell gives back its half unit, as on every revision); each final score is its parts' sum, and every clear
  // scores at least every miss.
  const levels = ["weak", "average", "good", "great", "near", "elite"] as const;
  const games: { type: string; homeOnly?: (s: never) => number; game: AnyGame; bot: typeof fcBot; seeds: number[]; replay: (seed: number, raw: string) => { score: number; state: unknown }; encode: (r: never) => string; parts: (s: never) => StdPart[] | null; done: (s: never) => boolean; rev: number }[] = [
    { type: "freecell", homeOnly: ((s: FcState) => s.home[0]! + s.home[1]! + s.home[2]! + s.home[3]!) as never, game: freecellGameFor(5) as AnyGame, bot: fcBot, seeds: [0, 7, 42, 99, 150, 201, 250, 299, 13, 77, 123, 222], replay: (seed, raw) => replayFreecellRun(seed, raw, 5), encode: encodeFreecellRun as never, parts: freecellStdParts as never, done: ((s: FcState) => s.ended === 1) as never, rev: 5 },
    { type: "tripeaks", game: tripeaksGameFor(3) as AnyGame, bot: tpBot, seeds: [0, 3, 17, 50, 99, 150, 201, 250, 299, 11, 77, 123], replay: (seed, raw) => replayTripeaksRun(seed, raw, 3), encode: encodeTripeaksRun as never, parts: tripeaksStdParts as never, done: ((s: TpState) => s.ended === 1) as never, rev: 3 },
    { type: "pyramid", game: pyramidGameFor(2) as AnyGame, bot: pyBot, seeds: [1, 9, 77, 4242, 10000, 10001, 10002, 10003, 10004, 10005, 10006, 123456789], replay: (seed, raw) => replayPyramidRun(seed, raw, 2), encode: encodePyramidRun as never, parts: pyramidStdParts as never, done: ((s: PyState) => s.ended === 1) as never, rev: 2 },
  ];
  for (const g of games) {
    let monotone = true;
    let sums = true;
    let worstClear = Infinity;
    let bestMiss = -Infinity;
    let runs = 0;
    for (const seed of g.seeds) {
      for (const level of levels) {
        const { events = [] } = g.bot({ game: g.game, seed, rev: g.rev, human: new Human(g.type, seed, level), fixes: true });
        const byTick = new Map(events.map((e) => [e.t, e]));
        let st = g.game.init(seed);
        let last = 0;
        let lastHome = g.homeOnly ? g.homeOnly(st as never) : 0;
        while (!g.game.isOver(st)) {
          st = g.game.step(st, byTick.get((st as { tick: number }).tick + 1) ?? null);
          const sc = g.game.score(st);
          const home = g.homeOnly ? g.homeOnly(st as never) : 0;
          if (sc < last && (!g.homeOnly || home > lastHome)) monotone = false;
          last = sc;
          lastHome = home;
        }
        const raw = g.encode({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] } as never);
        const r = g.replay(seed, raw);
        runs++;
        if (!sumOk(g.parts(r.state as never), r.score)) sums = false;
        if (g.done(r.state as never)) worstClear = Math.min(worstClear, r.score);
        else bestMiss = Math.max(bestMiss, r.score);
      }
    }
    ok(monotone, `${g.type} rev ${g.rev}: along ${runs} bot runs' histories the score never falls${g.homeOnly ? " on a move that sends a card home" : ""}`);
    ok(sums, `${g.type} rev ${g.rev}: every bot run's parts add up to its stored score`);
    ok(worstClear === Infinity || bestMiss === -Infinity || worstClear >= bestMiss, `${g.type} rev ${g.rev}: every bot clear (poorest ${worstClear}) scores at least every bot miss (best ${bestMiss})`);
  }

  // Thirteen and Summit: each card more never lowers the score, with or without the other parts.
  const g2 = pyramidGameFor(2);
  const pyAt = (v: number, pairs: number): PyState => ({ ...g2.init(5), acted: 1, removed: v, ppPairs: pairs, gone: Array.from({ length: PY_CARDS }, (_, i) => (i >= PY_CARDS - v ? 1 : 0)) });
  let pyUp = true;
  for (let pairs = 0; pairs <= 10; pairs++) for (let v = 1; v <= PY_CARDS; v++) if (g2.score(pyAt(v, pairs)) < g2.score(pyAt(v - 1, pairs))) pyUp = false;
  ok(pyUp, "pyramid rev 2: each card removed never lowers the score, at any count of pyramid pairs");
  const g3 = tripeaksGameFor(3);
  const tpAt = (v: number, peaks: number, run: number): TpState => ({ ...g3.init(5), acted: 1, clearedCount: v, peaks, bestRun: run });
  let tpUp = true;
  for (const peaks of [0, 3]) for (const run of [0, 10]) for (let v = 1; v <= 28; v++) if (g3.score(tpAt(v, peaks, run)) < g3.score(tpAt(v - 1, peaks, run))) tpUp = false;
  ok(tpUp, "tripeaks rev 3: each card cleared never lowers the score");
}

/* 6. Whole-number speed (issue 22). */
{
  let exact = true;
  for (const max of [20, 25, 45, 50, 90]) {
    for (let v = -5; v <= 700; v += 7) {
      for (const [f, z] of [[600, 0], [0, 600], [1200, 5400], [32 * 60, 7200], [24, 36]] as const) {
        const num = f > z ? v - z : z - v;
        const den = Math.abs(f - z);
        const want = num >= den ? max : num <= 0 ? 0 : Math.floor((max * num) / den);
        if (stdSpeedInt(max, v, f, z) !== want) exact = false;
      }
    }
  }
  ok(exact, "stdSpeedInt: floor(max × (v − z) ÷ (f − z)) in whole numbers on every input tried, held to 0…max");
  ok(stdSpeed(50, 348, 600, 0) === 28 && stdSpeedInt(50, 348, 600, 0) === 29, "the audit's example: max 50 at 348 of 600 pays 29 in whole numbers (stdSpeed's float share pays 28)");
  // The new stamps' lines are the whole-number ones at every tick; the older stamps keep stdSpeed's.
  let pyOk = true;
  let tpOk = true;
  let fcOk = true;
  for (let t = 0; t <= 7200; t += 1) {
    if (t <= PY_RUN_TICKS) {
      const st = { ...pyramidGameFor(2).init(3), acted: 1, ended: 1, removed: PY_CARDS, finishTick: t } as PyState;
      if (pyramidStdParts(st)!.find((p) => p.key === "speed")!.points !== stdSpeedInt(PY_V2_SPEED_MAX, t, PY_SPEED_FULL_S * 60, PY_RUN_TICKS)) pyOk = false;
      const old = { ...pyramidGameFor(1).init(3), acted: 1, ended: 1, removed: PY_CARDS, finishTick: t } as PyState;
      if (pyramidStdParts(old)!.find((p) => p.key === "speed")!.points !== stdSpeed(50, t, PY_SPEED_FULL_S * 60, PY_RUN_TICKS)) pyOk = false;
    }
    if (t <= TP_RUN_TICKS) {
      const st = { ...tripeaksGameFor(3).init(3), acted: 1, ended: 1, clearedCount: 28, finishTick: t } as TpState;
      if (tripeaksStdParts(st)!.find((p) => p.key === "speed")!.points !== stdSpeedInt(TP_V3_SPEED_MAX, t, TP_V2_SPEED_FULL_S * 60, TP_RUN_TICKS)) tpOk = false;
      const old = { ...tripeaksGameFor(2).init(3), acted: 1, ended: 1, clearedCount: 28, finishTick: t } as TpState;
      if (tripeaksStdParts(old)!.find((p) => p.key === "speed")!.points !== stdSpeed(50, t, TP_V2_SPEED_FULL_S * 60, TP_RUN_TICKS)) tpOk = false;
    }
    const fin = { ...freecellGameFor(5).init(3), acted: 1, ended: 1, finishTick: t, home: [10, 10, 10, 10], cols: [[], [], [], [], [], [], [], []] } as FcState;
    if (freecellStdParts(fin)!.find((p) => p.key === "speed")!.points !== stdSpeedInt(FC_SPEED_MAX_V5, t, FC_SPEED_FULL_S_V4 * 60, FC_RUN_TICKS)) fcOk = false;
    const old = { ...freecellGameFor(4).init(3), acted: 1, ended: 1, finishTick: t, home: [10, 10, 10, 10], cols: [[], [], [], [], [], [], [], []] } as FcState;
    if (freecellStdParts(old)!.find((p) => p.key === "speed")!.points !== stdSpeed(90, t, FC_SPEED_FULL_S_V4 * 60, FC_RUN_TICKS)) fcOk = false;
  }
  ok(pyOk, "pyramid: rev 2's speed is stdSpeedInt at every finish tick; rev 1's stays stdSpeed");
  ok(tpOk, "tripeaks: rev 3's speed is stdSpeedInt at every finish tick; rev 2's stays stdSpeed");
  ok(fcOk, "freecell: rev 5's speed is stdSpeedInt at every finish tick; rev 4's stays stdSpeed");
  let parOk = true;
  for (let turns = 0; turns <= 23; turns++) {
    const st = { ...tripeaksGameFor(3).init(3), acted: 1, ended: 1, clearedCount: 28, finishTick: 600, turns, stockPar: 7 } as TpState;
    const want = turns <= 7 ? TP_V2_PAR_MAX : stdSpeedInt(TP_V2_PAR_MAX, turns, 7, 23);
    if (tripeaksStdParts(st)!.find((p) => p.key === "par")!.points !== want) parOk = false;
  }
  for (let moves = 10; moves <= 40; moves++) {
    const st = { ...freecellGameFor(5).init(3), acted: 1, ended: 1, finishTick: 600, moves, par: 20, home: [10, 10, 10, 10], cols: [[], [], [], [], [], [], [], []] } as FcState;
    if (freecellStdParts(st)!.find((p) => p.key === "par")!.points !== stdSpeedInt(FC_PAR_MAX_V5, 2 * moves, 40, 60)) parOk = false;
  }
  ok(parOk, "tripeaks rev 3's stock par and freecell rev 5's par lines are whole-number lines too");
}

if (failures.length) {
  console.log(`FAIL cards-nov7-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS cards-nov7-check: ${checks} checks — 70 older-stamp runs as on main; ${FC_DEALS_V4.length} Free Cell (rev 5), ${TP_DEALS.length} Summit (rev 3) and 460 Thirteen (rev 2) deals at 200 through the server replay; parts sum to 200; no inversions; whole-number speed`);
