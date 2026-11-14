/**
 * Phone notifications' server functions (wave 2 train B, session B2; docs/push-notifications.md): a thin shell over
 * push.server.ts, each behind requireSupabaseAuth and a per-user rate limit (PUSH_LIMIT, fail closed), on the
 * service-role client with the caller's own user id (so a caller only ever touches their own rows). Accounts only.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bool, optional, record, recordOf, text } from "@/lib/validate";

/*
 * Input checks (Security C2, 14 Nov 2026; src/lib/validate.ts): type and size only. push.server.ts still judges the
 * push service, the keys, the time zone and the event words (a bad one is "bad_subscription" or ok: false).
 */
const ENDPOINT_MAX = 2048;
const KEY_MAX = 256;
const ZONE_MAX = 64;
const WORD_MAX = 64;

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
  .inputValidator((input: { endpoint: string; keys: { p256dh: string; auth: string }; timeZone?: string }) => {
    const body = record(input);
    const keys = record(body["keys"], "keys");
    return {
      endpoint: text(body["endpoint"], ENDPOINT_MAX, "endpoint"),
      keys: { p256dh: text(keys["p256dh"], KEY_MAX, "keys.p256dh"), auth: text(keys["auth"], KEY_MAX, "keys.auth") },
      timeZone: optional(body["timeZone"], (v) => text(v, ZONE_MAX, "timeZone")),
    };
  })
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.saveSubscription(client, context.userId, data ?? {}, await userAgent(), Date.now());
  });

/** Removes this device's subscription (sign-out, or notifications turned off on this phone). */
export const removePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => ({ endpoint: text(record(input)["endpoint"], ENDPOINT_MAX, "endpoint") }))
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
  // The keys stay as sent: writeSettings keeps the ones it knows and ignores the rest.
  .inputValidator((input: Record<string, boolean>) => recordOf(input, 32, 64, (v, field) => bool(v, field)))
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.writeSettings(client, context.userId, data, Date.now());
  });

/** The ask's answer (accepted / declined) and the moment it was asked at. */
export const notePushAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { answer: string; moment?: string }) => {
    const body = record(input);
    return {
      answer: text(body["answer"], WORD_MAX, "answer"),
      moment: optional(body["moment"], (v) => text(v, WORD_MAX, "moment")),
    };
  })
  .handler(async ({ data, context }) => {
    const { client, allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.noteAskAnswer(client, context.userId, data?.answer, data?.moment, Date.now());
  });

/** A notification was tapped (notification_opened). */
export const notePushOpenedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: string }) => ({ event: text(record(input)["event"], WORD_MAX, "event") }))
  .handler(async ({ data, context }) => {
    const { allowed, push } = await setup(context.userId);
    if (!allowed) return BUSY;
    return push.noteOpened(context.userId, data?.event);
  });
