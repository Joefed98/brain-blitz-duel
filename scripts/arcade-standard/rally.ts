/**
 * arcade-standard-check's case for `rally` (see ./case.ts): rallyRev 12, gold-ball hits on a straight line (140),
 * pink pads 3 each up to 10 (30) and the six gold targets 5 each (30). The spin fix and the replays are proved by
 * scripts/rally-standard-check.ts.
 */
import type { StdCase } from "./case";
import {
  rallyGameFor,
  rallyStdParts,
  RALLY_REV_CURVE,
  RALLY_REV_STD,
  RALLY_RUN_TICKS,
  RALLY_V10_BONUS_COUNT,
  RALLY_V12_FULL_AT,
  RALLY_V12_PAD_PTS,
  RALLY_V12_PADS_MAX,
  RALLY_V12_TARGET_PTS,
  type RallyState,
} from "../../src/lib/arcade/rally";

const game = rallyGameFor(RALLY_REV_STD);
const SEED = 4242;

/** A final state built by hand from rallyRev 12's init: acted, with the given counts. */
function made(gold: number, pads: number, targets: number, extra: Partial<RallyState> = {}): RallyState {
  const s = game.init(SEED);
  return { ...s, acted: 1, goldHits: gold, targetHits: pads, bonusHit: (1 << targets) - 1, tick: RALLY_RUN_TICKS, endedTick: RALLY_RUN_TICKS, ...extra } as RallyState;
}

const points = (s: RallyState, key: string) => rallyStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game,
  perfect: () => made(RALLY_V12_FULL_AT + 4, RALLY_V12_PADS_MAX / RALLY_V12_PAD_PTS, RALLY_V10_BONUS_COUNT),
  idle: () => made(0, 0, 0, { dead: true, tick: 90, endedTick: 90 }),
  core: (v) => made(v, 0, 0),
  fullAt: RALLY_V12_FULL_AT,
  older: () => rallyGameFor(RALLY_REV_CURVE).init(SEED),
  extra(ok) {
    // Pink pads: 3 each, full at 10 (more pads earn nothing more).
    for (let n = 0; n <= 14; n++) ok(points(made(0, n, 0), "pads") === Math.min(RALLY_V12_PADS_MAX, RALLY_V12_PAD_PTS * n), `rally: ${n} pads pay ${Math.min(30, 3 * n)}`);
    // Gold targets: 5 for each of the six.
    for (let n = 0; n <= RALLY_V10_BONUS_COUNT; n++) ok(points(made(0, 0, n), "targets") === RALLY_V12_TARGET_PTS * n, `rally: ${n} gold targets pay ${5 * n}`);
    // Blue returns and lasting the minute pay nothing; a lost blue ball keeps what was earned.
    const base = made(10, 3, 2);
    ok(game.score({ ...base, hits: 60 }) === game.score({ ...base, hits: 0 }), "rally: blue returns score nothing on rallyRev 12");
    ok(game.score({ ...base, dead: true, tick: 1500, endedTick: 1500 }) === game.score(base), "rally: lasting the minute scores nothing; a lost blue ball keeps what was earned");
    ok(game.score(base) === Math.floor((140 * 10) / RALLY_V12_FULL_AT) + 9 + 10, "rally: 10 gold hits, 3 pads and 2 targets add up");
    // Features never cost core: the parts are independent counts.
    ok(points(made(12, 10, 6), "core") === points(made(12, 0, 0), "core"), "rally: pads and targets never cost core points");
  },
};
