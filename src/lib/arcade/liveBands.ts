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
import { bandCurve, bandHelp, type BandCurve, type BandHelpWords } from "./scoreBands";
import { roundMaxFor } from "../duel/roundMax";
import { BT_REV_STD, BT_REV_STRICT, BT_V8_BAND_CURVE } from "./ballTrack";
import { WAV_REV_STD, WAV_REV_STRICT, WAV_V12_BAND_CURVE } from "./wavefront";
import { FLIP_REV_STD, FLIP_REV_STRICT, FLIP_V10_BAND_CURVE } from "./flip";
import { INK_REV_STD, INK_REV_STRICT, INK_V12_BAND_CURVE } from "./inkBridge";
import { MATCHUP_REV_STD, MATCHUP_REV_STRICT, MATCHUP_V11_BAND_CURVE } from "./matchup";
import { BUB_REV_STD, BUB_REV_STRICT, BUB_V11_BAND_CURVE, BUB_V11_STD_SPEC } from "./bubble";
import { CROSS_REV_STD, CROSS_REV_STRICT, CROSS_V10_BAND_CURVE } from "./cross";
import { MINES_REV_STD, MINES_STD_SPEC, MINES_V1_BAND_CURVE } from "./minesweeper";
import { MAHJONG_REV_DEALT, MAHJONG_STD_SPEC, MAHJONG_V1_BAND_CURVE } from "./mahjong";
import { RALLY_REV_STD, RALLY_REV_STRICT, RALLY_STD_SPEC, RALLY_V12_BAND_CURVE } from "./rally";
import { SNAKE_REV_STD, SNAKE_REV_STRICT, SNAKE_V11_BAND_CURVE } from "./snake";
import { BINTOSS_REV_STRICT, BINTOSS_REV_STD, BINTOSS_STD_SPEC, BINTOSS_V9_BAND_CURVE } from "./binToss";
import { stdHelp, type StdSpec } from "./arcadeStandard";
import { SNIP_REV_EXPAND, SNIP_REV_STRICT, SNIP_V11_BAND_CURVE } from "./snip";
import { HOVER_REV_STANDARD, HOVER_REV_STRICT, HOVER_V10_BAND_CURVE } from "./hover";
import { SKYLINE_REV_STD, SKYLINE_REV_STRICT, SKYLINE_STD_SPEC, SKYLINE_V9_BAND_CURVE } from "./skyline";
import { JUNC_REV_BAND, JUNC_BAND_CURVE } from "./junction";
import { BRK_REV_STD, BRK_REV_STRICT, BRK_V11_BAND_CURVE } from "./breaker";
import { TILT_REV_STD, TILT_REV_STRICT, TILT_V10_BAND_CURVE } from "./tilt";
import { ORBIT_REV_STRICT, ORBIT_REV_STD } from "./orbit";
import { ORBIT_V13_BAND_CURVE } from "./orbitRev3";
import { BEAT_REV_STD, BEAT_REV_STRICT, BEAT_STD_SPEC, BEAT_V11_BAND_CURVE } from "./beat";
import { SLICE_REV_STRICT, SLICE_REV_STANDARD, SLICE_V11_BAND_CURVE } from "./slice";
import { BURST_REV_STD, BURST_REV_STRICT, BURST_V10_BAND_CURVE } from "./burst";
import { SWING_REV_REWORK, SWING_REV_STRICT, SWING_V15_BAND_CURVE } from "./swing";
import { BULLSEYE_REV_STD, BULLSEYE_REV_STRICT, BULLSEYE_STD_SPEC, BULLSEYE_V9_BAND_CURVE } from "./bullseye";
import { PIN_REV_STD, PIN_STD_SPEC, PIN_V6_BAND_CURVE } from "./pinball4";
import { PIN_REV_STRICT } from "./pinball";
import { HOMERUN_REV_DEALT, HOMERUN_STD_SPEC_DEALT, HOMERUN_V2_BAND_CURVE } from "./homerun";
import { FREEKICK_REV_DEALT, FREEKICK_V2_STD_SPEC, FREEKICK_V2_BAND_CURVE } from "./freekick";
import { RACING_REV_DEALT, RACING_V2_BAND_CURVE, RACING_V2_STD_SPEC } from "./racing";
import { FC_REV, FC_STD_SPEC, FC_V1_BAND_CURVE } from "./cards/freecell";
import { TP_REV, TP_STD_SPEC, TP_V1_BAND_CURVE } from "./cards/tripeaks";
import { PS_REV, PS_STD_SPEC, PS_V2_BAND_CURVE } from "./cards/pokerSquares";
import { FH_REV, FH_STD_SPEC, FH_V1_BAND_CURVE } from "./cards/fiveHands";
import { MINIGOLF_REV, MINIGOLF_STD_SPEC } from "./minigolf";
import { POOL_REV, POOL_STD_SPEC } from "./pool";
import { CURLING_REV, CURLING_STD_SPEC } from "./curling";

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
  /**
   * A game on the arcade scoring standard (arcadeStandard.ts): its spec (core and features, summing to 200). `curve`
   * is then the core's straight line (0 → the core's maximum at its full-at figure), and the help reads the spec.
   */
  std?: StdSpec;
  /**
   * A game born on the arcade scoring standard (its first revision; the Cards & Board and Sports games, 30 Oct 2026): it
   * has no score-band revision, target revision or strict curve behind it, so the band-era checks pass it by
   * (liveBornOnStandard); arcade-standard-check proves its standard instead.
   */
  born?: true;
}

