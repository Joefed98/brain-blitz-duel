/**
 * Guarded room writes for the between-round screens and the early finish.
 * Every write names the round and phase (or status) it moves away from, so
 * several phones, a timer expiry and the last tap arriving together change
 * the room exactly once. Server-only; the client is the service-role
 * Supabase client (or an in-memory stand-in in scripts/*-check.ts).
 */
import { gameIndexOf, recordRoomEvent } from "./betaRecord.server";
import { canFinishNow, continueMark, forfeitOutcome, type ContinuePhase } from "./roomFlow";
import { totalScore } from "./scoring";
import {
  TOTAL_ROUNDS,
  type DuelPhase,
  type DuelPlayerRow,
  type DuelRow,
  type RoundResultRow,
  type TournamentEntry,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Guarded so several phones calling at the same moment can never skip a screen.
 * Returns the new phase's start stamp to the one call that moved the room
 * (null to every other), so the beta recording logs each move once.
 */
export async function setPhase(
  client: any,
  roomId: string,
  round: number,
  from: DuelPhase,
  to: DuelPhase,
): Promise<string | null> {
  const at = nowIso();
  const { data } = await client
    .from("duels")
    .update({ phase: to, phase_started_at: at })
    .eq("id", roomId)
    .eq("current_round", round)
    .eq("phase", from)
    .select("id");
  return Array.isArray(data) && data.length > 0 ? at : null;
}

/**
 * Leaves a between-round screen (results or standings) for the next one:
 * results → standings (or the winner reveal after the last round), standings
 * → the next round's title (or finished, for older rooms).
 */
export async function leaveBetweenRoundScreen(
  client: any,
  room: Pick<DuelRow, "id" | "phase" | "round_count"> & Partial<Pick<DuelRow, "tournament_history">>,
  round: number,
): Promise<void> {
  const lastRound = round >= (room.round_count ?? TOTAL_ROUNDS);
  if (room.phase === "result") {
    // Last round: the shared winner reveal replaces the overall standings.
    const at = await setPhase(client, room.id, round, "result", lastRound ? "winner_reveal" : "standings");
    // Beta recording: reaching the winner reveal is the game's end.
    if (at && lastRound)
      await recordRoomEvent(client, {
        duel_id: room.id,
        game_index: gameIndexOf(room),
        round_number: 0,
        event: "game_ended",
        reason: "completed",
        at,
      });
    return;
  }
  if (room.phase !== "standings") return;

  if (lastRound) {
    const { data: ended } = await client
      .from("duels")
      .update({ status: "finished" })
      .eq("id", room.id)
      .eq("current_round", round)
      .eq("phase", "standings")
      .select("id");
    // Older rooms end on the last round's standings.
    if (Array.isArray(ended) && ended.length > 0)
      await recordRoomEvent(client, {
        duel_id: room.id,
        game_index: gameIndexOf(room),
        round_number: 0,
        event: "game_ended",
        reason: "completed",
      });
    return;
  }

  const startedAt = nowIso();
  await client
    .from("duels")
    .update({
      current_round: round + 1,
      phase: "round_title",
      phase_started_at: startedAt,
      round_started_at: startedAt,
    })
    .eq("id", room.id)
    .eq("current_round", round)
    .eq("phase", "standings");
}

/** Stores a player's Continue tap; the mark only ever rises. */
export async function recordContinue(
  client: any,
  playerId: string,
  round: number,
  phase: ContinuePhase,
): Promise<void> {
  const mark = continueMark(round, phase);
  await client
    .from("duel_players")
    .update({ ready_round: mark, status: "active", last_seen_at: nowIso() })
    .eq("id", playerId)
    .lt("ready_round", mark);
}

/**
 * "Finish now": when the caller is the only player still here, the room
 * finishes outside the winner reveal (roomFlow.endedByForfeit) and everyone
 * who had gone is stored as left. Round results are never touched.
 */
export async function finishGame(
  client: any,
  room: Pick<DuelRow, "id" | "status" | "phase" | "current_round" | "disbanded_at"> &
    Partial<Pick<DuelRow, "tournament_history">>,
  players: readonly DuelPlayerRow[],
  userId: string,
  now: number,
): Promise<{ ok: true; finished: boolean } | { ok: false; message: string }> {
  if (room.status !== "in_progress" || room.disbanded_at) return { ok: true, finished: false };
  if (room.phase === "winner_reveal") return { ok: false, message: "The game is already ending." };
  if (!canFinishNow(players, userId, now))
    return { ok: false, message: "Other players are still here." };

  const { data: claimed } = await client
    .from("duels")
    .update({ status: "finished" })
    .eq("id", room.id)
    .eq("status", "in_progress")
    .eq("current_round", room.current_round)
    .eq("phase", room.phase)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: true, finished: false };
  for (const gone of players.filter((p) => p.user_id !== userId && p.status !== "left"))
    await client.from("duel_players").update({ status: "left" }).eq("id", gone.id);
  await recordRoomEvent(client, {
    duel_id: room.id,
    game_index: gameIndexOf(room),
    round_number: 0,
    event: "game_ended",
    reason: "finish_now",
  });
  return { ok: true, finished: true };
}

/** What a forfeited game's history entry must say, read before the room resets. */
export interface ForfeitRecord {
  /** The history length before Play again appends this game's entry. */
  historyIndex: number;
  winner: string;
  score: number;
  forfeitedBy: string[];
}

/** Null unless the room ended through "Finish now" (roomFlow.forfeitOutcome). */
export function forfeitRecord(
  room: Pick<DuelRow, "status" | "phase" | "disbanded_at" | "tournament_history">,
  players: readonly DuelPlayerRow[],
  results: readonly RoundResultRow[],
): ForfeitRecord | null {
  const outcome = forfeitOutcome(room, players);
  if (!outcome) return null;
  return {
    historyIndex: room.tournament_history?.length ?? 0,
    winner: outcome.winner.display_name,
    score: totalScore([...results], outcome.winner.player_slot),
    forfeitedBy: outcome.forfeited.map((p) => p.display_name),
  };
}

/**
 * Play again's reset (the restart_duel_room RPC) appends this game's history
 * entry with the points leader as winner. For a forfeited game that entry is
 * set to the player who stayed, marked as a forfeit. Only the entry the reset
 * just appended is touched (guarded on the history length and the room being
 * back in its lobby); earlier entries and round scores are never changed.
 */
export async function recordForfeitInHistory(
  client: any,
  roomId: string,
  record: ForfeitRecord,
): Promise<boolean> {
  const { data } = await client
    .from("duels")
    .select("tournament_history, status")
    .eq("id", roomId)
    .maybeSingle();
  const history = (data?.tournament_history ?? null) as TournamentEntry[] | null;
  if (!Array.isArray(history) || data?.status !== "waiting") return false;
  if (history.length !== record.historyIndex + 1) return false;
  const entry: TournamentEntry = {
    ...history[record.historyIndex]!,
    winner: record.winner,
    score: record.score,
    forfeit: true,
    forfeited_by: record.forfeitedBy,
  };
  const { data: written } = await client
    .from("duels")
    .update({ tournament_history: [...history.slice(0, record.historyIndex), entry] })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  return !!written;
}
