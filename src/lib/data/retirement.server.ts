/**
 * The database's mirror of the retired games (supabase/migrations/20261117300000_retired_games.sql): RETIRED_TYPES
 * (src/lib/duel/catalogue.ts, the one switch) and the live star total (STAR_TOTAL_MAX), which the star total, the gems
 * and the badge facts read in SQL. Written through public.game_retirement_sync, once per server process before the first
 * counting call and only when it differs, so removing a game from RETIRED_TYPES restores it on the next server call.
 * Best effort: a failed sync leaves the mirror as it was (it is seeded by the migration) and is tried again next call.
 */
import { RETIRED_TYPES } from "@/lib/duel/catalogue";
import { STAR_TOTAL_MAX } from "@/lib/practice/progressRules";

import type { Db } from "./db.server";

let synced: Promise<boolean> | null = null;

/** The list and total the mirror should hold (sorted, as the database stores it). */
export function retirementMirror(): { retired: string[]; starTotal: number } {
  return { retired: [...RETIRED_TYPES].sort(), starTotal: STAR_TOTAL_MAX };
}

/** Brings the mirror in line with RETIRED_TYPES (once per process; a failure is retried on the next call). */
export function syncRetirement(client: Db): Promise<boolean> {
  if (!synced) {
    const { retired, starTotal } = retirementMirror();
    synced = (async () => {
      const { error } = await client.rpc("game_retirement_sync", { p_retired: retired, p_star_total: starTotal });
      if (error) {
        console.warn(`[retirement] mirror not synced: ${error.message}`);
        synced = null;
        return false;
      }
      return true;
    })();
  }
  return synced;
}
