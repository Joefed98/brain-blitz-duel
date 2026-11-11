/**
 * Badges, titles and the account rewards: the server's rules (wave 2, train C, session C2; docs/badges/README.md).
 * Server only. The phone reaches them through badges.functions.ts; nothing here takes a badge, a coin or a title from
 * the phone without checking it against what is stored.
 *
 * - settleAccountRewards: the sign-up reward (1,000 coins, reason signup_reward, key signup_reward:<user id>, through
 *   creditCoins) and, for a Founding Player, the badge with their number (its 250 coins, key badge_reward:
 *   founding-player) and the Founding frame. Idempotent: the keys (and the badge's primary key) pay once, also after the
 *   migration's backfill, which uses the same keys.
 * - syncBadges: settles, checks every earnable badge's rule (rules.server.ts) against the stored facts (factsFor:
 *   public.badge_facts, the Daily record, the profile), awards what is earned and answers progress on counted badges.
 * - setCardBadges / setTitle: only earned badges and unlocked titles (the database refuses the rest too).
 *
 * Events (src/lib/data/events.server.ts): badge_earned (badge, rarity), title_equipped (title), and A1's
 * coins_credited / item_granted through its helpers.
 *
 * Nothing here is read by scoring, grading, replay, matchmaking or timing (economy-neutral-check).
 */

import {
  badgeAwardRpc,
  markBadgesSeenRpc,
  readBadgePublicCards,
  readBadgeFacts,
  readPlayerBadges,
  setCardBadgesRpc,
  setTitleRpc,
  type BadgeAwardOutcome,
} from "@/lib/data/badges.server";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import { readProfile } from "@/lib/data/profiles.server";
import { ACTIVE_PUZZLE_TYPES, ARCADE_CATEGORY, PUZZLE_TYPES, puzzleInfo, typeTimeLimitMs } from "@/lib/duel/catalogue";
import { longestDailyStreak } from "@/lib/duel/dailyStreak";
import { dailyRecordFor } from "@/lib/duel/dailyStreak.server";
import { creditCoins, grantItem } from "@/lib/economy/economy.server";

import { readPassTitles } from "@/lib/data/pass.server";
import { readSeasonTitles } from "@/lib/data/seasons.server";
import { BADGE_BY_SLUG, CARD_BADGE_SLOTS, STARTER_TITLE, TITLE_BY_ID } from "./catalogue";
import { badgeProgress, badgesEarnedBy, type BadgeFacts } from "./rules.server";
import type { BadgeChangeResult, BadgeRefusal, CardBadges, EarnedBadge, MyBadges } from "./types";

export const SIGNUP_REWARD_COINS = 1000;
const ACTIVE_GAMES: ReadonlySet<string> = new Set(ACTIVE_PUZZLE_TYPES);
export const FOUNDING_FRAME = "frame.founding";

export const signupRewardKey = (userId: string) => `signup_reward:${userId}`;

const MESSAGES: Record<BadgeRefusal, string> = {
  guest: "Make an account to earn badges and titles.",
  too_many: "Your card shows up to 3 badges.",
  duplicate: "That badge is already on your card.",
  not_earned: "You haven’t earned that yet.",
  unknown_title: "That title doesn’t exist.",
  busy: "That’s a lot of changes. Give it a few minutes.",
  error: "Something went wrong. Try again.",
};

