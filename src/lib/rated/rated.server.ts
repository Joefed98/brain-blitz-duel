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
import { DUEL_START_MS, ROUND_TITLE_MS } from "@/lib/duel/startPresentation";
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
  readSettledLiveMatchesBetween,
  claimMatchEnd,
  endRatedRoom,
  markMatchPlayerLeft,
  markMatchPlayersGone,
  markRoomPlayersLeft,
  readRatedRoomIds,
  readDeletionRequested,
  readRatedRun,
  readRecentPracticeDeals,
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
  type Side,
  departureVerdict,
  placeWithLeavers,
  type Departure,
  type DeparturePlayer,
  FORMAT_PLAYERS,
  gameVersionOf,
  gameWinner,
  isRatedChoice,
  isRatedFormat,
  matchClinched,
  matchOutcome,
  matchSettings,
  openOptions,
  opponentScoreHidden,
  RATED_GAME_MODE,
  RATED_SWITCHES,
  ratedOptionRefusal,
  ratedAccessFor,
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
import { ratingsReady, toRatingsResult, type RatedSettlement, type SettledPlayer } from "./ratingsAdapter.server";
import { scoreTimeline } from "./timeline.server";
import { gradeFlagged } from "./practiceDeals.server";
import { guestEnergyName, ratedNameOf } from "./guestName.server";

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
  /** `guest`: no account; `displayName` is then their generated energy name ("Swift Volt 48"), shown with a Guest tag. */
  players: { userId: string; slot: number; displayName: string; guest: boolean; ratingBefore: number; placement: boolean }[];
  recorded: {
    label: string;
    recordedAtMs: number;
    ownerId: string;
    ownerName: string;
    /** The owner has no account: `ownerName` is their generated energy name, shown with a Guest tag. */
    ownerGuest: boolean;
    /** The owner's stored look per game (E1's `look` on the source's results; null for none). */
    look: (Json | null)[];
    fallback: boolean;
  } | null;
  rematchOf: string | null;
  /**
   * How the match ended when not by its games (Joe, 12 Nov 2026): `abort` (someone left during set-up: no result; the
   * players who stayed are searching again) or `forfeit` (away for more than 20 s: a loss for each leaver). Null while it
   * plays on or when it ends normally.
   */
  ending: { kind: "abort" | "forfeit"; leavers: MatchLeaver[] } | null;
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
  /** The server's stored grade `extra` of this game (handed to W3a as the owner's gradeExtras; null for none). */
  extra?: Record<string, unknown> | null;
}

interface StoredRecorded {
  ownerName: string;
  /** No account: `ownerName` is their generated energy name, shown with a Guest tag. */
  ownerGuest?: boolean;
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
  /** The server's replay flagged this stored result (`extra.flagged`): the run is never played against. */
  flagged: boolean;
  /** The server's stored grade `extra` (round_results / async_results.extra, or the practice grade's). */
  extra: Record<string, unknown> | null;
}

interface SourceRun {
  candidate: RecordedCandidate;
  ownerName: string;
  rounds: SourceRound[];
}

/* ------------------------------------------------------------------ helpers */

/** A stored grade `extra` as a plain object (null for none or anything else). */
function extraOf(extra: unknown): Record<string, unknown> | null {
  return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : null;
}

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

/** Who may queue (ratedAccessFor): everyone, guests included, once RATED_PLAY_FOR_EVERYONE is on; testers until then. */
async function isOpenTo(client: Db, userId: string, account: boolean, switches: RatedSwitches): Promise<boolean> {
  if (switches.forEveryone) return ratedAccessFor({ account, tester: false }, switches);
  if (!account) return false;
  const { data } = await readIsRatedTester(client, userId);
  return ratedAccessFor({ account, tester: data === true }, switches);
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
    flagged: round.flagged,
    extra: round.extra,
  };
}

/* ------------------------------------------------------------------ status and the queue */

