/**
 * recordIdentityEventFn (wave 2, session A2): the identity screens' three analytics events (profile_viewed,
 * customise_opened, equip_refused). Accepts only those, with fixed-word props (acceptIdentityEvent in
 * identityEvents.ts), rate limited per user (IDENTITY_EVENT_LIMIT, fail closed), recorded through recordEvents
 * (fire-and-forget). The phone calls it in the background; nothing on screen waits for it.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordIdentityEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: string; who?: string; slot?: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { acceptIdentityEvent } = await import("./identityEvents");
    const accepted = acceptIdentityEvent(data);
    if (!accepted) return { ok: false as const, reason: "refused" as const };
    const { adminDb } = await import("@/lib/data/db.server");
    const { IDENTITY_EVENT_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(await adminDb(), context.userId, IDENTITY_EVENT_LIMIT)))
      return { ok: false as const, reason: "rate_limited" as const };
    const { recordEvents } = await import("@/lib/data/events.server");
    recordEvents({ event: accepted.event, playerId: context.userId, props: accepted.props });
    return { ok: true as const };
  });
