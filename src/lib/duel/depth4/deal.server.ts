/**
 * Depth batch 4: dealing the eight games on their new stamps (docs/depth/d4-pattern.md). Server-only.
 * Called by generatePuzzle before anything else; null leaves the game's old deal as it was.
 *
 *   Gridlock (unblock)      the same 7×7 lots; par = the solver's minimum, public.
 *   Turntable (rings)       only link patterns with two rules on the legend; par = the exact minimum, public.
 *   Pipeline (pipes)        the same boards; par = the fewest taps to the stored solution.
 *   Lightbender (laser)     the same boards with two spare mirrors; par = the mirrors the solution uses.
 *   Chroma Lines (flow)     the same bank (already 9×9); stamped for the 200 stretch.
 *   Skid (iceslide)         the same bank (already 12×12) with ice gems off the shortest route (gems.server.ts).
 *   Heave (push)            its own bank: bigger warehouses, more crates, a gold crate (pushD4Bank.server.ts).
 *   Tessellate (blockparty) its own bank: a 7×7 board, sixteen pegs, nine pieces with a Plus for the Dot (blockD4Bank.server.ts).
 *
 * The three banked games (flow, iceslide, blockparty) take the new stamp only when drawn by seed (rooms,
 * practice): their fixed intro examples stay the old stored ones, so the bank checks still prove them.
 */
import { dealtPuzzleScoreRev } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { drawBankedPuzzle } from "../puzzleBank.server";
import { generateUnblock, type UnblockBankRow } from "../unblock.server";
import { generateRings, RINGS_TWO_RULE_PATTERNS } from "../rings.server";
import { generatePipes } from "../logic.server";
import { generateLaser } from "../laser.server";
import { isSplitter } from "../laser";
import type { PuzzleData, PuzzleType } from "../types";
import { pipesParTurns } from "./pipesTaps";
import { D4_REV, isD4Type } from "./stamps";
import { addIceGems } from "./gems.server";
import { drawPushD4 } from "./pushD4.server";
import { drawBlockD4 } from "./blockD4.server";

/** Lightbender's spare mirrors on laserRev 1. */
export const LASER_SPARE_MIRRORS = 2;

export interface D4DealContext {
  unblockRow?: UnblockBankRow | null;
  bankSeed?: number;
  recentBankKeys?: ReadonlySet<string> | undefined;
}

/** Checks that prove the old rules switch the new deal off (scripts/depth4-check.ts). Never called by app code. */
let off = false;
export function pinDepth4Off(value: boolean): void {
  off = value;
}

export function dealDepth4(type: PuzzleType, context: D4DealContext): PuzzleData | null {
  if (off || !isD4Type(type) || dealtPuzzleScoreRev() < PUZZLE_SCORE_REV_HELPER) return null;
  switch (type) {
    case "unblock": {
      const p = generateUnblock(context.unblockRow);
      return { ...p, unblockRev: D4_REV, par: p.minMoves ?? 0 };
    }
    case "rings": {
      const p = generateRings(RINGS_TWO_RULE_PATTERNS);
      return { ...p, ringsRev: D4_REV, par: p.minMoves ?? 0 };
    }
    case "pipes": {
      const p = generatePipes();
      return { ...p, pipesRev: D4_REV, par: pipesParTurns(p.tiles, p.solution ?? []) };
    }
    case "laser": {
      const p = generateLaser();
      const par = (p.solution ?? []).filter((piece) => !isSplitter(piece.kind)).length;
      return { ...p, laserRev: D4_REV, par, mirrors: p.mirrors + LASER_SPARE_MIRRORS };
    }
    case "flow": {
      if (context.bankSeed === undefined) return null;
      const p = drawBankedPuzzle("flow", context.bankSeed, context.recentBankKeys);
      return { ...(p as Extract<PuzzleData, { type: "flow" }>), flowRev: D4_REV };
    }
    case "iceslide": {
      if (context.bankSeed === undefined) return null;
      const p = drawBankedPuzzle("iceslide", context.bankSeed, context.recentBankKeys) as Extract<PuzzleData, { type: "iceslide" }>;
      return { ...addIceGems(p), slideRev: D4_REV };
    }
    case "push":
      return { ...drawPushD4(context.bankSeed), pushRev: D4_REV };
    case "blockparty": {
      if (context.bankSeed === undefined) return null;
      return { ...drawBlockD4(context.bankSeed), blockRev: D4_REV };
    }
  }
  return null;
}
