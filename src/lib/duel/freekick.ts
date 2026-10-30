/** Free Kick round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  freekickCheckpoint,
  freekickGameFor,
  freekickStdParts,
  FK_OUT_GOAL,
  FK_OUT_UNTAKEN,
  FREEKICK_CHECKPOINT_INTERVAL,
  FREEKICK_CHECKPOINT_KEYS,
  FREEKICK_KICKS,
  type FreekickCheckpoint,
  type FreekickState,
} from "@/lib/arcade/freekick";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<FreekickState, FreekickCheckpoint>({
  tag: "freekick",
  game: freekickGameFor(1),
  checkpoint: freekickCheckpoint,
  keys: FREEKICK_CHECKPOINT_KEYS,
  interval: FREEKICK_CHECKPOINT_INTERVAL,
});

export interface FreekickResult extends FlatReplay<FreekickState, FreekickCheckpoint> {
  /** Goals scored, kicks taken, targets hit, goals curled round the wall, the best run of goals. */
  goals: number;
  taken: number;
  targets: number;
  curled: number;
  best: number;
  /** Per kick: its outcome (FK_OUT_*; −1 not reached). */
  outs: number[];
  /** All ten kicks taken. */
  finished: boolean;
  std: true;
  parts: StdPart[];
}

export const encodeFreekickRun = run.encode;
export const decodeFreekickRun = run.decode;

/** The single place a Free Kick score is worked out. */
export function replayFreekickRun(seed: number, raw: string, _rev?: number | null): FreekickResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  const taken = s.outs.filter((o) => o >= 0 && o !== FK_OUT_UNTAKEN).length;
  return {
    ...result,
    goals: s.outs.filter((o) => o === FK_OUT_GOAL).length,
    taken,
    targets: s.targets,
    curled: s.curled,
    best: s.best,
    outs: s.outs.slice(),
    finished: taken === FREEKICK_KICKS,
    std: true,
    parts: freekickStdParts(s) ?? [],
  };
}
