/**
 * The dealt signature (B4, docs/audit-nov-2026/architecture.md): every top-level version stamp a game's new puzzles
 * carry today, as one string ("depthRev=4 floodRev=3 puzzleScoreRev=3 speedPar=1"). A practice best is kept under it
 * (practiceBest.ts), and ratings will key a game's epoch on it: a new stamp a game deals is a new signature.
 *
 * LIVE_DEAL is the table of each game's stamps and values, read from PRACTICE_STAMPS (practiceStamps.data.ts, built by
 * scripts/practice-stamps.ts from the real deal with nothing pinned; practice-bests-check and deal-identity-check prove
 * it is what generatePuzzle deals). Pure; shared by phone and server.
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

/** A signature's stamps as a record ("" → {}). */
export function parseSignature(signature: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of signature.split(" ")) {
    if (!part) continue;
    const at = part.indexOf("=");
    out[part.slice(0, at)] = Number(part.slice(at + 1));
  }
  return out;
}

/** The signature a game's new puzzles carry today ("" for an id no game has). */
export function dealtSignature(type: string): string {
  return (PRACTICE_STAMPS as Record<string, string>)[type] ?? "";
}

/** Every game's live stamps and values. */
export const LIVE_DEAL: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze(
  Object.fromEntries(Object.entries(PRACTICE_STAMPS).map(([type, sig]) => [type, Object.freeze(parseSignature(sig))])),
);
