/**
 * Tournaments' tables (wave 4, W4b; supabase/migrations/20261115200000_tournaments.sql; docs/tournaments/interface.md
 * section 5). Server only (service role). Every write is one of the migration's public.tournament_* functions: no
 * table here is written directly, by anyone.
 */
import type { Db, Json, Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type TournamentEventRow = Tables<"tournament_events">;
export type TournamentEntryRow = Tables<"tournament_entries">;
export type TournamentReminderRow = Tables<"tournament_reminders">;
export type ArenaQueueRow = Tables<"tournament_arena_queue">;
export type ArenaDuelRow = Tables<"tournament_arena_duels">;
export type ArenaPlayerRow = Tables<"tournament_arena_players">;
export type TournamentResultRow = Tables<"tournament_results">;
export type TournamentPrizeRow = Tables<"tournament_prizes">;
export type TournamentTrophyRow = Tables<"tournament_trophies">;

export type EnterStatus = "entered" | "duplicate" | "closed" | "no_account" | "insufficient" | "no_ticket" | "bad_entry";
export interface EnterAnswer {
  status: EnterStatus;
  entry?: string;
  ledger_id?: number | null;
  consumable_line?: number | null;
}
export interface CancelAnswer {
  status: "cancelled" | "not_cancellable";
  refunded?: number;
}
export interface SettleAnswer {
  status: "settled" | "already";
  a_points: number;
  b_points: number;
  a_streak?: number;
  b_streak?: number;
  /** Each player's best run of games won in a row in this Arena, after this duel. */
  a_best_game_streak?: number;
  b_best_game_streak?: number;
}
export interface PrizeAnswer {
  status: "paid" | "duplicate" | "no_account" | "not_finished" | string;
  coins?: number;
  trophy?: boolean;
}

const asObject = <T>(value: Json | null | undefined): T | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as unknown as T) : null;

/* ------------------------------------------------------------------ events */

export async function ensureEventRow(
  client: Db,
  ev: { id: string; kind: string; title: string; pick: string; startsAt: number; endsAt: number },
): Promise<Result<null>> {
  const { error } = await client.rpc("tournament_ensure_event", {
    p_id: ev.id,
    p_kind: ev.kind,
    p_title: ev.title,
    p_pick: ev.pick,
    p_starts: new Date(ev.startsAt).toISOString(),
    p_ends: new Date(ev.endsAt).toISOString(),
  });
  return { data: null, error };
}

export async function readEvent(client: Db, id: string): Promise<Result<TournamentEventRow | null>> {
  const { data, error } = await client.from("tournament_events").select("*").eq("id", id).maybeSingle();
  return { data, error };
}

export async function readEvents(client: Db, ids: readonly string[]): Promise<Result<TournamentEventRow[]>> {
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await client.from("tournament_events").select("*").in("id", [...ids]);
  return { data: data ?? [], error };
}

/** Events whose window overlaps [fromIso, toIso). */
export async function readEventsBetween(client: Db, fromIso: string, toIso: string): Promise<Result<TournamentEventRow[]>> {
  const { data, error } = await client
    .from("tournament_events")
    .select("*")
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso)
    .order("starts_at", { ascending: true });
  return { data: data ?? [], error };
}

/** Events not yet settled whose window has opened (the tick's work list). */
export async function readOpenEvents(client: Db, beforeIso: string): Promise<Result<TournamentEventRow[]>> {
  const { data, error } = await client
    .from("tournament_events")
    .select("*")
    .in("status", ["scheduled", "live"])
    .lt("starts_at", beforeIso)
    .order("starts_at", { ascending: true })
    .limit(50);
  return { data: data ?? [], error };
}

export async function setEventStatus(client: Db, id: string, from: string[], to: "live" | "finished"): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_set_status", { p_event: id, p_from: from, p_to: to });
  return { data: data === true, error };
}

export async function setEventRoom(client: Db, id: string, roomId: string): Promise<Result<string | null>> {
  const { data, error } = await client.rpc("tournament_set_room", { p_event: id, p_room: roomId });
  return { data: typeof data === "string" ? data : null, error };
}

export async function cancelEventRpc(client: Db, id: string, reason: string): Promise<Result<CancelAnswer | null>> {
  const { data, error } = await client.rpc("tournament_cancel", { p_event: id, p_reason: reason });
  return { data: asObject<CancelAnswer>(data), error };
}

/* ------------------------------------------------------------------ entries and reminders */

