/**
 * Tournaments' pure rules (wave 4, W4b; docs/tournaments/interface.md). Phone and server: the schedule in UK time, the
 * event ids, entry options, the Arena's points and streak, standings order, the prize table with the small-field
 * safeguard, and trophies. No database, no clock of its own (every function takes the time it needs).
 *
 * Nothing here is read by grading, scoring, replay, timing, the deal or ratings: tournaments never change a rating.
 */
import {
  ARENA_ENTRY_OPENS_H,
  ARENA_MIN_ENTRANTS,
  ARENA_TIMES_UK,
  ARENA_WINDOW_MIN,
  CATEGORY_CUP_COINS,
  SCORE_ATTACK_COINS,
  TOURNAMENT_KINDS_ON,
  TOURNAMENT_PRIZES,
  TOURNAMENTS_FOR_EVERYONE,
} from "@/config/tournamentConfig";
import { shiftDayKey, ukDayKey, ukDayWindow } from "@/lib/duel/daily";
import { pickLabel, ROOM_PICKS, type RoomPick } from "@/lib/duel/roomSettings";
import { ukTimeToUtcMs } from "@/lib/publicSchedule";
// W4c's kinds schedule themselves there (the Category Cup and the Joulz Championship).
import { bigEventIdsOn, bigScheduledEvent, parseBigEventId } from "./eventRules";

/* ------------------------------------------------------------------ kinds and switches */

export const TOURNAMENT_KINDS = ["arena", "score_attack", "category_cup", "championship"] as const;
export type TournamentKind = (typeof TOURNAMENT_KINDS)[number];

export const isTournamentKind = (value: unknown): value is TournamentKind =>
  typeof value === "string" && (TOURNAMENT_KINDS as readonly string[]).includes(value);

/** The kind's own word on the hub ("Arena", "Score Attack", "Swiss", "Knockout"). */
export const KIND_LABEL: Readonly<Record<TournamentKind, string>> = {
  arena: "Arena",
  score_attack: "Score Attack",
  category_cup: "Swiss",
  championship: "Knockout",
};

export interface TournamentSwitches {
  forEveryone: boolean;
  kinds: Readonly<Record<TournamentKind, boolean>>;
}

export const TOURNAMENT_SWITCHES: TournamentSwitches = {
  forEveryone: TOURNAMENTS_FOR_EVERYONE,
  kinds: TOURNAMENT_KINDS_ON,
};

/** Whether tournaments are open to this account: everyone, or testers while the switch is off. */
export function tournamentsOpenFor(isTester: boolean, switches: TournamentSwitches = TOURNAMENT_SWITCHES): boolean {
  return switches.forEveryone || isTester;
}

/* ------------------------------------------------------------------ entry */

