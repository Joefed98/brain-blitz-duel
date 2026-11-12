/**
 * Nameplate strips for a page's players in one batch (wave 4 W4c, Joe's rules of 11 and 12 Nov 2026): A1's public
 * cards (`economy_public_cards`, 100 ids a read) and the dates of birth, giving the open view (under-18s hidden) and the
 * direct view (the player themself and their opponent in their own match).
 * An id with no public card is a deleted account (pages that show guests pass their names and colours in `guests`).
 */
import type { Db } from "@/lib/data/db.server";
import { readPublicCards } from "@/lib/data/economy.server";
import { readDatesOfBirth } from "@/lib/data/profiles.server";
import { isUnder18 } from "@/lib/account/age";

import { accountStrip, deletedStrip, guestStrip, hiddenStrip, type PlayerStripLook } from "./playerStrip";

export interface PlayerStripSets {
  /** For lists other players can see: under-18s are "Hidden player". */
  open: Map<string, PlayerStripLook>;
  /** For the player themself and their direct opponent in their own match: nobody hidden. */
  direct: Map<string, PlayerStripLook>;
}

/**
 * Both views of a page's players from the same batch reads (Joe, 12 Nov 2026: under-18s are hidden on every list other
 * players can see and shown only to their direct opponent in their own match, as in ordinary rooms).
 */
export async function playerStripSets(
  client: Db,
  ids: readonly string[],
  opts: { nowMs: number; guests?: ReadonlyMap<string, { name: string; colour: number }> },
): Promise<PlayerStripSets> {
  const direct = new Map<string, PlayerStripLook>();
  const list = [...new Set(ids)].filter((id) => !opts.guests?.has(id));
  for (const [id, g] of opts.guests ?? []) direct.set(id, guestStrip(g.name, g.colour));
  const under18 = new Set<string>();
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const { data, error } = await readPublicCards(client, part);
    if (error) console.error("[strips] cards", error.message);
    for (const row of data) direct.set(row.user_id, accountStrip(row));
    const dob = await readDatesOfBirth(client, part);
    // A failed read hides everyone on it: never show an under-18 by mistake.
    if (dob.error) for (const id of part) under18.add(id);
    for (const r of dob.data) if (!r.date_of_birth || isUnder18(r.date_of_birth, opts.nowMs)) under18.add(r.user_id);
  }
  for (const id of list) if (!direct.has(id)) direct.set(id, deletedStrip());
  const open = new Map<string, PlayerStripLook>();
  for (const [id, strip] of direct) open.set(id, strip.kind === "account" && under18.has(id) ? hiddenStrip() : strip);
  return { open, direct };
}
