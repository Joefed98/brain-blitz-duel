/**
 * The arcade scoring standard for `racing` (Apex; arcadeStandard.ts, docs/arcade-standard/racing.md): the dealt
 * revision's spec (racingRev 3: pace and clean sectors) and the parts, re-exported from the sim. `parts` scores
 * racingRev 1 and 2 states (distance, clean sectors, finish, speed) and racingRev 3's (pace, clean sectors), and returns
 * null for any other.
 */
export { RACING_V3_STD_SPEC as spec, racingStdParts as parts } from "../racing";
