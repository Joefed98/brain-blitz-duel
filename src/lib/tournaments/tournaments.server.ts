/**
 * Tournaments' server flow (wave 4, W4b; docs/tournaments/interface.md, docs/tournaments/README.md): events from the
 * schedule, entry (free, coins, tickets) and refunds, the Arena (queue, pairing by rating, best-of-3 duels on W3b's
 * room engine, settling, the live board), the daily Score Attack (an async room on the Daily's engine), finishing,
 * prizes, trophies, badges, Joules and reminders. Server only; the phone reaches it through tournaments.functions.ts.
 *
 * Tournaments never change ratings: an Arena duel is an ordinary room made by `createDealtMatchRoom`, never a row of
 * rated_matches, and nothing here calls W3a's recordRatedMatch (tournaments-check proves both). Nothing here deals
 * differently, grades, scores or stamps: every round is the rooms' (or the Daily's async rooms') own grading.
 */
import { ARENA_MIN_ENTRANTS, SCORE_ATTACK_ROUNDS } from "@/config/tournamentConfig";
import { asJson, type Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  arenaJoinRpc,
  arenaLeaveRpc,
  arenaPairRpc,
  arenaSetRoomRpc,
  arenaSettleRpc,
  arenaVoidRpc,
  cancelEventRpc,
  ensureEventRow,
  enterRpc,
  finishRpc,
  markReminded,
  payPrizeRpc,
  readArenaDuel,
  readArenaDuelByRoom,
  readArenaDuels,
  readArenaPlayers,
  readArenaQueue,
  readEntry,
  readEvent,
  readEvents,
  readGoldCount,
  readMyEntries,
  readMyOpenDuels,
  readMyPrizes,
  readMyResults,
  readOpenEvents,
  readPendingReminders,
  readReminder,
  readResults,
  readTrophies,
  remindRpc,
  setEventRoom,
  setEventStatus,
  type ArenaDuelRow,
  type ArenaPlayerRow,
  type TournamentEntryRow,
  type TournamentEventRow,
} from "@/lib/data/tournaments.server";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { pickLabel, isRoomPick } from "@/lib/duel/roomSettings";

import {
  ARENA_ACE_STREAK,
  arenaStandings,
  entryCoins,
  entryOpen,
  entryOptionsFor,
  isEntryType,
  isTournamentKind,
  KIND_LABEL,
  placeLabel,
  prizeFor,
  prizeLines,
  scheduleBetween,
  scheduledEvent,
  scoreAttackStandings,
  SERIAL_WINNER_WINS,
  TICKET_KIND,
  TOURNAMENT_SWITCHES,
  tournamentsOpenFor,
  type ArenaPlayer,
  type Medal,
  type ScheduledEvent,
  type TournamentKind,
  type TournamentSwitches,
} from "./rules";
import type {
  ArenaBoard,
  ArenaBoardRow,
  ArenaDuelView,
  ArenaPoll,
  EnterOutcome,
  EnterRefusal,
  EntryOption,
  EntryView,
  EventStatus,
  ScoreAttackBoard,
  TournamentEventView,
  TournamentHub,
  TrophyView,
} from "./types";

/* ------------------------------------------------------------------ constants */

/** The Arena's duels: W3b's 1v1 best of 3 on Mixed (the rated launch format), never rated. */
export const ARENA_FORMAT = "bo3" as const;
export const ARENA_CHOICE = "mixed" as const;
/** Searching this long, an Arena entrant pairs with the nearest rating however far. */
export const ARENA_ANY_PARTNER_MS = 12_000;
/** Searching this long, an Arena entrant may meet the opponent they just played. */
export const ARENA_SAME_OPPONENT_MS = 20_000;
/** A duel still playing this long after the Arena's window closed is void (no points). */
export const ARENA_LATE_DUEL_MS = 30 * 60_000;
/** Reminders: an Arena 10 minutes before it starts; a Score Attack at noon UK on its day. */
export const ARENA_REMIND_LEAD_MS = 10 * 60_000;
export const SCORE_ATTACK_REMIND_AFTER_MS = 12 * 3_600_000;

export const TOURNAMENT_ENTER_LIMIT = { bucket: "tournament-enter", max: 30, windowSeconds: 600 } as const;
export const TOURNAMENT_POLL_LIMIT = { bucket: "tournament-poll", max: 1200, windowSeconds: 600 } as const;

const iso = (ms: number) => new Date(ms).toISOString();
const msOf = (stamp: string | null | undefined) => (stamp ? Date.parse(stamp) : Number.NaN);

/* ------------------------------------------------------------------ who */

async function accountName(client: Db, userId: string): Promise<string | null> {
  const { accountNameOf } = await import("@/lib/names/playerName.server");
  return accountNameOf(client, userId);
}

async function isTester(client: Db, userId: string): Promise<boolean> {
  const { readIsRatedTester } = await import("@/lib/data/rated.server");
  try {
    const { data } = await readIsRatedTester(client, userId);
    return data === true;
  } catch {
    return false;
  }
}

async function openTo(client: Db, userId: string, switches: TournamentSwitches): Promise<boolean> {
  if (switches.forEveryone) return true;
  return tournamentsOpenFor(await isTester(client, userId), switches);
}

/* ------------------------------------------------------------------ events */

/** The stored row of a scheduled event, made now if it isn't stored yet (null: not a scheduled event). */
export async function ensureEvent(client: Db, id: string, switches: TournamentSwitches = TOURNAMENT_SWITCHES): Promise<TournamentEventRow | null> {
  const existing = await readEvent(client, id);
  if (existing.data) return existing.data;
  const ev = scheduledEvent(id, switches);
  if (!ev) return null;
  const { error } = await ensureEventRow(client, ev);
  if (error) throw new Error(`tournaments: ${error.message}`);
  return (await readEvent(client, id)).data ?? null;
}

