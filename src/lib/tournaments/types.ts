/**
 * The shapes the phone gets from the tournaments server functions (wave 4, W4b; docs/tournaments/interface.md
 * section 4). Phone and server; no logic.
 */
import type { EntryType, Medal, PrizeLine, TournamentKind } from "./rules";

export type EventStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface EntryOption {
  entry: EntryType;
  /** The coin price (coins entry), 0 otherwise. */
  coins: number;
  /** The caller can use it now (enough coins, or a ticket held). */
  affordable: boolean;
  /** Tickets of this kind held (ticket entries). */
  held: number | null;
}

export interface EntryView {
  eventId: string;
  kind: TournamentKind;
  title: string;
  startsAt: number;
  entry: EntryType;
  coins: number;
  enteredAt: number;
  refunded: boolean;
  status: EventStatus;
  /** Final place once the event has finished (null: not ranked, or not finished). */
  place: number | null;
  prizeCoins: number;
  /** A run the server flagged in this event: under review. */
  underReview: boolean;
}

export interface TournamentEventView {
  id: string;
  kind: TournamentKind;
  title: string;
  pick: string;
  pickLabel: string;
  startsAt: number;
  endsAt: number;
  entryOpensAt: number;
  entryClosesAt: number;
  status: EventStatus;
  entrants: number;
  /** Can be entered now. */
  entryOpen: boolean;
  entryOptions: EntryOption[];
  prizes: PrizeLine[];
  mine: EntryView | null;
  reminded: boolean;
  /** The rules page is a draft until the legal adviser's note on coin tournaments is in. */
  rulesDraft: true;
  /** A called-off Arena: the next one's start (UTC ms). */
  cancelledNext: number | null;
  cancelReason: string | null;
  /** Score Attack: the number of games. */
  rounds: number | null;
  /** The caller has a run the server flagged in this event (no place, prize, trophy or badge; under review). */
  underReview: boolean;
}

export interface TrophyView {
  eventId: string;
  kind: TournamentKind;
  medal: Medal;
  title: string;
  place: number;
  awardedAt: number;
}

export interface TournamentHub {
  /** Tournaments open to this account (everyone, or testers while the switch is off). */
  open: boolean;
  account: boolean;
  now: number;
  live: TournamentEventView[];
  next: TournamentEventView | null;
  /** The next 7 UK days, soonest first (the live ones included). */
  week: TournamentEventView[];
  entries: EntryView[];
  trophies: TrophyView[];
}

export type EnterRefusal =
  | "account"
  | "not_open"
  | "kind_off"
  | "closed"
  | "bad_entry"
  | "insufficient"
  | "no_ticket"
  | "banned"
  | "rate_limit";

export type EnterOutcome = { ok: true; entry: EntryView } | { ok: false; reason: EnterRefusal; message: string };

export interface ArenaDuelView {
  duelId: string;
  roomCode: string | null;
  opponent: { userId: string; name: string };
  status: "playing" | "settled" | "void";
}

export type ArenaPoll =
  | { state: "idle" }
  | { state: "searching"; waitedMs: number }
  | { state: "duel"; duel: ArenaDuelView }
  | { state: "closed"; message: string };

export interface ArenaBoardRow {
  place: number;
  userId: string;
  name: string;
  points: number;
  wins: number;
  streak: number;
  played: number;
  isMe: boolean;
}

export interface ArenaBoard {
  eventId: string;
  endsAt: number;
  status: EventStatus;
  players: number;
  rows: ArenaBoardRow[];
  me: ArenaBoardRow | null;
  /** The caller has a run the server flagged in this Arena: no points, the result under review. */
  underReview: boolean;
}

export interface ScoreAttackBoardRow {
  place: number;
  name: string;
  total: number;
  isMe: boolean;
}

export interface ScoreAttackBoard {
  eventId: string;
  /** Open once the caller's attempt has finished or the event has closed (the Daily's rule). */
  open: boolean;
  count: number;
  rows: ScoreAttackBoardRow[];
  me: { place: number | null; total: number; finished: boolean; roundsDone: number } | null;
  /** The caller's attempt has a round the server flagged: no score, the result under review. */
  underReview: boolean;
}
