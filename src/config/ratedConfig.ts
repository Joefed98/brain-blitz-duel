/**
 * Rated play for everyone (wave 3; docs/rated/ratings-interface.md, docs/rated/matchmaking-interface.md). The one switch
 * W3b's queue and W3a's weekly R challenges share. false: only accounts on the tester list (shop.testers; Joe manages it
 * with shop.add_tester / shop.remove_tester) can queue, and R challenges aren't drawn. true: every signed-in account.
 * Joe flips it by editing this file and merging to main, after his phone tests.
 *
 * Guests (Joe, 11 Nov 2026): once it is on, guests play rated matches too, placement included. Their ratings are kept
 * on their own player id (the auth user), so they carry to their account when they sign up: wave 1's linking keeps the
 * same id (ratings-check signs a placed guest up and proves placement, ratings and tier unchanged).
 *
 * The format and choice switches are W3b's own: src/config/matchmakingConfig.ts.
 *
 * A plain constant (no window override), so a production build holds exactly this value.
 */
export const RATED_PLAY_FOR_EVERYONE = false;

/** Whether the weekly draw may include challenges marked R (W3a). */
export function ratedChallengesDrawable(): boolean {
  return RATED_PLAY_FOR_EVERYONE;
}

/**
 * Whether guests may play rated matches (placement included): only once rated play is on for everyone. The match
 * engine (W3b) gates a guest's queue on this; the ratings engine records a guest's match like any other.
 */
export function guestsMayPlayRated(): boolean {
  return RATED_PLAY_FOR_EVERYONE;
}

/**
 * The wait after leaving rated matches during set-up (13 Nov 2026, Joe): leaves counted over the last `periodMs`; the
 * first is free, the second waits 2 min, the third 10 min, the fourth and later 30 min, each counted from the latest
 * leave. A player put back in the queue because the other player left (reviewDepartures) never waits.
 */
export const RATED_ABORT_COOLDOWN = {
  periodMs: 24 * 60 * 60 * 1000,
  waitsMs: [0, 2 * 60 * 1000, 10 * 60 * 1000, 30 * 60 * 1000],
} as const;
