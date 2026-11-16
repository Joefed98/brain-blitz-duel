/**
 * The answer reveal's heading above a puzzle's board (15 Nov 2026, Joe: it said "The solution" even over the player's
 * own answer). The heading now says what the board actually draws: "Your answer", "The solution", or both when one board
 * carries both, "Answer and solution" (the solution with the player's misses marked, or the player's board with the shortest route beside it).
 * Each game's Reveal is unchanged; this is the one place that knows what each draws (audited 15 Nov 2026, game by game).
 * Display only: no answer, score or solution is read beyond what the reveal already shows.
 */
import { isJumbledGradient } from "./jumbled";
import type { PuzzleData } from "./types";

export const HEADING_YOURS = "Your answer";
export const HEADING_SOLUTION = "The solution";
// Short enough to stay whole beside the score on a 375 px phone ("Your answer and the solution" was cut off).
export const HEADING_BOTH = "Answer and solution";

export type RevealShows = "yours" | "solution" | "both";

/** The Solution / Yours switch's state, when the reveal has one (SolutionSwitch). */
export interface SwitchState {
  /** The switch found both columns and is showing one of them. */
  found: boolean;
  view: "solution" | "yours";
}

/** Games whose board is only ever the player's own (their run, their board, their stops). */
const YOURS = new Set([
  "chain",
  "clayshoot",
  "flood",
  "minesweeper",
  "sudoku",
  "numhunt",
  "reaction",
  "tubes",
  "stopwatch",
  "tendrop",
  "tower",
  "whack",
  "stroop",
  "swerve",
  "dual",
  "steady",
  "rooftop",
  "hotfloor",
]);

/** Games whose board is only ever the solution (whatever the player did). */
const SOLUTION = new Set(["iceslide", "lightsout", "pairmatch"]);

/** Games that draw both on one board (or one above the other): the player's answer with the solution marked in. */
const BOTH = new Set([
  "balance",
  "checkout",
  "codeword",
  "dig",
  "gravity",
  "kakuro",
  "letterwheel",
  "maze",
  "measure",
  "numline",
  "safe",
  "spotdiff",
  "strikeout",
  "swapword",
  "wordhunt",
  "wordsearch",
  "wordslide",
  "wordsmith",
  "equation",
  "target",
  "countup",
  "symscan",
]);

/** What the reveal's board draws for this round. */
export function revealShows(puzzle: PuzzleData, correct: boolean | null, switchState: SwitchState | null): RevealShows {
  const type = puzzle.type;
  // A switch that found its two columns shows exactly one of them.
  if (switchState?.found) return switchState.view === "yours" ? "yours" : "solution";
  if (YOURS.has(type)) return "yours";
  if (SOLUTION.has(type)) return "solution";
  if (BOTH.has(type)) return "both";
  switch (type) {
    // Heave: the player's own board when solved, else the minimum solution playing back.
    case "push":
      return correct ? "yours" : "solution";
    // Gridlock without its switch: unsolved plays the shortest solution back; solved with no solution, their board.
    case "unblock":
      return correct ? "yours" : "solution";
    // Turntable (retired): solved, the player's rings; unsolved, the solution with their result beside it.
    case "rings":
      return correct ? "yours" : "both";
    // Gradient: the player's own board; the classic sliding tiles drew the solved frame.
    case "tiles":
      return isJumbledGradient(puzzle) ? "yours" : "solution";
    // Interlock without its switch (no stored solution): only the player's grid.
    case "tilegrid":
      return "yours";
    // The Logic overhaul's seven (logic2Reveal.tsx): solved, the player's own board; otherwise it opens on the
    // player's answer marked against the solution (wrong ones ringed, missed ones ghosted), with its own switch.
    case "tents":
    case "shikaku":
    case "lightup":
    case "trail":
    case "fences":
    case "fillomino":
    case "bridges":
      return correct ? "yours" : "both";
    default:
      // A switch game whose columns weren't found yet, or a game not audited: say both rather than claim one side.
      return "both";
  }
}

export function revealHeading(puzzle: PuzzleData, correct: boolean | null, switchState: SwitchState | null): string {
  const shows = revealShows(puzzle, correct, switchState);
  return shows === "yours" ? HEADING_YOURS : shows === "solution" ? HEADING_SOLUTION : HEADING_BOTH;
}
