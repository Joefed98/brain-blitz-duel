/**
 * Every category's standard games, by type. Imported by name (never for side effects): the app's package.json says
 * "sideEffects": false, so a production build drops a bare `import "./word.server"` and, with it, every grader
 * (28 Oct 2026: the live server graded every standard puzzle on the pre-standard path). standard-prod-check proves the
 * built server bundle grades on the standard.
 */
import type { PuzzleType } from "../types";
import type { StandardGame } from "./grade.server";
import { ATTENTION_STANDARD_GAMES } from "./attention.server";
import { LOGIC_STANDARD_GAMES } from "./logic.server";
import { NUMBER_STANDARD_GAMES } from "./number.server";
import { PATTERN_STANDARD_GAMES } from "./pattern.server";
import { WORD_STANDARD_GAMES } from "./word.server";
import { GRID_STANDARD_GAMES } from "./grid.server";

export const STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = {
  ...WORD_STANDARD_GAMES,
  ...NUMBER_STANDARD_GAMES,
  ...ATTENTION_STANDARD_GAMES,
  ...PATTERN_STANDARD_GAMES,
  ...LOGIC_STANDARD_GAMES,
  ...GRID_STANDARD_GAMES,
};
