/**
 * The fixed intro example of any game, with its server-side solution, built exactly as
 * practiceGenerateFn builds it with `example: true` (Gridlock from the built-in bank, as
 * practice does when Supabase is unreachable). Drivers read the solutions to play real solves.
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { bankedIntroExample } from "../../src/lib/duel/puzzleBank.server";
import { INTRO_EXAMPLE_SEED } from "../../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";
import { generateWordsmithExample } from "../../src/lib/duel/wordsmith.server";

export function exampleFor(type: PuzzleType): PuzzleData {
  // As practiceGenerateFn: Skid, Chroma Lines and Tessellate's example is the live deal at the example seed (puzzle
  // polish, 3 Nov 2026), not the bank's stored first board (the driver solved a board the page never showed).
  if (type === "iceslide" || type === "flow" || type === "blockparty")
    return withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { bankSeed: INTRO_EXAMPLE_SEED })) as PuzzleData;
  return (bankedIntroExample(type) ??
    withSeededRandom(INTRO_EXAMPLE_SEED, () =>
      type === "wordsmith"
        ? generateWordsmithExample()
        : generatePuzzle(type, { unblockRow: null }),
    )) as PuzzleData;
}
