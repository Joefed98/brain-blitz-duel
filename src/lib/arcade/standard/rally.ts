/**
 * The arcade scoring standard for `rally` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (rallyRev 12 and 13). The spec is the dealt
 * stamp's (rallyRev 13 since 15 Nov 2026, the Retro overhaul: lives and spin shots); `specFor` gives rallyRev 12's
 * three parts for its own rounds.
 */
import { RALLY_REV_LIVES, RALLY_REV_STD, RALLY_STD_SPEC, RALLY_STD_SPEC_V13 } from "../rally";
import type { StdSpec } from "../arcadeStandard";

export { RALLY_STD_SPEC_V13 as spec, rallyStdParts as parts } from "../rally";

export function specFor(rev: number): StdSpec | null {
  if (rev >= RALLY_REV_LIVES) return RALLY_STD_SPEC_V13;
  return rev >= RALLY_REV_STD ? RALLY_STD_SPEC : null;
}
