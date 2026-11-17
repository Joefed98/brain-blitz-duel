/**
 * The Logic overhaul, session 1 (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/logic-1/GALLERY.md): each of its
 * seven games' pages (Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood, Minefield), whose goal and
 * how-to lines carry the batch's new help (Polypotions' Undo giving the pour back, Safe Cracker's broken clues, Colour
 * Flood's out-of-moves line), at every size. Drawn by theme-check and no-wrap-check after the core list
 * (scripts/area-screens.ts finds this file).
 */
import { ALL_SIZES, type ThemeScreen } from "../theme-screens";

/** The seven games, in the order the overhaul lists them. */
export const LOGIC_1_GAMES = ["sudoku", "tubes", "tower", "safe", "nonogram", "flood", "minesweeper"] as const;

export default (): ThemeScreen[] =>
  LOGIC_1_GAMES.map((type) => ({
    name: `logic 1: game page, ${type}`,
    mode: "practice" as const,
    plain: true,
    search: { page: type },
    sizes: ALL_SIZES,
    waitMs: 900,
  }));
