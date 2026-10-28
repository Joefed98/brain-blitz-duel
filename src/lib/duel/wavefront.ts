/** Wavefront round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  wavCheckpoint,
  wavefrontGame,
  wavefrontGameFor,
  WAV_REV,
  WAV_REV_BAND,
  WAV_REV_SHAPES,
  WAV_REV_TUNEC,
  WAV_REV_TALL,
  WAV_REV_TARGET, WAV_REV_STRICT, WAV_REV_EXPAND, WAV_REV_PHONE,
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

const runV2 = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});
/** Oct 2026 score-band revision. */
const runBand = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_BAND),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

/** Tuning A: shaped formations for waves 2–5. */
const runShapes = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_SHAPES),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

/** Tuning C: slower drops on waves 3 and 4, the boss kill timed. */
const runTunec = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_TUNEC),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

/** Taller worlds batch 1 (wavRev 6): the 390 × 730 world. */
const runTall = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_TALL),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

/** Scoring targets (wavRev 7): wavRev 6 play on the gentler curve. */
const runTarget = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_TARGET),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});
const runStrict = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_STRICT),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

/** Expansion x200 (wavRev 10): the taller arena, longer waves, power-ups, streaks and boss weak points. */
const runExpand = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_EXPAND),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

/** Joe's phone notes (wavRev 11): power-ups from carriers and saucers, no streak, the mothership only after wave 5. */
const runPhone = makeArcadeRun<WavState, WavCheckpoint>({
  tag: "wavefront",
  game: wavefrontGameFor(WAV_REV_PHONE),
  checkpoint: wavCheckpoint,
  keys: WAV_CHECKPOINT_KEYS,
  interval: WAV_CHECKPOINT_INTERVAL,
});

export type WavefrontRun = FlatRun<WavCheckpoint>;

export interface WavefrontResult extends FlatReplay<WavState, WavCheckpoint> {
  wave: number;
  shapesDown: number;
  saucers: number;
  armourHits: number;
  wavesCleared: number;
  lives: number;
  survived: boolean;
  /** wavRev 2 (0 on original rounds): hits on the boss, 1 if destroyed, ships that rammed the player. */
  bossHits: number;
  bossKilled: number;
  rammed: number;
  /** wavRev 10 (0 on older rounds): best hit streak, open-core hits, cannons destroyed, power-ups caught, shield blocks. */
  bestStreak: number;
  weakHits: number;
  cannonsDown: number;
  powerups: number;
  shieldBlocks: number;
}

export const encodeWavefrontRun = run.encode;
export const decodeWavefrontRun = run.decode;

/** The single place a Wavefront score is worked out. */
export function replayWavefrontRun(seed: number, raw: string, rev?: number | null): WavefrontResult {
  const result = (rev === WAV_REV_PHONE ? runPhone : rev === WAV_REV_EXPAND ? runExpand : rev === WAV_REV_STRICT ? runStrict : rev === WAV_REV_TARGET ? runTarget : rev === WAV_REV_TALL ? runTall : rev === WAV_REV_TUNEC ? runTunec : rev === WAV_REV_SHAPES ? runShapes : rev === WAV_REV_BAND ? runBand : rev === WAV_REV ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    wave: s.wave,
    shapesDown: s.shapesDown,
    saucers: s.saucers,
    armourHits: s.armourHits,
    wavesCleared: s.wavesCleared,
    lives: s.lives,
    survived: s.ended !== 2,
    bossHits: s.bossHits ?? 0,
    bossKilled: s.bossKilled ?? 0,
    rammed: s.rammed ?? 0,
    bestStreak: s.bestStreak ?? 0,
    weakHits: s.weakHits ?? 0,
    cannonsDown: s.cannonsDown ?? 0,
    powerups: s.powerups ?? 0,
    shieldBlocks: s.shieldBlocks ?? 0,
  };
}
