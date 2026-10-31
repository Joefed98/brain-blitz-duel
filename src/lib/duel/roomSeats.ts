/**
 * A room's seats (31 Oct 2026, rooms of up to 16): which slot a new player takes, or that the room is
 * full. Shared by joinRoomFn (duel.functions.ts) and room-16-check, so the check proves the server's
 * own rule: up to roomCapacity(room) players still in the room (anyone who has not tapped Leave), the
 * lowest free slot first; the 17th is refused with roomFullMessage.
 */
import { roomCapacity, roomFullMessage, type DuelPlayerRow } from "./types";

type SeatRow = Pick<DuelPlayerRow, "player_slot" | "status">;

/** The lowest free slot among `capacity`, or null when the room is full. */
export function firstFreeSlot(players: readonly SeatRow[], capacity: number): number | null {
  const taken = new Set(players.filter((p) => p.status !== "left").map((p) => p.player_slot));
  for (let slot = 1; slot <= capacity; slot++) if (!taken.has(slot)) return slot;
  return null;
}

/** A join's seat in `room`: the slot, or the "full" refusal. */
export function seatFor(
  players: readonly SeatRow[],
  room: { max_players?: number | null },
): { ok: true; slot: number } | { ok: false; message: string } {
  const capacity = roomCapacity(room);
  const slot = firstFreeSlot(players, capacity);
  return slot === null ? { ok: false, message: roomFullMessage(capacity) } : { ok: true, slot };
}
