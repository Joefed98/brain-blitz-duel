/**
 * Leaderboards (wave 4, session W4a; docs/leaderboards.md): the boards, scopes and periods, the Daily badges' field
 * sizes, the shapes the server answers and the words the screens use. Pure; shared by the phone and the server. Every
 * rank and value is the server's (supabase/migrations/20261115100000_leaderboards.sql); nothing here works one out.
 */
import { RATED_CATEGORIES, type RatedCategory } from "@/lib/data/ratings";

/** The three main rating boards (mockup 01's switch). */
export const MAIN_BOARDS = ["joulz", "puzzles", "arcade"] as const;
export type MainBoard = (typeof MAIN_BOARDS)[number];

/** Every rating board: the three main ones and the 11 categories (the profile's "Top Logic players"). */
export type RatingBoard = MainBoard | RatedCategory;
export const RATING_BOARDS: readonly RatingBoard[] = [...MAIN_BOARDS, ...RATED_CATEGORIES];

export const BOARD_SCOPES = ["global", "country", "friends"] as const;
export type BoardScope = (typeof BOARD_SCOPES)[number];

/** This season, or each player's all-time peak. */
export const BOARD_PERIODS = ["season", "peak"] as const;
export type BoardPeriod = (typeof BOARD_PERIODS)[number];

export const DAILY_BOARD_KINDS = ["puzzle", "arcade"] as const;
export type DailyBoardKind = (typeof DAILY_BOARD_KINDS)[number];
export const DAILY_BOARD_SCOPES = ["top100", "friends"] as const;
export type DailyBoardScope = (typeof DAILY_BOARD_SCOPES)[number];

/** async_rooms.kind for each Daily. */
export const DAILY_ROOM_KIND: Record<DailyBoardKind, "daily_puzzle" | "daily_arcade"> = {
  puzzle: "daily_puzzle",
  arcade: "daily_arcade",
};

/** Daily Champion counts only on a board of at least this many counted players (decided 11 Nov 2026). */
export const DAILY_CHAMPION_FIELD = 100;
/** Daily Top 100 counts only on a board of at least this many counted players (decided 11 Nov 2026). */
export const DAILY_TOP100_FIELD = 500;
/** The Daily top list's length. */
export const DAILY_TOP = 100;
/** An account must be this old when its Daily attempt starts to count on the board (decided 11 Nov 2026). */
export const DAILY_ACCOUNT_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/** The rating boards list at most the top 500; your own row is pinned below. */
export const RATING_BOARD_TOP = 500;
/** Rows per page of a rating board. */
export const RATING_PAGE = 50;
/** How often pg_cron refreshes the boards (shown as "Updated every few minutes"). */
export const REFRESH_MINUTES = 5;

export const MAIN_BOARD_LABEL: Record<MainBoard, string> = {
  joulz: "Joulz Rating",
  puzzles: "Puzzles",
  arcade: "Arcade",
};

/** The category boards' names, as the lobby and Practice name the categories and arcade groups. */
export const CATEGORY_BOARD_LABEL: Record<RatedCategory, string> = {
  word: "Word",
  number: "Number",
  speed: "Speed",
  attention: "Attention",
  pattern: "Pattern",
  logic: "Logic",
  retro: "Retro",
  sports: "Sports",
  cards: "Cards & Board",
  action: "Action",
  strategy: "Strategy",
};

export function boardLabel(board: RatingBoard): string {
  return (MAIN_BOARD_LABEL as Record<string, string>)[board] ?? CATEGORY_BOARD_LABEL[board as RatedCategory];
}

export const SCOPE_LABEL: Record<BoardScope, string> = { global: "Global", country: "Country", friends: "Friends" };
export const PERIOD_LABEL: Record<BoardPeriod, string> = { season: "This season", peak: "All-time peak" };
export const DAILY_KIND_LABEL: Record<DailyBoardKind, string> = { puzzle: "Daily Puzzle", arcade: "Daily Arcade" };

