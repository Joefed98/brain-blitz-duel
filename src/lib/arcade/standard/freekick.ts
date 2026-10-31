/**
 * The arcade scoring standard for `freekick` (Top Bins; arcadeStandard.ts; docs/arcade-standard/freekick.md): the dealt
 * stamp's spec (freekickRev 2, rev 1's parts on their own stamp) and the parts, re-exported from the sim. `parts`
 * returns rev 1's or rev 2's parts for a state on either and null for any other revision.
 */
export { FREEKICK_V2_STD_SPEC as spec, freekickStdParts as parts } from "../freekick";
