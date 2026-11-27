/**
 * Records skyline-rev12-check's legacy fixture (scripts/fixtures/skyline-rev12-legacy.json.gz): High Rise runs on
 * skylineRev 11 (the stamp rooms dealt before skylineRev 12, D5 item I5) at every level, on real deals (level-tune's
 * `dealAt`), each graded by the server's own code (`gradeAnswer`), so the check can prove skylineRev 12 left them
 * exactly as they were: the same score, the same stored extra (its timing diagnostics left out) and the same final
 * checkpoint.
 *
 *   bun scripts/skyline-rev12-legacy-record.ts        # recorded on polish/d5 6988eaa3, before skylineRev 12
 *
 * The players: the skill-band bot at weak, average, elite and the flawless level (all under Joe's human limits,
 * scripts/d5-ladder-lib.ts `playDealt`), the frame-exact oracle (scripts/skyline-oracle.ts, unlimited: its runs reach
 * 200) and a seeded random tapper (misses, so lives are lost). Run once; never re-record over it.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { skylineCheckpoint, skylineGameFor, type SkylineState } from "../src/lib/arcade/skyline";
import { encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { skylineOracle } from "./skyline-oracle";

export const SKYLINE_REV12_LEGACY = "scripts/fixtures/skyline-rev12-legacy.json.gz";

export interface SkylineLegacyRun {
  level: Level;
  n: number;
  kind: string;
  puzzle: string;
  raw: string;
  score: number;
  isCorrect: boolean;
  correctCount: number | null;
  /** The stored extra as JSON, its `diag` (replay timing) left out. */
  extra: string;
  checkpoint: unknown;
}
export interface SkylineLegacyFixture {
  recordedOn: string;
  runs: SkylineLegacyRun[];
}

/** The stored extra without its timing diagnostics (the replay's milliseconds vary run to run). */
export function stableExtra(extra: unknown): string {
  const e = { ...((extra ?? {}) as Record<string, unknown>) };
  delete e["diag"];
  return JSON.stringify(e);
}

/** Encodes a tap list played on the puzzle's own game (the phone's encoding, checkpoints every 300 ticks). */
export function encodeTaps(puzzle: PuzzleData, taps: readonly number[]): { raw: string; state: SkylineState } {
  const p = puzzle as unknown as { seed: number; skylineRev?: number };
  const game = skylineGameFor(p.skylineRev, puzzleLevel(puzzle));
  const set = new Set(taps);
  let s = game.init(p.seed);
  const checkpoints: ReturnType<typeof skylineCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, set.has(s.tick + 1));
    if (s.tick % 300 === 0) checkpoints.push(skylineCheckpoint(s));
  }
  const claimed = game.score(s);
  const raw = appendClientCounters(encodeSkylineRun({ seed: p.seed, claimedScore: claimed, inputs: [...taps], endTick: s.tick, checkpoints }), arcadeCounters("skyline", s, claimed));
  return { raw, state: s };
}

/** A seeded random tapper: a tap every 20–90 ticks. */
export function randomTaps(seed: number): number[] {
  let h = (seed * 2654435761) >>> 0;
  const taps: number[] = [];
  for (let t = 10; t < 3600; ) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    t += 20 + (h % 71);
    taps.push(t);
  }
  return taps;
}

if (import.meta.main) {
  const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
  const runs: SkylineLegacyRun[] = [];
  const add = (level: Level, n: number, kind: string, puzzle: PuzzleData, raw: string) => {
    const g = gradeAnswer(puzzle, raw, 0);
    runs.push({ level, n, kind, puzzle: JSON.stringify(puzzle), raw, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount ?? null, extra: stableExtra(g.extra), checkpoint: skylineFinalCheckpoint(puzzle, raw) });
  };
  for (const level of LEVELS) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("skyline", level, n);
      const p = puzzle as unknown as { seed: number; skylineRev?: number };
      if (p.skylineRev !== 11) throw new Error(`expected skylineRev 11, got ${p.skylineRev}`);
      for (const skill of ["weak", "average", "elite", "perfect"] as const) {
        const r = await playDealt("skyline", puzzle, skill);
        add(level, n, skill, puzzle, r.raw);
      }
      const game = skylineGameFor(p.skylineRev, puzzleLevel(puzzle));
      add(level, n, "oracle", puzzle, encodeTaps(puzzle, skylineOracle(game, p.seed).taps).raw);
      add(level, n, "random", puzzle, encodeTaps(puzzle, randomTaps(p.seed + n)).raw);
    }
  }
  const out: SkylineLegacyFixture = { recordedOn: "polish/d5 6988eaa3 (skylineRev 11, before skylineRev 12)", runs };
  writeFileSync(SKYLINE_REV12_LEGACY, gzipSync(JSON.stringify(out)));
  const at200 = runs.filter((r) => r.score >= 200).length;
  console.log(`wrote ${runs.length} runs (${at200} at 200, scores ${runs.map((r) => r.score).join(" ")})`);
}

/** The final checkpoint of the server's replay of `raw` on the puzzle (replaySkylineRun, as gradeAnswer runs it). */
export function skylineFinalCheckpoint(puzzle: PuzzleData, raw: string): unknown {
  const p = puzzle as unknown as { seed: number; skylineRev?: number };
  return skylineCheckpoint(replaySkylineRun(p.seed, raw, p.skylineRev, puzzleLevel(puzzle)).state);
}
