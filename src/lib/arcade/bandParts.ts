/**
 * The 22 active arcade games' Oct 2026 score bands in one table: each game's
 * band breakdown (from its own sim), its curve, and how its finish works. Read
 * by the arcade reveal and the score-band check; the sims own the rules.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BandCurve, BandParts } from "./scoreBands";
import { btBandParts, BT_BAND_CURVE, BT_REV_BAND } from "./ballTrack";
import { wavefrontBandParts, WAV_BAND_CURVE, WAV_REV_BAND, WAV_REV_SHAPES } from "./wavefront";
import { flipBandParts, FLIP_BAND_CURVE, FLIP_REV_BAND } from "./flip";
import { inkBridgeBandParts, INK_BAND_CURVE, INK_REV_BAND } from "./inkBridge";
import { matchupBandParts, MATCHUP_BAND_CURVE, MATCHUP_REV_BAND } from "./matchup";
import { bubbleBandParts, BUB_BAND_CURVE, BUB_REV_BAND } from "./bubble";
import { crossBandParts, CROSS_BAND_CURVE, CROSS_REV_BAND } from "./cross";
import { rallyBandParts, RALLY_BAND_CURVE, RALLY_REV_BAND } from "./rally";
import { snakeBandParts, SNAKE_BAND_CURVE, SNAKE_REV_BAND } from "./snake";
import { binTossBandParts, BINTOSS_BAND_CURVE, BINTOSS_REV_BAND } from "./binToss";
import { snipBandParts, SNIP_BAND_CURVE, SNIP_REV_BAND } from "./snip";
import { hoverBandParts, HOVER_BAND_CURVE, HOVER_REV_BAND } from "./hover";
import { skylineBandParts, SKYLINE_BAND_CURVE, SKYLINE_REV_BAND } from "./skyline";
import { junctionBandParts, JUNC_BAND_CURVE, JUNC_REV_BAND } from "./junction";
import { breakerBandParts, BRK_BAND_CURVE, BRK_REV_BAND } from "./breaker";
import { tiltBandParts, TILT_BAND_CURVE, TILT_REV_BAND } from "./tilt";
import { orbitBandParts, ORBIT_BAND_CURVE } from "./orbitRev3";
import { ORBIT_REV_BAND, ORBIT_REV_TUNED } from "./orbit";
import { beatBandParts, BEAT_BAND_CURVE, BEAT_REV_BAND } from "./beat";
import { sliceBandParts, SLICE_BAND_CURVE, SLICE_REV_BAND } from "./slice";
import { burstBandParts, BURST_BAND_CURVE, BURST_REV_BAND } from "./burst";
import { swingBandParts, SWING_BAND_CURVE, SWING_REV_BAND, SWING_REV_TUNED } from "./swing";
import { bullseyeBandParts, BULLSEYE_BAND_CURVE, BULLSEYE_REV_BAND } from "./bullseye";

export interface BandSpec {
  parts: (state: any) => BandParts;
  curve: BandCurve;
  /** "finish": curve to 140 plus up to 10 for a full clear; "open": curve to 150. */
  kind: "finish" | "open";
  /**
   * Finish games whose finish is the last unit of the curve: the size of that
   * unit, and the optional extras (stars, hoops…) that share the curve, so a
   * check can compare one unit short with a finish at every extras count.
   * Absent where the finish is surviving the clock (Junction, Fission).
   */
  last?: { unit: number; extra: number; extras: number };
}

