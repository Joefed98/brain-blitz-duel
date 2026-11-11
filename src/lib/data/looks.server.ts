/**
 * The looks players play in (wave 2, E1; docs/skins.md "Replays and ghosts"): display only. Server only; one call each.
 * The looks are the database's own read of each owner's equipped items (public.room_game_looks,
 * supabase/migrations/20261111140100_result_looks.sql), never anything a phone sent.
 */
import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

/** Every player still in a room with their equipped look for one game (`{skin, world, back}` or null). */
export async function readRoomGameLooks(client: Db, roomId: string, game: string): Promise<Result<{ player_slot: number; look: unknown }[] | null>> {
  const { data, error } = await client.rpc("room_game_looks", { p_duel_id: roomId, p_game: game });
  return { data: (data ?? null) as { player_slot: number; look: unknown }[] | null, error };
}
