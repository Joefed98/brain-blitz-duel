/**
 * The scoring standard's numbers for the second half of Pattern and Logic (docs/scoring-standard.md): Blackout, Box
 * Six, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku, Lamplighter.
 * Shared by the server's grade (logic.server.ts) and the help texts (logicText.ts), pure.
 */

export type LogicStandardType = "lightsout" | "sudoku" | "tower" | "tubes" | "safe" | "bomb" | "nonogram" | "flood" | "tents" | "shikaku" | "lightup";

export const LOGIC_STANDARD_TYPES: readonly LogicStandardType[] = ["lightsout", "sudoku", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup"];

export interface LogicStandardRule {
  /** Speed points, in full when solved by `fullByS` seconds of play, shrinking evenly to 0 at the buzzer. */
  speed: number;
  fullByS: number;
  /** The bonus: a par bonus (full at par, 0 at twice par; Colour Flood 0 at its move limit), a clean bonus, or none. */
  bonus: number;
  kind: "par" | "clean" | "none";
  /** Clean bonuses: points off per mistake. */
  per?: number;
  /** What the par counts (help texts) or what a clean bonus is called. */
  word: string;
  /** Today's unfinished penalty kept by the standard: points off per wrong item left on the board (0 = none). */
  wrongOff: number;
}

export const LOGIC_STANDARD: Readonly<Record<LogicStandardType, LogicStandardRule>> = {
  lightsout: { speed: 30, fullByS: 20, bonus: 20, kind: "par", word: "presses", wrongOff: 0 },
  sudoku: { speed: 40, fullByS: 45, bonus: 10, kind: "clean", per: 2.5, word: "clean grid", wrongOff: 5 },
  tower: { speed: 40, fullByS: 45, bonus: 10, kind: "par", word: "moves", wrongOff: 0 },
  tubes: { speed: 35, fullByS: 45, bonus: 15, kind: "par", word: "pours", wrongOff: 0 },
  safe: { speed: 40, fullByS: 30, bonus: 10, kind: "clean", per: 2.5, word: "clean crack", wrongOff: 0 },
  bomb: { speed: 50, fullByS: 30, bonus: 0, kind: "none", word: "", wrongOff: 0 },
  nonogram: { speed: 40, fullByS: 60, bonus: 10, kind: "clean", per: 2.5, word: "clean picture", wrongOff: 5 },
  flood: { speed: 10, fullByS: 30, bonus: 40, kind: "par", word: "moves", wrongOff: 0 },
  tents: { speed: 40, fullByS: 45, bonus: 10, kind: "clean", per: 2.5, word: "clean camp", wrongOff: 10 },
  shikaku: { speed: 40, fullByS: 45, bonus: 10, kind: "clean", per: 2.5, word: "clean cuts", wrongOff: 0 },
  lightup: { speed: 40, fullByS: 45, bonus: 10, kind: "clean", per: 2.5, word: "clean", wrongOff: 5 },
};

/** Unfinished: up to this many points by the game's share… */
export const LOGIC_SHARE_POINTS = 120;
/** …plus up to this many for how early, split evenly across the game's parts. */
export const LOGIC_EARLY_POINTS = 10;

/**
 * Colour Flood: the standard's move limit is par + this, where the par bonus reaches 0. Par + 6 on the stamp dealt
 * since 28 Oct 2026 (depthRev 4, FLOOD_REV_TIGHT); par + 10 on depthRev 3 (FLOOD_REV3_SPARE_MOVES).
 */
export const FLOOD_STANDARD_SPARE_MOVES = 6;
export const FLOOD_REV3_SPARE_MOVES = 10;
export const FLOOD_REV_TIGHT = 4;

/** The spare moves a Colour Flood puzzle on the standard plays with, by its stamp. */
export function floodSpareMoves(puzzle: { depthRev?: number }): number {
  return (puzzle.depthRev ?? 0) >= FLOOD_REV_TIGHT ? FLOOD_STANDARD_SPARE_MOVES : FLOOD_REV3_SPARE_MOVES;
}

export function isLogicStandardType(type: string): type is LogicStandardType {
  return (LOGIC_STANDARD_TYPES as readonly string[]).includes(type);
}
