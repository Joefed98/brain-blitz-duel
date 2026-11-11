/**
 * Rated play's server flow (wave 3, W3b; docs/rated/matchmaking-interface.md): the queue, live and recorded matches on
 * the rooms engine, recorded-run choice and playback, settling (W3a's recordRatedMatch once per match), live progress
 * with the hidden finish, and rematch. Server only; the phone reaches it through rated.functions.ts.
 *
 * Nothing here deals differently, grades, scores or stamps: a live match's rounds come from dealRoomRounds and
 * buildRoomPuzzles exactly as a settings room's do (Classic: today's live deal), a recorded match's are the stored run's
 * own puzzles, copied, and every score is the room's grading (submitAnswerFn) or the stored score of the run.
 */
import { categoriesOfPicks, encodeRoomSettings, type RoomPick } from "@/lib/duel/roomSettings";
import { dealRoomRounds } from "@/lib/duel/roomDeal";
import { mergePuzzle, splitPuzzle } from "@/lib/duel/secrets";
import { generateRoomCode } from "@/lib/duel/puzzles";
import { puzzleTimeLimitMs } from "@/lib/duel/catalogue";
import { tieRoundFor } from "@/lib/duel/tieBreak";
import { roundTimeUsedMs } from "@/lib/duel/scoring";
import { ukDayKey, ukDayWindow } from "@/lib/duel/daily";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { asJson, UNIQUE_VIOLATION, type Db, type Json } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import { claimRoomStart, insertRoom, readRoom, writePrivatePuzzles } from "@/lib/data/rooms.server";
import { readPlayers } from "@/lib/data/players.server";
import { readRoomResults } from "@/lib/data/results.server";
import {
  claimQueue,
  claimRematch,
  claimSettle,
  deleteClaimedEntry,
  deleteWaitingEntry,
  insertMatchPlayers,
  insertRatedMatch,
  insertRatedRuns,
  markSettled,
  readDailyAttemptSource,
  readFinishedDailyAttemptIds,
  readFinishedRoomIds,
  readFinishedRoomSource,
  readIsRatedTester,
  readLastRecordedOwner,
  readMatchPlayers,
  readOpenMatchIds,
  readProgress,
  readQueueEntry,
  readRatedMatch,
  readRatedRoomIds,
  readRatedRun,
  readRatedRuns,
  readRunUses,
  readWaiting,
  releaseClaim,
  releaseSettle,
  useRun,
  writeProgress,
  writeQueueEntry,
  writeRematchAccept,
  type RatedMatchPlayerRow,
  type RatedMatchRow,
  type RatedQueueRow,
} from "@/lib/data/rated.server";

import {
  bandFor,
  bestPartner,
  chooseRecordedRun,
  FORMAT_GAMES,
  FORMAT_PLAYERS,
  gameVersionOf,
  gameWinner,
  isRatedChoice,
  isRatedFormat,
  matchOutcome,
  matchSettings,
  openOptions,
  opponentScoreHidden,
  RATED_GAME_MODE,
  RATED_SWITCHES,
  ratedOptionRefusal,
  ratedPlayOpenFor,
  RECORDED_DAILY_USES,
  RECORDED_WINDOW_MS,
  recordedAgeLabel,
  recordedDue,
  recordedViewAt,
  rematchAgreed,
  rematchOpen,
  timelineValid,
  typeFitsChoice,
  type GameScores,
  type QueueEntry,
  type RatedChoice,
  type RatedFormat,
  type RatedSwitches,
  type RecordedCandidate,
  type RecordedGame,
  type RecordedSource,
} from "./matchmaking";
import { ratings, toRatingsResult, type RatedSettlement, type SettledPlayer } from "./ratingsAdapter.server";
import { scoreTimeline } from "./timeline.server";

/* ------------------------------------------------------------------ shapes the phone gets */

export type RatedRefusalReason = "account" | "closed" | "option" | "banned" | "rate_limit" | "no_rating" | "in_match";

export interface RatedStatus {
  account: boolean;
  open: boolean;
  options: { formats: RatedFormat[]; choices: RatedChoice[] };
  searching: { format: RatedFormat; choice: RatedChoice; joinedAtMs: number } | null;
  activeMatchId: string | null;
}

export interface RatedMatchView {
  matchId: string;
  format: RatedFormat;
  choice: RatedChoice;
  gameMode: typeof RATED_GAME_MODE;
  kind: "live" | "recorded";
  roomId: string | null;
  roomCode: string | null;
  status: string;
  players: { userId: string; slot: number; displayName: string; ratingBefore: number; placement: boolean }[];
  recorded: {
    label: string;
    recordedAtMs: number;
    ownerId: string;
    ownerName: string;
    /** The owner's stored look per game (E1's `look` on the source's results; null for none). */
    look: (Json | null)[];
    fallback: boolean;
  } | null;
  rematchOf: string | null;
}

export type QueuePoll =
  | { state: "idle" }
  | { state: "searching"; waitedMs: number; band: number }
  | { state: "found"; match: RatedMatchView };

export interface OpponentScore {
  round: number;
  score: number | null;
  finished: boolean;
  hidden: boolean;
}

/* ------------------------------------------------------------------ the stored recorded games */

/** A recorded match's opponent games as stored on the match (server only). */
interface StoredRecordedGame extends RecordedGame {
  timeMs: number;
  limitMs: number;
}

