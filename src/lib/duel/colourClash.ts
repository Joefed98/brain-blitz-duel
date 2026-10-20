import { bandMapTotal } from "@/lib/arcade/scoreBands";
import { CLASH_BANDS_MAP, CLASH_GREAT_MAP, clashCheckpoint, clashRev4Finished, colourClashGameFor, CLASH_CHECKPOINT_INTERVAL, CLASH_CHECKPOINT_KEYS, type ClashCheckpoint, type ClashState } from "@/lib/arcade/colourClash";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const opts = { tag: "stroop", checkpoint: clashCheckpoint, keys: CLASH_CHECKPOINT_KEYS, interval: CLASH_CHECKPOINT_INTERVAL } as const;
const runs = [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => makeArcadeRun<ClashState, ClashCheckpoint>({ ...opts, game: colourClashGameFor(variant) }));
export const encodeColourClashRun = runs[3]!.encode;
export const decodeColourClashRun = runs[3]!.decode;
export interface ColourClashResult extends FlatReplay<ClashState, ClashCheckpoint> {
  correct: number; wrong: number; missed: number; total: number; queue: number; timeBonus: number; finished: boolean;
  /** clashRev 4 (puzzle score shape): the finish base (120) when the run finished, else 0; absent on older variants. */
  finishBase?: number;
  /** clashRev 5: words right less words wrong, the units of the unfinished credit; absent on older variants. */
  net?: number;
}
/** `variant` = clashVariantOf(stored puzzle): older rounds replay on their own rules. */
export function replayColourClashRun(seed: number, raw: string, variant: number): ColourClashResult {
  const result = (runs[variant] ?? runs[0]!).replay(seed, raw);
  const s = result.state;
  const total = s.queue > 0 ? s.queue : s.items.length;
  // The reveal's bonus is the part of the stored score the finish earned: the
  // score less the same run scored as unfinished, so it always matches the
  // curve the score used.
  // clashRev 4 scores a finish (all sorted, at most 2 wrong) as 120 + its speed part, so the bonus
  // is the score above 120; a run with more wrong gates is unfinished and has none.
  // clashRev 5 finishes the same way (its unfinished credit is net words right, `net`).
  if (variant === 4 || variant === 5 || variant === 6 || variant === 7) {
    const finished = clashRev4Finished(s.correct, s.wrong, s.queue, s.finishTick);
    // clashRev 6 (score bands): the finish base is 120 mapped through the bands, the bonus the score above it.
    const base = variant === 7 ? bandMapTotal(CLASH_GREAT_MAP, 120) : variant === 6 ? bandMapTotal(CLASH_BANDS_MAP, 120) : 120;
    return { ...result, correct: s.correct, wrong: s.wrong, missed: s.missed, total, queue: s.queue, timeBonus: finished ? Math.max(0, result.score - base) : 0, finished, finishBase: finished ? base : 0, ...(variant >= 5 ? { net: s.correct - s.wrong } : {}) };
  }
  const game = colourClashGameFor(variant);
  const timeBonus = s.finishTick > 0 ? Math.max(0, result.score - game.score({ ...s, finishTick: 0 })) : 0;
  return { ...result, correct: s.correct, wrong: s.wrong, missed: s.missed, total, queue: s.queue, timeBonus, finished: s.finishTick > 0 };
}
