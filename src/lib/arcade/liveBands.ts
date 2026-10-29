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
import { WAV_REV_PHONE, WAV_REV_STRICT, WAV_V11_BAND_CURVE } from "./wavefront";
import { FLIP_REV_LIFT, FLIP_REV_STRICT, FLIP_V9_BAND_CURVE } from "./flip";
import { INK_REV_SPREAD, INK_REV_STRICT, INK_V10_BAND_CURVE } from "./inkBridge";
import { MATCHUP_REV_ICE, MATCHUP_REV_STRICT, MATCHUP_V10_BAND_CURVE } from "./matchup";
import { BUB_REV_BLAST, BUB_REV_STRICT, BUB_V8_BAND_CURVE } from "./bubble";
import { CROSS_REV_EXPAND, CROSS_REV_STRICT, CROSS_V9_BAND_CURVE } from "./cross";
import { RALLY_REV_CURVE, RALLY_REV_STRICT, RALLY_V10_BAND_CURVE } from "./rally";
import { SNAKE_REV_10, SNAKE_REV_STRICT, SNAKE_V9_BAND_CURVE } from "./snake";
import { BINTOSS_REV_STRICT, BINTOSS_REV_SMALL_FAR, BINTOSS_V7_BAND_CURVE } from "./binToss";
import { SNIP_REV_EXPAND, SNIP_REV_STRICT, SNIP_V11_BAND_CURVE } from "./snip";
import { HOVER_REV_EXPAND, HOVER_REV_STRICT, HOVER_V9_BAND_CURVE } from "./hover";
import { SKYLINE_REV_LIFT, SKYLINE_REV_STRICT, SKYLINE_V8_BAND_CURVE } from "./skyline";
import { JUNC_REV_BAND, JUNC_BAND_CURVE } from "./junction";
import { BRK_REV_STD, BRK_REV_STRICT, BRK_V11_BAND_CURVE } from "./breaker";
import { TILT_REV_LIFT, TILT_REV_STRICT, TILT_V9_BAND_CURVE } from "./tilt";
import { ORBIT_REV_STRICT, ORBIT_REV_XP } from "./orbit";
import { ORBIT_V12_BAND_CURVE } from "./orbitRev3";
import { BEAT_REV_EASE, BEAT_REV_STRICT, BEAT_V10_BAND_CURVE } from "./beat";
import { SLICE_REV_STRICT, SLICE_REV_BIG, SLICE_V9_BAND_CURVE } from "./slice";
import { BURST_REV_CARRY, BURST_REV_STRICT, BURST_V9_BAND_CURVE } from "./burst";
import { SWING_REV_ASSAULT, SWING_REV_STRICT, SWING_V14_BAND_CURVE } from "./swing";
import { BULLSEYE_REV_EXPAND, BULLSEYE_REV_STRICT, BULLSEYE_V8_BAND_CURVE } from "./bullseye";
import { PIN_REV_LONG, PIN_V5_BAND_CURVE } from "./pinball4";
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
  wavefront: { field: "wavRev", rev: WAV_REV_PHONE, curve: WAV_V11_BAND_CURVE, strictRev: WAV_REV_STRICT },
  flip: { field: "flipRev", rev: FLIP_REV_LIFT, curve: FLIP_V9_BAND_CURVE, strictRev: FLIP_REV_STRICT },
  inkbridge: { field: "inkRev", rev: INK_REV_SPREAD, curve: INK_V10_BAND_CURVE, strictRev: INK_REV_STRICT },
  matchup: { field: "matchupRev", rev: MATCHUP_REV_ICE, curve: MATCHUP_V10_BAND_CURVE, strictRev: MATCHUP_REV_STRICT },
  bubble: { field: "bubbleRev", rev: BUB_REV_BLAST, curve: BUB_V8_BAND_CURVE, strictRev: BUB_REV_STRICT },
  cross: { field: "crossRev", rev: CROSS_REV_EXPAND, curve: CROSS_V9_BAND_CURVE, strictRev: CROSS_REV_STRICT },
  rally: { field: "rallyRev", rev: RALLY_REV_CURVE, curve: RALLY_V10_BAND_CURVE, strictRev: RALLY_REV_STRICT },
  snake: { field: "snakeRev", rev: SNAKE_REV_10, curve: SNAKE_V9_BAND_CURVE, strictRev: SNAKE_REV_STRICT },
  bintoss: { field: "binRev", rev: BINTOSS_REV_SMALL_FAR, curve: BINTOSS_V7_BAND_CURVE, strictRev: BINTOSS_REV_STRICT },
  snip: { field: "snipRev", rev: SNIP_REV_EXPAND, curve: SNIP_V11_BAND_CURVE, strictRev: SNIP_REV_STRICT },
  hover: { field: "hoverRev", rev: HOVER_REV_EXPAND, curve: HOVER_V9_BAND_CURVE, strictRev: HOVER_REV_STRICT },
  skyline: { field: "skylineRev", rev: SKYLINE_REV_LIFT, curve: SKYLINE_V8_BAND_CURVE, strictRev: SKYLINE_REV_STRICT },
  junction: { field: "junctionRev", rev: JUNC_REV_BAND, curve: JUNC_BAND_CURVE },
  // brkRev 11 (the arcade scoring standard): the bricks' straight line to 140; clear 10, speed 20 and gold 30 on top (the help says so).
  breaker: { field: "brkRev", rev: BRK_REV_STD, curve: BRK_V11_BAND_CURVE, strictRev: BRK_REV_STRICT },
  tilt: { field: "tiltRev", rev: TILT_REV_LIFT, curve: TILT_V9_BAND_CURVE, strictRev: TILT_REV_STRICT },
  orbit: { field: "orbitRev", rev: ORBIT_REV_XP, curve: ORBIT_V12_BAND_CURVE, strictRev: ORBIT_REV_STRICT },
  // beatRev 10 (phone notes): beatRev 9's base curve and skill pay on an easier chart and wider windows.
  beat: { field: "beatRev", rev: BEAT_REV_EASE, curve: BEAT_V10_BAND_CURVE, strictRev: BEAT_REV_STRICT },
  slice: { field: "sliceRev", rev: SLICE_REV_BIG, curve: SLICE_V9_BAND_CURVE, strictRev: SLICE_REV_STRICT },
  burst: { field: "burstRev", rev: BURST_REV_CARRY, curve: BURST_V9_BAND_CURVE, strictRev: BURST_REV_STRICT },
  // swingRev 14 (the assault course): the sections' curve; pars, gates, gems and stars pay up to 70 more (the help says so).
  swing: { field: "swingRev", rev: SWING_REV_ASSAULT, curve: SWING_V14_BAND_CURVE, strictRev: SWING_REV_STRICT },
  bullseye: { field: "bullRev", rev: BULLSEYE_REV_EXPAND, curve: BULLSEYE_V8_BAND_CURVE, strictRev: BULLSEYE_REV_STRICT },
  pinball: { field: "pinRev", rev: PIN_REV_LONG, curve: PIN_V5_BAND_CURVE, strictRev: PIN_REV_STRICT },
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