/** A standard game's core as a band curve: its straight line from 0 to the core's maximum at its full-at figure. */
function stdCoreCurve(spec: StdSpec): BandCurve {
  const core = spec.parts[0]!;
  return bandCurve([0, core.of ?? 1], [0, core.max]);
}

export const LIVE_BANDS = {
  balltrack: { field: "btRev", rev: BT_REV_STD, curve: BT_V8_BAND_CURVE, strictRev: BT_REV_STRICT },
  wavefront: { field: "wavRev", rev: WAV_REV_STD, curve: WAV_V12_BAND_CURVE, strictRev: WAV_REV_STRICT },
  // flipRev 10 (the arcade scoring standard): the core's straight line (half seconds survived → 150); features up to 50 more.
  flip: { field: "flipRev", rev: FLIP_REV_STD, curve: FLIP_V10_BAND_CURVE, strictRev: FLIP_REV_STRICT },
  // inkRev 12 (the arcade scoring standard): levels on a straight line to 140; speed and the features add up to 60 more.
  inkbridge: { field: "inkRev", rev: INK_REV_STD, curve: INK_V12_BAND_CURVE, strictRev: INK_REV_STRICT },
  // matchupRev 11 (the arcade scoring standard): the core's straight line (gems cleared, to 110); treasure, goals, ice and
  // big lines pay fixed amounts on top, to 200 (the help says so).
  matchup: { field: "matchupRev", rev: MATCHUP_REV_STD, curve: MATCHUP_V11_BAND_CURVE, strictRev: MATCHUP_REV_STRICT },
  // bubbleRev 11 (the arcade scoring standard): the core's straight line; the spec lists every part.
  bubble: { field: "bubbleRev", rev: BUB_REV_STD, curve: BUB_V11_BAND_CURVE, strictRev: BUB_REV_STRICT, std: BUB_V11_STD_SPEC },
  cross: { field: "crossRev", rev: CROSS_REV_STD, curve: CROSS_V10_BAND_CURVE, strictRev: CROSS_REV_STRICT },
  // rallyRev 12 (the arcade scoring standard): gold-ball hits on a straight line, pads and gold targets fixed.
  rally: { field: "rallyRev", rev: RALLY_REV_STD, curve: RALLY_V12_BAND_CURVE, strictRev: RALLY_REV_STRICT, std: RALLY_STD_SPEC },
  // snakeRev 11 (the arcade scoring standard): the core's straight line to 120; gold stars, combos, lane rides and warp stars pay up to 80 more (the help says so).
  snake: { field: "snakeRev", rev: SNAKE_REV_STD, curve: SNAKE_V11_BAND_CURVE, strictRev: SNAKE_REV_STRICT },
  bintoss: { field: "binRev", rev: BINTOSS_REV_STD, curve: BINTOSS_V9_BAND_CURVE, strictRev: BINTOSS_REV_STRICT, std: BINTOSS_STD_SPEC },
  snip: { field: "snipRev", rev: SNIP_REV_EXPAND, curve: SNIP_V11_BAND_CURVE, strictRev: SNIP_REV_STRICT },
  // hoverRev 10 (the arcade scoring standard): the core, barriers on one straight line to 120; the features add 80 (the help says so).
  hover: { field: "hoverRev", rev: HOVER_REV_STANDARD, curve: HOVER_V10_BAND_CURVE, strictRev: HOVER_REV_STRICT },
  // skylineRev 9 (the arcade scoring standard): floors on a straight line to 140, then perfect drops, the streak and gold.
  skyline: { field: "skylineRev", rev: SKYLINE_REV_STD, curve: SKYLINE_V9_BAND_CURVE, strictRev: SKYLINE_REV_STRICT, std: SKYLINE_STD_SPEC },
  junction: { field: "junctionRev", rev: JUNC_REV_BAND, curve: JUNC_BAND_CURVE },
  // brkRev 11 (the arcade scoring standard): the bricks' straight line to 140; clear 10, speed 20 and gold 30 on top (the help says so).
  breaker: { field: "brkRev", rev: BRK_REV_STD, curve: BRK_V11_BAND_CURVE, strictRev: BRK_REV_STRICT },
  // tiltRev 10 (the arcade scoring standard): the core's straight line (35 a maze, to 140); finish, speed and gold stars add up to 60 (the help says so).
  tilt: { field: "tiltRev", rev: TILT_REV_STD, curve: TILT_V10_BAND_CURVE, strictRev: TILT_REV_STRICT },
  // orbitRev 13 (the arcade scoring standard): planets on a straight line to 130; speed and features pay up to 70 more.
  orbit: { field: "orbitRev", rev: ORBIT_REV_STD, curve: ORBIT_V13_BAND_CURVE, strictRev: ORBIT_REV_STRICT },
  // beatRev 11 (the arcade scoring standard): beatRev 10's play; accuracy on a straight line to 130, four fixed features.
  beat: { field: "beatRev", rev: BEAT_REV_STD, curve: BEAT_V11_BAND_CURVE, strictRev: BEAT_REV_STRICT, std: BEAT_STD_SPEC },
  // sliceRev 11 (the arcade scoring standard): the core's straight line to 120; combo, golden fruit, tickets and dodges pay up to 80 more.
  slice: { field: "sliceRev", rev: SLICE_REV_STANDARD, curve: SLICE_V11_BAND_CURVE, strictRev: SLICE_REV_STRICT },
  // burstRev 10 (the arcade scoring standard): the core's straight line (140 at all 87 atoms); wave clears, golden atoms and lives on top (the help says so).
  burst: { field: "burstRev", rev: BURST_REV_STD, curve: BURST_V10_BAND_CURVE, strictRev: BURST_REV_STRICT },
  // swingRev 15 (the swinging course): the course's straight line to 140; pars and pickups pay up to 60 more (the help says so).
  swing: { field: "swingRev", rev: SWING_REV_REWORK, curve: SWING_V15_BAND_CURVE, strictRev: SWING_REV_STRICT },
  // bullRev 9 (the arcade scoring standard, docs/arcade-standard/bullseye.md): the dart total on a straight line, plus the
  // bull streak and dead-centre darts.
  bullseye: { field: "bullRev", rev: BULLSEYE_REV_STD, curve: BULLSEYE_V9_BAND_CURVE, strictRev: BULLSEYE_REV_STRICT, std: BULLSEYE_STD_SPEC },
  // pinRev 6 (29 Oct 2026): the arcade scoring standard (table points on a straight line to 130, four features to 70).
  pinball: { field: "pinRev", rev: PIN_REV_STD, curve: PIN_V6_BAND_CURVE, strictRev: PIN_REV_STRICT, std: PIN_STD_SPEC },
  // Cards & Board (30 Oct 2026), on the arcade scoring standard from their first revision: the core's straight line
  // (Minesweeper in per mille of the safe squares beyond the opening, Mahjong in pairs) and fixed features to 200.
  minesweeper: { field: "minesRev", rev: MINES_REV_STD, curve: MINES_V1_BAND_CURVE, std: MINES_STD_SPEC, born: true },
  mahjong: { field: "mahjongRev", rev: MAHJONG_REV_DEALT, curve: MAHJONG_V1_BAND_CURVE, std: MAHJONG_STD_SPEC, born: true },
  // The Sports group (30 Oct 2026), born on the arcade scoring standard (rev 1; no earlier band revision).
  homerun: { field: "homerunRev", rev: HOMERUN_REV_DEALT, curve: HOMERUN_V2_BAND_CURVE, std: HOMERUN_STD_SPEC_DEALT, born: true },
  freekick: { field: "freekickRev", rev: FREEKICK_REV_DEALT, curve: FREEKICK_V2_BAND_CURVE, std: FREEKICK_V2_STD_SPEC, born: true },
  racing: { field: "racingRev", rev: RACING_REV_DEALT, curve: RACING_V2_BAND_CURVE, std: RACING_V2_STD_SPEC, born: true },
  // Cards & Board (30 Oct 2026): born on the arcade scoring standard at revision 1.
  freecell: { field: "freecellRev", rev: FC_REV, curve: FC_V1_BAND_CURVE, std: FC_STD_SPEC, born: true },
  tripeaks: { field: "tripeaksRev", rev: TP_REV, curve: TP_V1_BAND_CURVE, std: TP_STD_SPEC, born: true },
  // pokerSquaresRev 2 (Full House, 31 Oct 2026): the core full at the elite median.
  pokersquares: { field: "pokerSquaresRev", rev: PS_REV, curve: PS_V2_BAND_CURVE, std: PS_STD_SPEC, born: true },
  // Five Hands (31 Oct 2026): born on the arcade scoring standard at revision 1.
  fivehands: { field: "fiveHandsRev", rev: FH_REV, curve: FH_V1_BAND_CURVE, std: FH_STD_SPEC, born: true },
  // The Sports group (30 Oct 2026): on the arcade scoring standard from their first stamp (the core's straight line, the spec's parts).
  minigolf: { field: "golfRev", rev: MINIGOLF_REV, curve: stdCoreCurve(MINIGOLF_STD_SPEC), std: MINIGOLF_STD_SPEC, born: true },
  pool: { field: "poolRev", rev: POOL_REV, curve: stdCoreCurve(POOL_STD_SPEC), std: POOL_STD_SPEC, born: true },
  curling: { field: "curlRev", rev: CURLING_REV, curve: stdCoreCurve(CURLING_STD_SPEC), std: CURLING_STD_SPEC, born: true },
} as const satisfies Record<string, LiveBand>;

export type LiveBandGame = keyof typeof LIVE_BANDS;

/** True for a game born on the arcade scoring standard (LiveBand `born`): no score-band history behind it. */
export function liveBornOnStandard(game: string): boolean {
  return (LIVE_BANDS as Record<string, LiveBand>)[game]?.born === true;
}

/** The score-band (strict curve) revision of a game: its `strictRev` once an expansion moved rooms past it, else the dealt one. */
export function liveStrictRev(game: LiveBandGame): number {
  const live: LiveBand = LIVE_BANDS[game];
  return live.strictRev ?? live.rev;
}

/** The "?" help SCORE text for a band game, its numbers from the curve new rounds are dealt on. */
export function liveBandHelp(game: LiveBandGame, units: string, words: BandHelpWords): string {
  return bandHelp(units, LIVE_BANDS[game].curve, words, roundMaxFor(game));
}

/** The "?" help SCORE text for a game on the arcade scoring standard: every part, its maximum and how it pays, 200 in all. */
export function liveStdHelp(game: LiveBandGame, lead = ""): string {
  const live: LiveBand = LIVE_BANDS[game];
  if (!live.std) throw new Error(`liveStdHelp: ${game} is not on the arcade scoring standard`);
  return stdHelp(live.std, lead);
}
