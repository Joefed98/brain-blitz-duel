/**
 * The Category Cup and Joulz Championship's own tables (wave 4, W4c; supabase/migrations/20261115300000_tournament_events.sql):
 * each started event's rounds, the seeds, every pairing and bracket match, the finish's award log, the hall of fame,
 * and the month's Score Attack results the Championship qualifies from. Events, entries,
 * results, prizes and trophies are W4b's (src/lib/data/tournaments.server.ts). Server only (service role), typed.
 */
import type { Db, Tables, TablesInsert, TablesUpdate } from "./db.server";
import type { Result } from "./rooms.server";

export type TournamentRoundsRow = Tables<"tournament_rounds">;
export type TournamentSeedRow = Tables<"tournament_seeds">;
export type TournamentMatchRow = Tables<"tournament_matches">;
export type TournamentAwardRow = Tables<"tournament_awards">;
export type HallOfFameRow = Tables<"tournament_hall_of_fame">;

/* ------------------------------------------------------------------ rounds (one row per started event) */

export async function readRounds(client: Db, eventId: string): Promise<Result<TournamentRoundsRow | null>> {
  const { data, error } = await client.from("tournament_rounds").select("*").eq("event_id", eventId).maybeSingle();
  return { data, error };
}

/** Starts an event's rounds once (a racing second start meets the primary key and changes nothing). */
export async function insertRounds(client: Db, row: TablesInsert<"tournament_rounds">): Promise<Result<null>> {
  const { error } = await client.from("tournament_rounds").upsert(row, { onConflict: "event_id", ignoreDuplicates: true });
  return { data: null, error };
}

export async function updateRounds(client: Db, eventId: string, patch: TablesUpdate<"tournament_rounds">): Promise<Result<null>> {
  const { error } = await client.from("tournament_rounds").update(patch).eq("event_id", eventId);
  return { data: null, error };
}

/** One ticker at a time, for at most `ms`. */
export async function lockRounds(client: Db, eventId: string, ms: number): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_rounds_lock", { p_event: eventId, p_ms: ms });
  return { data: data === true, error };
}

export async function unlockRounds(client: Db, eventId: string): Promise<Result<null>> {
  const { error } = await client.rpc("tournament_rounds_unlock", { p_event: eventId });
  return { data: null, error };
}

/* ------------------------------------------------------------------ seeds */

export async function readSeeds(client: Db, eventId: string): Promise<Result<TournamentSeedRow[]>> {
  const { data, error } = await client.from("tournament_seeds").select("*").eq("event_id", eventId).order("seed", { ascending: true });
  return { data: data ?? [], error };
}

export async function insertSeeds(client: Db, rows: TablesInsert<"tournament_seeds">[]): Promise<Result<null>> {
  if (!rows.length) return { data: null, error: null };
  const { error } = await client.from("tournament_seeds").upsert(rows, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  return { data: null, error };
}

/* ------------------------------------------------------------------ matches */

export async function readMatches(client: Db, eventId: string): Promise<Result<TournamentMatchRow[]>> {
  const { data, error } = await client
    .from("tournament_matches")
    .select("*")
    .eq("event_id", eventId)
    .order("round", { ascending: true })
    .order("slot", { ascending: true });
  return { data: data ?? [], error };
}

/** A round's matches, once (the unique stage, round and slot keeps a racing second writer out). */
export async function insertMatches(client: Db, rows: TablesInsert<"tournament_matches">[]): Promise<Result<null>> {
  if (!rows.length) return { data: null, error: null };
  const { error } = await client.from("tournament_matches").upsert(rows, { onConflict: "event_id,stage,round,slot", ignoreDuplicates: true });
  return { data: null, error };
}

/** Moves a match on from one status (true for exactly one caller). */
export async function claimMatchStatus(client: Db, id: string, from: string, patch: TablesUpdate<"tournament_matches">): Promise<Result<boolean>> {
  const { data, error } = await client.from("tournament_matches").update(patch).eq("id", id).eq("status", from).select("id");
  return { data: (data ?? []).length === 1, error };
}

export async function updateMatch(client: Db, id: string, patch: TablesUpdate<"tournament_matches">): Promise<Result<null>> {
  const { error } = await client.from("tournament_matches").update(patch).eq("id", id);
  return { data: null, error };
}

export async function readMatchByRoom(client: Db, roomId: string): Promise<Result<TournamentMatchRow | null>> {
  const { data, error } = await client.from("tournament_matches").select("*").eq("duel_id", roomId).maybeSingle();
  return { data, error };
}

/* ------------------------------------------------------------------ awards and the hall of fame */

export async function readAwards(client: Db, eventId: string): Promise<Result<TournamentAwardRow[]>> {
  const { data, error } = await client.from("tournament_awards").select("*").eq("event_id", eventId);
  return { data: data ?? [], error };
}

/** Logs one award as paid (the primary key: event, entrant, kind). */
export async function insertAward(client: Db, row: TablesInsert<"tournament_awards">): Promise<Result<null>> {
  const { error } = await client.from("tournament_awards").upsert(row, { onConflict: "event_id,user_id,kind", ignoreDuplicates: true });
  return { data: null, error };
}

export async function insertHallOfFame(client: Db, row: TablesInsert<"tournament_hall_of_fame">): Promise<Result<null>> {
  const { error } = await client.from("tournament_hall_of_fame").upsert(row, { onConflict: "month", ignoreDuplicates: true });
  return { data: null, error };
}

/** Every Championship winner, newest month first. */
export async function readHallOfFame(client: Db): Promise<Result<HallOfFameRow[]>> {
  const { data, error } = await client.from("tournament_hall_of_fame").select("*").order("month", { ascending: false });
  return { data: data ?? [], error };
}

/* ------------------------------------------------------------------ flags for Joe's review */

/** One of the server's own flags in a match, logged through W4b's flagRpc (moderation.tournament_flags). */
export interface FlagLogRow {
  player_id: string;
  game_idx: number;
  game: string | null;
  reason: string;
}

/* ------------------------------------------------------------------ the month's Score Attack results (W4b's) */

export interface ScoreAttackResult {
  event_id: string;
  user_id: string;
  place: number;
  total: number | null;
}

/** Every finished daily Score Attack's results in a month ("YYYY-MM"), from W4b's tournament_results. */
export async function readMonthScoreAttackResults(client: Db, month: string): Promise<Result<ScoreAttackResult[]>> {
  const { data: events, error } = await client
    .from("tournament_events")
    .select("id")
    .eq("kind", "score_attack")
    .eq("status", "finished")
    .gte("id", `score_attack:${month}-01`)
    .lte("id", `score_attack:${month}-31`);
  if (error || !events?.length) return { data: [], error };
  const { data, error: e2 } = await client
    .from("tournament_results")
    .select("event_id, user_id, place, total")
    .in("event_id", events.map((e) => e.id));
  return { data: (data ?? []) as ScoreAttackResult[], error: e2 };
}
