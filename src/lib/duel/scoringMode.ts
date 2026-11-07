/**
 * Room scoring choice (6 Nov 2026; room setup and standings only, no game's rules, scoring, grading or stamps
 * changed). The host picks how a room's winner is decided in the room settings sheet:
 *
 * - **Total score** (`total`, the default and every room before this): the round scores add up, as always.
 * - **Placings** (`placings`): each round gives points by place in that round (PLACING_POINTS, by the number of
 *   players in the room), players level on the round's score sharing the place and its (higher) points. Most
 *   points wins; level on points, the higher total score; then the room's existing tie rule (the quicker
 *   combined answer time, tieBreak.ts); still level, the place is shared.
 *
 * Stored in `duels.scoring_mode` (migration 20261106120000_room_scoring_mode.sql, default 'total'). Until that
 * migration is applied the column is missing from the room row: every room reads as Total score
 * (readScoringMode) and the sheet hides the choice (hasScoringColumn). Only the server writes it
 * (roomSettings.server.ts, host only, lobby only); the standings are worked out the same way on every phone
 * and on the server (scoring.ts `standings`) from the stored round scores, never from anything a phone sends.
 */

export type ScoringMode = "total" | "placings";
export const SCORING_MODES: readonly ScoringMode[] = ["total", "placings"];
export const DEFAULT_SCORING_MODE: ScoringMode = "total";

const LABELS: Record<ScoringMode, string> = { total: "Total score", placings: "Placings" };
export const scoringLabel = (mode: ScoringMode) => LABELS[mode];

export const isScoringMode = (value: unknown): value is ScoringMode =>
  value === "total" || value === "placings";

/** A room's stored mode; anything else (a room before the migration, null, junk) is Total score. */
export function readScoringMode(value: unknown): ScoringMode {
  return value === "placings" ? "placings" : "total";
}

/** The room row's mode (its `scoring_mode` column, missing before the migration). */
export function roomScoringMode(room: unknown): ScoringMode {
  return readScoringMode((room as { scoring_mode?: unknown } | null | undefined)?.scoring_mode);
}

/** True once the migration has added the column (the row, read with `select("*")`, carries it). */
export function hasScoringColumn(room: unknown): boolean {
  return !!room && typeof room === "object" && "scoring_mode" in room;
}

/** Points by place, best first, for a room of `players`; places past the list score 0. */
export function placingTable(players: number): readonly number[] {
  if (players <= 2) return [1, 0];
  if (players === 3) return [3, 1, 0];
  if (players === 4) return [5, 3, 1, 0];
  if (players <= 8) return [10, 7, 5, 4, 3, 2, 1, 0];
  return [15, 12, 10, 8, 6, 5, 4, 3, 2, 1];
}

/** The points for a place (1 = first) in a room of `players`. */
export function placingPoints(players: number, place: number): number {
  return placingTable(players)[place - 1] ?? 0;
}

export interface RoundPlacing {
  slot: number;
  /** 1 + the players who scored more this round (level scores share the place). */
  place: number;
  points: number;
}

/**
 * One round's places and points. `scores` holds every player the standings list (a player with no answer
 * scores 0); `players` is the room's size for the points table (the same list's length by default).
 */
export function roundPlacings(
  scores: readonly { slot: number; score: number }[],
  players = scores.length,
): RoundPlacing[] {
  return scores.map((row) => {
    const place = 1 + scores.filter((other) => other.score > row.score).length;
    return { slot: row.slot, place, points: placingPoints(players, place) };
  });
}

