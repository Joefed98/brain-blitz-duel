/**
 * The arcade scoring standard for `freekick` (Top Bins; arcadeStandard.ts; docs/arcade-standard/freekick.md): the dealt
 * stamp's spec (freekickRev 4, the drawn shot: Goals 120, Targets 40, Round the wall 10, Curl bonus 20, Five in a row 10)
 * and the parts, re-exported from the sim. `parts` returns rev 1's, 2's, 3's or 4's parts for a state on any of them and
 * null for any other revision.
 */
export { FREEKICK_V4_STD_SPEC as spec, freekickStdParts as parts } from "../freekick";
