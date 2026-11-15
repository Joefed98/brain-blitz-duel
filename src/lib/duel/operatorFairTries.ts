/**
 * Operator `gapsRev 2` (the Number overhaul, 15 Nov 2026; numberOverhaul.ts): the phone's rules for tries and moving
 * between equations. Shared by phone and checks, pure.
 *
 * - A full line uses a try only when it is a fill not tried before on that equation (gapsRev 1: every full line,
 *   the same fill again included). The fill is the stage's segment (operatorGaps.ts), its gaps in reading order.
 * - Next goes to the next equation still open (not solved, tries left) after the current one; with none after it,
 *   Next says Finish and ends the round. A solved equation moves on to the next open one, round to the start. Any open
 *   equation can be gone back to with its chip while time is left.
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
 * The next open stage after `from`, or null when there is none. `open(i)` is true for a stage the player can still
 * play. With `wrap` the search goes round to the start (after a solve: back to an equation skipped earlier); without it
 * (Next) it stops at the last equation, so Next there says Finish and ends the round, and an earlier skipped equation
 * is gone back to with its chip.
 */
export function nextOpenStage(from: number, total: number, open: (stage: number) => boolean, wrap = true): number | null {
  for (let step = 1; step < total; step++) {
    const i = from + step;
    if (i >= total && !wrap) return null;
    if (open(i % total)) return i % total;
  }
  return null;
}

/** The gap a key fills: the chosen empty gap when it is of the key's kind, else the leftmost empty gap of that kind. */
export function targetGap(kinds: readonly ("number" | "sign")[], fills: readonly (string | null)[], kind: "number" | "sign", chosen: number | null): number {
  if (chosen !== null && kinds[chosen] === kind && !fills[chosen]) return chosen;
  return kinds.findIndex((k, i) => k === kind && !fills[i]);
}

/** The Next button's word: gapsRev 2 says Finish when no other equation is open; gapsRev 1 Submit on the last. */
export function operatorNextLabel(fairTries: boolean, nextOpen: number | null, stage: number, total: number): "Next" | "Finish" | "Submit" {
  if (fairTries) return nextOpen === null ? "Finish" : "Next";
  return stage >= total - 1 ? "Submit" : "Next";
}
