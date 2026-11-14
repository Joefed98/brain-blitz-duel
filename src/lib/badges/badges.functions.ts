/**
 * Badges, titles and the Daily record: the server functions the screens call (wave 2, train C, session C2;
 * docs/badges/README.md). A thin shell over badges.server.ts and dailyStreak.server.ts on the service-role client.
 *
 *   syncMyBadges()                              settles the account rewards, checks the rules, answers MyBadges
 *   getMyBadges()                               MyBadges, nothing awarded
 *   setMyCardBadges({ data: { badges } })      up to three earned badges, in order
 *   setMyTitle({ data: { title } })            an unlocked title (null: Rookie)
 *   markBadgesSeen({ data: { badges } })       the badge-earned moments shown
 *   getCardBadges({ data: { playerIds } })     other players' card badges and titles
 *   getMyDailyRecord()                          the Daily streak, days and bests on the account (guests too)
 *
 * The phone can't award a badge, pay coins or choose a title it hasn't unlocked: every change is checked here and
 * again by the database.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listOf, nullable, optional, record, text } from "@/lib/validate";

/*
 * Input checks (Security C2, 14 Nov 2026; src/lib/validate.ts): type and size only. badges.server.ts still judges each
 * slug, title and id (too many card badges is "too_many", an unknown one "not_earned", an unknown id dropped).
 */
const WORD_MAX = 64;
const LIST_MAX = 200;

/** A list of badge slugs, each short text. */
function slugList(input: unknown): { badges: string[] } {
  return { badges: listOf(record(input)["badges"], LIST_MAX, (v, field) => text(v, WORD_MAX, field), "badges") };
}

import type { BadgeChangeResult, CardBadges, DailyAccountRecord, MyBadges } from "./types";

async function setup(userId: string, limit: "economy" | "card") {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { ECONOMY_LIMIT, PUBLIC_CARD_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, limit === "economy" ? ECONOMY_LIMIT : PUBLIC_CARD_LIMIT);
  return { client, allowed, badges: await import("./badges.server") };
}

/** Settles the rewards every account is owed, awards any badge earned, and answers the account's badges. */
export const syncMyBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBadges | { busy: true }> => {
    const { client, allowed, badges } = await setup(context.userId, "economy");
    if (!allowed) return { busy: true };
    return badges.syncBadges(client, context.userId);
  });

/** The account's badges, card and title (nothing awarded). */
export const getMyBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBadges | { busy: true }> => {
    const { client, allowed, badges } = await setup(context.userId, "economy");
    if (!allowed) return { busy: true };
    return badges.myBadges(client, context.userId);
  });

export const setMyCardBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { badges: string[] }) => slugList(input))
  .handler(async ({ data, context }): Promise<BadgeChangeResult> => {
    const { client, allowed, badges } = await setup(context.userId, "economy");
    if (!allowed) return badges.badgeRefusal("busy");
    return badges.setCardBadges(client, context.userId, data?.badges);
  });

export const setMyTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string | null }) => ({
    title: optional(record(input)["title"], (v) => nullable(v, (t) => text(t, WORD_MAX, "title"))),
  }))
  .handler(async ({ data, context }): Promise<BadgeChangeResult> => {
    const { client, allowed, badges } = await setup(context.userId, "economy");
    if (!allowed) return badges.badgeRefusal("busy");
    return badges.setTitle(client, context.userId, data?.title ?? null);
  });

export const markBadgesSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { badges: string[] }) => slugList(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { client, allowed, badges } = await setup(context.userId, "economy");
    if (!allowed) return { ok: false };
    return badges.markSeen(client, context.userId, data?.badges);
  });

export const getCardBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerIds: string[] }) => ({
    playerIds: listOf(record(input)["playerIds"], LIST_MAX, (v, field) => text(v, 64, field), "playerIds"),
  }))
  .handler(async ({ data, context }): Promise<CardBadges[] | { busy: true }> => {
    const { client, allowed, badges } = await setup(context.userId, "card");
    if (!allowed) return { busy: true };
    return badges.cardBadgesFor(client, data?.playerIds);
  });

/** The Daily streak, days and best totals worked out on the server (the same on every device). */
export const getMyDailyRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyAccountRecord | { busy: true }> => {
    const { client, allowed } = await setup(context.userId, "economy");
    if (!allowed) return { busy: true };
    const { dailyRecordFor } = await import("@/lib/duel/dailyStreak.server");
    return dailyRecordFor(client, context.userId);
  });
