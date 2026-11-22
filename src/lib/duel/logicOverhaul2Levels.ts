/**
 * Levels for the seven Logic overhaul 2 games (phase 2 step 4, stage 3, 15–16 Nov 2026): Tents and Trees, Shikaku,
 * Lamplighter, Trail, Loopline, Regions and Island Link. Plain data and types only (the registry, gameLevels.ts, spreads
 * LOGIC_GAME_LEVELS into GAME_LEVELS and the phone loads it); generators read their settings through logicLevel
 * (logicLevels.server.ts).
 *
 * Normal is today's game: it has no settings here and every generator deals exactly what it dealt before levels.
 * Every level keeps Normal's board width and grows downwards (Joe, 15 Nov 2026: no square under about 40 px on a
 * 375 px phone; Normal's widths are already at the limit), and every board still has exactly one solution.
 */
import type { LevelEntry } from "@/lib/levels/gameLevels";

/** Tents and Trees: 8 wide; `height` rows, `pairs` trees, `hidden` the share of the line counts left blank. */
export interface TentsLevel {
  height: number;
  pairs: readonly [number, number];
  hidden: number;
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}
/** Shikaku: 10 wide; `height` rows, `rects` rectangles, `maxArea` the largest, `minBig` of area 6+. */
export interface ShikakuLevel {
  height: number;
  rects: readonly [number, number];
  maxArea: number;
  minBig: number;
  minEqualPairs: number;
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}
/** Lamplighter: 9 wide; `height` rows, `walls`, `numbered` the share of walls with a number. */
export interface LightUpLevel {
  height: number;
  walls: readonly [number, number];
  numbered: number;
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}
/**
 * Trail: the 6 × 6 king-move board (its size is the game's: 1 to 36); `givens` the numbers shown (the fewest the path
 * stays unique with, topped up to this); `nodes` the band of the solver's search steps proving it unique, the board's
 * difficulty grade (Normal's bank: median about 13,000, the hardest tenth over 65,000). A path is never unique with
 * fewer than about 9 numbers on this board, so Hard and Expert are harder numbers, not fewer.
 */
export interface TrailLevel {
  /** The board's side (D4, 22 Nov 2026: Easy 5, Hard 7, Expert 8; absent = Normal's 6). */
  size?: number;
  givens: number;
  nodes: readonly [number, number];
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}
/** Loopline: `size` square; the solver's branch points in `grade`; at least `minClues` numbers. */
export interface FencesLevel {
  size: number;
  grade: readonly [number, number];
  minClues: number;
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}
/** Regions: `size` square; the solver's branch points in `grade`; `givens` numbers shown. */
export interface FillominoLevel {
  size: number;
  grade: readonly [number, number];
  givens: readonly [number, number];
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}
/** Island Link: `size` square; `islands`; the solver's branch points in `grade`. */
export interface BridgesLevel {
  size: number;
  islands: readonly [number, number];
  grade: readonly [number, number];
  /** The one-step trials a person-style solver needs (logicHuman.server.ts): the board's difficulty for a person. */
  person: readonly [number, number];
  timeLimitMs: number;
  /** The level's own speed line (D4, 22 Nov 2026; stamped on the deal as levelFullByS); absent = the game's own. */
  fullByS?: number;
}

export interface LogicLevelSettings {
  tents: TentsLevel;
  shikaku: ShikakuLevel;
  lightup: LightUpLevel;
  trail: TrailLevel;
  fences: FencesLevel;
  fillomino: FillominoLevel;
  bridges: BridgesLevel;
}
export type LogicLevelGame = keyof LogicLevelSettings;
export const LOGIC_LEVEL_GAMES: readonly LogicLevelGame[] = ["tents", "shikaku", "lightup", "trail", "fences", "fillomino", "bridges"];

const proof = { proof: "scripts/logic-levels-check.ts" } as const;
type Levels<S> = { easy: LevelEntry<S>; hard: LevelEntry<S>; expert: LevelEntry<S> };
const levels = <S>(easy: S, hard: S, expert: S): { levels: Levels<S> } => ({
  levels: { easy: { settings: easy, oneSolution: proof }, hard: { settings: hard, oneSolution: proof }, expert: { settings: expert, oneSolution: proof } },
});

