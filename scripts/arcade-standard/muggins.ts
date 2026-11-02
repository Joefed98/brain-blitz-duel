/**
 * arcade-standard-check's entry for `muggins` (Muggins mugginsRev 1, Cards & Board; docs/arcade-standard/muggins.md):
 * born on the standard. Perfect runs are each deal's witness through the server's replay; the core is Muggins points
 * on a straight line, full at MG_CORE_FULL (the near-perfect median).
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { MG_CORE_FULL, MG_RUN_TICKS, MG_SPEED_FULL_S, MG_SPEED_MAX, mugginsGame, mugginsStdParts, type MgState } from "../../src/lib/arcade/cards/muggins";
import { replayMugginsRun } from "../../src/lib/duel/cards";
import { mugginsFlawless } from "../cards/flawless";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.muggins!.spec!;
const rec = (s: MgState) => Object.fromEntries((mugginsStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: MgState) => Object.fromEntries((mugginsStdParts(s) ?? []).map((p) => [p.key, p.max]));
const at = (over: Partial<MgState>): MgState => ({ ...mugginsGame.init(5), acted: 1, ...over });

export const entry: StdEntry = {
  type: "muggins",
  field: "mugginsRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [0, 1, 2, 77, 10000, 123456789].map((seed) => {
      const { raw } = mugginsFlawless(seed);
      const r = replayMugginsRun(seed, raw);
      return { label: `seed ${seed}'s witness through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "a draw refused while a tile fits", score: mugginsGame.score(at({})), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: mugginsGame.score(mugginsGame.init(12)) }],
  help: { terms: ["15 or 20", "points"] },
  core: { fullAt: MG_CORE_FULL, at: (v) => at({ points: v }), parts: (s) => mugginsStdParts(s), finishParts: [] },
  extra(ok) {
    const part = (s: MgState, key: string) => mugginsStdParts(s)!.find((p) => p.key === key)!.points;
    for (const [n, want] of [[0, 0], [1, 5], [2, 10], [4, 10]] as const) ok(part(at({ bigs: n }), "big") === want, `muggins: ${n} big plays pay ${want}`);
    const done = (tick: number) => at({ ended: 1, finishTick: tick, hand: [] });
    ok(part(done(600), "clear") === 20 && part(at({}), "clear") === 0, "muggins: hand cleared 20 only with the hand empty");
    ok(part(done(MG_SPEED_FULL_S * 60), "speed") === MG_SPEED_MAX && part(done(MG_RUN_TICKS), "speed") === 0 && part(at({}), "speed") === 0, `muggins: speed full by ${MG_SPEED_FULL_S} s, 0 at the buzzer, none uncleared`);
  },
};
