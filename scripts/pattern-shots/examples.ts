/**
 * Dumps the fixed intro example of each Pattern game, with its server-side
 * solution, exactly as practice builds it with `example: true` (Unblock uses
 * the built-in bank, as practice does when Supabase is unreachable). The
 * capture tool uses the solutions to drive real solves. Not a check.
 *
 *   bun scripts/pattern-shots/examples.ts > <out.json>
 */
import { generatePuzzle } from "@/lib/duel/generate.server";
import { bankedIntroExample } from "@/lib/duel/puzzleBank.server";
import { INTRO_EXAMPLE_SEED } from "@/lib/duel/puzzleDemo";
import { withSeededRandom } from "@/lib/duel/random";
import type { PuzzleType } from "@/lib/duel/types";

const PATTERN_GAMES: PuzzleType[] = [
  "unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser", "flow", "pipes", "push",
];

const out: Record<string, unknown> = {};
for (const type of PATTERN_GAMES) {
  out[type] =
    bankedIntroExample(type) ??
    withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null }));
}
console.log(JSON.stringify(out));