export function isRatingBoard(value: unknown): value is RatingBoard {
  return typeof value === "string" && (RATING_BOARDS as readonly string[]).includes(value);
}
export function isScope(value: unknown): value is BoardScope {
  return typeof value === "string" && (BOARD_SCOPES as readonly string[]).includes(value);
}
export function isPeriod(value: unknown): value is BoardPeriod {
  return typeof value === "string" && (BOARD_PERIODS as readonly string[]).includes(value);
}
export function isDailyKind(value: unknown): value is DailyBoardKind {
  return typeof value === "string" && (DAILY_BOARD_KINDS as readonly string[]).includes(value);
}
export function isDailyScope(value: unknown): value is DailyBoardScope {
  return typeof value === "string" && (DAILY_BOARD_SCOPES as readonly string[]).includes(value);
}
/** A calendar day key, YYYY-MM-DD. */
export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/* ------------------------------------------------------------------ what the server answers */

/**
 * One row as a phone sees it. A hidden player (an under-18 who hasn't opted in, an adult who opted out, an account
 * waiting for deletion) keeps their rank and value with no name, colour or number; a deleted account likewise.
 * Never more than the player card shows.
 */
export interface BoardRow {
  rank: number;
  value: number;
  isMe: boolean;
  isFriend: boolean;
  hidden: boolean;
  deleted: boolean;
  name: string | null;
  colour: number | null;
  playerNumber: number | null;
  /** The Top 500's number (this season's Joulz Rating board only, from W3a's tier). */
  top500?: number;
  /** A Daily row's time used, ms (the tie-break). */
  timeMs?: number;
  /** A Daily friends row: its place on the whole board. */
  boardRank?: number;
}

export interface RatingBoardPage {
  ready: boolean;
  reason?: "not_ready" | "no_country" | "bad_board";
  rows: BoardRow[];
  me: BoardRow | null;
  total: number;
  refreshedAt?: string;
  country?: string | null;
}

export type DailyMeReason = "guest" | "not_played" | "not_finished" | "new_account" | "pending" | "not_counted";

export interface DailyBoardPage {
  exists: boolean;
  reason?: "bad_board";
  day: string;
  kind?: "daily_puzzle" | "daily_arcade";
  players?: number;
  final?: boolean;
  open?: boolean;
  closesAt?: string;
  refreshedAt?: string;
  rows?: BoardRow[];
  me?: BoardRow | null;
  meReason?: DailyMeReason | null;
  prevDay: string | null;
  nextDay: string | null;
}

export interface BoardVisibility {
  /** Shown by name on global and country boards now. */
  show: boolean;
  /** The player's own choice; null = the default (adults shown, under-18s hidden). */
  setting: boolean | null;
  adult: boolean;
}

/* ------------------------------------------------------------------ words */

/** The name a row shows. */
export function rowName(row: BoardRow): string {
  if (row.isMe) return row.name ? `${row.name} (you)` : "You";
  if (row.deleted) return "Deleted player";
  if (row.hidden || !row.name) return "Hidden player";
  return row.isFriend ? `${row.name} (friend)` : row.name;
}

/** "Top 500 #37". */
export function top500Label(rank: number): string {
  return `Top 500 #${rank}`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 412th. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const unit = n % 10;
  return `${n}${unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"}`;
}

/** "4:12" from ms (the Daily's time used). */
export function boardTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "top 18%" (at least 1 %), from a place on a board of `players`. */
export function topShare(rank: number, players: number): string {
  if (players <= 0) return "";
  return `top ${Math.max(1, Math.ceil((rank / players) * 100))}%`;
}

/** Why your own row isn't on a Daily board, in plain words (null when there's nothing to say). */
export function dailyMeLine(reason: DailyMeReason | null | undefined): string | null {
  switch (reason) {
    case "guest":
      return "Only accounts count on the Daily top 100. Save your progress to join in.";
    case "new_account":
      return "New accounts count on the board from their second day.";
    case "not_finished":
      return "Finish today’s Daily to get your place.";
    case "pending":
      return "Your place shows within a few minutes.";
    case "not_counted":
      return "This run doesn’t count on the board.";
    default:
      return null;
  }
}
