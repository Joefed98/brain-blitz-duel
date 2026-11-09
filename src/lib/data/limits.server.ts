/**
 * Rate-limit counters (`take_rate_limit`, over `rate_limit_hits`). Server only (architecture audit B2).
 */

import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

/** Counts one call in a bucket; false when the caller is over the limit (the database decides atomically). */
export async function takeRateLimit(
  client: Db,
  key: string,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<Result<boolean | null>> {
  const { data, error } = await client.rpc("take_rate_limit", {
    p_user_id: key,
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  return { data, error };
}
