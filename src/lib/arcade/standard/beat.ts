/**
 * The arcade scoring standard for `beat` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (beatRev 11 and 12). The spec is the dealt
 * stamp's (beatRev 12 since 15 Nov 2026, the Retro overhaul: a missed note scores 0); `from` is the first stamp on it.
 */
export { BEAT_STD_SPEC_V12 as spec, beatStdParts as parts, BEAT_REV_STD as from } from "../beat";
