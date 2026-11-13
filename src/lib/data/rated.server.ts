/**
 * Rated matchmaking's tables (wave 3, W3b; supabase/migrations/20261114200000_matchmaking.sql): the queue,
 * matches and their players, rated runs, run uses and live progress, plus the reads of rooms and the Daily that the
 * recorded-run fallback needs. Server only (service role); no phone reads any of it.
 */
import type { Db, Json, Tables, TablesInsert } from "./db.server";
import type { Result } from "./rooms.server";

export type RatedQueueRow = Tables<"mm_queue">;
export type RatedMatchRow = Tables<"mm_matches">;
export type RatedMatchPlayerRow = Tables<"mm_match_players">;
export type RatedRunRow = Tables<"mm_runs">;
export type RatedProgressRow = Tables<"mm_progress">;

/* ------------------------------------------------------------------ testers */

/** On D1's tester list (shop.testers, read through public.mm_is_tester; false before D1's migration). */
export async function readIsRatedTester(client: Db, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("mm_is_tester", { p_user_id: userId });
  return { data: data === true, error };
}

/* ------------------------------------------------------------------ queue */

export async function readQueueEntry(client: Db, userId: string): Promise<Result<RatedQueueRow | null>> {
  const { data, error } = await client.from("mm_queue").select("*").eq("user_id", userId).maybeSingle();
  return { data, error };
}

/** Starts (or restarts) a search: replaces a waiting entry, never one a match has claimed. */
export async function writeQueueEntry(client: Db, row: TablesInsert<"mm_queue">): Promise<Result<null>> {
  const { error: cleared } = await client.from("mm_queue").delete().eq("user_id", row.user_id).is("match_id", null);
  if (cleared) return { data: null, error: cleared };
  const { error } = await client.from("mm_queue").insert(row);
  return { data: null, error };
}

/** Ends a search that no match has claimed. */
export async function deleteWaitingEntry(client: Db, userId: string): Promise<Result<null>> {
  const { error } = await client.from("mm_queue").delete().eq("user_id", userId).is("match_id", null);
  return { data: null, error };
}

/** Clears a claimed entry once its player has been told about the match. */
export async function deleteClaimedEntry(client: Db, userId: string, matchId: string): Promise<Result<null>> {
  const { error } = await client.from("mm_queue").delete().eq("user_id", userId).eq("match_id", matchId);
  return { data: null, error };
}

/** Everyone still waiting for this format and choice, oldest first. */
export async function readWaiting(client: Db, format: string, choice: string): Promise<Result<RatedQueueRow[]>> {
  const { data, error } = await client
    .from("mm_queue")
    .select("*")
    .eq("format", format)
    .eq("choice", choice)
    .is("match_id", null)
    .order("joined_at", { ascending: true })
    .limit(200);
  return { data: data ?? [], error };
}

/** Puts every listed searcher in `matchId`, or none (public.mm_queue_claim). */
export async function claimQueue(
  client: Db,
  input: { users: string[]; matchId: string; format: string; choice: string },
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("mm_queue_claim", {
    p_users: input.users,
    p_match: input.matchId,
    p_format: input.format,
    p_choice: input.choice,
  });
  return { data: data === true, error };
}

/* ------------------------------------------------------------------ matches */

export async function insertRatedMatch(client: Db, row: TablesInsert<"mm_matches">): Promise<Result<null>> {
  const { error } = await client.from("mm_matches").insert(row);
  return { data: null, error };
}

export async function insertMatchPlayers(client: Db, rows: TablesInsert<"mm_match_players">[]): Promise<Result<null>> {
  const { error } = await client.from("mm_match_players").insert(rows);
  return { data: null, error };
}

export async function readRatedMatch(client: Db, matchId: string): Promise<Result<RatedMatchRow | null>> {
  const { data, error } = await client.from("mm_matches").select("*").eq("id", matchId).maybeSingle();
  return { data, error };
}

export async function readMatchByRoom(client: Db, roomId: string): Promise<Result<RatedMatchRow | null>> {
  const { data, error } = await client.from("mm_matches").select("*").eq("duel_id", roomId).maybeSingle();
  return { data, error };
}

