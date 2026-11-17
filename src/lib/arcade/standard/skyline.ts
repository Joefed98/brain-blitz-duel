/**
 * The arcade scoring standard for `skyline` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (skylineRev 9, 10 and 11). The spec is the dealt
 * stamp's (skylineRev 11 since 15 Nov 2026, the Action overhaul: lives; the same parts as 10's, perfect drops counted);
 * `from` is the first stamp on it.
 */
export { SKYLINE_STD_SPEC_V11 as spec, skylineStdParts as parts, SKYLINE_REV_STD as from } from "../skyline";
