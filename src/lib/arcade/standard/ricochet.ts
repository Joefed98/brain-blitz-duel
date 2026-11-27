/**
 * The arcade scoring standard for `ricochet` (arcadeStandard.ts; docs/arcade-standard/ricochet.md): Moon Climb's spec
 * (ricoRev 5, the live stamp: rev 3's parts under the 30 × 60 ninja's stamp, as ricoRev 4 had them under the bigger
 * ninja's) and the parts of every ninja revision (ricoRev 2's coins and lanterns, ricoRev 3, 4 and 5's flow, lantern
 * rides and scrolls), re-exported from the sim.
 * `parts` returns null for a state on the original shaft (unstamped), which never scored on the standard.
 */
export { MOON_MID_STD_SPEC as spec, ricochetStdParts as parts } from "../ricochetNinja";
