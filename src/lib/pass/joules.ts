/**
 * Joules: what fills the pass (wave 2, session D2; docs/economy/economy-design.md "Joules and pacing";
 * docs/economy/pass.md). Earned on the server only, once per source event (a stored result), win or lose; never
 * coins, never anything that helps anyone win. Every day limit and the soft cap count per UK calendar day (the day the
 * source event happened, midnight to midnight in London).
 *
 * The database applies these rules under a lock (public.pass_credit_joules); `settleDay` is the same arithmetic in
 * TypeScript, for the checks and the screen's "what earns Joules" list.
 *
 * The Joules rework (Joe, 13 Nov 2026; docs/economy/economy-design.md "Joules and pacing"): Practice games and rooms
 * no longer pay (the stored rows they credited before stay as they are; `LEGACY_JOULES` keeps their arithmetic for
 * them); a mastery star pays once, a Practice challenge's first completion 100 on every level, the Dailies 200 each
 * and the weekly challenges 750 / 1,000 / 1,500.
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
  | "tournament"
  | "star";

/**
 * What each source pays today (before the day limits and the soft cap). A friend challenge's creator is paid for their
 * own attempt only once another player has finished that challenge (public.pass_activity).
 */
export const JOULES = {
  daily_puzzle: 200,
  daily_arcade: 200,
  challenge: 100,
  practice_challenge: 100,
} as const;

/**
 * What rooms and Practice games paid until the Joules rework (13 Nov 2026). Nothing is credited for them now; the
 * amounts stay for the rows already stored and for pass_credit_joules' unchanged arithmetic (its Practice day limit).
 */
export const LEGACY_JOULES = { room_round: 20, room_finish: 50, practice: 20 } as const;

/** A mastery star's Joules, once per star: Classic, the only level dealt today. */
export const STAR_JOULES_CLASSIC = 150;
/**
 * Easy and Hard stars (phase 3's difficulty levels): provisional, to confirm in phase 3. Not live: until Joe confirms
 * them, an Easy or Hard star pays nothing and is not credited at all (so a confirmed amount can still pay it later).
 */
export const STAR_JOULES_EASY_PROVISIONAL = 50;
export const STAR_JOULES_HARD_PROVISIONAL = 250;
/** The star amounts that are live, by level. */
export const STAR_JOULES_LIVE: Readonly<Partial<Record<string, number>>> = { classic: STAR_JOULES_CLASSIC };

/** A star's live Joules from its stored source key ("star:<game>:<level>"), or 0 where its level doesn't pay yet. */
export function starJoules(key: string): number {
  const level = key.split(":")[2] ?? "";
  return STAR_JOULES_LIVE[level] ?? 0;
}

/** Friend challenges paid per UK day (the first five). */
export const CHALLENGES_PER_DAY = 5;
/** The old Practice day limit (20 each, up to 200), still applied by pass_credit_joules to legacy Practice rows. */
export const PRACTICE_JOULES_PER_DAY = 200;
/** After this many Joules in a UK day, further play earns half. Weekly challenge rewards are paid whole and don't count. */
export const SOFT_CAP = 4000;

/** Weekly challenge rewards by tier. */
export const WEEKLY_JOULES = { easy: 750, medium: 1000, hard: 1500 } as const;

/*
 * ------------------------------------------------------------------ rated play and tournaments
 * Called: rated matches by W3a's finishRatedMatch (src/lib/rated/rewards.server.ts), tournaments by W4b and W4c
 * (src/lib/tournaments/tournaments.server.ts, platform.server.ts), through creditRatedMatchJoules and
 * creditTournamentJoules in pass.server.ts.
 */

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
  if (kind === "practice" && day.practicePaid * LEGACY_JOULES.practice >= PRACTICE_JOULES_PER_DAY) allowed = 0;
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