export const ENTRY_TYPES = ["free", "coins", "ticket_score_attack", "ticket_category_cup"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const isEntryType = (value: unknown): value is EntryType =>
  typeof value === "string" && (ENTRY_TYPES as readonly string[]).includes(value);

/** The consumable a ticket entry uses (A1's kinds). */
export const TICKET_KIND: Readonly<Partial<Record<EntryType, "ticket_score_attack" | "ticket_category_cup">>> = {
  ticket_score_attack: "ticket_score_attack",
  ticket_category_cup: "ticket_category_cup",
};

/** Coins a kind's coin entry costs (0: free only). */
export function entryCoins(kind: TournamentKind): number {
  if (kind === "category_cup") return CATEGORY_CUP_COINS;
  return kind === "score_attack" ? SCORE_ATTACK_COINS : 0;
}

/**
 * The ways into an event of this kind: the Arena is free; a Score Attack takes 50 coins or a Score Attack ticket, and,
 * while the Category Cup is switched off, a Category Cup ticket too.
 */
export function entryOptionsFor(kind: TournamentKind, switches: TournamentSwitches = TOURNAMENT_SWITCHES): EntryType[] {
  if (kind === "arena") return ["free"];
  if (kind === "score_attack") {
    const out: EntryType[] = ["coins", "ticket_score_attack"];
    if (!switches.kinds.category_cup) out.push("ticket_category_cup");
    return out;
  }
  if (kind === "category_cup") return ["coins", "ticket_category_cup"];
  // The Joulz Championship (W4c) can't be entered: the month's top 64 Score Attack players qualify.
  if (kind === "championship") return [];
  return ["free"];
}

/* ------------------------------------------------------------------ the schedule */

/** Minutes before a Score Attack closes after which it can't be entered (time to play its games). */
export const SCORE_ATTACK_LAST_ENTRY_MIN = 30;

export interface ScheduledEvent {
  id: string;
  kind: TournamentKind;
  title: string;
  /** The featured pick (Score Attack), or "mixed". */
  pick: RoomPick | "mixed";
  startsAt: number;
  endsAt: number;
  /** When it can first be entered. */
  entryOpensAt: number;
  /** The last moment it can be entered. */
  entryClosesAt: number;
}

const hhmm = (time: string) => time.replace(":", "").padStart(4, "0");

/** "arena:2026-11-11:1300", "score_attack:2026-11-11". */
export function eventIdFor(kind: TournamentKind, day: string, time?: string): string {
  return time ? `${kind}:${day}:${hhmm(time)}` : `${kind}:${day}`;
}

/** The parts of an event id, or null for anything else. */
export function parseEventId(id: unknown): { kind: TournamentKind; day: string; time: string | null } | null {
  if (typeof id !== "string" || id.length > 64) return null;
  // W4c's ids: category_cup:<Saturday>:1900 and championship:<YYYY-MM> (its day field is the month).
  const big = parseBigEventId(id);
  if (big) return big.kind === "category_cup" ? { kind: big.kind, day: big.date, time: id.slice(-4, -2) + ":" + id.slice(-2) } : { kind: big.kind, day: big.month, time: null };
  if (id.startsWith("category_cup:") || id.startsWith("championship:")) return null;
  const m = /^([a-z_]+):(\d{4}-\d{2}-\d{2})(?::(\d{4}))?$/.exec(id);
  if (!m || !isTournamentKind(m[1])) return null;
  const time = m[3] ? `${m[3].slice(0, 2)}:${m[3].slice(2)}` : null;
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return { kind: m[1], day: m[2]!, time };
}

/** Whole days since 1 Jan 2026 for a UK day key (the featured pick's rotation). */
function dayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86_400_000);
}

/** The day's featured pick for the Score Attack: the room picks in turn, one a day, the same for everyone. */
export function featuredPick(day: string): RoomPick {
  const n = ROOM_PICKS.length;
  return ROOM_PICKS[(((dayIndex(day) % n) + n) % n)]!;
}

/** "Logic Day": the Score Attack's title from its pick. */
export function scoreAttackTitle(pick: RoomPick): string {
  return `${pickLabel(pick)} Day`;
}

/** "Lunchtime Arena" / "Evening Arena" (and the time for any other slot). */
export function arenaTitle(time: string): string {
  const hour = Number(time.slice(0, 2));
  if (hour >= 11 && hour < 15) return "Lunchtime Arena";
  if (hour >= 17 && hour < 23) return "Evening Arena";
  return "Arena";
}

