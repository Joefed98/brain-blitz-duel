/**
 * The Number overhaul's screen fixtures (15 Nov 2026): each Number game's dealt puzzle (seeded, so every run draws the
 * same board) and a played answer for its reveal. Helpers only (scripts/area-screens.ts skips `-fixture.ts` files);
 * scripts/screens/number.ts draws them.
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { splitPuzzle } from "../../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";

export const NUMBER_GAMES = ["balance", "target", "equation", "numpyramid", "measure", "checkout", "numline", "kakuro"] as const satisfies readonly PuzzleType[];
export type NumberGame = (typeof NUMBER_GAMES)[number];

/**
 * A part-played answer per game, built from the full deal (its private half included); "" is a timed-out round. Each
 * game's entry is the answer its stage would send part-way through.
 */
export const NUMBER_REVEAL_ANSWERS: Partial<Record<NumberGame, (full: PuzzleData) => string>> = {};

/** The game's live deal at a fixed seed: its public half for the room, and the answer for my stored result. */
export function numberRevealFixture(type: NumberGame, seed = 41): { pub: PuzzleData; answer: string } {
  const full = withSeededRandom(seed, () => generatePuzzle(type));
  const answer = NUMBER_REVEAL_ANSWERS[type]?.(full) ?? "";
  return { pub: splitPuzzle(full).pub as PuzzleData, answer };
}