export async function readMatchPlayers(client: Db, matchId: string): Promise<Result<RatedMatchPlayerRow[]>> {
  const { data, error } = await client
    .from("mm_match_players")
    .select("*")
    .eq("match_id", matchId)
    .order("slot", { ascending: true });
  return { data: data ?? [], error };
}

/** The player's matches still playing (at most a few). */
export async function readOpenMatchIds(client: Db, userId: string): Promise<Result<string[]>> {
  const { data: mine, error } = await client.from("mm_match_players").select("match_id").eq("user_id", userId);
  if (error || !mine?.length) return { data: [], error };
  const { data, error: e2 } = await client
    .from("mm_matches")
    .select("id")
    .in("id", mine.map((m) => m.match_id))
    .in("status", ["playing", "settling"]);
  return { data: (data ?? []).map((r) => r.id), error: e2 };
}

/** The settled live matches both players played (head to head; recorded matches have one player, so never match). */
export async function readSettledLiveMatchesBetween(
  client: Db,
  userId: string,
  opponentId: string,
): Promise<Result<{ match: RatedMatchRow; players: RatedMatchPlayerRow[] }[]>> {
  const { data: rows, error } = await client.from("mm_match_players").select("*").in("user_id", [userId, opponentId]);
  if (error || !rows?.length) return { data: [], error };
  const byMatch = new Map<string, RatedMatchPlayerRow[]>();
  for (const r of rows) byMatch.set(r.match_id, [...(byMatch.get(r.match_id) ?? []), r]);
  const shared = [...byMatch].filter(([, ps]) => ps.some((p) => p.user_id === userId) && ps.some((p) => p.user_id === opponentId));
  if (!shared.length) return { data: [], error: null };
  const { data: matches, error: e2 } = await client
    .from("mm_matches")
    .select("*")
    .in("id", shared.map(([id]) => id))
    .eq("kind", "live")
    .eq("status", "settled");
  return { data: (matches ?? []).map((match) => ({ match, players: byMatch.get(match.id) ?? [] })), error: e2 };
}

/** The owner of the viewer's most recent recorded opponent. */
export async function readLastRecordedOwner(client: Db, viewerId: string): Promise<Result<string | null>> {
  const { data: mine, error } = await client.from("mm_match_players").select("match_id").eq("user_id", viewerId);
  if (error || !mine?.length) return { data: null, error };
  const { data, error: e2 } = await client
    .from("mm_matches")
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
    .from("mm_matches")
    .update({ status: "settling", finished_at: finishedAt })
    .eq("id", matchId)
    .eq("status", "playing")
    .select("id");
  return { data: (data ?? []).length === 1, error };
}

/** The settle went through: the result is stored and the match settled. */
export async function markSettled(client: Db, matchId: string, result: Json, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("mm_matches")
    .update({ status: "settled", result, settled_at: at })
    .eq("id", matchId)
    .eq("status", "settling");
  return { data: null, error };
}

/** The settle failed before W3a stored anything: back to playing so the next call retries. */
export async function releaseSettle(client: Db, matchId: string): Promise<Result<null>> {
  const { error } = await client.from("mm_matches").update({ status: "playing" }).eq("id", matchId).eq("status", "settling");
  return { data: null, error };
}

/** A player's rematch accept (the first one stands). */
export async function writeRematchAccept(client: Db, matchId: string, userId: string, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("mm_match_players")
    .update({ rematch_at: at })
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .is("rematch_at", null);
  return { data: null, error };
}

/** Claims the rematch's id on the old match; true for exactly one caller. */
export async function claimRematch(client: Db, matchId: string, rematchId: string): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("mm_matches")
    .update({ rematch_match_id: rematchId })
    .eq("id", matchId)
    .is("rematch_match_id", null)
    .select("id");
  return { data: (data ?? []).length === 1, error };
}

/* ------------------------------------------------------------------ runs and uses */

export async function insertRatedRuns(client: Db, rows: TablesInsert<"mm_runs">[]): Promise<Result<null>> {
  if (!rows.length) return { data: null, error: null };
  const { error } = await client.from("mm_runs").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
  return { data: null, error };
}

