/**
 * The arcade scoring standard for `beat` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (beatRev 11, 12 and 13). The spec is the dealt
 * stamp's (beatRev 13 since 23 Nov 2026, D5's ladder: golden notes full at 5 in 9, the streak at 70 % of the notes;
 * beatRev 12 before it: a missed note scores 0); `from` is the first stamp on it.
 */
export { BEAT_STD_SPEC_V13 as spec, beatStdParts as parts, BEAT_REV_STD as from } from "../beat";
