/**
 * The Season pass's server functions (wave 2, session D2; docs/economy/pass.md). A thin shell over pass.server.ts on the
 * service-role client, rate limited per user (PASS_LIMIT, fail closed). Every one refuses a guest, and an account that
 * isn't a shop tester while the pass is off for everyone (PASS_FOR_EVERYONE); test purchases are testers only, always.
 *
 *   getPassFn()                                   the pass for this account (Joules synced from stored results first)
 *   claimPassRewardFn({ data: { track, level } }) claims one reached reward (twice pays once)
 *   testPremiumFn()                               a tester's test purchase of the premium track (no payment)
 *   passLevelSeenFn({ data: { level } })          the level-up notice has been shown
 *   passJoulesSinceFn({ data: { sinceMs } })      the results screen's Joules line ({ joules } or null: no pass)
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { num, record, text } from "@/lib/validate";

/* Input checks (Security C2, 14 Nov 2026): type and size only; pass.server.ts judges each track, level and time. */
const WORD_MAX = 32;
import type { RateLimit } from "@/lib/duel/rateLimit.server";

import { PASS_MESSAGES, type PassActionResult, type PassClosed, type PassView } from "./types";

/** Pass calls per account. */
export const PASS_LIMIT: RateLimit = { bucket: "pass", max: 120, windowSeconds: 600, failClosed: true };

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, PASS_LIMIT);
  return { client, allowed, pass: await import("./pass.server") };
}

const BUSY: PassActionResult = { ok: false, reason: "busy", message: PASS_MESSAGES.busy };

export const getPassFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassView | PassClosed> => {
    const { client, allowed, pass } = await setup(context.userId);
    if (!allowed) return { open: false, reason: "busy" };
    return pass.passViewFor(client, context.userId, Date.now());
  });

export const claimPassRewardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { track: string; level: number }) => {
    const body = record(input);
    return { track: text(body["track"], WORD_MAX, "track"), level: num(body["level"], "level") };
  })
  .handler(async ({ data, context }): Promise<PassActionResult> => {
    const { client, allowed, pass } = await setup(context.userId);
    if (!allowed) return BUSY;
    return pass.claimReward(client, context.userId, { track: data?.track, level: data?.level }, Date.now());
  });

export const testPremiumFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassActionResult> => {
    const { client, allowed, pass } = await setup(context.userId);
    if (!allowed) return BUSY;
    return pass.testPurchase(client, context.userId, Date.now());
  });

export const passLevelSeenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { level: number }) => ({ level: num(record(input)["level"], "level") }))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { client, allowed, pass } = await setup(context.userId);
    if (!allowed) return { ok: false };
    return pass.markLevelSeen(client, context.userId, data?.level, Date.now());
  });

export const passJoulesSinceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sinceMs: number }) => ({ sinceMs: num(record(input)["sinceMs"], "sinceMs") }))
  .handler(async ({ data, context }): Promise<{ joules: number } | null> => {
    const { client, allowed, pass } = await setup(context.userId);
    if (!allowed) return null;
    return pass.joulesSince(client, context.userId, data?.sinceMs, Date.now());
  });