/** One event of the schedule from its id (null: not a scheduled slot, or its kind is off). */
export function scheduledEvent(id: string, switches: TournamentSwitches = TOURNAMENT_SWITCHES): ScheduledEvent | null {
  const parts = parseEventId(id);
  if (!parts || !switches.kinds[parts.kind]) return null;
  if (parts.kind === "arena") {
    if (!parts.time || !ARENA_TIMES_UK.some((t) => hhmm(t) === hhmm(parts.time!))) return null;
    const startsAt = ukTimeToUtcMs(parts.day, parts.time);
    if (!Number.isFinite(startsAt)) return null;
    const endsAt = startsAt + ARENA_WINDOW_MIN * 60_000;
    return {
      id,
      kind: "arena",
      title: arenaTitle(parts.time),
      pick: "mixed",
      startsAt,
      endsAt,
      entryOpensAt: startsAt - ARENA_ENTRY_OPENS_H * 3_600_000,
      // Late entry: until five minutes before the window closes.
      entryClosesAt: endsAt - 5 * 60_000,
    };
  }
  if (parts.kind === "score_attack") {
    if (parts.time) return null;
    const { opensAt, closesAt } = ukDayWindow(parts.day);
    const pick = featuredPick(parts.day);
    return {
      id,
      kind: "score_attack",
      title: scoreAttackTitle(pick),
      pick,
      startsAt: opensAt,
      endsAt: closesAt,
      entryOpensAt: opensAt - 24 * 3_600_000,
      entryClosesAt: closesAt - SCORE_ATTACK_LAST_ENTRY_MIN * 60_000,
    };
  }
  if (parts.kind === "category_cup" || parts.kind === "championship") return bigScheduledEvent(id);
  return null;
}

