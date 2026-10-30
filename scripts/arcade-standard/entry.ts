/**
 * One game's entry in arcade-standard-check (the arcade scoring standard, 29 Oct 2026; src/lib/arcade/arcadeStandard.ts,
 * docs/arcade-standard/README.md). Every game on the standard adds `scripts/arcade-standard/<type>.ts` exporting
 * `entry`; the check imports every file in this folder but this one and holds the roster (STANDARD_ROSTER) of the
 * games that must have one.
 *
 * What every entry must give (the check asserts it for every game): its stamp, its parts and maximums, and perfect
 * runs through the game's real scoring path. The optional fields carry each game's further proofs (all asserted when
 * present): played and idle runs, the help's words, the core's straight line, older revisions, and the game's own.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame } from "../../src/lib/arcade/engine";
import type { StdPart, StdSpec } from "../../src/lib/arcade/arcadeStandard";

export interface StdRun {
  label: string;
  score: number;
  /** The run's points per part, keyed as the spec, in the spec's order (a perfect run's must each be the maximum). */
  parts?: Record<string, number>;
  /** Each part's maximum as the run's own parts list states it (must be the spec's). */
  partMaxes?: Record<string, number>;
  /** The exact score this run must have (played runs: at least 1 when absent). */
  want?: number;
}

export interface StdEntry {
  /** The PuzzleType id and the puzzle field that carries the stamp. */
  type: string;
  field: string;
  /** The standard's revision. */
  rev: number;
  /** The revision rooms dealt before it: the standard must be the stamp one above it. */
  before?: number;
  /** The parts (core first, key "core") and their maximums: the sim's own spec where it has one. */
  parts: readonly { key: string; label: string; max: number; of?: number }[];
  /** The sim's own spec (field, rev, parts): it must match the entry, and where `liveSpec` LIVE_BANDS carries it. */
  spec?: StdSpec;
  liveSpec?: boolean;
  /** Perfect runs on the standard revision (replayed logs or built states): each must score 200. */
  perfect: () => StdRun[] | Promise<StdRun[]>;
  /** Runs that played (at least one input) and earned nothing: each scores at least 1 (or its `want`). */
  played?: () => StdRun[] | Promise<StdRun[]>;
  /** Runs with no input at all: each must score 0. */
  idle?: () => StdRun[] | Promise<StdRun[]>;
  /** The help's SCORE text must say "total 200", every part's maximum, every feature's label and these words. */
  help?: { terms?: string[] };
  /**
   * The core's straight line: the state whose core measure is `v` (and no feature) must earn exactly
   * floor(coreMax × min(v, fullAt) ÷ fullAt) and no feature points (but `finishParts` from `fullAt` on).
   */
  core?: { fullAt: number; at: (v: number) => any; parts: (state: any) => StdPart[] | null; finishParts?: readonly string[] };
  /** A state on the revision before the standard: it must have no standard parts. */
  older?: () => boolean;
  /** The game's own assertions (feature amounts, mistakes, gameplay changes). */
  extra?: (ok: (cond: boolean, label: string) => void) => void | Promise<void>;
}

/** Batch B's case shape (a game with a sim spec and a parts function): built states for every proof. */
export interface StdCase {
  /** The standard revision's game (init / step / score), as the server replays it. */
  game: ArcadeGame<any, any>;
  /** A final state (acted) that earned every part in full: it must score exactly 200. */
  perfect(): any;
  /** A final state that played (acted) but earned nothing: it must score 1. */
  idle(): any;
  /** A final state (acted) whose core measure is `value` and that earned no feature. */
  core(value: number): any;
  /** The core measure at which the core part is full (its straight line's end). */
  fullAt: number;
  /** Feature keys a full core earns by itself (a finish): 0 below `fullAt`, allowed from it on. */
  finishParts?: readonly string[];
  /** An initial state on the revision before the standard: its parts must be null. */
  older(): any;
  /** Game-specific assertions (feature amounts, mistakes, gameplay changes). */
  extra?(ok: (cond: boolean, label: string) => void): void | Promise<void>;
}

/** An entry from a StdCase: the spec's parts, the parts function's perfect split, 1 for played, 0 untouched. */
export function caseEntry(type: string, spec: StdSpec, parts: (state: any) => StdPart[] | null, c: StdCase): StdEntry {
  const record = (list: StdPart[] | null) => (list ? Object.fromEntries(list.map((p) => [p.key, p.points])) : {});
  const maxes = (list: StdPart[] | null) => (list ? Object.fromEntries(list.map((p) => [p.key, p.max])) : {});
  return {
    type,
    field: spec.field,
    rev: spec.rev,
    parts: spec.parts,
    spec,
    liveSpec: true,
    perfect: () => {
      const s = c.perfect();
      return [{ label: "a built state that earned every part", score: c.game.score(s), parts: record(parts(s)), partMaxes: maxes(parts(s)) }];
    },
    played: () => [{ label: "a built state that played and earned nothing", score: c.game.score(c.idle()), want: 1 }],
    idle: () => [{ label: "an untouched init(12345)", score: c.game.score(c.game.init(12345)) }],
    core: { fullAt: c.fullAt, at: (v) => c.core(v), parts, finishParts: c.finishParts },
    older: () => parts(c.older()) === null,
    extra: c.extra ? (ok) => c.extra!(ok) : undefined,
  };
}
