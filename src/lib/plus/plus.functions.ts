/**
 * Joulz Plus's server functions (wave 2, session E2; docs/economy/plus.md). Every one refuses a guest, and refuses
 * anyone off the shop's tester list until PLUS_FOR_EVERYONE is on (src/config/plusConfig.ts); a test purchase is
 * testers only either way. The phone's side is src/lib/plus/plusApi.ts.
 *
 *   plusStatusFn()                              the account's Plus (its due monthly perks granted first)
 *   plusTestPurchaseFn({ plan })                a tester's test purchase (monthly | yearly), no payment
 *   plusSetMarkFn({ on })                       the gold PLUS chip on the profile, off by default
 *   dailyArchiveFn()                            the Daily archive's days (members)
 *   dailyArchiveStartFn({ kind, day, name })    replay a past Daily, unrated (members)
 *   earlyAccessFn()                             the games held back from this caller in Practice today
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/data/db.server";

async function db(): Promise<Db> {
  const { adminDb } = await import("@/lib/data/db.server");
  return adminDb();
}

export const plusStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { plusStatus } = await import("./plus.server");
    return plusStatus(await db(), context.userId, Date.now());
  });

export const plusTestPurchaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const { PLUS_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, PLUS_LIMIT))) {
      const { plusRefusal } = await import("./plus.server");
      return plusRefusal("error");
    }
    const { testPurchase } = await import("./plus.server");
    return testPurchase(client, context.userId, data?.plan, Date.now());
  });

export const plusSetMarkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { on: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { setPlusMark } = await import("./plus.server");
    return setPlusMark(await db(), context.userId, data?.on === true);
  });

export const dailyArchiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { archiveDays } = await import("./archive.server");
    return archiveDays(await db(), context.userId, Date.now());
  });

export const dailyArchiveStartFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; day: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const { DAILY_START_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, DAILY_START_LIMIT)))
      return { ok: false as const, message: "That’s a lot of tries. Give it a few minutes." };
    // An archive replay is an account's: the board name is the username (never shown on any board).
    const { accountNameOf } = await import("@/lib/names/playerName.server");
    const name = (await accountNameOf(client, context.userId)) ?? "Player";
    const { startArchive } = await import("./archive.server");
    return startArchive(client, { userId: context.userId, kind: data?.kind, day: data?.day, name }, Date.now());
  });

/** No session needed (Practice asks on every visit): the caller from the bearer token when there is one. */
export const earlyAccessFn = createServerFn({ method: "POST" }).handler(async (): Promise<{ held: string[] }> => {
  try {
    const client = await db();
    const { earlyAccessGames, heldGamesFor } = await import("./access.server");
    if (!(await earlyAccessGames(client, Date.now())).length) return { held: [] };
    const { callerUserId } = await import("@/lib/duel/betaRecord.server");
    return { held: await heldGamesFor(client, await callerUserId(client), Date.now()) };
  } catch {
    return { held: [] };
  }
});
