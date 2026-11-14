/**
 * Rooms (`duels`, `duel_secrets` and the room RPCs): every read and write of a room row. Server only; the client is
 * the service-role client (`adminDb()`) or a check's stand-in. Each function issues exactly the query its caller
 * made before the data layer (architecture audit B2), so guards, orders and limits are unchanged.
 */

import type {
  DuelPhase,
  DuelRow,
  StoredPuzzleType,
  TournamentEntry,
} from "@/lib/duel/types";

import { asJson, type Db, type DbError, type Json, type Tables, type TablesInsert } from "./db.server";

/** A query's data (already narrowed to the app's own row type) and PostgREST's error, as supabase-js returns them. */
export interface Result<T> {
  data: T;
  error: DbError | null;
}

/** The generated `duels` row, as the app's DuelRow (its jsonb columns hold the app's own shapes). */
function asRoom(row: Tables<"duels">): DuelRow {
  return row as unknown as DuelRow;
}

/* ------------------------------------------------------------------ reads */

/**
 * A room's public halves as the server reads them. A room dealt by start_dealt_room keeps them in
 * duel_secrets.puzzles_public while it plays (its duels.puzzles_public is [] until it finishes;
 * supabase/migrations/20261117500100_round_puzzle_release.sql), so every server reader gets the full list from there;
 * a room started before that, a waiting room and a finished one read as stored.
 */
async function withHeldPuzzles(client: Db, room: DuelRow): Promise<DuelRow> {
  if (room.status === "waiting" || (Array.isArray(room.puzzles_public) && room.puzzles_public.length > 0)) return room;
  const held = await readHeldPublicPuzzles(client, [room.id]);
  const list = held.get(room.id);
  return list ? { ...room, puzzles_public: list as unknown as DuelRow["puzzles_public"] } : room;
}

/** The held public halves of these rooms (a room with none held is missing from the map). */
export async function readHeldPublicPuzzles(client: Db, roomIds: string[]): Promise<Map<string, Json[]>> {
  const out = new Map<string, Json[]>();
  if (!roomIds.length) return out;
  const { data } = await client.from("duel_secrets").select("duel_id, puzzles_public").in("duel_id", roomIds);
  for (const row of data ?? []) {
    if (Array.isArray(row.puzzles_public) && row.puzzles_public.length > 0) out.set(row.duel_id, row.puzzles_public);
  }
  return out;
}

/** The whole room by id. */
export async function readRoom(client: Db, roomId: string): Promise<Result<DuelRow | null>> {
  const { data, error } = await client.from("duels").select("*").eq("id", roomId).maybeSingle();
  return { data: data ? await withHeldPuzzles(client, asRoom(data)) : null, error };
}

/** The whole room by its code. */
export async function readRoomByCode(client: Db, code: string): Promise<Result<DuelRow | null>> {
  const { data, error } = await client.from("duels").select("*").eq("room_code", code).maybeSingle();
  return { data: data ? await withHeldPuzzles(client, asRoom(data)) : null, error };
}

/** What a room link may tell a visitor: whether it can be joined. */
export async function readRoomPreview(
  client: Db,
  code: string,
): Promise<Result<Pick<DuelRow, "id" | "status" | "disbanded_at" | "max_players"> | null>> {
  const { data, error } = await client
    .from("duels")
    .select("id, status, disbanded_at, max_players")
    .eq("room_code", code)
    .maybeSingle();
  return { data: data as Pick<DuelRow, "id" | "status" | "disbanded_at" | "max_players"> | null, error };
}

/** The room settings sheet's view of a room (roomSettings.server.ts). */
export async function readRoomForSettings(
  client: Db,
  roomId: string,
): Promise<Result<Pick<DuelRow, "id" | "room_code" | "host_user_id" | "status" | "disbanded_at" | "start_claimed_at"> | null>> {
  const { data, error } = await client
    .from("duels")
    .select("id, room_code, host_user_id, status, disbanded_at, start_claimed_at")
    .eq("id", roomId)
    .maybeSingle();
  return { data: data as Pick<DuelRow, "id" | "room_code" | "host_user_id" | "status" | "disbanded_at" | "start_claimed_at"> | null, error };
}

