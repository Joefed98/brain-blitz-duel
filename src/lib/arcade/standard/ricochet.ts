/**
 * The arcade scoring standard for `ricochet` (arcadeStandard.ts; docs/arcade-standard/ricochet.md): the ninja
 * wall-climb's spec (ricoRev 2) and its parts, re-exported from the sim. `parts` returns null for a state on the original
 * shaft (unstamped), which never scored on the standard.
 */
export { NINJA_STD_SPEC as spec, ninjaStdParts as parts } from "../ricochetNinja";
