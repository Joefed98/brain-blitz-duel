/**
 * The nameplates for a list's rows in the list's own call (one call per page; docs/nameplate.md): A1's public cards
 * through the Friends follow-up's batched `publicCardsFor` and C2's badges and titles through `cardBadgesFor`, 100 ids
 * a read, in parallel. Only accounts come back: a guest, an unknown id or an account waiting for deletion is left out
 * (its row keeps colour and initial, or is hidden). Never send the ids themselves to the phone.
 */
import type { NameplateCard } from "@/design/identity/nameplate";
import { cardBadgesFor } from "@/lib/badges/badges.server";
import type { Db } from "@/lib/data/db.server";
import { publicCardsFor } from "@/lib/economy/economy.server";

export async function nameplatesFor(client: Db, playerIds: readonly string[]): Promise<Map<string, NameplateCard>> {
  const ids = [...new Set(playerIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const [cards, worn] = await Promise.all([
    publicCardsFor(client, ids),
    // A badge read that fails leaves the cards without badges, never without cards.
    Promise.all(chunks.map((chunk) => cardBadgesFor(client, chunk).catch(() => []))).then((parts) => parts.flat()),
  ]);
  const badges = new Map(worn.map((b) => [b.playerId, b]));
  const out = new Map<string, NameplateCard>();
  for (const [id, c] of cards) {
    if (!c.account || c.avatarId === null || c.colour === null) continue;
    out.set(id, {
      avatarId: c.avatarId,
      colour: c.colour,
      gem: c.gem,
      cardArt: c.cardArt,
      frame: c.frame,
      nameColour: c.nameColour,
      badges: badges.get(id)?.badges ?? [],
      title: badges.get(id)?.title ?? null,
    });
  }
  return out;
}
