/**
 * The plates for a page of rows (plates.ts; the tournament boards first), read for every row on the page at once: A1's
 * public cards through `publicCardsFor` (#385: the batched getPublicCard every row in the app draws from), C2's card
 * badges and titles through `cardBadgesFor`, W3a's shown tiers and the dates of birth. A hidden under-18's name,
 * initial, colour, cosmetics, emblem and badges never leave the server; the viewer always sees their own card. A failed
 * read of a cosmetic part (cards, badges, tiers) draws the plate without it; a failed age read hides every other player
 * (fails closed).
 */
import { isUnder18 } from "@/lib/account/age";
import { cardBadgesFor } from "@/lib/badges/badges.server";
import { titleName } from "@/lib/badges/catalogue";
import type { CardBadges } from "@/lib/badges/types";
import type { Db } from "@/lib/data/db.server";
import type { PublicCard } from "@/lib/data/economy";
import { readDatesOfBirth } from "@/lib/data/plates.server";
import { publicCardsFor } from "@/lib/economy/economy.server";

import { HIDDEN_PLATE, plateEmblemOf, type PlateEmblem, type PlateView } from "./plates";

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
    publicCardsFor(client, ids).catch(() => new Map<string, PublicCard>()),
    readDatesOfBirth(client, ids),
    badgesFor(client, ids),
    tiersFor(client, ids, nowMs),
  ]);
  const birthOf = new Map((births.error ? [] : births.data).map((b) => [b.user_id, b.date_of_birth]));
  for (const r of rows) {
    if (out.has(r.userId) || !ids.includes(r.userId)) continue;
    const dob = birthOf.get(r.userId);
    const card = cards.get(r.userId);
    const hidden = r.userId !== viewerId && (births.error !== null || (dob !== undefined && isUnder18(dob, nowMs)));
    if (hidden) {
      out.set(r.userId, HIDDEN_PLATE);
    } else if (card && card.account && card.username) {
      const b = badges.get(r.userId);
      out.set(r.userId, {
        kind: "card",
        name: card.username,
        look: {
          avatarId: card.avatarId ?? "captain-joulz",
          colour: card.colour ?? 0,
          gem: card.gem,
          cardArt: card.cardArt,
          frame: card.frame,
          nameColour: card.nameColour,
          playerNumber: card.playerNumber,
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
