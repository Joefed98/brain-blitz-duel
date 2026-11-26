/**
 * A level's own "full by" time, stamped on its deal as `speedFullByS` (Operator's Hard and Expert, 16 Nov 2026; the
 * Number games' level deals that set one, D2, 22 Nov 2026). Normal deals never carry one, so every round dealt without
 * it grades on the game's own line exactly as before. Shared by the Number and grid graders, pure.
 */
export function storedFullByS(puzzle: unknown): number | undefined {
  const v = (puzzle as { speedFullByS?: unknown } | null)?.speedFullByS;
  return typeof v === "number" && v > 0 ? v : undefined;
}
