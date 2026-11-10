/**
 * recordSaveProgressFn (10 Nov 2026, the sign-up screens): the save-your-progress prompt's three analytics events
 * (save_progress_shown, save_progress_tapped, save_progress_dismissed). Accepts only those three, with fixed-word
 * props (acceptSaveProgressEvent in saveProgress.ts: no personal data, no free text), rate limited per user through
 * takeRateLimit (SAVE_PROGRESS_LIMIT, fail closed), recorded through recordEvents (fire-and-forget). The phone calls
 * it in the background; nothing on screen waits for it.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordSaveProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: string; prompt: string; from?: string; method?: string }) => input)
  .handler(async ({ data, context }) => {
    const { acceptSaveProgressEvent } = await import("./saveProgress");
    const accepted = acceptSaveProgressEvent(data);
    if (!accepted) return { ok: false as const, reason: "refused" as const };
    const { adminDb } = await import("@/lib/data/db.server");
    const { SAVE_PROGRESS_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(await adminDb(), context.userId, SAVE_PROGRESS_LIMIT)))
      return { ok: false as const, reason: "rate_limited" as const };
    const { recordEvents } = await import("@/lib/data/events.server");
    recordEvents({ event: accepted.event, playerId: context.userId, props: accepted.props });
    return { ok: true as const };
  });
