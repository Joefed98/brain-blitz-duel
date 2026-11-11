/**
 * Rated play's switch (wave 3; docs/rated/README.md). One switch, shared by W3b (rated play offered to everyone) and
 * the weekly challenges: challenges marked R (rated play) are drawn only while it is on, and never before
 * (docs/economy/economy-design.md "Weekly challenges"). Off until Joe switches rated play on for everyone.
 *
 * A plain constant (no window override), so a production build holds exactly this value.
 */
export const RATED_PLAY_FOR_EVERYONE = false;

/** Whether the weekly draw may include challenges marked R. */
export function ratedChallengesDrawable(): boolean {
  return RATED_PLAY_FOR_EVERYONE;
}
