/**
 * The Category Cup and Joulz Championship's tables (wave 4, W4c; supabase/migrations/20261115300000_tournament_events.sql):
 * events, entries, matches, payouts, trophies and the hall of fame. Server only (service role); no phone reads any of
 * it directly. Every query the event flow (src/lib/tournaments/eventsFlow.server.ts) makes is here, typed.
 */
import type { Db, Tables, TablesInsert, TablesUpdate } from "./db.server";
import type { Result } from "./rooms.server";

export type TournamentEventRow = Tables<"tournament_events">;
export type TournamentEntryRow = Tables<"tournament_entries">;
export type TournamentMatchRow = Tables<"tournament_matches">;
export type TournamentPayoutRow = Tables<"tournament_payouts">;
export type TournamentTrophyRow = Tables<"tournament_trophies">;
export type HallOfFameRow = Tables<"tournament_hall_of_fame">;

export type EnterAnswer = "entered" | "already" | "closed" | "full";

/* ------------------------------------------------------------------ events */

export async function readEventByKey(client: Db, key: string): Promise<Result<TournamentEventRow | null>> {
  const { data, error } = await client.from("tournament_events").select("*").eq("event_key", key).maybeSingle();
  return { data, error };
}

export async function readEvent(client: Db, id: string): Promise<Result<TournamentEventRow | null>> {
  const { data, error } = await client.from("tournament_events").select("*").eq("id", id).maybeSingle();
  return { data, error };
}

/** Makes the event once (a second caller's insert meets the unique key and reads the first's). */
export async function insertEvent(client: Db, row: TablesInsert<"tournament_events">): Promise<Result<null>> {
  const { error } = await client.from("tournament_events").insert(row);
  return { data: null, error };
}

/** Moves an event on from one status (true for exactly one caller). */
export async function claimEventStatus(
  client: Db,
  id: string,
  from: string,
  patch: TablesUpdate<"tournament_events">,
): Promise<Result<boolean>> {
  const { data, error } = await client.from("tournament_events").update(patch).eq("id", id).eq("status", from).select("id");
  return { data: (data ?? []).length === 1, error };
}

export async function updateEvent(client: Db, id: string, patch: TablesUpdate<"tournament_events">): Promise<Result<null>> {
  const { error } = await client.from("tournament_events").update(patch).eq("id", id);
  return { data: null, error };
}

/** One ticker at a time, for at most `ms`. */
export async function lockEvent(client: Db, id: string, ms: number): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_event_lock", { p_event: id, p_ms: ms });
  return { data: data === true, error };
}

export async function unlockEvent(client: Db, id: string): Promise<Result<null>> {
  const { error } = await client.rpc("tournament_event_unlock", { p_event: id });
  return { data: null, error };
}

/* ------------------------------------------------------------------ entries */

export async function readEntries(client: Db, eventId: string): Promise<Result<TournamentEntryRow[]>> {
  const { data, error } = await client
    .from("tournament_entries")
    .select("*")
    .eq("event_id", eventId)
    .order("entered_at", { ascending: true });
  return { data: data ?? [], error };
}

export async function readEntry(client: Db, eventId: string, userId: string): Promise<Result<TournamentEntryRow | null>> {
  const { data, error } = await client.from("tournament_entries").select("*").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  return { data, error };
}

/** Enters a paid entry atomically (public.tournament_enter). */
export async function enterEvent(
  client: Db,
  input: { eventId: string; userId: string; paidWith: "coins" | "ticket"; coinLineId: number | null; attempt: number; max: number },
): Promise<Result<EnterAnswer | null>> {
  const { data, error } = await client.rpc("tournament_enter", {
    p_event: input.eventId,
    p_user: input.userId,
    p_paid_with: input.paidWith,
    p_coin_line: input.coinLineId,
    p_attempt: input.attempt,
    p_max: input.max,
  });
  return { data: (data as EnterAnswer | null) ?? null, error };
}

/** The Championship's qualifiers, written once when it starts. */
export async function insertQualifiers(client: Db, rows: TablesInsert<"tournament_entries">[]): Promise<Result<null>> {
  if (!rows.length) return { data: null, error: null };
  const { error } = await client.from("tournament_entries").upsert(rows, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  return { data: null, error };
}

/** Moves an entry on from one status (true for exactly one caller): entered → withdrawn / refunded. */
export async function claimEntryStatus(
  client: Db,
  eventId: string,
  userId: string,
  from: string,
  patch: TablesUpdate<"tournament_entries">,
): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("tournament_entries")
    .update(patch)
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("status", from)
    .select("user_id");
  return { data: (data ?? []).length === 1, error };
}

export async function updateEntry(client: Db, eventId: string, userId: string, patch: TablesUpdate<"tournament_entries">): Promise<Result<null>> {
  const { error } = await client.from("tournament_entries").update(patch).eq("event_id", eventId).eq("user_id", userId);
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

/* ------------------------------------------------------------------ prizes */

export async function readPayouts(client: Db, eventId: string): Promise<Result<TournamentPayoutRow[]>> {
  const { data, error } = await client.from("tournament_payouts").select("*").eq("event_id", eventId);
  return { data: data ?? [], error };
}

/** Notes one prize as paid; false when it already was (the primary key: event, entrant, kind). */
export async function insertPayout(client: Db, row: TablesInsert<"tournament_payouts">): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("tournament_payouts")
    .upsert(row, { onConflict: "event_id,user_id,kind", ignoreDuplicates: true })
    .select("user_id");
  return { data: (data ?? []).length === 1, error };
}

export async function insertTrophy(client: Db, row: TablesInsert<"tournament_trophies">): Promise<Result<null>> {
  const { error } = await client.from("tournament_trophies").upsert(row, { onConflict: "user_id,event_id", ignoreDuplicates: true });
  return { data: null, error };
}

export async function readTrophies(client: Db, userId: string): Promise<Result<TournamentTrophyRow[]>> {
  const { data, error } = await client.from("tournament_trophies").select("*").eq("user_id", userId).order("awarded_at", { ascending: false });
  return { data: data ?? [], error };
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
