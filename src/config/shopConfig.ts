/**
 * The Shop switch (wave 2, train A; off for players until Season 1). While off, players keep today's four tabs
 * (Play, Practice, Tournaments, Profile) and see no coin counter; the Shop tab, the /shop page and the counter show
 * only for the shop's testers.
 *
 * Testers are ONE list, `shop.testers` in the database (wave 2 D1), which Joe manages with shop.add_tester,
 * shop.remove_tester and shop.list_testers (docs/economy/shop.md). The server checks it on every shop call; the phone
 * learns this account's place on it from shopStatusFn (src/lib/shop/shopStatus.ts) and keeps the answer per player
 * number, so a tester's tab is there at first paint. Joe's account (#0001) is put on the list by the shop migration
 * and whenever an account becomes #0001 (`shop.on_player_one`).
 *
 * To turn the Shop on for everyone: set SHOP_TAB_ENABLED to true and merge to main (the deploy ships it). The tester
 * list is then ignored for the tab and the shop; test coin packs stay testers only.
 */

/** The Shop tab, its page and the header's coin counter, for every account and guest. Off until Season 1. */
export const SHOP_TAB_ENABLED = false;