/** The registry entries (gameLevels.ts spreads them into GAME_LEVELS). */
export const LOGIC_GAME_LEVELS: { [K in LogicLevelGame]: { levels: Levels<LogicLevelSettings[K]> } } = {
  // D4 (22 Nov 2026): every Hard and Expert has its own speed line (`fullByS`, stamped on the deal as levelFullByS),
  // set from the elite's finishes under the human limits (scripts/pattern-logic-human-tune.ts). Clocks: Tents Hard
  // 120 s and Expert 110 s, Shikaku, Lamplighter, Loopline, Regions and Island Link Hard 120 s (on 100 s and 90 s the average player
  // scored Expert about level with Hard; the longer Hard clock gives the average room to place more, the shorter
  // Expert clock less).
  tents: levels<TentsLevel>(
    { height: 6, pairs: [7, 8], hidden: 0, person: [0, 1], timeLimitMs: 90_000 },
    { height: 11, pairs: [16, 17], hidden: 0.5, person: [2, 15], timeLimitMs: 120_000, fullByS: 69 },
    { height: 12, pairs: [17, 18], hidden: 0.5, person: [4, 40], timeLimitMs: 110_000, fullByS: 85 },
  ),
  shikaku: levels<ShikakuLevel>(
    { height: 7, rects: [9, 11], maxArea: 8, minBig: 2, minEqualPairs: 1, person: [0, 0], timeLimitMs: 90_000 },
    { height: 13, rects: [19, 22], maxArea: 16, minBig: 6, minEqualPairs: 3, person: [0, 15], timeLimitMs: 120_000, fullByS: 67 },
    { height: 15, rects: [22, 26], maxArea: 20, minBig: 8, minEqualPairs: 3, person: [0, 40], timeLimitMs: 120_000, fullByS: 88 },
  ),
  lightup: levels<LightUpLevel>(
    { height: 6, walls: [13, 16], numbered: 0.8, person: [0, 2], timeLimitMs: 120_000 },
    { height: 11, walls: [23, 27], numbered: 0.4, person: [2, 25], timeLimitMs: 120_000, fullByS: 63 },
    { height: 12, walls: [26, 30], numbered: 0.35, person: [3, 40], timeLimitMs: 120_000, fullByS: 78 },
  ),
  trail: levels<TrailLevel>(
    { size: 5, givens: 9, nodes: [0, 1_000_000], person: [0, 20], timeLimitMs: 120_000 },
    { size: 7, givens: 17, nodes: [0, 1_000_000], person: [5, 40], timeLimitMs: 120_000, fullByS: 79 },
    { size: 7, givens: 14, nodes: [0, 1_000_000], person: [30, 70], timeLimitMs: 120_000, fullByS: 103 },
  ),
  fences: levels<FencesLevel>(
    { size: 5, grade: [0, 1], minClues: 14, person: [0, 1], timeLimitMs: 90_000 },
    { size: 7, grade: [3, 8], minClues: 18, person: [3, 15], timeLimitMs: 120_000, fullByS: 49 },
    { size: 8, grade: [4, 30], minClues: 19, person: [8, 40], timeLimitMs: 120_000, fullByS: 69 },
  ),
  fillomino: levels<FillominoLevel>(
    { size: 6, grade: [0, 20], givens: [16, 22], person: [0, 15], timeLimitMs: 90_000 },
    { size: 8, grade: [30, 400], givens: [16, 20], person: [20, 120], timeLimitMs: 120_000, fullByS: 78 },
    { size: 8, grade: [40, 100_000], givens: [10, 14], person: [40, 400], timeLimitMs: 120_000, fullByS: 88 },
  ),
  bridges: levels<BridgesLevel>(
    { size: 6, islands: [7, 9], grade: [0, 0], person: [0, 0], timeLimitMs: 90_000 },
    { size: 8, islands: [13, 16], grade: [2, 6], person: [1, 8], timeLimitMs: 120_000, fullByS: 51 },
    { size: 8, islands: [18, 22], grade: [2, 20], person: [3, 20], timeLimitMs: 120_000, fullByS: 83 },
  ),
};
