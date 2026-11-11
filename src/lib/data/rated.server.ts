/**
 * Rated matchmaking's tables (wave 3, W3b; supabase/migrations/20261114200000_rated_matchmaking.sql): the queue,
 * matches and their players, rated runs, run uses and live progress, plus the reads of rooms and the Daily that the
 * recorded-run fallback needs. Server only (service role); no phone reads any of it.
 */
import type { Db, Json, Tables, TablesInsert } from "./db.server";
import type { Result } from "./rooms.server";

export type RatedQueueRow = Tables<"rated_queue">;
export type RatedMatchRow = Tables<"rated_matches">;
export type RatedMatchPlayerRow = Tables<"rated_match_players">;
export type RatedRunRow = Tables<"rated_runs">;
export type RatedProgressRow = Tables<"rated_progress">;

/* ------------------------------------------------------------------ testers */

/** On D1's tester list (shop.testers, read through public.rated_is_tester; false before D1's migration). */
export async function readIsRatedTester(client: Db, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("rated_is_tester", { p_user_id: userId });
  return { data: data === true, error };
}

/* ------------------------------------------------------------------ queue */

export async function readQueueEntry(client: Db, userId: string): Promise<Result<RatedQueueRow | null>> {
  const { data, error } = await client.from("rated_queue").select("*").eq("user_id", userId).maybeSingle();
  return { data, error };
}

/** Starts (or restarts) a search: replaces a waiting entry, never one a match has claimed. */
export async function writeQueueEntry(client: Db, row: TablesInsert<"rated_queue">): Promise<Result<null>> {
  const { error: cleared } = await client.from("rated_queue").delete().eq("user_id", row.user_id).is("match_id", null);
  if (cleared) return { data: null, error: cleared };
  const { error } = await client.from("rated_queue").insert(row);
  return { data: null, error };
}

/** Ends a search that no match has claimed. */
export async function deleteWaitingEntry(client: Db, userId: string): Promise<Result<null>> {
  const { error } = await client.from("rated_queue").delete().eq("user_id", userId).is("match_id", null);
  return { data: null, error };
}

/** Clears a claimed entry once its player has been told about the match. */
export async function deleteClaimedEntry(client: Db, userId: string, matchId: string): Promise<Result<null>> {
  const { error } = await client.from("rated_queue").delete().eq("user_id", userId).eq("match_id", matchId);
  return { data: null, error };
}

/** Everyone still waiting for this format and choice, oldest first. */
export async function readWaiting(client: Db, format: string, choice: string): Promise<Result<RatedQueueRow[]>> {
  const { data, error } = await client
    .from("rated_queue")
    .select("*")
    .eq("format", format)
    .eq("choice", choice)
    .is("match_id", null)
    .order("joined_at", { ascending: true })
    .limit(200);
  return { data: data ?? [], error };
}

/** Puts every listed searcher in `matchId`, or none (public.rated_queue_claim). */
export async function claimQueue(
  client: Db,
  input: { users: string[]; matchId: string; format: string; choice: string },
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("rated_queue_claim", {
    p_users: input.users,
    p_match: input.matchId,
    p_format: input.format,
    p_choice: input.choice,
  });
  return { data: data === true, error };
}

/* ------------------------------------------------------------------ matches */

export async function insertRatedMatch(client: Db, row: TablesInsert<"rated_matches">): Promise<Result<null>> {
  const { error } = await client.from("rated_matches").insert(row);
  return { data: null, error };
}

export async function insertMatchPlayers(client: Db, rows: TablesInsert<"rated_match_players">[]): Promise<Result<null>> {
  const { error } = await client.from("rated_match_players").insert(rows);
  return { data: null, error };
}

export async function readRatedMatch(client: Db, matchId: string): Promise<Result<RatedMatchRow | null>> {
  const { data, error } = await client.from("rated_matches").select("*").eq("id", matchId).maybeSingle();
  return { data, error };
}