export async function ratedStatus(client: Db, userId: string, switches: RatedSwitches = RATED_SWITCHES): Promise<RatedStatus> {
  const { account } = await hasAccount(client, userId);
  const open = await isOpenTo(client, userId, account, switches);
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
  if (!(await isOpenTo(client, userId, account, switches))) {
    // While rated play is testers-only a guest is told it needs an account (testers are accounts).
    if (!account) return { ok: false, reason: "account", message: "Rated play needs an account for now." };
    return { ok: false, reason: "closed", message: "Rated play isn’t open yet." };
  }
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
  const rating = await (await ratingsReady()).matchRating(userId, { format, choice });
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
  return {
    userId: row.user_id, format: row.format, choice: row.choice, rating: row.rating, joinedAtMs: msOf(row.joined_at),
    placement: row.placement,
  };
}

function foundEvent(userId: string, entry: QueueEntry, kind: "live" | "recorded", nowMs: number): void {
  recordEvents({
    event: "match_found",
    playerId: userId,
    props: { kind, waited_s: Math.max(0, Math.round((nowMs - entry.joinedAtMs) / 100) / 10), format: entry.format, choice: entry.choice },
  });
}

/** One poll of a searcher: pair them live (placement with placement, placed with placed), or from 8 s give them a recorded run (a beginner's for placement). */
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
  // Placement players pair live with other placement players, placed with placed (canPair), within the same widening.
  {
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
  // From 8 s with no live partner: a recorded run (for a placement player, a beginner's).
  if (recordedDue(waitedMs)) {
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
        // An account under its username; a guest under their generated energy name, never a typed one (strangers meet here).
        display_name: (await accountNameOf(client, p.userId)) ?? guestEnergyName(p.userId),
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
    intro_at: nowIso(firstIntroAtMs(nowMs)),
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
          flagged: gradeFlagged(result.extra),
          extra: extraOf(result.extra),
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
        flagged: gradeFlagged(result.extra),
        extra: extraOf(result.extra),
      });
    }
    const run = sourceRunOf(
      { key: `daily:${attemptId}`, source: "daily", ownerId: src.attempt.user_id, recordedAtMs: msOf(src.attempt.finished_at), ownerName: src.attempt.display_name },
      rounds,
      me,
    );
    if (run) out.push(run);
  }
  out.push(...(await practiceCandidates(client, me, sinceIso)));
  return out;
}

/** How many recent Practice deals the fallback looks through. */
const PRACTICE_SCAN = 400;

/**
 * Practice runs (from C1a's fresh start, stored by practiceDeals.server.ts): one owner's newest graded plays of
 * different games that fit the choice, the format's count of them, as one run. Flagged plays are never stored as usable.
 */
