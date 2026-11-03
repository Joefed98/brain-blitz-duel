/**
 * arcade-standard-check's entry for `freecell` (Free Cell freecellRev 4, Cards & Board; docs/arcade-standard/freecell.md):
 * born on the standard at rev 1; rev 2 (31 Oct 2026) adds Undo and Reset with the same parts; rev 3 (1 Nov 2026) fills
 * the core at FC_CORE_UNITS_V3 units instead of all 52 home; rev 4 (3 Nov 2026) deals 40 cards (Ace to 10, eight
 * columns of five) from its own solved bank, with cards 60 (full at FC_CORE_UNITS_V4 units), par 50 (0 at 1.5 × par)
 * and speed 90 (full by FC_SPEED_FULL_S_V4 s). Perfect runs are the rev-4 bank's par lines through the server's
 * replay; the core's straight line is checked on cards home (two units each, so full at half the units in cards).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  FC_CORE_MAX, FC_CORE_MAX_V4, FC_CORE_UNITS_V3, FC_CORE_UNITS_V4, FC_PAR_MAX, FC_PAR_MAX_V4, FC_RUN_TICKS, FC_SPEED_FULL_S, FC_SPEED_FULL_S_V4, FC_SPEED_MAX,
  FC_SPEED_MAX_V4, freecellGameFor, freecellStdParts, fcInitFrom, type FcState,
} from "../../src/lib/arcade/cards/freecell";
import { replayFreecellRun } from "../../src/lib/duel/cards";
import { freecellFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.freecell!.spec!;
const freecellGame = freecellGameFor(4);
const rec = (s: FcState) => Object.fromEntries((freecellStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: FcState) => Object.fromEntries((freecellStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** A rev-4 state with `home` cards home (lowest ranks first, suit by suit, ten a suit) and no column left: no sorted runs. */
function withHome(home: number, over: Partial<FcState> = {}): FcState {
  const s = { ...fcInitFrom(7, 20, 0, 4), acted: 1, cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1] } as FcState;
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
  rev: 4,
  before: 3,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = freecellFlawless(seed, 20, 4);
      const r = replayFreecellRun(seed, raw, 4);
      return { label: `rev-4 bank deal ${seed}'s par line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that moved nothing", score: freecellGame.score({ ...freecellGame.init(3), acted: 1, cols: [[], [], [], [], [], [], [], []], home: [0, 0, 0, 0], cells: [-1, -1, -1, -1] }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: freecellGame.score(freecellGame.init(12)) }],
  help: { terms: ["par", "sorted runs", "40"] },
  // Cards home pay two units each, so the core is full at FC_CORE_UNITS_V4 ÷ 2 cards home.
  core: { fullAt: FC_CORE_UNITS_V4 / 2, at: (v) => withHome(v), parts: (s) => freecellStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: FcState, key: string) => freecellStdParts(s)!.find((p) => p.key === key)!.points;
    // Sorted runs pay half a card home: a column of 10♠ 9♥ 8♣ 7♥ is 4 units, two cards home.
    const run = withHome(0, { cols: [[9, 13 + 8, 39 + 7, 13 + 6], [], [], [], [], [], [], []] });
    ok(part(run, "core") === Math.floor((FC_CORE_MAX_V4 * 4) / FC_CORE_UNITS_V4), `freecell: four cards in a sorted run pay as two home (${part(run, "core")})`);
    ok(
      part(withHome52(13, 2), "core") === Math.floor((FC_CORE_MAX * 26) / 104) && part(withHome52(13, 3), "core") === Math.floor((FC_CORE_MAX * 26) / FC_CORE_UNITS_V3),
      "freecell: rev 2 keeps the core full at all 52 home and rev 3 at 54 units (140 each)",
    );
    // Par and speed only on a finished run; par full at par, 0 at 1.5 × par; speed full by the fitted time, 0 at the buzzer.
    const done = (moves: number, tick: number) => withHome(40, { ended: 1, moves, finishTick: tick, par: 20 });
    ok(part(done(20, 600), "par") === FC_PAR_MAX_V4 && part(done(25, 600), "par") === FC_PAR_MAX_V4 / 2 && part(done(30, 600), "par") === 0, "freecell: par full at par, half at 1.25 × par, 0 at 1.5 × par");
    ok(part(done(20, FC_SPEED_FULL_S_V4 * 60), "speed") === FC_SPEED_MAX_V4 && part(done(20, FC_RUN_TICKS), "speed") === 0, `freecell: speed full by ${FC_SPEED_FULL_S_V4} s, 0 at the buzzer`);
    ok(part(withHome(39, { moves: 20, par: 20, finishTick: 600 }), "par") === 0 && part(withHome(39), "speed") === 0, "freecell: no par or speed without a finish");
    // Rev 3 (stored rounds) keeps its parts: par 30 at par, 0 at twice par; speed 30 by 66 s.
    const done3 = { ...withHome52(52, 3), ended: 1, moves: 40, par: 40, finishTick: FC_SPEED_FULL_S * 60 };
    ok(part(done3, "par") === FC_PAR_MAX && part({ ...done3, moves: 80 }, "par") === 0 && part(done3, "speed") === FC_SPEED_MAX, "freecell: rev 3 keeps par 30 (0 at twice par) and speed 30 (full by 66 s)");
    // The 40-card deal: Ace to 10 in each suit, eight columns of five.
    const deal = freecellGame.init(0);
    const cards = deal.cols.flat().concat(deal.home.flatMap((top, suit) => Array.from({ length: top }, (_, r) => suit * 13 + r)));
    ok(new Set(cards).size === 40 && cards.every((c) => c % 13 < 10), "freecell rev 4: the deal holds the 40 cards Ace to 10 (any aces already home counted)");
  },
};
