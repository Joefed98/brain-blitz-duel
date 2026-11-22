/**
 * Tessellate (blockparty)'s levels beyond Normal (the Pattern overhaul, stage 3, 16 Nov 2026;
 * docs/design/difficulty/README.md). Plain data only: the phone reads it to draw the level selector and the board
 * (blockLevelGeometry in src/lib/duel/blockParty.ts); the bank build (scripts/blockparty-levels-bank.ts) reads it to
 * build and prove each level's boards. Normal (no entry) is today's game: 7×7, sixteen pegs, nine pieces, 5–60
 * solutions, 60 s.
 *
 * Levers, one per setting:
 *   cols          the board's width and height in squares (the grid rule: at 8 × 8 a square is still ≈ 44 px of a
 *                 375 px phone's 351 px board, so no level grows downwards);
 *   pieces        the tray, by shape name (BLOCK_SHAPES), in tray order (the index is the piece's colour);
 *   pegs          the squares the pieces leave over (cols² less the pieces' squares); more pegs = a smaller, more
 *                 broken-up space to fill;
 *   solutions     how many full packings the board has, counted exhaustively for every bank board: fewer = fewer
 *                 ways in, so each piece has fewer homes that work;
 *   layout        "scatter": pegs at random as Normal (proved by the count); "grow": the pieces dropped one by one
 *                 into one patch, the rest pegs (Easy: random pegs with six pieces almost never leave 20 ways);
 *   humanDepth    only boards a solver that reasons as a person does finishes (humanSolveBlock: forced moves, no
 *                 holes it can't fill, guesses among at most 4 placements) holding at most `max` guesses at once, and
 *                 that need at least `min` of them (forced moves alone don't finish it): Hard and Expert, so every
 *                 board there is humanly possible and none is a walk-through; null: no such rule (Easy);
 *   timeLimitMs   the round's clock (every level ≤ 120 s);
 *   speedFullByS  speed points full when the board is filled within this many seconds of play.
 *
 * Tessellate counts any full packing as correct, so it is not a one-answer game; each level's solution count is
 * proved in the bank instead (pattern-overhaul-blockparty-levels-check re-counts every board).
 */
import type { GameLevels } from "../gameLevels";

const OPEN = { open: "any full packing counts; solution counts per level are proved in the bank" } as const;

export const LEVELS_BLOCKPARTY: GameLevels = {
  levels: {
    // D4 (22 Nov 2026; the spec's Tessellate row): every level adds squares and pieces (25, 49, 64, 64 squares), and the
    // solution count only backs it up. Easy: a tiny 5 × 5 board and four little pieces (12 squares), 10+ ways to finish.
    easy: {
      settings: {
        cols: 5,
        pieces: ["Two", "Three", "Corner", "Square"],
        pegs: 13,
        solutions: { min: 10, max: null },
        layout: "grow",
        humanDepth: null,
        timeLimitMs: 60_000,
        speedFullByS: 40,
      },
      oneSolution: OPEN,
    },
    // Hard: a bigger 8 × 8 board with Normal's nine pieces and the U (38 squares), 3–8 ways, 70 s. Expert keeps eleven
    // pieces on 8 × 8 (the spec's 9 × 9 with thirteen needs two new piece renders, A2).
    hard: {
      settings: {
        cols: 8,
        pieces: ["Plus", "Two", "Three", "Four", "Square", "Corner", "L", "T", "S", "U"],
        pegs: 26,
        solutions: { min: 3, max: 8 },
        layout: "scatter",
        humanDepth: { min: 2, max: 3 },
        timeLimitMs: 70_000,
        speedFullByS: 36,
      },
      oneSolution: OPEN,
    },
    expert: {
      settings: {
        cols: 8,
        // Normal's nine and two pentominoes (U, P): 43 squares.
        pieces: ["Plus", "Two", "Three", "Four", "Square", "Corner", "L", "T", "S", "U", "P"],
        pegs: 21,
        // Joe's spec said 1–3 ways and 90 s; at 90 s (or 75 s) the tuning bots scored Expert as high as Hard, so for a
        // clear step (16 Nov 2026): 1–2 ways, boards that need three held guesses, 70 s, and full speed by 36 s
        // (0.84 s a square against Hard's 0.97; the fastest near-perfect kit run finishes in about 39 s).
        solutions: { min: 1, max: 2 },
        layout: "scatter",
        humanDepth: { min: 3, max: 3 },
        timeLimitMs: 70_000,
        speedFullByS: 36,
      },
      oneSolution: OPEN,
    },
  },
};
