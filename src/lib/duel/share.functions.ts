/**
 * The share loop's beta recording (share_events, supabase/migrations/20261021120000): a Share tap on
 * the final screen, an arrival from a shared link, its welcome card and its first finished room. Outcome
 * only, best-effort and never part of play: until the migration is applied every write fails
 * quietly (betaRecord.server.ts) and the phone carries on.
 */
import { compact, nullable, num, record, text } from "@/lib/validate";
import { CODE_MAX, ID_MAX, NUMBER_MAX, SHORT_MAX } from "./inputLimits";
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
  .inputValidator((input: ShareEventInput): ShareEventInput => {
    const b = record(input);
    const word = (k: string) => nullable(b[k], (x) => text(x, SHORT_MAX, k));
    const count = (k: string) => nullable(b[k], (x) => num(x, -NUMBER_MAX, NUMBER_MAX, k));
    return compact({
      event: text(b["event"], SHORT_MAX, "event") as ShareEventInput["event"],
      duelId: nullable(b["duelId"], (x) => text(x, ID_MAX, "duelId")),
      gameIndex: count("gameIndex"),
      roomCode: nullable(b["roomCode"], (x) => text(x, CODE_MAX, "roomCode")),
      place: count("place"),
      players: count("players"),
      rounds: count("rounds"),
      method: word("method") as ShareEventInput["method"],
      landing: word("landing") as ShareEventInput["landing"],
      welcome: word("welcome") as ShareEventInput["welcome"],
      source: word("source") as ShareEventInput["source"],
      challengeCode: nullable(b["challengeCode"], (x) => text(x, CODE_MAX, "challengeCode")),
      dailyKind: word("dailyKind") as ShareEventInput["dailyKind"],
    }) as ShareEventInput;
  })
  .handler(async ({ data, context }) => {
    // Skipped where there is no database (local dev servers in checks).
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return { ok: true };
    const { recordShareEvent, shareEventRow } = await import("./betaRecord.server");
    const row = shareEventRow(context.userId, data as unknown as Record<string, unknown>);
    if (!row) return { ok: false };
    const supabaseAdmin = await (await import("@/lib/data/db.server")).adminDb();
    // Beta events are rate limited per player (SHARE_EVENT_LIMIT in rateLimit.server.ts).
    const { BETA_EVENT_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(supabaseAdmin, context.userId, BETA_EVENT_LIMIT))) return { ok: false };
    await recordShareEvent(supabaseAdmin, row);
    return { ok: true };
  });
