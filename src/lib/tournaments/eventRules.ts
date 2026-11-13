/**
 * The Category Cup and the Joulz Championship's fixed rules (wave 4, W4c; docs/tournaments/events.md): the schedule as
 * W4b's event ids (`category_cup:<Saturday>:1900`, `championship:<YYYY-MM>`), the categories' rotation, field sizes,
 * the badges and the rules pages' words. Pure and phone-safe. Prices and prizes are W4b's config
 * (src/config/tournamentConfig.ts: CATEGORY_CUP_COINS, TOURNAMENT_PRIZES), read through W4b's rules.ts; the switches
 * are W4b's TOURNAMENT_KINDS_ON.
 *
 * Nothing here deals, grades, scores or rates: every match is an ordinary room graded by the rooms engine, and no
 * result here is ever read by ratings (tournament matches never change a rating).
 */
import { BIG_EVENT_TIME_UK } from "@/config/tournamentConfig";
import { pickLabel, ROOM_PICKS, type RoomPick } from "@/lib/duel/roomSettings";
import { ukTimeToUtcMs } from "@/lib/publicSchedule";
// Types only: rules.ts calls this module to schedule W4c's kinds, so nothing is imported from it at run time.
import type { ScheduledEvent } from "./rules";

export type BigKind = "category_cup" | "championship";
export const isBigKind = (v: unknown): v is BigKind => v === "category_cup" || v === "championship";

/** Each later round (Swiss) or bracket round (Knockout) starts this long after the last match of the one before. */
export const ROUND_BREAK_MS = 60_000;
/** Every match is a best of 3. */
export const MATCH_GAMES = 3;
/** How long an event's page counts it as on after its start (its `ends_at`; the event finishes when its last match does). */
export const BIG_EVENT_HOURS = 4;
/** Entry opens this long before the cup (after the Saturday before has started). */
export const CUP_ENTRY_OPENS_DAYS = 6;

/* ------------------------------------------------------------------ the Category Cup (Swiss) */

export const CUP_MIN_ENTRANTS = 16;

/**
 * The rotation through the 11 categories (the room picks: six puzzle categories, then the five arcade groups), one a
 * week. Anchored so Saturday 10 October 2026 was Word; 14 November 2026 is Logic (the mockup's Logic Cup).
 */
export const CUP_ROTATION: readonly RoomPick[] = ROOM_PICKS;
const CUP_ANCHOR = "2026-10-10";

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS) : Number.NaN;
};
const dateOfDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD date. */
export const weekdayOf = (date: string) => ((dayNumber(date) % 7) + 7 + 4) % 7;

/** The cup's category on a Saturday. */
export function cupCategoryOn(date: string): RoomPick {
  const weeks = Math.floor((dayNumber(date) - dayNumber(CUP_ANCHOR)) / 7);
  const n = CUP_ROTATION.length;
  return CUP_ROTATION[((weeks % n) + n) % n]!;
}

export const cupTitle = (category: RoomPick) => `${pickLabel(category)} Cup`;

/** The Swiss rounds for a field: 5 under 32, 6 under 64, 7 from 64 (0 below the 16 minimum: no cup). */
export function swissRoundsFor(entrants: number): number {
  if (entrants < CUP_MIN_ENTRANTS) return 0;
  if (entrants < 32) return 5;
  if (entrants < 64) return 6;
  return 7;
}

/* ------------------------------------------------------------------ the Joulz Championship (Knockout) */

export const CHAMPIONSHIP_QUALIFIERS = 64;
/**
 * Below this many qualifiers the Championship isn't held that month (Joe, 11 Nov 2026): nobody entered or paid, so
 * there is nothing to refund, and the Tournaments tab says so (`CHAMPIONSHIP_NOT_HELD_LINE`).
 */
export const CHAMPIONSHIP_MIN_QUALIFIERS = 16;
/** W4b's cancel reason for a Championship with too few qualifiers. */
export const CHAMPIONSHIP_NOT_HELD = "not_held";
/** What the Tournaments tab and the event page say about it. */
export const CHAMPIONSHIP_NOT_HELD_LINE = "Not held this month: fewer than 16 players qualified from the Score Attacks.";
/** Play again in a Category Cup or Championship room. */
export const BIG_EVENT_PLAY_AGAIN_LINE = "Your next match opens when the round does.";
/** The animated Championship frame (docs/art/wave-4/catalogue.json; placeholder art until drawn). */
export const CHAMPIONSHIP_FRAME = "frame.championship";
export const CHAMPIONSHIP_TITLE = "Joulz Championship";

