import type { GenerateContext } from "../generate.server";
import type { PuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";

/**
 * Cryptogrid dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/codeword.ts). Null: deal
 * Normal's board (the deal still stamps the level). Never called at Normal, so Normal is exactly today's deal.
 */
export function dealCryptogridLevel(_level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  return null;
}
