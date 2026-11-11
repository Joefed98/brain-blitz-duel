/**
 * What a rated match earns beyond its ratings (wave 3, session W3a; docs/rated/ratings-interface.md). Server only.
 *
 *   finishRatedMatch(client, result)   recordRatedMatch, then the competitive badges each player's record now earns
 *                                      (through C2's badge_award, so each is awarded once). The match engine (W3b)
 *                                      calls this one.
 *   runStandingsAndBadges(client)      the standings job, then the tier badges for players whose tier rose to Storm
 *                                      or above (the Cron Trigger's task).
 *
 * Joules: each live player's amount is in the outcome and stored on their match row; D2's pass credits it under
 * ratedJoulesKey (src/lib/rated/joules.ts). D2 has no code on main yet, so nothing is credited here.
 *
 * Kept apart from ratings.server.ts so the ratings engine itself reaches no economy module (a Legendary badge pays
 * coins): ratings-check proves it.
 */

import type { Db } from "@/lib/data/db.server";
import type { RatedMatchOutcome } from "@/lib/data/ratings";

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

/** Records a finished rated match and awards the competitive badges it earns (each player's `badges`). */
export async function finishRatedMatch(client: Db, result: unknown, nowMs: number = Date.now()): Promise<RatedMatchOutcome> {
  const outcome = await recordRatedMatch(client, result, nowMs);
  if (!outcome.ok || outcome.status !== "recorded") return outcome;
  for (const p of outcome.players) {
    if (p.side !== "live") continue;
    p.badges = await awardRatedBadges(client, p.playerId, nowMs);
  }
  return outcome;
}

/** The standings job, then the tier badges (Storm Chaser, Lightning Strikes, Top 500) for those who rose. */
export async function runStandingsAndBadges(client: Db, nowMs: number = Date.now()): Promise<StandingsJobResult> {
  const job = await runStandingsJob(client, nowMs);
  for (const c of job.changed) if (tierRank(c.to) >= tierRank("storm")) await awardRatedBadges(client, c.playerId, nowMs);
  return job;
}
