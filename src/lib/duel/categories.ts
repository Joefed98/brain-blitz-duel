import type { PuzzleCategory } from "./types";

export const CATEGORY_ORDER: readonly PuzzleCategory[] = [
  "logic",
  "pattern",
  "speed",
  "attention",
  "word",
  "number",
  "memory",
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
  const chosen = CATEGORY_ORDER.filter((category) => value.includes(category));
  return chosen.length ? chosen : [...STANDARD_CATEGORIES];
}
