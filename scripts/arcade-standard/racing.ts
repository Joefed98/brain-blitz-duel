/**
 * arcade-standard-check's entry for `racing` (Apex, racingRev 3, the dealt revision since 3 Nov 2026: pace and clean
 * sectors; racingRev 1 and 2 were born on the standard too, so there is no older revision without parts; see ./entry.ts
 * and docs/arcade-standard/racing.md). Perfect runs are the oracle's (scripts/racing-oracle.ts) on the rev-3 proved deal
 * seeds, replayed through the server path: 24 of the 300 at quick depth (spread through the deal), all with
 * CHECKS_FULL=1. The core's straight line is checked in tenths of a km/h of average speed above the zero (the state
 * whose pace is exactly the zero + v: a part race to the buzzer, or a finish).
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  racingGameFor,
  racingPace10,
  racingStdParts,
  RACING_INPUT_RANGES,
  RACING_INPUT_STICK,
  RACING_REV_3,
  RACING_RUN_TICKS,
  RACING_TOTAL,
  RACING_V2_GO,
  RACING_V3_PACE_FULL,
  RACING_V3_PACE_OF,
  RACING_V3_PACE_ZERO,
  RACING_V3_STD_SPEC,
  type RacingState,
} from "../../src/lib/arcade/racing";
import { replayRacingRun } from "../../src/lib/duel/racing";
import { RACING_DEAL_V3 } from "../../src/lib/duel/racingDealV3.server";
import { oracleRun } from "../racing-oracle";
import { racingSubmission } from "../racing-deal";
import type { StdEntry, StdRun } from "./entry";

const REV = RACING_REV_3;
const FULL = process.env["CHECKS_FULL"] === "1";
const seeds = FULL
  ? [...RACING_DEAL_V3]
  : RACING_DEAL_V3.filter((_, i) => i % Math.ceil(RACING_DEAL_V3.length / 24) === 0);

function replayed(seed: number, events: ArcadeInputEvent[], label: string): StdRun {
  const r = replayRacingRun(seed, racingSubmission(seed, events, REV), REV);
  return {
    label,
    score: r.score,
    parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])),
    partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])),
  };
}

const base = (over: Partial<RacingState>): RacingState => ({
  ...racingGameFor(REV).init(RACING_DEAL_V3[0]!),
  acted: 1,
  ...over,
});
/** The race over at the buzzer (no finish). */
const END = RACING_V2_GO + RACING_RUN_TICKS;

/** A state whose pace is exactly `pace` (tenths of a km/h): a part race to the buzzer, or a finish in the right time. */
export function racingStateAtPace(pace: number): RacingState {
  // A part race over the whole 90 s: the shortest distance at that pace.
  const s = Math.ceil((pace * RACING_RUN_TICKS * 3072) / 3000);
  if (s < RACING_TOTAL) return base({ tick: END, s });
  // Faster than two laps in 90 s: a finish, its race time the longest one at that pace.
  for (let t = RACING_RUN_TICKS; t > 0; t--) {
    const st = base({ tick: RACING_V2_GO + t, s: RACING_TOTAL, finishTick: RACING_V2_GO + t });
    const p = racingPace10(st);
    if (p === pace) return st;
    if (p > pace) break;
  }
  throw new Error(`no state at pace ${pace}`);
}

export const entry: StdEntry = {
  type: "racing",
  field: "racingRev",
  rev: REV,
  parts: RACING_V3_STD_SPEC.parts,
  spec: ARCADE_STANDARD.racing.spec!,
  liveSpec: true,
  perfect: () =>
    seeds.map((seed) =>
      replayed(seed, oracleRun(seed, REV), `the oracle on rev-3 deal seed ${seed}`),
    ),
  played: () => {
    const events: ArcadeInputEvent[] = [];
    // A touch of the brake during the lights: an input, no distance.
    recordInput(
      events,
      { t: 5, k: RACING_INPUT_STICK, a: 0, b: -100, c: 0, d: 0 },
      RACING_INPUT_RANGES,
    );
    const after: ArcadeInputEvent[] = [];
    // A touch of the brake after lights out, at a standstill.
    recordInput(
      after,
      { t: RACING_V2_GO + 20, k: RACING_INPUT_STICK, a: 0, b: -100, c: 0, d: 0 },
      RACING_INPUT_RANGES,
    );
    return [
      { ...replayed(RACING_DEAL_V3[0]!, events, "braking on the grid during the lights"), want: 1 },
      {
        ...replayed(RACING_DEAL_V3[0]!, after, "braking at the start line after lights out"),
        want: 1,
      },
    ];
  },
  idle: () => [replayed(RACING_DEAL_V3[1]!, [], "no input at all")],
  core: {
    fullAt: RACING_V3_PACE_OF,
    at: (v) => racingStateAtPace(RACING_V3_PACE_ZERO + v),
    parts: racingStdParts,
  },
  extra(ok) {
    const p = (s: RacingState, k: string) => racingStdParts(s)!.find((x) => x.key === k)!.points;
    for (let c = 0; c <= 8; c++)
      ok(p(base({ clean: c }), "sectors") === 5 * c, `${c} clean sectors → ${5 * c}`);
    ok(
      RACING_V3_STD_SPEC.parts.map((x) => x.key).join(",") === "core,sectors",
      "racingRev 3's parts are pace and clean sectors (no finish or speed part)",
    );
    ok(
      p(racingStateAtPace(RACING_V3_PACE_ZERO - 50), "core") === 0,
      "a pace under the zero earns no pace points",
    );
    ok(
      p(racingStateAtPace(RACING_V3_PACE_FULL), "core") === 160 &&
        p(racingStateAtPace(RACING_V3_PACE_FULL + 40), "core") === 160,
      "the pace is full at the full figure and held there",
    );
    const fin = base({
      tick: RACING_V2_GO + 4700,
      s: RACING_TOTAL,
      finishTick: RACING_V2_GO + 4700,
    });
    ok(
      racingPace10(fin) === Math.floor((RACING_TOTAL * 3000) / (4700 * 3072)),
      "a finish's pace is two laps over its race time from lights out",
    );
    const part = base({ tick: END, s: RACING_TOTAL >> 1 });
    ok(
      racingPace10(part) === Math.floor(((RACING_TOTAL >> 1) * 3000) / (RACING_RUN_TICKS * 3072)),
      "an unfinished race's pace is its distance over the whole 90 s",
    );
  },
};
