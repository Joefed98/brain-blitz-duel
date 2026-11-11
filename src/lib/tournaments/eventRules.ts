/**
 * The Category Cup and the Joulz Championship's fixed rules (wave 4, W4c; docs/tournaments/events.md): the schedule,
 * the categories' rotation, entry, field sizes, prizes with the small-field safeguard, trophies, badges and the rules
 * pages' words. Pure and phone-safe: the server's flow (eventsFlow.server.ts) and the screens read the same numbers.
 *
 * Nothing here deals, grades, scores or rates: every match is an ordinary room graded by the rooms engine, and no
 * result here is ever read by ratings (tournament matches never change a rating).
 */
import { ukTimeToUtcMs } from "@/lib/publicSchedule";
import { pickLabel, ROOM_PICKS, type RoomPick } from "@/lib/duel/roomSettings";
import { ordinal } from "@/lib/duel/ordinal";

export type EventKind = "category_cup" | "championship";
export const EVENT_KINDS: readonly EventKind[] = ["category_cup", "championship"];
export const isEventKind = (v: unknown): v is EventKind => v === "category_cup" || v === "championship";

/** Every event starts at 7 pm UK time. */
export const EVENT_START_UK = "19:00";
/** Each round (Swiss) or bracket round (Knockout) starts this long after the last match of the one before settles. */
export const ROUND_BREAK_MS = 60_000;
/** One reminder to every entrant this long before the start. */
export const REMINDER_BEFORE_MS = 15 * 60_000;
/** Every match is a best of 3 (three games, all played; most games won takes it). */
export const MATCH_GAMES = 3;

/* ------------------------------------------------------------------ the Category Cup (Swiss) */

export const CUP_MIN_ENTRANTS = 16;
export const CUP_MAX_ENTRANTS = 128;
export const CUP_ENTRY_COINS = 150;
/** A Category Cup ticket (A1's consumable) enters instead of the coins. */
export const CUP_TICKET_KIND = "ticket_category_cup";

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

/** The UK calendar date of a moment. */
export function ukDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** The cup's category on a Saturday. */
export function cupCategoryOn(date: string): RoomPick {
  const weeks = Math.floor((dayNumber(date) - dayNumber(CUP_ANCHOR)) / 7);
  const n = CUP_ROTATION.length;
  return CUP_ROTATION[((weeks % n) + n) % n]!;
}

/** The start (UTC ms) of the event on a date. */
export const eventStartMs = (date: string) => ukTimeToUtcMs(date, EVENT_START_UK);

/** How long after its start an event still counts as today's (running or just finished) for the event page. */
export const EVENT_SHOWN_AFTER_MS = 6 * 60 * 60_000;

/** The Saturday whose cup the event page shows: today's until 6 h after its start, else the next one. */
export function cupDateFor(nowMs: number): string {
  const today = ukDate(nowMs);
  const n = dayNumber(today);
  const toSat = (6 - weekdayOf(today) + 7) % 7;
  const sat = dateOfDayNumber(n + toSat);
  if (toSat === 0 && nowMs > eventStartMs(sat) + EVENT_SHOWN_AFTER_MS) return dateOfDayNumber(n + 7);
  return sat;
}

/** The Swiss rounds for a field: 5 under 32, 6 under 64, 7 from 64 (0 below the 16 minimum: no cup). */
export function swissRoundsFor(entrants: number): number {
  if (entrants < CUP_MIN_ENTRANTS) return 0;
  if (entrants < 32) return 5;
  if (entrants < 64) return 6;
  return 7;
}

/* ------------------------------------------------------------------ the Joulz Championship (Knockout) */

export const CHAMPIONSHIP_QUALIFIERS = 64;
/** Below this many qualifiers there is no bracket: the Championship is cancelled. */
export const CHAMPIONSHIP_MIN_QUALIFIERS = 2;
/** The animated Championship frame (docs/art/wave-4/catalogue.json; placeholder art until drawn). */
export const CHAMPIONSHIP_FRAME = "frame.championship";

/** The last Sunday of a month ("YYYY-MM"). */
export function lastSundayOf(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return "";
  const nextFirst = Math.round(Date.UTC(Number(m[1]), Number(m[2]), 1) / DAY_MS);
  let d = nextFirst - 1;
  while (weekdayOf(dateOfDayNumber(d)) !== 0) d--;
  return dateOfDayNumber(d);
}

