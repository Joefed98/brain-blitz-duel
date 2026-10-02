import { TRAIL_BANK } from "./trailBank.server";
import type { TrailPuzzleData } from "./types";

/** Draws one pre-proven trail from the bank (built by scripts/trail-bank.ts). */
export function generateTrail(): TrailPuzzleData {
  const entry = TRAIL_BANK[Math.floor(Math.random() * TRAIL_BANK.length)]!;
  return { type: "trail", givens: [...entry.givens], solution: [...entry.solution] };
}
