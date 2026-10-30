/**
 * The Practice tab's Puzzles | Arcade switch (30 Oct 2026): which side this device used last.
 * Device storage only, like practiceRecent.ts; never read by grading or rooms.
 */
import { PUZZLE_REGISTRY, isRetired } from "./registry";
import type { PuzzleType } from "./types";

export type PracticeSide = "puzzles" | "arcade";

export const PRACTICE_SIDE_KEY = "duelz-practice-side:v1";
let memory: PracticeSide | null = null;

export function readPracticeSide(): PracticeSide {
  if (memory) return memory;
  try {
    memory = window.localStorage.getItem(PRACTICE_SIDE_KEY) === "arcade" ? "arcade" : "puzzles";
  } catch {
    memory = "puzzles";
  }
  return memory;
}

export function rememberPracticeSide(side: PracticeSide): void {
  memory = side;
  try {
    window.localStorage.setItem(PRACTICE_SIDE_KEY, side);
  } catch {
    /* session-only when storage is blocked */
  }
}

/** The side a game is listed on: arcade-category games on Arcade, every other game on Puzzles. */
export function practiceSideOf(type: PuzzleType): PracticeSide {
  return PUZZLE_REGISTRY[type].category === "arcade" ? "arcade" : "puzzles";
}

/** The switch's counts: the active games on each side, from the registry. */
export function practiceSideCounts(): Record<PracticeSide, number> {
  const out: Record<PracticeSide, number> = { puzzles: 0, arcade: 0 };
  for (const type of Object.keys(PUZZLE_REGISTRY) as PuzzleType[]) if (!isRetired(type)) out[practiceSideOf(type)]++;
  return out;
}