/** The month whose Championship the event page shows: this month's until 6 h after its final day's start, else next. */
export function championshipMonthFor(nowMs: number): string {
  const month = ukDate(nowMs).slice(0, 7);
  if (nowMs <= eventStartMs(lastSundayOf(month)) + EVENT_SHOWN_AFTER_MS) return month;
  const [y, mo] = month.split("-").map(Number) as [number, number];
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/** "November 2026". */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

/* ------------------------------------------------------------------ event keys */

/** One event per Saturday / month: `category_cup:2026-11-14`, `championship:2026-11`. */
export const cupKey = (date: string) => `category_cup:${date}`;
export const championshipKey = (month: string) => `championship:${month}`;

/* ------------------------------------------------------------------ prizes */

export interface PrizeLine {
  /** First place of the line (inclusive) … last (inclusive). */
  from: number;
  to: number;
  coins: number;
  /** The small-field safeguard: paid only with at least this many entrants. */
  minField?: number;
}

/** 3,000 / 1,800 / 900, 4th–8th 300; 2nd only with 8+ entrants, 3rd only with 12+. */
export const CUP_PRIZES: readonly PrizeLine[] = [
  { from: 1, to: 1, coins: 3000 },
  { from: 2, to: 2, coins: 1800, minField: 8 },
  { from: 3, to: 3, coins: 900, minField: 12 },
  { from: 4, to: 8, coins: 300 },
];

/** 10,000 (with the Championship frame and the hall of fame) / 5,000 / 2,500 / 1,000, 5th–8th 500. */
export const CHAMPIONSHIP_PRIZES: readonly PrizeLine[] = [
  { from: 1, to: 1, coins: 10000 },
  { from: 2, to: 2, coins: 5000 },
  { from: 3, to: 3, coins: 2500 },
  { from: 4, to: 4, coins: 1000 },
  { from: 5, to: 8, coins: 500 },
];

export const prizesFor = (kind: EventKind) => (kind === "category_cup" ? CUP_PRIZES : CHAMPIONSHIP_PRIZES);

/** The coins a place earns in a field (0: no prize). Places are 1-based; a Knockout's 5th–8th share place 5. */
export function prizeCoins(kind: EventKind, place: number, field: number): number {
  const line = prizesFor(kind).find((l) => place >= l.from && place <= l.to);
  if (!line) return 0;
  if (line.minField !== undefined && field < line.minField) return 0;
  return line.coins;
}

export type TrophyCup = "gold" | "silver" | "bronze";
/** A trophy for 1st, 2nd and 3rd, under the same safeguard as the prize. */
export function trophyFor(kind: EventKind, place: number, field: number): TrophyCup | null {
  if (place < 1 || place > 3 || prizeCoins(kind, place, field) === 0) return null;
  return place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
}

/** The winner's badge (C2's catalogue; both earnable since W4c). */
export const WINNER_BADGE: Record<EventKind, string> = {
  category_cup: "swiss-champion",
  championship: "knockout-champion",
};

/** Joules (D2's pass progress) for finishing either event, once per entrant per event. */
export const FINISH_JOULES = 150;

/* ------------------------------------------------------------------ words */

export const EVENT_NAME: Record<EventKind, string> = { category_cup: "Category Cup", championship: "Joulz Championship" };

export function cupTitle(category: RoomPick): string {
  return `${pickLabel(category)} Cup`;
}

/** A prize line in words: "2nd: 1,800 coins (with 8 or more players)". */
export function prizeLineText(line: PrizeLine): string {
  const places = line.from === line.to ? ordinal(line.from) : `${ordinal(line.from)}–${ordinal(line.to)}`;
  const coins = `${line.coins.toLocaleString("en-GB")} coins`;
  return line.minField ? `${places}: ${coins} (with ${line.minField} or more players)` : `${places}: ${coins}`;
}

/** The Category Cup's rules page, a sentence a row. */
export const CUP_RULES: readonly string[] = [
  "Saturdays at 7 pm UK. Each week is one category, in turn through all eleven.",
  "Enter for 150 coins or a Category Cup ticket. Accounts only.",
  "The cup needs 16 players. With fewer at the start it’s cancelled and every entry is refunded.",
  "You can leave before the start and get your entry back.",
  "5 rounds with up to 31 players, 6 with up to 63, 7 with 64 or more.",
  "Each round you play one best of 3 against someone on the same score. You never play the same player twice.",
  "Nobody is knocked out: you play every round. A win is 1 point and a drawn match half.",
  "With an odd number of players, the lowest-placed player who hasn’t had one gets a bye, worth a win.",
  "Most points wins. Ties go to Buchholz (the points of the players you met), then the result between you, then your total score across the cup, then who entered first.",
  "1st: 3,000 coins, the gold cup and the Swiss Champion badge. 2nd: 1,800 coins and the silver cup (with 8 or more players). 3rd: 900 coins and the bronze cup (with 12 or more). 4th–8th: 300 coins.",
  "Everyone who finishes gets 150 Joules.",
  "Prizes are fixed by Joulz. Entry fees never go into a prize pot.",
  "Doesn’t change your rating.",
];

/** The Joulz Championship's rules page, a sentence a row. */
export const CHAMPIONSHIP_RULES: readonly string[] = [
  "The last Sunday of the month at 7 pm UK.",
  "The month’s top 64 Score Attack players qualify. Accounts only; there’s no entry fee.",
  "A live bracket of best-of-3 duels, seeded by the Score Attack standings: 1st plays the lowest seed.",
  "With fewer than 64 qualifiers the top seeds get byes into the next round.",
  "Win and you go through. A level match goes to the most games won, then the higher total, then less time, then the higher seed.",
  "The semi-final losers play for 3rd. The final is live.",
  "1st: 10,000 coins, the animated Championship frame, the Knockout Champion badge, the gold trophy and the hall of fame.",
  "2nd: 5,000 coins and the silver trophy. 3rd: 2,500 coins and the bronze trophy. 4th: 1,000 coins. 5th–8th: 500 coins.",
  "Everyone who plays gets 150 Joules.",
  "Doesn’t change your rating.",
];
