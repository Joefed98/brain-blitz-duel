/**
 * Ball Tracker btRev 8's deal list (30 Oct 2026, docs/arcade-standard/balltrack.md "The deal"): rooms on btRev 8 deal
 * only the bank courses (ballTrackBankV7.server.ts) on which every marble can be brought home through a speed booster,
 * so every dealt course can reach 200. The boosted oracle (scripts/arcade-standard/balltrack.ts: the bank's playbook
 * player on booster routes, with a local search over each missed marble's route and target) reaches 200 through the
 * server replay on 299 of the 300 courses; course 56 tops out at 195 (35 home, one marble lands as the cups swap), so
 * it is left out. balltrack-deal-check proves the list, that no excluded course is dealt and (at full depth) that every
 * listed course reaches 200. Older stamps keep their stored courses; btRev 7 dealt from the whole bank.
 */
import { BALL_TRACK_BANK_V7 } from "./ballTrackBankV7.server";

/** Bank courses btRev 8 never deals (the oracle can't bring every marble home boosted on them). */
export const BT_V8_EXCLUDED: readonly number[] = [56];

/** The bank indices btRev 8 deals, in bank order. */
export const BT_V8_DEAL: readonly number[] = BALL_TRACK_BANK_V7.map((_, i) => i).filter((i) => !BT_V8_EXCLUDED.includes(i));

/**
 * The bank course a seed (any non-negative integer) picks on btRev 8 (tools and checks: the skill-band tool): the bank
 * index seed mod 300, as btRev 7, or, for an excluded course, the next course on the deal list. Rooms draw from
 * BT_V8_DEAL directly (generateBallTrack).
 */
export function btV8DealIndex(seed: number): number {
  const n = BALL_TRACK_BANK_V7.length;
  const i = ((seed % n) + n) % n;
  return BT_V8_DEAL.find((d) => d >= i) ?? BT_V8_DEAL[0]!;
}