function scheduleOf(row: Pick<TournamentEventRow, "id">, switches: TournamentSwitches): ScheduledEvent | null {
  return scheduledEvent(row.id, { ...switches, kinds: { ...switches.kinds, arena: true, score_attack: true } });
}

/** The next Arena after `afterMs` (for a called-off one's kind word). */
export function nextArenaAfter(afterMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): number | null {
  return scheduleBetween(afterMs + 1, afterMs + 3 * 86_400_000, switches).find((e) => e.kind === "arena")?.startsAt ?? null;
}

/**
 * Moves an event on by the clock: an Arena starts (live) with 4+ entrants or is called off and refunded; a Score
 * Attack goes live at its start; an ended event is finished and paid. Safe to call from anywhere, any number of times.
 */
export async function advanceEvent(client: Db, row: TournamentEventRow, nowMs: number): Promise<TournamentEventRow> {
  let current = row;
  const startsAt = msOf(current.starts_at);
  const endsAt = msOf(current.ends_at);
  if (current.status === "scheduled" && nowMs >= startsAt) {
    if (current.kind === "arena" && current.entrants < ARENA_MIN_ENTRANTS) {
      await cancelEvent(client, current.id, "too_few");
    } else {
      await setEventStatus(client, current.id, ["scheduled"], "live");
    }
    current = (await readEvent(client, current.id)).data ?? current;
  }
  if (current.status === "live" && nowMs >= endsAt) {
    if (current.kind === "arena") await finishArena(client, current, nowMs);
    else if (current.kind === "score_attack") await finishScoreAttack(client, current, nowMs);
    current = (await readEvent(client, current.id)).data ?? current;
  }
  return current;
}

/** Calls an event off and refunds every entry in full (coins and tickets). */
export async function cancelEvent(client: Db, eventId: string, reason: string): Promise<number> {
  const { data, error } = await cancelEventRpc(client, eventId, reason);
  if (error) throw new Error(`tournaments: ${error.message}`);
  return data?.refunded ?? 0;
}

function statusOf(value: string): EventStatus {
  return value === "live" || value === "finished" || value === "cancelled" ? value : "scheduled";
}

/** The phone's view of an event for a caller. */
async function eventView(
  client: Db,
  input: { ev: ScheduledEvent; row: TournamentEventRow | null; userId: string; account: boolean; nowMs: number; switches: TournamentSwitches },
  wallet?: { balance: number; tickets: Record<string, number> } | null,
): Promise<TournamentEventView> {
  const { ev, row, userId, nowMs } = input;
  const status: EventStatus = row ? statusOf(row.status) : "scheduled";
  const mineRow = row && input.account ? (await readEntry(client, ev.id, userId)).data : null;
  const reminded = row && input.account ? (await readReminder(client, ev.id, userId)).data === true : false;
  const options: EntryOption[] = entryOptionsFor(ev.kind, input.switches).map((entry) => {
    const coins = entry === "coins" ? entryCoins(ev.kind) : 0;
    const ticket = TICKET_KIND[entry];
    const held = ticket ? (wallet?.tickets[ticket] ?? 0) : null;
    const affordable = entry === "free" ? true : entry === "coins" ? (wallet?.balance ?? 0) >= coins : (held ?? 0) > 0;
    return { entry, coins, affordable, held };
  });
  const open = status !== "finished" && status !== "cancelled" && entryOpen(ev, nowMs);
  return {
    id: ev.id,
    kind: ev.kind,
    title: row?.title ?? ev.title,
    pick: ev.pick,
    pickLabel: ev.pick === "mixed" ? "Mixed" : isRoomPick(ev.pick) ? pickLabel(ev.pick) : ev.pick,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    entryOpensAt: ev.entryOpensAt,
    entryClosesAt: ev.entryClosesAt,
    status,
    entrants: row?.entrants ?? 0,
    entryOpen: open,
    entryOptions: options,
    prizes: prizeLines(ev.kind),
    mine: mineRow ? entryViewOf(mineRow, ev, row, null, 0) : null,
    reminded,
    rulesDraft: true,
    cancelledNext: status === "cancelled" && ev.kind === "arena" ? nextArenaAfter(ev.startsAt, input.switches) : null,
    cancelReason: row?.cancel_reason ?? null,
    rounds: ev.kind === "score_attack" ? SCORE_ATTACK_ROUNDS : null,
  };
}

function entryViewOf(
  entry: TournamentEntryRow,
  ev: ScheduledEvent,
  row: TournamentEventRow | null,
  place: number | null,
  prizeCoins: number,
): EntryView {
  return {
    eventId: entry.event_id,
    kind: ev.kind,
    title: row?.title ?? ev.title,
    startsAt: ev.startsAt,
    entry: isEntryType(entry.entry) ? entry.entry : "free",
    coins: entry.coins,
    enteredAt: msOf(entry.entered_at),
    refunded: entry.refunded_at !== null,
    status: row ? statusOf(row.status) : "scheduled",
    place,
    prizeCoins,
  };
}

async function walletSummary(client: Db, userId: string): Promise<{ balance: number; tickets: Record<string, number> } | null> {
  const { walletFor } = await import("@/lib/economy/economy.server");
  const wallet = await walletFor(client, userId);
  if (!wallet.account) return null;
  return { balance: wallet.balance ?? 0, tickets: { ...(wallet.consumables ?? {}) } as Record<string, number> };
}

/** One event for the caller (made from the schedule when needed, moved on by the clock first). */
export async function eventFor(
  client: Db,
  userId: string,
  eventId: string,
  nowMs: number,
  switches: TournamentSwitches = TOURNAMENT_SWITCHES,
): Promise<TournamentEventView | null> {
  const parts = scheduledEvent(eventId, switches);
  if (!parts) return null;
  const name = await accountName(client, userId);
  const account = name !== null;
  if (!(await openTo(client, userId, switches))) return null;
  let row = await ensureEvent(client, eventId, switches);
  if (row) row = await advanceEvent(client, row, nowMs);
  const wallet = account ? await walletSummary(client, userId) : null;
  return eventView(client, { ev: parts, row, userId, account, nowMs, switches }, wallet);
}

