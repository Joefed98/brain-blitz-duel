/**
 * Lightbender (laser) levels beyond Normal (the Pattern overhaul, stage 3, 16 Nov 2026; docs/design/difficulty/README.md).
 * Plain data only: the phone reads it to draw the level selector; the server's deal (depth4/deal.server.ts →
 * laser.server.ts `generateLaserLevel`) reads the settings.
 *
 * Normal has no entry: today's 10 × 10 board, 7–8 mirrors in the solution with 2 spare in the tray, one splitter, six
 * gems, 3–4 bombs, 3 shots, 60 s (laserRev 4; full speed by LASER_REV4_FULL_BY_S, patternRules.ts). Every level keeps
 * the board (10 × 10: 35 px squares on a 375 px phone, as Normal today; no level is bigger, so the grid rule never
 * applies), the six gems, the splitter and the walls.
 *
 * One solution: Lightbender is not a one-answer game. The grader takes any layout that lights every gem without a
 * bomb (the spare mirrors are there for other routes), and the exhaustive search (laserSolve.server.ts
 * `countLaserSolutions`) finds a second lighting layout with only the stored solution's mirrors on 39 of 40 Normal
 * boards. What the generator proves, on every level, is that the stored layout lights every gem and that no subset
 * of its pieces does (each piece is needed), and each level's boards are also lit by the person-like solver
 * (`solveLaserLikeAPerson`) from the level's own tray, needing between `humanMinTurns` and `humanTurns` pieces tried.
 */
import type { GameLevels } from "../gameLevels";

export type LaserLevelSettings = {
  /** Mirrors in the stored solution (inclusive range; the par). More mirrors = a longer, more winding beam. */
  minMirrors: number;
  maxMirrors: number;
  /** Spare mirrors in the tray beyond the solution's: room for other routes and for mistakes. */
  spare: number;
  /** Bombs off the solution's beam (inclusive range): each one ends a shot that touches it. */
  minBombs: number;
  maxBombs: number;
  /** Shots the round gives (FIREs; stamped on the puzzle as `shots`). Fewer shots = fewer chances to read the beam. */
  shots: number;
  /** The round's clock (ms), stamped on the puzzle as its `timeLimitMs` when it isn't the game's 60 s. */
  timeLimitMs: number;
  /** Speed points are full when solved within this many seconds of play (then down to 0 at the buzzer). */
  fullByS: number;
  /**
   * The person-like solver (laserSolve.server.ts) must find a lighting layout from the level's tray within this many
   * pieces tried (its "what ifs"), or the board is dealt again: the level's ceiling on how much searching a person
   * needs. 1,000 is about Normal's third quartile (77 % of Normal boards are found within it).
   */
  humanTurns: number;
  /**
   * ...and must need at least this many: the level's floor of thinking. Normal's boards need 155 at the median (a
   * quarter of them 15 or fewer); Hard's need at least Normal's median search, Expert's more than most Normal boards.
   */
  humanMinTurns: number;
};

const OPEN = {
  open:
    "Any layout that lights every gem without a bomb counts (spare mirrors by design); the generator proves the stored " +
    "layout needs every piece and the person-like solver finishes each level board (scripts/pattern-overhaul-laser-levels-check.ts)",
} as const;

export const LEVELS_LASER: GameLevels<LaserLevelSettings> = {
  levels: {
    // Easy: a short beam (4–5 mirrors), 3 spare, 1–2 bombs, 5 shots, 60 s.
    easy: { settings: { minMirrors: 4, maxMirrors: 5, spare: 3, minBombs: 1, maxBombs: 2, shots: 5, timeLimitMs: 60_000, fullByS: 20, humanTurns: 1000, humanMinTurns: 0 }, oneSolution: OPEN },
    // Hard: 8–9 mirrors, 1 spare, 4–5 bombs, 3 shots, 75 s.
    hard: { settings: { minMirrors: 8, maxMirrors: 9, spare: 1, minBombs: 4, maxBombs: 5, shots: 3, timeLimitMs: 75_000, fullByS: 35, humanTurns: 1000, humanMinTurns: 100 }, oneSolution: OPEN },
    // Expert: 9–10 mirrors, 1 spare, 5–6 bombs, 2 shots, 90 s.
    expert: { settings: { minMirrors: 9, maxMirrors: 10, spare: 1, minBombs: 5, maxBombs: 6, shots: 2, timeLimitMs: 90_000, fullByS: 40, humanTurns: 1000, humanMinTurns: 300 }, oneSolution: OPEN },
  },
};
