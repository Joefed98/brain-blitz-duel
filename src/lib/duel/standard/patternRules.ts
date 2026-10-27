/**
 * The scoring standard's numbers for Pattern and Logic, first half (docs/scoring-standard.md, "Pattern and Logic (first
 * half) decisions"): Gridlock, Tessellate, Skid, Topsy-Turvy, Gradient, Turntable, Lightbender, Chroma Lines, Pipeline
 * and Heave. The server's grader (pattern.server.ts) scores with them and the help and intro texts
 * (patternText.ts) quote them, so the two never drift. Shared, pure.
 */
import type { PuzzleType } from "../types";

export type PatternStdType = "unblock" | "blockparty" | "iceslide" | "gravity" | "tiles" | "rings" | "laser" | "flow" | "pipes" | "push";

export const PATTERN_STD_TYPES: readonly PatternStdType[] = ["unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser", "flow", "pipes", "push"];

export function isPatternStdType(type: PuzzleType | string): type is PatternStdType {
  return (PATTERN_STD_TYPES as readonly string[]).includes(type);
}

/** Unfinished credit by share (the "up to 120 by share … + up to 10 early" rows). */
export const SHARE_CREDIT = 120;
export const SHARE_EARLY = 10;

export interface PatternStdRules {
  /** Speed points, full when solved within `fullByS` seconds of play, then down to 0 at the buzzer. */
  speed: number;
  fullByS: number;
  /** Par bonus (moves, swaps, tilts, turns, pushes): full at par, 0 at twice par. */
  par?: number;
}

export const PATTERN_STD: Record<PatternStdType, PatternStdRules> = {
  unblock: { speed: 30, fullByS: 40, par: 20 },
  blockparty: { speed: 40, fullByS: 40 },
  iceslide: { speed: 30, fullByS: 60 },
  // The brief's 60 s of a 90 s clock, on Topsy-Turvy's real 120 s clock.
  gravity: { speed: 30, fullByS: 80, par: 5 },
  // The brief's 40 s of a 60 s clock, on Gradient's real 120 s clock.
  tiles: { speed: 35, fullByS: 80, par: 15 },
  rings: { speed: 35, fullByS: 40, par: 15 },
  laser: { speed: 40, fullByS: 15 },
  flow: { speed: 40, fullByS: 20 },
  pipes: { speed: 40, fullByS: 60, par: 10 },
  push: { speed: 25, fullByS: 45, par: 15 },
};

/** Tessellate: per piece on its solution cells, its early extra, and the shared "right first time" bonus. */
export const BLOCK_STD = { perPiece: 13, earlyPerPiece: 1.4, firstTime: 10 } as const;
/** Skid: the ice gems' bonus, shared across the gems. */
export const ICE_STD = { gems: 20 } as const;
/** Topsy-Turvy: the stars' bonus, shared across the stars. */
export const TOPSY_STD = { stars: 15 } as const;
/** Lightbender: per gem lit, its early extra, fewer mirrors (full at the solution's count, 0 at twice) and a first-shot solve. */
export const LASER_STD = { perGem: 20, earlyPerGem: 1.5, mirrors: 5, firstShot: 5 } as const;
/** Chroma Lines: no path redrawn, less this per redraw. */
export const FLOW_STD = { clean: 10, perRedraw: 2.5 } as const;
/** Heave: per crate on a marking, its early extra, and the gold crate on its gold mark. */
export const PUSH_STD = { perCrate: 24, earlyPerCrate: 2, gold: 10 } as const;
