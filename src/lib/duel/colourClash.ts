import { clashCheckpoint, colourClashGame, CLASH_CHECKPOINT_INTERVAL, CLASH_CHECKPOINT_KEYS, type ClashCheckpoint, type ClashState } from "@/lib/arcade/colourClash";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<ClashState, ClashCheckpoint>({ tag: "stroop", game: colourClashGame, checkpoint: clashCheckpoint, keys: CLASH_CHECKPOINT_KEYS, interval: CLASH_CHECKPOINT_INTERVAL });
export const encodeColourClashRun = run.encode;
export const decodeColourClashRun = run.decode;
export interface ColourClashResult extends FlatReplay<ClashState, ClashCheckpoint> { correct: number; wrong: number; missed: number; total: number }
export function replayColourClashRun(seed: number, raw: string): ColourClashResult {
  const result = run.replay(seed, raw);
  return { ...result, correct: result.state.correct, wrong: result.state.wrong, missed: result.state.missed, total: result.state.items.length };
}