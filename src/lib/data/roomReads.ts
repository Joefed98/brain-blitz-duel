/**
 * The phone's own room reads (architecture audit B2). Row level security limits them to rooms this device is part
 * of; the caller passes the browser client (`@/integrations/supabase/client`) and the request's abort signal
 * (src/lib/net/request.ts), and retries through `supabaseRead`. Each issues exactly the query api.ts made before.
 */

import { abortable } from "@/lib/net/request";
import type { DuelPlayerRow, DuelRow } from "@/lib/duel/types";
import type { RoomResultRow } from "@/lib/duel/roomResults";

import type { Db } from "./db";

/**
 * The columns a phone reads (Security C1b, 20261117500300_public_player_ids.sql: every column but the account ids,
 * which phones can't read). public-ids-check proves these are exactly the columns granted to phones.
 */
export const PHONE_DUEL_COLUMNS =
  "id, room_code, status, round_order, current_round, round_started_at, next_duel_id, created_at, phase, phase_started_at, puzzles_public, max_players, round_count, no_maths, add_maths, add_arcade, selected_categories, tournament_history, disbanded_at, scoring_mode, start_claimed_at, deal_origin_id, host_public_id";
export const PHONE_PLAYER_COLUMNS =
  "id, duel_id, player_slot, display_name, ready_round, last_seen_at, created_at, status, joined_at, intro_ready_round, muted_by_host, last_reaction_at, colour, icon, submitted_round, public_id";

interface Read<T> {
  data: T;
  error: { code?: string; message: string } | null;
}

export async function readRoomByCode(client: Db, roomCode: string, signal: AbortSignal): Promise<Read<DuelRow | null>> {
  const { data, error } = await abortable(client.from("duels").select(PHONE_DUEL_COLUMNS).eq("room_code", roomCode), signal).maybeSingle();
  return { data: data as unknown as DuelRow | null, error };
}

export async function readRoomById(client: Db, duelId: string, signal: AbortSignal): Promise<Read<DuelRow | null>> {
  const { data, error } = await abortable(client.from("duels").select(PHONE_DUEL_COLUMNS).eq("id", duelId), signal).maybeSingle();
  return { data: data as unknown as DuelRow | null, error };
}

export async function readRoomPlayers(
  client: Db,
  duelId: string,
  signal: AbortSignal,
): Promise<Read<DuelPlayerRow[] | null>> {
  const { data, error } = await abortable(
    client.from("duel_players").select(PHONE_PLAYER_COLUMNS).eq("duel_id", duelId).order("player_slot"),
    signal,
  );
  return { data: data as unknown as DuelPlayerRow[] | null, error };
}

/** The room's results in the named columns (no stored answers; roomResults.ts). */
export async function readRoomResultRows(
  client: Db,
  duelId: string,
  columns: string,
  signal: AbortSignal,
): Promise<Read<RoomResultRow[] | null>> {
  const { data, error } = await abortable(client.from("round_results").select(columns).eq("duel_id", duelId), signal);
  return { data: data as unknown as RoomResultRow[] | null, error };
}

/** This device's own answers by result id. */
export async function readOwnAnswers(
  client: Db,
  ids: string[],
  signal: AbortSignal,
): Promise<Read<{ id: string; answer: string | null }[] | null>> {
  const { data, error } = await abortable(client.from("round_results").select("id, answer").in("id", ids), signal);
  return { data, error };
}

/**
 * The room's released rounds (Security C1a; supabase/migrations/20261117500100_round_puzzle_release.sql): a round's public
 * half lands here when its intro begins. Row level security gives this device only its own room's current game.
 */
export async function readReleasedRounds(
  client: Db,
  duelId: string,
  signal: AbortSignal,
): Promise<Read<{ round_number: number; puzzle: unknown }[] | null>> {
  const { data, error } = await abortable(
    client.from("duel_round_puzzles").select("round_number, puzzle").eq("duel_id", duelId).order("round_number"),
    signal,
  );
  return { data: data as { round_number: number; puzzle: unknown }[] | null, error };
}
