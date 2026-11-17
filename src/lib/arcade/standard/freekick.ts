/**
 * The arcade scoring standard for `freekick` (Top Bins; arcadeStandard.ts; docs/arcade-standard/freekick.md): the dealt
 * stamp's spec (freekickRev 5, the layered kick: Goals 120, Targets 40, Skill shots 30, Five in a row 10; rev 4's spec stays in the sim)
 * and the parts, re-exported from the sim. `parts` returns rev 1's, 2's, 3's or 4's parts for a state on any of them and
 * null for any other revision.
 */
export { FREEKICK_V6_STD_SPEC as spec, freekickStdParts as parts } from "../freekick";