/** The room's host (chat's mute). */
export async function readRoomHost(
  client: Db,
  roomId: string,
): Promise<Result<{ id: string; host_user_id: string | null } | null>> {
  const { data, error } = await client
    .from("duels")
    .select("id, host_user_id")
    .eq("id", roomId)
    .maybeSingle();
  return { data, error };
}

/** The host's last 15 rooms' round orders and histories (the repeat-avoiding draw). */
export async function readHostRecentOrders(
  client: Db,
  hostUserId: string,
): Promise<Result<DuelRow[] | null>> {
  const { data, error } = await client
    .from("duels")
    .select("round_order, tournament_history, status, id, created_at")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false })
    .limit(15);
  return { data: data as unknown as DuelRow[] | null, error };
}

/** The host's last `limit` rooms' public puzzles (banked boards a new room skips). */
export async function readHostRecentPuzzles(
  client: Db,
  hostUserId: string,
  limit: number,
): Promise<Result<{ puzzles_public: Json }[] | null>> {
  const { data, error } = await client
    .from("duels")
    .select("id, puzzles_public")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return { data: null, error };
  // A room still playing holds its public halves on the server (withHeldPuzzles): read them, so the deal skips the
  // same banked boards it always did.
  const empty = data.filter((r) => !Array.isArray(r.puzzles_public) || r.puzzles_public.length === 0).map((r) => r.id);
  const held = await readHeldPublicPuzzles(client, empty);
  return { data: data.map((r) => ({ puzzles_public: held.get(r.id) ?? r.puzzles_public })), error };
}

