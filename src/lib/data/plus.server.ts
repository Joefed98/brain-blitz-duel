/**
 * Joulz Plus's data (wave 2, session E2; docs/economy/plus.md; supabase/migrations/20261113200000_joulz_plus.sql):
 * memberships, the perk grants' record, the PLUS chip, early-access marks and the public cosmetics read. Server only;
 * each function issues exactly one call. Coins and streak freezes are paid through A1's ledgers
 * (src/lib/economy/economy.server.ts creditCoins / grantConsumable), never here.
 */

import { asJson, type Db } from "./db.server";
import type { Result } from "./rooms.server";

export type PlusPlan = "monthly" | "yearly";

export interface MembershipRow {
  id: string;
  plan: PlusPlan;
  test: boolean;
  started_at: string;
  show_mark: boolean;
}

export interface TestPurchaseOutcome {
  status: "started" | "already_member" | "not_tester" | "no_account" | "bad_plan";
  membership?: MembershipRow | null;
}

export interface PublicCosmeticsRow {
  user_id: string;
  avatar_id: string;
  colour: number | null;
  gem: string | null;
  finish: string | null;
  accessory: string | null;
  special: string | null;
  celebration: string | null;
  entrance: string | null;
  reactions: string[];
  plus_mark: boolean;
}

function membershipOf(raw: unknown): MembershipRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["id"] !== "string" || (r["plan"] !== "monthly" && r["plan"] !== "yearly") || typeof r["started_at"] !== "string")
    return null;
  return { id: r["id"], plan: r["plan"], test: r["test"] !== false, started_at: r["started_at"], show_mark: r["show_mark"] === true };
}

/** An account's open membership (null: none, a guest, an account waiting for deletion). */
export async function readMembership(client: Db, userId: string): Promise<Result<MembershipRow | null>> {
  const { data, error } = await client.rpc("plus_membership", { p_user_id: userId });
  return { data: membershipOf(data), error };
}

/** A tester's test purchase (no payment, marked as a test). */
export async function testPurchaseRpc(client: Db, userId: string, plan: string): Promise<Result<TestPurchaseOutcome | null>> {
  const { data, error } = await client.rpc("plus_test_purchase", { p_user_id: userId, p_plan: plan });
  if (!data || typeof data !== "object") return { data: null, error };
  const r = data as Record<string, unknown>;
  return { data: { status: r["status"] as TestPurchaseOutcome["status"], membership: membershipOf(r["membership"]) }, error };
}

/** Records a membership month's perk as granted; true only the first time. */
export async function noteGrant(
  client: Db,
  input: { membershipId: string; month: number; perk: "coins" | "freezes" | "premium_pass"; detail?: Record<string, unknown> },
): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("plus_note_grant", {
    p_membership_id: input.membershipId,
    p_month: input.month,
    p_perk: input.perk,
    p_detail: asJson(input.detail ?? {}),
  });
  return { data: data === true, error };
}

/** The months already noted for each perk of a membership. */
export async function readGrantedMonths(client: Db, membershipId: string): Promise<Result<{ month: number; perk: string }[]>> {
  const { data, error } = await client.rpc("plus_granted_months", { p_membership_id: membershipId });
  const rows = Array.isArray(data) ? (data as unknown[]) : [];
  return {
    data: rows.flatMap((r) => {
      const o = r as Record<string, unknown>;
      return typeof o["month"] === "number" && typeof o["perk"] === "string" ? [{ month: o["month"], perk: o["perk"] }] : [];
    }),
    error,
  };
}

/** The PLUS chip on or off (members only). */
export async function setMarkRpc(client: Db, userId: string, on: boolean): Promise<Result<"set" | "not_member" | null>> {
  const { data, error } = await client.rpc("plus_set_mark", { p_user_id: userId, p_on: on });
  return { data: data === "set" || data === "not_member" ? data : null, error };
}

/** Games still held back for members on a UK day (YYYY-MM-DD). */
export async function readEarlyAccess(client: Db, day: string): Promise<Result<{ game: string; until: string }[]>> {
  const { data, error } = await client.rpc("plus_early_access", { p_day: day });
  const rows = Array.isArray(data) ? (data as unknown[]) : [];
  return {
    data: rows.flatMap((r) => {
      const o = r as Record<string, unknown>;
      return typeof o["game"] === "string" && typeof o["until"] === "string" ? [{ game: o["game"], until: o["until"] }] : [];
    }),
    error,
  };
}

const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** What everyone may see of these players' equipped cosmetics (guests: no row). */
export async function readPublicCosmetics(client: Db, userIds: readonly string[]): Promise<Result<PublicCosmeticsRow[]>> {
  const { data, error } = await client.rpc("cosmetics_public", { p_user_ids: [...userIds].slice(0, 100) });
  const rows = Array.isArray(data) ? (data as unknown[]) : [];
  return {
    data: rows.flatMap((r) => {
      const o = r as Record<string, unknown>;
      if (typeof o["user_id"] !== "string") return [];
      return [
        {
          user_id: o["user_id"],
          avatar_id: strOrNull(o["avatar_id"]) ?? "captain-joulz",
          colour: typeof o["colour"] === "number" ? o["colour"] : null,
          gem: strOrNull(o["gem"]),
          finish: strOrNull(o["finish"]),
          accessory: strOrNull(o["accessory"]),
          special: strOrNull(o["special"]),
          celebration: strOrNull(o["celebration"]),
          entrance: strOrNull(o["entrance"]),
          reactions: Array.isArray(o["reactions"]) ? (o["reactions"] as unknown[]).filter((x): x is string => typeof x === "string") : [],
          plus_mark: o["plus_mark"] === true,
        },
      ];
    }),
    error,
  };
}
