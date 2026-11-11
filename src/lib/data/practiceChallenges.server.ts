/**
 * Practice challenges' data (wave 2 C1b; supabase/migrations/20261111130000_practice_challenges.sql): each player's
 * progress row per challenge and the two service-role functions that write it. Server only; each function issues
 * exactly one call. No API role may write the table: every write is public.challenge_record or challenge_pay_due.
 */

import type { Db, Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type ChallengeProgressRow = Tables<"practice_challenge_progress">;

/** What public.challenge_record answers. */
export interface ChallengeRecordOutcome {
  status: "ok" | "bad";
  newly?: boolean;
  completed?: boolean;
  best?: number;
}

/** One reward public.challenge_pay_due paid. */
export interface ChallengePaid {
  challenge_id: string;
  game_id: string;
  coins: number;
  line_id: number;
}

/** What public.challenge_pay_due answers. */
export interface ChallengePayOutcome {
  status: "ok" | "no_account";
  paid: ChallengePaid[];
}

/** Records one graded run's value for one challenge (the best is kept; completed once `met`). */
export async function recordChallengeRun(
  client: Db,
  input: { userId: string; challengeId: string; gameId: string; value: number; met: boolean; coins: number },
): Promise<Result<ChallengeRecordOutcome | null>> {
  const { data, error } = await client.rpc("challenge_record", {
    p_user_id: input.userId,
    p_challenge_id: input.challengeId,
    p_game_id: input.gameId,
    p_value: Math.max(0, Math.floor(input.value)),
    p_met: input.met,
    p_coins: input.coins,
  });
  return { data: (data as unknown as ChallengeRecordOutcome | null) ?? null, error };
}

/** Pays every completed, unpaid challenge's coins on an account, once each (a guest: nothing yet). */
export async function payDueChallenges(client: Db, userId: string): Promise<Result<ChallengePayOutcome | null>> {
  const { data, error } = await client.rpc("challenge_pay_due", { p_user_id: userId });
  return { data: (data as unknown as ChallengePayOutcome | null) ?? null, error };
}

/** One player's progress rows (every challenge they have a value for). */
export async function readChallengeProgress(client: Db, userId: string): Promise<Result<ChallengeProgressRow[]>> {
  const { data, error } = await client
    .from("practice_challenge_progress")
    .select("user_id, challenge_id, game_id, best, completed_at, coins, paid_at, ledger_id, updated_at")
    .eq("user_id", userId);
  return { data: data ?? [], error };
}
