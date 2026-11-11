/**
 * The Category Cup (Swiss) and the Joulz Championship (Knockout), server side (wave 4, W4c; docs/tournaments/events.md).
 *
 * The flow, all on the service-role client through src/lib/data/tournamentEvents.server.ts:
 * - `ensureEvent`: this week's cup / this month's Championship, made once from the fixed schedule.
 * - `enterCup` / `leaveCup`: accounts only; 150 coins or a Category Cup ticket, spent once per entry under its own
 *   key; leaving before the start (or the cup being cancelled) gives the entry back once.
 * - `tickEvent`: moves an event on, one ticker at a time (`tournament_event_lock`): the reminder, the start (too few
 *   players cancels and refunds; the Championship's qualifiers from W4b's Score Attack standings), each round's
 *   pairings or bracket, its rooms a minute after the round before, settling every match from its room, and the
 *   finish: places, prizes, trophies, badges, the frame, the hall of fame and Joules, each paid once (its own ledger
 *   key and a `tournament_payouts` row).
 * - `eventView`: what the event page shows, ticking the event on first (the phones on the page drive it).
 *
 * Every match is an ordinary room made already started (W3b's `createStartedRoom`), dealt from the room seed and
 * graded by the rooms engine; nothing here grades, scores or deals, and no tournament result is ever passed to the
 * ratings (a tournament room is never a rated match).
 */
import { CATEGORY_CUP_ENABLED, JOULZ_CHAMPIONSHIP_ENABLED } from "@/config/tournamentEventsConfig";
import { UNIQUE_VIOLATION, type Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  claimEntryStatus,
  claimEventStatus,
  claimMatchStatus,
  enterEvent,
  insertEvent,
  insertHallOfFame,
  insertMatches,
  insertPayout,
  insertQualifiers,
  insertTrophy,
  lockEvent,
  readEntries,
  readEntry,
  readEvent,
  readEventByKey,
  readHallOfFame,
  readMatches,
  readPayouts,
  unlockEvent,
  updateEntry,
  updateEvent,
  updateMatch,
  type TournamentEntryRow,
  type TournamentEventRow,
  type TournamentMatchRow,
} from "@/lib/data/tournamentEvents.server";
import { readRoom, readPrivatePuzzles } from "@/lib/data/rooms.server";
import { readRoomResults } from "@/lib/data/results.server";
import { readProfile, readPublicProfiles } from "@/lib/data/profiles.server";
import { mergePuzzle } from "@/lib/duel/secrets";
import { tieRoundFor } from "@/lib/duel/tieBreak";
import { roundTimeUsedMs } from "@/lib/duel/scoring";
import { dealRoomRounds } from "@/lib/duel/roomDeal";
import { categoriesOfPicks } from "@/lib/duel/roomSettings";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { matchOutcome, matchSettings, type GameScores, type RatedChoice } from "@/lib/rated/matchmaking";

import {
  championshipKey,
  championshipMonthFor,
  CHAMPIONSHIP_FRAME,
  CHAMPIONSHIP_MIN_QUALIFIERS,
  CHAMPIONSHIP_PRIZES,
  CHAMPIONSHIP_QUALIFIERS,
  CHAMPIONSHIP_RULES,
  CUP_ENTRY_COINS,
  CUP_MAX_ENTRANTS,
  CUP_MIN_ENTRANTS,
  CUP_PRIZES,
  CUP_RULES,
  CUP_TICKET_KIND,
  cupCategoryOn,
  cupDateFor,
  cupKey,
  cupTitle,
  EVENT_NAME,
  eventStartMs,
  FINISH_JOULES,
  lastSundayOf,
  monthLabel,
  prizeCoins,
  prizeLineText,
  REMINDER_BEFORE_MS,
  ROUND_BREAK_MS,
  swissRoundsFor,
  trophyFor,
  WINNER_BADGE,
  type EventKind,
  type TrophyCup,
} from "./eventRules";
import { pairSwissRound, pointsText, swissStandings, type SwissMatch, type SwissPlayer } from "./swiss";
import {
  bracketRounds,
  bracketSize,
  finalPlaces,
  firstRound,
  isWalkover,
  nextRound,
  playedWinner,
  roundName,
  thirdPlaceMatch,
  walkoverWinner,
  type KoMatch,
} from "./knockout";
import { tournamentPlatform } from "./platform.server";

/* ------------------------------------------------------------------ switches */

export type EventSwitches = Readonly<Record<EventKind, boolean>>;

/** Read from the config on every call: a switched-off event is refused whatever a phone sends. */
export const EVENT_SWITCHES: EventSwitches = { category_cup: CATEGORY_CUP_ENABLED, championship: JOULZ_CHAMPIONSHIP_ENABLED };

export const EVENT_OFF_MESSAGE: Record<EventKind, string> = {
  category_cup: "The Category Cup isn’t running yet.",
  championship: "The Joulz Championship isn’t running yet.",
};

/** Null when the event is on, else why it's refused. */
export function eventRefusal(kind: EventKind, switches: EventSwitches = EVENT_SWITCHES): string | null {
  return switches[kind] ? null : EVENT_OFF_MESSAGE[kind];
}

/* ------------------------------------------------------------------ timings */

