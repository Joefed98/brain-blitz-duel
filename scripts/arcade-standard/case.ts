/**
 * What arcade-standard-check needs from each game on the arcade scoring standard (src/lib/arcade/arcadeStandard.ts).
 * Each game's file builds states by hand from its standard revision's init (scripts only: no sim rule is copied).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame } from "../../src/lib/arcade/engine";

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
  /** An initial state on the revision before the standard: its parts must be null. */
  older(): any;
  /** Game-specific assertions (feature amounts, mistakes, gameplay changes). */
  extra?(ok: (cond: boolean, label: string) => void): void | Promise<void>;
}
