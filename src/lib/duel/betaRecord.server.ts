/**
 * Beta recording (docs/beta-sql.md, gaps G2–G4): append-only rows that let the
 * beta queries see how rooms and practice are used. Server-only; the client is
 * the service-role Supabase client (or the in-memory stand-in in
 * scripts/*-check.ts). Tables: room_events, room_joins and practice_plays
 * (migrations 20261016130000–20261016130200), RLS on with no client access,
 * and duel_secrets.round_records for the G1 archive (20261016170000).
 *
 * Never part of play: nothing here is read back by any game, score, timing or
 * replay path. Every write is best-effort: an error (the migration not applied
 * yet, the database down, a duplicate) is logged and play carries on, and a
 * slow write is abandoned after RECORD_TIMEOUT_MS.
 */

import {
  insertAsyncEvent,
  insertChallengeEvent,
  insertRoomEvent,
  insertRoomJoin,
  insertShareEvent,
  insertTermsEvent,
  writeAsyncRoundRecords,
} from "@/lib/data/beta.server";
import { UNIQUE_VIOLATION, type Db, type DbError } from "@/lib/data/db.server";
import { insertPracticePlay } from "@/lib/data/practice.server";
import {
  countPracticePlay,
  insertPracticePlayWithBreakdown,
  type PracticeRecordOutcome,
} from "@/lib/data/practiceProgress.server";
import { writeRoundRecords } from "@/lib/data/rooms.server";
import { normaliseInputType } from "@/lib/inputType";

/** The longest a recording write may hold up the server function it rides on. */
export const RECORD_TIMEOUT_MS = 1_500;

/** Which game in the room a row belongs to: the Play again count before it (0 = the first game). */
export function gameIndexOf(room: { tournament_history?: readonly unknown[] | null }): number {
  return Array.isArray(room.tournament_history) ? room.tournament_history.length : 0;
}

