/**
 * recordClientEventsFn (9 Nov 2026; docs/analytics.md): the phone's own analytics moments (app opened, a share tap,
 * an invite link opened, an error screen shown, a game played offline), in small batches. Only those five events are
 * accepted (clientEvents.server.ts); the server records everything else itself and refuses it from here, scores
 * included. Rate limited per device (ANALYTICS_CLIENT_LIMIT). Never part of play: the phone sends it in the
 * background (clientEvents.ts) and nothing on screen waits for it.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordClientEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { events: unknown }) => input)
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