interface StoredRecorded {
  ownerName: string;
  games: StoredRecordedGame[];
  looks: (Json | null)[];
}

/** One stored round of a source run, ready to be a candidate (the puzzle merged, its result). */
interface SourceRound {
  puzzle: PuzzleData;
  score: number;
  msRemaining: number;
  reactionAvgMs: number | null;
  answer: string | null;
  look: Json | null;
}

interface SourceRun {
  candidate: RecordedCandidate;
  ownerName: string;
  rounds: SourceRound[];
}

/* ------------------------------------------------------------------ helpers */

const nowIso = (ms: number) => new Date(ms).toISOString();
const msOf = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN);

function ukDayStartIso(nowMs: number): string {
  return nowIso(ukDayWindow(ukDayKey(nowMs)).opensAt);
}

async function hasAccount(client: Db, userId: string): Promise<{ account: boolean; name: string | null }> {
  const { accountNameOf } = await import("@/lib/names/playerName.server");
  const name = await accountNameOf(client, userId);
  return { account: name !== null, name };
}

async function isOpenTo(client: Db, userId: string, switches: RatedSwitches): Promise<boolean> {
  if (switches.forEveryone) return true;
  const { data } = await readIsRatedTester(client, userId);
  return ratedPlayOpenFor(data === true, switches);
}

function recordedTiming(puzzle: PuzzleData, msRemaining: number, reactionAvgMs: number | null): { timeMs: number; finishMs: number | null; limitMs: number } {
  const limitMs = puzzleTimeLimitMs(puzzle);
  const row = { ms_remaining: msRemaining, reaction_avg_ms: reactionAvgMs } as RoundResultRow;
  const timeMs = roundTimeUsedMs(row, tieRoundFor(puzzle));
  return { timeMs, finishMs: msRemaining > 0 ? Math.max(0, limitMs - msRemaining) : null, limitMs };
}

function toRecordedGame(round: SourceRound, withTimeline: boolean): StoredRecordedGame {
  const { timeMs, finishMs, limitMs } = recordedTiming(round.puzzle, round.msRemaining, round.reactionAvgMs);
  let timeline = withTimeline && round.answer ? scoreTimeline(round.puzzle, round.answer, round.score) : null;
  if (timeline && !timelineValid(timeline, round.score, Math.max(limitMs, (timeline.at(-1)?.[0] ?? 0)))) timeline = null;
  return {
    type: round.puzzle.type,
    signature: gameVersionOf(round.puzzle),
    score: round.score,
    finishMs,
    timeline,
    timeMs,
    limitMs,
  };
}

/* ------------------------------------------------------------------ status and the queue */

export async function ratedStatus(client: Db, userId: string, switches: RatedSwitches = RATED_SWITCHES): Promise<RatedStatus> {
  const { account } = await hasAccount(client, userId);
  const open = account && (await isOpenTo(client, userId, switches));
  const { data: entry } = await readQueueEntry(client, userId);
  const { data: openIds } = await readOpenMatchIds(client, userId);
  return {
    account,
    open,
    options: open ? openOptions(switches) : { formats: [], choices: [] },
    searching:
      entry && !entry.match_id && isRatedFormat(entry.format) && isRatedChoice(entry.choice)
        ? { format: entry.format, choice: entry.choice, joinedAtMs: msOf(entry.joined_at) }
        : null,
    activeMatchId: openIds?.[0] ?? null,
  };
}

export type JoinOutcome = { ok: true; joinedAtMs: number } | { ok: false; reason: RatedRefusalReason; message: string };

export async function joinQueue(
  client: Db,
  userId: string,
  input: { format: unknown; choice: unknown },
  nowMs: number,
  switches: RatedSwitches = RATED_SWITCHES,
): Promise<JoinOutcome> {
  const { account } = await hasAccount(client, userId);
  if (!account) return { ok: false, reason: "account", message: "Rated play needs an account." };
  if (!(await isOpenTo(client, userId, switches))) return { ok: false, reason: "closed", message: "Rated play isn’t open yet." };
  const refusal = ratedOptionRefusal(input.format, input.choice, switches);
  if (refusal) return { ok: false, reason: "option", message: refusal };
  const format = input.format as RatedFormat;
  const choice = input.choice as RatedChoice;
  const { roomRefusal } = await import("@/lib/safety/moderation.server");
  const banned = await roomRefusal(client, userId);
  if (banned) return { ok: false, reason: "banned", message: banned };
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const { RATED_QUEUE_LIMIT } = await import("./matchmaking");
  if (!(await withinRateLimit(client, userId, RATED_QUEUE_LIMIT)))
    return { ok: false, reason: "rate_limit", message: "That’s a lot of searches. Give it a few minutes." };
  // Finished matches are settled first (so W3a has every result before the next rating), and a match still being
  // played blocks a new search.
  await settleOpenMatches(client, userId, nowMs);
  const { data: openIds } = await readOpenMatchIds(client, userId);
  if (openIds?.length) return { ok: false, reason: "in_match", message: "You’re already in a match." };
  const rating = await ratings().matchRating(userId, { format, choice });
  if (!rating) return { ok: false, reason: "no_rating", message: "Rated play isn’t ready yet." };
  const { error } = await writeQueueEntry(client, {
    user_id: userId,
    format,
    choice,
    rating: Math.round(rating.rating),
    placement: rating.placement,
    joined_at: nowIso(nowMs),
  });
  if (error) throw new Error("Couldn’t start the search. Give it another go.");
  recordEvents({ event: "queue_joined", playerId: userId, props: { format, choice } });
  return { ok: true, joinedAtMs: nowMs };
}

