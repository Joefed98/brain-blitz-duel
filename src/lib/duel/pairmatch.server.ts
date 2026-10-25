/**
 * Server-only generation for Pair Match. Eight shape-and-colour combinations are
 * drawn so no two pairs look alike, then the sixteen cards are shuffled once and
 * stored, so every phone in the room deals the same board.
 */

import { randomBelow, shuffled } from "./random";
import { PAIR_DEPTH_REV } from "./depth/matchmaker";
import {
  PAIR_SHAPES,
  PAIR_PAIRS,
  type PairCard,
  type PairPuzzleData,
  type StroopColour,
} from "./types";

const PAIR_COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE", "PINK"];

/** Every shape-and-colour combination available to a board. */
export function pairCombinations(): PairCard[] {
  const out: PairCard[] = [];
  for (const shape of PAIR_SHAPES) {
    for (const colour of PAIR_COLOURS) out.push({ shape, colour });
  }
  return out;
}

export function generatePairMatch(): PairPuzzleData {
  // Distinct combinations only — two pairs never share both shape and colour.
  const chosen = shuffled(pairCombinations()).slice(0, PAIR_PAIRS);
  const cards = shuffled(chosen.flatMap((card) => [card, { ...card }]));
  // Depth to 200 (25 Oct 2026, depth/matchmaker.ts): one pair is gold, drawn after the deal so the board is as before.
  const gold = chosen[randomBelow(PAIR_PAIRS)]!;
  return { type: "pairmatch", cards, pairRev: PAIR_DEPTH_REV, gold: { ...gold } };
}