/** A match room still not finished this long after it was made is settled from what is stored (a no-show scores 0). */
export const MATCH_DEADLINE_MS = 25 * 60_000;
/** The tick lock's length (a tick that dies releases it after this). */
const TICK_LOCK_MS = 30_000;

const iso = (ms: number) => new Date(ms).toISOString();
const msOf = (s: string | null | undefined) => (s ? Date.parse(s) : Number.NaN);

/* ------------------------------------------------------------------ events */

/** This week's cup or this month's Championship, made once (a second maker reads the first's row). */
export async function ensureEvent(client: Db, kind: EventKind, nowMs: number): Promise<TournamentEventRow> {
  let row: Parameters<typeof insertEvent>[1];
  if (kind === "category_cup") {
    const date = cupDateFor(nowMs);
    row = { kind, event_key: cupKey(date), category: cupCategoryOn(date), starts_at: iso(eventStartMs(date)) };
  } else {
    const month = championshipMonthFor(nowMs);
    row = { kind, event_key: championshipKey(month), category: "mixed", month, starts_at: iso(eventStartMs(lastSundayOf(month))) };
  }
  const found = await readEventByKey(client, row.event_key);
  if (found.data) return found.data;
  const made = await insertEvent(client, row);
  if (made.error && made.error.code !== UNIQUE_VIOLATION) throw new Error("Couldn’t load the event. Try again shortly.");
  const again = await readEventByKey(client, row.event_key);
  if (!again.data) throw new Error("Couldn’t load the event. Try again shortly.");
  return again.data;
}

/* ------------------------------------------------------------------ entry */

export type EntryRefusal = "off" | "account" | "banned" | "closed" | "full" | "already" | "coins" | "ticket" | "qualify" | "not_entered";
export type EntryOutcome = { ok: true } | { ok: false; reason: EntryRefusal; message: string };

const REFUSAL_TEXT: Record<Exclude<EntryRefusal, "off">, string> = {
  account: "Tournaments are for accounts. Make one to enter.",
  banned: "Your account can’t enter tournaments at the moment.",
  closed: "Entry has closed for this one.",
  full: "This cup is full.",
  already: "You’re already in.",
  coins: "You need 150 coins to enter.",
  ticket: "You don’t have a Category Cup ticket.",
  qualify: "The Championship can’t be entered: the month’s top 64 Score Attack players qualify.",
  not_entered: "You’re not entered.",
};
const refuse = (reason: Exclude<EntryRefusal, "off">): EntryOutcome => ({ ok: false, reason, message: REFUSAL_TEXT[reason] });

async function isAccount(client: Db, userId: string): Promise<boolean> {
  const { data } = await readProfile(client, userId);
  return !!data;
}

const entryKey = (eventId: string, userId: string, attempt: number) => `tournament_entry:${eventId}:${userId}:${attempt}`;

/** Enters this week's cup, paying with coins or a ticket. */
export async function enterCup(
  client: Db,
  userId: string,
  payWith: "coins" | "ticket",
  nowMs: number,
  switches: EventSwitches = EVENT_SWITCHES,
): Promise<EntryOutcome> {
  const off = eventRefusal("category_cup", switches);
  if (off) return { ok: false, reason: "off", message: off };
  if (!(await isAccount(client, userId))) return refuse("account");
  const { roomRefusal } = await import("@/lib/safety/moderation.server");
  if (await roomRefusal(client, userId)) return refuse("banned");
  const event = await ensureEvent(client, "category_cup", nowMs);
  if (event.status !== "open" || nowMs >= msOf(event.starts_at)) return refuse("closed");
  const { data: existing } = await readEntry(client, event.id, userId);
  if (existing?.status === "entered") return refuse("already");
  const attempt = (existing?.attempt ?? 0) + 1;
  const key = entryKey(event.id, userId, attempt);
  const economy = await import("@/lib/economy/economy.server");
  const ref = { kind: "tournament", id: event.id };
  let coinLine: number | null = null;
  if (payWith === "coins") {
    const spent = await economy.spendCoins(client, { userId, amount: CUP_ENTRY_COINS, reason: "tournament_entry", ref, key });
    if (spent.status === "insufficient") return refuse("coins");
    if (spent.status === "no_account") return refuse("account");
    if (spent.status !== "spent" && spent.status !== "duplicate") throw new Error("Couldn’t take the entry. Try again shortly.");
    coinLine = spent.line_id ?? null;
  } else {
    const used = await economy.useConsumable(client, { userId, kind: CUP_TICKET_KIND, amount: 1, reason: "tournament_entry", ref, key });
    if (used.status === "insufficient") return refuse("ticket");
    if (used.status === "no_account") return refuse("account");
    if (used.status !== "used" && used.status !== "duplicate") throw new Error("Couldn’t take the entry. Try again shortly.");
  }
  const { data: answer, error } = await enterEvent(client, { eventId: event.id, userId, paidWith: payWith, coinLineId: coinLine, attempt, max: CUP_MAX_ENTRANTS });
  if (answer === "entered") return { ok: true };
  // Refused after paying (closed, full or a racing second entry): the payment goes straight back.
  await refundPayment(client, event.id, { user_id: userId, paid_with: payWith, coin_line_id: coinLine, attempt });
  if (answer === "already") return refuse("already");
  if (answer === "full") return refuse("full");
  if (answer === "closed") return refuse("closed");
  throw new Error(error?.message ? "Couldn’t take the entry. Try again shortly." : "Couldn’t take the entry.");
}

