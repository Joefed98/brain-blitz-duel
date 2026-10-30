/**
 * arcade-standard-check's entry for `racing` (Racing, racingRev 1, born on the standard; see ./entry.ts and
 * docs/arcade-standard/racing.md). Perfect runs are the oracle's (scripts/racing-oracle.ts) on proved deal seeds,
 * replayed through the server path: 24 of the 300 at quick depth (spread through the deal), all with CHECKS_FULL=1.
 * The core's straight line is checked in per mille of the race (the state at ⌈v × two laps ÷ 1000⌉).
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { racingGame, racingStdParts, RACING_INPUT_RANGES, RACING_INPUT_STICK, RACING_PAR_TICKS, RACING_RUN_TICKS, RACING_STD_SPEC, RACING_TOTAL, type RacingState } from "../../src/lib/arcade/racing";
import { replayRacingRun } from "../../src/lib/duel/racing";
import { RACING_DEAL } from "../../src/lib/duel/racingDeal.server";
import { oracleRun } from "../racing-oracle";
import { racingSubmission } from "../racing-deal";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const seeds = FULL ? [...RACING_DEAL] : RACING_DEAL.filter((_, i) => i % Math.ceil(RACING_DEAL.length / 24) === 0);

function replayed(seed: number, events: ArcadeInputEvent[], label: string): StdRun {
  const r = replayRacingRun(seed, racingSubmission(seed, events), 1);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<RacingState>): RacingState => ({ ...racingGame.init(RACING_DEAL[0]!), acted: 1, ...over });

export const entry: StdEntry = {
  type: "racing",
  field: "racingRev",
  rev: 1,
  parts: RACING_STD_SPEC.parts,
  spec: ARCADE_STANDARD.racing.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed), `the oracle on deal seed ${seed}`)),
  played: () => {
    const events: ArcadeInputEvent[] = [];
    // A touch of the brake at a standstill: an input, no distance.
    recordInput(events, { t: 5, k: RACING_INPUT_STICK, a: 0, b: -100, c: 0, d: 0 }, RACING_INPUT_RANGES);
    return [{ ...replayed(RACING_DEAL[0]!, events, "braking at the start line"), want: 1 }];
  },
  idle: () => [replayed(RACING_DEAL[1]!, [], "no input at all")],
  core: {
    fullAt: 1000,
    at: (v) => {
      const s = Math.min(RACING_TOTAL, Math.ceil((v * RACING_TOTAL) / 1000));
      return base({ s, finishTick: s >= RACING_TOTAL ? RACING_RUN_TICKS - 1 : 0 });
    },
    parts: racingStdParts,
    finishParts: ["finish", "speed"],
  },
  extra(ok) {
    const p = (s: RacingState, k: string) => racingStdParts(s)!.find((x) => x.key === k)!.points;
    for (let c = 0; c <= 8; c++) ok(p(base({ clean: c }), "sectors") === Math.floor((30 * c) / 8), `${c} clean sectors → ${Math.floor((30 * c) / 8)}`);
    ok(p(base({ s: RACING_TOTAL - 1 }), "finish") === 0 && p(base({ s: RACING_TOTAL, finishTick: 5000 }), "finish") === 10, "the finish pays 10 only on a finish");
    ok(p(base({ s: RACING_TOTAL, finishTick: RACING_PAR_TICKS }), "speed") === 20 && p(base({ s: RACING_TOTAL, finishTick: RACING_RUN_TICKS }), "speed") === 0, "speed: full at par, 0 at the buzzer");
    ok(p(base({ s: RACING_TOTAL - 5, finishTick: 0 }), "speed") === 0, "speed counts only on a completed run");
  },
};
