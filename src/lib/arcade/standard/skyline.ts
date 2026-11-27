/**
 * The arcade scoring standard for `skyline` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (skylineRev 9, 10, 11 and 12). The spec is the
 * dealt stamp's (skylineRev 12 since 22 Nov 2026, D5: skylineRev 11's play, floors full at 45, perfect drops at 24, the
 * streak at 5 and gold at 2 of 5 on Normal; skylineRev 11 before it, the Action overhaul's lives); `from` is the first stamp on it.
 */
export { SKYLINE_STD_SPEC_V12 as spec, skylineStdParts as parts, SKYLINE_REV_STD as from } from "../skyline";
