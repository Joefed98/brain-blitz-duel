/**
 * Arcade games whose own Reveal is the run's visual summary (the Crazy Golf overhaul, 15 Nov 2026; Joe's reveal brief:
 * "arcade games show a short visual summary of the run"): ArcadeReveal draws the game's Reveal (from the game's own
 * chunk, GameParts' GameReveal) under the score and its breakdown, in practice and in rooms. Light (the phone's shared
 * reveal reads it): a game id per line, each overhaul adding its own.
 */
export const RUN_SUMMARY_TYPES: ReadonlySet<string> = new Set(["minigolf"]);
