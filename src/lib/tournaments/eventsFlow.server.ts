/**
 * The Category Cup (Swiss) and the Joulz Championship (Knockout), server side (wave 4, W4c; docs/tournaments/events.md),
 * on W4b's tournaments: each event is a row of its own kind in `tournament_events`, entered through W4b's
 * `tournament_enter` (the cup: 150 coins or a Category Cup ticket; the Championship's qualifiers: free, by the server),
 * called off and refunded through `tournament_cancel`, finished through `tournament_finish` and paid through W4b's
 * `payEvent` (coins, trophies, Entrant / Trophy Hunter / Champion / Serial Winner). This module adds the formats:
 *
 * - `advanceBigEvent` (called by W4b's `advanceEvent`, so every read of the event and W4b's 5-minute Cron Trigger move it
 *   on): the start (fewer than 16 cup entrants or 2 qualifiers: called off), each Swiss round's pairings or the
 *   bracket's next round, their rooms a minute after the round before, settling every match from its room, and the
 *   finish: places, then W4b's payEvent, then the winner's badge, the Championship frame, the hall of fame and Joules,
 *   each once and logged in `tournament_awards`. One ticker at a time (`tournament_rounds_lock`).
 * - Flagged runs (Joe, 11 Nov 2026): a side whose run the server's grading flags in a match (a stored grade's
 *   `extra.flagged`, read here, never sent by a phone) takes nothing from it (a Swiss loss with no points or score; a
 *   Knockout loss), gets no place, so no prize, trophy, badge, frame or Joules, and is logged for Joe's review in W4b's
 *   `moderation.tournament_flags` (through `tournament_flag`); its page says the result is under review.
 * - `bigEventView`: the round, the caller's match, the Swiss standings or the bracket.
 *
 * Every match is an ordinary room made already started by W3b's `createDealtMatchRoom` (the room seed's deal, the same
 * for both players), graded by the rooms engine; nothing here grades, scores or deals, and no tournament result is ever
 * passed to the ratings (a tournament room is never a rated match).
 */
import { recordEvents } from "@/lib/data/events.server";
import type { Db } from "@/lib/data/db.server";
import {
  cancelEventRpc,
  enterRpc,
  finishRpc,
  flagRpc,
  readEntries,
  readEvent,
  readResults,
  setEventStatus,
  type TournamentEventRow,
} from "@/lib/data/tournaments.server";
import {
  claimMatchStatus,
  insertAward,
  insertHallOfFame,
  insertMatches,
  insertRounds,
  insertSeeds,
  lockRounds,
  readAwards,
  readHallOfFame,
  readMatches,
  readMatchByRoom,
  readRounds,
  readSeeds,
  unlockRounds,
  updateMatch,
  updateRounds,
  type FlagLogRow,
  type TournamentMatchRow,
  type TournamentRoundsRow,
  type TournamentSeedRow,
} from "@/lib/data/tournamentEvents.server";
import { readRoom, readPrivatePuzzles } from "@/lib/data/rooms.server";
import { readRoomResults } from "@/lib/data/results.server";
import { readPublicProfiles } from "@/lib/data/profiles.server";
import { mergePuzzle } from "@/lib/duel/secrets";
import { tieRoundFor } from "@/lib/duel/tieBreak";
import { roundTimeUsedMs } from "@/lib/duel/scoring";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { matchOutcome, type GameScores, type RatedChoice } from "@/lib/rated/matchmaking";
import { serverFlag, UNDER_REVIEW_LINE } from "./rules";

