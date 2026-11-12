/**
 * The equipped cosmetics others see (wave 2 E2): read through src/lib/data/plus.server.ts (public.cosmetics_public),
 * which only ever answers what an account itself equipped (A1's loadout: an item must be owned to be equipped). Guests
 * and unknown ids have none. Presentation only: never read by scoring, grading, replay, matchmaking or timing code.
 */
import type { Db } from "@/lib/data/db.server";
import { readPublicCosmetics } from "@/lib/data/plus.server";

import type { PublicCosmetics } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function publicCosmeticsFor(client: Db, userIds: readonly unknown[]): Promise<PublicCosmetics[]> {
  const ids = [...new Set(userIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)))].slice(0, 100);
  if (!ids.length) return [];
  const { data, error } = await readPublicCosmetics(client, ids);
  if (error) throw new Error(`cosmetics: ${error.message}`);
  return data.map((r) => ({
    userId: r.user_id,
    avatar: { id: r.avatar_id, colour: r.colour ?? 0, gem: r.gem },
    finish: r.finish,
    accessory: r.accessory,
    special: r.special,
    celebration: r.celebration,
    entrance: r.entrance,
    reactions: r.reactions,
    plusMark: r.plus_mark,
  }));
}

/** Whether an emote's pack is one the caller has equipped in a reaction slot (the server's check before a send). */
export async function canSendPack(client: Db, userId: string, pack: string): Promise<boolean> {
  const [mine] = await publicCosmeticsFor(client, [userId]);
  return !!mine && mine.reactions.includes(pack);
}
