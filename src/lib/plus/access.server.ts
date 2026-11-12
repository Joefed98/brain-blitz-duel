/**
 * Who Joulz Plus is open to, who is a member, and which games early access holds back (wave 2 E2). Kept apart from
 * plus.server.ts (which pays the monthly perks through the coin and consumable ledgers) so the practice deal can ask
 * about early access without reaching the economy (economy-neutral-check, plus-check).
 */
import { PLUS_FOR_EVERYONE } from "@/config/plusConfig";
import type { Db } from "@/lib/data/db.server";
import { readEarlyAccess, readMembership, type MembershipRow } from "@/lib/data/plus.server";
import { readProfile } from "@/lib/data/profiles.server";
import { readIsTester } from "@/lib/data/shop.server";
import { ukDayKey } from "@/lib/duel/daily";

/** Whether Plus is open to this account at all: the switch, or the tester list. Guests never. */
export async function plusOpenFor(client: Db, userId: string): Promise<{ open: boolean; tester: boolean; account: boolean }> {
  const { data: profile } = await readProfile(client, userId);
  if (!profile) return { open: false, tester: false, account: false };
  const { data: tester } = await readIsTester(client, userId);
  return { open: PLUS_FOR_EVERYONE || tester, tester, account: true };
}

/** The account's open membership when Plus is open to it, else null. */
export async function memberFor(client: Db, userId: string): Promise<MembershipRow | null> {
  const open = await plusOpenFor(client, userId);
  if (!open.open) return null;
  const { data } = await readMembership(client, userId);
  return data;
}

/* The marks change rarely (Joe's plus.mark_early_access): read at most once a minute per server. */
const CACHE_MS = 60_000;
let cached: { day: string; at: number; games: string[] } | null = null;

/** The games marked early access and not yet open to everyone on today's UK day. */
export async function earlyAccessGames(client: Db, nowMs: number): Promise<string[]> {
  const day = ukDayKey(nowMs);
  if (cached && cached.day === day && nowMs - cached.at < CACHE_MS) return cached.games;
  const { data, error } = await readEarlyAccess(client, day);
  // A failed read holds nothing back (and isn't asked again for a minute).
  cached = { day, at: nowMs, games: error ? (cached?.games ?? []) : data.map((e) => e.game) };
  return cached.games;
}

/** Checks only: forgets the cached marks. */
export function forgetEarlyAccessCache(): void {
  cached = null;
}

/** The marked games held back from this caller today (all of them for a guest or a non-member; none for a member). */
export async function heldGamesFor(client: Db, userId: string | null, nowMs: number): Promise<string[]> {
  const games = await earlyAccessGames(client, nowMs);
  if (!games.length) return [];
  if (userId && (await memberFor(client, userId))) return [];
  return games;
}

/** Whether one game is held back from this caller in Practice today. */
export async function heldBackFor(client: Db, game: string, userId: string | null, nowMs: number): Promise<boolean> {
  return (await heldGamesFor(client, userId, nowMs)).includes(game);
}
