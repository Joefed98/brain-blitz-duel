/**
 * Live per-action checks for Strikeout, Cryptogrid and Swapword. The phone sends
 * its whole action list so far; the server replays it against the stored puzzle
 * and returns only what that board may show (never the answer). Stateless like
 * the word checks: the stored score still comes from the submitted list alone.
 */

import type { CwView } from "./codeword";
import type { SoView } from "./strikeout";
import type { SwView } from "./swapword";

export type MovesView =
  | ({ type: "strikeout" } & SoView)
  | ({ type: "codeword" } & CwView)
  | ({ type: "swapword" } & SwView)
  /**
   * Bomb Defusal Expert (`bombInstant`, the Attention overhaul's levels): whether the steps so far are all right, and
   * how many of them. Never the answer: only that the bomb is still live after the steps the player made.
   */
  | { type: "bomb"; live: boolean; steps: number };

export const MOVES_TYPES = ["strikeout", "codeword", "swapword"] as const;

/** Longest move string a check accepts (the grader's own answer cap). */
export const MOVES_MAX_CHARS = 4_000;