export async function leaveQueue(client: Db, userId: string): Promise<void> {
  await deleteWaitingEntry(client, userId);
}

function entryOf(row: RatedQueueRow): QueueEntry | null {
  if (!isRatedFormat(row.format) || !isRatedChoice(row.choice)) return null;
  return { userId: row.user_id, format: row.format, choice: row.choice, rating: row.rating, joinedAtMs: msOf(row.joined_at), placement: row.placement };
}

function foundEvent(userId: string, entry: QueueEntry, kind: "live" | "recorded", nowMs: number): void {
  recordEvents({
    event: "match_found",
    playerId: userId,
    props: { kind, waited_s: Math.max(0, Math.round((nowMs - entry.joinedAtMs) / 100) / 10), format: entry.format, choice: entry.choice },
  });
}

/** One poll of a searcher: pair them live, or from 8 s (placement: at once) give them a recorded run. */
export async function pollQueue(client: Db, userId: string, nowMs: number): Promise<QueuePoll> {
  const { data: row } = await readQueueEntry(client, userId);
  if (!row) return { state: "idle" };
  const me = entryOf(row);
  if (!me) return { state: "idle" };
  if (row.match_id) {
    const view = await matchView(client, row.match_id, userId, nowMs);
    if (!view) return { state: "searching", waitedMs: nowMs - me.joinedAtMs, band: bandFor(nowMs - me.joinedAtMs) };
    await deleteClaimedEntry(client, userId, row.match_id);
    foundEvent(userId, me, view.kind, nowMs);
    return { state: "found", match: view };
  }
  const waitedMs = nowMs - me.joinedAtMs;
  if (!me.placement) {
    const { data: rows } = await readWaiting(client, me.format, me.choice);
    const waiting = (rows ?? []).map(entryOf).filter((e): e is QueueEntry => e !== null);
    const partner = FORMAT_PLAYERS[me.format] === 2 ? bestPartner(me, waiting, nowMs) : null;
    if (partner) {
      const matchId = crypto.randomUUID();
      const { data: claimed } = await claimQueue(client, { users: [me.userId, partner.userId], matchId, format: me.format, choice: me.choice });
      if (claimed) {
        await createLiveMatch(client, { matchId, format: me.format, choice: me.choice, players: [me, partner], rematchOf: null }, nowMs);
        return pollQueue(client, userId, nowMs);
      }
    }
  }
  if (me.placement || recordedDue(waitedMs)) {
    const made = await makeRecordedMatch(client, me, nowMs);
    if (made) return pollQueue(client, userId, nowMs);
  }
  return { state: "searching", waitedMs, band: bandFor(waitedMs) };
}

/* ------------------------------------------------------------------ making matches */

interface NewRoomPlayer {
  userId: string;
  slot: number;
}

/** An ordinary room, already started, holding exactly these puzzles and players (the rooms engine runs it from here). */
async function createStartedRoom(
  client: Db,
  input: { players: NewRoomPlayer[]; puzzles: PuzzleData[]; picks: readonly RoomPick[] },
  nowMs: number,
): Promise<{ id: string; code: string }> {
  const startedAt = nowIso(nowMs);
  const split = input.puzzles.map(splitPuzzle);
  const roundOrder = input.puzzles.map((p) => p.type);
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await insertRoom(client, {
      room_code: generateRoomCode(),
      status: "waiting",
      host_user_id: input.players[0]!.userId,
      max_players: input.players.length,
      round_count: roundOrder.length,
      round_order: [],
      selected_categories: encodeRoomSettings({ picks: [...input.picks], rounds: roundOrder.length }),
      puzzles_public: [],
      current_round: 0,
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) continue;
      throw new Error("Couldn’t set up the match. Give it another go.");
    }
    const room = data!;
    const { insertPlayerWithLook } = await import("@/lib/duel/playerLook.server");
    const { accountNameOf } = await import("@/lib/names/playerName.server");
    for (const p of input.players) {
      await insertPlayerWithLook(client, {
        duel_id: room.id,
        player_slot: p.slot,
        user_id: p.userId,
        display_name: (await accountNameOf(client, p.userId)) ?? "Player",
        status: "active",
      });
    }
    await claimRoomStart(client, room.id, {
      round_order: roundOrder,
      round_count: roundOrder.length,
      puzzles_public: asJson(split.map((s) => s.pub)),
      status: "in_progress",
      current_round: 1,
      phase: "starting",
      phase_started_at: startedAt,
      round_started_at: startedAt,
    });
    const { error: privError } = await writePrivatePuzzles(client, room.id, asJson(split.map((s) => s.priv)));
    if (privError) throw new Error("Couldn’t set up the match. Give it another go.");
    const { recordRoundRecords, roundRecords } = await import("@/lib/duel/betaRecord.server");
    await recordRoundRecords(
      client,
      room.id,
      roundRecords(input.puzzles as unknown as (Record<string, unknown> & { type: string })[], (p) => puzzleTimeLimitMs(p as unknown as PuzzleData)),
    );
    return { id: room.id, code: room.room_code };
  }
  throw new Error("Couldn’t set up the match. Give it another go.");
}