/** Every scheduled event starting in [fromMs, toMs), soonest first (kinds that are on only). */
export function scheduleBetween(fromMs: number, toMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  let day = shiftDayKey(ukDayKey(fromMs), -1);
  const last = shiftDayKey(ukDayKey(toMs), 1);
  for (let guard = 0; guard < 400 && day <= last; guard++, day = shiftDayKey(day, 1)) {
    const ids = [eventIdFor("score_attack", day), ...ARENA_TIMES_UK.map((t) => eventIdFor("arena", day, t)), ...bigEventIdsOn(day)];
    for (const id of ids) {
      const ev = scheduledEvent(id, switches);
      if (ev && ev.startsAt >= fromMs && ev.startsAt < toMs) out.push(ev);
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}

/** Events in progress at `nowMs` (started, not yet ended). */
export function liveAt(nowMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): ScheduledEvent[] {
  return scheduleBetween(nowMs - 2 * 86_400_000, nowMs + 1, switches).filter((e) => e.startsAt <= nowMs && nowMs < e.endsAt);
}

/** The phase of a scheduled event at `nowMs`. */
export function phaseAt(ev: Pick<ScheduledEvent, "startsAt" | "endsAt">, nowMs: number): "upcoming" | "live" | "ended" {
  if (nowMs < ev.startsAt) return "upcoming";
  return nowMs < ev.endsAt ? "live" : "ended";
}

/** Whether the event can be entered at `nowMs`. */
export function entryOpen(ev: Pick<ScheduledEvent, "entryOpensAt" | "entryClosesAt">, nowMs: number): boolean {
  return nowMs >= ev.entryOpensAt && nowMs < ev.entryClosesAt;
}

/* ------------------------------------------------------------------ the Arena */

export { ARENA_MIN_ENTRANTS };

/** Points for a duel win: 2, or 4 once the player has already won 2 in a row (until the streak breaks). */
export function arenaWinPoints(streakBefore: number): number {
  return streakBefore >= 2 ? 4 : 2;
}

export interface ArenaPlayer {
  userId: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  /** Duel wins in a row now. */
  streak: number;
  bestStreak: number;
  played: number;
  /** The sum of the player's game scores (a tie-break). */
  scoreTotal: number;
  /** When the player last won (a tie-break: earlier first), ms or null. */
  lastWinAt: number | null;
}

export function freshArenaPlayer(userId: string): ArenaPlayer {
  return { userId, points: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, played: 0, scoreTotal: 0, lastWinAt: null };
}

/**
 * One duel's result for one player: a win adds arenaWinPoints(streak) and extends the streak; a loss or a draw adds
 * nothing and breaks it. (The database's tournament_arena_settle does exactly this; tournaments-check compares.)
 */
export function applyArenaResult(p: ArenaPlayer, result: "win" | "loss" | "draw", score: number, atMs: number): { player: ArenaPlayer; points: number } {
  if (result === "win") {
    const points = arenaWinPoints(p.streak);
    const streak = p.streak + 1;
    return {
      points,
      player: { ...p, points: p.points + points, wins: p.wins + 1, streak, bestStreak: Math.max(p.bestStreak, streak), played: p.played + 1, scoreTotal: p.scoreTotal + score, lastWinAt: atMs },
    };
  }
  return {
    points: 0,
    player: {
      ...p,
      losses: p.losses + (result === "loss" ? 1 : 0),
      draws: p.draws + (result === "draw" ? 1 : 0),
      streak: 0,
      played: p.played + 1,
      scoreTotal: p.scoreTotal + score,
    },
  };
}

/** The Arena's order: points, then wins, then the game scores' sum, then who got there first, then the id. */
export function compareArena(a: ArenaPlayer, b: ArenaPlayer): number {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    b.scoreTotal - a.scoreTotal ||
    (a.lastWinAt ?? Number.MAX_SAFE_INTEGER) - (b.lastWinAt ?? Number.MAX_SAFE_INTEGER) ||
    (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
}

/** The Arena's standings with places 1, 2, 3… (only players who played a duel are ranked). */
export function arenaStandings<T extends ArenaPlayer>(players: readonly T[]): (T & { place: number })[] {
  return players
    .filter((p) => p.played > 0)
    .slice()
    .sort(compareArena)
    .map((p, i) => ({ ...p, place: i + 1 }));
}

/** Arena Ace: 8 duel wins in a row in one Arena. */
export const ARENA_ACE_STREAK = 8;

/** Serial Winner: 10 tournament wins. */
export const SERIAL_WINNER_WINS = 10;

/* ------------------------------------------------------------------ Score Attack */

export interface ScoreAttackEntry {
  userId: string;
  total: number;
  /** The room tie-break's time (less is better). */
  tieMs: number;
  /** When the attempt finished (ms; the close for one that never finished). */
  finishedAt: number;
}

/** Highest total, then the faster total time, then who finished first, then the id. Distinct places 1, 2, 3… */
export function scoreAttackStandings<T extends ScoreAttackEntry>(entries: readonly T[]): (T & { place: number })[] {
  return entries
    .slice()
    .sort((a, b) => b.total - a.total || a.tieMs - b.tieMs || a.finishedAt - b.finishedAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
    .map((e, i) => ({ ...e, place: i + 1 }));
}

/* ------------------------------------------------------------------ prizes and trophies */

export type Medal = "gold" | "silver" | "bronze";

export interface PrizeLine {
  from: number;
  to: number;
  coins: number;
  trophy: Medal | null;
  minEntrants: number;
}

export const MEDAL_OF: Readonly<Record<number, Medal>> = { 1: "gold", 2: "silver", 3: "bronze" };

/** The prize table of a kind (fixed by Joulz). */
export function prizeLines(kind: TournamentKind): PrizeLine[] {
  const table: readonly { from: number; to: number; coins: number; minEntrants: number }[] = TOURNAMENT_PRIZES[kind];
  return table.map((l) => ({ ...l, trophy: l.from === l.to ? (MEDAL_OF[l.from] ?? null) : null }));
}

/**
 * What a place earns with this many entrants: its coins and trophy, or null (no prize for the place, or the field is
 * too small for it: the safeguard). Trophies follow the same rule as the coins.
 */
export function prizeFor(kind: TournamentKind, place: number, entrants: number): { coins: number; trophy: Medal | null } | null {
  if (!Number.isInteger(place) || place < 1) return null;
  const line = prizeLines(kind).find((l) => place >= l.from && place <= l.to);
  if (!line || entrants < line.minEntrants) return null;
  return { coins: line.coins, trophy: MEDAL_OF[place] ?? null };
}

/** "1st", "2nd", "4th–10th". */
export function placeLabel(from: number, to: number): string {
  const ord = (n: number) => {
    const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
    return `${n}${s}`;
  };
  return from === to ? ord(from) : `${ord(from)}–${ord(to)}`;
}

/** The Arena minimum, for screens. */
export const arenaMinEntrants = () => ARENA_MIN_ENTRANTS;
