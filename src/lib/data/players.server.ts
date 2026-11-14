/**
 * Room players (`duel_players`) and heartbeats (`duel_presence`): every read and write of a player row. Server
 * only; each function issues exactly the query its caller made before the data layer (architecture audit B2).
 */

import type { DuelPlayerRow, PlayerStatus } from "@/lib/duel/types";

import type { Db, TablesInsert, TablesUpdate } from "./db.server";
import type { Result } from "./rooms.server";

/** A player's last seen, as the heartbeat replies carry it. */
export interface SeenRow {
  user_id: string;
  last_seen_at: string;
}

/* ------------------------------------------------------------------ reads */

/** The room's players; in slot order unless `ordered` is false (the query then names no order, as before). */
export async function readPlayers(
  client: Db,
  roomId: string,
  { ordered = true }: { ordered?: boolean } = {},
): Promise<Result<DuelPlayerRow[] | null>> {
  const query = client.from("duel_players").select("*").eq("duel_id", roomId);
  const { data, error } = ordered ? await query.order("player_slot") : await query;
  return { data: data as DuelPlayerRow[] | null, error };
}

/** The caller's own row in a room, or null. */
export async function readPlayer(
  client: Db,
  roomId: string,
  userId: string,
): Promise<Result<DuelPlayerRow | null>> {
  const { data, error } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return { data: data as DuelPlayerRow | null, error };
}

/** What chat needs of its sender. */
export type ChatSender = Pick<DuelPlayerRow, "id" | "display_name" | "status" | "muted_by_host" | "last_reaction_at" | "player_slot" | "public_id">;

export async function readChatSender(client: Db, roomId: string, userId: string): Promise<Result<ChatSender | null>> {
  const { data, error } = await client
    .from("duel_players")
    .select("id, display_name, status, muted_by_host, last_reaction_at, player_slot, public_id")
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return { data: data as ChatSender | null, error };
}

/** Whether the colour and icon columns answer (their migration applied): the error says they don't. */
export async function probeLookColumns(client: Db): Promise<Result<null>> {
  const { error } = await client.from("duel_players").select("colour, icon").limit(1);
  return { data: null, error };
}

/** Every player row's last seen in the room (the heartbeat's fallback reply). */
export async function readPlayersSeen(client: Db, roomId: string): Promise<Result<SeenRow[] | null>> {
  const { data, error } = await client.from("duel_players").select("user_id, last_seen_at").eq("duel_id", roomId);
  return { data, error };
}

/** Each seat's account id and public id (Security C1b): how the server answers a phone by public id. */
export async function readPlayerPublicIds(client: Db, roomId: string): Promise<Result<{ user_id: string; public_id: string | null }[] | null>> {
  const { data, error } = await client.from("duel_players").select("user_id, public_id").eq("duel_id", roomId);
  return { data, error };
}

