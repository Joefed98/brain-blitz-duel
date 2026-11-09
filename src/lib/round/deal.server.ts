/**
 * The round engine's deal (B6, docs/round-engine/plan.md). The functions live beside the one deal decider in
 * generate.server.ts (so neither file imports the other); this is the engine's name for them.
 */
export { dealOne, dealRounds, type RoundDealContext } from "@/lib/duel/generate.server";
