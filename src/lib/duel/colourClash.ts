import { clashCheckpoint, colourClashGameFor, CLASH_CHECKPOINT_INTERVAL, CLASH_CHECKPOINT_KEYS, type ClashCheckpoint, type ClashState } from "@/lib/arcade/colourClash";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const opts = { tag: "stroop", checkpoint: clashCheckpoint, keys: CLASH_CHECKPOINT_KEYS, interval: CLASH_CHECKPOINT_INTERVAL } as const;
const runs = [0, 1, 2, 3].map((variant) => makeArcadeRun<ClashState, ClashCheckpoint>({ ...opts, game: colourClashGameFor(variant) }));
export const encodeColourClashRun = runs[3]!.encode;
export const decodeColourClashRun = runs[3]!.decode;
export interface ColourClashResult extends FlatReplay<ClashState, ClashCheckpoint> { correct: number; wrong: number; missed: number; total: number; queue: number; timeBonus: number; finished: boolean }
/** `variant` = clashVariantOf(stored puzzle): older rounds replay on their own rules. */
export function replayColourClashRun(seed: number, raw: string, variant: number): ColourClashResult {
  const result = (runs[variant] ?? runs[0]!).replay(seed, raw);
  const s = result.state;
  const total = s.queue > 0 ? s.queue : s.items.length;
  // The reveal's bonus is the part of the stored score the finish earned: the
  // score less the same run scored as unfinished, so it always matches the
  // curve the score used.
  const game = colourClashGameFor(variant);
  const timeBonus = s.finishTick > 0 ? Math.max(0, result.score - game.score({ ...s, finishTick: 0 })) : 0;
  return { ...result, correct: s.correct, wrong: s.wrong, missed: s.missed, total, queue: s.queue, timeBonus, finished: s.finishTick > 0 };
}