/** The last Sunday of a month ("YYYY-MM"). */
export function lastSundayOf(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return "";
  let d = Math.round(Date.UTC(Number(m[1]), Number(m[2]), 1) / DAY_MS) - 1;
  while (weekdayOf(dateOfDayNumber(d)) !== 0) d--;
  return dateOfDayNumber(d);
}

/** "November 2026". */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

/* ------------------------------------------------------------------ the schedule (W4b's event ids) */

const HHMM = BIG_EVENT_TIME_UK.replace(":", "").padStart(4, "0");

export const cupEventId = (date: string) => `category_cup:${date}:${HHMM}`;
export const championshipEventId = (month: string) => `championship:${month}`;

/** "category_cup:2026-11-14:1900" → its Saturday; "championship:2026-11" → its month; else null. */
export function parseBigEventId(id: unknown): { kind: "category_cup"; date: string } | { kind: "championship"; month: string } | null {
  if (typeof id !== "string") return null;
  let m = /^category_cup:(\d{4}-\d{2}-\d{2}):(\d{4})$/.exec(id);
  if (m) return m[2] === HHMM && weekdayOf(m[1]!) === 6 ? { kind: "category_cup", date: m[1]! } : null;
  m = /^championship:(\d{4}-(0[1-9]|1[0-2]))$/.exec(id);
  return m ? { kind: "championship", month: m[1]! } : null;
}

/** One of W4c's events from its id, in W4b's schedule shape (no switch read here: W4b's scheduledEvent checks it). */
export function bigScheduledEvent(id: string): ScheduledEvent | null {
  const parts = parseBigEventId(id);
  if (!parts) return null;
  if (parts.kind === "category_cup") {
    const startsAt = ukTimeToUtcMs(parts.date, BIG_EVENT_TIME_UK);
    const pick = cupCategoryOn(parts.date);
    return {
      id,
      kind: "category_cup",
      title: cupTitle(pick),
      pick,
      startsAt,
      endsAt: startsAt + BIG_EVENT_HOURS * 3_600_000,
      entryOpensAt: startsAt - CUP_ENTRY_OPENS_DAYS * DAY_MS,
      entryClosesAt: startsAt,
    };
  }
  const day = lastSundayOf(parts.month);
  const startsAt = ukTimeToUtcMs(day, BIG_EVENT_TIME_UK);
  return {
    id,
    kind: "championship",
    title: CHAMPIONSHIP_TITLE,
    pick: "mixed",
    startsAt,
    endsAt: startsAt + BIG_EVENT_HOURS * 3_600_000,
    // Qualification only: nobody enters (W4b's entryOptionsFor gives no way in); the page shows it from the 1st.
    entryOpensAt: ukTimeToUtcMs(`${parts.month}-01`, "00:00"),
    entryClosesAt: startsAt,
  };
}

/** W4c's event ids starting on a UK day (the cup on a Saturday, the Championship on the month's last Sunday). */
export function bigEventIdsOn(day: string): string[] {
  const out: string[] = [];
  if (weekdayOf(day) === 6) out.push(cupEventId(day));
  if (lastSundayOf(day.slice(0, 7)) === day) out.push(championshipEventId(day.slice(0, 7)));
  return out;
}

/* ------------------------------------------------------------------ badges and words */

/** The winner's badge (C2's catalogue; both earnable since W4c). */
export const WINNER_BADGE: Record<BigKind, string> = {
  category_cup: "swiss-champion",
  championship: "knockout-champion",
};

/** The event page's "how it works", a sentence a row. */
export function bigHowItWorks(kind: BigKind, category: string): string[] {
  if (kind === "category_cup")
    return [
      `5 to 7 rounds of ${category} (more players, more rounds). Each round you play one best of 3 against someone on the same score.`,
      "Nobody is knocked out, so you play every round. You never meet the same player twice.",
      "Most match wins takes it. Ties go to the strength of the players you met.",
      "It needs 16 players; with fewer it’s called off and every entry refunded. Doesn’t change your rating.",
    ];
  return [
    "The month’s top 64 Score Attack players qualify (their best 10 daily totals that month), seeded by their place. It needs 16 qualifiers.",
    "A live bracket of best-of-3 duels: win and you go through. Top seeds get byes when fewer qualify.",
    "The semi-final losers play for 3rd. The final is live.",
    "Doesn’t change your rating.",
  ];
}

