/**
 * Tournaments (wave 4, W4b; docs/tournaments/interface.md section 2, docs/tournaments/README.md). Joe changes these by
 * editing this file and merging to main (the deploy carries it). The server reads them on every call, so a kind that
 * is switched off can't be entered whatever an older phone sends.
 *
 * Decided 11 Nov 2026 (the build plan's wave 4 decisions): the launch set is the Arena (twice a day, free) and the
 * daily Score Attack; the Category Cup (Swiss) and the Joulz Championship (Knockout) are W4c's, behind their switches.
 * Prizes are fixed by Joulz and never pooled from entry fees.
 */

/**
 * Tournaments for everyone. false: only accounts on the tester list (shop.testers; Joe manages it with
 * shop.add_tester / shop.remove_tester) see and enter them, as with rated play. true: every signed-in account.
 */
export const TOURNAMENTS_FOR_EVERYONE = false;

/** Which kinds run. W4c's two stay off until Joe switches them on. */
export const TOURNAMENT_KINDS_ON = {
  arena: true,
  score_attack: true,
  category_cup: false,
  championship: false,
} as const;

/** The Arena: every day at these UK times (24-hour "HH:MM"), free. */
export const ARENA_TIMES_UK: readonly string[] = ["13:00", "20:00"];

/** Minutes after an Arena's start during which new duels can start (a duel started in time plays to its end). */
export const ARENA_WINDOW_MIN = 45;

/** An Arena starts only with at least this many entrants; otherwise it is called off and its entrants told kindly. */
export const ARENA_MIN_ENTRANTS = 4;

/** How long before its start an Arena can be entered (hours). It can also be entered while its window is open. */
export const ARENA_ENTRY_OPENS_H = 24;

/** The daily Score Attack's entry in coins (or one Score Attack ticket). */
export const SCORE_ATTACK_COINS = 50;

/** Games in a Score Attack, all from the day's featured category. */
export const SCORE_ATTACK_ROUNDS = 5;

/** The Category Cup's entry in coins (or one Category Cup ticket; W4c). */
export const CATEGORY_CUP_COINS = 150;

/** The Category Cup (Saturdays) and the Joulz Championship (the month's last Sunday) start at this UK time (W4c). */
export const BIG_EVENT_TIME_UK = "19:00";

/**
 * The prizes, fixed by Joulz (decided 11 Nov 2026). Each line: the places it covers, the coins each place gets and the
 * fewest entrants for it to pay (the small-field safeguard; trophies follow the same rule).
 */
export const TOURNAMENT_PRIZES = {
  arena: [
    { from: 1, to: 1, coins: 100, minEntrants: 4 },
    { from: 2, to: 2, coins: 60, minEntrants: 8 },
    { from: 3, to: 3, coins: 30, minEntrants: 12 },
  ],
  score_attack: [
    { from: 1, to: 1, coins: 300, minEntrants: 5 },
    { from: 2, to: 2, coins: 200, minEntrants: 8 },
    { from: 3, to: 3, coins: 100, minEntrants: 12 },
    { from: 4, to: 10, coins: 60, minEntrants: 50 },
  ],
  // W4c (the build plan's wave 4 decisions, 11 Nov 2026): 2nd only with 8 or more players, 3rd only with 12 or more.
  category_cup: [
    { from: 1, to: 1, coins: 3000, minEntrants: 1 },
    { from: 2, to: 2, coins: 1800, minEntrants: 8 },
    { from: 3, to: 3, coins: 900, minEntrants: 12 },
    { from: 4, to: 8, coins: 300, minEntrants: 1 },
  ],
  // The winner also gets the animated Championship frame, the Knockout Champion badge and the hall of fame.
  championship: [
    { from: 1, to: 1, coins: 10000, minEntrants: 1 },
    { from: 2, to: 2, coins: 5000, minEntrants: 1 },
    { from: 3, to: 3, coins: 2500, minEntrants: 1 },
    { from: 4, to: 4, coins: 1000, minEntrants: 1 },
    { from: 5, to: 8, coins: 500, minEntrants: 1 },
  ],
} as const;
