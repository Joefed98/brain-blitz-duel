/**
 * recordClientEventsFn (9 Nov 2026; docs/analytics.md): the phone's own analytics moments (app opened, a share tap,
 * an invite link opened, an error screen shown, a game played offline), in small batches. Only those five events are
 * accepted (clientEvents.server.ts); the server records everything else itself and refuses it from here, scores
 * included. Rate limited per device (ANALYTICS_CLIENT_LIMIT). Never part of play: the phone sends it in the
 * background (clientEvents.ts) and nothing on screen waits for it.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { record, sized } from "@/lib/validate";

/** A batch is at most 20 small events (clientEvents.server.ts); 64 KB is far above any the phone sends. */
const CLIENT_BATCH_BYTES = 64 * 1024;
/** A list this long is refused here; 21 to 200 still get acceptClientBatch's own "bad_batch". */
const CLIENT_BATCH_ITEMS = 200;

export const recordClientEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Size only (Security C2): acceptClientBatch answers a batch that isn't a list of at most 20 ("bad_batch") and
  // refuses each bad event itself, so only an oversized value is refused here.
  .inputValidator((input: { events: unknown }) => ({ events: sized(record(input)["events"], CLIENT_BATCH_BYTES, "events", { maxItems: CLIENT_BATCH_ITEMS }) }))
  .handler(async ({ data, context }) => {
    const nowMs = Date.now();
    const { acceptClientBatch } = await import("./clientEvents.server");
    const batch = acceptClientBatch(data?.events, nowMs);
    if (!batch) return { ok: false as const, accepted: 0, rejected: 0, reason: "bad_batch" as const };
    // Skipped where there is no database (local dev servers in checks).
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"])
      return { ok: true as const, accepted: 0, rejected: batch.rejected };
    const { adminDb } = await import("@/lib/data/db.server");
    const { ANALYTICS_CLIENT_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(await adminDb(), context.userId, ANALYTICS_CLIENT_LIMIT)))
      return { ok: false as const, accepted: 0, rejected: batch.accepted.length + batch.rejected, reason: "rate_limited" as const };
    if (batch.accepted.length) {
      const { recordEvents } = await import("@/lib/data/events.server");
      recordEvents(
        batch.accepted.map((e) => ({
          event: e.event,
          occurredAt: e.occurredAt,
          playerId: context.userId,
          game: e.game,
          mode: e.event === "offline_game_played" ? ("practice" as const) : null,
          props: e.props,
        })),
      );
    }
    return { ok: true as const, accepted: batch.accepted.length, rejected: batch.rejected };
  });