/** A live match: a fresh Classic deal from the room picks on a new room seed, the same for every player. */
export async function createLiveMatch(
  client: Db,
  input: { matchId: string; format: RatedFormat; choice: RatedChoice; players: QueueEntry[]; rematchOf: string | null },
  nowMs: number,
): Promise<void> {
  const settings = matchSettings(input.format, input.choice);
  const { newRoomSeed } = await import("@/lib/duel/selection");
  const { buildRoomPuzzles } = await import("@/lib/duel/generate.server");
  const { drawUnblockRow } = await import("@/lib/duel/unblock.server");
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
  const players = input.players.map((p, i) => ({ userId: p.userId, slot: i + 1 }));
  const room = await createStartedRoom(client, { players, puzzles, picks: settings.picks }, nowMs);
  const { error } = await insertRatedMatch(client, {
    id: input.matchId,
    format: input.format,
    choice: input.choice,
    game_mode: RATED_GAME_MODE,
    kind: "live",
    duel_id: room.id,
    rematch_of: input.rematchOf,
  });
  if (error) throw new Error("Couldn’t set up the match. Give it another go.");
  await insertMatchPlayers(
    client,
    input.players.map((p, i) => ({ match_id: input.matchId, user_id: p.userId, slot: i + 1, rating_before: p.rating, placement: p.placement })),
  );
}

/** Recorded runs from rated matches (the first pool). */
async function ratedRunCandidates(client: Db, me: QueueEntry, sinceIso: string): Promise<SourceRun[]> {
  const { data: runs } = await readRatedRuns(client, me.format, me.choice, sinceIso);
  const out: SourceRun[] = [];
  for (const run of runs ?? []) {
    if (run.owner_id === me.userId) continue;
    const games = Array.isArray(run.games) ? (run.games as unknown as StoredRecordedGame[]) : [];
    out.push({
      candidate: {
        key: run.key,
        source: "rated",
        ownerId: run.owner_id,
        ownerRating: run.owner_rating,
        format: isRatedFormat(run.format) ? run.format : null,
        choice: isRatedChoice(run.choice) ? run.choice : null,
        games,
        recordedAtMs: msOf(run.recorded_at),
        usesToday: 0,
      },
      ownerName: "",
      // The rounds (the deals) are read only for the chosen run (sourceRounds).
      rounds: [],
    });
  }
  return out;
}

/** The name accounts.forget_user gives a removed account's rows (docs/accounts/README.md): such runs are never shown. */
const DELETED_NAMES = new Set(["Deleted player"]);

/** How many rooms and Daily attempts the fallback looks through (newest first). */
const FALLBACK_SCAN = 40;

/** A room or Daily attempt's rounds that fit the choice, as one owner's run of exactly the format's games. */
function sourceRunOf(
  base: { key: string; source: RecordedSource; ownerId: string; recordedAtMs: number; ownerName: string },
  rounds: SourceRound[],
  me: QueueEntry,
): SourceRun | null {
  const fitting = rounds.filter((r) => typeFitsChoice(r.puzzle.type, me.choice)).slice(0, FORMAT_GAMES[me.format]);
  if (fitting.length !== FORMAT_GAMES[me.format]) return null;
  const games = fitting.map((r) => toRecordedGame(r, false));
  return {
    candidate: { key: base.key, source: base.source, ownerId: base.ownerId, ownerRating: null, format: null, choice: null, games, recordedAtMs: base.recordedAtMs, usesToday: 0 },
    ownerName: base.ownerName,
    rounds: fitting,
  };
}

/** The fallback pool: real players' server-graded runs from rooms and the Daily (their owners' ratings never move). */
async function fallbackCandidates(client: Db, me: QueueEntry, sinceIso: string): Promise<SourceRun[]> {
  const out: SourceRun[] = [];
  const { data: roomIds } = await readFinishedRoomIds(client, sinceIso, FALLBACK_SCAN);
  const { data: ratedRooms } = await readRatedRoomIds(client, roomIds ?? []);
  for (const roomId of roomIds ?? []) {
    if (ratedRooms?.has(roomId)) continue;
    const { data: src } = await readFinishedRoomSource(client, roomId);
    if (!src || !Array.isArray(src.room.puzzles_public)) continue;
    const pubs = src.room.puzzles_public as unknown as PuzzleData[];
    for (const player of src.players) {
      if (!player.user_id || player.user_id === me.userId) continue;
      const rounds: SourceRound[] = [];
      for (let i = 0; i < pubs.length; i++) {
        const result = src.results.find((r) => r.player_slot === player.player_slot && r.round_number === i + 1);
        if (!result) continue;
        rounds.push({
          puzzle: mergePuzzle(pubs[i]!, src.privatePuzzles[i]),
          score: result.score,
          msRemaining: result.ms_remaining,
          reactionAvgMs: result.reaction_avg_ms,
          answer: result.answer,
          look: result.look,
        });
      }
      const run = sourceRunOf(
        { key: `room:${roomId}:${player.player_slot}`, source: "room", ownerId: player.user_id, recordedAtMs: msOf(src.room.phase_started_at), ownerName: player.display_name },
        rounds,
        me,
      );
      if (run) out.push(run);
    }
  }
  const { data: attemptIds } = await readFinishedDailyAttemptIds(client, sinceIso, FALLBACK_SCAN);
  for (const attemptId of attemptIds ?? []) {
    const { data: src } = await readDailyAttemptSource(client, attemptId);
    if (!src || src.attempt.user_id === me.userId || !Array.isArray(src.room.puzzles_public)) continue;
    const pubs = src.room.puzzles_public as unknown as PuzzleData[];
    const rounds: SourceRound[] = [];
    for (let i = 0; i < pubs.length; i++) {
      const result = src.results.find((r) => r.round_number === i + 1 && r.answered);
      if (!result) continue;
      rounds.push({
        puzzle: mergePuzzle(pubs[i]!, src.privatePuzzles[i]),
        score: result.score,
        msRemaining: result.ms_remaining,
        reactionAvgMs: result.reaction_avg_ms,
        answer: result.answer,
        look: result.look,
      });
    }
    const run = sourceRunOf(
      { key: `daily:${attemptId}`, source: "daily", ownerId: src.attempt.user_id, recordedAtMs: msOf(src.attempt.finished_at), ownerName: src.attempt.display_name },
      rounds,
      me,
    );
    if (run) out.push(run);
  }
  return out;
}

