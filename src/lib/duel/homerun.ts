/** Home Run Derby round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  homerunCheckpoint,
  homerunGameFor,
  homerunSignCount,
  homerunStdParts,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_CHECKPOINT_KEYS,
  OUT_HOMER,
  type HomerunCheckpoint,
  type HomerunState,
} from "@/lib/arcade/homerun";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<HomerunState, HomerunCheckpoint>({
  tag: "homerun",
  game: homerunGameFor(1),
  checkpoint: homerunCheckpoint,
  keys: HOMERUN_CHECKPOINT_KEYS,
  interval: HOMERUN_CHECKPOINT_INTERVAL,
});

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

/** The single place a Home Run Derby score is worked out. */
export function replayHomerunRun(seed: number, raw: string, _rev?: number | null): HomerunResult {
  const result = run.replay(seed, raw);
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
