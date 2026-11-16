/** Home Run round plumbing (homerunRev 1, 2, 3 and 4): the server replays with the STORED seed and revision and keeps its own score. */

import {
  homerunCheckpoint,
  homerunGameFor,
  homerunSignCount,
  homerunStdParts,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_CHECKPOINT_KEYS,
  HOMERUN_REV_2,
  HOMERUN_REV_3,
  HOMERUN_REV_4,
  HOMERUN_REV_5,
  OUT_FAIR,
  OUT_HOMER,
  type HomerunCheckpoint,
  type HomerunState,
} from "@/lib/arcade/homerun";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";
import { hrLevelOf, HR5_HOMER, type Hr5Inn } from "@/lib/arcade/homerunInnings";

const runFor = (rev: number) =>
  makeArcadeRun<HomerunState, HomerunCheckpoint>({
    tag: "homerun",
    game: homerunGameFor(rev),
    checkpoint: homerunCheckpoint,
    keys: HOMERUN_CHECKPOINT_KEYS,
    interval: HOMERUN_CHECKPOINT_INTERVAL,
    emptyIsZero: true,
  });
const run = runFor(1);
const runV2 = runFor(HOMERUN_REV_2);
const runV3 = runFor(HOMERUN_REV_3);
const runV4 = runFor(HOMERUN_REV_4);
/** homerunRev 5's run at each level (the innings). */
const runsV5 = new Map<string, ReturnType<typeof runFor>>();
function runV5(level?: string | null) {
  const l = hrLevelOf(level);
  let r = runsV5.get(l);
  if (!r) {
    r = makeArcadeRun<HomerunState, HomerunCheckpoint>({
      tag: "homerun",
      game: homerunGameFor(HOMERUN_REV_5, l),
      checkpoint: homerunCheckpoint,
      keys: HOMERUN_CHECKPOINT_KEYS,
      interval: HOMERUN_CHECKPOINT_INTERVAL,
      emptyIsZero: true,
    });
    runsV5.set(l, r);
  }
  return r;
}

export interface HomerunResult extends FlatReplay<HomerunState, HomerunCheckpoint> {
  /** Carry (each pitch capped at 450 ft; rev 4 330 ft, caught balls none), home runs, signs struck (rev 4: lit bonus signs), pitches decided and the longest hit (feet). */
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

/**
 * The single place a Home Run score is worked out (each stored revision on its own game: 5 at the stored level, 4, 3,
 * 2, else rev 1, unchanged).
 */
export function replayHomerunRun(seed: number, raw: string, rev?: number | null, level?: string | null): HomerunResult {
  const r = rev ?? 1;
  if (r >= HOMERUN_REV_5) {
    const result = runV5(level).replay(seed, raw);
    const inn = result.state.inn as Hr5Inn;
    return {
      ...result,
      feet: inn.hits.reduce((t, h) => t + h.feet, 0),
      homers: inn.hits.filter((h) => h.out === HR5_HOMER).length,
      signs: 0,
      pitches: inn.hits.length,
      longest: inn.hits.reduce((m, h) => Math.max(m, h.out >= 6 ? h.feet : 0), 0),
      std: true,
      parts: homerunStdParts(result.state) ?? [],
    };
  }
  const result = (r >= HOMERUN_REV_4 ? runV4 : r >= HOMERUN_REV_3 ? runV3 : r >= HOMERUN_REV_2 ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    feet: s.feet,
    homers: s.hits.filter((h) => h.out === OUT_HOMER).length,
    signs: s.rev >= HOMERUN_REV_4 ? (s.bonus ?? 0) : homerunSignCount(s),
    pitches: s.hits.length,
    longest: s.hits.reduce((m, h) => Math.max(m, s.rev >= HOMERUN_REV_4 && h.out !== OUT_HOMER && h.out !== OUT_FAIR ? 0 : h.feet), 0),
    std: true,
    parts: homerunStdParts(s) ?? [],
  };
}
