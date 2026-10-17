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

/* eslint-disable @typescript-eslint/no-explicit-any */

/** After the player's round_results row is stored: mark that they have finished this round. */
export async function markSubmitted(client: any, playerId: string, round: number): Promise<void> {
  try {
    await client
      .from("duel_players")
      .update({ submitted_round: round })
      .eq("id", playerId);
  } catch {
    /* Best effort: a ping is never worth failing a submission for. */
  }
}

/** Play again: the new game's rounds start again from 1, so no earlier mark may ping. */
export async function clearSubmitted(client: any, roomId: string): Promise<void> {
  try {
    await client.from("duel_players").update({ submitted_round: 0 }).eq("duel_id", roomId);
  } catch {
    /* Best effort, as above. */
  }
}
