/**
 * Records flip-ladder-check's legacy fixture (scripts/fixtures/flip-ladder-legacy.json.gz): Roofbound runs on flipRev 13
 * (the stamp every level deals before flipRev 14, D5 23 Nov 2026) at every level, on real deals (level-tune's `dealAt`),
 * each graded by the server's own code (`gradeAnswer`), so flip-ladder-check can prove flipRev 14 left them exactly as
 * they were: the same score, verdict, stored extra (its replay timing left out) and final checkpoint.
 *
 *   bun scripts/flip-ladder-legacy-record.ts      # recorded on polish/d5 428cd79a's sources, before flipRev 14
 *
 * The players: the skill-band bot at average, elite and the flawless level (all under Joe's human limits,
 * scripts/d5-ladder-lib.ts `playDealt`), the level's stored witness route on a level deal (the frame-exact planner,
 * scripts/fixtures/flip-levels-witness.json.gz; Normal has none) and a seeded random tapper. Run once; never re-record
 * over it.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { flipCheckpoint, flipGameFor, type FlipState } from "../src/lib/arcade/flip";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { flipTap } from "./flip-x200-plan";
import { readLevelWitnesses } from "./flip-level-deal";

export const FLIP_LADDER_LEGACY = "scripts/fixtures/flip-ladder-legacy.json.gz";

export interface FlipLegacyRun {
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
export interface FlipLegacyFixture {
  recordedOn: string;
  runs: FlipLegacyRun[];
}

/** The stored extra without its timing diagnostics (the replay's milliseconds vary run to run). */
export function stableFlipExtra(extra: unknown): string {
  const e = { ...((extra ?? {}) as Record<string, unknown>) };
  delete e["diag"];
  return JSON.stringify(e, (k, v) => (k === "replayMs" || k === "clientLag" ? undefined : v));
}

/** Encodes tap events played on the puzzle's own game (the phone's encoding, checkpoints every 300 ticks). */
export function encodeFlipEvents(puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): { raw: string; state: FlipState } {
  const p = puzzle as unknown as { seed: number; flipRev?: number };
  const game = flipGameFor(p.flipRev, puzzleLevel(puzzle));
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(p.seed);
  const checkpoints: ReturnType<typeof flipCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(flipCheckpoint(s));
  }
  const claimed = game.score(s);
  const raw = appendClientCounters(encodeFlipRun({ seed: p.seed, claimedScore: claimed, events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never), arcadeCounters("flip", s, claimed));
  return { raw, state: s };
}

/** A seeded random tapper: a tap every 12–70 ticks. */
export function flipRandomTaps(seed: number): ArcadeInputEvent[] {
  let h = (seed * 2654435761) >>> 0;
  const out: ArcadeInputEvent[] = [];
  for (let t = 10; t < 3600; ) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    t += 12 + (h % 59);
    out.push(flipTap(t));
  }
  return out;
}

/** The final checkpoint of the server's replay of `raw` on the puzzle (replayFlipRun, as gradeAnswer runs it). */
export function flipFinalCheckpoint(puzzle: PuzzleData, raw: string): unknown {
  const p = puzzle as unknown as { seed: number; flipRev?: number };
  return flipCheckpoint(replayFlipRun(p.seed, raw, p.flipRev, puzzleLevel(puzzle)).state);
}

if (import.meta.main) {
  const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
  const witnesses = readLevelWitnesses();
  const runs: FlipLegacyRun[] = [];
  const add = (level: Level, n: number, kind: string, puzzle: PuzzleData, raw: string) => {
    const g = gradeAnswer(puzzle, raw, 0);
    runs.push({ level, n, kind, puzzle: JSON.stringify(puzzle), raw, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount ?? null, extra: stableFlipExtra(g.extra), checkpoint: flipFinalCheckpoint(puzzle, raw) });
  };
  for (const level of LEVELS) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("flip", level, n);
      const p = puzzle as unknown as { seed: number; flipRev?: number };
      if (p.flipRev !== 13) throw new Error(`expected flipRev 13, got ${p.flipRev}`);
      for (const skill of ["average", "elite", "perfect"] as const) {
        const r = await playDealt("flip", puzzle, skill);
        add(level, n, skill, puzzle, r.raw);
      }
      const w = level === "normal" ? null : witnesses.find((x) => x.level === level && x.seed === p.seed);
      if (w?.taps) add(level, n, "witness", puzzle, encodeFlipEvents(puzzle, w.taps.map(flipTap)).raw);
      add(level, n, "random", puzzle, encodeFlipEvents(puzzle, flipRandomTaps(p.seed + n)).raw);
    }
    console.log(`${level}: ${runs.filter((r) => r.level === level).length} runs`);
  }
  const out: FlipLegacyFixture = { recordedOn: "polish/d5 428cd79a (flipRev 13 at every level, before flipRev 14)", runs };
  writeFileSync(FLIP_LADDER_LEGACY, gzipSync(JSON.stringify(out)));
  const at200 = runs.filter((r) => r.score >= 200).length;
  console.log(`wrote ${runs.length} runs (${at200} at 200, scores ${runs.map((r) => r.score).join(" ")})`);
}