/** Leaves this week's cup before its start; the entry is given back once. */
export async function leaveCup(client: Db, userId: string, nowMs: number, switches: EventSwitches = EVENT_SWITCHES): Promise<EntryOutcome> {
  const off = eventRefusal("category_cup", switches);
  if (off) return { ok: false, reason: "off", message: off };
  const event = await ensureEvent(client, "category_cup", nowMs);
  if (event.status !== "open" || nowMs >= msOf(event.starts_at)) return refuse("closed");
  const { data: claimed } = await claimEntryStatus(client, event.id, userId, "entered", { status: "withdrawn" });
  if (!claimed) return refuse("not_entered");
  const { data: entry } = await readEntry(client, event.id, userId);
  if (entry) await refundEntry(client, event.id, entry, nowMs);
  return { ok: true };
}

/** Gives one payment back: coins through the ledger's refund of the spend line, a ticket re-granted under its key. */
async function refundPayment(
  client: Db,
  eventId: string,
  entry: Pick<TournamentEntryRow, "user_id" | "paid_with" | "coin_line_id" | "attempt">,
): Promise<boolean> {
  const economy = await import("@/lib/economy/economy.server");
  if (entry.paid_with === "coins") {
    if (entry.coin_line_id === null) return false;
    const r = await economy.refundCoins(client, entry.user_id, entry.coin_line_id);
    return r.status === "refunded" || r.status === "duplicate";
  }
  if (entry.paid_with === "ticket") {
    const r = await economy.grantConsumable(client, {
      userId: entry.user_id,
      kind: CUP_TICKET_KIND,
      amount: 1,
      reason: "tournament_refund",
      ref: { kind: "tournament", id: eventId },
      key: `tournament_refund:${eventId}:${entry.user_id}:${entry.attempt}`,
    });
    return r.status === "granted" || r.status === "duplicate";
  }
  return true; // a qualified Championship place cost nothing
}

/** A withdrawn or cancelled entry's refund, once (`refunded_at` marks it; the ledger keys make a retry safe). */
async function refundEntry(client: Db, eventId: string, entry: TournamentEntryRow, nowMs: number): Promise<void> {
  if (entry.refunded_at) return;
  if (await refundPayment(client, eventId, entry)) await updateEntry(client, eventId, entry.user_id, { refunded_at: iso(nowMs) });
}

/* ------------------------------------------------------------------ the tick */

export interface TickOptions {
  switches?: EventSwitches;
  /** Room making (checks stand in a quick room; the default is W3b's started room with a fresh deal). */
  makeRoom?: (client: Db, input: { players: string[]; choice: RatedChoice }, nowMs: number) => Promise<{ id: string; code: string }>;
}

/** A room made already started for a match: three games dealt from a new room seed, the same for both players. */
async function defaultMakeRoom(client: Db, input: { players: string[]; choice: RatedChoice }, nowMs: number) {
  const settings = matchSettings("bo3", input.choice);
  const { newRoomSeed } = await import("@/lib/duel/selection");
  const { buildRoomPuzzles } = await import("@/lib/duel/generate.server");
  const { drawUnblockRow } = await import("@/lib/duel/unblock.server");
  const { createStartedRoom } = await import("@/lib/rated/rated.server");
  const seed = newRoomSeed();
  const types = dealRoomRounds(settings, { seed }).types;
  const { puzzles } = buildRoomPuzzles({
    seed,
    recent: [],
    categories: categoriesOfPicks(settings.picks),
    unblockRow: await drawUnblockRow(client),
    recentBankKeys: new Set(),
    roundOrder: types,
  });
  return createStartedRoom(client, { players: input.players.map((userId, i) => ({ userId, slot: i + 1 })), puzzles, picks: settings.picks }, nowMs);
}

/** Moves the event on as far as it can go now. Safe to call from any number of phones at once. */
export async function tickEvent(client: Db, eventId: string, nowMs: number, options: TickOptions = {}): Promise<void> {
  const { data: event } = await readEvent(client, eventId);
  if (!event) return;
  if (eventRefusal(event.kind as EventKind, options.switches ?? EVENT_SWITCHES)) return;
  if (event.status === "finished" && event.paid_at) return;
  const { data: locked } = await lockEvent(client, eventId, TICK_LOCK_MS);
  if (!locked) return;
  try {
    await tickLocked(client, event, nowMs, options);
  } finally {
    await unlockEvent(client, eventId);
  }
}