/** The host's last room's stored settings. */
export async function readHostLastCategories(
  client: Db,
  hostUserId: string,
): Promise<Result<{ selected_categories: Json } | null>> {
  const { data, error } = await client
    .from("duels")
    .select("selected_categories")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

/** The host's last room's scoring (the column is missing before its migration: the error says so). */
export async function readHostLastScoring(
  client: Db,
  hostUserId: string,
): Promise<Result<{ scoring_mode: string } | null>> {
  const { data, error } = await client
    .from("duels")
    .select("scoring_mode")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

/** The room's history and status (Play again's history fix-ups). */
export async function readRoomHistory(
  client: Db,
  roomId: string,
): Promise<Result<{ tournament_history: TournamentEntry[] | null; status: string } | null>> {
  const { data, error } = await client
    .from("duels")
    .select("tournament_history, status")
    .eq("id", roomId)
    .maybeSingle();
  return {
    data: data as { tournament_history: TournamentEntry[] | null; status: string } | null,
    error,
  };
}

/* ------------------------------------------------------------------ writes */

/** A new room row (its code may clash: the error is 23505). */
export async function insertRoom(
  client: Db,
  row: Omit<TablesInsert<"duels">, "selected_categories"> & { selected_categories: readonly string[] },
): Promise<Result<DuelRow | null>> {
  const { data, error } = await client
    .from("duels")
    .insert({ ...row, selected_categories: asJson(row.selected_categories) })
    .select("*")
    .single();
  return { data: data ? asRoom(data) : null, error };
}

/** What a deal claim answers: its stamp, and the settings the deal reads as they stood when it was taken. */
export interface DealClaim {
  claimed_at: string;
  selected_categories: Json;
  host_user_id: string | null;
}

/**
 * Claims a waiting room for dealing (supabase/migrations/20261117500000_room_start_claim.sql): only when no fresh claim
 * stands. The claim, or null when the room isn't waiting or is already being dealt.
 */
export async function claimRoomDeal(client: Db, roomId: string, nowIso: string, staleMs: number): Promise<Result<DealClaim | null>> {
  const { data, error } = await client.rpc("claim_room_deal", { p_room_id: roomId, p_now: nowIso, p_stale_ms: staleMs });
  const row = Array.isArray(data) ? (data[0] as DealClaim | undefined) : undefined;
  return { data: row ?? null, error };
}

/** Gives a claim back (only that exact claim). */
export async function releaseRoomDeal(client: Db, roomId: string, claim: string): Promise<Result<boolean | null>> {
  const { data, error } = await client.rpc("release_room_deal", { p_room_id: roomId, p_claim: claim });
  return { data: data as boolean | null, error };
}

/**
 * The start, in one transaction (start_dealt_room): the dealt rounds on the room, the private halves and the held public
 * halves in duel_secrets, the claim cleared and the deal's origin stamped. "started", "lost" (the room moved on or the
 * claim isn't this one) or "too_few" (too few players stayed; the claim is given back).
 */
export async function startDealtRoom(
  client: Db,
  input: {
    roomId: string;
    claim: string;
    roundOrder: StoredPuzzleType[];
    puzzlesPublic: Json;
    puzzlesPrivate: Json;
    startedAt: string;
    minPlayers: number;
    /** The phase the room starts in: Prepare to Duel. */
    phase: "starting";
    dealOrigin?: string | null;
    /** The settings the deal read at its claim: a room whose settings changed since gives its claim back ("lost"). */
    selectedCategories?: Json;
  },
): Promise<Result<"started" | "lost" | "too_few" | null>> {
  const { data, error } = await client.rpc("start_dealt_room", {
    p_room_id: input.roomId,
    p_claim: input.claim,
    p_round_order: asJson(input.roundOrder),
    p_puzzles_public: input.puzzlesPublic,
    p_puzzles_private: input.puzzlesPrivate,
    p_started_at: input.startedAt,
    p_min_players: input.minPlayers,
    p_phase: input.phase,
    ...(input.dealOrigin ? { p_deal_origin: input.dealOrigin } : {}),
    ...(input.selectedCategories !== undefined ? { p_selected_categories: input.selectedCategories } : {}),
  });
  return { data: (data as "started" | "lost" | "too_few" | null) ?? null, error };
}

/** Each room's deal origin (the room whose deal it plays; itself unless it copied a recorded run's room). */
export async function readDealOrigins(client: Db, roomIds: string[]): Promise<Result<Map<string, string>>> {
  const out = new Map<string, string>();
  if (!roomIds.length) return { data: out, error: null };
  const { data, error } = await client.from("duels").select("id, deal_origin_id").in("id", roomIds);
  for (const row of data ?? []) out.set(row.id, row.deal_origin_id ?? row.id);
  return { data: out, error };
}

/** The host's category picks, guarded on the room still waiting. */
export async function writeRoomCategories(
  client: Db,
  roomId: string,
  categories: readonly string[],
): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client
    .from("duels")
    .update({ selected_categories: asJson(categories) })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  return { data, error };
}

/** The room settings sheet's write, guarded on the room still waiting; `scoring` only when the sheet sent it. */
export async function writeRoomSettings(
  client: Db,
  roomId: string,
  selectedCategories: readonly string[],
  scoring: string | undefined,
): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client
    .from("duels")
    .update({
      selected_categories: asJson(selectedCategories),
      ...(scoring !== undefined ? { scoring_mode: scoring } : {}),
    })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  return { data, error };
}

/** Closes the room (host left or disbanded). */
export async function disbandRoom(client: Db, roomId: string, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("duels")
    .update({ disbanded_at: at, status: "finished" })
    .eq("id", roomId);
  return { data: null, error };
}

/** Every active READY tapped: the intro's start pulled back to `cutoff`, once (guarded on the stamp). */
export async function pullIntroStart(
  client: Db,
  roomId: string,
  round: number,
  cutoff: string,
): Promise<Result<null>> {
  const { error } = await client
    .from("duels")
    .update({ phase_started_at: cutoff })
    .eq("id", roomId)
    .eq("current_round", round)
    .eq("phase", "intro")
    .gt("phase_started_at", cutoff);
  return { data: null, error };
}

/**
 * A timed move between the start screens (starting → round title → intro), guarded on the status, round, phase
 * and the phase's own stamp, so a reconnect can't move it twice.
 */
export async function moveTimedPhase(
  client: Db,
  roomId: string,
  round: number,
  from: DuelPhase,
  stamp: string | null,
  to: DuelPhase,
  at: string,
): Promise<Result<null>> {
  const { error } = await client
    .from("duels")
    .update({ phase: to, phase_started_at: at, round_started_at: at })
    .eq("id", roomId)
    .eq("status", "in_progress")
    .eq("current_round", round)
    .eq("phase", from)
    // The stamp is read from the row; a room with none matches nothing, as before.
    .eq("phase_started_at", stamp as string);
  return { data: null, error };
}