/** A rated run's rounds: its room's stored puzzles and the owner's results there. */
async function ratedRunRounds(client: Db, key: string, me: QueueEntry): Promise<{ rounds: SourceRound[]; ownerName: string } | null> {
  const { data: run } = await readRatedRun(client, key);
  if (!run || run.format !== me.format || run.choice !== me.choice) return null;
  const { data: src } = await readFinishedRoomSource(client, run.duel_id);
  if (!src || !Array.isArray(src.room.puzzles_public)) return null;
  const pubs = src.room.puzzles_public as unknown as PuzzleData[];
  const rounds: SourceRound[] = [];
  for (let i = 0; i < pubs.length; i++) {
    const result = src.results.find((r) => r.player_slot === run.slot && r.round_number === i + 1);
    rounds.push({
      puzzle: mergePuzzle(pubs[i]!, src.privatePuzzles[i]),
      score: result?.score ?? 0,
      msRemaining: result?.ms_remaining ?? 0,
      reactionAvgMs: result?.reaction_avg_ms ?? null,
      answer: result?.answer ?? null,
      look: result?.look ?? null,
    });
  }
  const ownerName = src.players.find((p) => p.player_slot === run.slot)?.display_name ?? "Player";
  return { rounds, ownerName };
}

/** A recorded match for `me`: the chosen run's deals copied into a new room. False: nothing fits yet. */
export async function makeRecordedMatch(client: Db, me: QueueEntry, nowMs: number): Promise<boolean> {
  const sinceIso = nowIso(nowMs - RECORDED_WINDOW_MS);
  const dayStart = ukDayStartIso(nowMs);
  const rated = await ratedRunCandidates(client, me, sinceIso);
  const pool = [...rated, ...(await fallbackCandidates(client, me, sinceIso))];
  const { data: uses } = await readRunUses(client, pool.map((r) => r.candidate.key), dayStart);
  for (const run of pool) run.candidate.usesToday = uses?.get(run.candidate.key) ?? 0;
  const { data: lastOwnerId } = await readLastRecordedOwner(client, me.userId);
  const backend = ratings();
  const ctx = {
    viewerId: me.userId,
    rating: me.placement ? backend.startingRating : me.rating,
    format: me.format,
    choice: me.choice,
    lastOwnerId: lastOwnerId ?? null,
    nowMs,
    beginnerMax: me.placement ? backend.beginnerMax : null,
  };
  // A run whose owner has since deleted their account (or asked to) is never shown: chosen again without it.
  const { accountNameOf } = await import("@/lib/names/playerName.server");
  let candidates = pool.map((r) => r.candidate);
  let picked = chooseRecordedRun(candidates, ctx, backend.startingRating);
  for (let tries = 0; picked && tries < 8; tries++) {
    const owner = picked.candidate;
    const live = owner.source === "rated" ? (await accountNameOf(client, owner.ownerId)) !== null : !DELETED_NAMES.has(pool.find((r) => r.candidate.key === owner.key)?.ownerName ?? "");
    if (live) break;
    candidates = candidates.filter((c) => c.ownerId !== owner.ownerId);
    picked = chooseRecordedRun(candidates, ctx, backend.startingRating);
  }
  if (!picked) return false;
  const chosen = picked;
  const run = pool.find((r) => r.candidate.key === chosen.candidate.key)!;
  let rounds = run.rounds;
  let ownerName = run.ownerName;
  if (run.candidate.source === "rated") {
    const read = await ratedRunRounds(client, run.candidate.key, me);
    if (!read) return false;
    rounds = read.rounds;
    ownerName = read.ownerName;
  }
  const matchId = crypto.randomUUID();
  const { data: claimed } = await claimQueue(client, { users: [me.userId], matchId, format: me.format, choice: me.choice });
  if (!claimed) return true; // paired live meanwhile: the next poll finds it
  const { data: used } = await useRun(client, { key: run.candidate.key, viewerId: me.userId, matchId, dayStartIso: dayStart, max: RECORDED_DAILY_USES });
  if (!used) {
    await releaseClaim(client, me.userId, matchId);
    return false;
  }
  // The stored games played against (with their timelines, made now from the stored runs; a rated run's are stored).
  const games: StoredRecordedGame[] =
    run.candidate.source === "rated"
      ? (run.candidate.games as StoredRecordedGame[])
      : rounds.map((r) => toRecordedGame(r, true));
  const stored: StoredRecorded = { ownerName, games, looks: rounds.map((r) => r.look) };
  const room = await createStartedRoom(client, { players: [{ userId: me.userId, slot: 1 }], puzzles: rounds.map((r) => r.puzzle), picks: matchSettings(me.format, me.choice).picks }, nowMs);
  const { error } = await insertRatedMatch(client, {
    id: matchId,
    format: me.format,
    choice: me.choice,
    game_mode: RATED_GAME_MODE,
    kind: "recorded",
    duel_id: room.id,
    recorded_key: run.candidate.key,
    recorded_source: run.candidate.source,
    recorded_owner: run.candidate.ownerId,
    recorded_owner_rating: run.candidate.ownerRating,
    recorded_fallback: picked.fallback,
    recorded_at: nowIso(run.candidate.recordedAtMs),
    recorded_games: asJson(stored),
    recorded_look: asJson(stored.looks),
  });
  if (error) throw new Error("Couldn’t set up the match. Give it another go.");
  await insertMatchPlayers(client, [{ match_id: matchId, user_id: me.userId, slot: 1, rating_before: me.rating, placement: me.placement }]);
  return true;
}