/** The accounts behind these public ids (Security C1b; unknown ids are left out). */
export async function readUsersOfPublicIds(client: Db, publicIds: readonly string[]): Promise<Result<{ user_id: string; public_id: string }[] | null>> {
  const ids = [...new Set(publicIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await client.from("player_public_ids").select("user_id, public_id").in("public_id", ids);
  return { data, error };
}

/* ------------------------------------------------------------------ writes */

/** Seats a player (a clashing slot, user or colour is the error's 23505). */
export async function insertPlayerRow(client: Db, row: TablesInsert<"duel_players">): Promise<Result<null>> {
  const { error } = await client.from("duel_players").insert(row);
  return { data: null, error };
}

/** Changes one player row by id. */
export async function updatePlayer(
  client: Db,
  playerId: string,
  values: TablesUpdate<"duel_players">,
): Promise<Result<null>> {
  const { error } = await client.from("duel_players").update(values).eq("id", playerId);
  return { data: null, error };
}

/** A player's status by id. */
export async function setPlayerStatus(client: Db, playerId: string, status: PlayerStatus): Promise<Result<null>> {
  return updatePlayer(client, playerId, { status });
}

/** The caller's status in a room (Leave). */
export async function setPlayerStatusInRoom(
  client: Db,
  roomId: string,
  userId: string,
  status: PlayerStatus,
): Promise<Result<null>> {
  const { error } = await client
    .from("duel_players")
    .update({ status })
    .eq("duel_id", roomId)
    .eq("user_id", userId);
  return { data: null, error };
}

/** Changes the row in a room's slot (the host's mute, a shared icon dropped). */
export async function updatePlayerAtSlot(
  client: Db,
  roomId: string,
  slot: number,
  values: TablesUpdate<"duel_players">,
): Promise<Result<null>> {
  const { error } = await client
    .from("duel_players")
    .update(values)
    .eq("duel_id", roomId)
    .eq("player_slot", slot);
  return { data: null, error };
}

/** The host removes a slot's player (never their own row). */
/** The user at a slot of a room, or null when the slot is empty. */
export async function readUserAtSlot(client: Db, roomId: string, slot: number): Promise<Result<{ user_id: string } | null>> {
  const { data, error } = await client
    .from("duel_players")
    .select("user_id")
    .eq("duel_id", roomId)
    .eq("player_slot", slot)
    .maybeSingle();
  return { data: (data as { user_id: string } | null) ?? null, error };
}

/** Records that the host removed `userId` from this room's lobby for game `gameIndex` (once; a repeat is a no-op). */
export async function insertRoomRemoval(client: Db, roomId: string, userId: string, gameIndex: number): Promise<Result<null>> {
  const { error } = await client
    .from("duel_removed_players")
    .upsert({ duel_id: roomId, user_id: userId, game_index: gameIndex }, { onConflict: "duel_id,user_id,game_index", ignoreDuplicates: true });
  return { data: null, error };
}

/** Whether `userId` was removed from this room's lobby for game `gameIndex`. */
export async function readRoomRemoval(client: Db, roomId: string, userId: string, gameIndex: number): Promise<Result<boolean>> {
  const { data, error } = await client
    .from("duel_removed_players")
    .select("user_id")
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .eq("game_index", gameIndex)
    .maybeSingle();
  return { data: !!data, error };
}

export async function deletePlayerAtSlot(
  client: Db,
  roomId: string,
  slot: number,
  hostUserId: string,
): Promise<Result<null>> {
  const { error } = await client
    .from("duel_players")
    .delete()
    .eq("duel_id", roomId)
    .eq("player_slot", slot)
    .neq("user_id", hostUserId);
  return { data: null, error };
}

/** Stores a colour on a row that has none (a clash leaves it auto). */
export async function setAutoColour(client: Db, playerId: string, colour: number): Promise<Result<null>> {
  const { error } = await client.from("duel_players").update({ colour }).eq("id", playerId).is("colour", null);
  return { data: null, error };
}

/** READY on the intro: the mark only ever rises. */
export async function markIntroReady(client: Db, playerId: string, round: number): Promise<Result<null>> {
  const { error } = await client
    .from("duel_players")
    .update({ intro_ready_round: round, status: "active" })
    .eq("id", playerId)
    .lt("intro_ready_round", round);
  return { data: null, error };
}

/** Continue on a between-round screen: the mark only ever rises. */
export async function markContinued(client: Db, playerId: string, mark: number, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("duel_players")
    .update({ ready_round: mark, status: "active", last_seen_at: at })
    .eq("id", playerId)
    .lt("ready_round", mark);
  return { data: null, error };
}

/** The live "finished" ping's round (finishedPing.server.ts). */
export async function setSubmittedRound(client: Db, playerId: string, round: number): Promise<Result<null>> {
  const { error } = await client.from("duel_players").update({ submitted_round: round }).eq("id", playerId);
  return { data: null, error };
}

/** Play again: every ping mark in the room back to 0. */
export async function clearSubmittedRounds(client: Db, roomId: string): Promise<Result<null>> {
  const { error } = await client.from("duel_players").update({ submitted_round: 0 }).eq("duel_id", roomId);
  return { data: null, error };
}

/** The heartbeat's fallback: the player row's last seen. The rows it matched (none: not in the room). */
export async function touchPlayerSeen(
  client: Db,
  roomId: string,
  userId: string,
  at: string,
): Promise<Result<{ id: string }[] | null>> {
  const { data, error } = await client
    .from("duel_players")
    .update({ last_seen_at: at })
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .select("id");
  return { data, error };
}

/* ------------------------------------------------------------------ duel_presence */

/** The room's heartbeat rows (the table is missing before its migration: the error says so). */
export async function readPresence(client: Db, roomId: string): Promise<Result<SeenRow[] | null>> {
  const { data, error } = await client.from("duel_presence").select("user_id, last_seen_at").eq("duel_id", roomId);
  return { data, error };
}

/** One heartbeat row (23503: the caller has no player row in the room). */
export async function upsertPresence(client: Db, roomId: string, userId: string, at: string): Promise<Result<null>> {
  const { error } = await client
    .from("duel_presence")
    .upsert({ duel_id: roomId, user_id: userId, last_seen_at: at }, { onConflict: "duel_id,user_id" });
  return { data: null, error };
}