export function badgeRefusal(reason: BadgeRefusal): { ok: false; reason: BadgeRefusal; message: string } {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/** Awards one earnable badge once; records badge_earned and, for a Legendary's 250, coins_credited. */
export async function awardBadge(
  client: Db,
  userId: string,
  slug: string,
  detail: Record<string, string | number | boolean> = {},
): Promise<BadgeAwardOutcome["status"]> {
  const { data, error } = await badgeAwardRpc(client, { userId, badge: slug, detail });
  if (error || !data) throw new Error(`badges: ${error?.message ?? "no answer"}`);
  const def = BADGE_BY_SLUG.get(slug);
  if (data.status === "awarded") recordEvents({ event: "badge_earned", playerId: userId, props: { badge: slug, rarity: def?.rarity ?? null } });
  if (data.coins?.status === "ok")
    recordEvents({ event: "coins_credited", playerId: userId, props: { reason: "badge_reward", amount: data.coins.amount ?? null } });
  return data.status;
}

export interface SettleOutcome {
  account: boolean;
  /** creditCoins' status for the sign-up reward (credited the first time, then duplicate). */
  signup: string | null;
  founding: boolean;
}

/** The rewards every account is owed: the sign-up reward, and a Founding Player's badge, coins and frame. */
export async function settleAccountRewards(client: Db, userId: string): Promise<SettleOutcome> {
  const { data: profile, error } = await readProfile(client, userId);
  if (error) throw new Error(`badges: ${error.message}`);
  if (!profile) return { account: false, signup: null, founding: false };
  const paid = await creditCoins(client, {
    userId,
    amount: SIGNUP_REWARD_COINS,
    reason: "signup_reward",
    ref: { kind: "account", id: userId },
    key: signupRewardKey(userId),
  });
  if (profile.founding) {
    await awardBadge(client, userId, "founding-player", { number: profile.player_number });
    await grantItem(client, { userId, itemId: FOUNDING_FRAME, how: "earned" });
  }
  return { account: true, signup: paid.status, founding: profile.founding };
}

/** Every puzzle (non-arcade) type's clock in ms, for badge_facts (Buzzer Beater, Speed Demon). */
let puzzleLimitsCache: Record<string, number> | null = null;
export function puzzleLimits(): Record<string, number> {
  if (puzzleLimitsCache) return puzzleLimitsCache;
  const out: Record<string, number> = {};
  for (const type of PUZZLE_TYPES) if (puzzleInfo(type).category !== ARCADE_CATEGORY) out[type] = typeTimeLimitMs(type);
  return (puzzleLimitsCache = out);
}

/** The facts the rules read, from what is stored (null for a guest). */
export async function factsFor(client: Db, userId: string, nowMs: number = Date.now()): Promise<BadgeFacts | null> {
  const { data: profile, error } = await readProfile(client, userId);
  if (error) throw new Error(`badges: ${error.message}`);
  if (!profile) return null;
  const [{ data: stored, error: fErr }, daily] = await Promise.all([
    readBadgeFacts(client, { userId, puzzleLimits: puzzleLimits() }),
    dailyRecordFor(client, userId, nowMs),
  ]);
  if (fErr || !stored) throw new Error(`badges: ${fErr?.message ?? "no facts"}`);
  return {
    founding: profile.founding,
    playerNumber: profile.player_number,
    games200: Number(stored.games200) || 0,
    buzzerFinishes: Number(stored.buzzer) || 0,
    fastFinishes: Number(stored.speedDemon) || 0,
    bestDailyStreak: longestDailyStreak(daily.days, daily.frozenDays),
    dailyStreak: daily.streak,
    hostedRooms: Number(stored.hosted3) || 0,
    challengesDone: Number(stored.challenges) || 0,
    stars: Number(stored.stars) || 0,
    starredGames: (Array.isArray(stored.starGames) ? stored.starGames : []).filter((g) => ACTIVE_GAMES.has(g)).length,
    gems: Number(stored.gems) || 0,
  };
}

/** Checks every earnable badge's rule and awards those earned (idempotent). Answers the slugs newly awarded and the progress. */
export async function evaluateBadges(
  client: Db,
  userId: string,
  nowMs: number = Date.now(),
): Promise<{ awarded: string[]; progress: Record<string, number> }> {
  const facts = await factsFor(client, userId, nowMs);
  if (!facts) return { awarded: [], progress: {} };
  const awarded: string[] = [];
  for (const { slug, detail } of badgesEarnedBy(facts)) {
    if ((await awardBadge(client, userId, slug, detail)) === "awarded") awarded.push(slug);
  }
  return { awarded, progress: badgeProgress(facts) };
}

/** The account's badges, card and title (a guest: account false). */
export async function myBadges(client: Db, userId: string, progress: Record<string, number> = {}): Promise<MyBadges> {
  const [{ data: profile, error: pErr }, { data: rows, error: bErr }, { data: cards, error: cErr }, { data: passTitles, error: tErr }, { data: seasonTitles, error: sErr }] = await Promise.all([
    readProfile(client, userId),
    readPlayerBadges(client, userId),
    readBadgePublicCards(client, [userId]),
    readPassTitles(client, userId),
    readSeasonTitles(client, userId),
  ]);
  if (pErr || bErr || cErr || tErr || sErr) throw new Error(`badges: ${(pErr ?? bErr ?? cErr ?? tErr ?? sErr)!.message}`);
  if (!profile) return { account: false };
  const earned: EarnedBadge[] = rows
    .filter((r) => BADGE_BY_SLUG.has(r.badge))
    .map((r) => {
      const n = (r.detail as Record<string, unknown> | null)?.["number"];
      return { slug: r.badge, earnedAt: r.earned_at, number: typeof n === "number" ? n : null, seen: r.seen_at !== null };
    })
    .sort((a, b) => (a.earnedAt < b.earnedAt ? -1 : a.earnedAt > b.earnedAt ? 1 : a.slug < b.slug ? -1 : 1));
  const card = cards[0];
  return {
    account: true,
    earned,
    card: card?.badges ?? [],
    title: card?.title && TITLE_BY_ID.has(card.title) ? card.title : STARTER_TITLE,
    unseen: earned.filter((b) => !b.seen).map((b) => b.slug),
    progress,
    passTitles,
    seasonTitles,
  };
}

/** Settles the rewards, checks the rules, and answers the account's badges (what the phone calls on a tab page). */
export async function syncBadges(client: Db, userId: string): Promise<MyBadges> {
  const settled = await settleAccountRewards(client, userId);
  if (!settled.account) return { account: false };
  const { progress } = await evaluateBadges(client, userId);
  return myBadges(client, userId, progress);
}

/** Puts up to three earned badges on the card, in order. */
export async function setCardBadges(client: Db, userId: string, input: unknown): Promise<BadgeChangeResult> {
  if (!Array.isArray(input) || !input.every((s) => typeof s === "string")) return badgeRefusal("not_earned");
  const list = input as string[];
  if (list.length > CARD_BADGE_SLOTS) return badgeRefusal("too_many");
  const { data, error } = await setCardBadgesRpc(client, userId, list);
  if (error || !data) return badgeRefusal("error");
  if (data === "no_account") return badgeRefusal("guest");
  if (data !== "set") return badgeRefusal(data);
  return { ok: true, badges: await myBadges(client, userId) };
}

/** Equips one unlocked title (null or "rookie": Rookie). Records title_equipped. */
export async function setTitle(client: Db, userId: string, input: unknown): Promise<BadgeChangeResult> {
  if (input !== null && typeof input !== "string") return badgeRefusal("unknown_title");
  const { data, error } = await setTitleRpc(client, userId, input);
  if (error || !data) return badgeRefusal("error");
  if (data === "no_account") return badgeRefusal("guest");
  if (data === "unknown_title" || data === "not_earned") return badgeRefusal(data);
  if (data === "set") recordEvents({ event: "title_equipped", playerId: userId, props: { title: input ?? STARTER_TITLE } });
  return { ok: true, badges: await myBadges(client, userId) };
}

/** Marks badges' moments as shown. */
export async function markSeen(client: Db, userId: string, input: unknown): Promise<{ ok: boolean }> {
  if (!Array.isArray(input) || !input.every((s) => typeof s === "string")) return { ok: false };
  const { error } = await markBadgesSeenRpc(client, userId, (input as string[]).slice(0, 60));
  return { ok: !error };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Other players' card badges and titles (guests and unknown ids: none, Rookie left off). */
export async function cardBadgesFor(client: Db, playerIds: unknown): Promise<CardBadges[]> {
  if (!Array.isArray(playerIds)) return [];
  const ids = playerIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)).slice(0, 100);
  if (!ids.length) return [];
  const { data, error } = await readBadgePublicCards(client, ids);
  if (error) throw new Error(`card badges: ${error.message}`);
  return data.map((r) => ({
    playerId: r.user_id,
    badges: r.badges.filter((b) => BADGE_BY_SLUG.has(b)),
    title: r.title && TITLE_BY_ID.has(r.title) ? r.title : STARTER_TITLE,
    foundingNumber: r.founding_number,
  }));
}
