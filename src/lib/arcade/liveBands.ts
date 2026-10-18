/**
 * The band curve each arcade game's new rounds score on: the revision stamp the
 * room generators deal (the same constants `arcade.server.ts`, `hover.server.ts`
 * and `ballTrack.server.ts` stamp) and that revision's curve. The "?" help reads
 * its numbers from here, so it follows the stamp rooms deal.
 *
 * Display only: scoring still picks its curve from the stored round's own state.
 * arcade-help-bands-check fails if a generator deals another revision than the one
 * listed here, or if a sim exports a newer band curve than the one listed.
 */
import { bandHelp, type BandCurve, type BandHelpWords } from "./scoreBands";
import { BT_REV_TARGET, BT_V5_BAND_CURVE } from "./ballTrack";
import { WAV_REV_TARGET, WAV_V7_BAND_CURVE } from "./wavefront";
import { FLIP_REV_TARGET, FLIP_V5_BAND_CURVE } from "./flip";
import { INK_REV_TARGET, INK_V7_BAND_CURVE } from "./inkBridge";
import { MATCHUP_REV_TARGET, MATCHUP_V7_BAND_CURVE } from "./matchup";
import { BUB_REV_TARGET, BUB_V6_BAND_CURVE } from "./bubble";
import { CROSS_REV_TARGET, CROSS_V6_BAND_CURVE } from "./cross";
import { RALLY_REV_TARGET, RALLY_V7_BAND_CURVE } from "./rally";
import { SNAKE_REV_TARGET, SNAKE_V7_BAND_CURVE } from "./snake";
import { BINTOSS_REV_TARGET, BINTOSS_V5_BAND_CURVE } from "./binToss";
import { SNIP_REV_TARGET, SNIP_V8_BAND_CURVE } from "./snip";
import { HOVER_REV_TARGET, HOVER_V6_BAND_CURVE } from "./hover";
import { SKYLINE_REV_TARGET, SKYLINE_V5_BAND_CURVE } from "./skyline";
import { JUNC_REV_BAND, JUNC_BAND_CURVE } from "./junction";
import { BRK_REV_TARGET, BRK_V7_BAND_CURVE } from "./breaker";
import { TILT_REV_TARGET, TILT_V5_BAND_CURVE } from "./tilt";
import { ORBIT_REV_TARGET } from "./orbit";
import { ORBIT_V9_BAND_CURVE } from "./orbitRev3";
import { BEAT_REV_TARGET, BEAT_V7_BAND_CURVE } from "./beat";
import { SLICE_REV_TARGET, SLICE_V7_BAND_CURVE } from "./slice";
import { BURST_REV_TARGET, BURST_V5_BAND_CURVE } from "./burst";
import { SWING_REV_TARGET, SWING_V10_BAND_CURVE } from "./swing";
import { BULLSEYE_REV_TARGET, BULLSEYE_V5_BAND_CURVE } from "./bullseye";
import { PIN_REV_TARGET, PIN_V2_BAND_CURVE } from "./pinball";

export interface LiveBand {
  /** The puzzle field that carries the stamp, and the revision new rounds are dealt. */
  field: string;
  rev: number;
  curve: BandCurve;
}

export const LIVE_BANDS = {
  balltrack: { field: "btRev", rev: BT_REV_TARGET, curve: BT_V5_BAND_CURVE },
  wavefront: { field: "wavRev", rev: WAV_REV_TARGET, curve: WAV_V7_BAND_CURVE },
  flip: { field: "flipRev", rev: FLIP_REV_TARGET, curve: FLIP_V5_BAND_CURVE },
  inkbridge: { field: "inkRev", rev: INK_REV_TARGET, curve: INK_V7_BAND_CURVE },
  matchup: { field: "matchupRev", rev: MATCHUP_REV_TARGET, curve: MATCHUP_V7_BAND_CURVE },
  bubble: { field: "bubbleRev", rev: BUB_REV_TARGET, curve: BUB_V6_BAND_CURVE },
  cross: { field: "crossRev", rev: CROSS_REV_TARGET, curve: CROSS_V6_BAND_CURVE },
  rally: { field: "rallyRev", rev: RALLY_REV_TARGET, curve: RALLY_V7_BAND_CURVE },
  snake: { field: "snakeRev", rev: SNAKE_REV_TARGET, curve: SNAKE_V7_BAND_CURVE },
  bintoss: { field: "binRev", rev: BINTOSS_REV_TARGET, curve: BINTOSS_V5_BAND_CURVE },
  snip: { field: "snipRev", rev: SNIP_REV_TARGET, curve: SNIP_V8_BAND_CURVE },
  hover: { field: "hoverRev", rev: HOVER_REV_TARGET, curve: HOVER_V6_BAND_CURVE },
  skyline: { field: "skylineRev", rev: SKYLINE_REV_TARGET, curve: SKYLINE_V5_BAND_CURVE },
  junction: { field: "junctionRev", rev: JUNC_REV_BAND, curve: JUNC_BAND_CURVE },
  breaker: { field: "brkRev", rev: BRK_REV_TARGET, curve: BRK_V7_BAND_CURVE },
  tilt: { field: "tiltRev", rev: TILT_REV_TARGET, curve: TILT_V5_BAND_CURVE },
  orbit: { field: "orbitRev", rev: ORBIT_REV_TARGET, curve: ORBIT_V9_BAND_CURVE },
  beat: { field: "beatRev", rev: BEAT_REV_TARGET, curve: BEAT_V7_BAND_CURVE },
  slice: { field: "sliceRev", rev: SLICE_REV_TARGET, curve: SLICE_V7_BAND_CURVE },
  burst: { field: "burstRev", rev: BURST_REV_TARGET, curve: BURST_V5_BAND_CURVE },
  swing: { field: "swingRev", rev: SWING_REV_TARGET, curve: SWING_V10_BAND_CURVE },
  bullseye: { field: "bullRev", rev: BULLSEYE_REV_TARGET, curve: BULLSEYE_V5_BAND_CURVE },
  pinball: { field: "pinRev", rev: PIN_REV_TARGET, curve: PIN_V2_BAND_CURVE },
} as const satisfies Record<string, LiveBand>;

export type LiveBandGame = keyof typeof LIVE_BANDS;

/** The "?" help SCORE text for a band game, its numbers from the curve new rounds are dealt on. */
export function liveBandHelp(game: LiveBandGame, units: string, words: BandHelpWords): string {
  return bandHelp(units, LIVE_BANDS[game].curve, words);
}
