/**
 * The arcade scoring standard for `rally` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (rallyRev 12, 13 and 14). The spec is the dealt
 * stamp's (rallyRev 14 since 23 Nov 2026, D5's ladder: rallyRev 13's lives and spin shots on lowered lines); `specFor`
 * gives rallyRev 13's and 12's parts for their own rounds.
 */
import { RALLY_REV_LADDER, RALLY_REV_LIVES, RALLY_REV_STD, RALLY_STD_SPEC, RALLY_STD_SPEC_V13, RALLY_STD_SPEC_V14 } from "../rally";
import type { StdSpec } from "../arcadeStandard";

export { RALLY_STD_SPEC_V14 as spec, rallyStdParts as parts } from "../rally";

export function specFor(rev: number): StdSpec | null {
  // rallyRev 14 (D5's ladder, 23 Nov 2026): the same four parts on Normal's lowered lines.
  if (rev >= RALLY_REV_LADDER) return RALLY_STD_SPEC_V14;
  if (rev >= RALLY_REV_LIVES) return RALLY_STD_SPEC_V13;
  return rev >= RALLY_REV_STD ? RALLY_STD_SPEC : null;
}