export const BAND_SPECS: Record<string, BandSpec> = {
  balltrack: { parts: btBandParts, curve: BT_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 0, extras: 0 } },
  wavefront: { parts: wavefrontBandParts, curve: WAV_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 0, extras: 0 } },
  flip: { parts: flipBandParts, curve: FLIP_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 3, extras: 10 } },
  inkbridge: { parts: inkBridgeBandParts, curve: INK_BAND_CURVE, kind: "finish", last: { unit: 10, extra: 2, extras: 4 } },
  matchup: { parts: matchupBandParts, curve: MATCHUP_BAND_CURVE, kind: "open" },
  bubble: { parts: bubbleBandParts, curve: BUB_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 0, extras: 0 } },
  cross: { parts: crossBandParts, curve: CROSS_BAND_CURVE, kind: "open" },
  rally: { parts: rallyBandParts, curve: RALLY_BAND_CURVE, kind: "open" },
  snake: { parts: snakeBandParts, curve: SNAKE_BAND_CURVE, kind: "open" },
  bintoss: { parts: binTossBandParts, curve: BINTOSS_BAND_CURVE, kind: "finish", last: { unit: 10, extra: 3, extras: 3 } },
  snip: { parts: snipBandParts, curve: SNIP_BAND_CURVE, kind: "finish", last: { unit: 10, extra: 2, extras: 10 } },
  hover: { parts: hoverBandParts, curve: HOVER_BAND_CURVE, kind: "finish", last: { unit: 3, extra: 2, extras: 10 } },
  skyline: { parts: skylineBandParts, curve: SKYLINE_BAND_CURVE, kind: "open" },
  junction: { parts: junctionBandParts, curve: JUNC_BAND_CURVE, kind: "finish" },
  breaker: { parts: breakerBandParts, curve: BRK_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 0, extras: 0 } },
  tilt: { parts: tiltBandParts, curve: TILT_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 5, extras: 8 } },
  orbit: { parts: orbitBandParts, curve: ORBIT_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 0, extras: 0 } },
  beat: { parts: beatBandParts, curve: BEAT_BAND_CURVE, kind: "open" },
  slice: { parts: sliceBandParts, curve: SLICE_BAND_CURVE, kind: "open" },
  burst: { parts: burstBandParts, curve: BURST_BAND_CURVE, kind: "finish" },
  swing: { parts: swingBandParts, curve: SWING_BAND_CURVE, kind: "finish", last: { unit: 1, extra: 5, extras: 10 } },
  bullseye: { parts: bullseyeBandParts, curve: BULLSEYE_BAND_CURVE, kind: "open" },
};

/**
 * The puzzle field and revision that stamp each game's score bands, then any
 * later revisions that changed play but still score on the same bands.
 */
export const BAND_STAMPS: Record<string, readonly [field: string, rev: number, ...later: number[]]> = {
  balltrack: ["btRev", BT_REV_BAND],
  wavefront: ["wavRev", WAV_REV_BAND, WAV_REV_SHAPES],
  flip: ["flipRev", FLIP_REV_BAND],
  inkbridge: ["inkRev", INK_REV_BAND],
  matchup: ["matchupRev", MATCHUP_REV_BAND],
  bubble: ["bubbleRev", BUB_REV_BAND],
  cross: ["crossRev", CROSS_REV_BAND],
  rally: ["rallyRev", RALLY_REV_BAND],
  snake: ["snakeRev", SNAKE_REV_BAND],
  bintoss: ["binRev", BINTOSS_REV_BAND],
  snip: ["snipRev", SNIP_REV_BAND],
  hover: ["hoverRev", HOVER_REV_BAND],
  skyline: ["skylineRev", SKYLINE_REV_BAND],
  junction: ["junctionRev", JUNC_REV_BAND],
  breaker: ["brkRev", BRK_REV_BAND],
  tilt: ["tiltRev", TILT_REV_BAND],
  orbit: ["orbitRev", ORBIT_REV_BAND, ORBIT_REV_TUNED],
  beat: ["beatRev", BEAT_REV_BAND],
  slice: ["sliceRev", SLICE_REV_BAND],
  burst: ["burstRev", BURST_REV_BAND],
  swing: ["swingRev", SWING_REV_BAND, SWING_REV_TUNED],
  bullseye: ["bullRev", BULLSEYE_REV_BAND],
};

/** True when a stored puzzle was dealt on the Oct 2026 score bands. */
export function puzzleUsesBands(puzzle: { type: string } & Record<string, unknown>): boolean {
  const stamp = BAND_STAMPS[puzzle.type];
  return Boolean(stamp && stamp.slice(1).includes(puzzle[stamp[0]] as number));
}