async function tickLocked(client: Db, first: TournamentEventRow, nowMs: number, options: TickOptions): Promise<void> {
  let event = first;
  const reread = async () => {
    const { data } = await readEvent(client, event.id);
    if (data) event = data;
  };
  // Read through a function: `reread` changes the event, which TypeScript's narrowing can't see.
  const statusNow = (): string => event.status;
  // Refunds owed: anyone who left before the start, and every entry of a cancelled cup.
  const { data: entries } = await readEntries(client, event.id);
  for (const e of entries ?? []) {
    if (e.status === "withdrawn" && !e.refunded_at) await refundEntry(client, event.id, e, nowMs);
    if (event.status === "cancelled" && e.status === "entered") {
      const { data: claimed } = await claimEntryStatus(client, event.id, e.user_id, "entered", { status: "refunded" });
      if (claimed) await refundEntry(client, event.id, { ...e, status: "refunded" }, nowMs);
    }
    if (event.status === "cancelled" && e.status === "refunded" && !e.refunded_at) await refundEntry(client, event.id, e, nowMs);
  }
  if (event.status === "cancelled") return;

  const startMs = msOf(event.starts_at);
  if (event.status === "open") {
    if (!event.reminded_at && nowMs >= startMs - REMINDER_BEFORE_MS) {
      await updateEvent(client, event.id, { reminded_at: iso(nowMs) });
      const entered = (entries ?? []).filter((e) => e.status === "entered").map((e) => e.user_id);
      if (entered.length && event.kind === "category_cup")
        await tournamentPlatform().remind(client, { userIds: entered, eventName: cupTitle(event.category as never), startsAtMs: startMs });
    }
    if (nowMs < startMs) return;
    await startEvent(client, event, nowMs);
    await reread();
    if (statusNow() !== "running") return;
  }
  if (statusNow() === "running") {
    for (let step = 0; step < 16; step++) {
      const moved = await advance(client, event, nowMs, options);
      await reread();
      if (!moved || statusNow() !== "running") break;
    }
  }
  if (statusNow() === "finished" && !event.paid_at) await payOut(client, event, nowMs);
}

/** The start: too few cancels (and refunds on the same tick); else the field is fixed and round 1 begins. */
async function startEvent(client: Db, event: TournamentEventRow, nowMs: number): Promise<void> {
  if (event.kind === "category_cup") {
    const { data: entries } = await readEntries(client, event.id);
    const entered = (entries ?? []).filter((e) => e.status === "entered");
    if (entered.length < CUP_MIN_ENTRANTS) {
      if ((await claimEventStatus(client, event.id, "open", { status: "cancelled", cancelled_reason: "too_few", field: entered.length })).data) {
        for (const e of entered) {
          const { data: claimed } = await claimEntryStatus(client, event.id, e.user_id, "entered", { status: "refunded" });
          if (claimed) await refundEntry(client, event.id, { ...e, status: "refunded" }, nowMs);
        }
      }
      return;
    }
    for (const [i, e] of entered.entries()) await updateEntry(client, event.id, e.user_id, { seed: i + 1 });
    await claimEventStatus(client, event.id, "open", {
      status: "running",
      started_at: iso(nowMs),
      field: entered.length,
      rounds_total: swissRoundsFor(entered.length),
      current_round: 0,
      round_starts_at: iso(nowMs),
    });
    return;
  }
  // The Championship: the month's top 64 Score Attack players who hold an account and aren't banned, seeded in order.
  const top = await tournamentPlatform().scoreAttackTop(client, event.month ?? "", CHAMPIONSHIP_QUALIFIERS * 2, msOf(event.starts_at));
  const { roomRefusal } = await import("@/lib/safety/moderation.server");
  const qualifiers: string[] = [];
  for (const userId of top) {
    if (qualifiers.length >= CHAMPIONSHIP_QUALIFIERS) break;
    if (qualifiers.includes(userId)) continue;
    if (!(await isAccount(client, userId))) continue;
    if (await roomRefusal(client, userId)) continue;
    qualifiers.push(userId);
  }
  if (qualifiers.length < CHAMPIONSHIP_MIN_QUALIFIERS) {
    await claimEventStatus(client, event.id, "open", { status: "cancelled", cancelled_reason: "no_qualifiers", field: qualifiers.length });
    return;
  }
  await insertQualifiers(
    client,
    qualifiers.map((user_id, i) => ({ event_id: event.id, user_id, status: "entered", paid_with: "qualified", seed: i + 1, entered_at: iso(nowMs) })),
  );
  const size = bracketSize(qualifiers.length);
  await claimEventStatus(client, event.id, "open", {
    status: "running",
    started_at: iso(nowMs),
    field: qualifiers.length,
    bracket_size: size,
    rounds_total: bracketRounds(size),
    current_round: 0,
    round_starts_at: iso(nowMs),
  });
}

const choiceOf = (event: TournamentEventRow): RatedChoice => event.category as RatedChoice;

