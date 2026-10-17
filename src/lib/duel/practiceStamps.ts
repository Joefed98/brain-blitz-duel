/**
 * The version stamps a practice best is kept under (practiceBest.ts). A best only ever compares
 * with runs of the same rules: the signature is every top-level version stamp in the dealt puzzle
 * (`hoverRev`, `bombVersion`, `speedPar`, `puzzleScoreRev`…), so a game whose generator deals a new
 * stamp starts a fresh best. PRACTICE_STAMPS (built by scripts/practice-stamps.ts, proved current by
 * scripts/practice-bests-check.ts) is what each game deals today, for the practice list's cards
 * before a puzzle has been made. Display only: nothing here reaches grading or the server.
 */
import { PRACTICE_STAMPS } from "./practiceStamps.data";

/** A top-level puzzle field that is a version stamp. */
export const STAMP_FIELD = /(?:Rev|Version)$|^speedPar$/;

/** "fieldA=1 fieldB=4", the stamps sorted by name; "" for a puzzle without any. */
export function stampSignature(puzzle: object): string {
  const loose = puzzle as Record<string, unknown>;
  return Object.keys(loose)
    .filter((key) => STAMP_FIELD.test(key) && typeof loose[key] === "number")
    .sort()
    .map((key) => `${key}=${loose[key] as number}`)
    .join(" ");
}

/** The signature a game's new practice puzzles carry today ("" when not listed). */
export function currentPracticeStamp(type: string): string {
  return (PRACTICE_STAMPS as Record<string, string>)[type] ?? "";
}