export async function enterRpc(
  client: Db,
  input: { eventId: string; userId: string; entry: string; coins: number },
): Promise<Result<EnterAnswer | null>> {
  const { data, error } = await client.rpc("tournament_enter", {
    p_event: input.eventId,
    p_user_id: input.userId,
    p_entry: input.entry,
    p_coins: input.coins,
  });
  return { data: asObject<EnterAnswer>(data), error };
}

export async function readEntry(client: Db, eventId: string, userId: string): Promise<Result<TournamentEntryRow | null>> {
  const { data, error } = await client.from("tournament_entries").select("*").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  return { data, error };
}

export async function readEntries(client: Db, eventId: string): Promise<Result<TournamentEntryRow[]>> {
  const { data, error } = await client.from("tournament_entries").select("*").eq("event_id", eventId);
  return { data: data ?? [], error };
}

export async function readMyEntries(client: Db, userId: string, limit = 30): Promise<Result<TournamentEntryRow[]>> {
  const { data, error } = await client
    .from("tournament_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entered_at", { ascending: false })
    .limit(limit);
  return { data: data ?? [], error };
}

export async function remindRpc(client: Db, eventId: string, userId: string, on: boolean): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_remind", { p_event: eventId, p_user_id: userId, p_on: on });
  return { data: data === true, error };
}

export async function readReminder(client: Db, eventId: string, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.from("tournament_reminders").select("event_id").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  return { data: data !== null && data !== undefined, error };
}

export async function readMyReminders(client: Db, userId: string, eventIds: readonly string[]): Promise<Result<string[]>> {
  if (!eventIds.length) return { data: [], error: null };
  const { data, error } = await client.from("tournament_reminders").select("event_id").eq("user_id", userId).in("event_id", [...eventIds]);
  return { data: (data ?? []).map((r) => r.event_id), error };
}

/** Reminders not yet sent for an event. */
export async function readPendingReminders(client: Db, eventId: string): Promise<Result<string[]>> {
  const { data, error } = await client.from("tournament_reminders").select("user_id").eq("event_id", eventId).is("notified_at", null);
  return { data: (data ?? []).map((r) => r.user_id), error };
}

export async function markReminded(client: Db, eventId: string, users: readonly string[]): Promise<Result<number>> {
  if (!users.length) return { data: 0, error: null };
  const { data, error } = await client.rpc("tournament_mark_reminded", { p_event: eventId, p_users: [...users] });
  return { data: typeof data === "number" ? data : 0, error };
}

/* ------------------------------------------------------------------ the Arena */

export async function arenaJoinRpc(client: Db, eventId: string, userId: string, rating: number): Promise<Result<string | null>> {
  const { data, error } = await client.rpc("tournament_arena_join", { p_event: eventId, p_user_id: userId, p_rating: Math.round(rating) });
  return { data: typeof data === "string" ? data : null, error };
}

export async function arenaLeaveRpc(client: Db, eventId: string, userId: string): Promise<Result<null>> {
  const { error } = await client.rpc("tournament_arena_leave", { p_event: eventId, p_user_id: userId });
  return { data: null, error };
}

export async function readArenaQueue(client: Db, eventId: string): Promise<Result<ArenaQueueRow[]>> {
  const { data, error } = await client.from("tournament_arena_queue").select("*").eq("event_id", eventId);
  return { data: data ?? [], error };
}

export async function arenaPairRpc(client: Db, eventId: string, a: string, b: string, duelId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_arena_pair", { p_event: eventId, p_a: a, p_b: b, p_duel: duelId });
  return { data: data === true, error };
}

export async function arenaSetRoomRpc(client: Db, duelId: string, roomId: string): Promise<Result<null>> {
  const { error } = await client.rpc("tournament_arena_set_room", { p_duel: duelId, p_room: roomId });
  return { data: null, error };
}

export async function arenaVoidRpc(client: Db, duelId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_arena_void", { p_duel: duelId });
  return { data: data === true, error };
}

export async function arenaSettleRpc(
  client: Db,
  input: { duelId: string; winner: "a" | "b" | "draw"; aScore: number; bScore: number; games: Json },
): Promise<Result<SettleAnswer | null>> {
  const { data, error } = await client.rpc("tournament_arena_settle", {
    p_duel: input.duelId,
    p_winner: input.winner,
    p_a_score: Math.round(input.aScore),
    p_b_score: Math.round(input.bScore),
    p_games: input.games,
  });
  return { data: asObject<SettleAnswer>(data), error };
}

export async function readArenaDuels(client: Db, eventId: string): Promise<Result<ArenaDuelRow[]>> {
  const { data, error } = await client.from("tournament_arena_duels").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
  return { data: data ?? [], error };
}

