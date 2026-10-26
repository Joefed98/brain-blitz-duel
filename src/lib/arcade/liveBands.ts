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
import { BT_REV_RUSH, BT_REV_STRICT, BT_V7_BAND_CURVE } from "./ballTrack";
import { WAV_REV_STRICT, WAV_V8_BAND_CURVE } from "./wavefront";
import { FLIP_REV_STRICT, FLIP_V6_BAND_CURVE } from "./flip";
import { INK_REV_STRICT, INK_V8_BAND_CURVE } from "./inkBridge";
import { MATCHUP_REV_GOALS, MATCHUP_REV_STRICT, MATCHUP_V9_BAND_CURVE } from "./matchup";
import { BUB_REV_REEF, BUB_REV_STRICT, BUB_V8_BAND_CURVE } from "./bubble";
import { CROSS_REV_EXPAND, CROSS_REV_STRICT, CROSS_V9_BAND_CURVE } from "./cross";
import { RALLY_REV_STRICT, RALLY_V8_BAND_CURVE } from "./rally";
import { SNAKE_REV_200, SNAKE_REV_STRICT, SNAKE_V9_BAND_CURVE } from "./snake";
import { BINTOSS_REV_STRICT, BINTOSS_REV_EXPAND, BINTOSS_V7_BAND_CURVE } from "./binToss";
import { SNIP_REV_STRICT, SNIP_V9_BAND_CURVE } from "./snip";
import { HOVER_REV_STRICT, HOVER_V7_BAND_CURVE } from "./hover";
import { SKYLINE_REV_EXPAND, SKYLINE_REV_STRICT, SKYLINE_V7_BAND_CURVE } from "./skyline";
import { JUNC_REV_BAND, JUNC_BAND_CURVE } from "./junction";
import { BRK_REV_DEEP, BRK_REV_STRICT, BRK_V9_BAND_CURVE } from "./breaker";
import { TILT_REV_STRICT, TILT_V6_BAND_CURVE } from "./tilt";
import { ORBIT_REV_STRICT } from "./orbit";
import { ORBIT_V10_BAND_CURVE } from "./orbitRev3";
import { BEAT_REV_200, BEAT_REV_STRICT, BEAT_V9_BAND_CURVE } from "./beat";
import { SLICE_REV_STRICT, SLICE_REV_EXPAND, SLICE_V9_BAND_CURVE } from "./slice";
import { BURST_REV_STRICT, BURST_V6_BAND_CURVE } from "./burst";
import { SWING_REV_STRICT, SWING_V11_BAND_CURVE } from "./swing";
import { BULLSEYE_REV_STRICT, BULLSEYE_V6_BAND_CURVE } from "./bullseye";
import { PIN_REV_EXPAND, PIN_V4_BAND_CURVE } from "./pinball4";
import { PIN_REV_STRICT } from "./pinball";

export interface LiveBand {
  /** The puzzle field that carries the stamp, and the revision new rounds are dealt. */
  field: string;
  rev: number;
  curve: BandCurve;
  /**
   * A game raised to 200 by its expansion (docs/scoring-200.md): the score-band revision (band 3, its strict
   * curve) rooms dealt before it. `rev` and `curve` are then the expansion's revision and base curve (which
   * scores to 150 before the expansion's feature bonus); the strict-curve checks read this revision.
   */
  strictRev?: number;
}

export const LIVE_BANDS = {
  balltrack: { field: "btRev", rev: BT_REV_RUSH, curve: BT_V7_BAND_CURVE, strictRev: BT_REV_STRICT },
  wavefront: { field: "wavRev", rev: WAV_REV_STRICT, curve: WAV_V8_BAND_CURVE },
  flip: { field: "flipRev", rev: FLIP_REV_STRICT, curve: FLIP_V6_BAND_CURVE },
  inkbridge: { field: "inkRev", rev: INK_REV_STRICT, curve: INK_V8_BAND_CURVE },
  matchup: { field: "matchupRev", rev: MATCHUP_REV_GOALS, curve: MATCHUP_V9_BAND_CURVE, strictRev: MATCHUP_REV_STRICT },
  bubble: { field: "bubbleRev", rev: BUB_REV_REEF, curve: BUB_V8_BAND_CURVE, strictRev: BUB_REV_STRICT },
  cross: { field: "crossRev", rev: CROSS_REV_EXPAND, curve: CROSS_V9_BAND_CURVE, strictRev: CROSS_REV_STRICT },
  rally: { field: "rallyRev", rev: RALLY_REV_STRICT, curve: RALLY_V8_BAND_CURVE },
  snake: { field: "snakeRev", rev: SNAKE_REV_200, curve: SNAKE_V9_BAND_CURVE, strictRev: SNAKE_REV_STRICT },
  bintoss: { field: "binRev", rev: BINTOSS_REV_EXPAND, curve: BINTOSS_V7_BAND_CURVE, strictRev: BINTOSS_REV_STRICT },
  snip: { field: "snipRev", rev: SNIP_REV_STRICT, curve: SNIP_V9_BAND_CURVE },
  hover: { field: "hoverRev", rev: HOVER_REV_STRICT, curve: HOVER_V7_BAND_CURVE },
  skyline: { field: "skylineRev", rev: SKYLINE_REV_EXPAND, curve: SKYLINE_V7_BAND_CURVE, strictRev: SKYLINE_REV_STRICT },
  junction: { field: "junctionRev", rev: JUNC_REV_BAND, curve: JUNC_BAND_CURVE },
  breaker: { field: "brkRev", rev: BRK_REV_DEEP, curve: BRK_V9_BAND_CURVE, strictRev: BRK_REV_STRICT },
  tilt: { field: "tiltRev", rev: TILT_REV_STRICT, curve: TILT_V6_BAND_CURVE },
  orbit: { field: "orbitRev", rev: ORBIT_REV_STRICT, curve: ORBIT_V10_BAND_CURVE },
  beat: { field: "beatRev", rev: BEAT_REV_200, curve: BEAT_V9_BAND_CURVE, strictRev: BEAT_REV_STRICT },
  slice: { field: "sliceRev", rev: SLICE_REV_EXPAND, curve: SLICE_V9_BAND_CURVE, strictRev: SLICE_REV_STRICT },
  burst: { field: "burstRev", rev: BURST_REV_STRICT, curve: BURST_V6_BAND_CURVE },
  swing: { field: "swingRev", rev: SWING_REV_STRICT, curve: SWING_V11_BAND_CURVE },
  bullseye: { field: "bullRev", rev: BULLSEYE_REV_STRICT, curve: BULLSEYE_V6_BAND_CURVE },
  pinball: { field: "pinRev", rev: PIN_REV_EXPAND, curve: PIN_V4_BAND_CURVE, strictRev: PIN_REV_STRICT },
} as const satisfies Record<string, LiveBand>;

export type LiveBandGame = keyof typeof LIVE_BANDS;

/** The score-band (strict curve) revision of a game: its `strictRev` once an expansion moved rooms past it, else the dealt one. */
export function liveStrictRev(game: LiveBandGame): number {
  const live: LiveBand = LIVE_BANDS[game];
  return live.strictRev ?? live.rev;
}

/** The "?" help SCORE text for a band game, its numbers from the curve new rounds are dealt on. */
export function liveBandHelp(game: LiveBandGame, units: string, words: BandHelpWords): string {
  return bandHelp(units, LIVE_BANDS[game].curve, words, roundMaxFor(game));
}
