/**
 * Room heartbeats (Speed fix 3, 9 Nov 2026; docs/audit-nov-2026/performance.md item 3). Server only.
 *
 * Every phone in a room calls heartbeatFn every 4 s. It used to write `duel_players.last_seen_at`, a table in the
 * realtime publication, so each heartbeat reached every phone in the room as a change and made each of them refetch
 * the player list. With `supabase/migrations/20261109130000_room_presence.sql` applied, the heartbeat goes to
 * `duel_presence`, a table no phone subscribes to, and the heartbeat's reply carries the room's last-seen times, so
 * each phone keeps its own view of who is connected (`isConnected`, roomFlow.ts) from its own heartbeats.
 *
 * Before the migration is applied (no table) the heartbeat writes `duel_players.last_seen_at` exactly as before, and
 * the reply carries the same times read from there. Either way the server reads a player's last seen as the later of
 * the two columns (`withPresence`), so a room carries on across the switch. Room presentation only: nothing here
 * touches grading, scoring or what a round contains.
 */
import type { Db } from "@/lib/data/db.server";
import {
  readPlayersSeen,
  readPresence,
  touchPlayerSeen,
  upsertPresence,
  type SeenRow,
} from "@/lib/data/players.server";

import type { DuelPlayerRow } from "./types";

/** How long a server isolate trusts "no duel_presence table" before asking again (the migration may arrive). */
const MISSING_RECHECK_MS = 5 * 60_000;
let missingUntil = 0;

/** True for the error PostgREST gives for a table that isn't there (or not yet in its schema cache). */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /duel_presence/.test(error.message ?? "") && /does not exist|schema cache/.test(error.message ?? "");
}

function presenceKnownMissing(now: number): boolean {
  return now < missingUntil;
}

function notePresenceMissing(now: number): void {
  missingUntil = now + MISSING_RECHECK_MS;
}

/** Checks only: forget the cached "no table" answer. */
export function resetPresenceCache(): void {
  missingUntil = 0;
}

/** Each player's last seen in this room (ISO times), by user id (server side) or public id (the reply to a phone). */
export type RoomSeen = Record<string, string>;

/**
 * The heartbeat's reply as a phone gets it (Security C1b): the same times keyed by each player's public id, never an
 * account id. A time whose player has no public id (none yet) is left out.
 */
export async function seenForPhone(client: Db, roomId: string, seen: RoomSeen): Promise<RoomSeen> {
  const { readPlayerPublicIds } = await import("@/lib/data/players.server");
  const { data } = await readPlayerPublicIds(client, roomId);
  const byUser = new Map((data ?? []).map((r) => [r.user_id, r.public_id]));
  const out: RoomSeen = {};
  for (const [userId, iso] of Object.entries(seen)) {
    const key = byUser.get(userId);
    if (key) out[key] = iso;
  }
  return out;
}

function laterIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta)) return Number.isFinite(tb) ? (b as string) : (a ?? null);
  if (!Number.isFinite(tb)) return a as string;
  return tb > ta ? (b as string) : (a as string);
}

/** The room's rows in duel_presence, or null when there is no such table (the migration not applied). */
async function presenceRows(client: Db, roomId: string): Promise<SeenRow[] | null> {
  const now = Date.now();
  if (presenceKnownMissing(now)) return null;
  const { data, error } = await readPresence(client, roomId);
  if (error) {
    if (isMissingTable(error)) notePresenceMissing(now);
    return null;
  }
  return data ?? [];
}

/**
 * The players with each one's `last_seen_at` the later of the player row's and its heartbeat row's: what every
 * connectedness rule on the server reads (waitedOn, canFinishNow). Rows are otherwise returned as they are.
 */
export async function withPresence(client: Db, roomId: string, players: DuelPlayerRow[]): Promise<DuelPlayerRow[]> {
  if (players.length === 0) return players;
  const rows = await presenceRows(client, roomId);
  if (!rows || rows.length === 0) return players;
  const seen = new Map(rows.map((r) => [r.user_id, r.last_seen_at]));
  return players.map((p) => {
    const beat = seen.get(p.user_id);
    if (!beat) return p;
    const later = laterIso(p.last_seen_at, beat);
    return later === p.last_seen_at || later === null ? p : { ...p, last_seen_at: later };
  });
}

/**
 * One heartbeat: stores the caller's last seen and returns the room's last-seen times, or null when the caller has
 * no player row in the room (nothing is stored or returned to an outsider).
 */
export async function recordHeartbeat(
  client: Db,
  roomId: string,
  userId: string,
  nowIso: string,
): Promise<RoomSeen | null> {
  const now = Date.now();
  if (!presenceKnownMissing(now)) {
    const { error } = await upsertPresence(client, roomId, userId, nowIso);
    // The heartbeat rows alone: the phone takes the later of these and its own copy of the player rows. Only the
    // room's players can have one (the composite key to duel_players).
    if (!error) return toSeen((await presenceRows(client, roomId)) ?? [{ user_id: userId, last_seen_at: nowIso }]);
    // 23503: the composite key to duel_players refused it, so the caller isn't in this room.
    if (error.code === "23503") return null;
    if (isMissingTable(error)) notePresenceMissing(now);
    // Any other failure falls through to the player row, which the server reads as well.
  }
  const { data } = await touchPlayerSeen(client, roomId, userId, nowIso);
  if (!data || data.length === 0) return null;
  const { data: rows } = await readPlayersSeen(client, roomId);
  return toSeen(rows ?? []);
}

function toSeen(rows: { user_id: string; last_seen_at: string }[]): RoomSeen {
  const seen: RoomSeen = {};
  for (const r of rows) if (r.user_id && r.last_seen_at) seen[r.user_id] = r.last_seen_at;
  return seen;
}
