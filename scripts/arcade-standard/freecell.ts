/**
 * arcade-standard-check's entry for `freecell` (Free Cell freecellRev 4, Cards & Board; docs/arcade-standard/freecell.md):
 * born on the standard at rev 1; rev 2 (31 Oct 2026) adds Undo and Reset with the same parts; rev 3 (1 Nov 2026) fills
 * the core at FC_CORE_UNITS_V3 units instead of all 52 home; rev 4 (3 Nov 2026) deals 40 cards (Ace to 10, eight
 * columns of five) from its own solved bank, with cards 60 (full at FC_CORE_UNITS_V4 units), par 50 (0 at 1.5 × par)
 * and speed 90 (full by FC_SPEED_FULL_S_V4 s); rev 5 (7 Nov 2026) keeps rev 4's deal and play with cards 105 full at
 * all 40 home (80 units), par 50 and speed 45 (whole-number maths). Perfect runs are the bank's par lines through the
 * server's replay on rev 5; the core's straight line is checked on cards home (two units each, so full at half the units
 * in cards).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  FC_CORE_MAX, FC_CORE_MAX_V4, FC_CORE_UNITS_V3, FC_CORE_UNITS_V4, FC_PAR_MAX, FC_PAR_MAX_V4, FC_RUN_TICKS, FC_SPEED_FULL_S, FC_SPEED_FULL_S_V4, FC_SPEED_MAX,
  FC_SPEED_MAX_V4, FC_CORE_MAX_V5, FC_CORE_UNITS_V5, FC_PAR_MAX_V5, FC_SPEED_MAX_V5, freecellGameFor, freecellStdParts, fcInitFrom, type FcState,
} from "../../src/lib/arcade/cards/freecell";
import { replayFreecellRun } from "../../src/lib/duel/cards";
import { freecellFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.freecell!.spec!;
const freecellGame4 = freecellGameFor(4);
const freecellGame = freecellGameFor(5);
const rec = (s: FcState) => Object.fromEntries((freecellStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: FcState) => Object.fromEntries((freecellStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** A rev-4 state with `home` cards home (lowest ranks first, suit by suit, ten a suit) and no column left: no sorted runs. */
function withHome4(home: number, over: Partial<FcState> = {}): FcState {
  return withHome(home, over, 4);
}
/** A rev-5 state (rev 4 for withHome4) with `home` cards home and no column left. */
function withHome(home: number, over: Partial<FcState> = {}, rev = 5): FcState {
  const s = { ...fcInitFrom(7, 20, 0, rev), acted: 1, cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1] } as FcState;
  s.home = [0, 1, 2, 3].map((k) => Math.max(0, Math.min(10, home - 10 * k)));
  return { ...s, ...over };
}
/** A rev-3 state (the 52-card deal) with `home` cards home. */
function withHome52(home: number, rev: number): FcState {
  const s = { ...fcInitFrom(7, 40, 0, rev), acted: 1, cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1] } as FcState;
  s.home = [0, 1, 2, 3].map((k) => Math.max(0, Math.min(13, home - 13 * k)));
  return s;
}