/** A phase move guarded on the round and the phase it leaves. The moved rows' ids. */
export async function movePhase(
  client: Db,
  roomId: string,
  round: number,
  from: DuelPhase,
  to: DuelPhase,
  at: string,
): Promise<Result<{ id: string }[] | null>> {
  const { data, error } = await client
    .from("duels")
    .update({ phase: to, phase_started_at: at })
    .eq("id", roomId)
    .eq("current_round", round)
    .eq("phase", from)
    .select("id");
  return { data, error };
}

/** The winner reveal's end: finished, guarded on the round and the reveal. */
export async function finishAfterWinnerReveal(
  client: Db,
  roomId: string,
  round: number,
): Promise<Result<null>> {
  const { error } = await client
    .from("duels")
    .update({ status: "finished" })
    .eq("id", roomId)
    .eq("status", "in_progress")
    .eq("current_round", round)
    .eq("phase", "winner_reveal");
  return { data: null, error };
}

/** Older rooms end on the last round's standings. The finished rows' ids. */
export async function finishFromStandings(
  client: Db,
  roomId: string,
  round: number,
): Promise<Result<{ id: string }[] | null>> {
  const { data, error } = await client
    .from("duels")
    .update({ status: "finished" })
    .eq("id", roomId)
    .eq("current_round", round)
    .eq("phase", "standings")
    .select("id");
  return { data, error };
}

/** Standings → the next round's title, guarded on the round and the standings. */
export async function startNextRound(
  client: Db,
  roomId: string,
  round: number,
  startedAt: string,
): Promise<Result<null>> {
  const { error } = await client
    .from("duels")
    .update({
      current_round: round + 1,
      phase: "round_title",
      phase_started_at: startedAt,
      round_started_at: startedAt,
    })
    .eq("id", roomId)
    .eq("current_round", round)
    .eq("phase", "standings");
  return { data: null, error };
}

/** "Finish now": finished, guarded on the status, round and phase it was read in. The claimed row, or null. */
export async function claimFinishNow(
  client: Db,
  roomId: string,
  round: number,
  phase: DuelPhase,
): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client
    .from("duels")
    .update({ status: "finished" })
    .eq("id", roomId)
    .eq("status", "in_progress")
    .eq("current_round", round)
    .eq("phase", phase)
    .select("id")
    .maybeSingle();
  return { data, error };
}

/** Play again's history fix-up, guarded on the room being back in its lobby. The written row, or null. */
export async function writeRoomHistory(
  client: Db,
  roomId: string,
  history: TournamentEntry[],
): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client
    .from("duels")
    .update({ tournament_history: asJson(history) })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  return { data, error };
}

/* ------------------------------------------------------------------ RPCs */

/** Closes a room whose host has been gone too long (the database decides). */
export async function disbandStaleRoom(client: Db, roomId: string): Promise<Result<boolean | null>> {
  const { data, error } = await client.rpc("disband_stale_room", { p_room_id: roomId });
  return { data, error };
}

/** Play again's atomic reset (keeps the code, archives the game). True when it reset the room. */
export async function restartRoom(
  client: Db,
  roomId: string,
  hostUserId: string,
): Promise<Result<boolean | null>> {
  const { data, error } = await client.rpc("restart_duel_room", {
    p_room_id: roomId,
    p_host_id: hostUserId,
  });
  return { data, error };
}

/* ------------------------------------------------------------------ duel_secrets */

/** The room's private puzzle halves (answers), in round order; [] when none are stored. */
export async function readPrivatePuzzles(client: Db, roomId: string): Promise<Result<Record<string, unknown>[]>> {
  const { data, error } = await client
    .from("duel_secrets")
    .select("puzzles_private")
    .eq("duel_id", roomId)
    .maybeSingle();
  return { data: (data?.puzzles_private ?? []) as Record<string, unknown>[], error };
}

/** The beta recording's per-round records (betaRecord.server.ts). */
export async function writeRoundRecords(client: Db, roomId: string, rounds: Json): Promise<Result<null>> {
  const { error } = await client
    .from("duel_secrets")
    .update({ round_records: rounds })
    .eq("duel_id", roomId);
  return { data: null, error };
}

