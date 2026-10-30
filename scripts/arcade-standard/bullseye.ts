/**
 * arcade-standard-check's case for `bullseye` (see ./entry.ts): Flightpath bullRev 9 (docs/arcade-standard/bullseye.md).
 * Dart total (core, full at 112) up to 150, bull streaks up to 30 (bullRev 8's streak points), dead-centre darts up to 20
 * shared between the darts that have a dead-centre ring. The perfect state is a real run (scripts/bullseye-best-run.ts);
 * the others are built by hand from bullRev 9's init. scripts/bullseye-standard-check.ts proves real play on every seed.
 */
import { bullseyeDeadDarts, bullseyeGameFor, bullseyeStdParts, BULLSEYE_REV_EXPAND, BULLSEYE_REV_STD, BULLSEYE_V9_FULL_AT, type BullseyeState } from "../../src/lib/arcade/bullseye";
import { bullseyeBestRun } from "../bullseye-best-run";
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { caseEntry, type StdCase } from "./entry";

const game = bullseyeGameFor(BULLSEYE_REV_STD);
const SEED = 4242;
const played = (fields: Partial<BullseyeState>): BullseyeState => ({ ...game.init(SEED), acted: 1, arrowIndex: 10, ...fields });
const part = (s: BullseyeState, key: string) => bullseyeStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game,
  perfect: () => bullseyeBestRun(game, SEED).state,
  idle: () => played({ total: 0, arrowIndex: 3 }),
  core: (v) => played({ total: v }),
  fullAt: BULLSEYE_V9_FULL_AT,
  older: () => bullseyeGameFor(BULLSEYE_REV_EXPAND).init(SEED),
  extra(ok) {
    // Dead-centre: 20 shared between the dead-centre darts, floor(20 × hit ÷ darts); all of them gives 20.
    const n = bullseyeDeadDarts(game.init(SEED));
    ok(n >= 6 && n <= 10, `bullseye: ${n} dead-centre darts on seed ${SEED}`);
    for (let dead = 0; dead <= n; dead++) {
      const want = Math.floor((20 * dead) / n);
      ok(part(played({ dead }), "dead") === want, `bullseye: ${dead} of ${n} dead-centre darts pay ${part(played({ dead }), "dead")}, not ${want}`);
    }
    ok(part(played({ dead: n }), "dead") === 20, "bullseye: every dead centre fills the 20");
    // Bull streaks: bullRev 8's streak points exactly ("as today"), up to 30.
    for (const [pts, want] of [[2, 2], [6, 6], [12, 12], [20, 20], [30, 30], [42, 30], [72, 30]] as const)
      ok(part(played({ streakPts: pts }), "streak") === want, `bullseye: ${pts} streak points pay ${part(played({ streakPts: pts }), "streak")}, not ${want}`);
    // The parts add up: core + streak + dead, no curve.
    const s = played({ total: 56, streakPts: 12, dead: 0 });
    ok(game.score(s) === 75 + 12, `bullseye: total 56 and streak 12 score ${game.score(s)}, not 87`);
    ok(part(played({ total: 140 }), "core") === 150, "bullseye: the core holds at 150 past its full-at figure");
    // bullRev 8 states with the same fields still score on bullRev 8's rules (unchanged).
    const old = { ...bullseyeGameFor(BULLSEYE_REV_EXPAND).init(SEED), acted: 1, arrowIndex: 10, total: 56, streakPts: 12, dead: 0 };
    ok(bullseyeStdParts(old) === null && bullseyeGameFor(BULLSEYE_REV_EXPAND).score(old) !== game.score(s), "bullseye: a bullRev 8 state keeps bullRev 8's score");
  },
};

export const entry = caseEntry("bullseye", ARCADE_STANDARD.bullseye.spec!, ARCADE_STANDARD.bullseye.parts, stdCase);
