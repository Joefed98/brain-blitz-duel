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
import { roundMaxFor } from "../duel/roundMax";
import { BT_REV_STRICT, BT_V6_BAND_CURVE } from "./ballTrack";
import { WAV_REV_STRICT, WAV_V8_BAND_CURVE } from "./wavefront";
import { FLIP_REV_STRICT, FLIP_V6_BAND_CURVE } from "./flip";
import { INK_REV_STRICT, INK_V8_BAND_CURVE } from "./inkBridge";
import { MATCHUP_REV_STRICT, MATCHUP_V8_BAND_CURVE } from "./matchup";
import { BUB_REV_STRICT, BUB_V7_BAND_CURVE } from "./bubble";
import { CROSS_REV_EXPAND, CROSS_V8_BAND_CURVE } from "./cross";
import { RALLY_REV_STRICT, RALLY_V8_BAND_CURVE } from "./rally";
import { SNAKE_REV_STRICT, SNAKE_V8_BAND_CURVE } from "./snake";
import { BINTOSS_REV_STRICT, BINTOSS_V6_BAND_CURVE } from "./binToss";
import { SNIP_REV_STRICT, SNIP_V9_BAND_CURVE } from "./snip";
import { HOVER_REV_STRICT, HOVER_V7_BAND_CURVE } from "./hover";
import { SKYLINE_REV_STRICT, SKYLINE_V6_BAND_CURVE } from "./skyline";
import { JUNC_REV_BAND, JUNC_BAND_CURVE } from "./junction";
import { BRK_REV_STRICT, BRK_V8_BAND_CURVE } from "./breaker";
import { TILT_REV_STRICT, TILT_V6_BAND_CURVE } from "./tilt";
import { ORBIT_REV_STRICT } from "./orbit";
import { ORBIT_V10_BAND_CURVE } from "./orbitRev3";
import { BEAT_REV_STRICT, BEAT_V8_BAND_CURVE } from "./beat";
import { SLICE_REV_STRICT, SLICE_V8_BAND_CURVE } from "./slice";
import { BURST_REV_STRICT, BURST_V6_BAND_CURVE } from "./burst";
import { SWING_REV_STRICT, SWING_V11_BAND_CURVE } from "./swing";
import { BULLSEYE_REV_STRICT, BULLSEYE_V6_BAND_CURVE } from "./bullseye";
import { PIN_REV_STRICT, PIN_V3_BAND_CURVE } from "./pinball";

export interface LiveBand {
  /** The puzzle field that carries the stamp, and the revision new rounds are dealt. */
  field: string;
  rev: number;
  curve: BandCurve;
}

export const LIVE_BANDS = {
  balltrack: { field: "btRev", rev: BT_REV_STRICT, curve: BT_V6_BAND_CURVE },
  wavefront: { field: "wavRev", rev: WAV_REV_STRICT, curve: WAV_V8_BAND_CURVE },
  flip: { field: "flipRev", rev: FLIP_REV_STRICT, curve: FLIP_V6_BAND_CURVE },
  inkbridge: { field: "inkRev", rev: INK_REV_STRICT, curve: INK_V8_BAND_CURVE },
  matchup: { field: "matchupRev", rev: MATCHUP_REV_STRICT, curve: MATCHUP_V8_BAND_CURVE },
  bubble: { field: "bubbleRev", rev: BUB_REV_STRICT, curve: BUB_V7_BAND_CURVE },
  cross: { field: "crossRev", rev: CROSS_REV_EXPAND, curve: CROSS_V8_BAND_CURVE },
  rally: { field: "rallyRev", rev: RALLY_REV_STRICT, curve: RALLY_V8_BAND_CURVE },
  snake: { field: "snakeRev", rev: SNAKE_REV_STRICT, curve: SNAKE_V8_BAND_CURVE },
  bintoss: { field: "binRev", rev: BINTOSS_REV_STRICT, curve: BINTOSS_V6_BAND_CURVE },
  snip: { field: "snipRev", rev: SNIP_REV_STRICT, curve: SNIP_V9_BAND_CURVE },
  hover: { field: "hoverRev", rev: HOVER_REV_STRICT, curve: HOVER_V7_BAND_CURVE },
  skyline: { field: "skylineRev", rev: SKYLINE_REV_STRICT, curve: SKYLINE_V6_BAND_CURVE },
  junction: { field: "junctionRev", rev: JUNC_REV_BAND, curve: JUNC_BAND_CURVE },
  breaker: { field: "brkRev", rev: BRK_REV_STRICT, curve: BRK_V8_BAND_CURVE },
  tilt: { field: "tiltRev", rev: TILT_REV_STRICT, curve: TILT_V6_BAND_CURVE },
  orbit: { field: "orbitRev", rev: ORBIT_REV_STRICT, curve: ORBIT_V10_BAND_CURVE },
  beat: { field: "beatRev", rev: BEAT_REV_STRICT, curve: BEAT_V8_BAND_CURVE },
  slice: { field: "sliceRev", rev: SLICE_REV_STRICT, curve: SLICE_V8_BAND_CURVE },
  burst: { field: "burstRev", rev: BURST_REV_STRICT, curve: BURST_V6_BAND_CURVE },
  swing: { field: "swingRev", rev: SWING_REV_STRICT, curve: SWING_V11_BAND_CURVE },
  bullseye: { field: "bullRev", rev: BULLSEYE_REV_STRICT, curve: BULLSEYE_V6_BAND_CURVE },
  pinball: { field: "pinRev", rev: PIN_REV_STRICT, curve: PIN_V3_BAND_CURVE },
} as const satisfies Record<string, LiveBand>;

export type LiveBandGame = keyof typeof LIVE_BANDS;

/** The "?" help SCORE text for a band game, its numbers from the curve new rounds are dealt on. */
export function liveBandHelp(game: LiveBandGame, units: string, words: BandHelpWords): string {
  return bandHelp(units, LIVE_BANDS[game].curve, words, roundMaxFor(game));
}