/* ------------------------------------------------------------------ the match view */

function storedRecorded(match: RatedMatchRow): StoredRecorded | null {
  const raw = match.recorded_games as unknown as StoredRecorded | null;
  return raw && Array.isArray(raw.games) ? raw : null;
}

export async function matchView(client: Db, matchId: string, userId: string, nowMs: number): Promise<RatedMatchView | null> {
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match || !isRatedFormat(match.format) || !isRatedChoice(match.choice)) return null;
  const { data: players } = await readMatchPlayers(client, matchId);
  if (!players?.some((p) => p.user_id === userId)) return null;
  const room = match.duel_id ? (await readRoom(client, match.duel_id)).data : null;
  const roomPlayers = room ? ((await readPlayers(client, room.id)).data ?? []) : [];
  const stored = storedRecorded(match);
  return {
    matchId,
    format: match.format,
    choice: match.choice,
    gameMode: RATED_GAME_MODE,
    kind: match.kind === "recorded" ? "recorded" : "live",
    roomId: room?.id ?? null,
    roomCode: room?.room_code ?? null,
    status: match.status,
    players: players.map((p) => ({
      userId: p.user_id,
      slot: p.slot,
      displayName: roomPlayers.find((rp) => rp.user_id === p.user_id)?.display_name ?? "Player",
      ratingBefore: p.rating_before,
      placement: p.placement,
    })),
    recorded:
      match.kind === "recorded" && match.recorded_owner && stored
        ? {
            label: recordedAgeLabel(msOf(match.recorded_at), nowMs),
            recordedAtMs: msOf(match.recorded_at),
            ownerId: match.recorded_owner,
            ownerName: stored.ownerName,
            look: stored.looks,
            fallback: match.recorded_fallback === true,
          }
        : null,
    rematchOf: match.rematch_of,
  };
}

/* ------------------------------------------------------------------ live scores and the hidden finish */

async function participantMatch(client: Db, matchId: string, userId: string) {
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match || !match.duel_id) return null;
  const { data: players } = await readMatchPlayers(client, matchId);
  if (!players?.some((p) => p.user_id === userId)) return null;
  const { data: room } = await readRoom(client, match.duel_id);
  if (!room) return null;
  return { match, players, room };
}

/** The caller's live score this game (display only: never read to grade, rank or rate). */
export async function reportProgress(client: Db, userId: string, input: { matchId: string; round: number; score: number }): Promise<boolean> {
  const found = await participantMatch(client, input.matchId, userId);
  if (!found) return false;
  const { room } = found;
  if (room.phase !== "puzzle" || room.current_round !== input.round) return false;
  const score = Math.max(0, Math.min(1000, Math.round(Number(input.score) || 0)));
  await writeProgress(client, { match_id: input.matchId, user_id: userId, round_number: input.round, score, at: new Date().toISOString() });
  return true;
}

