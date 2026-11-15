/**
 * Arcade games whose answer reveal draws a picture of the run (the Action overhaul stage 2, 15 Nov 2026): ArcadeReveal
 * draws the game's own Reveal (its definition's, from the game's chunk) under the score, with the stored answer. Each
 * game's Reveal replays its stored log with the real sim for display only; the stored score is never worked out there.
 */
export const ARCADE_RUN_PICTURES: ReadonlySet<string> = new Set(["flip"]);
