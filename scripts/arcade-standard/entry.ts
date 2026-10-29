/**
 * One game's entry in arcade-standard-check (the arcade scoring standard, 29 Oct 2026;
 * src/lib/arcade/arcadeStandard.ts, docs/arcade-standard-oct-2026.md). Each game on the standard adds
 * `scripts/arcade-standard/<type>.ts` exporting `entry`; the check imports every file in this folder but this one.
 */
import type { StdSpec } from "../../src/lib/arcade/arcadeStandard";

export interface StdRun {
  label: string;
  score: number;
}

export interface StdEntry {
  /** The PuzzleType id and the puzzle field that carries the stamp. */
  type: string;
  field: string;
  /** The standard's revision (one above the stamp rooms dealt before it). */
  rev: number;
  /** The revision rooms dealt before it (its runs must replay and score exactly as before: the game's own check). */
  before: number;
  spec: StdSpec;
  /** Perfect runs on the new revision (replayed oracle logs where the game has an oracle, else built states): each must score 200. */
  perfect: () => StdRun[] | Promise<StdRun[]>;
  /** Runs that played (at least one input) and earned nothing: each must score at least 1. */
  played: () => StdRun[] | Promise<StdRun[]>;
  /** Runs with no input at all: each must score 0. */
  idle: () => StdRun[] | Promise<StdRun[]>;
  /** The help SCORE text must name every part and the total (read from PUZZLE_INSTRUCTIONS by the check). */
  helpTerms?: string[];
}
