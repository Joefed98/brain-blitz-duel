/**
 * The arcade scoring standard for `bintoss` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revision.
 */
import type { StdPart, StdSpec } from "../arcadeStandard";

export const spec: StdSpec | null = null;
export function parts(_state: unknown): StdPart[] | null {
  return null;
}
