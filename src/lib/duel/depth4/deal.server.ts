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
import { dealPinned, setDealPin } from "../dealEra";
import { withSeededRandom } from "../random";
import { dealtPuzzleScoreRev } from "../puzzleScoreRev";
import { PUZZLE_SCORE_REV_HELPER } from "../puzzleScoreRev3";
import { drawBankedPuzzle } from "../puzzleBank.server";
import { generateUnblock, type UnblockBankRow } from "../unblock.server";
import { generateRings, RINGS_TWO_RULE_PATTERNS } from "../rings.server";
import { generatePipes, generatePipesLevel } from "../logic.server";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { NORMAL, type Level } from "@/lib/levels/levels";
import type { PipesLevelSettings } from "@/lib/levels/pattern/pipes.levels";
import { generateLaser } from "../laser.server";
import { isSplitter } from "../laser";
import type { PuzzleData, PuzzleType } from "../types";
import { pipesParTurns } from "./pipesTaps";
import { D4_REV, dealtD4Rev, isD4Type } from "./stamps";
import { addIceGems } from "./gems.server";
import { drawPushD4 } from "./pushD4.server";
import { drawBlockD4 } from "./blockD4.server";
import { drawBlockLevel } from "../blockPartyLevels.server";
import { BLOCK_LEVEL_BANK } from "../blockPartyLevelBank.server";
import { drawFlowLevel } from "../flowLevels.server";

/** Lightbender's spare mirrors on laserRev 1. */
export const LASER_SPARE_MIRRORS = 2;
/** Mixed into the bank seed for Skid's gem picks (slideRev 1). */
const ICE_GEM_SEED = 0x1ce9e35;

export interface D4DealContext {
  unblockRow?: UnblockBankRow | null;
  bankSeed?: number;
  recentBankKeys?: ReadonlySet<string> | undefined;
  /** The level the deal is made at (generate.server.ts; absent at Normal). Pipeline, Tessellate and Chroma Lines
   * deal their level boards from it. */
  level?: Level | undefined;
}

/** Checks that prove the old rules switch the new deal off (scripts/depth4-check.ts). Never called by app code. */
export function pinDepth4Off(value: boolean): void {
  setDealPin("depth4Off", value);
}

export function dealDepth4(type: PuzzleType, context: D4DealContext): PuzzleData | null {
  if (dealPinned("depth4Off") || !isD4Type(type) || dealtPuzzleScoreRev() < PUZZLE_SCORE_REV_HELPER) return null;
  switch (type) {
    case "unblock": {
      const p = generateUnblock(context.unblockRow);
      return { ...p, unblockRev: dealtD4Rev("unblock"), par: p.minMoves ?? 0 };
    }
    case "rings": {
      const p = generateRings(RINGS_TWO_RULE_PATTERNS);
      return { ...p, ringsRev: dealtD4Rev("rings"), par: p.minMoves ?? 0 };
    }
    case "pipes": {
      // Difficulty levels (15 Nov 2026): a level's board (pipes.levels.ts); Normal (no level) is today's deal.
      const settings = gameLevelSettings<PipesLevelSettings>("pipes", (context as { level?: Level }).level ?? NORMAL);
      const p = settings ? generatePipesLevel(settings) : generatePipes();
      return { ...p, pipesRev: dealtD4Rev("pipes"), par: pipesParTurns(p.tiles, p.solution ?? []) };
    }
    case "laser": {
      const p = generateLaser();
      const par = (p.solution ?? []).filter((piece) => !isSplitter(piece.kind)).length;
      return { ...p, laserRev: dealtD4Rev("laser"), par, mirrors: p.mirrors + LASER_SPARE_MIRRORS };
    }
    case "flow": {
      // Levels (16 Nov 2026): Easy, Hard and Expert deal from their own banks (live without a seed); Normal as before.
      if (context.level && context.level !== "normal") return { ...drawFlowLevel(context.level, context.bankSeed, context.recentBankKeys), flowRev: D4_REV };
      if (context.bankSeed === undefined) return null;
      const p = drawBankedPuzzle("flow", context.bankSeed, context.recentBankKeys);
      return { ...(p as Extract<PuzzleData, { type: "flow" }>), flowRev: D4_REV };
    }
    case "iceslide": {
      if (context.bankSeed === undefined) return null;
      const p = drawBankedPuzzle("iceslide", context.bankSeed, context.recentBankKeys) as Extract<PuzzleData, { type: "iceslide" }>;
      // The gems' picks come from the bank seed, so the room seed alone reproduces the round (puzzle-bank-check).
      return { ...withSeededRandom(ICE_GEM_SEED ^ context.bankSeed, () => addIceGems(p)), slideRev: D4_REV };
    }
    case "push":
      return { ...drawPushD4(context.bankSeed), pushRev: dealtD4Rev("push") };
    case "blockparty": {
      // Levels (the Pattern overhaul, stage 3): Easy, Hard and Expert deal from their own proved banks by the room seed
      // (blockPartyLevels.server.ts); Normal below, exactly as before.
      if (context.level === "easy" || context.level === "hard" || context.level === "expert")
        return { ...drawBlockLevel(context.level, BLOCK_LEVEL_BANK[context.level], context.bankSeed), blockRev: dealtD4Rev("blockparty") };
      if (context.bankSeed === undefined) return null;
      return { ...drawBlockD4(context.bankSeed), blockRev: dealtD4Rev("blockparty") };
    }
  }
  return null;
}