/** One step on: the next round, the rooms due, settling. True when something moved (so the tick looks again). */
async function advance(client: Db, event: TournamentEventRow, nowMs: number, options: TickOptions): Promise<boolean> {
  const { data: entries } = await readEntries(client, event.id);
  const entered = (entries ?? []).filter((e) => e.status === "entered");
  const { data: all } = await readMatches(client, event.id);
  const matches = all ?? [];

  if (event.current_round === 0) {
    await createRound(client, event, 1, entered, matches, nowMs);
    await updateEvent(client, event.id, { current_round: 1, round_starts_at: iso(nowMs) });
    return true;
  }
  const round = event.current_round;
  const current = matches.filter((m) => m.round === round);
  let moved = false;

  // Rooms for the round once it starts.
  if (nowMs >= msOf(event.round_starts_at)) {
    for (const m of current) {
      if (m.status !== "pending" || !m.player_a || !m.player_b) continue;
      if (!(await claimMatchStatus(client, m.id, "pending", { status: "playing", room_made_at: iso(nowMs) })).data) continue;
      const make = options.makeRoom ?? defaultMakeRoom;
      try {
        const room = await make(client, { players: [m.player_a, m.player_b], choice: choiceOf(event) }, nowMs);
        await updateMatch(client, m.id, { duel_id: room.id });
      } catch (err) {
        await updateMatch(client, m.id, { status: "pending", room_made_at: null });
        console.error("[tournaments] room", m.id, err instanceof Error ? err.message : err);
      }
      moved = true;
    }
  }
  // Settle the matches whose rooms are done (or past the deadline).
  for (const m of current) {
    if (m.status !== "playing" || !m.duel_id) continue;
    if (await settleMatch(client, event, m, nowMs)) moved = true;
  }
  const { data: after } = await readMatches(client, event.id);
  const now = (after ?? []).filter((m) => m.round === round);
  if (!now.length || now.some((m) => m.status !== "settled")) return moved;

  // The round is done: finish, or the next round a minute from now (at once after a round of walkovers only).
  if (round >= event.rounds_total) {
    await finishEvent(client, event, entered, after ?? [], nowMs);
    return true;
  }
  await createRound(client, event, round + 1, entered, after ?? [], nowMs);
  const allWalkovers = now.every((m) => m.walkover);
  await updateEvent(client, event.id, { current_round: round + 1, round_starts_at: iso(allWalkovers ? nowMs : nowMs + ROUND_BREAK_MS) });
  return true;
}

const swissPlayersOf = (entered: readonly TournamentEntryRow[]): SwissPlayer[] =>
  entered.map((e, i) => ({ id: e.user_id, order: e.seed ?? i + 1 }));

const swissMatchesOf = (matches: readonly TournamentMatchRow[]): SwissMatch[] =>
  matches
    .filter((m) => m.stage === "swiss" && m.player_a)
    .map((m) => ({
      round: m.round,
      a: m.player_a!,
      b: m.player_b,
      result: m.status === "settled" ? { winner: m.winner, totalA: m.total_a ?? 0, totalB: m.total_b ?? 0 } : null,
    }));

function koMatchOf(m: TournamentMatchRow, seedOfUser: Map<string, number>): KoMatch {
  return {
    stage: m.stage === "third_place" ? "third_place" : "knockout",
    round: m.round,
    slot: m.slot,
    seedA: m.seed_a,
    seedB: m.seed_b,
    winner: m.winner ? (seedOfUser.get(m.winner) ?? null) : null,
  };
}

/** A round's matches: the Swiss pairings, or the bracket's next round (walkovers settled at once). */
async function createRound(
  client: Db,
  event: TournamentEventRow,
  round: number,
  entered: readonly TournamentEntryRow[],
  matches: readonly TournamentMatchRow[],
  nowMs: number,
): Promise<void> {
  if (matches.some((m) => m.round === round)) return;
  if (event.kind === "category_cup") {
    const pairs = pairSwissRound(swissPlayersOf(entered), swissMatchesOf(matches));
    await insertMatches(
      client,
      pairs.map((p, slot) => ({
        event_id: event.id,
        stage: "swiss",
        round,
        slot,
        player_a: p.a,
        player_b: p.b,
        // Every row carries every column (one insert of many rows names the same columns for each).
        status: p.b === null ? "settled" : "pending",
        winner: p.b === null ? p.a : null,
        walkover: p.b === null,
        games_a: p.b === null ? 0 : null,
        games_b: p.b === null ? 0 : null,
        total_a: p.b === null ? 0 : null,
        total_b: p.b === null ? 0 : null,
        settled_at: p.b === null ? iso(nowMs) : null,
      })),
    );
    recordEvents({ event: "swiss_round_paired", props: { round, players: entered.length } });
    return;
  }
  const userOfSeed = new Map(entered.map((e) => [e.seed ?? 0, e.user_id]));
  const seedOfUser = new Map(entered.map((e) => [e.user_id, e.seed ?? 0]));
  let ko: KoMatch[];
  if (round === 1) ko = firstRound(entered.length);
  else {
    const before = matches
      .filter((m) => m.round === round - 1 && m.stage === "knockout")
      .sort((a, b) => a.slot - b.slot)
      .map((m) => koMatchOf(m, seedOfUser));
    ko = nextRound(before);
    if (round === event.rounds_total) {
      const third = thirdPlaceMatch(before);
      if (third) ko.push(third);
    }
  }
  await insertMatches(
    client,
    ko.map((k) => {
      const walk = isWalkover(k);
      const w = walk ? walkoverWinner(k) : null;
      return {
        event_id: event.id,
        stage: k.stage,
        round,
        slot: k.slot,
        seed_a: k.seedA,
        seed_b: k.seedB,
        player_a: k.seedA ? (userOfSeed.get(k.seedA) ?? null) : null,
        player_b: k.seedB ? (userOfSeed.get(k.seedB) ?? null) : null,
        status: walk ? "settled" : "pending",
        walkover: walk,
        winner: walk && w ? (userOfSeed.get(w) ?? null) : null,
        settled_at: walk ? iso(nowMs) : null,
      };
    }),
  );
}

