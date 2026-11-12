/**
 * The Joulz Plus switch (wave 2, session E2; docs/economy/plus.md). Off until Season 1 starts: Plus (its part of the
 * Shop, its server functions, the Daily archive and the PLUS chip) is for the shop's testers only, the ONE tester list
 * in the database (`shop.testers`, wave 2 D1; Joe manages it with shop.add_tester / shop.remove_tester).
 *
 * To turn Plus on for everyone: set PLUS_FOR_EVERYONE to true and merge to main (the deploy ships it). The tester list
 * is then ignored for seeing Plus and for its perks; a test purchase (no payment) stays testers only until real
 * payments exist, so everyone else sees the price and "Coming soon".
 */
export const PLUS_FOR_EVERYONE = false;

/** The prices shown (docs/economy/economy-design.md "Joulz Plus"). Nothing is charged until real payments exist. */
export const PLUS_PRICES = { monthly: "£3.99", yearly: "£34.99" } as const;

/** What Plus pays each membership month: coins (reason plus_monthly) and streak freezes. */
export const PLUS_MONTHLY_COINS = 200;
export const PLUS_MONTHLY_FREEZES = 2;

/** How many past days the Daily archive offers (yesterday back). */
export const DAILY_ARCHIVE_DAYS = 30;