async function practiceCandidates(client: Db, me: QueueEntry, sinceIso: string): Promise<SourceRun[]> {
  const { data: deals } = await readRecentPracticeDeals(client, sinceIso, me.userId, PRACTICE_SCAN);
  const byOwner = new Map<string, typeof deals>();
  for (const d of deals ?? []) {
    const list = byOwner.get(d.user_id) ?? [];
    list.push(d);
    byOwner.set(d.user_id, list);
  }
  const out: SourceRun[] = [];
  const need = FORMAT_GAMES[me.format];
  for (const [ownerId, plays] of byOwner) {
    const seen = new Set<string>();
    const picked: SourceRound[] = [];
    let ids: number[] = [];
    // The run's age is its OLDEST game's (the label never makes a stitched run look newer than it is).
    let oldest = Number.POSITIVE_INFINITY;
    for (const d of plays ?? []) {
      if (picked.length >= need || d.flagged || seen.has(d.game) || !typeFitsChoice(d.game, me.choice)) continue;
      seen.add(d.game);
      ids.push(d.play_id);
      oldest = Math.min(oldest, msOf(d.recorded_at));
      picked.push({
        puzzle: d.puzzle as unknown as PuzzleData,
        score: d.score,
        msRemaining: d.ms_remaining,
        reactionAvgMs: d.reaction_avg_ms,
        answer: d.answer,
        look: null,
        flagged: d.flagged,
        extra: extraOf(d.extra),
      });
    }
    if (picked.length !== need) continue;
    ids = [...ids].sort((a, b) => a - b);
    const run = sourceRunOf({ key: `practice:${ownerId}:${ids.join("-")}`, source: "practice", ownerId, recordedAtMs: oldest, ownerName: "" }, picked, me);
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
      flagged: gradeFlagged(result?.extra),
      extra: extraOf(result?.extra),
    });
  }
  // Never a flagged run (storeRatedRuns keeps none; this is the guard).
  if (rounds.some((r) => r.flagged)) return null;
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
  const backend = await ratingsReady();
  const ctx = {
    viewerId: me.userId,
    rating: me.placement ? backend.startingRating : me.rating,
    format: me.format,
    choice: me.choice,
    lastOwnerId: lastOwnerId ?? null,
    nowMs,
    beginnerMax: me.placement ? backend.beginnerMax : null,
  };
  // Never a run of an account whose deletion was asked for (hidden at once; accounts.forget_user removes its stored
  // runs after 30 days, the mm_forget_removed_user trigger), nor a room or Daily row already forgotten.
  const { data: deleting } = await readDeletionRequested(client, [...new Set(pool.map((r) => r.candidate.ownerId))]);
  const candidates = pool
    .filter((r) => !deleting?.has(r.candidate.ownerId) && !DELETED_NAMES.has(r.ownerName))
    .map((r) => r.candidate);
  const picked = chooseRecordedRun(candidates, ctx, backend.startingRating);
  if (!picked) return false;
  const chosen = picked;
  const run = pool.find((r) => r.candidate.key === chosen.candidate.key)!;
  let rounds = run.rounds;
  // The owner is shown as in a rated match: their username, or a guest's energy name with a Guest tag, never the name
  // a guest typed in a room or the Daily (strangers meet here).
  const owner = await ratedNameOf(client, run.candidate.ownerId);
  if (run.candidate.source === "rated") {
    const read = await ratedRunRounds(client, run.candidate.key, me);
    if (!read) return false;
    rounds = read.rounds;
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
  const stored: StoredRecorded = { ownerName: owner.name, ownerGuest: owner.guest, games, looks: rounds.map((r) => r.look) };
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
  await reviewDepartures(client, matchId, nowMs);
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match || !isRatedFormat(match.format) || !isRatedChoice(match.choice)) return null;
  const { data: players } = await readMatchPlayers(client, matchId);
  if (!players?.some((p) => p.user_id === userId)) return null;
  const room = match.duel_id ? (await readRoom(client, match.duel_id)).data : null;
  const roomPlayers = room ? ((await readPlayers(client, room.id)).data ?? []) : [];
  const stored = storedRecorded(match);
  const accounts = new Set<string>();
  for (const p of players) if (!(await ratedNameOf(client, p.user_id)).guest) accounts.add(p.user_id);
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
      displayName: roomPlayers.find((rp) => rp.user_id === p.user_id)?.display_name ?? guestEnergyName(p.user_id),
      guest: !accounts.has(p.user_id),
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
            ownerGuest: stored.ownerGuest === true,
            look: stored.looks,
            fallback: match.recorded_fallback === true,
          }
        : null,
    rematchOf: match.rematch_of,
    ending: match.ended === "abort" || match.ended === "forfeit" ? { kind: match.ended, leavers: storedLeavers(match) } : null,
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
  await reviewDepartures(client, matchId, nowMs);
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

/**
 * A 4- or 8-player match's places: the players who stayed by total score (more first; level totals share a place,
 * 1, 2, 2, 4), then the leavers below them, the latest leaver highest (placeWithLeavers).
 */
export function matchPlacings(players: readonly SettledPlayer[], leavers: readonly MatchLeaver[]): Record<string, number> {
  const gone = new Set(leavers.map((l) => l.userId));
  const stayers = players.filter((p) => !gone.has(p.userId));
  const places: Record<string, number> = {};
  for (const p of stayers) places[p.userId] = stayers.filter((o) => o.total > p.total).length + 1;
  const departures: Departure[] = leavers.filter((l) => players.some((p) => p.userId === l.userId)).map((l) => ({ userId: l.userId, atMs: msOf(l.at) }));
  return placeWithLeavers(places, departures);
}

