/**
 * Room settings on the server (31 Oct 2026; rules in roomSettings.ts): the only writer of a room's settings.
 * Host only, lobby only, validated, stored in `duels.selected_categories` (picks then `rounds:N`) and, when the
 * sheet sends it, the scoring choice in `duels.scoring_mode` (scoringMode.ts), written with
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
import { isScoringMode, readScoringMode, type ScoringMode } from "./scoringMode";
import { dbError } from "./dbError";
import type { Db } from "@/lib/data/db.server";
import { readHostLastScoring, readRoomForSettings, writeRoomSettings } from "@/lib/data/rooms.server";

export type SettingsChange = { ok: true; settings: RoomSettings } | { ok: false; message: string };

/** Host only, in the lobby: stores the room's settings. */
export async function changeRoomSettings(
  client: Db,
  roomId: string,
  userId: string,
  input: unknown,
): Promise<SettingsChange> {
  const { data: room, error } = await readRoomForSettings(client, roomId);
  if (error) throw dbError(error, "roomSettings");
  if (!room) return { ok: false, message: "That room no longer exists." };
  if (room.host_user_id !== userId)
    return { ok: false, message: "Only the host can change the room settings." };
  if (room.status !== "waiting" || room.disbanded_at)
    return { ok: false, message: "This game’s already started." };
  if (!roomSettingsUnlocked())
    return { ok: false, message: "Room settings are part of Joulz Plus." };
  const valid = validateRoomSettings(input);
  if (!valid.ok) return valid;
  // Scoring (scoringMode.ts) is optional: a phone that doesn't send it (the column is missing, or an older
  // build) leaves the room's scoring as it is.
  const scoringIn = (input as { scoring?: unknown } | null)?.scoring;
  if (scoringIn !== undefined && !isScoringMode(scoringIn))
    return { ok: false, message: "Choose Total score or Placings." };
  const scoring = scoringIn as ScoringMode | undefined;
  const write = (withScoring: boolean) =>
    writeRoomSettings(client, roomId, encodeRoomSettings(valid.settings), withScoring ? scoring : undefined);
  let { data: written, error: writeError } = await write(true);
  if (writeError && scoring !== undefined && isMissingScoringColumn(writeError)) {
    // Before the migration: Total score is what every room plays already; Placings can't be stored yet.
    if (scoring === "placings")
      return { ok: false, message: "Placings scoring isn’t available yet." };
    ({ data: written, error: writeError } = await write(false));
  }
  if (writeError) throw dbError(writeError, "roomSettings");
  if (!written) return { ok: false, message: "This game’s already started." };
  console.log(
    `[room-settings] room=${room.room_code} ${encodeRoomSettings(valid.settings).join(",")}${scoring ? ` scoring=${scoring}` : ""}`,
  );
  return { ok: true, settings: valid.settings };
}

/** PostgREST's "no such column" (the scoring migration not applied yet). */
function isMissingScoringColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /scoring_mode/.test(error.message ?? "")
  );
}

/**
 * A new room's scoring, from the host's last room (as its other settings are); Total score for a first room
 * or before the migration (the query's error is ignored: the column is missing).
 */
export async function rememberedScoring(
  client: Db,
  userId: string,
): Promise<ScoringMode> {
  try {
    const { data, error } = await readHostLastScoring(client, userId);
    if (error) return "total";
    return readScoringMode(data?.scoring_mode);
  } catch {
    return "total";
  }
}

/**
 * A new room's stored settings, from the host's last room: settings as saved there, a legacy room's
 * categories read as settings (Arcade as its five groups, its 6 or 7 rounds), the defaults for a first room.
 */
export function rememberedSettings(previous: unknown): string[] {
  return encodeRoomSettings(readRoomSettings(previous ?? null).settings);
}
