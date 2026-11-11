/**
 * The practice challenges' server side (wave 2 C1b; docs/challenges/catalogue.md). The one checker is
 * `evaluateChallenge` (src/lib/duel/practiceChallenges.ts), called here on the server's own graded result of a
 * Practice run (online, or an offline run once it is synced and graded), never on anything the phone says. Rooms, the
 * Daily and friend challenges never count.
 *
 * Each challenge's best value and its completion are kept in public.practice_challenge_progress (one row per player and
 * challenge, written only by the service-role functions). Coins (100 or 250) are paid through A1's ledger, reason
 * challenge_reward, once per challenge per account; a guest's completions are kept and paid the first time
 * `payPendingChallengeRewards` runs once that guest is an account (sign-up, the next graded run, or opening the list).
 *
 * Analytics: challenge_completed (game, props.challenge, props.level, props.coins), and coins_credited for each payment.
 * Never fails a grade: every database error is logged and the run's grade returns as it was.
 */
import { recordEvents } from "@/lib/data/events.server";
import type { Db } from "@/lib/data/db.server";
import { payDueChallenges, readChallengeProgress, recordChallengeRun, type ChallengePaid } from "@/lib/data/practiceChallenges.server";
import { challengeById, challengesFor, evaluateChallenge, type ChallengeLevel, type GradedRun } from "@/lib/duel/practiceChallenges";

/** A challenge a run completed, as the phone shows it (the moment and the list). */
export interface ChallengeCompletion {
  id: string;
  /** Coins this completion pays (0: none). */
  coins: number;
  /** Whether those coins were paid now (false for a guest: paid on becoming an account). */
  paid: boolean;
}

/** One challenge's state for the lists (Practice and Profile). */
export interface ChallengeProgressView {
  id: string;
  best: number;
  done: boolean;
  /** When it was completed (ISO), once done. */
  doneAt: string | null;
  coins: number;
  paid: boolean;
}

function warn(message: string): void {
  console.warn(`[challenges] ${message}`);
}

/**
 * Checks one server-graded Practice run against its game's challenges and records the result: the best value of
 * every challenge the run moved, the ones it completed, and their coins for an account. Returns the completions.
 */
export async function checkPracticeChallenges(
  client: Db,
  userId: string,
  type: string,
  graded: { score: number; isCorrect: boolean; reactionAvgMs: number | null; extra: Record<string, unknown> | null },
  level: ChallengeLevel | null = null,
): Promise<ChallengeCompletion[]> {
  const run: GradedRun = { score: graded.score, isCorrect: graded.isCorrect, reactionAvgMs: graded.reactionAvgMs, extra: graded.extra, level };
  const newly: { id: string; level: ChallengeLevel; coins: number }[] = [];
  for (const c of challengesFor(type)) {
    const { met, value } = evaluateChallenge(c, run);
    // Nothing to keep: a run that moved no bar and completed nothing writes nothing.
    if (!met && value <= 0) continue;
    const { data, error } = await recordChallengeRun(client, { userId, challengeId: c.id, gameId: c.type, value, met, coins: c.coins });
    if (error || !data || data.status !== "ok") {
      warn(`not recorded: ${c.id}: ${error?.message ?? data?.status ?? "no answer"}`);
      continue;
    }
    if (data.newly) newly.push({ id: c.id, level: c.level, coins: c.coins });
  }
  if (!newly.length) return [];
  const paid = newly.some((n) => n.coins > 0) ? await payPendingChallengeRewards(client, userId) : [];
  const paidNow = new Set(paid.map((p) => p.challenge_id));
  for (const n of newly)
    recordEvents({
      event: "challenge_completed",
      playerId: userId,
      game: type,
      mode: "practice",
      props: { challenge: n.id, level: n.level, coins: paidNow.has(n.id) ? n.coins : 0 },
    });
  return newly.map((n) => ({ id: n.id, coins: n.coins, paid: paidNow.has(n.id) }));
}

/** Pays every completed, unpaid challenge's coins on an account (a guest: nothing yet); records coins_credited. */
export async function payPendingChallengeRewards(client: Db, userId: string): Promise<ChallengePaid[]> {
  const { data, error } = await payDueChallenges(client, userId);
  if (error || !data) {
    warn(`not paid: ${error?.message ?? "no answer"}`);
    return [];
  }
  const paid = Array.isArray(data.paid) ? data.paid : [];
  for (const p of paid) recordEvents({ event: "coins_credited", playerId: userId, props: { reason: "challenge_reward", amount: p.coins } });
  return paid;
}

/** One player's challenge progress for the lists (any rewards due paid first). */
export async function myChallengeProgress(client: Db, userId: string): Promise<ChallengeProgressView[]> {
  await payPendingChallengeRewards(client, userId);
  const { data, error } = await readChallengeProgress(client, userId);
  if (error) {
    warn(`not read: ${error.message}`);
    return [];
  }
  return data
    .filter((row) => challengeById(row.challenge_id))
    .map((row) => ({
      id: row.challenge_id,
      best: row.best,
      done: row.completed_at !== null,
      doneAt: row.completed_at,
      coins: row.coins,
      paid: row.paid_at !== null,
    }));
}
