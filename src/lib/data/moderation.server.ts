/**
 * Moderation (safety, 10 Nov 2026; docs/moderation.md): the server's reads and writes of a player's moderation state,
 * through the service-role functions `moderation_status` and `moderation_ack`
 * (supabase/migrations/20261110150000_moderation.sql). Reports are filed in chat.server.ts (insertRoomReport). Server
 * only; the `moderation` schema itself is never reachable from the API.
 */

import type { Db, Json } from "./db.server";
import { missingFunction } from "./chat.server";
import type { Result } from "./rooms.server";

/** One player's state as the server needs it. Never who reported them. */
export interface ModerationStatus {
  banned: boolean;
  /** When a timed ban ends (ISO), or null (no ban, or permanent: `bannedForever`). */
  bannedUntil: string | null;
  bannedForever: boolean;
  /** When the chat mute ends (ISO), or null. */
  mutedUntil: string | null;
  /** A warning to show once, or null. */
  warning: string | null;
  /** A forced rename is pending. */
  rename: boolean;
  /** The temporary energy name has been given. */
  renameTempApplied: boolean;
}

/** Nothing on record: what a player without a state row (and every player before the migration) reads as. */
export const CLEAR_STATUS: ModerationStatus = {
  banned: false,
  bannedUntil: null,
  bannedForever: false,
  mutedUntil: null,
  warning: null,
  rename: false,
  renameTempApplied: false,
};

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Reads one player's moderation state. A database without the migration answers CLEAR_STATUS. */
export async function readModerationStatus(client: Db, userId: string): Promise<Result<ModerationStatus | null>> {
  const { data, error } = await client.rpc("moderation_status", { p_user_id: userId });
  if (error) return missingFunction(error) ? { data: CLEAR_STATUS, error: null } : { data: null, error };
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    data: {
      banned: d["banned"] === true,
      bannedUntil: str(d["banned_until"]),
      bannedForever: d["banned_forever"] === true,
      mutedUntil: str(d["muted_until"]),
      warning: str(d["warning"]),
      rename: d["rename"] === true,
      renameTempApplied: d["rename_temp_applied"] === true,
    },
    error: null,
  };
}

/** The server's own steps on a player's state ('warning' seen, 'rename_temp' given, 'rename' done), each logged. */
export async function ackModeration(
  client: Db,
  userId: string,
  kind: "warning" | "rename_temp" | "rename",
  detail: Record<string, string> | null = null,
): Promise<Result<boolean | null>> {
  const { data, error } = await client.rpc("moderation_ack", {
    p_user_id: userId,
    p_kind: kind,
    p_detail: (detail ?? null) as Json | null,
  });
  return { data: data ?? null, error };
}
