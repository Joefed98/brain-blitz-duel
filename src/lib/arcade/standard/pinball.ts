/**
 * The arcade scoring standard for `pinball` (arcadeStandard.ts): its spec and its parts, re-exported from the sim.
 * `parts` returns null for a state that is not on the standard revisions (pinRev 6 and 7). The spec is the dealt stamp's
 * (pinRev 7 since 15 Nov 2026, the Retro overhaul: one J-O-U-L-Z set fills its part); `from` is the first stamp on it.
 */
// pinRev 8 since 16 Nov 2026 (the Retro overhaul, stage 3): pinRev 7's play and parts with the outlane saves counted.
// pinRev 9 since 23 Nov 2026 (D5's ladder): pinRev 8's play on Normal's refitted lines (56,000 table points, jackpots 8, combos 8).
export { PIN_STD_SPEC_V9 as spec, pinballStdParts as parts } from "../pinball4";
export { PIN_REV_STD as from } from "../pinball";