/** Rated runs of this format and choice since `sinceIso`, newest first. */
export async function readRatedRuns(client: Db, format: string, choice: string, sinceIso: string): Promise<Result<RatedRunRow[]>> {
  const { data, error } = await client
    .from("mm_runs")
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
    .from("mm_run_uses")
    .select("run_key")
    .in("run_key", keys)
    .gte("used_at", dayStartIso);
  for (const row of data ?? []) counts.set(row.run_key, (counts.get(row.run_key) ?? 0) + 1);
  return { data: counts, error };
}

/** Counts one use of a run unless it already has `max` today (public.mm_run_use). */
export async function useRun(
  client: Db,
  input: { key: string; viewerId: string; matchId: string; dayStartIso: string; max: number },
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("mm_run_use", {
    p_key: input.key,
    p_viewer: input.viewerId,
    p_match: input.matchId,
    p_day_start: input.dayStartIso,
    p_max: input.max,
  });
  return { data: data === true, error };
}

/* ------------------------------------------------------------------ live progress (display only) */

export async function writeProgress(client: Db, row: TablesInsert<"mm_progress">): Promise<Result<null>> {
  const { error } = await client.from("mm_progress").upsert(row, { onConflict: "match_id,user_id" });
  return { data: null, error };
}

export async function readProgress(client: Db, matchId: string): Promise<Result<RatedProgressRow[]>> {
  const { data, error } = await client.from("mm_progress").select("*").eq("match_id", matchId);
  return { data: data ?? [], error };
}

/* ------------------------------------------------------------------ fallback sources */

/** A finished room's stored deal and the players' results (the recorded-run fallback). */
export interface FinishedRoomSource {
  room: Pick<Tables<"duels">, "id" | "puzzles_public" | "phase_started_at">;
  privatePuzzles: Record<string, unknown>[];
  players: Pick<Tables<"duel_players">, "player_slot" | "user_id" | "display_name">[];
  results: (Pick<Tables<"round_results">, "player_slot" | "round_number" | "score" | "ms_remaining" | "reaction_avg_ms" | "answer" | "extra"> & { look: Json | null })[];
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
  const { data, error } = await client.from("mm_matches").select("duel_id").in("duel_id", roomIds);
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
        reaction_avg_ms: r.reaction_avg_ms, answer: r.answer, extra: r.extra, look: lookOf(r),
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
  results: (Pick<Tables<"async_results">, "round_number" | "score" | "ms_remaining" | "reaction_avg_ms" | "answer" | "answered" | "extra"> & { look: Json | null })[];
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
        answer: r.answer, answered: r.answered, extra: r.extra, look: lookOf(r),
      })),
    },
    error: e2 ?? e3 ?? null,
  };
}

/** Undoes a claim no match was made for (a recorded run that couldn't be taken after all). */
export async function releaseClaim(client: Db, userId: string, matchId: string): Promise<Result<null>> {
  const { error } = await client.from("mm_queue").update({ match_id: null }).eq("user_id", userId).eq("match_id", matchId);
  return { data: null, error };
}

export async function readRatedRun(client: Db, key: string): Promise<Result<RatedRunRow | null>> {
  const { data, error } = await client.from("mm_runs").select("*").eq("key", key).maybeSingle();
  return { data, error };
}

/* ------------------------------------------------------------------ practice deals (Practice as a recorded-run source) */

export type PracticeDealRow = Tables<"mm_practice_deals">;

/** Stores a counted Practice play's deal (once per play). */
export async function insertPracticeDeal(client: Db, row: TablesInsert<"mm_practice_deals">): Promise<Result<null>> {
  const { error } = await client.from("mm_practice_deals").upsert(row, { onConflict: "play_id", ignoreDuplicates: true });
  return { data: null, error };
}

/** Practice deals since `sinceIso`, newest first, never the viewer's own and never flagged. */
export async function readRecentPracticeDeals(client: Db, sinceIso: string, viewerId: string, limit: number): Promise<Result<PracticeDealRow[]>> {
  const { data, error } = await client
    .from("mm_practice_deals")
    .select("*")
    .gte("recorded_at", sinceIso)
    .neq("user_id", viewerId)
    .eq("flagged", false)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return { data: data ?? [], error };
}

