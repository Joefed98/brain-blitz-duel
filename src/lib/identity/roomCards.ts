/**
 * A room's player cards (13 Nov 2026, one identity everywhere; docs/nameplate.md "Rooms"): what the phone gets for
 * the players of the room it sits in, keyed by seat (duel_players.id), never by account. Pure: no React, no server.
 * The server builds it once per room in `roomCardsFn` (one batched read of every seat's card, badges, title, player
 * number and tier); the phone turns each seat into a `NameplatePlayer` with `roomNameplate`.
 */
import type { NameplateCard, NameplatePlayer } from "@/design/identity/nameplate";
import type { PlayerLook } from "@/lib/duel/playerLook";

/** One seat's card: only accounts with a public card have one. */
export interface RoomSeatCard {
  card: NameplateCard;
  playerNumber: number | null;
  tier: string | null;
}

/** Seat id (duel_players.id) → card. A seat missing here is drawn on its room colour and initial (or icon). */
export type RoomCards = Record<string, RoomSeatCard>;

/**
 * How a room draws one of its players: their card when they have one (an account, under-18s included: inside their
 * own room the other players are direct opponents and see them as usual), else the room's colour and initial or icon
 * (a guest, an account waiting for deletion, or before the cards arrive). Never "Hidden player" inside the room.
 */
export function roomNameplate(name: string, look: PlayerLook | undefined, seat: RoomSeatCard | undefined): NameplatePlayer {
  if (seat) return { kind: "card", name, card: seat.card, playerNumber: seat.playerNumber, tier: seat.tier };
  return { kind: "plain", name, colour: look?.colour ?? null, icon: look?.icon ?? null };
}

/**
 * The key a room's cards are re-read on: the seats that hold an account card or might (every seat id, sorted). It
 * changes when someone joins or leaves, never when a score moves, so a room reads its cards once and again on a join.
 */
export function roomCardsKey(seatIds: readonly string[]): string {
  return [...seatIds].sort().join(",");
}