/** The Category Cup's full rules page, a sentence a row. */
export const CUP_RULES: readonly string[] = [
  "Saturdays at 7 pm UK. Each week is one category, in turn through all eleven.",
  "Enter for 150 coins or a Category Cup ticket. Accounts only. Entry opens six days before and closes at the start.",
  "The cup needs 16 players. With fewer at the start it’s called off and every entry is refunded in full.",
  "5 rounds with up to 31 players, 6 with up to 63, 7 with 64 or more.",
  "Each round you play one best of 3 against someone on the same score. You never play the same player twice.",
  "Nobody is knocked out: you play every round. A match win is 1 point and a drawn match half.",
  "With an odd number of players, the lowest-placed player who hasn’t had one gets a bye, worth a win.",
  "Most points wins. Ties go to Buchholz (the points of the players you met), then the result between you, then your total score across the cup, then who entered first.",
  "A round’s rooms open a minute after the last match of the round before. A match nobody finishes in 25 minutes counts what was played.",
  "1st: 3,000 coins, the gold trophy and the Swiss Champion badge. 2nd: 1,800 coins and the silver trophy (with 8 or more players). 3rd: 900 coins and the bronze trophy (with 12 or more). 4th–8th: 300 coins.",
  "Everyone who finishes gets 150 Joules.",
  "A run the server flags earns no points, place or prize; it goes to Joulz for review.",
  "Prizes are fixed by Joulz. Entry fees never go into a prize pot. Doesn’t change your rating.",
];

/** The Joulz Championship's full rules page, a sentence a row. */
export const CHAMPIONSHIP_RULES: readonly string[] = [
  "The last Sunday of the month at 7 pm UK.",
  "The month’s top 64 Score Attack players qualify: each player’s best 10 daily Score Attack totals that month added up; a tie goes to more days played, then the better best daily place. Accounts only; there’s no entry fee.",
  "It’s held only with at least 16 qualifiers. With fewer it isn’t held that month; nobody has paid, so there’s nothing to refund.",
  "A live bracket of best-of-3 duels, seeded by those standings: 1st plays the lowest seed.",
  "With fewer than 64 qualifiers the top seeds get byes into the next round.",
  "Win and you go through. A level match goes to the most games won, then the higher total, then less time, then the higher seed.",
  "The semi-final losers play for 3rd. The final is live.",
  "1st: 10,000 coins, the animated Championship frame, the Knockout Champion badge, the gold trophy and the hall of fame.",
  "2nd: 5,000 coins and the silver trophy. 3rd: 2,500 coins and the bronze trophy. 4th: 1,000 coins. 5th–8th: 500 coins.",
  "Everyone who plays gets 150 Joules.",
  "A run the server flags loses that match and earns no place or prize; it goes to Joulz for review.",
  "Doesn’t change your rating.",
];

/* ------------------------------------------------------------------ the month's Score Attack standings */

/** A player's month counts their best this many daily Score Attack totals. */
export const MONTH_BEST_DAYS = 10;

/**
 * The month's Score Attack standings from W4b's stored daily results: each player's best 10 daily totals added up,
 * then more days played, then the better best daily place, then the user id (a fixed order). Best first.
 */
export function monthStandings(results: readonly { user_id: string; total: number | null; place: number }[]): string[] {
  const by = new Map<string, { totals: number[]; best: number }>();
  for (const r of results) {
    const e = by.get(r.user_id) ?? { totals: [], best: Number.POSITIVE_INFINITY };
    e.totals.push(r.total ?? 0);
    e.best = Math.min(e.best, r.place);
    by.set(r.user_id, e);
  }
  const rows = [...by.entries()].map(([id, e]) => ({
    id,
    sum: [...e.totals].sort((a, b) => b - a).slice(0, MONTH_BEST_DAYS).reduce((s, v) => s + v, 0),
    days: e.totals.length,
    best: e.best,
  }));
  rows.sort((a, b) => b.sum - a.sum || b.days - a.days || a.best - b.best || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows.map((r) => r.id);
}
