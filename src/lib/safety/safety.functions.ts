/**
 * The phone's safety calls (safety, 10 Nov 2026; docs/moderation.md): its notices on open, a warning seen, the new
 * name after a forced rename. Reports are filed through chat.functions.ts (reportMessageFn, reportPlayerFn).
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { record, text } from "@/lib/validate";

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { SAFETY_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  return { client, allowed: await withinRateLimit(client, userId, SAFETY_LIMIT), safety: await import("./safety.server") };
}

const BUSY = { ok: false as const, message: "That’s a lot of tries. Give it a few minutes." };

/** This player's notices: a ban, a warning to show once, a forced rename. */
export const safetyStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, safety } = await setup(context.userId);
    if (!allowed) return BUSY;
    return safety.safetyNotices(client, context.userId);
  });

/** The player has seen their warning (it isn't shown again). */
export const ackWarningFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, safety } = await setup(context.userId);
    if (!allowed) return BUSY;
    return safety.ackWarning(client, context.userId);
  });

/** The player's new name after a forced rename (an account's username, or a guest's room name). */
export const pickForcedNameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Type and size only (Security C2); pickForcedName judges the name itself.
  .inputValidator((input: { name: string }) => ({ name: text(record(input)["name"], 64, "name") }))
  .handler(async ({ data, context }) => {
    const { client, allowed, safety } = await setup(context.userId);
    if (!allowed) return BUSY;
    return safety.pickForcedName(client, context.userId, data?.name);
  });
