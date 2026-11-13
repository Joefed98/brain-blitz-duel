/**
 * A room's player cards on the server (13 Nov 2026, one identity everywhere; docs/nameplate.md "Rooms"). One read of
 * the room's seats, then one batched read of every account's card, badges, title, player number and tier through
 * the shared `platesFor` (on `nameplatesFor`: `publicCardsFor` and `cardBadgesFor`, 100 ids a read), with the room
 * audience: inside their own room the other players are direct opponents and see everyone as usual. Only a caller
 * who holds a seat in the room gets an answer. Cards are keyed by seat, never by account id.
 */
import type { Db } from "@/lib/data/db.server";
import { readPlayers } from "@/lib/data/players.server";
import type { DuelPlayerRow } from "@/lib/duel/types";

import { platesFor } from "./plates.server";
import type { RoomCards } from "./roomCards";

/**
 * The one place a room's card reads take a player's id from a seat (Security will swap room-mates' account ids for
 * public ids; that swap happens here and nowhere else in the cards path).
 */
export function cardIdOf(seat: Pick<DuelPlayerRow, "user_id">): string {
  return seat.user_id;
}

/** The room's cards for a caller seated in it (null: not in the room, or the seats couldn't be read). */
export async function roomCardsFor(client: Db, roomId: string, callerId: string, nowMs: number): Promise<RoomCards | null> {
  const { data: seats, error } = await readPlayers(client, roomId);
  if (error || !seats) return null;
  if (!seats.some((s) => s.user_id === callerId)) return null;
  const rows = seats.map((s) => ({ userId: cardIdOf(s), name: s.display_name, ...(s.colour === null ? {} : { colour: s.colour }) }));
  // One batched read for the whole room (never one per player). A failure draws every seat on its room look.
  const plates = await platesFor(client, callerId, rows, nowMs, { audience: "room" }).catch(() => null);
  const out: RoomCards = {};
  if (!plates) return out;
  for (const seat of seats) {
    const plate = plates.get(cardIdOf(seat));
    if (plate?.kind === "card") out[seat.id] = { card: plate.card, playerNumber: plate.playerNumber ?? null, tier: plate.tier ?? null };
  }
  return out;
}
