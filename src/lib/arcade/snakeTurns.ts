/**
 * Meteor's turns from the player's gestures (P4, desktop size PR 2, 28 Nov 2026): the one place the stage turns a key's
 * direction or a swipe into the turn it queues (0 up, 1 right, 2 down, 3 left in the world), so landscape-check runs the
 * stage's own arithmetic. The stage hands these the key as the world sees it (useGameKeys turns direction keys on a
 * turned board, desktopPresentation.ts rotatedKey) and the swipe as the world sees it (tapMapping.ts arenaDelta), so the
 * landscape board queues exactly the turns the upright board does for the same intended moves. Pure, no sim import.
 */
export type SnakeTurn = 0 | 1 | 2 | 3;

/** A direction key's turn. */
export function snakeTurnOfDirection(dir: "up" | "right" | "down" | "left"): SnakeTurn {
  return dir === "up" ? 0 : dir === "right" ? 1 : dir === "down" ? 2 : 3;
}

/** A swipe's turn once it has moved `minPx` along either axis (null before then): the longer axis wins. */
export function snakeTurnOfSwipe(dx: number, dy: number, minPx: number): SnakeTurn | null {
  if (Math.abs(dx) < minPx && Math.abs(dy) < minPx) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}
