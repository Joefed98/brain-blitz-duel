/**
 * The round engine's ranking (B6, docs/round-engine/plan.md): the one ranking (B3, ranking.ts) and the tie-break's
 * time used (scoring.ts), under the engine's name, so a new mode imports the engine. Nothing is moved: ranking.ts
 * stays the only order, and ranking-identity-check proves it.
 */
export { compareRank, outcomeOf, placesOf, sameRank, type Outcome, type RankRow } from "@/lib/duel/ranking";
export { roundTimeUsedMs, type TieRound } from "@/lib/duel/scoring";
