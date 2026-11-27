/**
 * Shared helpers for Wavefront wavRev 16 (the wider formation, D5, 22 Nov 2026): the legacy fixture's run shape and the
 * digest of a run's replayed final state, read by scripts/wavefront-wide-legacy-record.ts and wavefront-wide-check.
 */
import { wavCheckpoint, type WavState } from "../src/lib/arcade/wavefront";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel } from "../src/lib/levels/levels";

export interface WavLegacyRun {
  label: string;
  /** The dealt (or built) puzzle the run was graded on: seed, wavRev and level. */
  puzzle: Record<string, unknown>;
  /** The encoded run the phone sends. */
  raw: string;
  /** The server's grade. */
  score: number;
  digest: string;
}

/** The server's replay of a run on its puzzle, reduced to a string: score, flag, final checkpoint checksum and counters. */
export function wavLegacyDigest(puzzle: PuzzleData, raw: string): string {
  const p = puzzle as unknown as { seed: number; wavRev?: number };
  const r = replayWavefrontRun(p.seed, raw, p.wavRev, puzzleLevel(puzzle));
  const s = r.state as WavState;
  const cp = wavCheckpoint(s) as unknown as { checksum: number };
  return [
    `score ${r.score}`,
    `flagged ${r.flagged ? 1 : 0}`,
    `tick ${s.tick}`,
    `ended ${s.ended}`,
    `checksum ${cp.checksum}`,
    `wave ${s.wave}`,
    `ships ${s.shapesDown}`,
    `armour ${s.armourHits}`,
    `saucers ${s.saucers}`,
    `cleared ${s.wavesCleared}`,
    `lives ${s.lives}`,
    `boss ${s.bossHits ?? 0}/${s.bossKilled ?? 0}`,
    `fx ${s.fx}`,
    `fy ${s.fy}`,
  ].join(" · ");
}
