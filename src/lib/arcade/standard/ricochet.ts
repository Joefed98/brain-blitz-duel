/**
 * The arcade scoring standard for `ricochet` (arcadeStandard.ts; docs/arcade-standard/ricochet.md): Moon Climb's spec
 * (ricoRev 3, the live stamp) and the parts of either ninja revision (ricoRev 2's coins and lanterns, ricoRev 3's flow,
 * lantern rides and scrolls), re-exported from the sim. `parts` returns null for a state on the original shaft
 * (unstamped), which never scored on the standard.
 */
export { MOON_STD_SPEC as spec, ricochetStdParts as parts } from "../ricochetNinja";
