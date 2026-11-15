/**
 * Arcade games that draw their own picture of the run on the answer reveal (the Action overhaul's stage 2, 15 Nov
 * 2026): ArcadeReveal shows the game's own Reveal (its definition's) under the score, open in practice and behind "See
 * breakdown" in a room. Display only: the picture comes from the stored log replayed through the real sim; the score
 * is the stored one. A game joins with a line here.
 */
export function arcadeOwnReveal(puzzle: { type: string } & Record<string, unknown>): boolean {
  // Iron Wall's tank shooter (bastionRev 2 and 3); the original turret (no stamp) keeps the shared reveal alone.
  if (puzzle.type === "bastion") return typeof puzzle["bastionRev"] === "number" && (puzzle["bastionRev"] as number) >= 2;
  return false;
}
