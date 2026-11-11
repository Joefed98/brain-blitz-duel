/**
 * Grouping a 4- or 8-player match out of W3b's queue (wave 3, W3d). Pure; W3b's own pairing rule (`canPair`: the same
 * format and choice, two different players, placement only with placement, ratings within the wider of their bands) holds
 * between every two players of the group, so the band widens exactly as it does for 1v1.
 */
import { canPair, type QueueEntry } from "@/lib/rated/matchmaking";

/**
 * A group of `size` for `me` among the waiting, or null. Others are taken nearest rating to `me` first, then the
 * longest wait, then the user id, each only when it pairs with every player already in the group.
 */
export function groupFor(me: QueueEntry, waiting: readonly QueueEntry[], size: number, nowMs: number): QueueEntry[] | null {
  const group: QueueEntry[] = [me];
  const order = waiting
    .filter((e) => e.userId !== me.userId)
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating) ||
        a.joinedAtMs - b.joinedAtMs ||
        (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
    );
  for (const e of order) {
    if (group.length >= size) break;
    if (group.some((g) => g.userId === e.userId)) continue;
    if (group.every((g) => canPair(g, e, nowMs))) group.push(e);
  }
  return group.length === size ? group : null;
}
