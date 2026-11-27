/**
 * arcade-standard-check's case for `rally` (see ./entry.ts): rallyRev 13 (the Retro overhaul, 15 Nov 2026), gold-ball
 * hits on a straight line (130), pink pads 3 each up to 10 (30), the six gold targets 5 each (30) and spin shots 2 each
 * up to 5 (10). The spin fix and rallyRev 12's replays are proved by scripts/rally-standard-check.ts, the lives by
 * scripts/retro-overhaul-check.ts. Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Retro overhaul):
 * the entry moved to the dealt stamp, rallyRev 13 (core 130 and the spin part).
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { caseEntry, type StdCase } from "./entry";
import { stdLine } from "../../src/lib/arcade/arcadeStandard"; // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
import {
  rallyGameFor,
  rallyStdParts,
  RALLY_REV_CURVE,
  RALLY_REV_LIVES,
  RALLY_REV_LADDER, // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
  RALLY_V14_LINES, // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
  RALLY_V12_TARGETS_MAX, // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
  RALLY_V13_CORE_MAX,
  RALLY_V13_SPIN_MAX,
  RALLY_V13_SPIN_PTS,
  RALLY_RUN_TICKS,
  RALLY_V10_BONUS_COUNT,
  RALLY_V12_FULL_AT,
  RALLY_V12_PAD_PTS,
  RALLY_V12_PADS_MAX,
  RALLY_V12_TARGET_PTS,
  type RallyState,
} from "../../src/lib/arcade/rally";

const game = rallyGameFor(RALLY_REV_LADDER); // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
const SEED = 4242;

/** A final state built by hand from rallyRev 12's init: acted, with the given counts. */
function made(gold: number, pads: number, targets: number, extra: Partial<RallyState> = {}, spins = 0): RallyState {
  const s = game.init(SEED);
  return { ...s, acted: 1, goldHits: gold, targetHits: pads, bonusHit: (1 << targets) - 1, spinScores: spins, tick: RALLY_RUN_TICKS, endedTick: RALLY_RUN_TICKS, ...extra } as RallyState;
}

const points = (s: RallyState, key: string) => rallyStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game,
  perfect: () => made(RALLY_V12_FULL_AT + 4, RALLY_V12_PADS_MAX / RALLY_V12_PAD_PTS, RALLY_V10_BONUS_COUNT, {}, RALLY_V13_SPIN_MAX / RALLY_V13_SPIN_PTS),
  idle: () => made(0, 0, 0, { dead: true, tick: 90, endedTick: 90 }),
  core: (v) => made(v, 0, 0),
  fullAt: RALLY_V14_LINES.fullAt, // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
  older: () => rallyGameFor(RALLY_REV_CURVE).init(SEED),
  // rallyRev 12 (the standard's first stamp) keeps its three parts: its own spec is proved by rally-standard-check.
  extra(ok) {
    // Pink pads: a straight line, full at 5 (more pads earn nothing more). Changed with Joe's approval, 26 Nov 2026 (rallyRev 14's lines).
    for (let n = 0; n <= 14; n++) ok(points(made(0, n, 0), "pads") === stdLine(RALLY_V12_PADS_MAX, n, RALLY_V14_LINES.padsFull), `rally: ${n} pads pay ${stdLine(RALLY_V12_PADS_MAX, n, 5)}`); // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
    // Gold targets: a straight line, full at 3 of the six. Changed with Joe's approval, 26 Nov 2026 (rallyRev 14's lines).
    for (let n = 0; n <= RALLY_V10_BONUS_COUNT; n++) ok(points(made(0, 0, n), "targets") === stdLine(RALLY_V12_TARGETS_MAX, n, RALLY_V14_LINES.targetsFull), `rally: ${n} gold targets pay ${stdLine(RALLY_V12_TARGETS_MAX, n, 3)}`); // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
    // Blue returns and lasting the minute pay nothing; a lost blue ball keeps what was earned.
    const base = made(10, 3, 2);
    ok(game.score({ ...base, hits: 60 }) === game.score({ ...base, hits: 0 }), "rally: blue returns score nothing on rallyRev 12");
    ok(game.score({ ...base, dead: true, tick: 1500, endedTick: 1500 }) === game.score(base), "rally: lasting the minute scores nothing; a lost blue ball keeps what was earned");
    ok(game.score(base) === 68 + 18 + 20 && Math.floor((RALLY_V13_CORE_MAX * 10) / RALLY_V14_LINES.fullAt) === 68, "rally: 10 gold hits, 3 pads and 2 targets add up (68 + 18 + 20 = 106)"); // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
    // Spin shots: a straight line, full at 3. Changed with Joe's approval, 26 Nov 2026 (rallyRev 14's lines).
    for (let n = 0; n <= 8; n++) ok(points(made(0, 0, 0, {}, n), "spin") === stdLine(RALLY_V13_SPIN_MAX, n, RALLY_V14_LINES.spinFull), `rally: ${n} spin shots pay ${stdLine(RALLY_V13_SPIN_MAX, n, 3)}`); // Changed with Joe's approval, 26 Nov 2026 (D5's rallyRev 14)
    // Features never cost core: the parts are independent counts.
    ok(points(made(12, 10, 6, {}, 5), "core") === points(made(12, 0, 0), "core"), "rally: pads, targets and spin shots never cost core points");
  },
};

export const entry = caseEntry("rally", ARCADE_STANDARD.rally.spec!, ARCADE_STANDARD.rally.parts, stdCase);
