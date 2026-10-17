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
import { BT_REV_TALL, BT_V4_BAND_CURVE } from "./ballTrack";
import { WAV_REV_TALL, WAV_V6_BAND_CURVE } from "./wavefront";
import { FLIP_REV_TUNEC, FLIP_V4_BAND_CURVE } from "./flip";
import { INK_REV_TUNEC, INK_V6_BAND_CURVE } from "./inkBridge";
import { MATCHUP_REV_PAR, MATCHUP_V6_BAND_CURVE } from "./matchup";
import { BUB_REV_TALL, BUB_V5_BAND_CURVE } from "./bubble";
import { CROSS_REV_SMALL, CROSS_BAND_CURVE } from "./cross";
import { RALLY_REV_TALL, RALLY_V6_BAND_CURVE } from "./rally";
import { SNAKE_REV_ROCKS, SNAKE_V6_BAND_CURVE } from "./snake";
import { BINTOSS_REV_BAND, BINTOSS_BAND_CURVE } from "./binToss";
import { SNIP_REV_PROVEN, SNIP_V5_BAND_CURVE } from "./snip";
import { HOVER_REV_TALL, HOVER_V5_BAND_CURVE } from "./hover";
import { SKYLINE_REV_TALL, SKYLINE_BAND_CURVE } from "./skyline";
import { JUNC_REV_BAND, JUNC_BAND_CURVE } from "./junction";
import { BRK_REV_TALL, BRK_V6_BAND_CURVE } from "./breaker";
import { TILT_REV_TUNEC, TILT_V4_BAND_CURVE } from "./tilt";
import { ORBIT_REV_TALL } from "./orbit";
import { ORBIT_BAND_CURVE } from "./orbitRev3";
import { BEAT_REV_TALL, BEAT_V6_BAND_CURVE } from "./beat";
import { SLICE_REV_TALL, SLICE_V6_BAND_CURVE } from "./slice";
import { BURST_REV_TALL, BURST_V4_BAND_CURVE } from "./burst";
import { SWING_REV_TALL, SWING_V9_BAND_CURVE } from "./swing";
import { BULLSEYE_REV_TUNED, BULLSEYE_V4_BAND_CURVE } from "./bullseye";
import { PIN_REV, PIN_BAND_CURVE } from "./pinball";

export interface LiveBand {
  /** The puzzle field that carries the stamp, and the revision new rounds are dealt. */
  field: string;
  rev: number;
  curve: BandCurve;
}

export const LIVE_BANDS = {
  balltrack: { field: "btRev", rev: BT_REV_TALL, curve: BT_V4_BAND_CURVE },
  wavefront: { field: "wavRev", rev: WAV_REV_TALL, curve: WAV_V6_BAND_CURVE },
  flip: { field: "flipRev", rev: FLIP_REV_TUNEC, curve: FLIP_V4_BAND_CURVE },
  inkbridge: { field: "inkRev", rev: INK_REV_TUNEC, curve: INK_V6_BAND_CURVE },
  matchup: { field: "matchupRev", rev: MATCHUP_REV_PAR, curve: MATCHUP_V6_BAND_CURVE },
  bubble: { field: "bubbleRev", rev: BUB_REV_TALL, curve: BUB_V5_BAND_CURVE },
  cross: { field: "crossRev", rev: CROSS_REV_SMALL, curve: CROSS_BAND_CURVE },
  rally: { field: "rallyRev", rev: RALLY_REV_TALL, curve: RALLY_V6_BAND_CURVE },
  snake: { field: "snakeRev", rev: SNAKE_REV_ROCKS, curve: SNAKE_V6_BAND_CURVE },
  bintoss: { field: "binRev", rev: BINTOSS_REV_BAND, curve: BINTOSS_BAND_CURVE },
  snip: { field: "snipRev", rev: SNIP_REV_PROVEN, curve: SNIP_V5_BAND_CURVE },
  hover: { field: "hoverRev", rev: HOVER_REV_TALL, curve: HOVER_V5_BAND_CURVE },
  skyline: { field: "skylineRev", rev: SKYLINE_REV_TALL, curve: SKYLINE_BAND_CURVE },
  junction: { field: "junctionRev", rev: JUNC_REV_BAND, curve: JUNC_BAND_CURVE },
  breaker: { field: "brkRev", rev: BRK_REV_TALL, curve: BRK_V6_BAND_CURVE },
  tilt: { field: "tiltRev", rev: TILT_REV_TUNEC, curve: TILT_V4_BAND_CURVE },
  orbit: { field: "orbitRev", rev: ORBIT_REV_TALL, curve: ORBIT_BAND_CURVE },
  beat: { field: "beatRev", rev: BEAT_REV_TALL, curve: BEAT_V6_BAND_CURVE },
  slice: { field: "sliceRev", rev: SLICE_REV_TALL, curve: SLICE_V6_BAND_CURVE },
  burst: { field: "burstRev", rev: BURST_REV_TALL, curve: BURST_V4_BAND_CURVE },
  swing: { field: "swingRev", rev: SWING_REV_TALL, curve: SWING_V9_BAND_CURVE },
  bullseye: { field: "bullRev", rev: BULLSEYE_REV_TUNED, curve: BULLSEYE_V4_BAND_CURVE },
  pinball: { field: "pinRev", rev: PIN_REV, curve: PIN_BAND_CURVE },
} as const satisfies Record<string, LiveBand>;

export type LiveBandGame = keyof typeof LIVE_BANDS;

/** The "?" help SCORE text for a band game, its numbers from the curve new rounds are dealt on. */
export function liveBandHelp(game: LiveBandGame, units: string, words: BandHelpWords): string {
  return bandHelp(units, LIVE_BANDS[game].curve, words);
}