export async function readMatchByRoom(client: Db, roomId: string): Promise<Result<RatedMatchRow | null>> {
  const { data, error } = await client.from("rated_matches").select("*").eq("duel_id", roomId).maybeSingle();
  return { data, error };
}

export async function readMatchPlayers(client: Db, matchId: string): Promise<Result<RatedMatchPlayerRow[]>> {
  const { data, error } = await client
    .from("rated_match_players")
    .select("*")
    .eq("match_id", matchId)
    .order("slot", { ascending: true });
  return { data: data ?? [], error };
}

/** The player's matches still playing (at most a few). */
export async function readOpenMatchIds(client: Db, userId: string): Promise<Result<string[]>> {
  const { data: mine, error } = await client.from("rated_match_players").select("match_id").eq("user_id", userId);
  if (error || !mine?.length) return { data: [], error };
  const { data, error: e2 } = await client
    .from("rated_matches")
    .select("id")
    .in("id", mine.map((m) => m.match_id))
    .in("status", ["playing", "settling"]);
  return { data: (data ?? []).map((r) => r.id), error: e2 };
}

/** The owner of the viewer's most recent recorded opponent. */
export async function readLastRecordedOwner(client: Db, viewerId: string): Promise<Result<string | null>> {
  const { data: mine, error } = await client.from("rated_match_players").select("match_id").eq("user_id", viewerId);
  if (error || !mine?.length) return { data: null, error };
  const { data, error: e2 } = await client
    .from("rated_matches")
    .select("recorded_owner, created_at")
    .in("id", mine.map((m) => m.match_id))
    .eq("kind", "recorded")
    .order("created_at", { ascending: false })
    .limit(1);
  return { data: data?.[0]?.recorded_owner ?? null, error: e2 };
}

/** Claims a match for settling (playing → settling); true for exactly one caller. */
export async function claimSettle(client: Db, matchId: string, finishedAt: string): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("rated_matches")
    .update({ status: "settling", finished_at: finishedAt })
    .eq("id", matchId)
    .eq("status", "playing")
    .select("id");
  return { data: (data ?? []).length === 1, error };
}

/** The settle went through: the result is stored and the match settled. */
export async function markSettled(client: Db, matchId: string, result: Json, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("rated_matches")
    .update({ status: "settled", result, settled_at: at })
    .eq("id", matchId)
    .eq("status", "settling");
  return { data: null, error };
}

/** The settle failed before W3a stored anything: back to playing so the next call retries. */
export async function releaseSettle(client: Db, matchId: string): Promise<Result<null>> {
  const { error } = await client.from("rated_matches").update({ status: "playing" }).eq("id", matchId).eq("status", "settling");
  return { data: null, error };
}

/** A player's rematch accept (the first one stands). */
export async function writeRematchAccept(client: Db, matchId: string, userId: string, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("rated_match_players")
    .update({ rematch_at: at })
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .is("rematch_at", null);
  return { data: null, error };
}

/** Claims the rematch's id on the old match; true for exactly one caller. */
export async function claimRematch(client: Db, matchId: string, rematchId: string): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("rated_matches")
    .update({ rematch_match_id: rematchId })
    .eq("id", matchId)
    .is("rematch_match_id", null)
    .select("id");
  return { data: (data ?? []).length === 1, error };
}

/* ------------------------------------------------------------------ runs and uses */

export async function insertRatedRuns(client: Db, rows: TablesInsert<"rated_runs">[]): Promise<Result<null>> {
  if (!rows.length) return { data: null, error: null };
  const { error } = await client.from("rated_runs").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
  return { data: null, error };
}

/** Rated runs of this format and choice since `sinceIso`, newest first. */
export async function readRatedRuns(client: Db, format: string, choice: string, sinceIso: string): Promise<Result<RatedRunRow[]>> {
  const { data, error } = await client
    .from("rated_runs")
    .select("*")
    .eq("format", format)
    .eq("choice", choice)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false })
    .limit(500);
  return { data: data ?? [], error };
}

