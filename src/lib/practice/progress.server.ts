/**
 * Practice progress on the server (wave 2 train C, C1a; docs/practice-progress.md): a player's stars, bests and gems
 * from the stored progress rows, what a counted run did, and its analytics events. Server only; every database call
 * goes through src/lib/data/practiceProgress.server.ts and src/lib/data/economy.server.ts.
 */
import { readGemUnlocks } from "@/lib/data/economy.server";
import type { Db } from "@/lib/data/db.server";
import {
  readFreshStartAt,
  readPracticeProgress,
  readRefreshNoteDue,
  type PracticeRecordOutcome,
} from "@/lib/data/practiceProgress.server";

import type { PracticeProgressView, PracticeRunProgress } from "./progress";
import { levelOf, starCounts, STAR_LEVELS, type PracticeLevel } from "./progressRules";

/** A player's whole progress, read from the server's rows. */
export async function progressFor(client: Db, userId: string): Promise<PracticeProgressView> {
  const [rows, gems, seen, start] = await Promise.all([
    readPracticeProgress(client, userId),
    readGemUnlocks(client, userId),
    readRefreshNoteDue(client, userId),
    readFreshStartAt(client),
  ]);
  if (rows.error) throw new Error("Couldn’t load your practice progress.");
  const games: PracticeProgressView["games"] = {};
  let stars = 0;
  for (const r of rows.data) {
    const level: PracticeLevel = levelOf(r.level);
    const star = r.star_at !== null && STAR_LEVELS.includes(level);
    // A retired game's stars stay stored but count for nothing (progressRules.ts starCounts).
    if (star && starCounts(r.game_id, level)) stars += 1;
    (games[r.game_id] ??= {})[level] = { best: r.best_score, star, starScore: star ? r.star_score : null };
  }
  return {
    games,
    stars,
    gems: gems.error ? [] : gems.data,
    // Nothing to show unless the note is due (a player from before the fresh start who hasn't seen it).
    noteSeen: seen.error ? true : !seen.data,
    freshStartAt: start.data,
  };
}

/** What the phone is told about one counted run. */
export function runProgressOf(outcome: PracticeRecordOutcome): PracticeRunProgress {
  return {
    counted: outcome.counted === true,
    level: levelOf(outcome.level),
    best: typeof outcome.best === "number" ? outcome.best : null,
    previousBest: typeof outcome.previous_best === "number" ? outcome.previous_best : null,
    improved: outcome.improved === true,
    star: outcome.star === true,
    starEarned: outcome.star_earned === true,
    starTotal: typeof outcome.star_total === "number" ? outcome.star_total : 0,
    gemsUnlocked: Array.isArray(outcome.gems_unlocked) ? outcome.gems_unlocked.filter((g) => typeof g === "string") : [],
  };
}

/** star_earned, best_set and gem_unlocked for one counted run (fire-and-forget, never throws). */
export async function recordProgressEvents(outcome: PracticeRecordOutcome, userId: string): Promise<void> {
  if (!outcome.counted || !outcome.game) return;
  try {
    const { recordEvents } = await import("@/lib/data/events.server");
    type AnalyticsEvent = import("@/lib/data/events.server").AnalyticsEvent;
    const level = levelOf(outcome.level);
    const game = outcome.game;
    const events: AnalyticsEvent[] = [];
    // No mode: these describe the account's progress, not a round (a practice round is game_started / game_finished).
    const base = { playerId: userId, game };
    if (outcome.best_set) events.push({ event: "best_set", ...base, score: outcome.best ?? null, props: { level } });
    if (outcome.star_earned) events.push({ event: "star_earned", ...base, props: { level } });
    for (const gem of outcome.gems_unlocked ?? []) events.push({ event: "gem_unlocked", playerId: userId, props: { gem } });
    if (events.length) recordEvents(events);
  } catch {
    /* analytics never fails a practice grade */
  }
}
