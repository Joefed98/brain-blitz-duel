import type { PuzzleCategory } from "./types";

export const CATEGORY_ORDER: readonly PuzzleCategory[] = [
  "logic",
  "pattern",
  "speed",
  "attention",
  "word",
  "number",
  "arcade",
];
export const STANDARD_CATEGORIES: readonly PuzzleCategory[] = [
  "logic",
  "pattern",
  "speed",
  "attention",
  "word",
  "arcade",
];
export const PUZZLE_CATEGORIES = STANDARD_CATEGORIES.filter((category) => category !== "arcade");

export function normaliseCategories(value: unknown): PuzzleCategory[] {
  if (!Array.isArray(value)) return [...STANDARD_CATEGORIES];
  // Memory is practice-only: rooms never draw it, even from older settings.
  const chosen = CATEGORY_ORDER.filter(
    (category) => category !== "memory" && value.includes(category),
  );
  return chosen.length ? chosen : [...STANDARD_CATEGORIES];
}