/** The hub: live events, the next one, the week, the caller's entries and trophies. */
export async function tournamentHub(
  client: Db,
  userId: string,
  nowMs: number,
  switches: TournamentSwitches = TOURNAMENT_SWITCHES,
): Promise<TournamentHub> {
  const account = (await accountName(client, userId)) !== null;
  const open = await openTo(client, userId, switches);
  const empty: TournamentHub = { open, account, now: nowMs, live: [], next: null, week: [], entries: [], trophies: [] };
  if (!open) return empty;
  // The week from the schedule; the live ones and those starting within a day are stored (and moved on) now.
  const schedule = scheduleBetween(nowMs - 2 * 86_400_000, nowMs + 7 * 86_400_000, switches).filter((e) => e.endsAt > nowMs);
  const stored = new Map((await readEvents(client, schedule.map((e) => e.id))).data.map((r) => [r.id, r]));
  for (const ev of schedule) {
    if (ev.startsAt > nowMs + 86_400_000) continue;
    let row = stored.get(ev.id) ?? (await ensureEvent(client, ev.id, switches));
    if (row) row = await advanceEvent(client, row, nowMs);
    if (row) stored.set(ev.id, row);
  }
  const wallet = account ? await walletSummary(client, userId) : null;
  const week: TournamentEventView[] = [];
  for (const ev of schedule) week.push(await eventView(client, { ev, row: stored.get(ev.id) ?? null, userId, account, nowMs, switches }, wallet));
  const live = week.filter((e) => e.status === "live" || (e.status === "scheduled" && e.startsAt <= nowMs && nowMs < e.endsAt));
  const next = week.find((e) => e.startsAt > nowMs && e.status !== "cancelled") ?? null;
  return {
    open,
    account,
    now: nowMs,
    live,
    next,
    week,
    entries: account ? await myEntries(client, userId, switches) : [],
    trophies: account ? await trophiesFor(client, userId) : [],
  };
}

/** The caller's entries, newest first, with their places and prizes once finished. */
export async function myEntries(client: Db, userId: string, switches: TournamentSwitches = TOURNAMENT_SWITCHES): Promise<EntryView[]> {
  const { data: entries } = await readMyEntries(client, userId);
  const ids = entries.map((e) => e.event_id);
  const [events, results, prizes] = await Promise.all([readEvents(client, ids), readMyResults(client, userId, ids), readMyPrizes(client, userId, ids)]);
  const rows = new Map(events.data.map((r) => [r.id, r]));
  const places = new Map(results.data.map((r) => [r.event_id, r.place]));
  const paid = new Map(prizes.data.map((p) => [p.event_id, p.coins]));
  const out: EntryView[] = [];
  for (const entry of entries) {
    const ev = scheduleOf({ id: entry.event_id }, switches);
    if (!ev) continue;
    out.push(entryViewOf(entry, ev, rows.get(entry.event_id) ?? null, places.get(entry.event_id) ?? null, paid.get(entry.event_id) ?? 0));
  }
  return out;
}

export async function trophiesFor(client: Db, userId: string): Promise<TrophyView[]> {
  const { data } = await readTrophies(client, userId);
  return data
    .filter((t) => isTournamentKind(t.kind) && (t.medal === "gold" || t.medal === "silver" || t.medal === "bronze"))
    .map((t) => ({
      eventId: t.event_id,
      kind: t.kind as TournamentKind,
      medal: t.medal as Medal,
      title: t.title,
      place: t.place,
      awardedAt: msOf(t.awarded_at),
    }));
}

/* ------------------------------------------------------------------ entry */

const REFUSAL_MESSAGE: Readonly<Record<string, string>> = {
  account: "Tournaments need an account.",
  not_open: "Tournaments aren’t open yet.",
  kind_off: "That tournament isn’t running.",
  closed: "Entry for this one has closed.",
  bad_entry: "That isn’t a way into this one.",
  insufficient: "Not enough coins for this entry.",
  no_ticket: "You don’t have that ticket.",
  banned: "You can’t enter tournaments right now.",
  rate_limit: "That’s a lot of tries. Give it a few minutes.",
};

function refusal(reason: EnterRefusal): EnterOutcome {
  return { ok: false, reason, message: REFUSAL_MESSAGE[reason] ?? "Couldn’t enter. Give it another go." };
}

