/**
 * Rated play's switch (wave 3; docs/rated/README.md). One switch, shared by W3b (rated play offered to everyone) and
 * the weekly challenges: challenges marked R (rated play) are drawn only while it is on, and never before
 * (docs/economy/economy-design.md "Weekly challenges"). Off until Joe switches rated play on for everyone.
 *
 * Guests (Joe, 11 Nov 2026): once it is on, guests play rated matches too, placement included. Their ratings are kept
 * on their own player id (the auth user), so they carry to their account when they sign up: wave 1's linking keeps the
 * same id (ratings-check signs a placed guest up and proves placement, ratings and tier unchanged).
 *
 * A plain constant (no window override), so a production build holds exactly this value.
 */
export const RATED_PLAY_FOR_EVERYONE = false;

/** Whether the weekly draw may include challenges marked R. */
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