/** Which of these users have asked to delete their account (hidden at once, removed after 30 days). */
export async function readDeletionRequested(client: Db, userIds: string[]): Promise<Result<Set<string>>> {
  if (!userIds.length) return { data: new Set(), error: null };
  const { data, error } = await client.from("profiles").select("user_id, deletion_requested_at").in("user_id", userIds);
  return { data: new Set((data ?? []).filter((r) => r.deletion_requested_at !== null).map((r) => r.user_id)), error };
}

/** Removes Practice deals older than 15 days (public.mm_purge_practice_deals); answers how many went. */
export async function purgePracticeDeals(client: Db): Promise<Result<number>> {
  const { data, error } = await client.rpc("mm_purge_practice_deals");
  return { data: typeof data === "number" ? data : 0, error };
}

/* ------------------------------------------------------------------ leaving a match (Joe, 12 Nov 2026) */

/** A player's own Leave, once. */
export async function markMatchPlayerLeft(client: Db, matchId: string, userId: string, at: string): Promise<Result<null>> {
  const { error } = await client.from("mm_match_players").update({ left_at: at }).eq("match_id", matchId).eq("user_id", userId).is("left_at", null);
  return { data: null, error };
}

/** Players found gone for good from a 4- or 8-player match that carries on, once each. */
export async function markMatchPlayersGone(client: Db, matchId: string, userIds: string[], at: string): Promise<Result<null>> {
  if (!userIds.length) return { data: null, error: null };
  const { error } = await client.from("mm_match_players").update({ gone_at: at }).eq("match_id", matchId).in("user_id", userIds).is("gone_at", null);
  return { data: null, error };
}

/** Ends a playing match by an abort or a forfeit; true for exactly one caller. An abort also marks it abandoned. */
export async function claimMatchEnd(
  client: Db,
  matchId: string,
  end: { ended: "abort" | "forfeit"; at: string; step: string; leavers: Json },
): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("mm_matches")
    .update({ ended: end.ended, ended_at: end.at, ended_step: end.step, leavers: end.leavers, ...(end.ended === "abort" ? { status: "abandoned" } : {}) })
    .eq("id", matchId)
    .eq("status", "playing")
    .is("ended", null)
    .select("id");
  return { data: (data ?? []).length === 1, error };
}

/** A rated room ended by a forfeit or an abort: finished now (an abort also disbanded), guarded on it still playing. */
export async function endRatedRoom(client: Db, roomId: string, at: string, disband: boolean): Promise<Result<null>> {
  const { error } = await client
    .from("duels")
    .update(disband ? { status: "finished", phase_started_at: at, disbanded_at: at } : { status: "finished", phase_started_at: at })
    .eq("id", roomId)
    .eq("status", "in_progress");
  return { data: null, error };
}

/** The leavers of a rated room no longer take part (the room's own flow stops waiting for them). */
export async function markRoomPlayersLeft(client: Db, roomId: string, userIds: string[]): Promise<Result<null>> {
  if (!userIds.length) return { data: null, error: null };
  const { error } = await client.from("duel_players").update({ status: "left" }).eq("duel_id", roomId).in("user_id", userIds);
  return { data: null, error };
}

/**
 * When this player was among an aborted live match's leavers (left during set-up) since `sinceIso`, newest first
 * (public.mm_recent_aborts, service role; the queue's cooldown). Empty on a database without the function.
 */
export async function readRecentAborts(client: Db, userId: string, sinceIso: string): Promise<Result<number[]>> {
  const { data, error } = await client.rpc("mm_recent_aborts", { p_user: userId, p_since: sinceIso });
  const rows = (Array.isArray(data) ? data : []) as unknown[];
  const times = rows
    .map((r) => Date.parse(typeof r === "string" ? r : String((r as Record<string, unknown>)?.["mm_recent_aborts"] ?? "")))
    .filter(Number.isFinite);
  return { data: times, error };
}
