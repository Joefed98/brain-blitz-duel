/** Flip round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  flipCheckpoint,
  flipGameFor,
  flipStarsTaken,
  FLIP_CHECKPOINT_INTERVAL,
  FLIP_REV,
  FLIP_REV_BAND,
  FLIP_REV_TUNEC,
  FLIP_REV_TARGET, FLIP_REV_STRICT, FLIP_REV_EXPAND, FLIP_REV_LIFT, FLIP_REV_STD, FLIP_REV_FLOW,
  flipStdFeatures,
  flipFlowFeatures,
  flipTrailStars,
  flipSweetsTaken,
  flipV8Features,
  FLIP_CHECKPOINT_KEYS,
  type FlipCheckpoint,
  type FlipState,
} from "@/lib/arcade/flip";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const runFor = (rev?: number | null) =>
  makeArcadeRun<FlipState, FlipCheckpoint>({
    tag: "flip",
    game: flipGameFor(rev),
    checkpoint: flipCheckpoint,
    keys: FLIP_CHECKPOINT_KEYS,
    interval: FLIP_CHECKPOINT_INTERVAL,
  });
const run = runFor(null);
const runV2 = runFor(FLIP_REV);
/** flipRev 3: rev-2 play on the Oct 2026 score bands. */
const runBand = runFor(FLIP_REV_BAND);
/** flipRev 4 (Tuning C): bend from 10 s, scored on FLIP_V4_BAND_CURVE. */
const runTunec = runFor(FLIP_REV_TUNEC);
/** flipRev 5 (scoring targets): flipRev 4 play on the lifted curve. */
const runTarget = runFor(FLIP_REV_TARGET);
const runStrict = runFor(FLIP_REV_STRICT);
/** flipRev 8 (the expansion): the taller cave with trails, combos, speed zones, checkpoints and sweet spots, scored to 200. A round stamped 7 (the parked expansion, never dealt) would replay as flipRev 6. */
const runExpand = runFor(FLIP_REV_EXPAND);
/** flipRev 9: flipRev 8's play on the lifted curves. */
const runLift = runFor(FLIP_REV_LIFT);
/** flipRev 10: flipRev 8's play on the arcade scoring standard (time 150 + gold stars, trails, sweet landings, double flips 50). */
const runStd = runFor(FLIP_REV_STD);
/** flipRev 11: flipRev 8's play with no star pickups, the flow streak counted, scored on clean time + perfect landings, double flips and the flow streak. */
const runFlow = runFor(FLIP_REV_FLOW);

export interface FlipResult extends FlatReplay<FlipState, FlipCheckpoint> {
  survived: boolean;
  survivedSeconds: number;
  /** flipRev 2: stars taken and on the course (0 / 0 on original rounds). */
  stars: number;
  starsTotal: number;
  /** flipRev 8: trail stars taken and on the course, double flips and saved crashes (0 on earlier rounds). */
  trailStars: number;
  trailTotal: number;
  combos: number;
  saves: number;
  /** flipRev 8: sweet landings and sweet spots on the course, and the skill points paid (0 on earlier rounds). */
  sweets: number;
  sweetsTotal: number;
  skill: number;
  /** flipRev 10: true, and `skill` is the standard's feature points (gold stars, trails, sweet landings, double flips). */
  std?: boolean;
  /** flipRev 11: true (with `std`), `skill` the features' points (perfect landings, double flips, flow streak) and `streak` the longest flow streak. */
  flow?: boolean;
  streak?: number;
}

export const encodeFlipRun = run.encode;
export const decodeFlipRun = run.decode;

/** The single place a Flip score is worked out. */
export function replayFlipRun(seed: number, raw: string, rev?: number | null): FlipResult {
  const result = (rev === FLIP_REV_FLOW ? runFlow : rev === FLIP_REV_STD ? runStd : rev === FLIP_REV_LIFT ? runLift : rev === FLIP_REV_EXPAND ? runExpand : rev === FLIP_REV_STRICT || rev === FLIP_REV_STRICT + 1 ? runStrict : rev === FLIP_REV_TARGET ? runTarget : rev === FLIP_REV_TUNEC ? runTunec : rev === FLIP_REV_BAND ? runBand : rev === FLIP_REV ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return { ...result, survived: s.ended !== 2, survivedSeconds: s.tick / 60, stars: flipStarsTaken(s), starsTotal: s.stars?.length ?? 0,
    trailStars: flipTrailStars(s).stars, trailTotal: (s.trailGot?.length ?? 0) * 5, combos: s.combos ?? 0, saves: s.saves ?? 0,
    sweets: flipSweetsTaken(s), sweetsTotal: s.v8?.sweets.length ?? 0, skill: s.flow ? flipFlowFeatures(s) : s.std ? flipStdFeatures(s) : s.exp ? flipV8Features(s).total : 0, ...(s.std ? { std: true } : {}),
    ...(s.flow ? { flow: true, streak: s.bestStreak ?? 0 } : {}) };
}
