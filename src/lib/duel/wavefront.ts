/** Wavefront round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  wavCheckpoint,
  wavefrontGame,
  WAV_CHECKPOINT_INTERVAL,
  WAV_CHECKPOINT_KEYS,
  type WavCheckpoint,
  type WavState,
} from "@/lib/arcade/wavefront";
import { makeArcadeRun, type FlatRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGame,
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

export type WavefrontRun = FlatRun<WavCheckpoint>;

export interface WavefrontResult extends FlatReplay<WavState, WavCheckpoint> {
  wave: number;
  shapesDown: number;
  saucers: number;
  wavesCleared: number;
  lives: number;
  survived: boolean;
}

export const encodeWavefrontRun = run.encode;
export const decodeWavefrontRun = run.decode;

/** The single place a Wavefront score is worked out. */
export function replayWavefrontRun(seed: number, raw: string): WavefrontResult {
  const result = run.replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    wave: s.wave,
    shapesDown: s.shapesDown,
    saucers: s.saucers,
    wavesCleared: s.wavesCleared,
    lives: s.lives,
    survived: s.ended !== 2,
  };
}
