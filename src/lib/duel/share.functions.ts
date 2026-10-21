/**
 * The share loop's beta recording (share_events, supabase/migrations/20261021120000): a Share tap on
 * the final screen, an arrival from a shared link, its welcome card and its first finished room. Outcome
 * only, best-effort and never part of play: until the migration is applied every write fails
 * quietly (betaRecord.server.ts) and the phone carries on.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ShareEventInput {
  event: "share_tap" | "arrival" | "arrival_finished" | "arrival_welcome";
  duelId?: string | null;
  gameIndex?: number | null;
  roomCode?: string | null;
  place?: number | null;
  players?: number | null;
  rounds?: number | null;
  method?: "native" | "copy" | null;
  landing?: "home" | "room" | null;
  welcome?: "shown" | "dismissed" | "practice" | "public" | null;
  /** What was shared or where the arrival's link came from (22 Oct 2026); a room's when absent. */
  source?: "room" | "daily" | "challenge" | null;
  challengeCode?: string | null;
  dailyKind?: "puzzle" | "arcade" | null;
}

export const recordShareEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ShareEventInput) => input)
  .handler(async ({ data, context }) => {
    // Skipped where there is no database (local dev servers in checks).
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return { ok: true };
    const { recordShareEvent, shareEventRow } = await import("./betaRecord.server");
    const row = shareEventRow(context.userId, data as unknown as Record<string, unknown>);
    if (!row) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await recordShareEvent(supabaseAdmin, row);
    return { ok: true };
  });
