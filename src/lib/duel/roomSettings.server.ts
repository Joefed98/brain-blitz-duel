/**
 * Room settings on the server (31 Oct 2026; rules in roomSettings.ts): the only writer of a room's settings.
 * Host only, lobby only, validated, stored in `duels.selected_categories` (picks then `rounds:N`), written with
 * the room still waiting so a change racing the start can't land after it. room-settings-check runs this
 * against an in-memory duels table.
 */
import {
  encodeRoomSettings,
  readRoomSettings,
  roomSettingsUnlocked,
  validateRoomSettings,
  type RoomSettings,
} from "./roomSettings";

export type SettingsChange = { ok: true; settings: RoomSettings } | { ok: false; message: string };

/** Host only, in the lobby: stores the room's settings. */
export async function changeRoomSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  roomId: string,
  userId: string,
  input: unknown,
): Promise<SettingsChange> {
  const { data: room, error } = await client
    .from("duels")
    .select("id, room_code, host_user_id, status, disbanded_at")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!room) return { ok: false, message: "That room no longer exists." };
  if (room.host_user_id !== userId)
    return { ok: false, message: "Only the host can change the room settings." };
  if (room.status !== "waiting" || room.disbanded_at)
    return { ok: false, message: "The game has already started." };
  if (!roomSettingsUnlocked())
    return { ok: false, message: "Room settings are part of Duelz Plus." };
  const valid = validateRoomSettings(input);
  if (!valid.ok) return valid;
  const { data: written, error: writeError } = await client
    .from("duels")
    .update({ selected_categories: encodeRoomSettings(valid.settings) })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();
  if (writeError) throw new Error(writeError.message);
  if (!written) return { ok: false, message: "The game has already started." };
  console.log(
    `[room-settings] room=${room.room_code} ${encodeRoomSettings(valid.settings).join(",")}`,
  );
  return { ok: true, settings: valid.settings };
}

/**
 * A new room's stored settings, from the host's last room: settings as saved there, a legacy room's
 * categories read as settings (Arcade as its four groups, its 6 or 7 rounds), the defaults for a first room.
 */
export function rememberedSettings(previous: unknown): string[] {
  return encodeRoomSettings(readRoomSettings(previous ?? null).settings);
}