/** How many times each run has been played against since `dayStartIso`. */
export async function readRunUses(client: Db, keys: string[], dayStartIso: string): Promise<Result<Map<string, number>>> {
  const counts = new Map<string, number>();
  if (!keys.length) return { data: counts, error: null };
  const { data, error } = await client
    .from("rated_run_uses")
    .select("run_key")
    .in("run_key", keys)
    .gte("used_at", dayStartIso);
  for (const row of data ?? []) counts.set(row.run_key, (counts.get(row.run_key) ?? 0) + 1);
  return { data: counts, error };
}

/** Counts one use of a run unless it already has `max` today (public.rated_run_use). */
export async function useRun(
  client: Db,
  input: { key: string; viewerId: string; matchId: string; dayStartIso: string; max: number },
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("rated_run_use", {
    p_key: input.key,
    p_viewer: input.viewerId,
    p_match: input.matchId,
    p_day_start: input.dayStartIso,
    p_max: input.max,
  });
  return { data: data === true, error };
}

/* ------------------------------------------------------------------ live progress (display only) */

export async function writeProgress(client: Db, row: TablesInsert<"rated_progress">): Promise<Result<null>> {
  const { error } = await client.from("rated_progress").upsert(row, { onConflict: "match_id,user_id" });
  return { data: null, error };
}

export async function readProgress(client: Db, matchId: string): Promise<Result<RatedProgressRow[]>> {
  const { data, error } = await client.from("rated_progress").select("*").eq("match_id", matchId);
  return { data: data ?? [], error };
}

/* ------------------------------------------------------------------ fallback sources */

/** A finished room's stored deal and the players' results (the recorded-run fallback). */
export interface FinishedRoomSource {
  room: Pick<Tables<"duels">, "id" | "puzzles_public" | "phase_started_at">;
  privatePuzzles: Record<string, unknown>[];
  players: Pick<Tables<"duel_players">, "player_slot" | "user_id" | "display_name">[];
  results: (Pick<Tables<"round_results">, "player_slot" | "round_number" | "score" | "ms_remaining" | "reaction_avg_ms" | "answer"> & { look: Json | null })[];
}

/** E1's stored look on a result row (wave 2, the `look` column; null before E1's migration or for none). */
function lookOf(row: object): Json | null {
  return "look" in row ? ((row as { look: Json | null }).look ?? null) : null;
}

