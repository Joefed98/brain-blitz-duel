/**
 * A room's deal claim (13 Nov 2026, Security C1a; supabase/migrations/20261117500000_room_start_claim.sql). The host's
 * Start claims the room before its rounds are built; while the claim is fresh the lobby shows "Dealing…" and the
 * room's settings can't change. A claim older than DEAL_CLAIM_MS is treated as abandoned (a deal that never finished),
 * so the room can be started again. Pure: shared by the server and the phone.
 */

/** How long a deal claim holds the room. */
export const DEAL_CLAIM_MS = 60_000;

/** The settings sheet's answer while the room is being dealt. */
export const DEALING_MESSAGE = "The rounds are being dealt.";

/** Whether a claim stamped `claimedAt` still holds the room at `nowMs`. */
export function dealClaimFresh(claimedAt: string | null | undefined, nowMs: number): boolean {
  if (!claimedAt) return false;
  const at = Date.parse(claimedAt);
  return Number.isFinite(at) && nowMs - at < DEAL_CLAIM_MS;
}
