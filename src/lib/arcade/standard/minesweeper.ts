/**
 * The arcade scoring standard for `minesweeper` (arcadeStandard.ts): its live spec (minesRev 3, Normal's 16 mines, 15 Nov
 * 2026; minesRev 2 is the Hard level) and its parts, re-exported from the sim. `parts` reads minesRev 1–5 states (each on
 * its own spec) and returns null for any other.
 */
export { MINES_STD_SPEC_V3 as spec, minesStdParts as parts } from "../minesweeper";
