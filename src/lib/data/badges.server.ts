/**
 * Badges, titles and the Daily streak's data (wave 2, train C, session C2; docs/badges/README.md;
 * supabase/migrations/20261111120000_badges_titles.sql). Server only; each function issues exactly one call. Every
 * write is one of the database's own functions (public.badge_* and public.daily_streak_freeze): no table here is
 * writable by any API role, the service role included.
 */

import type { Db, Json, Tables } from "./db.server";
import type { CoinOutcome } from "./economy.server";
import type { Result } from "./rooms.server";

export type BadgeRow = Tables<"badges">;
export type TitleRow = Tables<"titles">;
export type PlayerBadgeRow = Tables<"player_badges">;

/** public.badge_award's answer. */
export interface BadgeAwardOutcome {
  status: "awarded" | "owned" | "no_account" | "unknown_badge" | "not_earnable";
  /** The Legendary's coin line (economy.post_coins' answer: ok | duplicate | …), else null. */
  coins: (Omit<CoinOutcome, "status"> & { status: "ok" | CoinOutcome["status"] }) | null;
}
export type SetCardStatus = "set" | "no_account" | "too_many" | "duplicate" | "not_earned";
export type SetTitleStatus = "set" | "unchanged" | "no_account" | "unknown_title" | "not_earned";

export interface BadgePublicCardRow {
  user_id: string;
  badges: string[];
  title: string | null;
  founding_number: number | null;
}

export interface DailyHistoryRow {
  /** The UK day, YYYY-MM-DD. */
  day: string;
  kind: string;
  finished: boolean;
  total: number;
}

export interface StreakFreezeOutcome {
  status: "used" | "duplicate" | "insufficient" | "no_account" | "open_day" | "bad_kind" | "bad_reason";
  count?: number;
}

/* ------------------------------------------------------------------ reads */

export async function readBadgeRows(client: Db): Promise<Result<BadgeRow[]>> {
  const { data, error } = await client.from("badges").select("*").order("sort_order");
  return { data: data ?? [], error };
}

export async function readTitleRows(client: Db): Promise<Result<TitleRow[]>> {
  const { data, error } = await client.from("titles").select("*").order("sort_order");
  return { data: data ?? [], error };
}

export async function readPlayerBadges(client: Db, userId: string): Promise<Result<PlayerBadgeRow[]>> {
  const { data, error } = await client.from("player_badges").select("*").eq("user_id", userId);
  return { data: data ?? [], error };
}

export async function readBadgePublicCards(client: Db, userIds: readonly string[]): Promise<Result<BadgePublicCardRow[]>> {
  const { data, error } = await client.rpc("badge_public_cards", { p_user_ids: [...userIds].slice(0, 100) });
  return { data: (data as BadgePublicCardRow[] | null) ?? [], error };
}

/** The player's Daily starts (public.daily_history), latest first. */
export async function readDailyHistory(client: Db, userId: string): Promise<Result<DailyHistoryRow[]>> {
  const { data, error } = await client.rpc("daily_history", { p_user_id: userId });
  return { data: (data as DailyHistoryRow[] | null) ?? [], error };
}

/** The UK days a streak freeze covered for this player. */
export async function readStreakFreezeDays(client: Db, userId: string): Promise<Result<string[]>> {
  const { data, error } = await client.from("daily_streak_freezes").select("day").eq("user_id", userId);
  return { data: (data ?? []).map((r) => r.day), error };
}

/* ------------------------------------------------------------------ writes (the database's own functions) */

export async function badgeAwardRpc(
  client: Db,
  input: { userId: string; badge: string; detail: Record<string, string | number | boolean> },
): Promise<Result<BadgeAwardOutcome | null>> {
  const { data, error } = await client.rpc("badge_award", {
    p_user_id: input.userId,
    p_badge: input.badge,
    p_detail: input.detail as Json,
  });
  return { data: (data as unknown as BadgeAwardOutcome | null) ?? null, error };
}

export async function setCardBadgesRpc(client: Db, userId: string, badges: readonly string[]): Promise<Result<SetCardStatus | null>> {
  const { data, error } = await client.rpc("badge_set_card", { p_user_id: userId, p_badges: [...badges] });
  return { data: (data as SetCardStatus | null) ?? null, error };
}

export async function setTitleRpc(client: Db, userId: string, title: string | null): Promise<Result<SetTitleStatus | null>> {
  const { data, error } = await client.rpc("badge_set_title", { p_user_id: userId, p_title: title });
  return { data: (data as SetTitleStatus | null) ?? null, error };
}

export async function markBadgesSeenRpc(client: Db, userId: string, badges: readonly string[]): Promise<Result<number | null>> {
  const { data, error } = await client.rpc("badge_mark_seen", { p_user_id: userId, p_badges: [...badges] });
  return { data: (data as number | null) ?? null, error };
}

/** Uses one streak freeze for a missed (closed) UK day, once per day. */
export async function useStreakFreezeRpc(client: Db, userId: string, day: string): Promise<Result<StreakFreezeOutcome | null>> {
  const { data, error } = await client.rpc("daily_streak_freeze", { p_user_id: userId, p_day: day });
  return { data: (data as unknown as StreakFreezeOutcome | null) ?? null, error };
}
