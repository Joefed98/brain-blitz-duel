/** Ball Track round plumbing: the server replays the log against the STORED course and keeps its own score. */

import {
  btCheckpoint,
  makeBallTrackGame,
  BT_BALLS,
  BT_CHECKPOINT_INTERVAL,
  BT_CHECKPOINT_KEYS,
  type BtCheckpoint,
  type BtCourse,
  type BtState,
} from "@/lib/arcade/ballTrack";
import { makeArcadeRun, type FlatReplay, type FlatRun } from "./arcadeRun";

const runFor = (course: BtCourse) =>
  makeArcadeRun<BtState, BtCheckpoint>({
    tag: "balltrack",
    game: makeBallTrackGame(course),
    checkpoint: btCheckpoint,
    keys: BT_CHECKPOINT_KEYS,
    interval: BT_CHECKPOINT_INTERVAL,
  });

export interface BallTrackResult extends FlatReplay<BtState, BtCheckpoint> {
  home: number;
  wrong: number;
  lost: number;
  released: number;
  actions: number;
  perfect: boolean;
  speed: number;
}

export function encodeBallTrackRun(course: BtCourse, run: FlatRun<BtCheckpoint>): string {
  return runFor(course).encode(run);
}

export function decodeBallTrackRun(course: BtCourse, raw: string): FlatRun<BtCheckpoint> {
  return runFor(course).decode(raw);
}

/** The single place a Ball Track score is worked out. */
export function replayBallTrackRun(course: BtCourse, seed: number, raw: string): BallTrackResult {
  const result = runFor(course).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    home: s.home,
    wrong: s.wrong,
    lost: s.lost,
    released: s.next,
    actions: s.actions,
    perfect: s.home === BT_BALLS,
    speed: btSpeedBonus(s.home, s.lastLand),
  };
}
