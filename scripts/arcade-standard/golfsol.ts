/**
 * arcade-standard-check's entry for `golfsol` (Golf Solitaire golfSolRev 1, Cards & Board; docs/arcade-standard/golfsol.md):
 * born on the standard. Perfect runs are the bank's clearing lines (five runs of five) through the server's replay.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { GS_CARDS, GS_RUN_TICKS, GS_SPEED_FULL_S, GS_SPEED_MAX, golfSolGame, golfSolStdParts, type GsState } from "../../src/lib/arcade/cards/golfSol";
import { replayGolfSolRun } from "../../src/lib/duel/cards";
import { golfSolFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.golfsol!.spec!;
const rec = (s: GsState) => Object.fromEntries((golfSolStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: GsState) => Object.fromEntries((golfSolStdParts(s) ?? []).map((p) => [p.key, p.max]));
const at = (over: Partial<GsState>): GsState => ({ ...golfSolGame.init(5), acted: 1, ...over });
const cleared = (v: number): GsState => at({ cleared: v });

export const entry: StdEntry = {
  type: "golfsol",
  field: "golfSolRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 150, 299].map((seed) => {
      const { raw } = golfSolFlawless(seed);
      const r = replayGolfSolRun(seed, raw);
      return { label: `bank deal ${seed}'s clearing line through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a tap on a card that doesn't play", score: golfSolGame.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: golfSolGame.score(golfSolGame.init(12)) }],
  help: { terms: ["35", "run"] },
  core: { fullAt: GS_CARDS, at: (v) => cleared(v), parts: (s) => golfSolStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: GsState, key: string) => golfSolStdParts(s)!.find((p) => p.key === key)!.points;
    for (const [n, want] of [[0, 0], [1, 4], [3, 12], [5, 20], [7, 20]] as const) ok(part(at({ runs: n }), "runs") === want, `golfsol: ${n} runs of five pay ${want}`);
    const done = (tick: number) => at({ ended: 1, finishTick: tick, cleared: GS_CARDS });
    ok(part(done(600), "clear") === 20 && part(cleared(34), "clear") === 0, "golfsol: all cleared 20 only with all 35 cleared");
    ok(part(done(GS_SPEED_FULL_S * 60), "speed") === GS_SPEED_MAX && part(done(GS_RUN_TICKS), "speed") === 0 && part(cleared(34), "speed") === 0, `golfsol: speed full by ${GS_SPEED_FULL_S} s, 0 at the buzzer, none uncleared`);
  },
};
