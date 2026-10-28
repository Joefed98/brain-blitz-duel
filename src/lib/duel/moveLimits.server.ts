/**
 * Server-only: stamps the 13 Oct 2026 limits (moveLimits.ts) on new puzzles.
 * Called by generatePuzzle and bankedIntroExample after the puzzle is built, so
 * the stamp and the limit are stored with the round and never recomputed.
 *
 * The limits were set from the simulated solvers of scripts/puzzle-fairness.ts
 * (docs/puzzle-score-bands-oct-2026.md, "Move limits"): good and great players
 * almost never reach them, while random play runs out long before it solves.
 * Where the minimum is private (Polypotions, Topsy-Turvy, Brimful), the shown
 * limit is rounded up to a multiple of 5 so it never gives the minimum away.
 */
import { dealtTopupRev } from "./depthTopup";
import { COUNT_TOPUP_REV } from "./depth/tally";
import {
  BALANCE_LIMIT_REV,
  COUNTUP_COUNT_REV,
  EQUATION_LIMIT_REV,
  FLOOD_LIMIT_DEALT,
  FLOOD_REV2_SPARE_MOVES,
  GRAVITY_PROGRESS_REV,
  MEASURE_LIMIT_REV,
  MEASURE_NOTES_REV,
  BALANCE_NOTES_REV,
  NOTES_LIMIT_FACTOR,
  TUBES_PROGRESS_REV,
} from "./moveLimits";
import { BAL_REV2, BAL_REV2_SCALES } from "./balance";
import { dealtNotesRev } from "./phoneNotes";
import { stampLogicDepth } from "./logicDepthStamp.server";
import type { PuzzleData } from "./types";

/** Colour Flood floodRev 1 (stored rounds): par (public) plus this many spare taps. floodRev 2 and 3 get par + FLOOD_REV2_SPARE_MOVES. */
export const FLOOD_SPARE_MOVES = 2;
/** Polypotions: the minimum plus this many spare pours, rounded up to a multiple of 5. */
export const TUBES_SPARE_POURS = 6;
/** Topsy-Turvy: the minimum plus this many spare tilts, rounded up to a multiple of 5. */
export const GRAVITY_SPARE_TILTS = 6;
/** Counterweight: hangs per scale = weights on the tray plus this many re-hangs (6 / 8 / 10, and 12 on balanceRev 2's fourth scale). */
export const BALANCE_SPARE_HANGS = [4, 5, 6, 7] as const;
/** Operator: full operator sets per equation. */
export const EQUATION_TRIES = 3;
/** Brimful: about 3× the breadth-first minimum, rounded up to a multiple of 5. */
export const MEASURE_LIMIT_FACTOR = 3;

const upTo5 = (n: number) => Math.max(5, Math.ceil(n / 5) * 5);
/** Joe's phone notes (27 Oct 2026): 1.5× a limit, rounded up. */
const notesLimit = (n: number) => Math.ceil(n * NOTES_LIMIT_FACTOR);

export function stampMoveLimits(puzzle: PuzzleData): PuzzleData {
  // The eleven Logic games' depth revision (logicDepth.ts, 25 Oct 2026; docs/depth/d6-logic.md) rides on this stamp pass.
  return stampLogicDepth(stampLimitsOnly(puzzle));
}

function stampLimitsOnly(puzzle: PuzzleData): PuzzleData {
  switch (puzzle.type) {
    case "flood":
      // floodRev 2 (14 Oct 2026): par + 2 taps, stored on the puzzle. floodRev 3 (19 Oct 2026): the same
      // limit on a board from the cycle-proof bank (generateFlood, FLOOD_BANK_V3).
      return {
        ...puzzle,
        floodRev: FLOOD_LIMIT_DEALT,
        moveLimit: Math.max(1, puzzle.par) + FLOOD_REV2_SPARE_MOVES,
      };
    case "tubes":
      if (!(puzzle.minMoves && puzzle.minMoves > 0)) return puzzle;
      return {
        ...puzzle,
        // tubesRev 2 (19 Oct 2026): the tubesRev 1 limit, plus the solver-distance progress measure.
        tubesRev: TUBES_PROGRESS_REV,
        pourLimit: upTo5(puzzle.minMoves + TUBES_SPARE_POURS),
      };
    case "gravity":
      // gravityRev 3 (the remodel, topsy.ts) carries its own stamp and has no tilt limit.
      if ((puzzle.gravityRev ?? 0) >= 3) return puzzle;
      if (!(puzzle.minMoves && puzzle.minMoves > 0)) return puzzle;
      return {
        ...puzzle,
        // gravityRev 2 (19 Oct 2026): the gravityRev 1 limit, plus the solver-distance progress measure.
        gravityRev: GRAVITY_PROGRESS_REV,
        tiltLimit: upTo5(puzzle.minMoves + GRAVITY_SPARE_TILTS),
      };
    case "balance": {
      // Four scales (generateBalance since 14 Oct 2026) are balanceRev 2; a three-scale puzzle stays 1.
      // Joe's phone notes (27 Oct 2026): four-scale puzzles are balanceRev 3, the same scales with 1.5× the hangs.
      const four = puzzle.scales.length === BAL_REV2_SCALES;
      const balanceRev = four ? dealtNotesRev(BALANCE_NOTES_REV, BAL_REV2) : BALANCE_LIMIT_REV;
      return {
        ...puzzle,
        balanceRev,
        placeLimits: puzzle.scales.map((scale, i) => {
          const limit = scale.tray.length + (BALANCE_SPARE_HANGS[i] ?? BALANCE_SPARE_HANGS[BALANCE_SPARE_HANGS.length - 1]!);
          return balanceRev >= BALANCE_NOTES_REV ? notesLimit(limit) : limit;
        }),
      };
    }
    case "equation":
      return { ...puzzle, equationRev: EQUATION_LIMIT_REV, tryLimit: EQUATION_TRIES };
    case "measure": {
      const mins = puzzle.minMoves ?? [];
      if (mins.length !== puzzle.boards.length || mins.some((m) => !(m > 0))) return puzzle;
      // Joe's phone notes (27 Oct 2026): measureRev 3, the same boards with 1.5× the pours (rounded up).
      const measureRev = dealtNotesRev(MEASURE_NOTES_REV, MEASURE_LIMIT_REV);
      return {
        ...puzzle,
        measureRev,
        moveLimits: mins.map((m) => {
          const limit = upTo5(MEASURE_LIMIT_FACTOR * m);
          return measureRev >= MEASURE_NOTES_REV ? notesLimit(limit) : limit;
        }),
      };
    }
    case "countup":
      // The puzzle top-up (26 Oct 2026): countRev 4, countRev 3's trays with the depth climb retuned (depth/tally.ts).
      return { ...puzzle, countRev: dealtTopupRev(COUNT_TOPUP_REV, COUNTUP_COUNT_REV) };
    default:
      return puzzle;
  }
}
