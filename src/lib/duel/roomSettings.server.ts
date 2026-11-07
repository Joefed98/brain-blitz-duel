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
  // Scoring (scoringMode.ts) is optional: a phone that doesn't send it (the column is missing, or an older
  // build) leaves the room's scoring as it is.
  const scoringIn = (input as { scoring?: unknown } | null)?.scoring;
  if (scoringIn !== undefined && !isScoringMode(scoringIn))
    return { ok: false, message: "Choose Total score or Placings." };
  const scoring = scoringIn as ScoringMode | undefined;
  const write = (withScoring: boolean) =>
    client
      .from("duels")
      .update({
        selected_categories: encodeRoomSettings(valid.settings),
        ...(withScoring && scoring !== undefined ? { scoring_mode: scoring } : {}),
      })
      .eq("id", roomId)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();
  let { data: written, error: writeError } = await write(true);
  if (writeError && scoring !== undefined && isMissingScoringColumn(writeError)) {
    // Before the migration: Total score is what every room plays already; Placings can't be stored yet.
    if (scoring === "placings")
      return { ok: false, message: "Placings scoring isn't available yet." };
    ({ data: written, error: writeError } = await write(false));
  }
  if (writeError) throw new Error(writeError.message);
  if (!written) return { ok: false, message: "The game has already started." };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  userId: string,
): Promise<ScoringMode> {
  try {
    const { data, error } = await client
      .from("duels")
      .select("scoring_mode")
      .eq("host_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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