import {
  CHAMPIONSHIP_FRAME,
  CHAMPIONSHIP_MIN_QUALIFIERS,
  CHAMPIONSHIP_NOT_HELD,
  CHAMPIONSHIP_QUALIFIERS,
  CUP_MIN_ENTRANTS,
  isBigKind,
  monthLabel,
  parseBigEventId,
  ROUND_BREAK_MS,
  swissRoundsFor,
  WINNER_BADGE,
  type BigKind,
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

/** A match room still not finished this long after it was made is settled from what is stored (a no-show scores 0). */
export const MATCH_DEADLINE_MS = 25 * 60_000;
/** The tick lock's length (a tick that dies releases it after this). */
const TICK_LOCK_MS = 30_000;

const iso = (ms: number) => new Date(ms).toISOString();
const msOf = (s: string | null | undefined) => (s ? Date.parse(s) : Number.NaN);

type RoomMaker = (client: Db, input: { players: string[]; choice: RatedChoice }, nowMs: number) => Promise<{ id: string; code: string }>;

/** A match's room: W3b's dealt match room (a best of 3 from the room seed, never a rated match). */
const defaultMakeRoom: RoomMaker = async (client, input, nowMs) => {
  const { createDealtMatchRoom } = await import("@/lib/rated/rated.server");
  return createDealtMatchRoom(client, { format: "bo3", choice: input.choice, userIds: input.players }, nowMs);
};

let roomMaker: RoomMaker | null = null;
/** Checks stand in a quick room maker (null: the real one). Does nothing in a production build. */
export function setBigRoomMaker(next: RoomMaker | null): void {
  if (import.meta.env.PROD) return;
  roomMaker = next;
}

/* ------------------------------------------------------------------ the tick */

/**
 * Moves a Category Cup or Championship on as far as it can go now (from W4b's advanceEvent). Safe from any number of
 * callers at once: one ticker holds the lock, and every step is a guarded update or an idempotent write.
 */
export async function advanceBigEvent(client: Db, row: TournamentEventRow, nowMs: number): Promise<void> {
  if (!isBigKind(row.kind) || row.status === "cancelled") return;
  if (row.status === "scheduled") {
    if (nowMs < msOf(row.starts_at)) return;
    await startBigEvent(client, row, nowMs);
  }
  const { data: rounds } = await readRounds(client, row.id);
  if (!rounds) return;
  const fresh = (await readEvent(client, row.id)).data ?? row;
  if (fresh.status === "finished" && rounds.awarded_at) return;
  const { data: locked } = await lockRounds(client, row.id, TICK_LOCK_MS);
  if (!locked) return;
  try {
    let event = fresh;
    for (let step = 0; step < 16 && event.status === "live"; step++) {
      const moved = await advanceRounds(client, event, nowMs);
      event = (await readEvent(client, row.id)).data ?? event;
      if (!moved) break;
    }
    if (event.status === "finished") await awardExtras(client, event, nowMs);
  } finally {
    await unlockRounds(client, row.id);
  }
}

/** The start: too few calls the event off (W4b refunds every entry); else the field and round 1. */
async function startBigEvent(client: Db, row: TournamentEventRow, nowMs: number): Promise<void> {
  if ((await readRounds(client, row.id)).data) return;
  const kind = row.kind as BigKind;
  let players: string[];
  if (kind === "category_cup") {
    const { data: entries } = await readEntries(client, row.id);
    const entered = entries
      .filter((e) => e.refunded_at === null)
      .sort((a, b) => msOf(a.entered_at) - msOf(b.entered_at) || (a.user_id < b.user_id ? -1 : 1));
    if (entered.length < CUP_MIN_ENTRANTS) {
      await cancelEventRpc(client, row.id, "too_few");
      return;
    }
    players = entered.map((e) => e.user_id);
  } else {
    // The month's top 64 Score Attack players who hold an account and aren't banned, in their standings order.
    const month = row.id.split(":")[1] ?? "";
    const top = await tournamentPlatform().scoreAttackTop(client, month, CHAMPIONSHIP_QUALIFIERS * 2);
    const { roomRefusal } = await import("@/lib/safety/moderation.server");
    const { accountNameOf } = await import("@/lib/names/playerName.server");
    players = [];
    for (const userId of top) {
      if (players.length >= CHAMPIONSHIP_QUALIFIERS) break;
      if (players.includes(userId)) continue;
      if ((await accountNameOf(client, userId)) === null) continue;
      if (await roomRefusal(client, userId)) continue;
      players.push(userId);
    }
    if (players.length < CHAMPIONSHIP_MIN_QUALIFIERS) {
      // Not held this month: nobody was entered or paid, so W4b's cancel refunds nothing.
      await cancelEventRpc(client, row.id, CHAMPIONSHIP_NOT_HELD);
      return;
    }
    // Qualifiers are entered by the server, free (W4b's entry: the count, the reminder, the results' account).
    for (const userId of players) await enterRpc(client, { eventId: row.id, userId, entry: "free", coins: 0 });
  }
  await insertSeeds(client, players.map((user_id, i) => ({ event_id: row.id, user_id, seed: i + 1 })));
  const size = kind === "championship" ? bracketSize(players.length) : null;
  await insertRounds(client, {
    event_id: row.id,
    rounds_total: kind === "category_cup" ? swissRoundsFor(players.length) : bracketRounds(size!),
    current_round: 0,
    round_starts_at: iso(nowMs),
    bracket_size: size,
    field: players.length,
    started_at: iso(nowMs),
  });
  await setEventStatus(client, row.id, ["scheduled"], "live");
}

const choiceOf = (event: TournamentEventRow): RatedChoice => (event.kind === "championship" ? "mixed" : (event.pick as RatedChoice));

/** One step on: the next round, the rooms due, settling. True when something moved (so the tick looks again). */
async function advanceRounds(client: Db, event: TournamentEventRow, nowMs: number): Promise<boolean> {
  const { data: rounds } = await readRounds(client, event.id);
  if (!rounds) return false;
  const { data: seeds } = await readSeeds(client, event.id);
  const { data: matches } = await readMatches(client, event.id);

  if (rounds.current_round === 0) {
    await createRound(client, event, rounds, 1, seeds, matches, nowMs);
    await updateRounds(client, event.id, { current_round: 1, round_starts_at: iso(nowMs) });
    return true;
  }
  const round = rounds.current_round;
  const current = matches.filter((m) => m.round === round);
  let moved = false;
  if (nowMs >= msOf(rounds.round_starts_at)) {
    for (const m of current) {
      if (m.status !== "pending" || !m.player_a || !m.player_b) continue;
      if (!(await claimMatchStatus(client, m.id, "pending", { status: "playing", room_made_at: iso(nowMs) })).data) continue;
      try {
        const room = await (roomMaker ?? defaultMakeRoom)(client, { players: [m.player_a, m.player_b], choice: choiceOf(event) }, nowMs);
        await updateMatch(client, m.id, { duel_id: room.id });
      } catch (err) {
        await updateMatch(client, m.id, { status: "pending", room_made_at: null });
        console.error("[tournaments] room", m.id, err instanceof Error ? err.message : err);
      }
      moved = true;
    }
  }
  for (const m of current) {
    if (m.status !== "playing" || !m.duel_id) continue;
    if (await settleTournamentMatch(client, event, m, nowMs)) moved = true;
  }
  const after = (await readMatches(client, event.id)).data;
  const now = after.filter((m) => m.round === round);
  if (!now.length || now.some((m) => m.status !== "settled")) return moved;
  if (round >= rounds.rounds_total) {
    await finishBigEvent(client, event, rounds, seeds, after, nowMs);
    return true;
  }
  await createRound(client, event, rounds, round + 1, seeds, after, nowMs);
  const allWalkovers = now.every((m) => m.walkover);
  await updateRounds(client, event.id, { current_round: round + 1, round_starts_at: iso(allWalkovers ? nowMs : nowMs + ROUND_BREAK_MS) });
  return true;
}

const swissPlayersOf = (seeds: readonly TournamentSeedRow[]): SwissPlayer[] => seeds.map((s) => ({ id: s.user_id, order: s.seed }));

const swissMatchesOf = (matches: readonly TournamentMatchRow[]): SwissMatch[] =>
  matches
    .filter((m) => m.stage === "swiss" && m.player_a)
    .map((m) => ({
      round: m.round,
      a: m.player_a!,
      b: m.player_b,
      result:
        m.status === "settled"
          ? {
              winner: m.winner,
              totalA: m.total_a ?? 0,
              totalB: m.total_b ?? 0,
              noPoints: [...(m.flagged_a && m.player_a ? [m.player_a] : []), ...(m.flagged_b && m.player_b ? [m.player_b] : [])],
            }
          : null,
    }));

function koMatchOf(m: TournamentMatchRow, seedOfUser: ReadonlyMap<string, number>): KoMatch {
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
  rounds: TournamentRoundsRow,
  round: number,
  seeds: readonly TournamentSeedRow[],
  matches: readonly TournamentMatchRow[],
  nowMs: number,
): Promise<void> {
  if (matches.some((m) => m.round === round)) return;
  const settledAt = iso(nowMs);
  if (event.kind === "category_cup") {
    const pairs = pairSwissRound(swissPlayersOf(seeds), swissMatchesOf(matches));
    // Every row carries every column (one insert of many rows names the same columns for each).
    await insertMatches(
      client,
      pairs.map((p, slot) => {
        const bye = p.b === null;
        return {
          event_id: event.id,
          stage: "swiss",
          round,
          slot,
          player_a: p.a,
          player_b: p.b,
          status: bye ? "settled" : "pending",
          winner: bye ? p.a : null,
          walkover: bye,
          games_a: bye ? 0 : null,
          games_b: bye ? 0 : null,
          total_a: bye ? 0 : null,
          total_b: bye ? 0 : null,
          settled_at: bye ? settledAt : null,
        };
      }),
    );
    recordEvents({ event: "swiss_round_paired", props: { round, players: seeds.length } });
    return;
  }
  const userOfSeed = new Map(seeds.map((s) => [s.seed, s.user_id]));
  const seedOfUser = new Map(seeds.map((s) => [s.user_id, s.seed]));
  let ko: KoMatch[];
  if (round === 1) ko = firstRound(seeds.length);
  else {
    const before = matches
      .filter((m) => m.round === round - 1 && m.stage === "knockout")
      .sort((a, b) => a.slot - b.slot)
      .map((m) => koMatchOf(m, seedOfUser));
    ko = nextRound(before);
    if (round === rounds.rounds_total) {
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
        settled_at: walk ? settledAt : null,
      };
    }),
  );
}

