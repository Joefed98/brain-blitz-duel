/**
 * recordRatedEventFn (wave 3, session W3c): the rated screens' five analytics events (play_card_tapped, vs_shown,
 * result_viewed, next_match_tapped, tier_ladder_viewed). Accepts only those, with fixed-word props
 * (acceptRatedEvent in ratedEvents.ts), rate limited per user (RATED_EVENT_LIMIT, fail closed), recorded through
 * recordEvents in src/lib/data/events.server.ts (fire-and-forget). The phone calls it in the background.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordRatedEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input)
  .handler(async ({ data, context }) => {
    const { acceptRatedEvent } = await import("./ratedEvents");
    const accepted = acceptRatedEvent(data);
    if (!accepted) return { ok: false as const, reason: "refused" as const };
    const { adminDb } = await import("@/lib/data/db.server");
    const { RATED_EVENT_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(await adminDb(), context.userId, RATED_EVENT_LIMIT)))
      return { ok: false as const, reason: "rate_limited" as const };
    const { recordEvents } = await import("@/lib/data/events.server");
    recordEvents({ event: accepted.event, playerId: context.userId, props: accepted.props });
    return { ok: true as const };
  });
