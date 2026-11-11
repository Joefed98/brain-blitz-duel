/**
 * Joules: what fills the pass (wave 2, session D2; docs/economy/economy-design.md "Joules and pacing";
 * docs/economy/pass.md). Earned on the server only, once per source event (a stored result), win or lose; never
 * coins, never anything that helps anyone win. Every day limit and the soft cap count per UK calendar day (the day the
 * source event happened, midnight to midnight in London).
 *
 * The database applies these rules under a lock (public.pass_credit_joules); `settleDay` is the same arithmetic in
 * TypeScript, for the checks and the screen's "what earns Joules" list.
 */

export type JoulesKind =
  | "daily_puzzle"
  | "daily_arcade"
  | "room_round"
  | "room_finish"
  | "challenge"
  | "practice"
  | "practice_challenge"
  | "weekly"
  | "rated"
  | "tournament";

/** What each source pays (before the day limits and the soft cap). */
export const JOULES = {
  daily_puzzle: 150,
  daily_arcade: 150,
  room_round: 20,
  room_finish: 50,
  challenge: 100,
  practice: 20,
  practice_challenge: 100,
} as const;

/** Friend challenges paid per UK day (the first five). */
export const CHALLENGES_PER_DAY = 5;
/** Practice games paid per UK day (20 each, up to 200). */
export const PRACTICE_JOULES_PER_DAY = 200;
/** After this many Joules in a UK day, further play earns half. Weekly challenge rewards are paid whole and don't count. */
export const SOFT_CAP = 4000;

/** Weekly challenge rewards by tier. */
export const WEEKLY_JOULES = { easy: 500, medium: 750, hard: 1250 } as const;

/* ------------------------------------------------------------------ the later hooks (nothing calls them yet) */

/** Rated match Joules (wave 3): 150 a win, 100 a loss; best of 5 or 7, or 4 or 8 players, 1.5 times that. */
export function ratedMatchJoules(input: { won: boolean; long: boolean }): number {
  const base = input.won ? 150 : 100;
  return input.long ? Math.floor((base * 3) / 2) : base;
}

/** Tournament Joules (wave 4): an Arena duel 100; finishing a Score Attack, Swiss or Knockout 150. */
export function tournamentJoules(input: { kind: "arena_duel" | "finished" }): number {
  return input.kind === "arena_duel" ? 100 : 150;
}

/* ------------------------------------------------------------------ the day's arithmetic */

export interface DayTotals {
  /** Joules credited today from play (weekly rewards left out). */
  total: number;
  /** Practice games paid today. */
  practicePaid: number;
  /** Friend challenges paid today. */
  challengesPaid: number;
}

/** Applies the soft cap to `base` given what the day already holds. */
export function softCapped(total: number, base: number): number {
  if (base <= 0) return 0;
  if (total >= SOFT_CAP) return Math.floor(base / 2);
  if (total + base <= SOFT_CAP) return base;
  const full = SOFT_CAP - total;
  return full + Math.floor((base - full) / 2);
}

/**
 * Pays one event against the day: the source's day limit first (Practice 200 Joules, five friend challenges), then the
 * soft cap. Answers what is paid and the day afterwards. Weekly rewards are whole and outside the day's total.
 */
export function payOne(day: DayTotals, kind: JoulesKind, base: number): { amount: number; base: number; day: DayTotals } {
  if (kind === "weekly") return { amount: base, base, day };
  let allowed = base;
  if (kind === "practice" && day.practicePaid * JOULES.practice >= PRACTICE_JOULES_PER_DAY) allowed = 0;
  if (kind === "challenge" && day.challengesPaid >= CHALLENGES_PER_DAY) allowed = 0;
  const amount = softCapped(day.total, allowed);
  return {
    amount,
    base: allowed,
    day: {
      total: day.total + amount,
      practicePaid: day.practicePaid + (kind === "practice" && allowed > 0 ? 1 : 0),
      challengesPaid: day.challengesPaid + (kind === "challenge" && allowed > 0 ? 1 : 0),
    },
  };
}

/** Pays a day's events in order (the checks' independent sum). */
export function settleDay(events: readonly { kind: JoulesKind; base: number }[], start: DayTotals = { total: 0, practicePaid: 0, challengesPaid: 0 }): number[] {
  let day = start;
  return events.map((e) => {
    const paid = payOne(day, e.kind, e.base);
    day = paid.day;
    return paid.amount;
  });
}
