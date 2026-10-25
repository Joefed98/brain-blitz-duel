/**
 * The D5 remodels' deal switch (25 Oct 2026; docs/depth/d5-remodels.md): rooms, practice, the daily and
 * challenges deal Topsy-Turvy gravityRev 3 (topsy.ts) and Jumbled tilesRev 3 (jumbled.ts).
 *
 * Checks written for the previous versions (their kits, fitted bands and recorded runs are the old games') pin
 * the old deal, so they keep proving what they were written for, exactly as pinDealtPuzzleScoreRev does for score
 * revisions. Never called by app code.
 */
let legacyDeal = false;

/** Checks only: true deals the previous versions (Topsy-Turvy's bank, gravityRev 2; Jumbled tilesRev 2). Returns the pin it replaced. */
export function pinD5LegacyDeal(on: boolean): boolean {
  const before = legacyDeal;
  legacyDeal = on;
  return before;
}

/** True when new rounds deal the remodels (always, outside a check's pin). */
export function dealsD5Remodels(): boolean {
  return !legacyDeal;
}

/** The remodelled games: their "?" help and intro state the remodels' own scoring (d5-remodels-check proves it). */
export const D5_REMODELLED: ReadonlySet<string> = new Set(["gravity", "tiles"]);