/** Enters the caller once: free, coins (spent through the ledger) or a ticket, checked on the server whatever is sent. */
export async function enterEvent(
  client: Db,
  userId: string,
  input: { eventId: unknown; entry: unknown },
  nowMs: number,
  switches: TournamentSwitches = TOURNAMENT_SWITCHES,
): Promise<EnterOutcome> {
  if ((await accountName(client, userId)) === null) return refusal("account");
  if (!(await openTo(client, userId, switches))) return refusal("not_open");
  const eventId = String(input.eventId ?? "");
  const ev = scheduledEvent(eventId, switches);
  if (!ev) return refusal("kind_off");
  if (!isEntryType(input.entry) || !entryOptionsFor(ev.kind, switches).includes(input.entry)) return refusal("bad_entry");
  const entry = input.entry;
  const { roomRefusal } = await import("@/lib/safety/moderation.server");
  if (await roomRefusal(client, userId)) return refusal("banned");
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  if (!(await withinRateLimit(client, userId, TOURNAMENT_ENTER_LIMIT))) return refusal("rate_limit");
  let row = await ensureEvent(client, eventId, switches);
  if (!row) return refusal("kind_off");
  row = await advanceEvent(client, row, nowMs);
  if (row.status === "finished" || row.status === "cancelled" || !entryOpen(ev, nowMs)) return refusal("closed");
  const coins = entry === "coins" ? entryCoins(ev.kind) : 0;
  const { data, error } = await enterRpc(client, { eventId, userId, entry, coins });
  if (error || !data) throw new Error(`tournaments: ${error?.message ?? "no answer"}`);
  if (data.status === "insufficient") return refusal("insufficient");
  if (data.status === "no_ticket") return refusal("no_ticket");
  if (data.status === "closed") return refusal("closed");
  if (data.status === "no_account") return refusal("account");
  if (data.status === "bad_entry") return refusal("bad_entry");
  const stored = (await readEntry(client, eventId, userId)).data;
  if (!stored) throw new Error("tournaments: the entry wasn’t stored");
  if (data.status === "entered") {
    recordEvents({ event: "tournament_entered", playerId: userId, props: { kind: ev.kind, entry } });
    if (entry === "coins") recordEvents({ event: "coins_spent", playerId: userId, props: { reason: "tournament_entry", amount: coins } });
  }
  return { ok: true, entry: entryViewOf(stored, ev, row, null, 0) };
}

/** Asks for (or drops) a reminder for an event. An entry is always reminded. */
export async function setReminder(client: Db, userId: string, eventId: unknown, on: unknown, nowMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): Promise<{ ok: boolean; reminded: boolean }> {
  if ((await accountName(client, userId)) === null) return { ok: false, reminded: false };
  if (!(await openTo(client, userId, switches))) return { ok: false, reminded: false };
  const row = await ensureEvent(client, String(eventId ?? ""), switches);
  if (!row || row.status === "finished" || row.status === "cancelled" || nowMs >= msOf(row.ends_at)) return { ok: false, reminded: false };
  const { data, error } = await remindRpc(client, row.id, userId, on === true);
  if (error) throw new Error(`tournaments: ${error.message}`);
  return { ok: true, reminded: data };
}

/* ------------------------------------------------------------------ the Arena */

function arenaPlayerOf(row: ArenaPlayerRow): ArenaPlayer {
  return {
    userId: row.user_id,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    streak: row.streak,
    bestStreak: row.best_streak,
    played: row.played,
    scoreTotal: row.score_total,
    lastWinAt: row.last_win_at ? msOf(row.last_win_at) : null,
  };
}

/** The rating an Arena pairs by: W3a's (through W3b's adapter) for the Arena's format, else the starting rating. */
async function arenaRating(userId: string): Promise<number> {
  const { ratings } = await import("@/lib/rated/ratingsAdapter.server");
  try {
    const r = await ratings().matchRating(userId, { format: ARENA_FORMAT, choice: ARENA_CHOICE });
    if (r && Number.isFinite(r.rating)) return Math.round(r.rating);
  } catch {
    // no ratings bound: everyone starts level
  }
  return ratings().startingRating;
}

interface Searcher {
  userId: string;
  rating: number;
  joinedAtMs: number;
  lastOpponent: string | null;
}

/**
 * The Arena's partner for `me`: W3b's pairing (`bestPartner`: the nearest rating within the widening band, then the
 * longest wait) among the other searchers; from ARENA_ANY_PARTNER_MS the nearest rating however far. The opponent
 * just played is passed over while anyone else waits, until ARENA_SAME_OPPONENT_MS. Pure.
 */
export async function arenaPartner(me: Searcher, waiting: readonly Searcher[], nowMs: number): Promise<Searcher | null> {
  const { bestPartner } = await import("@/lib/rated/matchmaking");
  const asEntry = (s: Searcher) => ({ userId: s.userId, format: ARENA_FORMAT, choice: ARENA_CHOICE, rating: s.rating, joinedAtMs: s.joinedAtMs, placement: false });
  const others = waiting.filter((s) => s.userId !== me.userId);
  const longWait = (s: Searcher) => nowMs - Math.min(s.joinedAtMs, me.joinedAtMs) >= ARENA_SAME_OPPONENT_MS;
  const fresh = others.filter((s) => (s.userId !== me.lastOpponent && s.lastOpponent !== me.userId) || longWait(s));
  const pool = fresh.length ? fresh : [];
  const banded = bestPartner(asEntry(me), pool.map(asEntry), nowMs);
  if (banded) return pool.find((s) => s.userId === banded.userId) ?? null;
  if (nowMs - me.joinedAtMs < ARENA_ANY_PARTNER_MS) return null;
  let best: Searcher | null = null;
  for (const s of pool) {
    if (!best) best = s;
    else {
      const d = Math.abs(s.rating - me.rating) - Math.abs(best.rating - me.rating);
      if (d < 0 || (d === 0 && (s.joinedAtMs < best.joinedAtMs || (s.joinedAtMs === best.joinedAtMs && s.userId < best.userId)))) best = s;
    }
  }
  return best;
}

async function duelView(client: Db, duel: ArenaDuelRow, userId: string): Promise<ArenaDuelView> {
  const other = duel.a_user === userId ? duel.b_user : duel.a_user;
  let code: string | null = null;
  if (duel.duel_id) {
    const { readRoom } = await import("@/lib/data/rooms.server");
    code = (await readRoom(client, duel.duel_id)).data?.room_code ?? null;
  }
  return {
    duelId: duel.id,
    roomCode: code,
    opponent: { userId: other, name: (await accountName(client, other)) ?? "Player" },
    status: duel.status === "settled" || duel.status === "void" ? duel.status : "playing",
  };
}

