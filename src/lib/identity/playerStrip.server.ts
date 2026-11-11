/**
 * Nameplate strips for a page's players in one batch (wave 4 W4c, Joe's rule of 11 Nov 2026): A1's public cards
 * (`economy_public_cards`, 100 ids a read) and, where the page is open to anyone, the dates of birth to hide under-18s.
 * An id with no public card is a deleted account (pages that show guests pass their names and colours in `guests`).
 */
import type { Db } from "@/lib/data/db.server";
import { readPublicCards } from "@/lib/data/economy.server";
import { readDatesOfBirth } from "@/lib/data/profiles.server";
import { isUnder18 } from "@/lib/account/age";

import { accountStrip, deletedStrip, guestStrip, hiddenStrip, type PlayerStripLook } from "./playerStrip";

export async function playerStrips(
  client: Db,
  ids: readonly string[],
  opts: { nowMs: number; hideUnder18?: boolean; guests?: ReadonlyMap<string, { name: string; colour: number }> },
): Promise<Map<string, PlayerStripLook>> {
  const out = new Map<string, PlayerStripLook>();
  const list = [...new Set(ids)].filter((id) => !opts.guests?.has(id));
  for (const [id, g] of opts.guests ?? []) out.set(id, guestStrip(g.name, g.colour));
  const under18 = new Set<string>();
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const { data, error } = await readPublicCards(client, part);
    if (error) console.error("[strips] cards", error.message);
    for (const row of data) out.set(row.user_id, accountStrip(row));
    if (opts.hideUnder18) {
      const dob = await readDatesOfBirth(client, part);
      // A failed read hides everyone on it: never show an under-18 by mistake.
      if (dob.error) for (const id of part) under18.add(id);
      for (const r of dob.data) if (!r.date_of_birth || isUnder18(r.date_of_birth, opts.nowMs)) under18.add(r.user_id);
    }
  }
  for (const id of list) {
    if (under18.has(id) && out.has(id)) out.set(id, hiddenStrip());
    if (!out.has(id)) out.set(id, deletedStrip());
  }
  return out;
}