/** The games of a finished match room, side a = slot 1, side b = slot 2 (a game with no answer scores 0). */
function gamesOf(puzzles: readonly PuzzleData[], results: readonly RoundResultRow[]): GameScores[] {
  return puzzles.map((puzzle, i) => {
    const row = (slot: number) => results.find((r) => r.player_slot === slot && r.round_number === i + 1);
    const tie = tieRoundFor(puzzle);
    return { a: row(1)?.score ?? 0, b: row(2)?.score ?? 0, aTimeMs: roundTimeUsedMs(row(1), tie), bTimeMs: roundTimeUsedMs(row(2), tie) };
  });
}

/** Settles one match from its room once (true when it did). */
async function settleMatch(client: Db, event: TournamentEventRow, m: TournamentMatchRow, nowMs: number): Promise<boolean> {
  const { data: room } = await readRoom(client, m.duel_id!);
  const done = !!room && (room.status === "finished" || !!room.disbanded_at);
  const late = nowMs >= msOf(m.room_made_at) + MATCH_DEADLINE_MS;
  if (room && !done && !late) return false;
  if (!(await claimMatchStatus(client, m.id, "playing", { status: "settling" })).data) return false;
  try {
    let games: GameScores[] = [];
    if (room) {
      const { data: results } = await readRoomResults(client, room.id);
      const { data: priv } = await readPrivatePuzzles(client, room.id);
      const pubs = Array.isArray(room.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
      games = gamesOf(pubs.map((p, i) => mergePuzzle(p, priv?.[i])), results ?? []);
    }
    const outcome = matchOutcome(games);
    let winner: string | null;
    if (event.kind === "category_cup") winner = outcome.winner === "a" ? m.player_a : outcome.winner === "b" ? m.player_b : null;
    else {
      const seed = playedWinner({ seedA: m.seed_a, seedB: m.seed_b }, outcome.winner);
      winner = seed === m.seed_a ? m.player_a : m.player_b;
    }
    await claimMatchStatus(client, m.id, "settling", {
      status: "settled",
      winner,
      games_a: outcome.winsA,
      games_b: outcome.winsB,
      total_a: outcome.totalA,
      total_b: outcome.totalB,
      settled_at: iso(nowMs),
    });
    if (event.kind === "championship") recordEvents({ event: "knockout_match_played", roomId: room?.id ?? null, props: { round: m.round } });
    return true;
  } catch (err) {
    await claimMatchStatus(client, m.id, "settling", { status: "playing" });
    console.error("[tournaments] settle", m.id, err instanceof Error ? err.message : err);
    return false;
  }
}

/** The final places, written once the last round is settled; then the event is finished (paid on the same tick). */
async function finishEvent(
  client: Db,
  event: TournamentEventRow,
  entered: readonly TournamentEntryRow[],
  matches: readonly TournamentMatchRow[],
  nowMs: number,
): Promise<void> {
  const places = placesOf(event, entered, matches);
  for (const [userId, place] of places) await updateEntry(client, event.id, userId, { final_place: place });
  await claimEventStatus(client, event.id, "running", { status: "finished", finished_at: iso(nowMs) });
}

/** Every entrant's final place (Swiss: the standings; Knockout: the bracket). */
export function placesOf(
  event: Pick<TournamentEventRow, "kind" | "bracket_size">,
  entered: readonly TournamentEntryRow[],
  matches: readonly TournamentMatchRow[],
): Map<string, number> {
  if (event.kind === "category_cup")
    return new Map(swissStandings(swissPlayersOf(entered), swissMatchesOf(matches)).map((s) => [s.id, s.place]));
  const seedOfUser = new Map(entered.map((e) => [e.user_id, e.seed ?? 0]));
  const userOfSeed = new Map(entered.map((e) => [e.seed ?? 0, e.user_id]));
  const ko = finalPlaces(event.bracket_size ?? 2, matches.map((m) => koMatchOf(m, seedOfUser)));
  const out = new Map<string, number>();
  for (const [seed, place] of ko) {
    const user = userOfSeed.get(seed);
    if (user) out.set(user, place);
  }
  return out;
}

/** Every prize, once: coins, trophy, badge, frame, hall of fame, Joules. A failure leaves `paid_at` unset for the next tick. */
async function payOut(client: Db, event: TournamentEventRow, nowMs: number): Promise<void> {
  const kind = event.kind as EventKind;
  const { data: entries } = await readEntries(client, event.id);
  const entered = (entries ?? []).filter((e) => e.status === "entered");
  const { data: paidRows } = await readPayouts(client, event.id);
  const paid = new Set((paidRows ?? []).map((p) => `${p.user_id}:${p.kind}`));
  const field = event.field;
  const economy = await import("@/lib/economy/economy.server");
  const { awardBadge } = await import("@/lib/badges/badges.server");
  const once = async (userId: string, what: "coins" | "trophy" | "badge" | "frame" | "hall_of_fame" | "joules", place: number | null, amount: number | null, pay: () => Promise<void>) => {
    if (paid.has(`${userId}:${what}`)) return;
    await pay();
    await insertPayout(client, { event_id: event.id, user_id: userId, kind: what, place, amount });
  };
  try {
    for (const e of entered) {
      const place = e.final_place;
      if (place === null) continue;
      const coins = prizeCoins(kind, place, field);
      if (coins > 0)
        await once(e.user_id, "coins", place, coins, async () => {
          const r = await economy.creditCoins(client, {
            userId: e.user_id,
            amount: coins,
            reason: "tournament_prize",
            ref: { kind: "tournament", id: event.id },
            key: `tournament_prize:${event.id}:${e.user_id}`,
          });
          if (r.status !== "credited" && r.status !== "duplicate" && r.status !== "no_account") throw new Error(`prize ${r.status}`);
        });
      const cup: TrophyCup | null = trophyFor(kind, place, field);
      if (cup)
        await once(e.user_id, "trophy", place, null, async () => {
          await insertTrophy(client, { user_id: e.user_id, event_id: event.id, kind, place, cup });
        });
      if (place === 1) {
        await once(e.user_id, "badge", 1, null, async () => {
          const s = await awardBadge(client, e.user_id, WINNER_BADGE[kind], { event: event.event_key });
          if (s !== "awarded" && s !== "owned" && s !== "no_account") throw new Error(`badge ${s}`);
        });
        if (kind === "championship") {
          await once(e.user_id, "frame", 1, null, async () => {
            const s = await economy.grantItem(client, { userId: e.user_id, itemId: CHAMPIONSHIP_FRAME, how: "earned" });
            if (s !== "granted" && s !== "owned" && s !== "no_account") throw new Error(`frame ${s}`);
          });
          await once(e.user_id, "hall_of_fame", 1, null, async () => {
            await insertHallOfFame(client, { month: event.month!, event_id: event.id, user_id: e.user_id });
          });
        }
      }
      await once(e.user_id, "joules", place, FINISH_JOULES, async () => {
        await tournamentPlatform().awardJoules(client, { userId: e.user_id, amount: FINISH_JOULES, key: `tournament_finish:${event.id}:${e.user_id}` });
      });
    }
    await updateEvent(client, event.id, { paid_at: iso(nowMs) });
  } catch (err) {
    console.error("[tournaments] payout", event.id, err instanceof Error ? err.message : err);
  }
}

/* ------------------------------------------------------------------ the event page */

export interface EventPlayerRow {
  place: number;
  name: string;
  me: boolean;
  /** "3–1" (wins–losses; draws shown "3–1–1"). */
  record: string;
  points: string;
}

export interface BracketMatchView {
  stage: "knockout" | "third_place";
  round: number;
  slot: number;
  nameA: string | null;
  nameB: string | null;
  gamesA: number | null;
  gamesB: number | null;
  /** "a" / "b" once decided. */
  winner: "a" | "b" | null;
  live: boolean;
  walkover: boolean;
  me: boolean;
}

export interface MyMatchView {
  round: number;
  roundLabel: string;
  opponent: string | null;
  opponentRecord: string | null;
  myRecord: string | null;
  bye: boolean;
  /** The room to open once it's made. */
  roomCode: string | null;
  state: "waiting" | "playing" | "done";
  result: "won" | "lost" | "drawn" | null;
}

export interface EventView {
  kind: EventKind;
  key: string;
  title: string;
  category: string;
  startsAtMs: number;
  status: "open" | "running" | "finished" | "cancelled";
  cancelledReason: string | null;
  roundsTotal: number;
  currentRound: number;
  roundLabel: string | null;
  roundStartsAtMs: number | null;
  entrants: number;
  minEntrants: number;
  maxEntrants: number;
  entryCoins: number | null;
  me: { account: boolean; entered: boolean; paidWith: string | null; finalPlace: number | null };
  myMatch: MyMatchView | null;
  standings: EventPlayerRow[];
  bracket: BracketMatchView[];
  bracketSize: number | null;
  prizes: string[];
  rules: readonly string[];
}

async function namesOf(client: Db, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = [...new Set(ids)];
  for (let i = 0; i < list.length; i += 100) {
    const { data } = await readPublicProfiles(client, list.slice(i, i + 100));
    for (const p of data ?? []) out.set(p.user_id, p.username);
  }
  return out;
}

const DELETED = "Deleted player";

/** What the event page shows. Ticks the event on first, so the phones on the page drive it. */
export async function eventView(client: Db, kind: EventKind, userId: string, nowMs: number, options: TickOptions = {}): Promise<EventView | null> {
  if (eventRefusal(kind, options.switches ?? EVENT_SWITCHES)) return null;
  let event = await ensureEvent(client, kind, nowMs);
  await tickEvent(client, event.id, nowMs, options);
  event = (await readEvent(client, event.id)).data ?? event;
  const { data: entries } = await readEntries(client, event.id);
  const entered = (entries ?? []).filter((e) => e.status === "entered");
  const { data: all } = await readMatches(client, event.id);
  const matches = all ?? [];
  const names = await namesOf(client, [...entered.map((e) => e.user_id)]);
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? DELETED) : null);
  const mine = (entries ?? []).find((e) => e.user_id === userId) ?? null;

  let standings: EventPlayerRow[] = [];
  const recordOf = new Map<string, string>();
  if (kind === "category_cup" && event.status !== "open" && event.status !== "cancelled") {
    const rows = swissStandings(swissPlayersOf(entered), swissMatchesOf(matches));
    for (const r of rows) recordOf.set(r.id, r.draws ? `${r.wins + r.byes}–${r.losses}–${r.draws}` : `${r.wins + r.byes}–${r.losses}`);
    standings = rows.map((r) => ({ place: r.place, name: nameOf(r.id)!, me: r.id === userId, record: recordOf.get(r.id)!, points: pointsText(r.points2) }));
  }

  const bracket: BracketMatchView[] =
    kind === "championship"
      ? matches.map((m) => ({
          stage: m.stage === "third_place" ? "third_place" : "knockout",
          round: m.round,
          slot: m.slot,
          nameA: nameOf(m.player_a),
          nameB: nameOf(m.player_b),
          gamesA: m.games_a,
          gamesB: m.games_b,
          winner: m.status === "settled" && m.winner ? (m.winner === m.player_a ? "a" : "b") : null,
          live: m.status === "playing",
          walkover: m.walkover,
          me: m.player_a === userId || m.player_b === userId,
        }))
      : [];

  let myMatch: MyMatchView | null = null;
  const myMatches = matches.filter((m) => m.player_a === userId || m.player_b === userId).sort((a, b) => b.round - a.round || (a.stage < b.stage ? -1 : 1));
  const latest = myMatches[0];
  if (latest && event.status === "running") {
    const iAmA = latest.player_a === userId;
    const opp = iAmA ? latest.player_b : latest.player_a;
    let code: string | null = null;
    if (latest.duel_id) code = (await readRoom(client, latest.duel_id)).data?.room_code ?? null;
    const result = latest.status !== "settled" ? null : latest.winner === null ? "drawn" : latest.winner === userId ? "won" : "lost";
    myMatch = {
      round: latest.round,
      roundLabel:
        kind === "championship" ? (latest.stage === "third_place" ? "Third-place match" : roundName(event.bracket_size ?? 2, latest.round)) : `Round ${latest.round} of ${event.rounds_total}`,
      opponent: nameOf(opp),
      opponentRecord: opp ? (recordOf.get(opp) ?? null) : null,
      myRecord: recordOf.get(userId) ?? null,
      bye: !opp,
      roomCode: code,
      state: latest.status === "settled" ? "done" : latest.status === "pending" ? "waiting" : "playing",
      result,
    };
  }

  const title = kind === "category_cup" ? cupTitle(event.category as never) : `${EVENT_NAME.championship}, ${monthLabel(event.month ?? "")}`;
  return {
    kind,
    key: event.event_key,
    title,
    category: event.category,
    startsAtMs: msOf(event.starts_at),
    status: event.status as EventView["status"],
    cancelledReason: event.cancelled_reason,
    roundsTotal: event.rounds_total,
    currentRound: event.current_round,
    roundLabel:
      event.current_round > 0
        ? kind === "championship"
          ? roundName(event.bracket_size ?? 2, event.current_round)
          : `Round ${event.current_round} of ${event.rounds_total}`
        : null,
    roundStartsAtMs: event.round_starts_at ? msOf(event.round_starts_at) : null,
    entrants: entered.length,
    minEntrants: kind === "category_cup" ? CUP_MIN_ENTRANTS : CHAMPIONSHIP_MIN_QUALIFIERS,
    maxEntrants: kind === "category_cup" ? CUP_MAX_ENTRANTS : CHAMPIONSHIP_QUALIFIERS,
    entryCoins: kind === "category_cup" ? CUP_ENTRY_COINS : null,
    me: { account: await isAccount(client, userId), entered: mine?.status === "entered", paidWith: mine?.status === "entered" ? mine.paid_with : null, finalPlace: mine?.final_place ?? null },
    myMatch,
    standings,
    bracket,
    bracketSize: event.bracket_size,
    prizes: (kind === "category_cup" ? CUP_PRIZES : CHAMPIONSHIP_PRIZES).map(prizeLineText),
    rules: kind === "category_cup" ? CUP_RULES : CHAMPIONSHIP_RULES,
  };
}

/* ------------------------------------------------------------------ the hall of fame */

export interface HallOfFameEntry {
  month: string;
  label: string;
  name: string;
}

/** Every Championship winner, newest month first (shown while the Championship is on). */
export async function hallOfFame(client: Db, switches: EventSwitches = EVENT_SWITCHES): Promise<HallOfFameEntry[]> {
  if (eventRefusal("championship", switches)) return [];
  const { data } = await readHallOfFame(client);
  const rows = data ?? [];
  const names = await namesOf(client, rows.map((r) => r.user_id));
  return rows.map((r) => ({ month: r.month, label: monthLabel(r.month), name: names.get(r.user_id) ?? DELETED }));
}

/** Whether a room is a tournament match (chat's stranger rules; Play again refused). */
export async function isTournamentRoom(client: Db, roomId: string): Promise<boolean> {
  try {
    const { readMatchByRoom } = await import("@/lib/data/tournamentEvents.server");
    const { data } = await readMatchByRoom(client, roomId);
    return !!data;
  } catch {
    return false; // a database without the tournament tables: no tournament rooms
  }
}
