import type { PuzzleCategory } from "./types";

/**
 * Games deleted on 14 Oct 2026. Their code is gone, but stored rooms still hold
 * rounds of them (puzzles_public, round_order, round_results). Those rounds are
 * read-only: the history shows the game's name and each player's stored score,
 * nothing is replayed or regraded, and room totals never change.
 *
 * The ids are not PuzzleTypes any more; a stored puzzle may still carry one, so
 * every reader of stored rounds checks `isRemovedType` before it reaches for the
 * registry.
 *
 * Id → the display name it had, the accent its stored rounds are drawn in
 * (display only), and its round clock as it was. The clock is kept exactly
 * because a stamped room's tie-break (tieBreak.ts) reads each round's limit, and
 * Sort Rush and Parry stay "arcade" so their run length is the old 60 s. Sequence
 * Recall, Reverse Recall, Spatial Memory and Number Climb were the Memory
 * category, which went with them; they take the pattern accent Memory always
 * shared.
 */
export const REMOVED_GAMES = {
  intruder: { name: "Interloper", accent: "attention", timeLimitMs: 75_000 },
  groups: { name: "Groups", accent: "word", timeLimitMs: 90_000 },
  wordmatch: { name: "Word Match", accent: "word", timeLimitMs: 45_000 },
  ladder: { name: "Word Ladder", accent: "word", timeLimitMs: 60_000 },
  chaincalc: { name: "Chain Calculation", accent: "number", timeLimitMs: 45_000 },
  numseq: { name: "Number Sequence", accent: "number", timeLimitMs: 45_000 },
  pctsprint: { name: "Percent Sprint", accent: "number", timeLimitMs: 45_000 },
  sumhunt: { name: "Sum Hunt", accent: "number", timeLimitMs: 90_000 },
  sequence: { name: "Sequence Recall", accent: "pattern", timeLimitMs: 30_000 },
  reverse: { name: "Reverse Recall", accent: "pattern", timeLimitMs: 30_000 },
  spatial: { name: "Spatial Memory", accent: "pattern", timeLimitMs: 20_000 },
  numclimb: { name: "Number Climb", accent: "pattern", timeLimitMs: 20_000 },
  gonogo: { name: "Go / No-Go", accent: "speed", timeLimitMs: 30_000 },
  patcomp: { name: "Pattern Completion", accent: "pattern", timeLimitMs: 30_000 },
  spin: { name: "Spin", accent: "pattern", timeLimitMs: 45_000 },
  mirmatch: { name: "Mirror Match", accent: "pattern", timeLimitMs: 60_000 },
  stroke: { name: "One-Stroke", accent: "logic", timeLimitMs: 30_000 },
  sortrush: { name: "Sort Rush", accent: "arcade", timeLimitMs: 63_000 },
  parry: { name: "Parry", accent: "arcade", timeLimitMs: 63_000 },
} as const satisfies Record<string, { name: string; accent: PuzzleCategory; timeLimitMs: number }>;

export type RemovedPuzzleType = keyof typeof REMOVED_GAMES;

export const REMOVED_PUZZLE_TYPES = Object.keys(REMOVED_GAMES) as RemovedPuzzleType[];

export function isRemovedType(type: unknown): type is RemovedPuzzleType {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(REMOVED_GAMES, type);
}

/** The display name a deleted game had, or null for any other id. */
export function removedGameName(type: unknown): string | null {
  return isRemovedType(type) ? REMOVED_GAMES[type].name : null;
}

/**
 * A stored round of a deleted game is never graded again: whatever asks for a
 * score gets the one the round stored (0 when there is none, e.g. a stray late
 * submission to a room dealt before the deletion).
 */
export function removedRoundScore(row: { score?: number | null } | null | undefined): number {
  const score = row?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

/**
 * Re-scores a stored round for a check or tool: a deleted game returns the score
 * the round stored (there is no grader left to ask); any other game runs `regrade`.
 */
export function scoreStoredRound(
  puzzle: { type?: unknown },
  row: { score?: number | null } | null | undefined,
  regrade: () => number,
): number {
  return isRemovedType(puzzle.type) ? removedRoundScore(row) : regrade();
}
