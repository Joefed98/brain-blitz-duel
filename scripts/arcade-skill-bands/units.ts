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
import { pinball6BandParts } from "../../src/lib/arcade/pinball4";
import { minesBandParts } from "../../src/lib/arcade/minesweeper";
import { mahjongBandParts } from "../../src/lib/arcade/mahjong";
import { freecellBandParts } from "../../src/lib/arcade/cards/freecell";
import { tripeaksBandParts } from "../../src/lib/arcade/cards/tripeaks";
import { pokerSquaresBandParts } from "../../src/lib/arcade/cards/pokerSquares";
import { fiveHandsBandParts } from "../../src/lib/arcade/cards/fiveHands";
import { stdBandParts } from "../../src/lib/arcade/arcadeStandard";
import { minigolfStdParts, MINIGOLF_STD_SPEC } from "../../src/lib/arcade/minigolf";
import { STD_SPORTS } from "./sportsUnits";

import { homerunBandParts } from "../../src/lib/arcade/homerun";
import { freekickBandParts } from "../../src/lib/arcade/freekick";
import { racingBandParts } from "../../src/lib/arcade/racing";
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
  // pinRev 6 (the arcade scoring standard): table points without a multiplier, core and features from its parts.
  pinball: (s: any) => (s?.rev6 ? pinball6BandParts(s) : pinballBandParts(s)),
  // Cards & Board (30 Oct 2026): safe squares beyond the opening, and pairs.
  minesweeper: minesBandParts,
  mahjong: mahjongBandParts,
  homerun: homerunBandParts,
  freekick: freekickBandParts,
  racing: racingBandParts,
  freecell: freecellBandParts,
  tripeaks: tripeaksBandParts,
  pokersquares: pokerSquaresBandParts,
  fivehands: fiveHandsBandParts,
  // The Sports group (30 Oct 2026): units are the core's measure (holes holed, spots potted, stones on the button).
  minigolf: (s: any) => {
    const parts = minigolfStdParts(s) ?? [];
    const pts = (k: string) => parts.find((p) => p.key === k)?.points ?? 0;
    const holed = (s.holed as number[]).reduce((a, v) => a + v, 0);
    return stdBandParts(MINIGOLF_STD_SPEC, { core: pts("core"), features: { par: pts("par"), under: pts("under"), speed: pts("speed") }, penalty: 0 }, holed, `${holed} holed`, holed === 5);
  },
  ...STD_SPORTS,
};

export const UNITS: Record<string, (s: any) => { u: number; finished: boolean }> = Object.fromEntries(
  Object.entries(BAND_PARTS).map(([type, parts]) => [type, (s: any) => { const p = parts(s); return { u: p.units, finished: p.finished }; }]),
);
