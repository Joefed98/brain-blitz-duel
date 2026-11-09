/**
 * The round engine's deal (B6, docs/round-engine/plan.md). The functions live beside the one deal decider in
 * generate.server.ts (so neither file imports the other); this is the engine's name for them.
 *
 * The app's callers (buildRoomPuzzles, daily.server.ts, challenge.server.ts, practice.functions.ts) import them from
 * generate.server.ts itself: importing this re-export from app code turned the production build's generate.server chunk
 * into a shared chunk with mangled export names, and standard-live-check reads `buildRoomPuzzles` and `gradeAnswer` from
 * that chunk by name. A new caller imports generate.server.ts the same way, or checks the built chunk's exports.
 */
export { dealOne, dealRounds, type RoundDealContext } from "@/lib/duel/generate.server";
