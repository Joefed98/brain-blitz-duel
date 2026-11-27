/**
 * The Logic overhaul's levels (session 1, phase 2 step 4, 15 Nov 2026; docs/design/game-reviews/logic.md, the
 * difficulty framework docs/design/difficulty/README.md): each game's settings per level as the deal and the stage
 * read them. The registry (src/lib/levels/gameLevels.ts) holds the Easy, Hard and Expert settings; Normal is today's
 * game, byte for byte, with one approved exception (Joe, 15 Nov 2026, "too-hard games: today's becomes Hard"):
 * Minefield's today (minesRev 2) is its Hard, and its Normal is a new, gentler game on minesRev 3.
 * Shared and pure.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { puzzleLevel, type Level, NORMAL } from "@/lib/levels/levels";

export interface SudokuLevel {
  givens: readonly [number, number];
  steps: "singles" | "advanced";
  /** Advanced steps a board must need at least (Hard 1, Expert 2). */
  minAdvanced?: number;
  clashes: "live" | "check";
  hideUsed: boolean;
  timeMs: number;
}
export interface TubesLevel {
  flasks: number;
  colours: number;
  capacity: number;
  minMoves: readonly [number, number];
  hidden: boolean;
  timeMs: number;
}
export interface TowerLevel {
  pegs: 3 | 4;
  discs: number;
  minMoves: readonly [number, number];
  timeMs: number;
}
export interface SafeLevel {
  dials: number;
  max: number;
  clues: number;
  kinds: "simple" | "number";
  tries: number;
  timeMs: number;
}
export interface NonoLevel {
  cols: number;
  rows: number;
  fill: readonly [number, number];
  logic: "line" | "two";
  /** With logic "two": the two-line steps a board needs at least (D4, 22 Nov 2026; absent = one). */
  minProbes?: number;
  lockLines: boolean;
  timeMs: number;
}
export interface FloodLevel {
  /** Smoothing passes when painting (fewer = more, smaller blobs = a higher par). */
  smooth: number;
  cols: number;
  rows: number;
  colours: number;
  par: readonly [number, number];
  blocked: number;
  /** Moves allowed over par (the par bonus reaches 0 there and the board ends). */
  spare: number;
  timeMs: number;
}
export interface MinesLevel {
  cols: number;
  rows: number;
  mines: number;
  opening: readonly [number, number];
  seconds: number;
}

/** A level's settings for a game, or null at Normal (and for a level the game doesn't offer). */
export function levelSettings<S>(type: string, level: Level | undefined): S | null {
  if (!level || level === NORMAL) return null;
  return gameLevelSettings<S>(type, level);
}

/** Hanoi's settings for a deal: the level's; at Normal none (today's deal exactly). */
export function towerSettingsFor(level: Level | undefined): TowerLevel | undefined {
  return levelSettings<TowerLevel>("tower", level) ?? undefined;
}

/** A stored puzzle's level settings (the stage and grader read the dealt puzzle, never the phone's choice). */
export function puzzleLevelSettings<S>(puzzle: { type: string } & object): S | null {
  return levelSettings<S>(puzzle.type, puzzleLevel(puzzle));
}

/*
 * Logic overhaul 2's seven games (Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions, Island Link) keep
 * their level data in logicOverhaul2Levels.ts, re-exported here, so the registry (gameLevels.ts) can read it without an
 * import cycle through this file (puzzle train combine, 16 Nov 2026).
 */
export * from "./logicOverhaul2Levels";