/** The games of a match room, side a = slot 1, side b = slot 2 (a game with no answer scores 0). */
function gamesOf(puzzles: readonly PuzzleData[], results: readonly RoundResultRow[]): GameScores[] {
  return puzzles.map((puzzle, i) => {
    const row = (slot: number) => results.find((r) => r.player_slot === slot && r.round_number === i + 1);
    const tie = tieRoundFor(puzzle);
    return { a: row(1)?.score ?? 0, b: row(2)?.score ?? 0, aTimeMs: roundTimeUsedMs(row(1), tie), bTimeMs: roundTimeUsedMs(row(2), tie) };
  });
}

/** Every flag in a match's stored grades: the server's own `extra.flagged` (never anything a phone sent). */
export function matchFlagsOf(
  m: Pick<TournamentMatchRow, "player_a" | "player_b">,
  puzzles: readonly PuzzleData[],
  results: readonly Pick<RoundResultRow, "player_slot" | "round_number" | "extra">[],
): FlagLogRow[] {
  const out: FlagLogRow[] = [];
  for (const r of results) {
    const reason = serverFlag(r.extra);
    if (!reason) continue;
    const player = r.player_slot === 1 ? m.player_a : r.player_slot === 2 ? m.player_b : null;
    if (!player) continue;
    out.push({ player_id: player, game_idx: r.round_number - 1, game: puzzles[r.round_number - 1]?.type ?? null, reason });
  }
  return out;
}

