/**
 * Rated play for everyone (wave 3; docs/rated/ratings-interface.md, docs/rated/matchmaking-interface.md). The one switch
 * W3b's queue and W3a's weekly R challenges share. false: only accounts on the tester list (shop.testers; Joe manages it
 * with shop.add_tester / shop.remove_tester) can queue, and R challenges aren't drawn. true: every signed-in account.
 * Joe flips it by editing this file and merging to main, after his phone tests.
 *
 * The format and choice switches are W3b's own: src/config/matchmakingConfig.ts.
 */
export const RATED_PLAY_FOR_EVERYONE = false;

/** Whether the weekly draw may include challenges marked R (W3a). */
export function ratedChallengesDrawable(): boolean {
  return RATED_PLAY_FOR_EVERYONE;
}