export const entry: StdEntry = {
  type: "freecell",
  field: "freecellRev",
  rev: 5,
  before: 4,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = freecellFlawless(seed, 20, 5);
      const r = replayFreecellRun(seed, raw, 5);
      return { label: `rev-5 bank deal ${seed}'s par line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that moved nothing", score: freecellGame.score({ ...freecellGame.init(3), acted: 1, cols: [[], [], [], [], [], [], [], []], home: [0, 0, 0, 0], cells: [-1, -1, -1, -1] }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: freecellGame.score(freecellGame.init(12)) }],
  help: { terms: ["par", "sorted run", "all 40 home"] },
  // Cards home pay two units each, so the core is full at FC_CORE_UNITS_V5 ÷ 2 cards home (all 40).
  core: { fullAt: FC_CORE_UNITS_V5 / 2, at: (v) => withHome(v), parts: (s) => freecellStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: FcState, key: string) => freecellStdParts(s)!.find((p) => p.key === key)!.points;
    // Rev 4 (stored rounds) keeps its parts exactly (asserted on rev-4 states).
    // Sorted runs pay half a card home: a column of 10♠ 9♥ 8♣ 7♥ is 4 units, two cards home.
    const run4 = withHome4(0, { cols: [[9, 13 + 8, 39 + 7, 13 + 6], [], [], [], [], [], [], []] });
    ok(part(run4, "core") === Math.floor((FC_CORE_MAX_V4 * 4) / FC_CORE_UNITS_V4), `freecell: four cards in a sorted run pay as two home (${part(run4, "core")})`);
    ok(
      part(withHome52(13, 2), "core") === Math.floor((FC_CORE_MAX * 26) / 104) && part(withHome52(13, 3), "core") === Math.floor((FC_CORE_MAX * 26) / FC_CORE_UNITS_V3),
      "freecell: rev 2 keeps the core full at all 52 home and rev 3 at 54 units (140 each)",
    );
    // Par and speed only on a finished run; par full at par, 0 at 1.5 × par; speed full by the fitted time, 0 at the buzzer.
    const done4 = (moves: number, tick: number) => withHome4(40, { ended: 1, moves, finishTick: tick, par: 20 });
    ok(part(done4(20, 600), "par") === FC_PAR_MAX_V4 && part(done4(25, 600), "par") === FC_PAR_MAX_V4 / 2 && part(done4(30, 600), "par") === 0, "freecell: par full at par, half at 1.25 × par, 0 at 1.5 × par");
    ok(part(done4(20, FC_SPEED_FULL_S_V4 * 60), "speed") === FC_SPEED_MAX_V4 && part(done4(20, FC_RUN_TICKS), "speed") === 0, `freecell: speed full by ${FC_SPEED_FULL_S_V4} s, 0 at the buzzer`);
    ok(part(withHome4(39, { moves: 20, par: 20, finishTick: 600 }), "par") === 0 && part(withHome4(39), "speed") === 0, "freecell: no par or speed without a finish");
    ok(part(withHome4(25), "core") === FC_CORE_MAX_V4 && part(withHome4(39), "core") === FC_CORE_MAX_V4, "freecell rev 4: the core full at 25 home (stored rounds)");
    // Rev 3 (stored rounds) keeps its parts: par 30 at par, 0 at twice par; speed 30 by 66 s.
    const done3 = { ...withHome52(52, 3), ended: 1, moves: 40, par: 40, finishTick: FC_SPEED_FULL_S * 60 };
    ok(part(done3, "par") === FC_PAR_MAX && part({ ...done3, moves: 80 }, "par") === 0 && part(done3, "speed") === FC_SPEED_MAX, "freecell: rev 3 keeps par 30 (0 at twice par) and speed 30 (full by 66 s)");
    // The 40-card deal: Ace to 10 in each suit, eight columns of five.
    const deal4 = freecellGame4.init(0);
    const cards4 = deal4.cols.flat().concat(deal4.home.flatMap((top, suit) => Array.from({ length: top }, (_, r) => suit * 13 + r)));
    ok(new Set(cards4).size === 40 && cards4.every((c) => c % 13 < 10), "freecell rev 4: the deal holds the 40 cards Ace to 10 (any aces already home counted)");

    // Rev 5: rev 4's deal, cards 105 full at all 40 home, par 50, speed 45 (whole-number maths).
    ok(FC_CORE_MAX_V5 === 105 && FC_CORE_UNITS_V5 === 80 && FC_PAR_MAX_V5 === 50 && FC_SPEED_MAX_V5 === 45, "freecell rev 5: cards 105 (full at 80 units, all 40 home), par 50, speed 45");
    const deal = freecellGame.init(0);
    ok(JSON.stringify(deal.cols) === JSON.stringify(deal4.cols) && deal.par === deal4.par && JSON.stringify(deal.home) === JSON.stringify(deal4.home), "freecell rev 5: rev 4's deal and par");
    const run = withHome(0, { cols: [[9, 13 + 8, 39 + 7, 13 + 6], [], [], [], [], [], [], []] });
    ok(part(run, "core") === Math.floor((FC_CORE_MAX_V5 * 4) / FC_CORE_UNITS_V5), `freecell rev 5: four cards in a sorted run pay as two home (${part(run, "core")})`);
    ok(part(withHome(39), "core") === Math.floor((105 * 78) / 80) && part(withHome(39), "core") > part(withHome(25), "core") && part(withHome(40), "core") === 105, "freecell rev 5: the core keeps rising to all 40 home (39 home beats 25)");
    let rising = true;
    for (let h = 1; h <= 40; h++) if (freecellGame.score(withHome(h)) < freecellGame.score(withHome(h - 1))) rising = false;
    ok(rising, "freecell rev 5: each card home never lowers the score");
    const done = (moves: number, tick: number) => withHome(40, { ended: 1, moves, finishTick: tick, par: 20 });
    ok(part(done(20, 600), "par") === FC_PAR_MAX_V5 && part(done(25, 600), "par") === FC_PAR_MAX_V5 / 2 && part(done(30, 600), "par") === 0, "freecell rev 5: par full at par, half at 1.25 × par, 0 at 1.5 × par");
    ok(part(done(20, FC_SPEED_FULL_S_V4 * 60), "speed") === FC_SPEED_MAX_V5 && part(done(20, FC_RUN_TICKS), "speed") === 0, `freecell rev 5: speed full by ${FC_SPEED_FULL_S_V4} s, 0 at the buzzer`);
    let exact = true;
    for (let t = FC_SPEED_FULL_S_V4 * 60; t <= FC_RUN_TICKS; t++) if (part(done(20, t), "speed") !== Math.floor((45 * (FC_RUN_TICKS - t)) / (FC_RUN_TICKS - FC_SPEED_FULL_S_V4 * 60))) exact = false;
    for (let m = 20; m <= 30; m++) if (part(done(m, 600), "par") !== Math.floor((50 * (60 - 2 * m)) / 20)) exact = false;
    ok(exact, "freecell rev 5: speed and par in whole numbers at every finish tick and move count");
    ok(part(withHome(39, { moves: 20, par: 20, finishTick: 600 }), "par") === 0 && part(withHome(39), "speed") === 0, "freecell rev 5: no par or speed without a finish");
    // The best unfinished position (39 home, 78 units) scores no more than the poorest finish (at the buzzer, past 1.5 × par).
    const bestMiss = freecellGame.score(withHome(39, { cols: [[9], [], [], [], [], [], [], []] }));
    const poorestFinish = freecellGame.score(done(60, FC_RUN_TICKS));
    ok(poorestFinish >= bestMiss, `freecell rev 5: the poorest finish (${poorestFinish}) scores at least the best unfinished position (${bestMiss})`);
  },
};
