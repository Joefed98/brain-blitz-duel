import { clashCheckpoint, clashTimeBonusOf, colourClashGameFor, CLASH_CHECKPOINT_INTERVAL, CLASH_CHECKPOINT_KEYS, CLASH_QUEUE, CLASH_QUEUE_V1, type ClashCheckpoint, type ClashState } from "@/lib/arcade/colourClash";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const opts = { tag: "stroop", checkpoint: clashCheckpoint, keys: CLASH_CHECKPOINT_KEYS, interval: CLASH_CHECKPOINT_INTERVAL } as const;
const legacy = makeArcadeRun<ClashState, ClashCheckpoint>({ ...opts, game: colourClashGameFor(null) });
const queued = makeArcadeRun<ClashState, ClashCheckpoint>({ ...opts, game: colourClashGameFor(CLASH_QUEUE) });
const queuedV1 = makeArcadeRun<ClashState, ClashCheckpoint>({ ...opts, game: colourClashGameFor(CLASH_QUEUE_V1) });
export const encodeColourClashRun = queued.encode;
export const decodeColourClashRun = queued.decode;
export interface ColourClashResult extends FlatReplay<ClashState, ClashCheckpoint> { correct: number; wrong: number; missed: number; total: number; queue: number; timeBonus: number; finished: boolean }
/** `queue` comes from the stored puzzle: unversioned rounds replay the legacy open stream. */
export function replayColourClashRun(seed: number, raw: string, queue?: number | null): ColourClashResult {
  const result = (queue === CLASH_QUEUE ? queued : queue === CLASH_QUEUE_V1 ? queuedV1 : legacy).replay(seed, raw);
  const s = result.state;
  const total = s.queue > 0 ? s.queue : s.items.length;
  return { ...result, correct: s.correct, wrong: s.wrong, missed: s.missed, total, queue: s.queue, timeBonus: clashTimeBonusOf(s), finished: s.finishTick > 0 };
}
