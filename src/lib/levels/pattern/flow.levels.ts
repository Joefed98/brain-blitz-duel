/**
 * Chroma Lines (flow) levels beyond Normal (the Pattern overhaul, stage 3, 16 Nov 2026; docs/design/difficulty/README.md).
 * Plain data only: the phone reads it to draw the level selector; the server reads it to deal (flowLevels.server.ts).
 *
 * Normal is today's game exactly (9 × 9, 10–12 pairs, 2–4 walls, 75 s; its own bank, flowBank.server.ts). Each level
 * below deals from its own seeded bank (`bun scripts/flow-bank.ts --level=<level> [--check]`), every board proved to
 * have exactly one solution by the exhaustive solver, and, on every level, finished by the human-style solver
 * (flowHuman.server.ts: forced moves, two-way squares and one "what if" at a time, never a deeper search).
 */
import type { GameLevels } from "../gameLevels";

export type FlowLevelSettings = {
  /** Grid columns and rows. Rows grow before columns shrink a square under ~40 px on a 375 px phone (9 × 12 Expert). */
  cols: number;
  rows: number;
  /** Pairs of dots on a board (inclusive range). More pairs = more lines to place. */
  minPairs: number;
  maxPairs: number;
  /** Wall squares (inclusive range), never touching and at least 3 apart. Walls break up long runs. */
  minWalls: number;
  maxWalls: number;
  /** Longest and shortest solution line (squares). */
  maxPath: number;
  minPath: number;
  /** The board's lines must average at least this many squares (Hard's longer, more winding lines; 0 = none). */
  minAvgPath: number;
  /** The exhaustive uniqueness solver's node budget (a board it can't settle in it is never banked). */
  budget: number;
  /** Tries the line-joining step gets when stuck before it gives the layout up (the generator's patience). */
  stuckLimit: number;
  /**
   * The human-style solver must need at least this many "what if" steps (one-step trials) to finish the board: the
   * level's floor of thinking. Normal's boards average about 2.5.
   */
  minWhatIfs: number;
  /** The round's clock (ms), stamped on the puzzle as its `timeLimitMs` when it isn't the game's 75 s. */
  timeLimitMs: number;
  /** Speed points are full when solved within this many seconds of play (then down to 0 at the buzzer). */
  fullByS: number;
  /** Boards in the level's bank. */
  bankSize: number;
};

const PROOF = { proof: "scripts/pattern-overhaul-flow-levels-check.ts" } as const;

export const LEVELS_FLOW: GameLevels<FlowLevelSettings> = {
  levels: {
    easy: {
      settings: { cols: 6, rows: 6, minPairs: 5, maxPairs: 6, minWalls: 0, maxWalls: 0, maxPath: 12, minPath: 3, minAvgPath: 0, budget: 60_000, stuckLimit: 1500, minWhatIfs: 0, timeLimitMs: 75_000, fullByS: 15, bankSize: 500 },
      oneSolution: PROOF,
    },
    // D4 (22 Nov 2026; the spec's Chroma Lines row): the board grows downwards with more pairs at every level (36, 81, 99,
    // 117 squares), so Hard no longer has fewer dots than Normal; Hard 9 × 11 with 12–13 pairs, Expert 9 × 13 with 14 (the
    // fourteen colours, cyan and tan Expert's), both on Normal's 75 s clock.
    hard: {
      settings: { cols: 9, rows: 11, minPairs: 12, maxPairs: 13, minWalls: 4, maxWalls: 6, maxPath: 20, minPath: 3, minAvgPath: 0, budget: 200_000, stuckLimit: 1500, minWhatIfs: 3, timeLimitMs: 75_000, fullByS: 35, bankSize: 500 },
      oneSolution: PROOF,
    },
    expert: {
      settings: { cols: 9, rows: 13, minPairs: 14, maxPairs: 14, minWalls: 6, maxWalls: 8, maxPath: 16, minPath: 3, minAvgPath: 0, budget: 200_000, stuckLimit: 1500, minWhatIfs: 4, timeLimitMs: 75_000, fullByS: 40, bankSize: 500 },
      oneSolution: PROOF,
    },
  },
};
