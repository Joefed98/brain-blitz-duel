/**
 * Phone notifications' server functions (wave 2 train B, session B2; docs/push-notifications.md): a thin shell over
 * push.server.ts, each behind requireSupabaseAuth and a per-user rate limit (PUSH_LIMIT, fail closed), on the
 * service-role client with the caller's own user id (so a caller only ever touches their own rows). Accounts only.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUSY = { ok: false as const, reason: "busy" as const };

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { PUSH_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, PUSH_LIMIT);
  return { client, allowed, push: await import("./push.server") };
}

async function userAgent(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return getRequest()?.headers?.get("user-agent") ?? null;
  } catch {
    return null;
  }
}

/** Saves this device's push subscription (PushSubscription.toJSON() and the device's time zone). */
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; keys: { p256dh: string; auth: string }; timeZone?: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.saveSubscription(client, context.userId, data ?? {}, await userAgent(), Date.now());
  });

/** Removes this device's subscription (sign-out, or notifications turned off on this phone). */
export const removePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.removeSubscription(client, context.userId, data?.endpoint);
  });

/** The player's switches and whether the phone may ask. */
export const pushSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.readSettings(client, context.userId, Date.now());
  });

/** Changes the player's switches (the master switch and any of the six). */
export const setPushSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, boolean>) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.writeSettings(client, context.userId, data, Date.now());
  });

/** The ask's answer (accepted / declined) and the moment it was asked at. */
export const notePushAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { answer: string; moment?: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.noteAskAnswer(client, context.userId, data?.answer, data?.moment, Date.now());
  });

/** A notification was tapped (notification_opened). */
export const notePushOpenedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: string }) => input)
  .handler(async ({ data, context }) => {
    const { allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.noteOpened(context.userId, data?.event);
  });
