/**
 * The arcade scoring standard for `freekick` (Top Bins; arcadeStandard.ts; docs/arcade-standard/freekick.md): the dealt
 * stamp's spec (freekickRev 3, rev 1's parts on their own stamp, the core full at 1,100) and the parts, re-exported from the sim. `parts`
 * returns rev 1's, 2's or 3's parts for a state on any of them and null for any other revision.
 */
export { FREEKICK_V3_STD_SPEC as spec, freekickStdParts as parts } from "../freekick";
