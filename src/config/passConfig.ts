/**
 * The Season pass switch (wave 2, session D2; docs/economy/pass.md). Off until Season 1: the pass (the Shop tab's Pass
 * part, the Play tab's pass card, Joules on results) is for the shop's testers only (`shop.testers`, D1's one list),
 * and every pass server function refuses everyone else.
 *
 * To switch the pass on for everyone at Season 1: Joe sets Season 1's dates with
 * `SELECT pass.set_season_dates('s1', '<start>', '<end>', 'Season 1');` and this is set to true (with
 * SHOP_TAB_ENABLED, src/config/shopConfig.ts) and merged to main. Joules count from the season's start; the pass shows
 * while a season is live (and for CLAIM_GRACE_DAYS after its end, for claiming). Test purchases stay testers only.
 */
export const PASS_FOR_EVERYONE = false;
