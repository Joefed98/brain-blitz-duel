/** Home Run round plumbing (homerunRev 1 and 2): the server replays with the STORED seed and revision and keeps its own score. */

import {
  homerunCheckpoint,
  homerunGameFor,
  homerunSignCount,
  homerunStdParts,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_CHECKPOINT_KEYS,
  HOMERUN_REV_2,
  OUT_HOMER,
  type HomerunCheckpoint,
  type HomerunState,
} from "@/lib/arcade/homerun";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const runFor = (rev: number) =>
  makeArcadeRun<HomerunState, HomerunCheckpoint>({
    tag: "homerun",
    game: homerunGameFor(rev),
    checkpoint: homerunCheckpoint,
    keys: HOMERUN_CHECKPOINT_KEYS,
    interval: HOMERUN_CHECKPOINT_INTERVAL,
  });
const run = runFor(1);
const runV2 = runFor(HOMERUN_REV_2);

export interface HomerunResult extends FlatReplay<HomerunState, HomerunCheckpoint> {
  /** Carry (each pitch capped at 450 ft), home runs, signs struck, pitches decided and the longest hit (feet). */
  feet: number;
  homers: number;
  signs: number;
  pitches: number;
  longest: number;
  std: true;
  parts: StdPart[];
}

export const encodeHomerunRun = run.encode;
export const decodeHomerunRun = run.decode;

/** The single place a Home Run score is worked out (rev 2 on a rev-2 puzzle, else rev 1, unchanged). */
export function replayHomerunRun(seed: number, raw: string, rev?: number | null): HomerunResult {
  const result = ((rev ?? 1) >= HOMERUN_REV_2 ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    feet: s.feet,
    homers: s.hits.filter((h) => h.out === OUT_HOMER).length,
    signs: homerunSignCount(s),
    pitches: s.hits.length,
    longest: s.hits.reduce((m, h) => Math.max(m, h.feet), 0),
    std: true,
    parts: homerunStdParts(s) ?? [],
  };
}
