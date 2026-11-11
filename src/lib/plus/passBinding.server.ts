/**
 * The premium pass for Plus members (wave 2 E2) goes through D2's pass function, the ONE way the premium track is
 * given: `grantPremiumTrack` (src/lib/pass/pass.server.ts) for the season this account sees now, with source 'plus'
 * and the key `plus_pass:<membership>:<season>` (D2's pass_grant_premium answers 'already' once given). No season
 * shown to the account (the pass closed to it, or between seasons): nothing given, asked again next time.
 *
 * Server only. Never read by scoring, grading, replay, matchmaking or timing code. Checks can stand in for D2 with
 * `bindPremiumPass`.
 */
import type { Db } from "@/lib/data/db.server";

export type PassGrantStatus = "granted" | "already" | "unavailable";

export interface PremiumPassBinding {
  /** Gives the current season's premium pass to an account because of its Plus membership (idempotent in D2). */
  grantPremiumPass(client: Db, input: { userId: string; membershipId: string }): Promise<PassGrantStatus>;
}

/** D2's function: the premium track for the season the account sees now. */
export const D2_PREMIUM_PASS: PremiumPassBinding = {
  grantPremiumPass: async (client, { userId, membershipId }) => {
    const pass = await import("@/lib/pass/pass.server");
    const access = await pass.passAccess(client, userId);
    const season = await pass.activeSeason(client, userId, access, Date.now());
    if (!season) return "unavailable";
    const status = await pass.grantPremiumTrack(client, {
      userId,
      seasonId: season.row.id,
      source: "plus",
      key: `plus_pass:${membershipId}:${season.row.id}`,
    });
    return status === "granted" ? "granted" : status === "already" ? "already" : "unavailable";
  },
};

let binding: PremiumPassBinding = D2_PREMIUM_PASS;

/** Checks only: stands in for D2's function (null: D2's own). */
export function bindPremiumPass(next: PremiumPassBinding | null): void {
  binding = next ?? D2_PREMIUM_PASS;
}

export function premiumPassBinding(): PremiumPassBinding {
  return binding;
}
