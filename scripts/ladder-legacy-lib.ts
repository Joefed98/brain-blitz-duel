/**
 * D5's ladder legacy fixtures for Meteor and Rally (23 Nov 2026): runs on the stamps rooms deal before the D5 ladders
 * (snakeRev 15 and rallyRev 13, at every level, plus a few runs on older stamps), each stored with the dealt puzzle, the
 * answer the phone sends, the server's whole grade (score, verdict and extra, the replay's timing aside) and the final
 * checkpoint of the server's replay. Recorded once, before any sim change (scripts/snake-ladder-legacy-record.ts,
 * scripts/rally-ladder-legacy-record.ts); the game's ladder check replays every run and fails on any difference.
 *
 * A script library, not a check.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync, gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { decodeInputEvents, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { playDealt, revOf } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

export interface LadderLegacyRun {
  level: Level;
  /** The deal index (level-tune's room seed n), or -1 for a puzzle built here (an older stamp). */
  n: number;
  kind: string;
  puzzle: PuzzleData;
  raw: string;
  score: number;
  isCorrect: boolean;
  /** The grade's extra as JSON, the replay's own timing and lag fields left out (they measure the machine). */
  extra: string;
  /** The final checkpoint of the game played from the stored log (the phone's own sim), as JSON. */
  checkpoint: string;
}
export interface LadderLegacyFixture {
  game: string;
  recordedOn: string;
  runs: LadderLegacyRun[];
}

/** The grade's extra without the fields that measure the machine rather than the run. */
export function stableExtraOf(extra: unknown): string {
  return JSON.stringify(extra ?? null, (k, v) => (k === "replayMs" || k === "clientLag" || k === "diag" ? undefined : v));
}

/** Plays an event log on the puzzle's own game (the phone's encoding, checkpoints every 300 ticks). */
export function playEvents(type: PuzzleType, puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): { raw: string; checkpoint: unknown } {
  const spec = GAME_BY_TYPE.get(type)!;
  const loose = puzzle as unknown as Record<string, unknown>;
  const seed = Number(loose["seed"] ?? 0);
  const rev = revOf(type, puzzle);
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % (spec.checkpointEvery ?? 300) === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events: [...events], inputs: [], taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, claimed));
  return { raw, checkpoint: spec.checkpoint(state) };
}

/** The final checkpoint of a stored log played on the puzzle's game (the events decoded from the answer). */
export function finalCheckpoint(type: PuzzleType, puzzle: PuzzleData, raw: string): string {
  // Meteor and Rally encode `seed|claimed|events|…`: the events are the third field.
  const events = decodeInputEvents((String(raw).split("~")[0] ?? "").split("|")[2] ?? "");
  return JSON.stringify(playEvents(type, puzzle, events).checkpoint);
}

/** A seeded event stream (mulberry32): `pick(rand, t)` returns an event or null each tick. */
export function seededEvents(seed: number, ticks: number, pick: (rand: () => number, t: number) => Omit<ArcadeInputEvent, "t"> | null): ArcadeInputEvent[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: ArcadeInputEvent[] = [];
  for (let t = 1; t <= ticks; t++) {
    const e = pick(rand, t);
    if (e) out.push({ ...e, t });
  }
  return out;
}

export interface LegacyPlan {
  type: PuzzleType;
  /** The stamp today's deal must carry (a guard: the fixture is recorded on today's code). */
  dealtRev: number;
  levels: readonly Level[];
  deals: number;
  /** Older stamps played on built puzzles (Normal only): [stamp, deals]. */
  older: readonly [number, number][];
  random: (seed: number) => ArcadeInputEvent[];
}

export async function recordLegacy(plan: LegacyPlan, file: string, recordedOn: string): Promise<LadderLegacyFixture> {
  const runs: LadderLegacyRun[] = [];
  const add = (level: Level, n: number, kind: string, puzzle: PuzzleData, raw: string) => {
    const g = gradeAnswer(puzzle, raw, 0);
    runs.push({ level, n, kind, puzzle, raw, score: g.score, isCorrect: g.isCorrect, extra: stableExtraOf(g.extra), checkpoint: finalCheckpoint(plan.type, puzzle, raw) });
  };
  const playAll = async (level: Level, n: number, puzzle: PuzzleData) => {
    for (const skill of ["weak", "average", "elite", "perfect"] as const) {
      const r = await playDealt(plan.type, puzzle, skill);
      add(level, n, skill, puzzle, r.raw);
    }
    const seed = Number((puzzle as any).seed ?? 0);
    add(level, n, "random", puzzle, playEvents(plan.type, puzzle, plan.random(seed + n)).raw);
  };
  for (const level of plan.levels) {
    for (let n = 0; n < plan.deals; n++) {
      const puzzle = dealAt(plan.type, level, 7_000 + n);
      if (revOf(plan.type, puzzle) !== plan.dealtRev) throw new Error(`${plan.type} ${level}: expected stamp ${plan.dealtRev}, got ${revOf(plan.type, puzzle)}`);
      if (puzzleLevel(puzzle) !== level) throw new Error(`${plan.type}: asked ${level}, dealt ${puzzleLevel(puzzle)}`);
      await playAll(level, 7_000 + n, puzzle);
    }
  }
  const field = (await import("../src/lib/arcade/liveBands")).LIVE_BANDS[plan.type as never] as { field: string };
  for (const [rev, deals] of plan.older) {
    for (let n = 0; n < deals; n++) {
      const seed = 1_000_003 * (n + 1) + rev * 7919;
      const puzzle = { type: plan.type, seed, [field.field]: rev } as unknown as PuzzleData;
      await playAll("normal", -1, puzzle);
    }
  }
  const fixture: LadderLegacyFixture = { game: plan.type, recordedOn, runs };
  writeFileSync(file, gzipSync(JSON.stringify(fixture)));
  return fixture;
}

export function readLegacy(file: string): LadderLegacyFixture {
  return JSON.parse(gunzipSync(readFileSync(file)).toString()) as LadderLegacyFixture;
}

/** Replays every stored run: each must grade and checkpoint exactly as recorded. Returns [ok, label] lines. */
export function replayLegacy(file: string): [boolean, string][] {
  const f = readLegacy(file);
  const out: [boolean, string][] = [];
  let same = 0;
  for (const r of f.runs) {
    const g = gradeAnswer(r.puzzle, r.raw, 0);
    const cp = finalCheckpoint(f.game as PuzzleType, r.puzzle, r.raw);
    const okRun = g.score === r.score && g.isCorrect === r.isCorrect && stableExtraOf(g.extra) === r.extra && cp === r.checkpoint;
    if (okRun) same++;
    else out.push([false, `${f.game} ${r.level} ${r.kind} n=${r.n}: ${r.score} → ${g.score}${stableExtraOf(g.extra) === r.extra ? "" : " (extra differs)"}${cp === r.checkpoint ? "" : " (checkpoint differs)"}`]);
  }
  out.push([same === f.runs.length && f.runs.length > 0, `${f.game}: ${same} of ${f.runs.length} legacy runs (${f.recordedOn}) grade and checkpoint exactly as recorded`]);
  return out;
}