/** Finished, not disbanded rooms that ended since `sinceIso`, newest first (rated rooms left out by the caller). */
export async function readFinishedRoomIds(client: Db, sinceIso: string, limit: number): Promise<Result<string[]>> {
  const { data, error } = await client
    .from("duels")
    .select("id")
    .eq("status", "finished")
    .is("disbanded_at", null)
    .gte("phase_started_at", sinceIso)
    .order("phase_started_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []).map((r) => r.id), error };
}

/** Which of these rooms are rated matches' rooms. */
export async function readRatedRoomIds(client: Db, roomIds: string[]): Promise<Result<Set<string>>> {
  if (!roomIds.length) return { data: new Set(), error: null };
  const { data, error } = await client.from("rated_matches").select("duel_id").in("duel_id", roomIds);
  return { data: new Set((data ?? []).map((r) => r.duel_id).filter((id): id is string => !!id)), error };
}

export async function readFinishedRoomSource(client: Db, roomId: string): Promise<Result<FinishedRoomSource | null>> {
  const { data: room, error } = await client.from("duels").select("id, puzzles_public, phase_started_at").eq("id", roomId).maybeSingle();
  if (error || !room) return { data: null, error };
  const [{ data: secrets, error: e1 }, { data: players, error: e2 }, { data: results, error: e3 }] = await Promise.all([
    client.from("duel_secrets").select("puzzles_private").eq("duel_id", roomId).maybeSingle(),
    client.from("duel_players").select("player_slot, user_id, display_name").eq("duel_id", roomId),
    // "*" so E1's `look` comes with each row once its migration is applied (and nothing breaks before).
    client.from("round_results").select("*").eq("duel_id", roomId),
  ]);
  const priv = Array.isArray(secrets?.puzzles_private) ? (secrets.puzzles_private as Record<string, unknown>[]) : [];
  return {
    data: {
      room,
      privatePuzzles: priv,
      players: players ?? [],
      results: (results ?? []).map((r) => ({
        player_slot: r.player_slot, round_number: r.round_number, score: r.score, ms_remaining: r.ms_remaining,
        reaction_avg_ms: r.reaction_avg_ms, answer: r.answer, look: lookOf(r),
      })),
    },
    error: e1 ?? e2 ?? e3 ?? null,
  };
}

/** A finished Daily attempt and its room's deal (the recorded-run fallback). */
export interface DailyAttemptSource {
  attempt: Pick<Tables<"async_attempts">, "id" | "user_id" | "display_name" | "finished_at">;
  room: Pick<Tables<"async_rooms">, "id" | "kind" | "puzzles_public">;
  privatePuzzles: Record<string, unknown>[];
  results: (Pick<Tables<"async_results">, "round_number" | "score" | "ms_remaining" | "reaction_avg_ms" | "answer" | "answered"> & { look: Json | null })[];
}

/** Daily attempts finished since `sinceIso`, newest first (never challenges). */
export async function readFinishedDailyAttemptIds(client: Db, sinceIso: string, limit: number): Promise<Result<string[]>> {
  const { data: rooms, error } = await client
    .from("async_rooms")
    .select("id")
    .in("kind", ["daily_puzzle", "daily_arcade"])
    .gte("closes_at", sinceIso);
  if (error || !rooms?.length) return { data: [], error };
  const { data, error: e2 } = await client
    .from("async_attempts")
    .select("id")
    .in("room_id", rooms.map((r) => r.id))
    .not("finished_at", "is", null)
    .gte("finished_at", sinceIso)
    .order("finished_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []).map((r) => r.id), error: e2 };
}

export async function readDailyAttemptSource(client: Db, attemptId: string): Promise<Result<DailyAttemptSource | null>> {
  const { data: attempt, error } = await client
    .from("async_attempts")
    .select("id, user_id, display_name, finished_at, room_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !attempt) return { data: null, error };
  const [{ data: room, error: e1 }, { data: secrets, error: e2 }, { data: results, error: e3 }] = await Promise.all([
    client.from("async_rooms").select("id, kind, puzzles_public").eq("id", attempt.room_id).maybeSingle(),
    client.from("async_room_secrets").select("puzzles_private").eq("room_id", attempt.room_id).maybeSingle(),
    client.from("async_results").select("*").eq("attempt_id", attemptId),
  ]);
  if (!room) return { data: null, error: e1 };
  const priv = Array.isArray(secrets?.puzzles_private) ? (secrets.puzzles_private as Record<string, unknown>[]) : [];
  return {
    data: {
      attempt: { id: attempt.id, user_id: attempt.user_id, display_name: attempt.display_name, finished_at: attempt.finished_at },
      room,
      privatePuzzles: priv,
      results: (results ?? []).map((r) => ({
        round_number: r.round_number, score: r.score, ms_remaining: r.ms_remaining, reaction_avg_ms: r.reaction_avg_ms,
        answer: r.answer, answered: r.answered, look: lookOf(r),
      })),
    },
    error: e2 ?? e3 ?? null,
  };
}

/** Undoes a claim no match was made for (a recorded run that couldn't be taken after all). */
export async function releaseClaim(client: Db, userId: string, matchId: string): Promise<Result<null>> {
  const { error } = await client.from("rated_queue").update({ match_id: null }).eq("user_id", userId).eq("match_id", matchId);
  return { data: null, error };
}

export async function readRatedRun(client: Db, key: string): Promise<Result<RatedRunRow | null>> {
  const { data, error } = await client.from("rated_runs").select("*").eq("key", key).maybeSingle();
  return { data, error };
}
