/**
 * The plates for a page of rows (plates.ts; the tournament boards first), read for every row on the page at once: A1's public cards (the
 * rows getPublicCard draws), C2's card badges and titles, W3a's shown tiers and the dates of birth. A hidden under-18's
 * name, cosmetics, emblem and badges never leave the server; the viewer always sees their own card. A failed read of a
 * cosmetic part (badges, tiers) draws the plate without it; a failed age read hides every other player (fails closed).
 */
import { isUnder18 } from "@/lib/account/age";
import { cardBadgesFor } from "@/lib/badges/badges.server";
import { titleName } from "@/lib/badges/catalogue";
import type { CardBadges } from "@/lib/badges/types";
import type { Db } from "@/lib/data/db.server";
import { readPublicCards } from "@/lib/data/economy.server";
import { readDatesOfBirth } from "@/lib/data/plates.server";
import { SLOT_DEFAULTS } from "@/lib/economy/slots";

import { HIDDEN_PLAYER_NAME, plateEmblemOf, type PlateEmblem, type PlateView } from "./plates";

export interface PlateInput {
  userId: string;
  /** The name stored with the row (a guest's room name; an account's username is read from its card). */
  name: string;
  /** The room colour for a guest (colour and initial). */
  colour?: number;
}

async function tiersFor(client: Db, ids: readonly string[], nowMs: number): Promise<Map<string, PlateEmblem | null>> {
  try {
    const { shownTiersFor } = await import("@/lib/rated/ratings.server");
    const tiers = await shownTiersFor(client, ids, nowMs);
    return new Map([...tiers].map(([id, view]) => [id, plateEmblemOf(view)]));
  } catch {
    return new Map();
  }
}

async function badgesFor(client: Db, ids: readonly string[]): Promise<Map<string, CardBadges>> {
  try {
    return new Map((await cardBadgesFor(client, ids)).map((b) => [b.playerId, b]));
  } catch {
    return new Map();
  }
}

/** Plates by user id for one page of rows (at most 100 ids; the boards send at most 51). */
export async function platesFor(client: Db, viewerId: string, rows: readonly PlateInput[], nowMs: number): Promise<Map<string, PlateView>> {
  const ids = [...new Set(rows.map((r) => r.userId))].slice(0, 100);
  const out = new Map<string, PlateView>();
  if (!ids.length) return out;
  const [cards, births, badges, tiers] = await Promise.all([
    readPublicCards(client, ids),
    readDatesOfBirth(client, ids),
    badgesFor(client, ids),
    tiersFor(client, ids, nowMs),
  ]);
  const cardOf = new Map((cards.error ? [] : cards.data).map((c) => [c.user_id, c]));
  const birthOf = new Map((births.error ? [] : births.data).map((b) => [b.user_id, b.date_of_birth]));
  for (const r of rows) {
    if (out.has(r.userId) || !ids.includes(r.userId)) continue;
    const dob = birthOf.get(r.userId);
    const card = cardOf.get(r.userId);
    const hidden = r.userId !== viewerId && (births.error !== null || (dob !== undefined && isUnder18(dob, nowMs)));
    if (hidden) {
      const name = card?.username ?? r.name;
      out.set(r.userId, {
        kind: "hidden",
        name: HIDDEN_PLAYER_NAME,
        colour: card?.colour ?? r.colour ?? 0,
        initial: (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase(),
      });
    } else if (card) {
      const b = badges.get(r.userId);
      out.set(r.userId, {
        kind: "card",
        name: card.username,
        look: {
          avatarId: card.avatar_id,
          colour: card.colour,
          gem: card.gem,
          cardArt: card.card_art ?? SLOT_DEFAULTS["card-art"]!,
          frame: card.frame ?? SLOT_DEFAULTS["frame"]!,
          nameColour: card.name_colour,
          playerNumber: card.player_number,
          title: b ? titleName(b.title) : null,
          badges: (b?.badges ?? []).slice(0, 3),
          emblem: tiers.get(r.userId) ?? null,
        },
      });
    } else {
      out.set(r.userId, { kind: "guest", name: r.name || "Player", colour: r.colour ?? 0 });
    }
  }
  return out;
}