export async function readArenaDuel(client: Db, duelId: string): Promise<Result<ArenaDuelRow | null>> {
  const { data, error } = await client.from("tournament_arena_duels").select("*").eq("id", duelId).maybeSingle();
  return { data, error };
}

export async function readArenaDuelByRoom(client: Db, roomId: string): Promise<Result<ArenaDuelRow | null>> {
  const { data, error } = await client.from("tournament_arena_duels").select("*").eq("duel_id", roomId).maybeSingle();
  return { data, error };
}

/** The caller's duels in an event still playing. */
export async function readMyOpenDuels(client: Db, eventId: string, userId: string): Promise<Result<ArenaDuelRow[]>> {
  const [a, b] = await Promise.all([
    client.from("tournament_arena_duels").select("*").eq("event_id", eventId).eq("status", "playing").eq("a_user", userId),
    client.from("tournament_arena_duels").select("*").eq("event_id", eventId).eq("status", "playing").eq("b_user", userId),
  ]);
  return { data: [...(a.data ?? []), ...(b.data ?? [])], error: a.error ?? b.error };
}

export async function readArenaPlayers(client: Db, eventId: string): Promise<Result<ArenaPlayerRow[]>> {
  const { data, error } = await client.from("tournament_arena_players").select("*").eq("event_id", eventId);
  return { data: data ?? [], error };
}

/* ------------------------------------------------------------------ results, prizes, trophies */

export async function finishRpc(
  client: Db,
  eventId: string,
  rows: { user_id: string; place: number; points: number | null; total: number | null; tie_ms: number | null }[],
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_finish", { p_event: eventId, p_rows: rows as unknown as Json });
  return { data: data === true, error };
}

export async function readResults(client: Db, eventId: string): Promise<Result<TournamentResultRow[]>> {
  const { data, error } = await client.from("tournament_results").select("*").eq("event_id", eventId).order("place", { ascending: true });
  return { data: data ?? [], error };
}

export async function readMyResults(client: Db, userId: string, eventIds: readonly string[]): Promise<Result<TournamentResultRow[]>> {
  if (!eventIds.length) return { data: [], error: null };
  const { data, error } = await client.from("tournament_results").select("*").eq("user_id", userId).in("event_id", [...eventIds]);
  return { data: data ?? [], error };
}

export async function payPrizeRpc(
  client: Db,
  input: { eventId: string; userId: string; place: number; coins: number; medal: string | null; title: string | null },
): Promise<Result<PrizeAnswer | null>> {
  const { data, error } = await client.rpc("tournament_pay_prize", {
    p_event: input.eventId,
    p_user_id: input.userId,
    p_place: input.place,
    p_coins: input.coins,
    p_medal: input.medal,
    p_title: input.title,
  });
  return { data: asObject<PrizeAnswer>(data), error };
}

export async function readMyPrizes(client: Db, userId: string, eventIds: readonly string[]): Promise<Result<TournamentPrizeRow[]>> {
  if (!eventIds.length) return { data: [], error: null };
  const { data, error } = await client.from("tournament_prizes").select("*").eq("user_id", userId).in("event_id", [...eventIds]);
  return { data: data ?? [], error };
}

export async function readTrophies(client: Db, userId: string): Promise<Result<TournamentTrophyRow[]>> {
  const { data, error } = await client
    .from("tournament_trophies")
    .select("*")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false });
  return { data: data ?? [], error };
}

/** How many gold trophies an account holds (Serial Winner). */
export async function readGoldCount(client: Db, userId: string): Promise<Result<number>> {
  const { data, error } = await client.from("tournament_trophies").select("event_id").eq("user_id", userId).eq("medal", "gold");
  return { data: (data ?? []).length, error };
}

/* ------------------------------------------------------------------ flagged runs (Joe's review) */

/** Logs one of the server's own flags once (moderation.tournament_flags, through public.tournament_flag). */
export async function flagRpc(
  client: Db,
  input: { eventId: string; playerId: string; source: "arena_duel" | "score_attack" | "cup_match" | "championship_match"; sourceId: string; gameIdx: number; game: string; reason: string },
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("tournament_flag", {
    p_event: input.eventId,
    p_player: input.playerId,
    p_source: input.source,
    p_source_id: input.sourceId,
    p_game_idx: input.gameIdx,
    p_game: input.game,
    p_reason: input.reason,
  });
  return { data: data === true, error };
}

/** The players with a flagged run in an event. */
export async function readFlaggedPlayers(client: Db, eventId: string): Promise<Result<string[]>> {
  const { data, error } = await client.rpc("tournament_flagged_players", { p_event: eventId });
  return { data: Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [], error };
}
