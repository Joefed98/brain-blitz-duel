/**
 * The plates for a page of rows (plates.ts; the tournament boards), read for every row on the page at once: the cards,
 * badges and titles through the shared `nameplatesFor` (docs/nameplate.md: #385's publicCardsFor and C2's
 * cardBadgesFor), the usernames, player numbers and dates of birth in one profiles read, and W3a's shown tiers. A
 * hidden under-18's name, initial, colour, cosmetics, emblem and badges never leave the server; the viewer always sees
 * their own card. A failed read of a cosmetic part (cards, tiers) draws the plate without it; a failed profile read
 * hides every other player (fails closed).
 */
import type { NameplateCard } from "@/design/identity/nameplate";
import { isUnder18 } from "@/lib/account/age";
import type { Db } from "@/lib/data/db.server";
import { readPlateProfiles } from "@/lib/data/plates.server";

import { nameplatesFor } from "./nameplates.server";
import { HIDDEN_PLATE, type PlateView } from "./plates";

export interface PlateInput {
  userId: string;
  /** The name stored with the row (a guest's room name; an account's username is read from its profile). */
  name: string;
  /** The room colour for a guest (colour and initial). */
  colour?: number;
}

async function tiersFor(client: Db, ids: readonly string[], nowMs: number): Promise<Map<string, string>> {
  try {
    const { shownTiersFor } = await import("@/lib/rated/ratings.server");
    const tiers = await shownTiersFor(client, ids, nowMs);
    const out = new Map<string, string>();
    for (const [id, view] of tiers) if (view) out.set(id, view.tier);
    return out;
  } catch {
    return new Map();
  }
}

/** Plates by user id for one page of rows (at most 100 ids; the boards send at most 51). */
export async function platesFor(client: Db, viewerId: string, rows: readonly PlateInput[], nowMs: number): Promise<Map<string, PlateView>> {
  const ids = [...new Set(rows.map((r) => r.userId))].slice(0, 100);
  const out = new Map<string, PlateView>();
  if (!ids.length) return out;
  const [cards, profiles, tiers] = await Promise.all([
    nameplatesFor(client, ids).catch((): Map<string, NameplateCard> | null => null),
    readPlateProfiles(client, ids),
    tiersFor(client, ids, nowMs),
  ]);
  const profileOf = new Map((profiles.error ? [] : profiles.data).map((p) => [p.user_id, p]));
  for (const r of rows) {
    if (out.has(r.userId) || !ids.includes(r.userId)) continue;
    const profile = profileOf.get(r.userId);
    const me = r.userId === viewerId;
    if (!me && (profiles.error !== null || (profile !== undefined && isUnder18(profile.date_of_birth, nowMs)))) {
      out.set(r.userId, HIDDEN_PLATE);
      continue;
    }
    if (!profile) {
      // No account: a guest, on their room colour and initial.
      out.set(r.userId, { kind: "plain", name: r.name || "Player", colour: r.colour ?? 0 });
      continue;
    }
    const card = cards?.get(r.userId);
    if (card) {
      out.set(r.userId, { kind: "card", name: profile.username, card, playerNumber: profile.player_number, tier: tiers.get(r.userId) ?? null });
    } else if (cards === null) {
      // The card read failed: the username on a plain disc (no account colour), never the cosmetics.
      out.set(r.userId, { kind: "plain", name: profile.username, colour: null });
    } else {
      // An account with no public card is waiting for deletion: hidden, as on the leaderboards.
      out.set(r.userId, me ? { kind: "plain", name: profile.username, colour: null } : HIDDEN_PLATE);
    }
  }
  return out;
}