/** The server's result of a finished match (pure on what is stored). */
export function buildMatchResult(input: {
  match: RatedMatchRow;
  players: RatedMatchPlayerRow[];
  puzzles: PuzzleData[];
  results: RoundResultRow[];
  finishedAt: string;
  /** A forfeit (Joe, 12 Nov 2026): the live players who were away past the grace, in the order they went. */
  leavers?: readonly MatchLeaver[];
}): RatedSettlement {
  const { match, players, puzzles, results } = input;
  const leavers = input.leavers ?? [];
  const gone = new Set(leavers.map((l) => l.userId));
  const sideOf = (slot: number) => {
    const scores: number[] = [];
    const timesMs: number[] = [];
    const extras: (Record<string, unknown> | null)[] = [];
    puzzles.forEach((puzzle, i) => {
      const row = results.find((r) => r.player_slot === slot && r.round_number === i + 1);
      scores.push(row?.score ?? 0);
      timesMs.push(roundTimeUsedMs(row, tieRoundFor(puzzle)));
      // The server's own stored grade for this game (W3a reads its flag): never anything the phone sent.
      extras.push(extraOf(row?.extra));
    });
    return { scores, timesMs, extras };
  };
  const recorded = match.kind === "recorded" ? storedRecorded(match) : null;
  const a = sideOf(players[0]?.slot ?? 1);
  const b = recorded
    ? { scores: recorded.games.map((g) => g.score), timesMs: recorded.games.map((g) => g.timeMs), extras: recorded.games.map((g) => g.extra ?? null) }
    : sideOf(players[1]?.slot ?? 2);
  const games: GameScores[] = puzzles.map((_, i) => ({ a: a.scores[i] ?? 0, b: b.scores[i] ?? 0, aTimeMs: a.timesMs[i] ?? 0, bTimeMs: b.timesMs[i] ?? 0 }));
  const outcome = matchOutcome(games);
  const sides = [a, b];
  const many = !recorded && players.length > 2;
  const allSides = players.map((p, i) => (many ? sideOf(p.slot) : (sides[i] ?? sideOf(p.slot))));
  const resultPlayers: SettledPlayer[] = players.map((p, i) => {
    const side = allSides[i]!;
    if (many)
      return {
        userId: p.user_id,
        slot: p.slot,
        ratingBefore: p.rating_before,
        placement: p.placement,
        scores: side.scores,
        timesMs: side.timesMs,
        extras: side.extras,
        // Games where this player scored strictly highest.
        gamesWon: puzzles.filter((_, g) => allSides.every((o, j) => j === i || (side.scores[g] ?? 0) > (o.scores[g] ?? 0))).length,
        total: side.scores.reduce((s, v) => s + v, 0),
      };
    return {
      userId: p.user_id,
      slot: p.slot,
      ratingBefore: p.rating_before,
      placement: p.placement,
      scores: side.scores,
      timesMs: side.timesMs,
      extras: side.extras,
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
    // A forfeit: the player who stayed wins whatever the score (a 1v1); 4 and 8 players are decided by their placings.
    winner: many ? "draw" : leavers.length > 0 && !recorded ? (gone.has(players[0]?.user_id ?? "") ? "b" : "a") : outcome.winner,
    placings: many ? matchPlacings(resultPlayers, leavers) : null,
    ending: leavers.length > 0 ? { kind: "forfeit", leavers: leavers.map((l) => l.userId) } : null,
    recorded:
      recorded && match.recorded_owner && match.recorded_key && match.recorded_source
        ? {
            ownerId: match.recorded_owner,
            key: match.recorded_key,
            source: match.recorded_source as RecordedSource,
            fallback: match.recorded_fallback === true,
            scores: b.scores,
            timesMs: b.timesMs,
            extras: b.extras,
          }
        : null,
    ratings: null,
  };
}

export type SettleOutcome =
  | { state: "playing" }
  | { state: "settled"; result: RatedSettlement }
  | { state: "missing" }
  /** Left during set-up (Joe, 12 Nov 2026): no result, no rating, no Joules; the players who stayed are searching again. */
  | { state: "aborted"; leavers: MatchLeaver[] };

/** A settlement as the phone gets it: every stored grade (`extras`) left out; they are for the ratings engine only. */
export type PublicSettlement = Omit<RatedSettlement, "players" | "recorded"> & {
  players: Omit<SettledPlayer, "extras">[];
  recorded: Omit<NonNullable<RatedSettlement["recorded"]>, "extras"> | null;
};
export type PublicSettleOutcome =
  | { state: "playing" }
  | { state: "settled"; result: PublicSettlement }
  | { state: "missing" }
  | { state: "aborted"; leavers: MatchLeaver[] };

export function publicSettleOutcome(outcome: SettleOutcome): PublicSettleOutcome {
  if (outcome.state !== "settled") return outcome;
  const { players, recorded, ...rest } = outcome.result;
  return {
    state: "settled",
    result: {
      ...rest,
      players: players.map(({ extras: _extras, ...p }) => p),
      recorded: recorded ? (({ extras: _extras, ...r }) => r)(recorded) : null,
    },
  };
}

/** Settles a finished match once: builds the result, calls W3a's recordRatedMatch, stores the players' runs. */
export async function settleMatch(client: Db, matchId: string, nowMs: number): Promise<SettleOutcome> {
  await reviewDepartures(client, matchId, nowMs);
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match) return { state: "missing" };
  if (match.status === "settled" && match.result) return { state: "settled", result: match.result as unknown as RatedSettlement };
  // An abort (left during set-up, Joe 12 Nov 2026): never settled, never handed to the ratings engine.
  if (match.ended === "abort") return { state: "aborted", leavers: storedLeavers(match) };
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
    // The games played: every dealt game, or fewer when the match stopped as soon as it was won (matchClinched).
    // A forfeit ends the room mid-match: the games fully played when it ended (at least the first).
    const forfeit = match.ended === "forfeit";
    const upTo = forfeit
      ? Math.max(1, room.current_round - (["starting", "round_title", "intro", "puzzle"].includes(room.phase) ? 1 : 0))
      : room.current_round;
    const played = puzzles.slice(0, Math.max(1, Math.min(puzzles.length, upTo)));
    const result = buildMatchResult({
      match: { ...match, finished_at: finishedAt },
      players: players ?? [],
      puzzles: played,
      results: results ?? [],
      finishedAt,
      // A forfeit's leavers; or, in a 4- or 8-player match that played on, the players found gone for good on the way.
      leavers: forfeit
        ? storedLeavers(match)
        : (players ?? [])
            .filter((p) => p.gone_at)
            .sort((x, y) => msOf(x.gone_at!) - msOf(y.gone_at!))
            .map((p) => ({ userId: p.user_id, at: p.gone_at!, step: "" })),
    });
    // W3a's recordRatedMatch, once per match (idempotent on the id): a passing failure throws and the settle retries.
    const forRatings = toRatingsResult(result);
    if (forRatings) result.ratings = await (await ratingsReady()).recordRatedMatch(forRatings);
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
      rounds.push({
        puzzle: puzzles[i]!, score: row.score, msRemaining: row.ms_remaining, reactionAvgMs: row.reaction_avg_ms, answer: row.answer,
        look: (row as { look?: Json | null }).look ?? null, flagged: gradeFlagged(row.extra), extra: extraOf(row.extra),
      });
    }
    // Only a run of every dealt game (a match stopped early, 2–0, leaves none), and never one the replay flagged.
    if (rounds.length !== puzzles.length || rounds.some((r) => r.flagged)) continue;
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
  if (match.ended) return { state: "closed" };
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
      const rating = await (await ratingsReady()).matchRating(p.user_id, { format: match.format as RatedFormat, choice: match.choice as RatedChoice });
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

/**
 * Whether a rated room's match is won once game `round` has its result (best of N stops as soon as one side can't be
 * caught, matchClinched). False for every ordinary room, and on any read failure (play simply goes on).
 */
export async function ratedMatchClinched(client: Db, room: { id: string; round_count: number; puzzles_public: unknown }, round: number): Promise<boolean> {
  try {
    const { readMatchByRoom } = await import("@/lib/data/rated.server");
    const { data: match } = await readMatchByRoom(client, room.id);
    if (!match || round >= room.round_count) return false;
    const pubs = Array.isArray(room.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
    const { data: results } = await readRoomResults(client, room.id);
    const rows = results ?? [];
    const recorded = match.kind === "recorded" ? storedRecorded(match) : null;
    const games: GameScores[] = [];
    for (let i = 0; i < round; i++) {
      const puzzle = pubs[i];
      if (!puzzle) return false;
      const tie = tieRoundFor(puzzle);
      const a = rows.find((r) => r.player_slot === 1 && r.round_number === i + 1);
      const b = recorded ? undefined : rows.find((r) => r.player_slot === 2 && r.round_number === i + 1);
      const rec = recorded?.games[i];
      games.push({
        a: a?.score ?? 0,
        b: recorded ? (rec?.score ?? 0) : (b?.score ?? 0),
        aTimeMs: roundTimeUsedMs(a, tie),
        bTimeMs: recorded ? (rec?.timeMs ?? tie.limitMs) : roundTimeUsedMs(b, tie),
      });
    }
    return matchClinched(games, room.round_count);
  } catch {
    return false;
  }
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

/* ------------------------------------------------------------------ W3c: head to head, a room's match */

/** Two players' rated record against each other, from the caller's side (live rated matches only). */
export interface HeadToHead {
  wins: number;
  losses: number;
  draws: number;
  played: number;
}

/** Whether a settled match counts towards a head-to-head record: never one the ratings engine froze for a flagged run. */
function countsHeadToHead(result: unknown): boolean {
  const r = result as { ratings?: { ok?: boolean; players?: { flagged?: boolean; frozen?: string | null }[] } | null } | null;
  const players = r?.ratings && r.ratings.ok ? (r.ratings.players ?? []) : [];
  return !players.some((p) => p.flagged === true || p.frozen === "flagged_run");
}

/**
 * The caller's rated record against `opponentId`: wins, losses and draws in settled live rated matches between the two
 * (the stored winner, slot 1 = side a). Recorded matches are left out (a recorded run's owner never played the caller),
 * and so is a match with a flagged run (it moved nobody's rating). The caller against themselves: all zero.
 */
export async function headToHead(client: Db, userId: string, opponentId: string): Promise<HeadToHead> {
  const record: HeadToHead = { wins: 0, losses: 0, draws: 0, played: 0 };
  if (!opponentId || opponentId === userId) return record;
  const { data } = await readSettledLiveMatchesBetween(client, userId, opponentId);
  for (const { match, players } of data ?? []) {
    const winner = (match.result as { winner?: Side } | null)?.winner;
    if ((winner !== "a" && winner !== "b" && winner !== "draw") || !countsHeadToHead(match.result)) continue;
    const mine = players.find((p) => p.user_id === userId);
    if (!mine) continue;
    record.played += 1;
    if (winner === "draw") record.draws += 1;
    else if ((winner === "a") === (mine.slot === 1)) record.wins += 1;
    else record.losses += 1;
  }
  return record;
}

/** A room's rated match, as the room screen needs it after a reload, in another tab or on another device. */
export interface RatedRoomInfo {
  matchId: string;
  format: RatedFormat;
  choice: RatedChoice;
  kind: "live" | "recorded";
  /** The dealt games (a best of N's N; the match may stop sooner once decided). */
  totalGames: number;
  status: string;
  /** An abort or a forfeit (Joe, 12 Nov 2026), else null. */
  ended: "abort" | "forfeit" | null;
}

/**
 * From a room id: the rated match it is (match id, format, choice, kind), or null when it is not a rated room, or the
 * caller is not one of the match's players (nothing about another player's rated match is given away).
 */
export async function ratedRoomInfo(client: Db, roomId: string, userId: string): Promise<RatedRoomInfo | null> {
  const { readMatchByRoom } = await import("@/lib/data/rated.server");
  try {
    const { data: match } = await readMatchByRoom(client, roomId);
    if (!match || !isRatedFormat(match.format) || !isRatedChoice(match.choice)) return null;
    const { data: players } = await readMatchPlayers(client, match.id);
    if (!players?.some((p) => p.user_id === userId)) return null;
    return {
      matchId: match.id,
      format: match.format,
      choice: match.choice,
      kind: match.kind === "recorded" ? "recorded" : "live",
      totalGames: FORMAT_GAMES[match.format],
      status: match.status,
      ended: match.ended === "abort" || match.ended === "forfeit" ? match.ended : null,
    };
  } catch {
    return null; // a database without the rated tables: no rated rooms
  }
}

/* ------------------------------------------------------------------ leaving a match (Joe, 12 Nov 2026) */

/** When the first game's intro appears in a match made now: the room's own fixed deadlines (starting, then the title). */
export function firstIntroAtMs(createdMs: number): number {
  return createdMs + DUEL_START_MS + ROUND_TITLE_MS;
}

function introAtOf(match: RatedMatchRow): number {
  return match.intro_at ? msOf(match.intro_at) : firstIntroAtMs(msOf(match.created_at));
}

/** The set-up step a moment falls in: the VS screen ("starting") or the first game's title. */
function setupStepAt(match: RatedMatchRow, atMs: number): string {
  return atMs < introAtOf(match) - ROUND_TITLE_MS ? "starting" : "round_title";
}

/** Games fully played in a room: every round before the current one, and the current one from its reveal on. */
function gamesPlayed(room: { current_round: number; phase: string; status: string }): number {
  if (room.status === "finished") return room.current_round;
  return Math.max(0, room.current_round - (["starting", "round_title", "intro", "puzzle"].includes(room.phase) ? 1 : 0));
}

/** A stored leaver of a match. */
export interface MatchLeaver {
  userId: string;
  at: string;
  step: string;
}

export function storedLeavers(match: { leavers?: Json | null }): MatchLeaver[] {
  const raw = Array.isArray(match.leavers) ? (match.leavers as unknown[]) : [];
  return raw.flatMap((x) => {
    const r = x as Partial<MatchLeaver> | null;
    return r && typeof r.userId === "string" && typeof r.at === "string" ? [{ userId: r.userId, at: r.at, step: String(r.step ?? "") }] : [];
  });
}

/** The room's players as the server sees them now (heartbeats laid over). */
async function seenPlayers(client: Db, roomId: string) {
  const { withPresence } = await import("@/lib/duel/presence.server");
  const { data } = await readPlayers(client, roomId);
  return withPresence(client, roomId, data ?? []);
}

export type DepartureOutcome = { state: "none" } | { state: "aborted"; leavers: MatchLeaver[] } | { state: "forfeit"; leavers: MatchLeaver[] };

/**
 * Looks at who has left a live rated match and acts once (every heartbeat and poll calls it; every step is guarded, so
 * any number of callers make one ending). Recorded matches are left alone. An abort marks the match abandoned, closes
 * the room and puts the players who stayed straight back in the queue; a forfeit ends the room now (it then settles as
 * a loss for the leavers, settleMatch); a 4- or 8-player leaver is marked gone and the rest play on.
 */
export async function reviewDepartures(client: Db, matchId: string, nowMs: number): Promise<DepartureOutcome> {
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match || match.kind !== "live" || !match.duel_id) return { state: "none" };
  if (match.ended === "abort") return { state: "aborted", leavers: storedLeavers(match) };
  if (match.ended === "forfeit") return { state: "forfeit", leavers: storedLeavers(match) };
  if (match.status !== "playing") return { state: "none" };
  const { data: room } = await readRoom(client, match.duel_id);
  if (!room || room.status !== "in_progress") return { state: "none" };
  const { data: mplayers } = await readMatchPlayers(client, matchId);
  const roster = mplayers ?? [];
  const seen = await seenPlayers(client, room.id);
  const players: DeparturePlayer[] = roster.map((p) => {
    const row = seen.find((s) => s.user_id === p.user_id);
    const last = row ? Math.max(msOf(row.last_seen_at), msOf(row.joined_at)) : null;
    return {
      userId: p.user_id,
      lastSeenMs: last !== null && Number.isFinite(last) ? last : null,
      leftAtMs: p.left_at ? msOf(p.left_at) : null,
      goneAtMs: p.gone_at ? msOf(p.gone_at) : null,
    };
  });
  const decided = roster.length === 2 && (await ratedMatchClinched(client, { ...room, round_count: room.round_count }, gamesPlayed(room)));
  const verdict = departureVerdict({ nowMs, introAtMs: introAtOf(match), players, decided });
  if (verdict.kind === "none") return { state: "none" };
  const at = nowIso(nowMs);
  const toStored = (list: Departure[], step: (d: Departure) => string): MatchLeaver[] =>
    list.map((d) => ({ userId: d.userId, at: nowIso(d.atMs), step: step(d) }));

  if (verdict.kind === "abort") {
    const leavers = toStored(verdict.leavers, (d) => setupStepAt(match, d.atMs));
    const { data: claimed } = await claimMatchEnd(client, matchId, { ended: "abort", at, step: leavers[0]?.step ?? room.phase, leavers: asJson(leavers) });
    if (!claimed) return reviewDepartures(client, matchId, nowMs);
    await endRatedRoom(client, room.id, at, true);
    recordEvents(leavers.map((l) => ({ event: "rated_match_aborted" as const, playerId: l.userId, props: { step: l.step, format: match.format } })));
    // The players who stayed go straight back to searching, for the same format and choice.
    const gone = new Set(leavers.map((l) => l.userId));
    for (const p of roster) {
      if (gone.has(p.user_id)) continue;
      try {
        await joinQueue(client, p.user_id, { format: match.format, choice: match.choice }, nowMs);
      } catch {
        // A refused or failed search leaves them on the abort notice; they can search again from it.
      }
    }
    return { state: "aborted", leavers };
  }

  const stepNow = room.phase;
  if (verdict.kind === "gone") {
    // gone_at is when they went (their Leave or last heartbeat), so the latest leaver places highest of them.
    for (const d of verdict.leavers) await markMatchPlayersGone(client, matchId, [d.userId], nowIso(d.atMs));
    await markRoomPlayersLeft(client, room.id, verdict.leavers.map((d) => d.userId));
    return { state: "none" };
  }
  // A forfeit: every leaver (earlier ones of a 4- or 8-player match included), in the order they went.
  const leavers = toStored(verdict.leavers, () => stepNow);
  const { data: claimed } = await claimMatchEnd(client, matchId, { ended: "forfeit", at, step: stepNow, leavers: asJson(leavers) });
  if (!claimed) return reviewDepartures(client, matchId, nowMs);
  for (const l of leavers) await markMatchPlayersGone(client, matchId, [l.userId], l.at);
  await markRoomPlayersLeft(client, room.id, leavers.map((l) => l.userId));
  await endRatedRoom(client, room.id, at, false);
  recordEvents(
    leavers.map((l) => ({ event: "rated_match_forfeited" as const, playerId: l.userId, props: { format: match.format, games_played: gamesPlayed(room) } })),
  );
  return { state: "forfeit", leavers };
}

/** From a room id: review its rated match's departures (heartbeat, phase moves, Leave). Ordinary rooms: nothing. */
export async function reviewRatedRoom(client: Db, roomId: string, nowMs: number): Promise<void> {
  try {
    const { readMatchByRoom } = await import("@/lib/data/rated.server");
    const { data: match } = await readMatchByRoom(client, roomId);
    if (match && match.kind === "live" && match.status === "playing") await reviewDepartures(client, match.id, nowMs);
  } catch (error) {
    console.error("[rated] departure review failed", roomId, error instanceof Error ? error.message : error);
  }
}

/** A player's own Leave in a rated room: noted (it starts their grace, or aborts during set-up), never a disband. */
export async function leaveRatedRoom(client: Db, roomId: string, userId: string, nowMs: number): Promise<boolean> {
  const { readMatchByRoom } = await import("@/lib/data/rated.server");
  let match: RatedMatchRow | null = null;
  try {
    match = (await readMatchByRoom(client, roomId)).data ?? null;
  } catch {
    return false; // a database without the rated tables: no rated rooms
  }
  if (!match) return false;
  if (match.kind === "live" && match.status === "playing") {
    await markMatchPlayerLeft(client, match.id, userId, nowIso(nowMs));
    await reviewDepartures(client, match.id, nowMs);
  }
  return true;
}
