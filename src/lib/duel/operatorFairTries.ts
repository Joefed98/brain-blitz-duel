/**
 * Operator `gapsRev 2` (the Number overhaul, 15 Nov 2026; numberOverhaul.ts): the phone's rules for tries and moving
 * between equations. Shared by phone and checks, pure.
 *
 * - A full line uses a try only when it is a fill not tried before on that equation (gapsRev 1: every full line,
 *   the same fill again included). The fill is the stage's segment (operatorGaps.ts), its gaps in reading order.
 * - Next goes to the next equation still open (not solved, tries left), after the current one and round to the start;
 *   with no other open equation it finishes the round. Any open equation can be gone back to while time is left.
 *
 * The server's grading is unchanged: each equation is graded on its own segment and the try counts the phone sends
 * (standard/number.server.ts), so an equation skipped and solved later counts like any other.
 */

/** One full line on a stage: whether it uses a try, and the stage's tried fills after it. */
export function countTry(fairTries: boolean, tried: readonly string[], segment: string): { uses: boolean; tried: string[] } {
  if (!fairTries) return { uses: true, tried: [...tried] };
  if (tried.includes(segment)) return { uses: false, tried: [...tried] };
  return { uses: true, tried: [...tried, segment] };
}

/**
 * The next open stage after `from` (round to the start), or null when no other stage is open. `open(i)` is true for a
 * stage the player can still play.
 */
export function nextOpenStage(from: number, total: number, open: (stage: number) => boolean): number | null {
  for (let step = 1; step < total; step++) {
    const i = (from + step) % total;
    if (open(i)) return i;
  }
  return null;
}

/** The gap a key fills: the chosen empty gap when it is of the key's kind, else the leftmost empty gap of that kind. */
export function targetGap(kinds: readonly ("number" | "sign")[], fills: readonly (string | null)[], kind: "number" | "sign", chosen: number | null): number {
  if (chosen !== null && kinds[chosen] === kind && !fills[chosen]) return chosen;
  return kinds.findIndex((k, i) => k === kind && !fills[i]);
}
