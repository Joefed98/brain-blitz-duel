/**
 * arcade-standard-check's entry for `homerun` (Home Run, homerunRev 5 since 15 Nov 2026, the innings; rev 4 dealt 3 Nov
 * 2026, rev 1 the stamp it was born on; see ./entry.ts and docs/arcade-standard/homerun.md). Perfect runs are the
 * flawless batter's (scripts/homerun-oracle.ts oracleRunV5: Power, every pitch in the zone met on its arrival tick and
 * hit straightaway over the fence, every ball left alone) on rev 5's proved Normal deal, replayed through the server
 * path; at quick depth 24 of the 120 (spread through the deal), at full depth all of them and every level's.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { homerunGameFor, homerunStdParts, HOMERUN_INPUT_RANGES_V5, HOMERUN_REV_5, HOMERUN_STD_SPEC_V5, type HomerunState } from "../../src/lib/arcade/homerun";
import { hr5InitInn, HR_LEVELS, HR5_INPUT_MODE, HR5_INPUT_SWING, HR5_RUNS_FULL, type Hr5Hit } from "../../src/lib/arcade/homerunInnings";
import { HOMERUN_DEAL_V5 } from "../../src/lib/duel/homerunDealV5.server";
import { oracleRunV5, playLogV5 } from "../homerun-oracle";
import { storedScoreV5 } from "../homerun-innings-deal";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const REV = HOMERUN_REV_5;
const game = homerunGameFor(REV);
const normal = HOMERUN_DEAL_V5.normal;
const seeds = FULL ? [...normal] : normal.filter((_, i) => i % Math.ceil(normal.length / 24) === 0);

function replayed(seed: number, events: ArcadeInputEvent[], label: string, level: (typeof HR_LEVELS)[number] = "normal"): StdRun {
  // The stored score through the server's replay (with the phone's checkpoints); the parts from the same play.
  const score = storedScoreV5(seed, events, level);
  const parts = homerunStdParts(playLogV5(seed, events, level)) ?? [];
  return { label, score, parts: Object.fromEntries(parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(parts.map((p) => [p.key, p.max])) };
}

/** A built innings state (acted) with the given totals. */
const base = (over: Partial<ReturnType<typeof hr5InitInn>>): HomerunState => {
  const s = game.init(4242);
  return { ...s, acted: 1, inn: { ...s.inn!, ...over } };
};
const homer = (n: number): Hr5Hit[] => Array.from({ length: n }, (_, i) => ({ i, out: 9, st: 1, aim: 0, m: 1, dt: 0, q: 1000, feet: 450, spray: 0, at: 1, rel: 1, c: -1, runs: 1, bases: 0, perfect: true }));

export const entry: StdEntry = {
  type: "homerun",
  field: "homerunRev",
  rev: REV,
  before: 4,
  parts: HOMERUN_STD_SPEC_V5.parts,
  spec: ARCADE_STANDARD.homerun.spec!,
  liveSpec: true,
  perfect: () => [
    ...seeds.map((seed) => replayed(seed, oracleRunV5(seed, "normal"), `the flawless batter on rev-5 Normal deal seed ${seed}`)),
    ...(FULL ? HR_LEVELS.filter((l) => l !== "normal").flatMap((l) => HOMERUN_DEAL_V5[l].map((seed) => replayed(seed, oracleRunV5(seed, l), `the flawless batter on rev-5 ${l} seed ${seed}`, l))) : []),
  ],
  played: () => {
    const seed = normal[0]!;
    const moded: ArcadeInputEvent[] = [];
    // Only the swing choice touched, never a swing (every pitch taken).
    recordInput(moded, { t: 5, k: HR5_INPUT_MODE, a: 1, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V5);
    const early: ArcadeInputEvent[] = [];
    // One swipe long before the first pitch (no swing), the rest taken.
    recordInput(early, { t: 5, k: HR5_INPUT_SWING, a: 0, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V5);
    return [replayed(seed, moded, "only the swing choice touched"), replayed(seed, early, "one swipe before the first pitch")];
  },
  idle: () => [replayed(normal[1]!, [], "no input at all")],
  core: { fullAt: HR5_RUNS_FULL, at: (v) => base({ runs: v }), parts: homerunStdParts },
  extra(ok) {
    const p = (s: HomerunState, k: string) => homerunStdParts(s)!.find((x) => x.key === k)!.points;
    for (let h = 0; h <= 12; h++) ok(p(base({ hits: homer(h) }), "homers") === Math.min(40, 4 * h), `${h} home runs → ${Math.min(40, 4 * h)}`);
    for (let n = 0; n <= 12; n++) ok(p(base({ best: n }), "streak") === Math.min(40, 4 * n), `a best perfect run of ${n} → ${Math.min(40, 4 * n)}`);
    for (let n = 0; n <= 7; n++) ok(p(base({ eye: n }), "eye") === Math.min(20, 4 * n), `${n} balls left alone → ${Math.min(20, 4 * n)}`);
    ok(p(base({ eye: 6, chased: 3 }), "eye") === 12, "6 balls left alone less 3 chased → 12");
    ok(p(base({ eye: 1, chased: 4 }), "eye") === 0, "more chased than left alone → 0, never below");
    ok(game.score(base({ runs: HR5_RUNS_FULL, hits: homer(10), best: 10, eye: 5 })) === 200, `${HR5_RUNS_FULL} runs, 10 home runs, 10 perfect in a row and 5 balls left alone → 200`);
    ok(game.score(base({ runs: HR5_RUNS_FULL - 1, hits: homer(10), best: 10, eye: 5 })) < 200, "a run short of the full core is short of 200");
    ok(base({}).rev === REV, "the dealt game's state carries homerunRev 5");
  },
};
