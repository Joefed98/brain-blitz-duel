/** Sort Rush round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  sortCheckpoint,
  sortRushGame,
  SORT_CHECKPOINT_INTERVAL,
  SORT_CHECKPOINT_KEYS,
  type SortCheckpoint,
  type SortState,
} from "@/lib/arcade/sortRush";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<SortState, SortCheckpoint>({
  tag: "sortrush",
  game: sortRushGame,
  checkpoint: sortCheckpoint,
  keys: SORT_CHECKPOINT_KEYS,
  interval: SORT_CHECKPOINT_INTERVAL,
});

export interface SortRushResult extends FlatReplay<SortState, SortCheckpoint> {
  sorted: number;
  wrong: number;
  total: number;
  survived: boolean;
  survivedSeconds: number;
}

export const encodeSortRushRun = run.encode;
export const decodeSortRushRun = run.decode;

/** The single place a Sort Rush score is worked out. */
export function replaySortRushRun(seed: number, raw: string): SortRushResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    sorted: s.sorted,
    wrong: s.wrong,
    total: s.shapes.length,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
  };
}
