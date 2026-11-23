/**
 * Records blockfall-ladder-check's legacy fixture (scripts/fixtures/blockfall-ladder-legacy.json.gz): Blockzone runs on
 * the stamps rooms dealt before blockfallRev 3 (D5's ladder, 23 Nov 2026: the level deals' new stamp), so the check can
 * prove blockfallRev 3 left them exactly as they were: the same score, the same stored extra (its replay timing left
 * out) and the same final checkpoint.
 *
 *  - blockfallRev 2 at every level (Normal, Easy, Hard, Expert as dealt before blockfallRev 3: level-tune's `dealAt`),
 *    six deals a level, played by the skill-band bot at weak, average and elite (under Joe's human limits,
 *    scripts/d5-ladder-lib.ts `playDealt`), the flawless level (the oracle, scripts/blockfall-oracle.ts) and a seeded
 *    random player (moves, turns, soft drops and hard drops at random);
 *  - blockfallRev 1 at Normal (the first rules, hold and 60 s), three seeds of its own proved deal, the average and
 *    elite players and the random player.
 *
 *   bun scripts/blockfall-ladder-legacy-record.ts        # recorded on polish/d5 428cd79a, before blockfallRev 3
 *
 * Run once; never re-record over it.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { bfCheckpoint, blockfallGameFor, BF_INPUT_DOWN, BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_INPUT_SOFT, BF_INPUT_TURN, type BfState } from "../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../src/lib/duel/blockfall";
import { BLOCKFALL_DEAL } from "../src/lib/duel/blockfallDeal.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

export const BLOCKFALL_LADDER_LEGACY = "scripts/fixtures/blockfall-ladder-legacy.json.gz";

export interface BlockfallLegacyRun {
  level: Level;
  rev: number;
  n: number;
  kind: string;
  puzzle: string;
  raw: string;
  score: number;
  isCorrect: boolean;
  /** The stored extra as JSON, the replay's own timing left out. */
  extra: string;
  checkpoint: unknown;
}
export interface BlockfallLegacyFixture {
  recordedOn: string;
  runs: BlockfallLegacyRun[];
}

/** The stored extra without the fields that measure the machine rather than the run. */
export function stableExtra(extra: unknown): string {
  return JSON.stringify(extra ?? null, (k, v) => (k === "replayMs" || k === "clientLag" || k === "diag" ? undefined : v));
}

/** Plays an event list on the puzzle's own game and encodes it as the phone does (checkpoints every 300 ticks). */
export function encodeEvents(puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): string {
  const p = puzzle as unknown as { seed: number; blockfallRev?: number };
  const game = blockfallGameFor(p.blockfallRev, puzzleLevel(puzzle));
  const at = new Map(events.map((e) => [e.t, e]));
  let s: BfState = game.init(p.seed);
  const checkpoints: ReturnType<typeof bfCheckpoint>[] = [];
  const used: ArcadeInputEvent[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const ev = at.get(s.tick + 1) ?? null;
    if (ev) used.push(ev);
    s = game.step(s, ev);
    if (s.tick % 300 === 0) checkpoints.push(bfCheckpoint(s));
  }
  const claimed = game.score(s);
  return appendClientCounters(encodeBlockfallRun({ seed: p.seed, claimedScore: claimed, events: used, endTick: s.tick, checkpoints }), arcadeCounters("blockfall", s, claimed));
}

/** A seeded random player: a gesture every 8–40 ticks (a move of −4…4, a turn, a soft drop on or off, a hard drop). */
export function randomBlockfallEvents(seed: number, runTicks: number, rev: number): ArcadeInputEvent[] {
  let h = (seed * 2654435761) >>> 0;
  const next = (m: number) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    return h % m;
  };
  const out: ArcadeInputEvent[] = [];
  for (let t = 10; ; ) {
    t += 8 + next(33);
    if (t >= runTicks) break;
    const roll = next(10);
    const ev = (k: number, a: number) => out.push({ t, k, a, b: 0, c: 0, d: 0 });
    if (roll < 4) ev(BF_INPUT_MOVE, next(9) - 4 || 1);
    else if (roll < 6) ev(BF_INPUT_TURN, next(2) ? 1 : -1);
    else if (roll < 7) ev(rev >= 2 ? BF_INPUT_SOFT : BF_INPUT_DOWN, rev >= 2 ? next(2) : 0);
    else if (roll < 8) ev(rev >= 2 ? BF_INPUT_DOWN : BF_INPUT_HOLD, 0);
    else ev(BF_INPUT_DROP, 0);
  }
  return out;
}

/** The final checkpoint of the server's replay of `raw` on the puzzle (replayBlockfallRun, as gradeAnswer runs it). */
export function blockfallFinalCheckpoint(puzzle: PuzzleData, raw: string): unknown {
  const p = puzzle as unknown as { seed: number; blockfallRev?: number };
  return bfCheckpoint(replayBlockfallRun(p.seed, raw, p.blockfallRev, puzzleLevel(puzzle)).state);
}

if (import.meta.main) {
  const runs: BlockfallLegacyRun[] = [];
  const add = (level: Level, n: number, kind: string, puzzle: PuzzleData, raw: string) => {
    const g = gradeAnswer(puzzle, raw, 0);
    const rev = (puzzle as unknown as { blockfallRev?: number }).blockfallRev ?? 1;
    runs.push({ level, rev, n, kind, puzzle: JSON.stringify(puzzle), raw, score: g.score, isCorrect: g.isCorrect, extra: stableExtra(g.extra), checkpoint: blockfallFinalCheckpoint(puzzle, raw) });
  };
  for (const level of ["normal", "easy", "hard", "expert"] as Level[]) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("blockfall", level, n);
      const p = puzzle as unknown as { seed: number; blockfallRev?: number };
      if (p.blockfallRev !== 2) throw new Error(`expected blockfallRev 2, got ${p.blockfallRev}`);
      for (const skill of ["weak", "average", "elite", "perfect"] as const) add(level, n, skill, puzzle, (await playDealt("blockfall", puzzle, skill)).raw);
      add(level, n, "random", puzzle, encodeEvents(puzzle, randomBlockfallEvents(p.seed + n, blockfallGameFor(2, level).runTicks, 2)));
    }
  }
  for (let n = 0; n < 3; n++) {
    const puzzle = { type: "blockfall", seed: BLOCKFALL_DEAL[n * 7]!, blockfallRev: 1 } as unknown as PuzzleData;
    for (const skill of ["average", "elite"] as const) add("normal", n, skill, puzzle, (await playDealt("blockfall", puzzle, skill)).raw);
    add("normal", n, "random", puzzle, encodeEvents(puzzle, randomBlockfallEvents(n + 1, blockfallGameFor(1).runTicks, 1)));
  }
  const out: BlockfallLegacyFixture = { recordedOn: "polish/d5 428cd79a (blockfallRev 2 at every level and 1 at Normal, before blockfallRev 3)", runs };
  writeFileSync(BLOCKFALL_LADDER_LEGACY, gzipSync(JSON.stringify(out)));
  console.log(`wrote ${runs.length} runs (scores ${runs.map((r) => r.score).join(" ")})`);
}
