/**
 * arcade-standard-check's case for `bullseye` (see ./case.ts): Flightpath bullRev 9 (docs/arcade-standard/bullseye.md).
 * Dart total (core, full at 130) up to 150, bull streaks up to 30 (bullRev 8's streak points), dead-centre darts 2 each
 * up to 20. States are built by hand from bullRev 9's init; scripts/bullseye-standard-check.ts proves real play.
 */
import { bullseyeGameFor, bullseyeStdParts, BULLSEYE_REV_EXPAND, BULLSEYE_REV_STD, BULLSEYE_V9_FULL_AT, type BullseyeState } from "../../src/lib/arcade/bullseye";
import type { StdCase } from "./case";

const game = bullseyeGameFor(BULLSEYE_REV_STD);
const SEED = 4242;
const played = (fields: Partial<BullseyeState>): BullseyeState => ({ ...game.init(SEED), acted: 1, arrowIndex: 10, ...fields });
const part = (s: BullseyeState, key: string) => bullseyeStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game,
  perfect: () => played({ total: BULLSEYE_V9_FULL_AT, streakPts: 72, streak: 10, dead: 10 }),
  idle: () => played({ total: 0, arrowIndex: 3 }),
  core: (v) => played({ total: v }),
  fullAt: BULLSEYE_V9_FULL_AT,
  older: () => bullseyeGameFor(BULLSEYE_REV_EXPAND).init(SEED),
  extra(ok) {
    // Dead-centre: 2 a dart, up to 20.
    for (const [dead, want] of [[1, 2], [3, 6], [6, 12], [9, 18], [10, 20], [14, 20]] as const)
      ok(part(played({ dead }), "dead") === want, `bullseye: ${dead} dead-centre darts pay ${part(played({ dead }), "dead")}, not ${want}`);
    // Bull streaks: bullRev 8's streak points exactly ("as today"), up to 30.
    for (const [pts, want] of [[2, 2], [6, 6], [12, 12], [20, 20], [30, 30], [42, 30], [72, 30]] as const)
      ok(part(played({ streakPts: pts }), "streak") === want, `bullseye: ${pts} streak points pay ${part(played({ streakPts: pts }), "streak")}, not ${want}`);
    // The parts add up: core + streak + dead, no curve.
    const s = played({ total: 65, streakPts: 12, dead: 2 });
    ok(game.score(s) === 75 + 12 + 4, `bullseye: total 65, streak 12, dead 2 scores ${game.score(s)}, not 91`);
    // A total beyond the full-at figure stays at 150.
    ok(part(played({ total: 140 }), "core") === 150, "bullseye: the core holds at 150 past its full-at figure");
    // bullRev 8 states with the same fields still score on bullRev 8's curve (unchanged).
    const old = { ...bullseyeGameFor(BULLSEYE_REV_EXPAND).init(SEED), acted: 1, arrowIndex: 10, total: 65, streakPts: 12, dead: 2 };
    ok(bullseyeStdParts(old) === null && bullseyeGameFor(BULLSEYE_REV_EXPAND).score(old) !== game.score(s), "bullseye: a bullRev 8 state keeps bullRev 8's score");
  },
};
