/**
 * Joe's phone-test notes (27 Oct 2026, docs/phone-notes-oct-2026.md): Swapword `swapwordRev 6` (4 more swaps),
 * Counterweight `balanceRev 3` (1.5× the moves), Brimful `measureRev 3` (1.5× the pours), Topsy-Turvy `gravityRev 4`
 * (2× the tilts, balls stop on balls), Bonk `whackRev 4` (the diamond stays longer), Labyrinth `mazeRev 2` (stars
 * anywhere reachable), Matchmaker `pairRev 2` (the gold pair any time in the first 30 s) and Gradient (`tiles`,
 * shown as Jumbled before) `tilesRev 4` (tiles lock in place, varied colour schemes).
 *
 * Each game deals its new stamp only while nothing older is pinned: a check that pins an earlier stamp (the
 * top-up's, the depth sessions', or this batch's own pin) keeps getting exactly what it was written for.
 */
import { dealsD5Remodels } from "./d5Remodels";
import { preTopupPinned } from "./depthTopup";
import { preDepthPinned } from "./wordDepth";

let pinned = false;

/** Checks written for the stamps before these notes pin new deals to them (returns the previous setting). */
export function pinPrePhoneNotes(on: boolean): boolean {
  const prev = pinned;
  pinned = on;
  return prev;
}

export function prePhoneNotesPinned(): boolean {
  return pinned;
}

/**
 * The stamp a new puzzle is dealt: `notesRev` when the game's existing rule would deal its live stamp `liveRev`,
 * else whatever that rule dealt (an older stamp a check pinned), and `liveRev` while this batch is pinned or a check
 * pins an earlier batch (the puzzle top-up, the word depth or the D5 remodels: a world before those is before these).
 */
export function dealtNotesRev<T>(notesRev: T, liveRev: T, dealt: T = liveRev): T {
  if (pinned || preTopupPinned() || preDepthPinned() || !dealsD5Remodels() || dealt !== liveRev) return dealt;
  return notesRev;
}
