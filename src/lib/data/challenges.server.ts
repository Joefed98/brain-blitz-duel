/**
 * Friend challenges' own table (`challenges`); the challenge's rounds live in the async-room tables
 * (async.server.ts). Server only; each function issues exactly the query it made before the data layer
 * (architecture audit B2).
 */

import type { ChallengeRow } from "@/lib/duel/challenge.server";

import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

/** When each of a device's challenges was made (the database half of the rate limit). */
export async function readChallengeTimes(client: Db, userId: string): Promise<Result<{ created_at: string }[] | null>> {
  const { data, error } = await client.from("challenges").select("created_at").eq("created_by", userId);
  return { data, error };
}

/** Every challenge a device made. */
export async function readChallengesBy(client: Db, userId: string): Promise<Result<ChallengeRow[] | null>> {
  const { data, error } = await client.from("challenges").select("*").eq("created_by", userId);
  return { data: data as ChallengeRow[] | null, error };
}

export async function readChallengeByCode(client: Db, code: string): Promise<Result<ChallengeRow | null>> {
  const { data, error } = await client.from("challenges").select("*").eq("code", code).maybeSingle();
  return { data: data as ChallengeRow | null, error };
}

export async function readChallengeByRoom(client: Db, roomId: string): Promise<Result<ChallengeRow | null>> {
  const { data, error } = await client.from("challenges").select("*").eq("room_id", roomId).maybeSingle();
  return { data: data as ChallengeRow | null, error };
}

/** The challenge made from a room's game, if any (one a game). */
export async function readChallengeFromRoomGame(
  client: Db,
  duelId: string,
  gameIndex: number,
): Promise<Result<ChallengeRow | null>> {
  const { data, error } = await client
    .from("challenges")
    .select("*")
    .eq("source_duel_id", duelId)
    .eq("source_game_index", gameIndex)
    .maybeSingle();
  return { data: data as ChallengeRow | null, error };
}

/** Stores a challenge's row. */
export async function insertChallenge(client: Db, row: ChallengeRow): Promise<Result<null>> {
  const { error } = await client.from("challenges").insert(row);
  return { data: null, error };
}

/** Whether the table answers at all (any error: the migration isn't applied). */
export async function probeChallenges(client: Db): Promise<Result<{ room_id: string } | null>> {
  const { data, error } = await client.from("challenges").select("room_id").eq("code", "AAAAAA").maybeSingle();
  return { data, error };
}
