/**
 * arcade-standard-check's entry for `freecell` (Free Cell freecellRev 2, Cards & Board; docs/arcade-standard/freecell.md):
 * born on the standard at rev 1; rev 2 (31 Oct 2026) adds Undo and Reset with the same parts. Perfect runs are the
 * bank's par lines through the server's rev-2 replay; the core's straight line is checked on cards home (two units
 * each, 52 home is the full 104).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { FC_PAR_MAX, FC_RUN_TICKS, FC_SPEED_FULL_S, FC_SPEED_MAX, freecellGameFor, freecellStdParts, fcInitFrom, type FcState } from "../../src/lib/arcade/cards/freecell";
import { replayFreecellRun } from "../../src/lib/duel/cards";
import { freecellFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.freecell!.spec!;
const freecellGame = freecellGameFor(2);
const rec = (s: FcState) => Object.fromEntries((freecellStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: FcState) => Object.fromEntries((freecellStdParts(s) ?? []).map((p) => [p.key, p.max]));

/** A state with `home` cards home (lowest ranks first, suit by suit) and no column left: no sorted runs. */
function withHome(home: number, over: Partial<FcState> = {}): FcState {
  const s = { ...fcInitFrom(7, 40), acted: 1, cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1] } as FcState;
  s.home = [0, 1, 2, 3].map((k) => Math.max(0, Math.min(13, home - 13 * k)));
  return { ...s, ...over };
}

export const entry: StdEntry = {
  type: "freecell",
  field: "freecellRev",
  rev: 2,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = freecellFlawless(seed, 20, 2);
      const r = replayFreecellRun(seed, raw, 2);
      return { label: `bank deal ${seed}'s par line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap that moved nothing", score: freecellGame.score({ ...freecellGame.init(3), acted: 1, cols: [[], [], [], [], [], [], [], []], home: [0, 0, 0, 0], cells: [-1, -1, -1, -1] }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: freecellGame.score(freecellGame.init(12)) }],
  help: { terms: ["par", "sorted runs"] },
  core: { fullAt: 52, at: (v) => withHome(v), parts: (s) => freecellStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: FcState, key: string) => freecellStdParts(s)!.find((p) => p.key === key)!.points;
    // Sorted runs pay half a card home: a column of K♠ Q♥ J♣ 10♥ is 4 units, two cards home.
    const run = withHome(0, { cols: [[12, 13 + 11, 39 + 10, 13 + 9], [], [], [], [], [], [], []] });
    ok(part(run, "core") === Math.floor((140 * 4) / 104), `freecell: four cards in a sorted run pay as two home (${part(run, "core")})`);
    // Par and speed only on a finished run; par full at par, 0 at twice par; speed full by the measured time, 0 at the buzzer.
    const done = (moves: number, tick: number) => withHome(52, { ended: 1, moves, finishTick: tick, par: 40 });
    ok(part(done(40, 600), "par") === FC_PAR_MAX && part(done(60, 600), "par") === FC_PAR_MAX / 2 && part(done(80, 600), "par") === 0, "freecell: par full at par, half at 1.5 × par, 0 at twice par");
    ok(part(done(40, FC_SPEED_FULL_S * 60), "speed") === FC_SPEED_MAX && part(done(40, FC_RUN_TICKS), "speed") === 0, `freecell: speed full by ${FC_SPEED_FULL_S} s, 0 at the buzzer`);
    ok(part(withHome(51, { moves: 40, par: 40, finishTick: 600 }), "par") === 0 && part(withHome(51), "speed") === 0, "freecell: no par or speed without a finish");
  },
};
