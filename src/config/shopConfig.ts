/**
 * The Shop switch (wave 2, train A; off for players until train D). While off, players keep today's four tabs
 * (Play, Practice, Tournaments, Profile) and see no coin counter; the Shop tab, the /shop page and the counter show
 * only for the accounts in SHOP_PREVIEW_PLAYERS.
 *
 * To turn the Shop on for everyone (train D): set SHOP_TAB_ENABLED to true and merge to main (the deploy ships it).
 * The preview list can then be emptied; it is ignored while the switch is on.
 */

/** The Shop tab, its page and the header's coin counter, for every account and guest. Off until train D. */
export const SHOP_TAB_ENABLED = false;

/**
 * Wave 2 D1: the real list of who sees the Shop while the switch is off is the tester list Joe manages in the
 * database (shop.add_tester / shop.remove_tester / shop.list_testers; docs/economy/shop.md), which the server checks
 * on every shop call and the phone reads through shopStatusFn. This static list still shows the tab at first paint.
 *
 * Accounts that see the Shop while the switch is off, by player number (#0001 is Joe's, given by
 * accounts.admin_assign_player_one). Signed-in accounts only: a guest never matches.
 */
export const SHOP_PREVIEW_PLAYERS: readonly number[] = [1];
