/**
 * The arcade scoring standard for `skyline` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (skylineRev 9 and 10). The spec is the dealt
 * stamp's (skylineRev 10 since Nov 2026, the scoring audit: perfect drops counted); `from` is the first stamp on it.
 */
export { SKYLINE_STD_SPEC_V10 as spec, skylineStdParts as parts, SKYLINE_REV_STD as from } from "../skyline";
