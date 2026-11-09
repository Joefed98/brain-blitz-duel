/**
 * The version stamps a practice best is kept under (practiceBest.ts). A best only ever compares
 * with runs of the same rules: the signature is every top-level version stamp in the dealt puzzle
 * (`hoverRev`, `bombVersion`, `speedPar`, `puzzleScoreRev`…), so a game whose generator deals a new
 * stamp starts a fresh best. It is the game's dealt signature (dealSignature.ts, B4), which ratings
 * key on too; PRACTICE_STAMPS (built by scripts/practice-stamps.ts, proved current by
 * scripts/practice-bests-check.ts) is what each game deals today, for the practice list's cards
 * before a puzzle has been made. Display only: nothing here reaches grading or the server.
 */
import { dealtSignature } from "./dealSignature";

export { STAMP_FIELD, stampSignature } from "./dealSignature";

/** The signature a game's new practice puzzles carry today ("" when not listed). */
export function currentPracticeStamp(type: string): string {
  return dealtSignature(type);
}
