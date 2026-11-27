/**
 * Pipeline's levels beyond Normal (the Pattern overhaul, stage 3, 15 Nov 2026; docs/design/difficulty/README.md).
 * Plain data only: the phone reads it to draw the level selector, the server's deal (logic.server.ts
 * `generatePipesLevel`) reads the settings. Normal has no entry (the framework has none for Normal): today's 7 × 7
 * board, at least 80 % of its tiles dealt turned, leaks shown, pipesRev 5, and since 16 Nov 2026 exactly one solution
 * (a board with two layouts, about 4 %, is dealt again: logic.server.ts `withPipesOneLayout`; proved by the same check,
 * scripts/pattern-overhaul-pipes-levels-check.ts section 2b). Every level keeps the game's 120 s clock and its par (the
 * fewest turns either way to the stored solution, counted by the deal's pipesRev 5 layer, as on Normal); full speed by
 * 60 s except Expert's 90 s.
 *
 * Every level board is proved to have exactly one solution when it is dealt: the person-like solver
 * (`deducePipes`, pipesSolve.server.ts: matching sides, no loops, no sealed-off group, never a guess) must fix every
 * tile, which also proves Expert is humanly solvable. The proof check deals every level and re-proves each board with
 * a second, searching solver (`countPipesSolutions`, stopping at 2): 60 boards a level at quick depth, 400 a level at
 * CHECKS_FULL=1 (the deal is live, so "all" is a larger sample). scripts/pipes-human.ts plays them as a person would.
 */
import type { GameLevels } from "../gameLevels";

export type PipesLevelSettings = {
  /** Board width in tiles (the grid rule: never more than 8 across, so a 375 px phone keeps tiles of about 44 px). */
  cols: number;
  /** Board height in tiles (Expert grows downwards instead of wider). */
  rows: number;
  /**
   * The share of the board's tiles dealt turned away from the solution. `exact`: exactly that share (rounded) is
   * turned and the rest dealt already right (Easy); otherwise at least that share (as Normal's 80 %: every tile is
   * turned, and boards with too many cross tiles, which look the same every way, are dealt again).
   */
  scrambled: number;
  exact?: boolean;
  /** False hides the live spill marks at the network's open ends during play (Expert); the reveal still shows them. */
  leaks: boolean;
  /**
   * Seconds of play by which a finish earns full speed points (patternRules.ts `patternFullByS`); left out, the game's
   * 60 s. Expert's is 90 s (Joe, 16 Nov 2026): 88 tiles take a strong person longer than 60 s to reason out.
   */
  speedFullByS?: number;
};

const PROOF = { proof: "scripts/pattern-overhaul-pipes-levels-check.ts" };

export const LEVELS_PIPES: GameLevels<PipesLevelSettings> = {
  levels: {
    // Easy: a small 5 × 5 board (25 tiles), 60 % dealt turned (15 tiles; the other 10 already right), leaks shown.
    easy: { settings: { cols: 5, rows: 5, scrambled: 0.6, exact: true, leaks: true }, oneSolution: PROOF },
    // Hard: 8 × 8 (64 tiles, about 44 px each on a 375 px phone), at least 90 % turned, leaks shown; its own speed line
    // (D4, 22 Nov 2026: set from the elite's finishes under the human limits, so the best player reaches 200 less often
    // than on Normal and more often than on Expert).
    hard: { settings: { cols: 8, rows: 8, scrambled: 0.9, leaks: true, speedFullByS: 70 }, oneSolution: PROOF },
    // Expert: 8 across × 11 down (88 tiles, more than a 9 × 9's 81; 9 across would be 39 px tiles on a 375 px phone),
    // at least 95 % turned, leaks hidden during play, its own speed line (D4; 90 s before, which the elite never met).
    expert: { settings: { cols: 8, rows: 11, scrambled: 0.95, leaks: false, speedFullByS: 96 }, oneSolution: PROOF },
  },
};
