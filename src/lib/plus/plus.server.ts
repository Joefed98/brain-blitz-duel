/**
 * Joulz Plus on the server (wave 2, session E2; docs/economy/plus.md). Test purchases until real payments exist.
 *
 * - Who sees Plus: everyone once PLUS_FOR_EVERYONE is on (src/config/plusConfig.ts); until then only the shop's testers
 *   (D1's one list, shop.testers). Every Plus function refuses anyone else (`not_tester`).
 * - A test purchase starts Plus (monthly or yearly) with no payment, marked as a test; Joe ends it with
 *   plus.remove_test_purchase. Recorded as plus_bought (props.plan, props.test).
 * - The perks of each membership month, granted the first time the server is asked in that month (and any months
 *   missed before it): 200 coins (reason plus_monthly, key plus_monthly:<membership>:<month>), 2 streak freezes (key
 *   plus_freezes:<membership>:<month>; a test membership's carry reason plus_test_monthly instead) and the current
 *   season's premium pass through D2's function
 *   (passBinding.server.ts). The ledgers' keys make each month pay once whatever races; plus_perk_granted is recorded
 *   only for a line the ledger actually wrote.
 * - The PLUS chip (off by default), the Daily archive (archive.server.ts) and early access (a game marked in
 *   early_access_games is playable in Practice only by members until its day ends).
 *
 * Never in Plus: anything that affects scores, ratings or matchmaking. Nothing here is read by scoring, grading,
 * replay, matchmaking or timing code (plus-check proves the import graph).
 */
import { PLUS_MONTHLY_COINS, PLUS_MONTHLY_FREEZES } from "@/config/plusConfig";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  noteGrant,
  readEarlyAccess,
  readGrantedMonths,
  readMembership,
  setMarkRpc,
  testPurchaseRpc,
  type MembershipRow,
  type PlusPlan,
} from "@/lib/data/plus.server";
import { ukDayKey } from "@/lib/duel/daily";

import { plusOpenFor } from "./access.server";
import { monthsBegun } from "./months";
import { premiumPassBinding } from "./passBinding.server";

export interface PlusMembershipView {
  plan: PlusPlan;
  test: boolean;
  startedAt: string;
  showMark: boolean;
}

export interface PlusStatus {
  /** Plus shows for this account (everyone once switched on; testers until then). */
  open: boolean;
  /** On the tester list: may make a test purchase. */
  tester: boolean;
  member: PlusMembershipView | null;
  /** Months whose coins and freezes have been paid (0 = the first). */
  monthsPaid: number;
  /** Whether the premium pass reached D2 for the current month (false until D2's function is bound). */
  premiumPass: boolean;
  /** Games still held back for members today. */
  earlyAccess: { game: string; until: string }[];
}

export type PlusRefusal = "guest" | "not_tester" | "not_member" | "bad_plan" | "already_member" | "error";

export const PLUS_MESSAGES: Record<PlusRefusal, string> = {
  guest: "Joulz Plus needs an account.",
  not_tester: "Joulz Plus isn’t open yet.",
  not_member: "That’s part of Joulz Plus.",
  bad_plan: "Pick monthly or yearly.",
  already_member: "You already have Joulz Plus.",
  error: "Something went wrong. Try again in a moment.",
};

export function plusRefusal(reason: PlusRefusal): { ok: false; reason: PlusRefusal; message: string } {
  return { ok: false, reason, message: PLUS_MESSAGES[reason] };
}

function view(m: MembershipRow): PlusMembershipView {
  return { plan: m.plan, test: m.test, startedAt: m.started_at, showMark: m.show_mark };
}

/**
 * Grants every membership month's perks not yet granted, up to now. Idempotent: each line has its own ledger key, and
 * the perk record is written after the ledger answers, so a retry finishes a half-done month without paying twice.
 */