/** Settles one match from its room once (true when it did). */
async function settleTournamentMatch(client: Db, event: TournamentEventRow, m: TournamentMatchRow, nowMs: number): Promise<boolean> {
  const { data: room } = await readRoom(client, m.duel_id!);
  const done = !!room && (room.status === "finished" || !!room.disbanded_at);
  const late = nowMs >= msOf(m.room_made_at) + MATCH_DEADLINE_MS;
  if (room && !done && !late) return false;
  if (!(await claimMatchStatus(client, m.id, "playing", { status: "settling" })).data) return false;
  try {
    let games: GameScores[] = [];
    let flags: FlagLogRow[] = [];
    if (room) {
      const { data: results } = await readRoomResults(client, room.id);
      const { data: priv } = await readPrivatePuzzles(client, room.id);
      const pubs = Array.isArray(room.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
      const puzzles = pubs.map((p, i) => mergePuzzle(p, priv?.[i]));
      games = gamesOf(puzzles, results ?? []);
      flags = matchFlagsOf(m, puzzles, results ?? []);
    }
    const flaggedA = flags.some((f) => f.player_id === m.player_a);
    const flaggedB = flags.some((f) => f.player_id === m.player_b);
    const outcome = matchOutcome(games);
    let winner: string | null;
    if (flaggedA || flaggedB) winner = flaggedA && flaggedB ? null : flaggedA ? m.player_b : m.player_a;
    else if (event.kind === "category_cup") winner = outcome.winner === "a" ? m.player_a : outcome.winner === "b" ? m.player_b : null;
    else winner = playedWinner({ seedA: m.seed_a, seedB: m.seed_b }, outcome.winner) === m.seed_a ? m.player_a : m.player_b;
    // Each flag for Joe's review, once, through W4b's tournament_flag (moderation.tournament_flags).
    for (const f of flags)
      await flagRpc(client, {
        eventId: event.id,
        playerId: f.player_id,
        source: event.kind === "category_cup" ? "cup_match" : "championship_match",
        sourceId: m.id,
        gameIdx: f.game_idx,
        game: f.game ?? "",
        reason: f.reason,
      });
    await claimMatchStatus(client, m.id, "settling", {
      status: "settled",
      winner,
      flagged_a: flaggedA,
      flagged_b: flaggedB,
      games_a: outcome.winsA,
      games_b: outcome.winsB,
      total_a: flaggedA ? 0 : outcome.totalA,
      total_b: flaggedB ? 0 : outcome.totalB,
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

/** Players any of whose runs in the event the server flagged: no place, so no prize, trophy, badge, frame or Joules. */
export function flaggedPlayers(matches: readonly Pick<TournamentMatchRow, "flagged_a" | "flagged_b" | "player_a" | "player_b">[]): Set<string> {
  const out = new Set<string>();
  for (const m of matches) {
    if (m.flagged_a && m.player_a) out.add(m.player_a);
    if (m.flagged_b && m.player_b) out.add(m.player_b);
  }
  return out;
}

/** Every unflagged player's final place (Swiss: the standings; Knockout: the bracket), places 1, 2, 3… among them. */
export function placesOf(
  kind: BigKind,
  rounds: Pick<TournamentRoundsRow, "bracket_size">,
  seeds: readonly TournamentSeedRow[],
  matches: readonly TournamentMatchRow[],
): { userId: string; place: number; points: number | null; total: number | null }[] {
  const flagged = flaggedPlayers(matches);
  if (kind === "category_cup") {
    const table = swissStandings(swissPlayersOf(seeds), swissMatchesOf(matches)).filter((s) => !flagged.has(s.id));
    return table.map((s, i) => ({ userId: s.id, place: i + 1, points: s.points2, total: s.totalScore }));
  }
  const seedOfUser = new Map(seeds.map((s) => [s.user_id, s.seed]));
  const userOfSeed = new Map(seeds.map((s) => [s.seed, s.user_id]));
  const ko = finalPlaces(rounds.bracket_size ?? 2, matches.map((m) => koMatchOf(m, seedOfUser)));
  const out: { userId: string; place: number; points: number | null; total: number | null }[] = [];
  for (const [seed, place] of ko) {
    const user = userOfSeed.get(seed);
    if (user && !flagged.has(user)) out.push({ userId: user, place, points: null, total: null });
  }
  return out.sort((a, b) => a.place - b.place);
}

/** The finish: W4b's results (unflagged players only) and its payEvent (coins, trophies, the tournament badges). */
async function finishBigEvent(
  client: Db,
  event: TournamentEventRow,
  rounds: TournamentRoundsRow,
  seeds: readonly TournamentSeedRow[],
  matches: readonly TournamentMatchRow[],
  nowMs: number,
): Promise<void> {
  const places = placesOf(event.kind as BigKind, rounds, seeds, matches);
  const { data: finished } = await finishRpc(
    client,
    event.id,
    places.map((p) => ({ user_id: p.userId, place: p.place, points: p.points, total: p.total, tie_ms: null })),
  );
  if (finished) for (const p of places) recordEvents({ event: "tournament_finished", playerId: p.userId, props: { kind: event.kind, place: p.place } });
  const { payEvent } = await import("./tournaments.server");
  await payEvent(client, event.id, nowMs);
}

/** The finish's own awards, once each and logged: the winner's badge, the frame and the hall of fame, and Joules. */
async function awardExtras(client: Db, event: TournamentEventRow, nowMs: number): Promise<void> {
  const kind = event.kind as BigKind;
  const { data: results } = await readResults(client, event.id);
  const { data: logged } = await readAwards(client, event.id);
  const paid = new Set(logged.map((a) => `${a.user_id}:${a.kind}`));
  const { awardBadge } = await import("@/lib/badges/badges.server");
  const economy = await import("@/lib/economy/economy.server");
  const once = async (userId: string, what: "badge" | "frame" | "hall_of_fame" | "joules", place: number, amount: number | null, pay: () => Promise<void>) => {
    if (paid.has(`${userId}:${what}`)) return;
    await pay();
    await insertAward(client, { event_id: event.id, user_id: userId, kind: what, place, amount });
  };
  try {
    for (const r of results) {
      if (r.place === 1) {
        await once(r.user_id, "badge", 1, null, async () => {
          const s = await awardBadge(client, r.user_id, WINNER_BADGE[kind], { event: event.id });
          if (s !== "awarded" && s !== "owned" && s !== "no_account") throw new Error(`badge ${s}`);
        });
        if (kind === "championship") {
          await once(r.user_id, "frame", 1, null, async () => {
            const s = await economy.grantItem(client, { userId: r.user_id, itemId: CHAMPIONSHIP_FRAME, how: "earned" });
            if (s !== "granted" && s !== "owned" && s !== "no_account") throw new Error(`frame ${s}`);
          });
          await once(r.user_id, "hall_of_fame", 1, null, async () => {
            await insertHallOfFame(client, { month: event.id.split(":")[1]!, event_id: event.id, user_id: r.user_id });
          });
        }
      }
      await once(r.user_id, "joules", r.place, 150, async () => {
        await tournamentPlatform().awardJoules(client, { userId: r.user_id, eventId: event.id, atMs: nowMs });
      });
    }
    await updateRounds(client, event.id, { awarded_at: iso(nowMs) });
  } catch (err) {
    console.error("[tournaments] awards", event.id, err instanceof Error ? err.message : err);
  }
}

/* ------------------------------------------------------------------ the event page's extra */

export interface BigStandingRow {
  place: number;
  name: string;
  me: boolean;
  /** "3–1" (wins–losses), "3–1–1" with draws. */
  record: string;
  points: string;
}

export interface BigBracketMatch {
  stage: "knockout" | "third_place";
  round: number;
  slot: number;
  nameA: string | null;
  nameB: string | null;
  gamesA: number | null;
  gamesB: number | null;
  winner: "a" | "b" | null;
  live: boolean;
  walkover: boolean;
  me: boolean;
}

export interface BigMyMatch {
  roundLabel: string;
  opponent: string | null;
  opponentRecord: string | null;
  myRecord: string | null;
  bye: boolean;
  roomCode: string | null;
  state: "waiting" | "playing" | "done";
  result: "won" | "lost" | "drawn" | null;
}

export interface BigEventView {
  eventId: string;
  kind: BigKind;
  roundsTotal: number;
  currentRound: number;
  roundLabel: string | null;
  roundStartsAtMs: number | null;
  field: number;
  bracketSize: number | null;
  myMatch: BigMyMatch | null;
  /** The caller's own flagged run: their result doesn't count for now. */
  underReview: string | null;
  standings: BigStandingRow[];
  bracket: BigBracketMatch[];
}

const DELETED = "Deleted player";

async function namesOf(client: Db, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = [...new Set(ids)];
  for (let i = 0; i < list.length; i += 100) {
    const { data } = await readPublicProfiles(client, list.slice(i, i + 100));
    for (const p of data ?? []) out.set(p.user_id, p.username);
  }
  return out;
}

/** The round, the caller's match, the standings or the bracket (null before the start, or not one of W4c's events). */
export async function bigEventView(client: Db, eventId: string, userId: string): Promise<BigEventView | null> {
  const parsed = parseBigEventId(eventId);
  if (!parsed) return null;
  const kind = parsed.kind;
  const { data: rounds } = await readRounds(client, eventId);
  if (!rounds) return null;
  const { data: seeds } = await readSeeds(client, eventId);
  const { data: matches } = await readMatches(client, eventId);
  const names = await namesOf(client, seeds.map((s) => s.user_id));
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? DELETED) : null);
  const flagged = flaggedPlayers(matches);

  const recordOf = new Map<string, string>();
  let standings: BigStandingRow[] = [];
  if (kind === "category_cup") {
    const table = swissStandings(swissPlayersOf(seeds), swissMatchesOf(matches));
    for (const r of table) recordOf.set(r.id, r.draws ? `${r.wins + r.byes}–${r.losses}–${r.draws}` : `${r.wins + r.byes}–${r.losses}`);
    standings = table
      .filter((r) => !flagged.has(r.id))
      .map((r, i) => ({ place: i + 1, name: nameOf(r.id)!, me: r.id === userId, record: recordOf.get(r.id)!, points: pointsText(r.points2) }));
  }
  const bracket: BigBracketMatch[] =
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

  const mine = matches
    .filter((m) => m.player_a === userId || m.player_b === userId)
    .sort((a, b) => b.round - a.round || (a.stage < b.stage ? -1 : 1))[0];
  let myMatch: BigMyMatch | null = null;
  if (mine) {
    const opp = mine.player_a === userId ? mine.player_b : mine.player_a;
    const code = mine.duel_id ? ((await readRoom(client, mine.duel_id)).data?.room_code ?? null) : null;
    myMatch = {
      roundLabel:
        kind === "championship"
          ? mine.stage === "third_place"
            ? "Third-place match"
            : roundName(rounds.bracket_size ?? 2, mine.round)
          : `Round ${mine.round} of ${rounds.rounds_total}`,
      opponent: nameOf(opp),
      opponentRecord: opp ? (recordOf.get(opp) ?? null) : null,
      myRecord: recordOf.get(userId) ?? null,
      bye: !opp,
      roomCode: code,
      state: mine.status === "settled" ? "done" : mine.status === "pending" ? "waiting" : "playing",
      result: mine.status !== "settled" ? null : mine.winner === null ? "drawn" : mine.winner === userId ? "won" : "lost",
    };
  }
  return {
    eventId,
    kind,
    roundsTotal: rounds.rounds_total,
    currentRound: rounds.current_round,
    roundLabel:
      rounds.current_round > 0
        ? kind === "championship"
          ? roundName(rounds.bracket_size ?? 2, rounds.current_round)
          : `Round ${rounds.current_round} of ${rounds.rounds_total}`
        : null,
    roundStartsAtMs: rounds.round_starts_at ? msOf(rounds.round_starts_at) : null,
    field: rounds.field,
    bracketSize: rounds.bracket_size,
    myMatch,
    underReview: flagged.has(userId) ? UNDER_REVIEW_LINE : null,
    standings,
    bracket,
  };
}

/* ------------------------------------------------------------------ the hall of fame */

export interface HallOfFameEntry {
  month: string;
  label: string;
  name: string;
}

/** Every Championship winner, newest month first. */
export async function hallOfFame(client: Db): Promise<HallOfFameEntry[]> {
  const { data } = await readHallOfFame(client);
  const names = await namesOf(client, data.map((r) => r.user_id));
  return data.map((r) => ({ month: r.month, label: monthLabel(r.month), name: names.get(r.user_id) ?? DELETED }));
}

/** Whether a room is a Category Cup or Championship match (W4b's isTournamentRoom asks this too). */
export async function isBigEventRoom(client: Db, roomId: string): Promise<boolean> {
  try {
    const { data } = await readMatchByRoom(client, roomId);
    return !!data;
  } catch {
    return false; // a database without the tables: no such rooms
  }
}
