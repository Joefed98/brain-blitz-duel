/**
 * The round engine (B6, docs/round-engine/plan.md): the parts of running one round that rooms, async rooms (the
 * Daily, challenges) and practice share, from the deal to the stored result and the ranking. Each mode keeps its own
 * flow (a room's live phases and presence, an async round's attempt window, practice's sealed deal), its guards, its
 * events and its data-layer writes; it calls the engine for the rules they must agree on.
 *
 *   deal       deal.server.ts   dealRounds (rooms, Daily, challenges), dealOne (practice)
 *   window     window.ts        roundWindow / windowReceipt (when a round times out, turns late, closes)
 *   receipt    receipt.ts       receiptMsRemaining (the server's time left: room phase, async start, practice seal)
 *   trust      trust.ts         trustedClaim ("room" / "practice" rules)
 *   grade      duel/roomGrade.server.ts gradeRound (receipt → trust → gradeAnswer)
 *   result     result.ts        resultColumns
 *   rank       rank.ts          compareRank, placesOf, roundTimeUsedMs
 *
 * This index re-exports the pure parts only (phone-safe); import the server parts from their own files.
 */
export type RoundMode = "room" | "async" | "practice";

export * from "./window";
export * from "./receipt";
export * from "./result";
export * from "./rank";
