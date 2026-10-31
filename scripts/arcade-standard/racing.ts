/**
 * arcade-standard-check's entry for `racing` (Apex, racingRev 2, the dealt revision since 31 Oct 2026; racingRev 1 was
 * born on the standard too, so there is no older revision without parts; see ./entry.ts and docs/arcade-standard/racing.md).
 * Perfect runs are the oracle's (scripts/racing-oracle.ts) on the rev-2 proved deal seeds, replayed through the server
 * path: 24 of the 300 at quick depth (spread through the deal), all with CHECKS_FULL=1. The core's straight line is
 * checked in per mille of the race (the state at ⌈v × two laps ÷ 1000⌉); speed on the race clock from lights out.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  racingGameFor,
  racingStdParts,
  RACING_INPUT_RANGES,
  RACING_INPUT_STICK,
  RACING_REV_2,
  RACING_RUN_TICKS,
  RACING_TOTAL,
  RACING_V2_GO,
  RACING_V2_PAR_TICKS,
  RACING_V2_STD_SPEC,
  type RacingState,
} from "../../src/lib/arcade/racing";
import { replayRacingRun } from "../../src/lib/duel/racing";
import { RACING_DEAL_V2 } from "../../src/lib/duel/racingDealV2.server";
import { oracleRun } from "../racing-oracle";
import { racingSubmission } from "../racing-deal";
import type { StdEntry, StdRun } from "./entry";

const REV = RACING_REV_2;
const FULL = process.env["CHECKS_FULL"] === "1";
const seeds = FULL ? [...RACING_DEAL_V2] : RACING_DEAL_V2.filter((_, i) => i % Math.ceil(RACING_DEAL_V2.length / 24) === 0);

function replayed(seed: number, events: ArcadeInputEvent[], label: string): StdRun {
  const r = replayRacingRun(seed, racingSubmission(seed, events, REV), REV);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<RacingState>): RacingState => ({ ...racingGameFor(REV).init(RACING_DEAL_V2[0]!), acted: 1, ...over });
/** A finish tick for a race time (ticks from lights out). */
const at = (race: number) => RACING_V2_GO + race;

export const entry: StdEntry = {
  type: "racing",
  field: "racingRev",
  rev: REV,
  parts: RACING_V2_STD_SPEC.parts,
  spec: ARCADE_STANDARD.racing.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed, REV), `the oracle on rev-2 deal seed ${seed}`)),
  played: () => {
    const events: ArcadeInputEvent[] = [];
    // A touch of the brake during the lights: an input, no distance.
    recordInput(events, { t: 5, k: RACING_INPUT_STICK, a: 0, b: -100, c: 0, d: 0 }, RACING_INPUT_RANGES);
    const after: ArcadeInputEvent[] = [];
    // A touch of the brake after lights out, at a standstill.
    recordInput(after, { t: RACING_V2_GO + 20, k: RACING_INPUT_STICK, a: 0, b: -100, c: 0, d: 0 }, RACING_INPUT_RANGES);
    return [
      { ...replayed(RACING_DEAL_V2[0]!, events, "braking on the grid during the lights"), want: 1 },
      { ...replayed(RACING_DEAL_V2[0]!, after, "braking at the start line after lights out"), want: 1 },
    ];
  },
  idle: () => [replayed(RACING_DEAL_V2[1]!, [], "no input at all")],
  core: {
    fullAt: 1000,
    at: (v) => {
      const s = Math.min(RACING_TOTAL, Math.ceil((v * RACING_TOTAL) / 1000));
      return base({ s, finishTick: s >= RACING_TOTAL ? at(RACING_RUN_TICKS - 1) : 0 });
    },
    parts: racingStdParts,
    finishParts: ["finish", "speed"],
  },
  extra(ok) {
    const p = (s: RacingState, k: string) => racingStdParts(s)!.find((x) => x.key === k)!.points;
    for (let c = 0; c <= 8; c++) ok(p(base({ clean: c }), "sectors") === Math.floor((30 * c) / 8), `${c} clean sectors → ${Math.floor((30 * c) / 8)}`);
    ok(p(base({ s: RACING_TOTAL - 1 }), "finish") === 0 && p(base({ s: RACING_TOTAL, finishTick: at(5000) }), "finish") === 10, "the finish pays 10 only on a finish");
    ok(p(base({ s: RACING_TOTAL, finishTick: at(RACING_V2_PAR_TICKS) }), "speed") === 20 && p(base({ s: RACING_TOTAL, finishTick: at(RACING_RUN_TICKS) }), "speed") === 0, "speed: full at par from lights out, 0 at the buzzer");
    ok(p(base({ s: RACING_TOTAL, finishTick: RACING_V2_PAR_TICKS + RACING_V2_GO + 300 }), "speed") < 20, "speed is measured from lights out (5 s over par on the race clock is not full)");
    ok(p(base({ s: RACING_TOTAL - 5, finishTick: 0 }), "speed") === 0, "speed counts only on a completed run");
  },
};
