/**
 * The phone's view of when each player was last seen (Speed fix 3, 9 Nov 2026; presentation and room data only).
 *
 * Heartbeats no longer reach every phone through realtime (presence.server.ts): each phone takes the room's last-seen
 * times from its own heartbeat's reply, and, on a database without the `duel_presence` table, from the player rows'
 * realtime updates applied in place. `withSeen` lays them over the player rows, so `isConnected` and every rule built
 * on it (roomFlow.ts) read the later of the two, exactly as they read `last_seen_at` before.
 */
import { seatKey } from "./seatKey";
import type { DuelPlayerRow } from "./types";

/** Last seen by player key (seatKey.ts: the public id), epoch ms. */
export type SeenMap = Map<string, number>;

/** Takes each time that is later than the one held. True if any changed. */
export function noteSeen(seen: SeenMap, record: Record<string, string> | null | undefined): boolean {
  if (!record) return false;
  let changed = false;
  for (const [userId, iso] of Object.entries(record)) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    if (ms > (seen.get(userId) ?? -Infinity)) {
      seen.set(userId, ms);
      changed = true;
    }
  }
  return changed;
}

/** The rows with `last_seen_at` the later of the row's own and the map's; rows (and the list) kept when unchanged. */
export function withSeen(players: DuelPlayerRow[], seen: SeenMap): DuelPlayerRow[] {
  let changed = false;
  const out = players.map((p) => {
    const key = seatKey(p);
    const ms = key ? seen.get(key) : undefined;
    if (ms === undefined) return p;
    const own = Date.parse(p.last_seen_at);
    if (Number.isFinite(own) && own >= ms) return p;
    changed = true;
    return { ...p, last_seen_at: new Date(ms).toISOString() };
  });
  return changed ? out : players;
}

/**
 * A realtime UPDATE of one player row, applied to the list held: `"seen"` when the only change is `last_seen_at` (a
 * heartbeat on a database without `duel_presence`: nothing to redraw but the time), the new list when another field
 * changed, or `"refetch"` when the row can't be applied in place (unknown row, or the payload lacks a field the list
 * has, so the list is read afresh as before).
 */
export function applyPlayerUpdate(
  players: DuelPlayerRow[],
  next: Partial<DuelPlayerRow> | null | undefined,
): DuelPlayerRow[] | "seen" | "refetch" {
  if (!next || typeof next.id !== "string") return "refetch";
  const at = players.findIndex((p) => p.id === next.id);
  if (at < 0) return "refetch";
  const held = players[at]!;
  const keys = Object.keys(held) as (keyof DuelPlayerRow)[];
  if (keys.some((k) => !(k in next))) return "refetch";
  const merged = { ...held, ...next } as DuelPlayerRow;
  const others = keys.some((k) => k !== "last_seen_at" && JSON.stringify(held[k]) !== JSON.stringify(merged[k]));
  if (!others) return "seen";
  if (merged.player_slot !== held.player_slot) return "refetch";
  const list = players.slice();
  list[at] = merged;
  return list;
}
