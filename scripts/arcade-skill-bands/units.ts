/** Achievement units per game, read from a replayed final state: each sim's own score-band breakdown. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BandParts } from "../../src/lib/arcade/scoreBands";
import { btBandParts } from "../../src/lib/arcade/ballTrack";
import { wavefrontBandParts } from "../../src/lib/arcade/wavefront";
import { flipBandParts } from "../../src/lib/arcade/flip";
import { inkBridgeBandParts } from "../../src/lib/arcade/inkBridge";
import { matchupBandParts } from "../../src/lib/arcade/matchup";
import { bubbleBandParts } from "../../src/lib/arcade/bubble";
import { crossBandParts } from "../../src/lib/arcade/cross";
import { rallyBandParts } from "../../src/lib/arcade/rally";
import { snakeBandParts } from "../../src/lib/arcade/snake";
import { binTossBandParts } from "../../src/lib/arcade/binToss";
import { snipBandParts } from "../../src/lib/arcade/snip";
import { hoverBandParts } from "../../src/lib/arcade/hover";
import { skylineBandParts } from "../../src/lib/arcade/skyline";
import { junctionBandParts } from "../../src/lib/arcade/junction";
import { breakerBandParts } from "../../src/lib/arcade/breaker";
import { tiltBandParts } from "../../src/lib/arcade/tilt";
import { orbitBandParts } from "../../src/lib/arcade/orbitRev3";
import { beatBandParts } from "../../src/lib/arcade/beat";
import { sliceBandParts } from "../../src/lib/arcade/slice";
import { burstBandParts } from "../../src/lib/arcade/burst";
import { swingBandParts } from "../../src/lib/arcade/swing";
import { bullseyeBandParts } from "../../src/lib/arcade/bullseye";
import { pinballBandParts } from "../../src/lib/arcade/pinball";

export const BAND_PARTS: Record<string, (s: any) => BandParts> = {
  balltrack: btBandParts,
  wavefront: wavefrontBandParts,
  flip: flipBandParts,
  inkbridge: inkBridgeBandParts,
  matchup: matchupBandParts,
  bubble: bubbleBandParts,
  cross: crossBandParts,
  rally: rallyBandParts,
  snake: snakeBandParts,
  bintoss: binTossBandParts,
  snip: snipBandParts,
  hover: hoverBandParts,
  skyline: skylineBandParts,
  junction: junctionBandParts,
  breaker: breakerBandParts,
  tilt: tiltBandParts,
  orbit: orbitBandParts,
  beat: beatBandParts,
  slice: sliceBandParts,
  burst: burstBandParts,
  swing: swingBandParts,
  bullseye: bullseyeBandParts,
  pinball: pinballBandParts,
};

export const UNITS: Record<string, (s: any) => { u: number; finished: boolean }> = Object.fromEntries(
  Object.entries(BAND_PARTS).map(([type, parts]) => [type, (s: any) => { const p = parts(s); return { u: p.units, finished: p.finished }; }]),
);
