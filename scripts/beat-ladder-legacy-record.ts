/**
 * Records beat-ladder-check's legacy fixture (scripts/fixtures/beat-ladder-legacy.json.gz): Tempo runs on the stamps
 * rooms dealt before beatRev 13 (D5's ladder, 23 Nov 2026), so the check can prove beatRev 13 left them exactly as they
 * were: the same score, the same stored extra (its replay timing left out) and the same final checkpoint.
 *
 *  - beatRev 12 at every level (Normal, Easy, Hard, Expert as dealt before beatRev 13: level-tune's `dealAt`), six
 *    deals a level, played by the skill-band bot at weak, average, elite and the flawless level (under Joe's human
 *    limits, scripts/d5-ladder-lib.ts `playDealt`) and a seeded random tapper (strays, misses, holds dropped);
 *  - beatRev 9, 10 and 11 at Normal (the older songs on the same chart builder), three seeds each, the average and
 *    elite players and the random tapper.
 *
 *   bun scripts/beat-ladder-legacy-record.ts        # recorded on polish/d5 428cd79a, before beatRev 13
 *
 * Run once; never re-record over it.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { beatCheckpoint, beatGameFor, BEAT_INPUT_RELEASE, BEAT_INPUT_TAP, type BeatState } from "../src/lib/arcade/beat";
import { encodeBeatRun, replayBeatRun } from "../src/lib/duel/beat";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

export const BEAT_LADDER_LEGACY = "scripts/fixtures/beat-ladder-legacy.json.gz";

export interface BeatLegacyRun {
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
export interface BeatLegacyFixture {
  recordedOn: string;
  runs: BeatLegacyRun[];
}

/** The stored extra without the fields that measure the machine rather than the run. */
export function stableExtra(extra: unknown): string {
  return JSON.stringify(extra ?? null, (k, v) => (k === "replayMs" || k === "clientLag" || k === "diag" ? undefined : v));
}

/** Plays an event list on the puzzle's own game and encodes it as the phone does (checkpoints every 300 ticks). */
export function encodeEvents(puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): string {
  const p = puzzle as unknown as { seed: number; beatRev?: number };
  const game = beatGameFor(p.beatRev, puzzleLevel(puzzle));
  const at = new Map(events.map((e) => [e.t, e]));
  let s: BeatState = game.init(p.seed);
  const checkpoints: ReturnType<typeof beatCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(beatCheckpoint(s));
  }
  const claimed = game.score(s);
  return appendClientCounters(encodeBeatRun({ seed: p.seed, claimedScore: claimed, events: [...events], endTick: s.tick, checkpoints }), arcadeCounters("beat", s, claimed));
}

/** A seeded random tapper: a touch in a random lane (0–4, inside every stamp's input range; a lane the song lacks yet is the sim's clamp) every 6–40 ticks, lifted 3–60 ticks later. */
export function randomBeatEvents(seed: number, runTicks: number): ArcadeInputEvent[] {
  let h = (seed * 2654435761) >>> 0;
  const next = (m: number) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    return h % m;
  };
  const byTick = new Map<number, ArcadeInputEvent>();
  for (let t = 20; t < runTicks - 5; ) {
    t += 6 + next(35);
    if (t >= runTicks) break;
    const lane = next(5);
    if (!byTick.has(t)) byTick.set(t, { t, k: BEAT_INPUT_TAP, a: lane, b: 0, c: 0, d: 0 });
    const up = t + 3 + next(58);
    if (up < runTicks && !byTick.has(up)) byTick.set(up, { t: up, k: BEAT_INPUT_RELEASE, a: lane, b: 0, c: 0, d: 0 });
  }
  return [...byTick.values()].sort((a, b) => a.t - b.t);
}

/** The final checkpoint of the server's replay of `raw` on the puzzle (replayBeatRun, as gradeAnswer runs it). */
export function beatFinalCheckpoint(puzzle: PuzzleData, raw: string): unknown {
  const p = puzzle as unknown as { seed: number; beatRev?: number };
  return beatCheckpoint(replayBeatRun(p.seed, raw, p.beatRev, puzzleLevel(puzzle)).state);
}

if (import.meta.main) {
  const runs: BeatLegacyRun[] = [];
  const add = (level: Level, n: number, kind: string, puzzle: PuzzleData, raw: string) => {
    const g = gradeAnswer(puzzle, raw, 0);
    const rev = (puzzle as unknown as { beatRev?: number }).beatRev ?? 0;
    runs.push({ level, rev, n, kind, puzzle: JSON.stringify(puzzle), raw, score: g.score, isCorrect: g.isCorrect, extra: stableExtra(g.extra), checkpoint: beatFinalCheckpoint(puzzle, raw) });
  };
  for (const level of ["normal", "easy", "hard", "expert"] as Level[]) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("beat", level, n);
      const p = puzzle as unknown as { seed: number; beatRev?: number };
      if (p.beatRev !== 12) throw new Error(`expected beatRev 12, got ${p.beatRev}`);
      for (const skill of ["weak", "average", "elite", "perfect"] as const) add(level, n, skill, puzzle, (await playDealt("beat", puzzle, skill)).raw);
      add(level, n, "random", puzzle, encodeEvents(puzzle, randomBeatEvents(p.seed + n, beatGameFor(p.beatRev, level).runTicks)));
    }
  }
  for (const rev of [9, 10, 11]) {
    for (let n = 0; n < 3; n++) {
      const base = dealAt("beat", "normal", 100 + n) as unknown as { seed: number };
      const puzzle = { type: "beat", seed: base.seed, beatRev: rev } as unknown as PuzzleData;
      for (const skill of ["average", "elite"] as const) add("normal", n, skill, puzzle, (await playDealt("beat", puzzle, skill)).raw);
      add("normal", n, "random", puzzle, encodeEvents(puzzle, randomBeatEvents(base.seed + rev, beatGameFor(rev).runTicks)));
    }
  }
  const out: BeatLegacyFixture = { recordedOn: "polish/d5 428cd79a (beatRev 12 at every level and 9–11 at Normal, before beatRev 13)", runs };
  writeFileSync(BEAT_LADDER_LEGACY, gzipSync(JSON.stringify(out)));
  console.log(`wrote ${runs.length} runs (scores ${runs.map((r) => r.score).join(" ")})`);
}