/** Settles a finished duel once (2 points a win, doubled on a streak of 2+), credits its Joules, checks Arena Ace. */
export async function settleArenaDuel(client: Db, duel: ArenaDuelRow, nowMs: number, opts: { voidUnfinished?: boolean } = {}): Promise<"settled" | "playing" | "void"> {
  if (duel.status !== "playing") return duel.status === "void" ? "void" : "settled";
  if (!duel.duel_id) {
    if (opts.voidUnfinished || nowMs - msOf(duel.created_at) > 60_000) {
      await arenaVoidRpc(client, duel.id);
      return "void";
    }
    return "playing";
  }
  const { readRoom, readPrivatePuzzles } = await import("@/lib/data/rooms.server");
  const { data: room } = await readRoom(client, duel.duel_id);
  if (!room) {
    await arenaVoidRpc(client, duel.id);
    return "void";
  }
  const { roomFinishedAtMs } = await import("@/lib/rated/rated.server");
  if (roomFinishedAtMs(room) === null) {
    if (opts.voidUnfinished) {
      await arenaVoidRpc(client, duel.id);
      return "void";
    }
    return "playing";
  }
  const { readRoomResults } = await import("@/lib/data/results.server");
  const { data: results } = await readRoomResults(client, room.id);
  const { data: priv } = await readPrivatePuzzles(client, room.id);
  const { mergePuzzle } = await import("@/lib/duel/secrets");
  const pubs = Array.isArray(room.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
  const puzzles = pubs.map((p, i) => mergePuzzle(p, priv?.[i]));
  const games = arenaGames(puzzles, results ?? []);
  const { matchOutcome } = await import("@/lib/rated/matchmaking");
  const outcome = matchOutcome(games);
  const { data, error } = await arenaSettleRpc(client, {
    duelId: duel.id,
    winner: outcome.winner,
    aScore: outcome.totalA,
    bScore: outcome.totalB,
    games: asJson(games),
  });
  if (error || !data) throw new Error(`tournaments: ${error?.message ?? "no answer"}`);
  if (data.status === "settled") {
    const { creditTournamentJoules } = await import("@/lib/pass/pass.server");
    for (const user of [duel.a_user, duel.b_user]) {
      try {
        await creditTournamentJoules(client, { userId: user, eventId: `arena:${duel.event_id}:${duel.id}`, kind: "arena_duel", atMs: nowMs });
      } catch (err) {
        console.error("[tournaments] arena Joules", err instanceof Error ? err.message : err);
      }
    }
    const streaks: [string, number | undefined][] = [
      [duel.a_user, data.a_streak],
      [duel.b_user, data.b_streak],
    ];
    for (const [user, streak] of streaks) if ((streak ?? 0) >= ARENA_ACE_STREAK) await award(client, user, "arena-ace", { event: duel.event_id });
  }
  return "settled";
}

/** Each game's scores and times on slot 1 (a) and slot 2 (b), as W3b's buildMatchResult reads them. */
export function arenaGames(puzzles: readonly PuzzleData[], results: readonly RoundResultRow[]): { a: number; b: number; aTimeMs: number; bTimeMs: number }[] {
  return puzzles.map((puzzle, i) => {
    const ra = results.find((r) => r.player_slot === 1 && r.round_number === i + 1);
    const rb = results.find((r) => r.player_slot === 2 && r.round_number === i + 1);
    return { a: ra?.score ?? 0, b: rb?.score ?? 0, aTimeMs: timeUsed(ra, puzzle), bTimeMs: timeUsed(rb, puzzle) };
  });
}

let timeUsedFn: ((row: RoundResultRow | undefined, puzzle: PuzzleData) => number) | null = null;
function timeUsed(row: RoundResultRow | undefined, puzzle: PuzzleData): number {
  if (!timeUsedFn) throw new Error("tournaments: time helper not loaded");
  return timeUsedFn(row, puzzle);
}
/** Loads the room tie-break's time helper (kept lazy: the scoring module is server-heavy). */
export async function loadTimeHelper(): Promise<void> {
  if (timeUsedFn) return;
  const { roundTimeUsedMs } = await import("@/lib/duel/scoring");
  const { tieRoundFor } = await import("@/lib/duel/tieBreak");
  timeUsedFn = (row, puzzle) => roundTimeUsedMs(row, tieRoundFor(puzzle));
}

/** Settles the caller's finished duels in an event (an Arena poll runs it first). */
async function settleMine(client: Db, eventId: string, userId: string, nowMs: number): Promise<ArenaDuelRow[]> {
  await loadTimeHelper();
  const { data: open } = await readMyOpenDuels(client, eventId, userId);
  const still: ArenaDuelRow[] = [];
  for (const duel of open) if ((await settleArenaDuel(client, duel, nowMs)) === "playing") still.push(duel);
  return still;
}

/** Ready for the next duel: joins the Arena's queue (entrants of a live Arena only). */
export async function arenaReady(client: Db, userId: string, eventId: unknown, nowMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): Promise<ArenaPoll> {
  const id = String(eventId ?? "");
  let row = await ensureEvent(client, id, switches);
  if (!row || row.kind !== "arena") return { state: "closed", message: "That Arena isn’t running." };
  if (!(await openTo(client, userId, switches))) return { state: "closed", message: "Tournaments aren’t open yet." };
  row = await advanceEvent(client, row, nowMs);
  if (row.status !== "live" || nowMs >= msOf(row.ends_at)) return { state: "closed", message: closedMessage(row) };
  const { roomRefusal } = await import("@/lib/safety/moderation.server");
  const banned = await roomRefusal(client, userId);
  if (banned) return { state: "closed", message: banned };
  const playing = await settleMine(client, id, userId, nowMs);
  if (playing[0]) return { state: "duel", duel: await duelView(client, playing[0], userId) };
  const { data: answer, error } = await arenaJoinRpc(client, id, userId, await arenaRating(userId));
  if (error) throw new Error(`tournaments: ${error.message}`);
  if (answer === "not_entered") return { state: "closed", message: "Enter this Arena first." };
  if (answer === "not_live") return { state: "closed", message: closedMessage(row) };
  return arenaPoll(client, userId, id, nowMs, switches);
}

function closedMessage(row: TournamentEventRow): string {
  if (row.status === "cancelled") return "This Arena was called off: not enough players this time.";
  if (row.status === "scheduled") return "This Arena hasn’t started yet.";
  return "This Arena’s window has closed.";
}

/** One poll: the caller's duel if they have one, else an attempt to pair them. */
export async function arenaPoll(client: Db, userId: string, eventId: unknown, nowMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): Promise<ArenaPoll> {
  const id = String(eventId ?? "");
  const row = (await readEvent(client, id)).data;
  if (!row || row.kind !== "arena") return { state: "closed", message: "That Arena isn’t running." };
  const current = await advanceEvent(client, row, nowMs);
  const playing = await settleMine(client, id, userId, nowMs);
  if (playing[0]) return { state: "duel", duel: await duelView(client, playing[0], userId) };
  if (current.status !== "live" || nowMs >= msOf(current.ends_at)) {
    await arenaLeaveRpc(client, id, userId);
    return { state: "closed", message: closedMessage(current) };
  }
  const { data: queue } = await readArenaQueue(client, id);
  const mine = queue.find((q) => q.user_id === userId);
  if (!mine) return { state: "idle" };
  const searchers: Searcher[] = queue.map((q) => ({ userId: q.user_id, rating: q.rating, joinedAtMs: msOf(q.joined_at), lastOpponent: q.last_opponent }));
  const me = searchers.find((s) => s.userId === userId)!;
  const partner = await arenaPartner(me, searchers, nowMs);
  if (!partner) return { state: "searching", waitedMs: Math.max(0, nowMs - me.joinedAtMs) };
  const duelId = crypto.randomUUID();
  // The longer waiter is slot 1 (a).
  const [a, b] = partner.joinedAtMs <= me.joinedAtMs ? [partner.userId, me.userId] : [me.userId, partner.userId];
  const { data: paired } = await arenaPairRpc(client, id, a, b, duelId);
  if (!paired) return { state: "searching", waitedMs: Math.max(0, nowMs - me.joinedAtMs) };
  try {
    const { createDealtMatchRoom } = await import("@/lib/rated/rated.server");
    const room = await createDealtMatchRoom(client, { format: ARENA_FORMAT, choice: ARENA_CHOICE, userIds: [a, b] }, nowMs);
    await arenaSetRoomRpc(client, duelId, room.id);
  } catch (err) {
    await arenaVoidRpc(client, duelId);
    console.error("[tournaments] arena room", err instanceof Error ? err.message : err);
    return { state: "searching", waitedMs: 0 };
  }
  const duel = (await readArenaDuel(client, duelId)).data;
  return duel ? { state: "duel", duel: await duelView(client, duel, userId) } : { state: "idle" };
}

export async function arenaLeave(client: Db, userId: string, eventId: unknown): Promise<void> {
  await arenaLeaveRpc(client, String(eventId ?? ""), userId);
}

/** The live leaderboard (every entrant who has played), the caller's row pinned. */
export async function arenaBoard(client: Db, userId: string, eventId: unknown, nowMs: number): Promise<ArenaBoard | null> {
  const id = String(eventId ?? "");
  const row = (await readEvent(client, id)).data;
  if (!row || row.kind !== "arena") return null;
  const current = await advanceEvent(client, row, nowMs);
  const { data: players } = await readArenaPlayers(client, id);
  const ranked = arenaStandings(players.map(arenaPlayerOf));
  const names = await Promise.all(ranked.slice(0, 50).map((p) => accountName(client, p.userId)));
  const rowOf = (p: ArenaPlayer & { place: number }, name: string | null): ArenaBoardRow => ({
    place: p.place,
    userId: p.userId,
    name: name ?? "Player",
    points: p.points,
    wins: p.wins,
    streak: p.streak,
    played: p.played,
    isMe: p.userId === userId,
  });
  const rows = ranked.slice(0, 50).map((p, i) => rowOf(p, names[i] ?? null));
  const mine = ranked.find((p) => p.userId === userId);
  return {
    eventId: id,
    endsAt: msOf(current.ends_at),
    status: statusOf(current.status),
    players: ranked.length,
    rows,
    me: mine ? rows.find((r) => r.isMe) ?? rowOf(mine, await accountName(client, userId)) : null,
  };
}

/** A room that is an Arena duel (Play again is refused there; chat follows the stranger rules). */
export async function isTournamentRoom(client: Db, roomId: string): Promise<boolean> {
  try {
    const { data } = await readArenaDuelByRoom(client, roomId);
    return data !== null && data !== undefined;
  } catch {
    return false; // a database without the tournament tables: no tournament rooms
  }
}

async function finishArena(client: Db, row: TournamentEventRow, nowMs: number): Promise<void> {
  await loadTimeHelper();
  const { data: duels } = await readArenaDuels(client, row.id);
  const late = nowMs - msOf(row.ends_at) >= ARENA_LATE_DUEL_MS;
  let open = 0;
  for (const duel of duels.filter((d) => d.status === "playing"))
    if ((await settleArenaDuel(client, duel, nowMs, { voidUnfinished: late })) === "playing") open++;
  if (open > 0) return; // duels started in the window play to their end
  const { data: players } = await readArenaPlayers(client, row.id);
  const ranked = arenaStandings(players.map(arenaPlayerOf));
  const { data: finished } = await finishRpc(
    client,
    row.id,
    ranked.map((p) => ({ user_id: p.userId, place: p.place, points: p.points, total: null, tie_ms: null })),
  );
  if (finished) {
    finishedEvents("arena", ranked);
    await payEvent(client, row.id, nowMs);
  }
}

/** tournament_finished for every ranked player, recorded by the one call that finished the event. */
function finishedEvents(kind: TournamentKind, ranked: readonly { userId: string; place: number }[]): void {
  for (const p of ranked) recordEvents({ event: "tournament_finished", playerId: p.userId, props: { kind, place: p.place } });
}

/* ------------------------------------------------------------------ Score Attack */

/** The Score Attack's async room, dealt once from the day's featured pick (the same for everyone). */
export async function scoreAttackRoom(client: Db, row: TournamentEventRow) {
  const { roomById, roomByKey, createAsyncRoom } = await import("@/lib/duel/asyncRoom.server");
  if (row.async_room_id) {
    const room = await roomById(client, row.async_room_id);
    if (room) return room;
  }
  const key = `score_attack:${row.id.split(":")[1]}`;
  let room = await roomByKey(client, key);
  if (!room) {
    const pick = isRoomPick(row.pick) ? row.pick : null;
    if (!pick) throw new Error("tournaments: a Score Attack needs a pick");
    const { newRoomSeed } = await import("@/lib/duel/selection");
    const { dealRoomRounds } = await import("@/lib/duel/roomDeal");
    const { dealRounds } = await import("@/lib/duel/generate.server");
    const seed = newRoomSeed();
    const types = dealRoomRounds({ picks: [pick], rounds: SCORE_ATTACK_ROUNDS }, { seed }).types;
    let unblockRow = null;
    if (types.includes("unblock")) {
      const { drawUnblockRow } = await import("@/lib/duel/unblock.server");
      unblockRow = await drawUnblockRow(client);
    }
    const puzzles = dealRounds(types, { seed, unblockRow });
    room = await createAsyncRoom(client, {
      kind: "score_attack",
      key,
      day: row.id.split(":")[1] ?? null,
      seed,
      puzzles,
      opensAt: msOf(row.starts_at),
      closesAt: msOf(row.ends_at),
      createdBy: null,
    });
  }
  await setEventRoom(client, row.id, room.id);
  return room;
}

/** Starts (or continues) the caller's one Score Attack attempt; entrants only, while it is live. */
export async function scoreAttackStart(
  client: Db,
  userId: string,
  eventId: unknown,
  nowMs: number,
  switches: TournamentSwitches = TOURNAMENT_SWITCHES,
): Promise<{ ok: true; roomId: string } | { ok: false; message: string }> {
  const id = String(eventId ?? "");
  let row = await ensureEvent(client, id, switches);
  if (!row || row.kind !== "score_attack") return { ok: false, message: "That Score Attack isn’t running." };
  if (!(await openTo(client, userId, switches))) return { ok: false, message: "Tournaments aren’t open yet." };
  row = await advanceEvent(client, row, nowMs);
  const entry = (await readEntry(client, id, userId)).data;
  if (!entry || entry.refunded_at) return { ok: false, message: "Enter this Score Attack first." };
  const room = await scoreAttackRoom(client, row);
  const { attemptFor, startAttempt } = await import("@/lib/duel/asyncRoom.server");
  const existing = await attemptFor(client, room.id, userId);
  if (existing) return { ok: true, roomId: room.id };
  if (row.status !== "live" || nowMs >= msOf(row.ends_at)) return { ok: false, message: "This Score Attack has closed." };
  const name = (await accountName(client, userId)) ?? "Player";
  const started = await startAttempt(client, room, userId, { name, colour: null, icon: null }, nowMs);
  if (!started.ok) return { ok: false, message: started.message };
  return { ok: true, roomId: room.id };
}

/** Score Attack standings from the room's attempts (entrants only), the room tie-break deciding level totals. */
async function scoreAttackRanking(client: Db, row: TournamentEventRow, nowMs: number) {
  const { attemptsIn, attemptView } = await import("@/lib/duel/asyncRoom.server");
  const room = await scoreAttackRoom(client, row);
  const attempts = await attemptsIn(client, room.id);
  const closed = nowMs >= msOf(row.ends_at);
  const current = [];
  for (const a of attempts) current.push(closed && !a.finished_at ? (await attemptView(client, room, a, nowMs)).attempt : a);
  const { data: entries } = await (await import("@/lib/data/tournaments.server")).readEntries(client, row.id);
  const entered = new Set(entries.filter((e) => !e.refunded_at).map((e) => e.user_id));
  const counted = current.filter((a) => entered.has(a.user_id) && (closed || a.finished_at));
  return {
    room,
    attempts: current,
    standings: scoreAttackStandings(
      counted.map((a) => ({
        userId: a.user_id,
        name: a.display_name,
        total: a.total_score,
        tieMs: Number(a.tie_ms),
        finishedAt: a.finished_at ? msOf(a.finished_at) : msOf(row.ends_at),
        finished: a.finished_at !== null,
        roundsDone: a.rounds_done,
      })),
    ),
  };
}

/** The board: open once the caller's attempt has finished or the day has closed (the Daily's rule). */
export async function scoreAttackBoard(client: Db, userId: string, eventId: unknown, nowMs: number): Promise<ScoreAttackBoard | null> {
  const id = String(eventId ?? "");
  const stored = (await readEvent(client, id)).data;
  if (!stored || stored.kind !== "score_attack") return null;
  const row = await advanceEvent(client, stored, nowMs);
  const { attempts, standings } = await scoreAttackRanking(client, row, nowMs);
  const mine = attempts.find((a) => a.user_id === userId) ?? null;
  const closed = nowMs >= msOf(row.ends_at);
  const open = closed || !!mine?.finished_at;
  const placeOf = standings.find((s) => s.userId === userId)?.place ?? null;
  return {
    eventId: id,
    open,
    count: standings.length,
    rows: open ? standings.slice(0, 50).map((s) => ({ place: s.place, name: s.name, total: s.total, isMe: s.userId === userId })) : [],
    me: mine ? { place: open ? placeOf : null, total: mine.total_score, finished: !!mine.finished_at, roundsDone: mine.rounds_done } : null,
  };
}

async function finishScoreAttack(client: Db, row: TournamentEventRow, nowMs: number): Promise<void> {
  const { attempts, standings } = await scoreAttackRanking(client, row, nowMs);
  const { data: finished } = await finishRpc(
    client,
    row.id,
    standings.map((s) => ({ user_id: s.userId, place: s.place, points: null, total: s.total, tie_ms: s.tieMs })),
  );
  // Joules for finishing a Score Attack (150), once per account and event (D2's key).
  const { creditTournamentJoules } = await import("@/lib/pass/pass.server");
  for (const a of attempts.filter((x) => x.finished_at))
    try {
      await creditTournamentJoules(client, { userId: a.user_id, eventId: row.id, kind: "finished", atMs: msOf(a.finished_at) });
    } catch (err) {
      console.error("[tournaments] score attack Joules", err instanceof Error ? err.message : err);
    }
  if (finished) {
    finishedEvents("score_attack", standings);
    await payEvent(client, row.id, nowMs);
  }
}

/* ------------------------------------------------------------------ prizes, trophies, badges */

async function award(client: Db, userId: string, slug: string, detail: Record<string, string | number | boolean>): Promise<void> {
  try {
    const { awardBadge } = await import("@/lib/badges/badges.server");
    await awardBadge(client, userId, slug, detail);
  } catch (err) {
    console.error("[tournaments] badge", slug, err instanceof Error ? err.message : err);
  }
}

/**
 * Pays a finished event: each place its fixed prize where the field is big enough (the safeguard), the trophy with
 * it, then the badges. Every step is idempotent (the prize row and ledger key, the trophy row, badge_award), so a
 * second call pays nothing more.
 */
export async function payEvent(client: Db, eventId: string, _nowMs: number): Promise<{ paid: number; coins: number }> {
  const row = (await readEvent(client, eventId)).data;
  if (!row || row.status !== "finished" || !isTournamentKind(row.kind)) return { paid: 0, coins: 0 };
  const kind = row.kind;
  const { data: results } = await readResults(client, eventId);
  let paid = 0;
  let coins = 0;
  for (const r of results) {
    const prize = prizeFor(kind, r.place, row.entrants);
    const medal = prize?.trophy ?? null;
    if (prize) {
      const { data, error } = await payPrizeRpc(client, {
        eventId,
        userId: r.user_id,
        place: r.place,
        coins: prize.coins,
        medal,
        title: medal ? `${row.title}, ${placeLabel(r.place, r.place)}` : null,
      });
      if (error) throw new Error(`tournaments: ${error.message}`);
      if (data?.coins) {
        paid++;
        coins += data.coins;
        recordEvents({ event: "prize_paid", playerId: r.user_id, props: { kind, place: r.place, coins: data.coins } });
        recordEvents({ event: "coins_credited", playerId: r.user_id, props: { reason: "tournament_prize", amount: data.coins } });
      }
    }
    await award(client, r.user_id, "entrant", { event: eventId });
    if (medal) await award(client, r.user_id, "trophy-hunter", { event: eventId });
    if (medal === "gold") {
      await award(client, r.user_id, "champion", { event: eventId });
      if (kind === "arena") await award(client, r.user_id, "arena-champion", { event: eventId });
      if (kind === "score_attack") await award(client, r.user_id, "score-attack-champion", { event: eventId });
      const { data: golds } = await readGoldCount(client, r.user_id);
      if (golds >= SERIAL_WINNER_WINS) await award(client, r.user_id, "serial-winner", { event: eventId });
    }
  }
  return { paid, coins };
}

/* ------------------------------------------------------------------ the tick (Cron Trigger, every 5 minutes) */

export interface TickRun {
  ensured: number;
  advanced: number;
  reminded: number;
}

/** When an event's reminder goes out. */
export function reminderDueAt(ev: Pick<ScheduledEvent, "kind" | "startsAt">): number {
  return ev.kind === "arena" ? ev.startsAt - ARENA_REMIND_LEAD_MS : ev.startsAt + SCORE_ATTACK_REMIND_AFTER_MS;
}

/**
 * Stores the coming day's events, moves every open event on by the clock (start, call off and refund, finish and
 * pay), and sends due reminders through B2's tournament-starting notification (once per account and event).
 */
export async function runTournamentTick(client: Db, nowMs: number, switches: TournamentSwitches = TOURNAMENT_SWITCHES): Promise<TickRun> {
  const run: TickRun = { ensured: 0, advanced: 0, reminded: 0 };
  const coming = scheduleBetween(nowMs - 86_400_000, nowMs + 86_400_000, switches);
  for (const ev of coming) if (await ensureEvent(client, ev.id, switches)) run.ensured++;
  const { data: open } = await readOpenEvents(client, iso(nowMs + 1));
  for (const row of open) {
    await advanceEvent(client, row, nowMs);
    run.advanced++;
  }
  const { notifyTournamentStarting } = await import("@/lib/push/notify.server");
  for (const ev of coming) {
    const due = reminderDueAt(ev);
    if (nowMs < due || nowMs >= ev.endsAt) continue;
    const row = (await readEvent(client, ev.id)).data;
    if (!row || row.status === "cancelled" || row.status === "finished") continue;
    const { data: users } = await readPendingReminders(client, ev.id);
    const sent: string[] = [];
    for (const user of users) {
      try {
        await notifyTournamentStarting(client, user, `${row.title} (${KIND_LABEL[ev.kind]})`, ev.id, { nowMs });
      } catch (err) {
        console.error("[tournaments] reminder", err instanceof Error ? err.message : err);
      }
      sent.push(user);
    }
    const { data: n } = await markReminded(client, ev.id, sent);
    run.reminded += n;
  }
  return run;
}

