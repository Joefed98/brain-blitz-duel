/**
 * The equipped cosmetics of the players this phone has seen (wave 2 E2): fetched once per player from the server
 * (getPublicCosmeticsFn) and kept in memory, so a room's reactions and podium can show each player's own choice (only
 * what its owner equipped; everyone sees the same). Guests and players not yet known have none. Display only.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { NO_COSMETICS, type PublicCosmetics } from "./types";

const known = new Map<string, PublicCosmetics | null>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

type Fetcher = (userIds: string[]) => Promise<PublicCosmetics[]>;
let fetcher: Fetcher | null = null;

/** Checks only: stands in for the server (null: the real one). */
export function setCosmeticsFetcher(next: Fetcher | null): void {
  fetcher = next;
}
/** Checks only: forgets every player. */
export function resetCosmetics(): void {
  known.clear();
  pending.clear();
  version++;
  for (const l of listeners) l();
}

async function fetchCosmetics(userIds: string[]): Promise<PublicCosmetics[]> {
  if (fetcher) return fetcher(userIds);
  const { getPublicCosmeticsFn } = await import("./cosmetics.functions");
  // Asked for by public id (Security C1b): the room's players' keys (seatKey.ts).
  return getPublicCosmeticsFn({ data: { playerIds: userIds } });
}

function publish(): void {
  version++;
  for (const l of listeners) l();
}

/** Asks the server for any of these players not yet known (one call for all of them). */
export function loadCosmetics(userIds: readonly (string | null | undefined)[]): void {
  const missing = [...new Set(userIds.filter((id): id is string => !!id && !known.has(id) && !pending.has(id)))];
  if (!missing.length) return;
  for (const id of missing) pending.add(id);
  void fetchCosmetics(missing)
    .then((rows) => {
      const byId = new Map(rows.map((r) => [r.userId, r]));
      for (const id of missing) known.set(id, byId.get(id) ?? null);
    })
    .catch(() => {
      for (const id of missing) known.set(id, null);
    })
    .finally(() => {
      for (const id of missing) pending.delete(id);
      publish();
    });
}

/** Forgets one player (after this phone's own player changes their look, so it is asked again). */
export function forgetCosmetics(userId: string): void {
  known.delete(userId);
  publish();
}

/** A player's cosmetics, or none. */
export function cosmeticsOf(userId: string | null | undefined): Omit<PublicCosmetics, "userId"> {
  return (userId && known.get(userId)) || NO_COSMETICS;
}

/** Whether a player is known to have equipped this reaction pack (a receiver's check before showing an emote). */
export function mayUsePack(userId: string, pack: string): boolean {
  const c = userId ? known.get(userId) : undefined;
  if (c === undefined) loadCosmetics([userId]);
  return !!c && c.reactions.includes(pack);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The cosmetics of these players, loading any not yet known; re-renders when they arrive. */
export function useCosmetics(userIds: readonly (string | null | undefined)[]): Map<string, Omit<PublicCosmetics, "userId">> {
  const key = userIds.filter(Boolean).join(",");
  useEffect(() => {
    loadCosmetics(userIds);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  return useMemo(() => {
    const out = new Map<string, Omit<PublicCosmetics, "userId">>();
    for (const id of userIds) if (id) out.set(id, cosmeticsOf(id));
    return out;
  }, [key, v]); // eslint-disable-line react-hooks/exhaustive-deps
}
