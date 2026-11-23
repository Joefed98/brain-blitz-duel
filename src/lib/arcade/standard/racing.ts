/**
 * The arcade scoring standard for `racing` (Apex; arcadeStandard.ts, docs/arcade-standard/racing.md): the dealt
 * revision's spec (racingRev 5, D6: pace against each circuit's realistic par, and four clean sectors; racingRev 4 the
 * circuit's oracle par and all eight) and the parts, re-exported from the sim. `parts` scores racingRev 1 and 2 states
 * (distance, clean sectors, finish, speed) and racingRev 3 to 5's (pace, clean sectors), and returns null for any other.
 */
export { RACING_V5_STD_SPEC as spec, racingStdParts as parts } from "../racing";
