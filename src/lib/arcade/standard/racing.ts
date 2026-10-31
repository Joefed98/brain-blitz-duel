/**
 * The arcade scoring standard for `racing` (Apex; arcadeStandard.ts, docs/arcade-standard/racing.md): the dealt
 * revision's spec (racingRev 2, the lights start) and the parts, re-exported from the sim. `parts` scores racingRev 1
 * and 2 states (the same four parts; rev 2's speed on the race clock from lights out) and returns null for any other.
 */
export { RACING_V2_STD_SPEC as spec, racingStdParts as parts } from "../racing";
