/**
 * The phone's half of a room's player cards (13 Nov 2026, one identity everywhere): one roomCardsFn call per room,
 * again only when the seats change (someone joins or leaves; `roomCardsKey`), never one call per player and never on a
 * score or phase change. Kept in memory per room; a failure draws every seat on its room look. Display only.
 */
import { useEffect, useState } from "react";

import { NO_ROOM_CARDS, readRoomCardsAnswer, roomCardsKey, type RoomCardsAnswer } from "./roomCards";

type Fetcher = (roomId: string) => Promise<RoomCardsAnswer>;
let fetcher: Fetcher | null = null;

/** Checks only: stands in for the server (null: the real call). */
export function setRoomCardsFetcher(next: Fetcher | null): void {
  fetcher = next;
}

async function fetchRoomCards(roomId: string): Promise<RoomCardsAnswer> {
  if (fetcher) return readRoomCardsAnswer(await fetcher(roomId));
  const { roomCardsFn } = await import("./roomCards.functions");
  return readRoomCardsAnswer(await roomCardsFn({ data: { roomId } }));
}

/** Last answer per room (kept across screens of the same room, so a new screen draws the cards at once). */
const cache = new Map<string, { key: string; cards: RoomCardsAnswer }>();

const NONE: RoomCardsAnswer = NO_ROOM_CARDS;

/** The room's cards by seat id (and its seats hidden outside the room), read once per set of seats. */
export function useRoomCards(roomId: string | null | undefined, seatIds: readonly string[]): RoomCardsAnswer {
  const key = roomCardsKey(seatIds);
  const [cards, setCards] = useState<RoomCardsAnswer>(() => (roomId ? (cache.get(roomId)?.cards ?? NONE) : NONE));
  useEffect(() => {
    if (!roomId || !key) return;
    const known = cache.get(roomId);
    if (known?.key === key) {
      setCards(known.cards);
      return;
    }
    let live = true;
    void fetchRoomCards(roomId)
      .then((next) => {
        const value = next;
        cache.set(roomId, { key, cards: value });
        if (live) setCards(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [roomId, key]);
  return cards;
}

/** Checks only: forgets every room. */
export function resetRoomCards(): void {
  cache.clear();
}
