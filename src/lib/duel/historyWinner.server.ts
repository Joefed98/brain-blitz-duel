/**
 * Play again's saved winner on tie-break rooms (`tieRev: 1`, tieBreak.ts).
 *
 * The restart_duel_room RPC appends this game's history entry with the points
 * leader, breaking equal totals by player slot. On rooms stamped `tieRev: 1`
 * the final screen ranks with standings() and its tie-break time, so the
 * saved winner is read the same way before the reset and written over the
 * entry the reset just appended. Rooms played before the stamp keep the
 * entry the RPC saved. Only that one entry is touched (guarded on the history
 * length and the room being back in its lobby); earlier entries and round
 * scores are never changed. A forfeited game is recorded by
 * recordForfeitInHistory (roomPhase.server.ts) instead.
 */
import { standings } from "./scoring";
import { roomScoringMode } from "./scoringMode";
import { roomTieRounds } from "./tieBreak";
import {
  TOTAL_ROUNDS,
  type DuelPlayerRow,
  type DuelRow,
  type RoundResultRow,
  type TournamentEntry,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TieWinnerRecord {
  /** The history length before Play again appends this game's entry. */
  historyIndex: number;
  winner: string;
  score: number;
}

/**
 * The winner the final standings show (first position; players still level
 * after the tie-break time keep the lower slot, as the table lists them).
 * Null for rooms played before the tie-break stamp, or with no one left in it.
 */
export function tieWinnerRecord(
  room: Pick<DuelRow, "puzzles_public" | "round_count" | "tournament_history" | "scoring_mode">,
  players: readonly DuelPlayerRow[],
  results: readonly RoundResultRow[],
): TieWinnerRecord | null {
  const tie = roomTieRounds(room.puzzles_public);
  if (!tie) return null;
  const table = standings(
    [...players],
    [...results],
    room.round_count ?? TOTAL_ROUNDS,
    undefined,
    tie,
    // A Placings room's winner is the most placing points (scoringMode.ts), as its podium shows.
    roomScoringMode(room),
  );
  const top = table[0];
  if (!top) return null;
  return {
    historyIndex: room.tournament_history?.length ?? 0,
    winner: top.name,
    score: top.total,
  };
}

/** Writes the standings' winner over the entry Play again's reset just appended. */
export async function recordTieWinnerInHistory(
  client: any,
  roomId: string,
  record: TieWinnerRecord,
): Promise<boolean> {
  const { data } = await client
    .from("duels")
    .select("tournament_history, status")
    .eq("id", roomId)
    .maybeSingle();
  const history = (data?.tournament_history ?? null) as TournamentEntry[] | null;
  if (!Array.isArray(history) || data?.status !== "waiting") return false;
  if (history.length !== record.historyIndex + 1) return false;
  const saved = history[record.historyIndex]!;
  if (saved.winner === record.winner && saved.score === record.score) return true;
  const entry: TournamentEntry = { ...saved, winner: record.winner, score: record.score };
  const { data: written } = await client
    .from("duels")
    .update({ tournament_history: [...history.slice(0, record.historyIndex), entry] })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  return !!written;
}