export async function grantDuePerks(
  client: Db,
  userId: string,
  membership: MembershipRow,
  nowMs: number,
): Promise<{ monthsPaid: number; premiumPass: boolean }> {
  const { creditCoins, grantConsumable } = await import("@/lib/economy/economy.server");
  // Month 0 has begun whenever the membership exists (the database's clock may run a moment ahead of this server's).
  const startMs = Date.parse(membership.started_at);
  const months = monthsBegun(startMs, Math.max(nowMs, startMs));
  const { data: noted } = await readGrantedMonths(client, membership.id);
  const done = new Set(noted.map((g) => `${g.perk}:${g.month}`));
  let premiumPass = done.has(`premium_pass:${months.at(-1) ?? 0}`);
  // A test membership's rewards are marked as such (plus_test_monthly), so Joe can take them all back before launch.
  const reason = membership.test ? "plus_test_monthly" : "plus_monthly";
  for (const month of months) {
    const ref = { kind: "plus", id: membership.id };
    if (!done.has(`coins:${month}`)) {
      const paid = await creditCoins(client, {
        userId,
        amount: PLUS_MONTHLY_COINS,
        reason,
        ref,
        key: `plus_monthly:${membership.id}:${month}`,
      });
      if (paid.status === "credited" || paid.status === "duplicate") {
        await noteGrant(client, { membershipId: membership.id, month, perk: "coins", detail: { amount: PLUS_MONTHLY_COINS } });
        // The ledger's line is the truth: the event goes with the call that wrote it, never a racing duplicate.
        if (paid.status === "credited")
          recordEvents({ event: "plus_perk_granted", playerId: userId, props: { perk: "coins", month, amount: PLUS_MONTHLY_COINS, test: membership.test } });
      }
    }
    if (!done.has(`freezes:${month}`)) {
      const given = await grantConsumable(client, {
        userId,
        kind: "streak_freeze",
        amount: PLUS_MONTHLY_FREEZES,
        reason,
        ref,
        key: `plus_freezes:${membership.id}:${month}`,
      });
      if (given.status === "granted" || given.status === "duplicate") {
        await noteGrant(client, { membershipId: membership.id, month, perk: "freezes", detail: { count: PLUS_MONTHLY_FREEZES } });
        if (given.status === "granted")
          recordEvents({ event: "plus_perk_granted", playerId: userId, props: { perk: "freezes", month, amount: PLUS_MONTHLY_FREEZES, test: membership.test } });
      }
    }
  }
  // The premium pass: the current season's, once, through D2 (its own function decides the season).
  const current = months.at(-1);
  if (current !== undefined && !premiumPass) {
    const answer = await premiumPassBinding().grantPremiumPass(client, { userId, membershipId: membership.id });
    if (answer === "granted" || answer === "already") {
      await noteGrant(client, { membershipId: membership.id, month: current, perk: "premium_pass" });
      premiumPass = true;
    }
  }
  return { monthsPaid: months.length, premiumPass };
}

/** The account's Plus status, its due perks granted first. */
export async function plusStatus(client: Db, userId: string, nowMs: number): Promise<PlusStatus> {
  const base = await plusOpenFor(client, userId);
  const empty: PlusStatus = { open: base.open, tester: base.tester, member: null, monthsPaid: 0, premiumPass: false, earlyAccess: [] };
  if (!base.open) return empty;
  const { data: membership } = await readMembership(client, userId);
  const { data: early } = await readEarlyAccess(client, ukDayKey(nowMs));
  if (!membership) return { ...empty, earlyAccess: early };
  const paid = await grantDuePerks(client, userId, membership, nowMs);
  return { ...empty, member: view(membership), earlyAccess: early, ...paid };
}

/** A tester's test purchase: Plus with no payment, marked as a test; the first month's perks at once. */
export async function testPurchase(
  client: Db,
  userId: string,
  plan: unknown,
  nowMs: number,
): Promise<{ ok: true; status: PlusStatus } | ReturnType<typeof plusRefusal>> {
  if (plan !== "monthly" && plan !== "yearly") return plusRefusal("bad_plan");
  const open = await plusOpenFor(client, userId);
  if (!open.account) return plusRefusal("guest");
  // A test purchase is for testers only, even once Plus is open to everyone (no payment is taken).
  if (!open.tester) return plusRefusal("not_tester");
  const { data, error } = await testPurchaseRpc(client, userId, plan);
  if (error || !data) return plusRefusal("error");
  if (data.status === "not_tester") return plusRefusal("not_tester");
  if (data.status === "no_account") return plusRefusal("guest");
  if (data.status === "bad_plan") return plusRefusal("bad_plan");
  if (data.status === "already_member") return plusRefusal("already_member");
  recordEvents({ event: "plus_bought", playerId: userId, props: { plan, test: true } });
  return { ok: true, status: await plusStatus(client, userId, nowMs) };
}

/** The PLUS chip on or off (members only; off by default). */
export async function setPlusMark(
  client: Db,
  userId: string,
  on: unknown,
): Promise<{ ok: true } | ReturnType<typeof plusRefusal>> {
  const open = await plusOpenFor(client, userId);
  if (!open.account) return plusRefusal("guest");
  if (!open.open) return plusRefusal("not_tester");
  const { data, error } = await setMarkRpc(client, userId, on === true);
  if (error || !data) return plusRefusal("error");
  return data === "set" ? { ok: true } : plusRefusal("not_member");
}

export { heldBackFor, heldGamesFor, memberFor, plusOpenFor } from "./access.server";
