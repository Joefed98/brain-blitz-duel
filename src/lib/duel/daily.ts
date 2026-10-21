/**
 * The daily challenge (21 Oct 2026), shared by the phone and the server: the two dailies, the UK
 * day they belong to, and the leaderboard's order and cold-start rule. Pure: no clock is read
 * here, every caller passes its own "now" (the server's for anything stored).
 *
 * - Daily Puzzle: 6 rounds, one active game from each puzzle category; Daily Arcade: 3 different
 *   active arcade games. Dealt once per UK day on the server (daily.server.ts) and stored.
 * - A day runs from UK midnight to the next UK midnight (23 or 25 hours on the clock-change days).
 * - The board's order is the room tie-break (scoring.ts standings): total, then the time used
 *   (tieBreak.ts, every unplayed round counting its whole clock), level players sharing a place.
 * - The player count shows only once DAILY_COUNT_MIN players are on the board (cold start).
 */
import { ukTimeToUtcMs } from "@/lib/publicSchedule";

import type { PuzzleCategory } from "./types";

export type DailyKind = "puzzle" | "arcade";
export const DAILY_KINDS: readonly DailyKind[] = ["puzzle", "arcade"];

/** The async room kind stored for each daily (async_rooms.kind). */
export const DAILY_ROOM_KIND: Record<DailyKind, "daily_puzzle" | "daily_arcade"> = {
  puzzle: "daily_puzzle",
  arcade: "daily_arcade",
};

/** Daily Puzzle's categories, one round each, in the standard category order. */
export const DAILY_PUZZLE_CATEGORIES: readonly PuzzleCategory[] = [
  "word",
  "number",
  "speed",
  "attention",
  "pattern",
  "logic",
];
export const DAILY_ROUNDS: Record<DailyKind, number> = { puzzle: 6, arcade: 3 };
export const DAILY_TITLE: Record<DailyKind, string> = {
  puzzle: "Daily Puzzle",
  arcade: "Daily Arcade",
};

/** Players on a board before its count is shown. */
export const DAILY_COUNT_MIN = 20;
/** Rows a board shows above "You". */
export const DAILY_BOARD_TOP = 50;

export function isDailyKind(value: unknown): value is DailyKind {
  return value === "puzzle" || value === "arcade";
}

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The UK date ("2026-10-27") an instant falls on. */
export function ukDayKey(ms: number): string {
  return dayKeyFormat.format(new Date(ms));
}

/** The calendar day after (or before, with -1) a day key. */
export function shiftDayKey(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

/** A UK day's window: from its midnight to the next (UTC ms). */
export function ukDayWindow(day: string): { opensAt: number; closesAt: number } {
  return {
    opensAt: ukTimeToUtcMs(day, "00:00"),
    closesAt: ukTimeToUtcMs(shiftDayKey(day, 1), "00:00"),
  };
}

/** "daily_puzzle:2026-10-27": one room per daily per day (async_rooms.room_key, unique). */
export function dailyRoomKey(kind: DailyKind, day: string): string {
  return `${DAILY_ROOM_KIND[kind]}:${day}`;
}

/* ------------------------------------------------------------- the board */

export interface BoardEntry {
  id: string;
  total: number;
  /** The tie-break's time used, ms. */
  tieMs: number;
  /** When the attempt finished (ms), for a stable order among players sharing a place. */
  finishedAt: number;
}

/**
 * Ranks a board as the room tie-break does (scoring.ts rank): higher total first, then less time
 * used; players level on both share a place (1, 2, 2, 4). Within a shared place, who finished
 * first is listed first (display only; the place is shared).
 */
export function rankBoard<T extends BoardEntry>(entries: readonly T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.total - a.total ||
      a.tieMs - b.tieMs ||
      a.finishedAt - b.finishedAt ||
      a.id.localeCompare(b.id),
  );
  const out: (T & { rank: number })[] = [];
  sorted.forEach((entry, index) => {
    const previous = index > 0 ? out[index - 1]! : null;
    const rank =
      previous && previous.total === entry.total && previous.tieMs === entry.tieMs
        ? previous.rank
        : index + 1;
    out.push({ ...entry, rank });
  });
  return out;
}

/** The count shown with a rank: only from DAILY_COUNT_MIN players (null = show the rank alone). */
export function shownPlayerCount(players: number): number | null {
  return players >= DAILY_COUNT_MIN ? players : null;
}

/* ------------------------------------------------------- what the phone gets */

export interface DailyBoardRow {
  rank: number;
  name: string;
  total: number;
  colour: number | null;
  icon: string | null;
  isMe: boolean;
}

export interface DailyBoardView {
  day: string;
  /** False while the caller may not see the board yet (today, before they have finished). */
  open: boolean;
  /** The player count, or null under the cold-start minimum. */
  count: number | null;
  rows: DailyBoardRow[];
  /** The caller's own line, pinned (null when they did not play that day). */
  me: {
    rank: number | null;
    total: number;
    rounds: (number | null)[];
    finished: boolean;
    name: string;
  } | null;
}

/** One daily's state for the Play card and /daily. */
export type DailyState =
  | { state: "play" }
  | { state: "continue"; roundsDone: number }
  | { state: "done"; total: number; rank: number | null; count: number | null };

export interface DailyStatus {
  /** False before the async-room migration is applied: the Play card stays hidden. */
  available: boolean;
  day: string;
  /** When today's dailies close (UTC ms). */
  closesAt: number;
  puzzle: DailyState;
  arcade: DailyState;
}

/** "3rd of 45" from 20 players, "3rd" before. */
export function rankLine(
  rank: number | null,
  count: number | null,
  ordinal: (n: number) => string,
): string {
  if (rank === null) return "—";
  return count === null ? ordinal(rank) : `${ordinal(rank)} of ${count}`;
}
