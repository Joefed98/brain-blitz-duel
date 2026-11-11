/**
 * The premium pass for Plus members (wave 2 E2) goes through D2's pass function, the ONE way the premium track is
 * given. D2 (the Season 1 pass) wasn't in this tree when Plus was built, so this binding is the one place to wire it:
 * `grantPremiumPass` answers "unavailable" until D2's function is bound here, and Plus records the premium pass as
 * granted for a membership month only once D2 says it was given ("granted" or "already"). The database also offers D2
 * `public.plus_is_member(user)`, so the premium track can count a member as a holder without any grant at all.
 *
 * Server only. Never read by scoring, grading, replay, matchmaking or timing code.
 */
import type { Db } from "@/lib/data/db.server";

export type PassGrantStatus = "granted" | "already" | "unavailable";

export interface PremiumPassBinding {
  /** Gives the current season's premium pass to an account because of its Plus membership (idempotent in D2). */
  grantPremiumPass(client: Db, input: { userId: string; membershipId: string }): Promise<PassGrantStatus>;
}

const NOT_BOUND: PremiumPassBinding = {
  grantPremiumPass: async () => "unavailable",
};

let binding: PremiumPassBinding = NOT_BOUND;

/** Binds D2's pass function (D2's server module calls this, or a check stands in for it). */
export function bindPremiumPass(next: PremiumPassBinding | null): void {
  binding = next ?? NOT_BOUND;
}

export function premiumPassBinding(): PremiumPassBinding {
  return binding;
}