/** The opponent's score for the current game, as the caller may see it now. */
export async function opponentScore(client: Db, userId: string, matchId: string, nowMs: number): Promise<OpponentScore | null> {
  const found = await participantMatch(client, matchId, userId);
  if (!found) return null;
  const { match, players, room } = found;
  const round = room.current_round;
  const puzzles = Array.isArray(room.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
  const puzzle = puzzles[round - 1];
  if (!puzzle) return { round, score: null, finished: false, hidden: false };
  const limitMs = puzzleTimeLimitMs(puzzle);
  const inPlay = room.phase === "puzzle";
  const elapsedMs = inPlay ? nowMs - msOf(room.phase_started_at) : 0;
  const before = room.phase === "starting" || room.phase === "round_title" || room.phase === "intro";
  if (match.kind === "recorded") {
    const game = storedRecorded(match)?.games[round - 1];
    if (!game) return { round, score: null, finished: false, hidden: false };
    if (before) return { round, score: null, finished: false, hidden: false };
    if (inPlay) {
      const view = recordedViewAt(game, elapsedMs, limitMs);
      return { round, score: view.score, finished: view.finished, hidden: view.hidden };
    }
    return { round, score: game.score, finished: true, hidden: false };
  }
  const other = players.find((p) => p.user_id !== userId);
  if (!other || before) return { round, score: null, finished: false, hidden: false };
  if (inPlay) {
    if (opponentScoreHidden(elapsedMs, limitMs)) return { round, score: null, finished: false, hidden: true };
    const { data: progress } = await readProgress(client, matchId);
    const row = (progress ?? []).find((p) => p.user_id === other.user_id && p.round_number === round);
    return { round, score: row?.score ?? 0, finished: false, hidden: false };
  }
  // The game's result is out: the stored score.
  const { data: results } = await readRoomResults(client, room.id);
  const stored = (results ?? []).find((r) => r.player_slot === other.slot && r.round_number === round);
  return { round, score: stored?.score ?? 0, finished: true, hidden: false };
}

/* ------------------------------------------------------------------ settling */

function roomFinishedAtMs(room: { status: string; phase: string; phase_started_at: string | null; disbanded_at: string | null }): number | null {
  if (room.disbanded_at) return msOf(room.disbanded_at);
  if (room.status === "finished") return msOf(room.phase_started_at);
  return null;
}

/** The server's result of a finished match (pure on what is stored). */
export function buildMatchResult(input: {
  match: RatedMatchRow;
  players: RatedMatchPlayerRow[];
  puzzles: PuzzleData[];
  results: RoundResultRow[];
  finishedAt: string;
}): RatedSettlement {
  const { match, players, puzzles, results } = input;
  const sideOf = (slot: number) => {
    const scores: number[] = [];
    const timesMs: number[] = [];
    puzzles.forEach((puzzle, i) => {
      const row = results.find((r) => r.player_slot === slot && r.round_number === i + 1);
      scores.push(row?.score ?? 0);
      timesMs.push(roundTimeUsedMs(row, tieRoundFor(puzzle)));
    });
    return { scores, timesMs };
  };
  const recorded = match.kind === "recorded" ? storedRecorded(match) : null;
  const a = sideOf(players[0]?.slot ?? 1);
  const b = recorded
    ? { scores: recorded.games.map((g) => g.score), timesMs: recorded.games.map((g) => g.timeMs) }
    : sideOf(players[1]?.slot ?? 2);
  const games: GameScores[] = puzzles.map((_, i) => ({ a: a.scores[i] ?? 0, b: b.scores[i] ?? 0, aTimeMs: a.timesMs[i] ?? 0, bTimeMs: b.timesMs[i] ?? 0 }));
  const outcome = matchOutcome(games);
  const sides = [a, b];
  const resultPlayers: SettledPlayer[] = players.map((p, i) => {
    const side = sides[i] ?? sideOf(p.slot);
    return {
      userId: p.user_id,
      slot: p.slot,
      ratingBefore: p.rating_before,
      placement: p.placement,
      scores: side.scores,
      timesMs: side.timesMs,
      gamesWon: i === 0 ? outcome.winsA : outcome.winsB,
      total: side.scores.reduce((s, v) => s + v, 0),
    };
  });
  return {
    matchId: match.id,
    format: match.format as RatedFormat,
    choice: match.choice as RatedChoice,
    gameMode: RATED_GAME_MODE,
    kind: match.kind === "recorded" ? "recorded" : "live",
    rematchOf: match.rematch_of,
    finishedAt: input.finishedAt,
    players: resultPlayers,
    games: puzzles.map((p, i) => ({ type: p.type, signature: gameVersionOf(p), winner: gameWinner(games[i]!) })),
    winner: outcome.winner,
    recorded:
      recorded && match.recorded_owner && match.recorded_key && match.recorded_source
        ? {
            ownerId: match.recorded_owner,
            key: match.recorded_key,
            source: match.recorded_source as RecordedSource,
            fallback: match.recorded_fallback === true,
            scores: b.scores,
            timesMs: b.timesMs,
          }
        : null,
    ratings: null,
  };
}

export type SettleOutcome = { state: "playing" } | { state: "settled"; result: RatedSettlement } | { state: "missing" };

/** Settles a finished match once: builds the result, calls W3a's recordRatedMatch, stores the players' runs. */
export async function settleMatch(client: Db, matchId: string, nowMs: number): Promise<SettleOutcome> {
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match) return { state: "missing" };
  if (match.status === "settled" && match.result) return { state: "settled", result: match.result as unknown as RatedSettlement };
  if (!match.duel_id) return { state: "missing" };
  const { data: room } = await readRoom(client, match.duel_id);
  if (!room) return { state: "missing" };
  const finishedMs = roomFinishedAtMs(room);
  if (finishedMs === null || match.status !== "playing") return { state: "playing" };
  const finishedAt = nowIso(Number.isFinite(finishedMs) ? finishedMs : nowMs);
  const { data: claimed } = await claimSettle(client, matchId, finishedAt);
  if (!claimed) return { state: "playing" };
  try {
    const { data: players } = await readMatchPlayers(client, matchId);
    const { data: results } = await readRoomResults(client, room.id);
    const { readPrivatePuzzles } = await import("@/lib/data/rooms.server");
    const { data: priv } = await readPrivatePuzzles(client, room.id);
    const pubs = Array.isArray(room.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
    const puzzles = pubs.map((p, i) => mergePuzzle(p, priv?.[i]));
    const result = buildMatchResult({ match: { ...match, finished_at: finishedAt }, players: players ?? [], puzzles, results: results ?? [], finishedAt });
    // W3a's recordRatedMatch, once per match (idempotent on the id): a passing failure throws and the settle retries.
    const forRatings = toRatingsResult(result);
    if (forRatings) result.ratings = await ratings().recordRatedMatch(forRatings);
    await markSettled(client, matchId, asJson(result), nowIso(nowMs));
    await storeRatedRuns(client, match, players ?? [], puzzles, results ?? []);
    return { state: "settled", result };
  } catch (error) {
    await releaseSettle(client, matchId);
    console.error("[rated] settle failed", matchId, error instanceof Error ? error.message : error);
    return { state: "playing" };
  }
}

/** Each live player's run of a settled match joins the recorded-run pool (a player who answered every game). */
async function storeRatedRuns(client: Db, match: RatedMatchRow, players: RatedMatchPlayerRow[], puzzles: PuzzleData[], results: RoundResultRow[]): Promise<void> {
  const rows = [];
  for (const p of players) {
    const rounds: SourceRound[] = [];
    for (let i = 0; i < puzzles.length; i++) {
      const row = results.find((r) => r.player_slot === p.slot && r.round_number === i + 1);
      if (!row) break;
      rounds.push({ puzzle: puzzles[i]!, score: row.score, msRemaining: row.ms_remaining, reactionAvgMs: row.reaction_avg_ms, answer: row.answer, look: (row as { look?: Json | null }).look ?? null });
    }
    if (rounds.length !== puzzles.length) continue;
    rows.push({
      key: `rated:${match.id}:${p.user_id}`,
      owner_id: p.user_id,
      match_id: match.id,
      format: match.format,
      choice: match.choice,
      owner_rating: p.rating_before,
      games: asJson(rounds.map((r) => toRecordedGame(r, true))),
      duel_id: match.duel_id!,
      slot: p.slot,
      look: asJson(rounds.map((r) => r.look)),
    });
  }
  await insertRatedRuns(client, rows);
}

/** Settles every finished match the player is in (a queue join runs it first). */
export async function settleOpenMatches(client: Db, userId: string, nowMs: number): Promise<void> {
  const { data: ids } = await readOpenMatchIds(client, userId);
  for (const id of ids ?? []) await settleMatch(client, id, nowMs);
}

/* ------------------------------------------------------------------ rematch */

export type RematchOutcome = { state: "waiting" } | { state: "agreed"; match: RatedMatchView } | { state: "closed" };

export async function requestRematch(client: Db, userId: string, matchId: string, nowMs: number, switches: RatedSwitches = RATED_SWITCHES): Promise<RematchOutcome> {
  const found = await participantMatch(client, matchId, userId);
  if (!found || found.match.kind !== "live") return { state: "closed" };
  const { match, room } = found;
  if (match.rematch_match_id) {
    const view = await matchView(client, match.rematch_match_id, userId, nowMs);
    return view ? { state: "agreed", match: view } : { state: "waiting" };
  }
  const finishedMs = roomFinishedAtMs(room);
  if (finishedMs === null || !rematchOpen(finishedMs, nowMs)) return { state: "closed" };
  if (ratedOptionRefusal(match.format, match.choice, switches)) return { state: "closed" };
  const mine = found.players.find((p) => p.user_id === userId)!;
  if (!mine.rematch_at) {
    await writeRematchAccept(client, matchId, userId, nowIso(nowMs));
    recordEvents({ event: "rematch_requested", playerId: userId, props: { format: match.format } });
  }
  const { data: players } = await readMatchPlayers(client, matchId);
  const accepts = (players ?? []).map((p) => (p.rematch_at ? msOf(p.rematch_at) : null));
  if (!rematchAgreed(finishedMs, accepts)) return { state: "waiting" };
  // Both are in: the previous match is settled first (W3a's 4-a-day count sees it), then one caller makes the rematch.
  await settleMatch(client, matchId, nowMs);
  const rematchId = crypto.randomUUID();
  const { data: claimed } = await claimRematch(client, matchId, rematchId);
  if (claimed) {
    const entries: QueueEntry[] = [];
    for (const p of players ?? []) {
      const rating = await ratings().matchRating(p.user_id, { format: match.format as RatedFormat, choice: match.choice as RatedChoice });
      entries.push({
        userId: p.user_id,
        format: match.format as RatedFormat,
        choice: match.choice as RatedChoice,
        rating: Math.round(rating?.rating ?? p.rating_before),
        joinedAtMs: nowMs,
        placement: rating?.placement ?? false,
      });
    }
    await createLiveMatch(client, { matchId: rematchId, format: match.format as RatedFormat, choice: match.choice as RatedChoice, players: entries, rematchOf: matchId }, nowMs);
    recordEvents({ event: "rematch_accepted", playerId: userId, props: { format: match.format } });
  }
  const { data: again } = await readRatedMatch(client, matchId);
  const view = again?.rematch_match_id ? await matchView(client, again.rematch_match_id, userId, nowMs) : null;
  return view ? { state: "agreed", match: view } : { state: "waiting" };
}

/** A rated room (Play again and settings are refused there). */
export async function isRatedRoom(client: Db, roomId: string): Promise<boolean> {
  const { readMatchByRoom } = await import("@/lib/data/rated.server");
  try {
    const { data } = await readMatchByRoom(client, roomId);
    return data !== null && data !== undefined;
  } catch {
    return false; // a database without the rated tables: no rated rooms
  }
}
