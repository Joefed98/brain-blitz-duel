/**
 * D6's Normal scoring stamps (the polish plan's difficulty session D6, 22 Nov 2026; plan section 8.2, Joe's approval of
 * 20 Nov 2026), each under its own new stamp, dealt by its game's generator (arcade.server.ts, sports.server.ts):
 *
 *   - Five Hands `fiveHandsRev 4` (I2; cards/fiveHands.ts FH_REV_128): rev 3's game, 200 at 128 hand points.
 *   - Cue Ball `poolRev 5` (I7; pool.ts POOL_REV_FIFTH): Speed from the fifth of your seven, full by 60 s.
 *   - Tilt `tiltRev 13` (I8; tilt.ts TILT_REV_THREE): Normal plays tiltRev 12's first three mazes, speed full by 55 s.
 *
 * Every older stamp deals, grades and reads exactly as before (scripts/fixtures/d6-levels-legacy.json.gz, recorded on
 * main 7e25a4d0 before any D6 change; d6-legacy-check). Checks written for the stamps before pin new deals to them, and
 * the help text with them (the era pins rebuild the texts). Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";

/** Checks written for Five Hands fiveHandsRev 3 deal it (and its help text); returns the previous setting. */
export function pinPreFiveHands128(on: boolean): boolean {
  return setDealPin("fivehandsPre128", on);
}
/** Checks written for Cue Ball poolRev 4 deal it; returns the previous setting. */
export function pinPrePoolFifth(on: boolean): boolean {
  return setDealPin("poolPreFifth", on);
}
/** Checks written for Tilt tiltRev 12 deal it (and its help text); returns the previous setting. */
export function pinPreTiltThree(on: boolean): boolean {
  return setDealPin("tiltPreThree", on);
}

/** True unless a check pinned the stamp before D6's (the help then reads the stamp it deals). */
export const fiveHands128Dealt = (): boolean => !dealPinned("fivehandsPre128");
export const tiltThreeDealt = (): boolean => !dealPinned("tiltPreThree");
