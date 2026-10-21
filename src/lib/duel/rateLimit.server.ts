/**
 * Per-user rate limits for the room and chat server functions (pre-beta
 * security audit, docs/security-audit-oct-2026.md). Counters live in
 * public.rate_limit_hits through public.take_rate_limit (migration
 * 20261016120000_rate_limits.sql), which only the service role can call.
 *
 * Fails open: if the migration is not applied yet or the database errors, the
 * call is allowed and a warning logged, so a missing table never blocks play.
 * Never used on a game, answer or scoring path.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RateLimit {
  bucket: string;
  max: number;
  windowSeconds: number;
}

/** Creating rooms: 20 an hour per user. */
export const CREATE_ROOM_LIMIT: RateLimit = { bucket: "create-room", max: 20, windowSeconds: 3600 };
/** Room-code lookups (link preview and join, shared): 60 per 10 minutes, so codes can't be brute-forced. */
export const ROOM_LOOKUP_LIMIT: RateLimit = { bucket: "room-lookup", max: 60, windowSeconds: 600 };
/** Starting a daily (21 Oct 2026): 30 per 10 minutes, far above two dailies' worth of retries. */
export const DAILY_START_LIMIT: RateLimit = { bucket: "daily-start", max: 30, windowSeconds: 600 };
/** Chat reports: 20 per 10 minutes. */
export const REPORT_LIMIT: RateLimit = { bucket: "report", max: 20, windowSeconds: 600 };

/** True when the caller is still within the limit (this call counted). */
export async function withinRateLimit(client: any, userId: string, limit: RateLimit): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("take_rate_limit", {
      p_user_id: userId,
      p_bucket: limit.bucket,
      p_max: limit.max,
      p_window_seconds: limit.windowSeconds,
    });
    if (error) {
      console.warn(`[rate-limit] ${limit.bucket}: ${error.message} (allowed)`);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.warn(`[rate-limit] ${limit.bucket}: ${err instanceof Error ? err.message : String(err)} (allowed)`);
    return true;
  }
}
