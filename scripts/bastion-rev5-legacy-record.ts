/**
 * Records bastion-ladder-check's legacy fixture (scripts/fixtures/bastion-rev5-legacy.json.gz): Iron Wall runs on the
 * stamps rooms dealt before bastionRev 5 (D5's ladder, 23 Nov 2026): bastionRev 4 at Easy, Normal and Hard and
 * bastionRev 3 stamped "expert" at Expert, on real deals (level-tune's `dealAt`), each graded by the server's own code
 * (`gradeAnswer`), so the check can prove bastionRev 5 left them exactly as they were: the same score, the same stored
 * extra (its timing diagnostics left out) and the same final checkpoint.
 *
 *   bun scripts/bastion-rev5-legacy-record.ts        # recorded on polish/d5 428cd79a, before bastionRev 5
 *
 * The players: the skill-band bot at weak, average, good, elite and the flawless level (under Joe's human limits through
 * scripts/d5-ladder-lib.ts `playDealt`; the flawless level is the unlimited oracle, so its runs reach 200) and a seeded
 * random player (fires, reloads and taps at random). Run once; never re-record over it.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { bastionTankCheckpoint, bastionTankGameFor, type BastionTankState } from "../src/lib/arcade/bastionTank";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { encodeBastionTankRun, replayBastionTankRun } from "../src/lib/duel/bastion";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { BT2_INPUT_AIM, BT2_INPUT_FIRE, BT2_INPUT_RANGES, BT2_INPUT_RELOAD, BT2_INPUT_TAP, BT2_RUN_TICKS } from "../src/lib/arcade/bastionTank";

export const BASTION_REV5_LEGACY = "scripts/fixtures/bastion-rev5-legacy.json.gz";

export interface BastionLegacyRun {
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
export interface BastionLegacyFixture {
  recordedOn: string;
  runs: BastionLegacyRun[];
}

/** The stored extra without its timing diagnostics (the replay's milliseconds vary run to run). */
export function stableExtra(extra: unknown): string {
  const e = { ...((extra ?? {}) as Record<string, unknown>) };
  delete e["diag"];
  return JSON.stringify(e);
}

/** A log played on the puzzle's own game and encoded as the phone sends it (checkpoints every 300 ticks). */
export function encodeOn(puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): { raw: string; state: BastionTankState } {
  const p = puzzle as unknown as { seed: number; bastionRev?: number };
  const game = bastionTankGameFor(p.bastionRev, puzzleLevel(puzzle));
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(p.seed);
  const checkpoints: ReturnType<typeof bastionTankCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(bastionTankCheckpoint(s));
  }
  const claimed = game.score(s);
  const raw = appendClientCounters(encodeBastionTankRun({ seed: p.seed, claimedScore: claimed, events: [...events], endTick: s.tick, checkpoints }), arcadeCounters("bastion", s, claimed));
  return { raw, state: s };
}

/** A seeded random player: fires, reloads, taps and aims at random moments and places. */
export function randomEvents(seed: number): ArcadeInputEvent[] {
  let h = (seed * 2654435761) >>> 0;
  const next = (bound: number) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    h ^= h >>> 15;
    return h % bound;
  };
  const events: ArcadeInputEvent[] = [];
  for (let t = 20; t < BT2_RUN_TICKS; t += 8 + next(33)) {
    const r = next(100);
    const k = r < 60 ? BT2_INPUT_FIRE : r < 75 ? BT2_INPUT_TAP : r < 85 ? BT2_INPUT_RELOAD : BT2_INPUT_AIM;
    recordInput(events, { t, k, a: next(391), b: 250 + next(371), c: 0, d: 0 }, BT2_INPUT_RANGES);
  }
  return events;
}

/** The final checkpoint of the server's replay of `raw` on the puzzle (replayBastionTankRun, as gradeAnswer runs it). */
export function bastionFinalCheckpoint(puzzle: PuzzleData, raw: string): unknown {
  const p = puzzle as unknown as { seed: number; bastionRev?: number };
  return bastionTankCheckpoint(replayBastionTankRun(p.seed, raw, p.bastionRev, puzzleLevel(puzzle)).state);
}

if (import.meta.main) {
  const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
  const runs: BastionLegacyRun[] = [];
  const add = (level: Level, n: number, kind: string, puzzle: PuzzleData, raw: string) => {
    const g = gradeAnswer(puzzle, raw, 0);
    runs.push({ level, n, kind, puzzle: JSON.stringify(puzzle), raw, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount ?? null, extra: stableExtra(g.extra), checkpoint: bastionFinalCheckpoint(puzzle, raw) });
  };
  for (const level of LEVELS) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("bastion", level, n);
      const p = puzzle as unknown as { seed: number; bastionRev?: number };
      const want = level === "expert" ? 3 : 4;
      if (p.bastionRev !== want) throw new Error(`${level}: expected bastionRev ${want}, got ${p.bastionRev}`);
      for (const skill of ["weak", "average", "good", "elite", "perfect"] as const) {
        const r = await playDealt("bastion", puzzle, skill);
        add(level, n, skill, puzzle, r.raw);
      }
      add(level, n, "random", puzzle, encodeOn(puzzle, randomEvents(p.seed + n)).raw);
    }
  }
  const out: BastionLegacyFixture = { recordedOn: "polish/d5 428cd79a (bastionRev 4 at Easy, Normal and Hard, bastionRev 3 at Expert; before bastionRev 5)", runs };
  writeFileSync(BASTION_REV5_LEGACY, gzipSync(JSON.stringify(out)));
  const at200 = runs.filter((r) => r.score >= 200).length;
  console.log(`wrote ${runs.length} runs (${at200} at 200, scores ${runs.map((r) => r.score).join(" ")})`);
}
