/**
 * arcade-standard-check's entry for `minigolf` (see ./entry.ts): Minigolf golfRev 1 (the Sports group, 30 Oct 2026;
 * docs/arcade-standard/minigolf.md). Holes up to 120 (24 a hole holed, an unfinished hole up to 20 by closeness), Par
 * up to 40 (8 a hole), Under par up to 20 (4 a hole), Speed up to 20 (all five holed). Perfect runs are the bank's
 * witnesses through the server's replay; the core line counts holes holed at the stroke limit (no par points).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import {
  mgClosePoints,
  minigolfGameFor,
  minigolfStdParts,
  MG_CLOSE_PTS,
  MG_PAR_PTS,
  MG_UNDER_PTS,
  MINIGOLF_HOLES,
  MINIGOLF_FULL_BY_S,
  MINIGOLF_REV,
  MINIGOLF_STD_SPEC,
  MINIGOLF_STROKE_LIMIT,
  type MinigolfState,
} from "../../src/lib/arcade/minigolf";
import { replayMinigolfRun } from "../../src/lib/duel/minigolf";
import { MINIGOLF_BANK } from "../../src/lib/duel/minigolfBank.server";
import type { StdEntry } from "./entry";

const witness = JSON.parse(readFileSync(new URL("../fixtures/minigolf-witness.json", import.meta.url), "utf8")) as Record<string, string>;
const entry0 = MINIGOLF_BANK[0]!;
const game = minigolfGameFor(entry0.pars);

/** A final state built from init: `holed` holes holed (first ones) in `strokes` each, the rest as given. */
function final(holed: number, strokes: number, over: Partial<MinigolfState> = {}): MinigolfState {
  const s = game.init(entry0.seed);
  const n = Math.min(holed, MINIGOLF_HOLES);
  return {
    ...s,
    acted: 1,
    over: 1,
    hole: MINIGOLF_HOLES - 1,
    holed: Array.from({ length: MINIGOLF_HOLES }, (_, i) => (i < n ? 1 : 0)),
    taken: Array.from({ length: MINIGOLF_HOLES }, (_, i) => (i < n ? strokes : MINIGOLF_STROKE_LIMIT)),
    close: Array.from({ length: MINIGOLF_HOLES }, () => 0),
    finishTick: 0,
    ...over,
  };
}
const part = (s: MinigolfState, key: string) => minigolfStdParts(s)!.find((p) => p.key === key)!.points;
const record = (s: MinigolfState) => Object.fromEntries(minigolfStdParts(s)!.map((p) => [p.key, p.points]));

export const entry: StdEntry = {
  type: "minigolf",
  field: "golfRev",
  rev: MINIGOLF_REV,
  parts: MINIGOLF_STD_SPEC.parts,
  spec: MINIGOLF_STD_SPEC,
  liveSpec: true,
  perfect: () =>
    MINIGOLF_BANK.map((e) => {
      const run = replayMinigolfRun(e.seed, witness[String(e.seed)] ?? "", e.pars);
      return { label: `bank course ${e.seed}'s witness (server replay)`, score: run.flagged ? -1 : run.score, parts: record(run.state) };
    }),
  played: () => [
    { label: "one putt into a rail and then nothing", score: (() => {
      const g = minigolfGameFor(entry0.pars);
      let s = g.init(entry0.seed);
      s = g.step(s, { t: 1, k: 1, a: 4000, b: 0, c: 1 });
      while (!g.isOver(s)) s = g.step(s, null);
      return g.score(s);
    })() },
    { label: "a built state that played and earned nothing", score: game.score(final(0, 6)), want: 1 },
  ],
  idle: () => [{ label: "an untouched run to the buzzer", score: (() => {
    const g = minigolfGameFor(entry0.pars);
    let s = g.init(entry0.seed);
    while (!g.isOver(s)) s = g.step(s, null);
    return g.score(s);
  })() }],
  core: { fullAt: MINIGOLF_HOLES, at: (v: number) => final(v, MINIGOLF_STROKE_LIMIT), parts: (s: any) => minigolfStdParts(s) },
  older: () => minigolfStdParts({ ...game.init(entry0.seed), rev: 0 }) === null,
  extra(ok) {
    // Par: 8 at par or better, falling evenly to 0 at the stroke limit; under par 4 a hole.
    for (let strokes = 1; strokes <= MINIGOLF_STROKE_LIMIT; strokes++) {
      const s = final(5, strokes, { pars: [3, 3, 3, 3, 3] });
      const each = strokes <= 3 ? MG_PAR_PTS : Math.floor((MG_PAR_PTS * (MINIGOLF_STROKE_LIMIT - strokes)) / (MINIGOLF_STROKE_LIMIT - 3));
      ok(part(s, "par") === 5 * each, `minigolf: five holes in ${strokes} on par 3 → par ${5 * each} (got ${part(s, "par")})`);
      ok(part(s, "under") === (strokes < 3 ? 5 * MG_UNDER_PTS : 0), `minigolf: under par only below par (${strokes} strokes)`);
    }
    // Speed only with all five holed, full by the full-by time, 0 at the buzzer.
    ok(part(final(5, 3, { finishTick: 60 * MINIGOLF_FULL_BY_S }), "speed") === 20, `minigolf: all five holed by ${MINIGOLF_FULL_BY_S} s → speed 20`);
    ok(part(final(5, 3, { finishTick: 7200 }), "speed") === 0, "minigolf: all five holed at the buzzer → speed 0");
    ok(part(final(4, 3, { finishTick: 60 * 40 }), "speed") === 0, "minigolf: speed needs all five holed");
    // An unfinished hole: up to 20 by closeness, never more than a hole holed.
    const c = game.init(entry0.seed).course[0]!;
    ok(mgClosePoints(c, c.cup.x, c.cup.y) === MG_CLOSE_PTS, "minigolf: closeness 20 at the cup");
    ok(mgClosePoints(c, c.tee.x, c.tee.y) === 0, "minigolf: closeness 0 at the tee's distance");
    ok(part(final(0, 6, { close: [20, 20, 20, 20, 20] }), "core") === 100, "minigolf: five unfinished holes at the cup's edge → core 100");
    // Every bank course's pars are its witness's strokes + 1 (a birdie is always possible) and under the stroke limit.
    let birdies = 0;
    for (const e of MINIGOLF_BANK) {
      const run = replayMinigolfRun(e.seed, witness[String(e.seed)] ?? "", e.pars);
      if (run.state.taken.every((t, i) => t === e.pars[i]! - 1) && e.pars.every((p) => p < MINIGOLF_STROKE_LIMIT)) birdies++;
    }
    ok(birdies === MINIGOLF_BANK.length, `minigolf: every bank course's witness birdies every hole (${birdies} of ${MINIGOLF_BANK.length})`);
  },
};
