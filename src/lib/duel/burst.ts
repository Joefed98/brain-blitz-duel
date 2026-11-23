/** Burst round plumbing: the server replays with the STORED seed and keeps its own score. */

import type { Level } from "@/lib/levels/levels";
import {
  burstCheckpoint,
  burstGame,
  burstGameFor,
  BURST_REV,
  BURST_REV_BAND,
  BURST_REV_TALL,
  BURST_REV_TARGET, BURST_REV_STRICT, BURST_REV_CLEAN, BURST_REV_CARRY, BURST_REV_STD, BURST_REV_AIM, BURST_REV_WIDE, BURST_REV_BIG, BURST_REV_SMALL,
  BURST_CHECKPOINT_INTERVAL,
  BURST_CHECKPOINT_KEYS,
  BURST_LIVES, burstLivesOf,
  type BurstCheckpoint,
  type BurstState,
} from "@/lib/arcade/burst";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGame,
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

const runV2 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});
/** Oct 2026 score-band revision. */
const runBand = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_BAND),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** Taller worlds batch 1 (burstRev 4): the 390 × 650 arena. */
const runTall = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_TALL),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});
/** burstRev 5 (scoring targets): burstRev 4 play on the lifted curve. */
const runTarget = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_TARGET),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});
const runStrict = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_STRICT),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 8 (the expansion, docs/expansions/e9.md): scheduled power-ups and golden atoms, clean waves, scored to 200. */
const runV8 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_CLEAN),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 9 (phone-test notes): power-ups carried by atoms, the bouncing golden atom, BURST shots, wave-clear bonus. */
const runV9 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_CARRY),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 10 (the arcade scoring standard): five waves, the golden atom hurts, straight-line parts to 200. */
const runV10 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_STD),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 11 (the scoring audit): burstRev 10's play, the last life not charged, wasted beams beyond one an atom cost. */
const runV11 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_AIM),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 12 (the Retro overhaul): burstRev 11's play, the wave-clear bonus running out at three times the quick time. */
const runV12 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_WIDE),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 13 (the Retro overhaul): burstRev 12's rules with bigger atoms. */
const runV13 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_BIG),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});

/** burstRev 13's runner at a level (stage 3 of the Retro overhaul): Normal's own, else one built on the level's game. */
const runV13ByLevel = new Map<string, typeof runV13>();
function runV13For(level?: Level | null): typeof runV13 {
  if (!level || level === "normal") return runV13;
  let r = runV13ByLevel.get(level);
  if (!r) {
    r = makeArcadeRun<BurstState, BurstCheckpoint>({ tag: "burst", game: burstGameFor(BURST_REV_BIG, level), checkpoint: burstCheckpoint, keys: BURST_CHECKPOINT_KEYS, interval: BURST_CHECKPOINT_INTERVAL });
    runV13ByLevel.set(level, r);
  }
  return r;
}

/** burstRev 14 (D5, 22 Nov 2026): burstRev 13's rules with the middle atoms, Normal's runner and one a level. */
const runV14 = makeArcadeRun<BurstState, BurstCheckpoint>({
  tag: "burst",
  game: burstGameFor(BURST_REV_SMALL),
  checkpoint: burstCheckpoint,
  keys: BURST_CHECKPOINT_KEYS,
  interval: BURST_CHECKPOINT_INTERVAL,
});
const runV14ByLevel = new Map<string, typeof runV14>();
function runV14For(level?: Level | null): typeof runV14 {
  if (!level || level === "normal") return runV14;
  let r = runV14ByLevel.get(level);
  if (!r) {
    r = makeArcadeRun<BurstState, BurstCheckpoint>({ tag: "burst", game: burstGameFor(BURST_REV_SMALL, level), checkpoint: burstCheckpoint, keys: BURST_CHECKPOINT_KEYS, interval: BURST_CHECKPOINT_INTERVAL });
    runV14ByLevel.set(level, r);
  }
  return r;
}

export interface BurstResult extends FlatReplay<BurstState, BurstCheckpoint> {
  wave: number;
  hits: number;
  cleared: number;
  lives: number;
  livesLost: number;
  survived: boolean;
  survivedSeconds: number;
  /** burstRev 2: FREEZE icons caught (0 on original rounds). */
  freezes: number;
}

export const encodeBurstRun = run.encode;
export const decodeBurstRun = run.decode;

/** The single place a Burst score is worked out. */
export function replayBurstRun(seed: number, raw: string, rev?: number | null, level?: Level | null): BurstResult {
  const result = (rev === BURST_REV_SMALL ? runV14For(level) : rev === BURST_REV_BIG ? runV13For(level) : rev === BURST_REV_WIDE ? runV12 : rev === BURST_REV_AIM ? runV11 : rev === BURST_REV_STD ? runV10 : rev === BURST_REV_CARRY ? runV9 : rev === BURST_REV_CLEAN ? runV8 : rev === BURST_REV_STRICT ? runStrict : rev === BURST_REV_TARGET ? runTarget : rev === BURST_REV_TALL ? runTall : rev === BURST_REV_BAND ? runBand : rev === BURST_REV ? runV2 : run).replay(seed, raw);
  const s = result.state;
  return {
    ...result,
    wave: s.wave,
    hits: s.hits,
    cleared: s.cleared,
    lives: s.lives,
    livesLost: burstLivesOf(s) - s.lives,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
    freezes: s.freezes ?? 0,
  };
}
