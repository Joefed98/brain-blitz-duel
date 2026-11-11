/**
 * What a rated match earns beyond its ratings (wave 3, session W3a; docs/rated/ratings-interface.md). Server only.
 *
 *   finishRatedMatch(client, result)   recordRatedMatch, then the competitive badges each player's record now earns
 *                                      (through C2's badge_award, so each is awarded once). The match engine (W3b)
 *                                      calls this one.
 *   runStandingsAndBadges(client)      the standings job, then the tier badges for players whose tier rose to Storm
 *                                      or above (the Cron Trigger's task).
 *
 * Joules: each live player's amount is in the outcome and stored on their match row; finishRatedMatch credits it through
 * D2's hook (creditRatedMatchJoules, src/lib/pass/pass.server.ts) under the stored ratedJoulesKey, so it pays once
 * however often it is asked (also on a duplicate, so a retry finishes a credit that failed). D2's hook pays only an
 * account with the pass open (testers until PASS_FOR_EVERYONE) and applies the day's soft cap.
 *
 * Kept apart from ratings.server.ts so the ratings engine itself reaches no economy module (a Legendary badge pays
 * coins): ratings-check proves it.
 */

import type { Db } from "@/lib/data/db.server";
import type { RatedMatchOutcome, RatedMatchResult } from "@/lib/data/ratings";

import { ratedJoulesKey } from "./joules";
import { RATED_BADGES, recordRatedMatch, runStandingsJob, type StandingsJobResult } from "./ratings.server";
import { tierRank } from "./tiers";

/** Checks every badge rule for one player and answers the competitive badges newly awarded (never throws). */
export async function awardRatedBadges(client: Db, userId: string, nowMs: number = Date.now()): Promise<string[]> {
  try {
    const { evaluateBadges } = await import("@/lib/badges/badges.server");
    const { awarded } = await evaluateBadges(client, userId, nowMs);
    return awarded.filter((s) => RATED_BADGES.includes(s));
  } catch {
    return [];
  }
}

/**
 * Records a finished rated match, credits each live player's Joules through D2's hook, and awards the competitive
 * badges it earns (each player's `badges`). Joules are credited on a duplicate too (idempotent under the key).
 */
export async function finishRatedMatch(client: Db, result: unknown, nowMs: number = Date.now()): Promise<RatedMatchOutcome> {
  const outcome = await recordRatedMatch(client, result, nowMs);
  if (!outcome.ok) return outcome;
  const match = result as RatedMatchResult;
  const long = !(match.format.kind === "duel" && match.format.bestOf === 3);
  const atMs = match.finishedAt ? Math.min(Date.parse(match.finishedAt), nowMs) : nowMs;
  for (const p of outcome.players) {
    if (p.side !== "live" || p.joules <= 0) continue;
    await creditJoules(client, { userId: p.playerId, matchId: outcome.matchId, won: p.result === "win", long, atMs, key: ratedJoulesKey(outcome.matchId, p.playerId) });
  }
  if (outcome.status !== "recorded") return outcome;
  for (const p of outcome.players) {
    if (p.side !== "live") continue;
    p.badges = await awardRatedBadges(client, p.playerId, nowMs);
  }
  return outcome;
}

/** D2's hook, never failing the match (a failed credit is retried by the next finishRatedMatch for the same match). */
async function creditJoules(client: Db, input: { userId: string; matchId: string; won: boolean; long: boolean; atMs: number; key: string }): Promise<number> {
  try {
    const { creditRatedMatchJoules } = await import("@/lib/pass/pass.server");
    return await creditRatedMatchJoules(client, input);
  } catch (err) {
    console.warn(`[rated] joules for ${input.key}: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

/** The standings job, then the tier badges (Storm Chaser, Lightning Strikes, Top 500) for those who rose. */
export async function runStandingsAndBadges(client: Db, nowMs: number = Date.now()): Promise<StandingsJobResult> {
  const job = await runStandingsJob(client, nowMs);
  for (const c of job.changed) if (tierRank(c.to) >= tierRank("storm")) await awardRatedBadges(client, c.playerId, nowMs);
  return job;
}
