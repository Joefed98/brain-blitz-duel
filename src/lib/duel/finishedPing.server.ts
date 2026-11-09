/**
 * Server side of the live "finished" pings (finishedPings.ts): duel_players.submitted_round, the
 * last round a player's answer was stored for. Only a round number is written, never a score or
 * result. Both writes are best effort: before the 20261017140000 migration is applied the column
 * does not exist, the update returns an error that is ignored, and submitting and Play again work
 * exactly as before (phones then show no pings).
 *
 * The database client is passed in, so scripts/finished-pings-check.ts drives this exact code with
 * an in-memory stand-in.
 */

import type { Db } from "@/lib/data/db.server";
import { clearSubmittedRounds, setSubmittedRound } from "@/lib/data/players.server";

/** After the player's round_results row is stored: mark that they have finished this round. */
export async function markSubmitted(client: Db, playerId: string, round: number): Promise<void> {
  try {
    await setSubmittedRound(client, playerId, round);
  } catch {
    /* Best effort: a ping is never worth failing a submission for. */
  }
}

/** Play again: the new game's rounds start again from 1, so no earlier mark may ping. */
export async function clearSubmitted(client: Db, roomId: string): Promise<void> {
  try {
    await clearSubmittedRounds(client, roomId);
  } catch {
    /* Best effort, as above. */
  }
}
