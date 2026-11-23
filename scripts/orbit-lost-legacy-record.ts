/**
 * Records orbit-lost-check's legacy fixture (scripts/fixtures/orbit-lost-legacy.json.gz): Orbit runs on orbitRev 16 (the
 * stamp rooms dealt before orbitRev 17's lost flight, D5 item H4) at every level, on real deals (level-tune's `dealAt`:
 * Normal's fuel-bank course, each level's own bank), each graded by the server's own code (`gradeAnswer`), so the
 * check can prove orbitRev 17 left them exactly as they were: the same score, the same stored extra (its timing
 * diagnostics left out) and the same final checkpoint.
 *
 *   bun scripts/orbit-lost-legacy-record.ts        # recorded on polish/d5 6988eaa3, before orbitRev 17
 *
 * The players: the skill-band bot at weak, average, elite and the flawless level (under Joe's human limits,
 * scripts/d5-ladder-lib.ts `playDealt`), a seeded random tapper (missed flights that burn the tank, crashes, grace
 * respawns) and SET CHECKPOINT at once, then the random taps (the checkpoint's respawn). Run once; never re-record over it.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP } from "../src/lib/arcade/orbit";
import type { OrbitRev3State } from "../src/lib/arcade/orbitRev3";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { replayOrbitRun } from "../src/lib/duel/orbit";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

export const ORBIT_LOST_LEGACY = "scripts/fixtures/orbit-lost-legacy.json.gz";

export interface OrbitEv {
  t: number;
  k: number;
  a: number;
  b: number;
  c: number;
  d: number;
}
export interface OrbitLegacyRun {
  level: Level;
  n: number;
  kind: string;
  /** Index into the fixture's `puzzles` (one per deal). */
  p: number;
  raw: string;
  score: number;
  isCorrect: boolean;
  correctCount: number | null;
  /** The stored extra as JSON, its `diag` (replay timing) left out. */
  extra: string;
  checkpoint: unknown;
}
export interface OrbitLegacyFixture {
  recordedOn: string;
  puzzles: string[];
  runs: OrbitLegacyRun[];
}

/** The stored extra without its timing diagnostics (the replay's milliseconds vary run to run). */
export function stableExtra(extra: unknown): string {
  const e = { ...((extra ?? {}) as Record<string, unknown>) };
  delete e["diag"];
  return JSON.stringify(e);
}

const loose = (p: PuzzleData) => p as unknown as { seed: number; orbitRev?: number; level?: unknown };

/** Plays an event log on the puzzle's own game (as the phone does: checkpoints every 300 ticks) and encodes it. */
export function encodeEvents(puzzle: PuzzleData, events: readonly OrbitEv[]): { raw: string; state: OrbitRev3State } {
  const spec = GAME_BY_TYPE.get("orbit")!;
  const { seed, orbitRev } = loose(puzzle);
  const game = spec.gameForPuzzle!(puzzle);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as OrbitRev3State;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as OrbitRev3State;
    if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
  }
  const claimed = game.score(s);
  const body = { seed, claimedScore: claimed, events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints };
  return { raw: appendClientCounters(spec.encode(body, orbitRev ?? null, seed), arcadeCounters("orbit", s, claimed)), state: s };
}

/** A seeded random tapper: a tap every 40–120 ticks. */
export function randomEvents(seed: number): OrbitEv[] {
  let h = (seed * 2654435761) >>> 0;
  const out: OrbitEv[] = [];
  for (let t = 30; t < 5400; ) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    t += 40 + (h % 81);
    out.push({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
  }
  return out;
}

/** The final checkpoint of the server's replay of `raw` on the puzzle (replayOrbitRun, as gradeAnswer runs it). */
export function orbitFinalCheckpoint(puzzle: PuzzleData, raw: string): unknown {
  // As grade.ts replays it (the puzzle's own stored `level`, absent at Normal).
  const p = puzzle as unknown as { seed: number; orbitRev?: number; planets?: never; holes?: never; extras?: never; level?: unknown };
  return orbitCheckpoint(replayOrbitRun(p.seed, raw, p.orbitRev, p.planets, p.holes, p.extras, undefined, p.level).state as never);
}

if (import.meta.main) {
  const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
  const puzzles: string[] = [];
  const runs: OrbitLegacyRun[] = [];
  for (const level of LEVELS) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("orbit", level, n);
      if (loose(puzzle).orbitRev !== 16) throw new Error(`expected orbitRev 16, got ${loose(puzzle).orbitRev}`);
      if (puzzleLevel(puzzle) !== level) throw new Error(`expected level ${level}`);
      const p = puzzles.push(JSON.stringify(puzzle)) - 1;
      const add = (kind: string, raw: string) => {
        const g = gradeAnswer(puzzle, raw, 0);
        runs.push({ level, n, kind, p, raw, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount ?? null, extra: stableExtra(g.extra), checkpoint: orbitFinalCheckpoint(puzzle, raw) });
      };
      for (const skill of ["weak", "average", "elite", "perfect"] as const) add(skill, (await playDealt("orbit", puzzle, skill)).raw);
      const rnd = randomEvents(loose(puzzle).seed + n);
      add("random", encodeEvents(puzzle, rnd).raw);
      add("checkpoint", encodeEvents(puzzle, [{ t: 3, k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0, d: 0 }, ...rnd.slice(0, 20)]).raw);
    }
  }
  const out: OrbitLegacyFixture = { recordedOn: "polish/d5 6988eaa3 (orbitRev 16, before orbitRev 17)", puzzles, runs };
  writeFileSync(ORBIT_LOST_LEGACY, gzipSync(JSON.stringify(out)));
  console.log(`wrote ${runs.length} runs on ${puzzles.length} deals (scores ${runs.map((r) => r.score).join(" ")})`);
}