/** Runs one recording write; logs and swallows every failure, never waits past the timeout. */
async function bestEffort(
  label: string,
  write: () => PromiseLike<{ error?: DbError | null } | null | undefined>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), RECORD_TIMEOUT_MS);
    });
    const result = await Promise.race([Promise.resolve().then(write), timeout]);
    if (result === "timeout") {
      console.warn(`[beta-record] ${label}: gave up after ${RECORD_TIMEOUT_MS} ms`);
      return;
    }
    const error = result?.error;
    if (error && error.code !== UNIQUE_VIOLATION)
      console.warn(`[beta-record] ${label}: ${error.message ?? String(error)}`);
  } catch (err) {
    console.warn(`[beta-record] ${label}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- G3 ---- */

export type RoomEvent = "game_started" | "round_started" | "round_ended" | "game_ended";
/** round_ended: everyone still playing answered, or the clock ran out. */
export type RoundEndReason = "all_answered" | "timer";
/** game_ended: the winner reveal was reached, "Finish now", the host left, or the host disbanded. */
export type GameEndReason = "completed" | "finish_now" | "host_left" | "disbanded";

export interface RoomEventRow {
  duel_id: string;
  game_index: number;
  /** 0 for game_started / game_ended. */
  round_number: number;
  event: RoomEvent;
  reason?: RoundEndReason | GameEndReason | null;
  /** When it happened; the database's now() if left out. */
  at?: string;
}

/**
 * One event per (room, game, round, event): a unique index keeps the first, so
 * the several phones and timers that race to move a room record it once.
 */
export async function recordRoomEvent(client: Db, row: RoomEventRow): Promise<void> {
  await bestEffort(`room_events ${row.event} room=${row.duel_id} round=${row.round_number}`, () =>
    insertRoomEvent(client, { reason: null, ...row }),
  );
}

/* ---------------------------------------------------------------- G4 ---- */

/** How a device came into a room's game. Play again rows are written by restart_duel_room. */
export type JoinVia = "host" | "code" | "link" | "play_again";

/** The phone's own claim of how it reached the join; anything else is stored as unknown (null). */
export function joinViaFrom(value: unknown): "code" | "link" | null {
  return value === "code" || value === "link" ? value : null;
}

export interface RoomJoinRow {
  duel_id: string;
  user_id: string;
  player_slot: number;
  game_index: number;
  via: JoinVia | null;
  /** True when a device that had left came back in the lobby. */
  rejoin?: boolean;
}

export async function recordJoin(client: Db, row: RoomJoinRow): Promise<void> {
  await bestEffort(`room_joins room=${row.duel_id} slot=${row.player_slot}`, () =>
    insertRoomJoin(client, { rejoin: false, ...row }),
  );
}

/* ---------------------------------------------------------------- G2 ---- */

/** Top-level numeric stamps in a stored puzzle (e.g. brkRev, tapRev, speedPar, bombVersion). */
export function revisionStamps(puzzle: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(puzzle))
    if (typeof value === "number" && /(Rev|Version|Revision|speedPar)$/.test(key)) out[key] = value;
  return out;
}

/* ------------------------------------------------------- G1 rounds ---- */

/** What one room round actually used, by the same rule as a practice_plays row. */
export interface RoundRecord {
  time_limit_ms: number;
  revision: Record<string, number>;
}

/**
 * One entry per round of a newly dealt room (index = round_number - 1): the
 * effective clock (`timeLimitMs`, the puzzle's own limit or else its game's
 * default, from registry.puzzleTimeLimitMs as practice uses) and the full
 * puzzle's version stamps (revisionStamps, as practice). Fixed at the deal, so
 * the round's start would store the same values.
 */
export function roundRecords(
  puzzles: readonly (Record<string, unknown> & { type: string })[],
  timeLimitMs: (puzzle: Record<string, unknown> & { type: string }) => number,
): RoundRecord[] {
  return puzzles.map((puzzle) => ({
    time_limit_ms: Math.max(0, Math.round(timeLimitMs(puzzle))),
    revision: revisionStamps(puzzle),
  }));
}

/**
 * Stores the room's round records in duel_secrets.round_records (migration
 * 20261016170000), which restart_duel_room copies into round_results_archive.
 * A separate best-effort write, so a missing column never fails the start.
 */
export async function recordRoundRecords(
  client: Db,
  duelId: string,
  rounds: readonly RoundRecord[],
): Promise<void> {
  await bestEffort(`duel_secrets.round_records room=${duelId}`, () =>
    writeRoundRecords(client, duelId, JSON.parse(JSON.stringify(rounds))),
  );
}

export interface PracticePlayRow {
  user_id: string | null;
  game_id: string;
  revision: Record<string, number>;
  score: number;
  is_correct: boolean;
  timed_out: boolean;
  duration_ms: number;
  time_limit_ms: number;
  ms_remaining: number;
  example: boolean;
  flagged: boolean;
}

/**
 * The practice_plays row for one graded practice play. `claimedMsRemaining` is
 * what the phone sent (0 when its clock ran out); `timeLimitMs` the puzzle's
 * own clock. Arcade runs report their length (extra.endedSeconds) when they
 * stored one. Only the outcome is kept, never the answer.
 */
export function practicePlayRow(input: {
  userId: string | null;
  puzzle: Record<string, unknown> & { type: string };
  example: boolean;
  claimedMsRemaining: number;
  timeLimitMs: number;
  graded: {
    score: number;
    isCorrect: boolean;
    storedMs: number;
    extra?: Record<string, unknown> | null;
  };
}): PracticePlayRow {
  const limit = Math.max(0, Math.round(input.timeLimitMs));
  const claimed = Number.isFinite(input.claimedMsRemaining) ? input.claimedMsRemaining : 0;
  const left = Math.max(0, Math.min(limit, Math.round(claimed)));
  const ended = input.graded.extra?.["endedSeconds"];
  const duration =
    typeof ended === "number" && Number.isFinite(ended)
      ? Math.max(0, Math.round(ended * 1000))
      : limit - left;
  return {
    user_id: input.userId,
    game_id: input.puzzle.type,
    revision: revisionStamps(input.puzzle),
    score: Math.round(input.graded.score),
    is_correct: !!input.graded.isCorrect,
    timed_out: claimed <= 0,
    duration_ms: duration,
    time_limit_ms: limit,
    ms_remaining: Math.round(input.graded.storedMs),
    example: input.example,
    flagged: input.graded.extra?.["flagged"] === true,
  };
}

/**
 * Looks up the caller's device id and writes the row, both inside one
 * best-effort window, so a slow auth lookup can't hold up the graded answer.
 */
export async function recordPracticePlay(
  client: Db,
  makeRow: (userId: string | null) => PracticePlayRow,
  userId?: () => Promise<string | null>,
  inputType?: unknown,
  progress?: PracticeProgressInput,
): Promise<void> {
  await bestEffort("practice_plays", async () => {
    const row = makeRow(await (userId ?? (() => callerUserId(client)))());
    // Practice progress (wave 2 C1a): the row carries the server's breakdown and level, and is then counted towards
    // its player's stars and bests (practice_record_play). A database without those columns gets the plain row below.
    if (progress) {
      const stored = await insertWithProgress(client, row, progress, normaliseInputType(inputType));
      if (stored) return stored;
    }
    // How it was played (lib/inputType.ts): a database without the column (migration
    // 20261031170000_result_input_type.sql, written but not applied) refuses it, so the row goes again without.
    const typed = normaliseInputType(inputType);
    if (!typed) return insertPracticePlay(client, row);
    const first = await insertPracticePlay(client, { ...row, input_type: typed });
    if (first?.error && /input_type/.test(String(first.error.message ?? "") + String(first.error.details ?? ""))) {
      return insertPracticePlay(client, row);
    }
    return first;
  });
}

/** What a practice grade adds to its row: the breakdown its grading produced, its level, and who hears the count. */
export interface PracticeProgressInput {
  /** The graded extra, exactly as a room stores it in round_results.extra (null when the grade had none). */
  breakdown: Record<string, unknown> | null;
  /** The run's level (Classic until wave 3.5). */
  level: string;
  /** Called once the play is counted (or refused) towards progress, with the player it was counted for. */
  onCounted?: (outcome: PracticeRecordOutcome, userId: string) => void;
}

/**
 * Writes the row with its breakdown and level, then counts it. Answers null when the database has no breakdown
 * column (the caller writes the plain row instead); any other answer is the insert's own.
 */
async function insertWithProgress(
  client: Db,
  row: PracticePlayRow,
  progress: PracticeProgressInput,
  typed: string | null,
): Promise<{ error?: DbError | null } | null> {
  const full = { ...row, breakdown: progress.breakdown, level: progress.level };
  let inserted = await insertPracticePlayWithBreakdown(client, typed ? { ...full, input_type: typed } : full);
  const said = (e: DbError | null | undefined, word: string) =>
    !!e && new RegExp(word).test(String(e.message ?? "") + String(e.details ?? ""));
  if (typed && said(inserted.error, "input_type")) inserted = await insertPracticePlayWithBreakdown(client, full);
  if (said(inserted.error, "breakdown|level")) return null;
  if (inserted.error || inserted.data === null || !row.user_id) return { error: inserted.error };
  const counted = await countPracticePlay(client, inserted.data);
  if (counted.data && progress.onCounted) progress.onCounted(counted.data, row.user_id);
  return { error: counted.error };
}

/**
 * The caller's device id (anonymous auth user) from the bearer token the app
 * attaches to every server call (auth-attacher.ts), or null without one.
 * Practice stays open to callers without a session: this never throws.
 */
export async function callerUserId(client: Db): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const header = getRequest()?.headers?.get("authorization") ?? "";
    if (!header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length);
    if (token.split(".").length !== 3) return null;
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return String(data.claims.sub);
  } catch (err) {
    console.warn(`[beta-record] caller id: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ------------------------------------------------- async rooms (daily) ---- */

/**
 * Async rooms and the daily challenge (21 Oct 2026, migration 20261021130000): an attempt's start
 * and finish, and each round's start, finish (answered before the clock, or the time-out's draft)
 * and abandon (nothing arrived while it took answers). One row per (attempt, round, event): the
 * unique index keeps the first, so a retried call records each moment once. Best-effort, as above.
 */
export type AsyncEvent = "attempt_started" | "round_started" | "round_finished" | "round_abandoned" | "attempt_finished";
export type AsyncEventReason = "answered" | "timeout" | "no_answer";

export interface AsyncEventRow {
  room_id: string;
  kind: string;
  attempt_id: string;
  user_id: string | null;
  /** 0 for attempt_started / attempt_finished. */
  round_number: number;
  event: AsyncEvent;
  reason?: AsyncEventReason | null;
  at?: string;
}

export async function recordAsyncEvent(client: Db, row: AsyncEventRow): Promise<void> {
  await bestEffort(`async_events ${row.event} attempt=${row.attempt_id} round=${row.round_number}`, () =>
    insertAsyncEvent(client, { reason: null, ...row }),
  );
}

/** recordRoundRecords for another table's row (async_room_secrets keyed on room_id), best-effort. */
export async function recordRoundRecordsFor(
  client: Db,
  table: "async_room_secrets",
  key: "room_id",
  id: string,
  rounds: readonly RoundRecord[],
): Promise<void> {
  await bestEffort(`${table}.round_records ${key}=${id}`, () =>
    writeAsyncRoundRecords(client, id, JSON.parse(JSON.stringify(rounds))),
  );
}

/* ------------------------------------------------------- share loop ---- */

/**
 * share_events (20261021120000): a Share tap, an arrival from a shared link, what that arrival did
 * with the Play tab's welcome card, and its first finished room.
 */
export type ShareEvent = "share_tap" | "arrival" | "arrival_finished" | "arrival_welcome";

/** What was shared, or what kind of link an arrival came from (22 Oct 2026; rows before it are rooms). */
export type ShareSource = "room" | "daily" | "challenge";

export interface ShareEventRow {
  user_id: string;
  event: ShareEvent;
  source: ShareSource;
  duel_id: string | null;
  game_index: number | null;
  room_code: string | null;
  place: number | null;
  players: number | null;
  rounds: number | null;
  method: "native" | "copy" | null;
  landing: "home" | "room" | null;
  welcome: "shown" | "dismissed" | "practice" | "public" | null;
  /** A challenge's code (source challenge). */
  challenge_code: string | null;
  /** Which daily (source daily). */
  daily_kind: "puzzle" | "arcade" | null;
}

const WELCOME = new Set(["shown", "dismissed", "practice", "public"]);

/** A room's most players (MAX_PLAYERS, 16 since 31 Oct 2026), the most a room share's place and count can be. */
export const ROOM_SHARE_MAX_PLAYERS = 16;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function whole(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * The share_events row for what the phone reported, or null when it isn't one of the three events.
 * Everything else the phone sends is kept only when it has the column's shape (anything else is
 * stored as null), so a stale or tampered phone can't write past the table's checks.
 */
export function shareEventRow(userId: string, input: Record<string, unknown>): ShareEventRow | null {
  const event = input["event"];
  if (event !== "share_tap" && event !== "arrival" && event !== "arrival_finished" && event !== "arrival_welcome")
    return null;
  const welcome = typeof input["welcome"] === "string" && WELCOME.has(input["welcome"]) ? input["welcome"] : null;
  // A welcome row is nothing but its outcome.
  if (event === "arrival_welcome" && !welcome) return null;
  const duelId = typeof input["duelId"] === "string" && UUID.test(input["duelId"]) ? input["duelId"] : null;
  const code = typeof input["roomCode"] === "string" && /^[A-Z0-9]{4}$/.test(input["roomCode"]) ? input["roomCode"] : null;
  const method = input["method"] === "native" || input["method"] === "copy" ? input["method"] : null;
  const landing = input["landing"] === "home" || input["landing"] === "room" ? input["landing"] : null;
  // Daily and challenge shares and arrivals (22 Oct 2026); anything else, and every row before, is a room's.
  // A room's finish and the welcome card are always the room loop's.
  const asked = input["source"] === "daily" || input["source"] === "challenge" ? input["source"] : "room";
  const source: ShareSource = event === "share_tap" || event === "arrival" ? asked : "room";
  const room = source === "room";
  const inRoom = room && (event === "share_tap" || event === "arrival_finished");
  const challengeCode =
    source === "challenge" && typeof input["challengeCode"] === "string" && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(input["challengeCode"])
      ? input["challengeCode"]
      : null;
  const dailyKind = source === "daily" && (input["dailyKind"] === "puzzle" || input["dailyKind"] === "arcade") ? input["dailyKind"] : null;
  // A challenge's share carries its place and counts (up to 20 players, 10 rounds); a room's up to its 16 seats
  // (L4: rooms of 11–16 used to store a null place).
  const placed = inRoom || (source === "challenge" && event === "share_tap");
  const most = room ? ROOM_SHARE_MAX_PLAYERS : 20;
  return {
    user_id: userId,
    event,
    source,
    duel_id: inRoom ? duelId : null,
    game_index: inRoom ? whole(input["gameIndex"], 0, 10_000) : null,
    room_code: event === "arrival_welcome" || !room ? null : code,
    place: placed ? whole(input["place"], 1, most) : null,
    players: placed ? whole(input["players"], 1, most) : null,
    rounds: placed ? whole(input["rounds"], 1, 20) : null,
    method: event === "share_tap" ? method : null,
    landing: event === "arrival" && room ? landing : null,
    welcome: event === "arrival_welcome" ? (welcome as ShareEventRow["welcome"]) : null,
    challenge_code: challengeCode,
    daily_kind: dailyKind,
  };
}

/** Writes one share_events row, best-effort (a duplicate arrival is the unique index keeping the first). */
export async function recordShareEvent(client: Db, row: ShareEventRow): Promise<void> {
  await bestEffort(`share_events ${row.event}`, () => insertShareEvent(client, row));
}

/* ------------------------------------------------- friend challenges ---- */

/**
 * challenge_events (20261022120000): a challenge made (from the Play tab or a room's podium), its
 * link opened, a friend's finish, and that friend's first room or daily afterwards. Once per
 * challenge and device (follow-ups once per device and kind): the unique indexes keep the first.
 */
export type ChallengeEvent = "created" | "link_opened" | "friend_finished" | "followup_room" | "followup_daily";

export interface ChallengeEventRow {
  room_id: string | null;
  code: string | null;
  user_id: string;
  event: ChallengeEvent;
  source?: "play" | "room" | null;
}

export async function recordChallengeEvent(client: Db, row: ChallengeEventRow): Promise<void> {
  await bestEffort(`challenge_events ${row.event} code=${row.code ?? "-"}`, () =>
    insertChallengeEvent(client, { source: null, ...row }),
  );
}

/* ---------------------------------------------------------- beta terms ---- */

/**
 * terms_events (20261023120000): a device agreeing to the beta terms (/terms, before its first room,
 * daily or challenge), with the date the phone stored and the terms' version. One row per device and
 * version: the unique index keeps the first.
 */
export interface TermsEventRow {
  user_id: string;
  terms_version: number;
  agreed_at: string;
}

/** The row for an agreement, or null when the phone's input isn't one (no row is better than a wrong one). */
export function termsEventRow(userId: string, input: Record<string, unknown>): TermsEventRow | null {
  const version = input["version"];
  const agreedAt = typeof input["agreedAt"] === "string" ? Date.parse(input["agreedAt"]) : Number.NaN;
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > 1000) return null;
  if (!Number.isFinite(agreedAt)) return null;
  return { user_id: userId, terms_version: version as number, agreed_at: new Date(agreedAt).toISOString() };
}

export async function recordTermsAgreed(client: Db, row: TermsEventRow): Promise<void> {
  await bestEffort(`terms_events v${row.terms_version}`, () => insertTermsEvent(client, row));
}
