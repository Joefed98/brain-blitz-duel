/**
 * The async-room engine (21 Oct 2026; asyncRoom.ts has the timings): a room whose rounds each
 * player plays at their own time, on their own clock, with results added as each player finishes.
 * The daily challenge uses it (daily.server.ts); a friend challenge can reuse it as it is: deal the
 * rounds with buildAsyncPuzzles' caller, createAsyncRoom with kind "challenge", and the same
 * attempt, round, submit and reveal calls.
 *
 * - Content is dealt once on the server from a seed and stored (rule 5): async_rooms (public
 *   halves) and async_room_secrets (private halves).
 * - One attempt per device per room (async_attempts' unique (room_id, user_id)).
 * - A player's round start is stored on the server when they start it (async_results.started_at)
 *   and the round's puzzle reaches their phone only then; the 1.5 s time-claim check and the tap
 *   logs are held to that stamp exactly as a room's are to its phase start (gradeRoomAnswer).
 * - Grading is the room's (and so practice's): gradeRoomAnswer with that player's own receipt.
 * - A round's answer detail (the private half, the correct answer) leaves the server only once the
 *   player's own result for it is stored; other players' answers never leave it, and their totals
 *   only on the board once the caller has finished (daily.server.ts).
 *
 * The database client is passed in, so scripts/daily-check.ts drives this exact code with an
 * in-memory stand-in. Every write is keyed on the calling device's own attempt.
 */
import { mergePuzzle, splitPuzzle } from "./secrets";
import { DAILY_ARCHIVE_KIND, asyncReceipt, asyncRoundWindow, isArchiveKind, solutionLockKind, type AsyncAttemptView, type SolutionLock } from "./asyncRoom";
import { recordAsyncEvent, recordRoundRecordsFor, roundRecords } from "./betaRecord.server";
import { asyncMode, playedMs, recordEvents } from "@/lib/data/events.server";
import { isPlayable, puzzleDef, puzzleTimeLimitMs } from "./registry";
import { roundTimeUsedMs, type TieRound } from "./scoring";
import { tieRoundFor } from "./tieBreak";
import { phaseReceiptOf } from "@/lib/round/receipt";
import { resultColumns } from "@/lib/round/result";
import type { SubmitExtra } from "./grade";
import type { PuzzleData, RoundResultRow } from "./types";
import { dbError } from "./dbError";
import { UNIQUE_VIOLATION, type Db, type DbError } from "@/lib/data/db.server";
import {
  insertAsyncResults,
  insertAsyncRoom,
  insertAsyncRoomSecrets,
  insertAttempt,
  readAsyncPrivate,
  readAsyncRoomById,
  readAsyncRoomByKey,
  readAttempt,
  readAttemptResults,
  readAttempts,
  updateAttempt,
  updateOpenAsyncResult,
} from "@/lib/data/async.server";

export interface AsyncRoomRow {
  id: string;
  kind: string;
  room_key: string;
  day: string | null;
  seed: number;
  round_order: string[];
  round_count: number;
  puzzles_public: PuzzleData[];
  opens_at: string;
  closes_at: string;
  created_by: string | null;
  created_at?: string;
}

export interface AsyncAttemptRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  colour: number | null;
  icon: string | null;
  started_at: string;
  finished_at: string | null;
  rounds_done: number;
  total_score: number;
  tie_ms: number;
  round_scores: (number | null)[];
}

export interface AsyncResultRow {
  id?: string;
  room_id: string;
  attempt_id: string;
  user_id: string;
  round_number: number;
  started_at: string;
  answered: boolean;
  answered_at: string | null;
  missed: boolean;
  answer: string | null;
  is_correct: boolean;
  ms_remaining: number;
  reaction_avg_ms: number | null;
  correct_count: number | null;
  errors: number | null;
  extra: Record<string, unknown> | null;
  score: number;
}

const iso = (ms: number) => new Date(ms).toISOString();
const msOf = (stamp: string | null | undefined) => (stamp ? Date.parse(stamp) : Number.NaN);

/** A result row in the room's shape (round_results), for the room's summaries and tie-break. */
export function asRoundResult(row: AsyncResultRow): RoundResultRow {
  return {
    id: row.id ?? `${row.attempt_id}-${row.round_number}`,
    duel_id: row.room_id,
    player_slot: 1,
    round_number: row.round_number,
    answer: row.answer,
    is_correct: row.is_correct,
    ms_remaining: row.ms_remaining,
    reaction_avg_ms: row.reaction_avg_ms,
    correct_count: row.correct_count,
    errors: row.errors,
    extra: row.extra,
    score: row.score,
    submitted_at: row.answered_at ?? row.started_at,
  };
}

/* ------------------------------------------------------------------ rooms */

export async function roomByKey(client: Db, key: string): Promise<AsyncRoomRow | null> {
  const { data, error } = await readAsyncRoomByKey(client, key);
  if (error) throw dbError(error, "asyncRoom");
  return data ?? null;
}

export async function roomById(client: Db, id: string): Promise<AsyncRoomRow | null> {
  const { data, error } = await readAsyncRoomById(client, id);
  if (error) throw dbError(error, "asyncRoom");
  return data ?? null;
}

/**
 * Stores a newly dealt room under its key, once: when two callers race, the first insert wins and
 * both get that room (the loser's deal is never stored or sent). The private halves are stored
 * before the room is returned to anyone.
 */
export async function createAsyncRoom(
  client: Db,
  input: {
    kind: string;
    key: string;
    day: string | null;
    seed: number;
    puzzles: PuzzleData[];
    opensAt: number;
    closesAt: number;
    createdBy: string | null;
  },
): Promise<AsyncRoomRow> {
  const split = input.puzzles.map(splitPuzzle);
  const id = crypto.randomUUID();
  const row = {
    id,
    kind: input.kind,
    room_key: input.key,
    day: input.day,
    seed: input.seed,
    round_order: input.puzzles.map((p) => p.type),
    round_count: input.puzzles.length,
    puzzles_public: JSON.parse(JSON.stringify(split.map((s) => s.pub))),
    opens_at: iso(input.opensAt),
    closes_at: iso(input.closesAt),
    created_by: input.createdBy,
  };
  // Secrets first under the new id would break the foreign key, so the room row goes in, then
  // its secrets; a room without secrets is never played (startAsyncRound needs them).
  const { error } = await insertAsyncRoom(client, row);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const existing = await roomByKey(client, input.key);
      if (existing) return existing;
    }
    throw dbError(error, "asyncRoom");
  }
  const { error: secretError } = await insertAsyncRoomSecrets(
    client,
    id,
    JSON.parse(JSON.stringify(split.map((s) => s.priv))),
  );
  if (secretError && secretError.code !== UNIQUE_VIOLATION) throw dbError(secretError, "asyncRoom");
  // Beta recording: each round's effective clock and stamps, as rooms store them (best-effort).
  await recordRoundRecordsFor(
    client,
    "async_room_secrets",
    "room_id",
    id,
    roundRecords(input.puzzles as unknown as (Record<string, unknown> & { type: string })[], (p) =>
      puzzleTimeLimitMs(p as unknown as PuzzleData),
    ),
  );
  return row as AsyncRoomRow;
}

async function privateHalf(
  client: Db,
  roomId: string,
  round: number,
): Promise<Record<string, unknown> | null> {
  const { data: list } = await readAsyncPrivate(client, roomId);
  return list?.[round - 1] ?? null;
}

/* --------------------------------------------------------------- attempts */

export async function attemptFor(
  client: Db,
  roomId: string,
  userId: string,
): Promise<AsyncAttemptRow | null> {
  const { data, error } = await readAttempt(client, roomId, userId);
  if (error) throw dbError(error, "asyncRoom");
  return data ?? null;
}

export async function attemptsIn(client: Db, roomId: string): Promise<AsyncAttemptRow[]> {
  const { data, error } = await readAttempts(client, roomId);
  if (error) throw dbError(error, "asyncRoom");
  return data ?? [];
}

export async function resultsOf(client: Db, attemptId: string): Promise<AsyncResultRow[]> {
  const { data, error } = await readAttemptResults(client, attemptId);
  if (error) throw dbError(error, "asyncRoom");
  return (data ?? []).sort((a, b) => a.round_number - b.round_number);
}

/**
 * The caller's one attempt in a room: created on the first start, the same row ever after (the
 * unique index decides a race). `created` is false when the device had already started.
 */
/** The colours the first daily migration lets an attempt store (async_attempts.colour CHECK 0–9). */
export const ASYNC_STORED_COLOUR_MAX = 9;
const CHECK_VIOLATION = "23514";

/**
 * Inserts an attempt row. Hotfix (8 Nov 2026, the audit's M8): the colour wheel offers 32 swatches (0–31) since
 * 31 Oct, but `async_attempts.colour` is CHECK 0–9 until 20261108130000_async_attempt_colours.sql is applied, so a
 * player with a wheel colour of 10 or more had every daily and challenge start refused ("Can’t reach us"). A colour the
 * table refuses is stored as none, as rooms do before their own migration (boards then show the player's slot colour).
 */
export async function insertAttemptRow(
  client: Db,
  row: AsyncAttemptRow,
): Promise<{ error: DbError | null; row: AsyncAttemptRow }> {
  const { error } = await insertAttempt(client, row);
  if (error && error.code === CHECK_VIOLATION && row.colour !== null && row.colour > ASYNC_STORED_COLOUR_MAX) {
    const plain = { ...row, colour: null };
    const retry = await insertAttempt(client, plain);
    return { error: retry.error ?? null, row: plain };
  }
  return { error: error ?? null, row };
}

/**
 * A friend challenge or Daily archive replay that holds a retired game is closed (13 Nov 2026, Joe's rule: retired
 * games are out of the app; catalogue.ts isPlayable): no new attempt and no new round. Nothing stored changes, so it
 * opens again the moment the game returns. The Dailies and Score Attack are dealt from live games only.
 */
export function retiredClosed(room: Pick<AsyncRoomRow, "kind" | "puzzles_public">): boolean {
  if (room.kind !== "challenge" && room.kind !== DAILY_ARCHIVE_KIND) return false;
  return (room.puzzles_public ?? []).some((p) => !isPlayable(p?.type));
}

export async function startAttempt(
  client: Db,
  room: AsyncRoomRow,
  userId: string,
  who: { name: string; colour: number | null; icon: string | null },
  nowMs: number,
): Promise<
  { ok: true; attempt: AsyncAttemptRow; created: boolean } | { ok: false; message: string }
> {
  const existing = await attemptFor(client, room.id, userId);
  if (existing) return { ok: true, attempt: existing, created: false };
  if (nowMs >= msOf(room.closes_at) || retiredClosed(room)) return { ok: false, message: "This challenge has closed." };
  if (nowMs < msOf(room.opens_at))
    return { ok: false, message: "This challenge hasn’t opened yet." };
  const row: AsyncAttemptRow = {
    id: crypto.randomUUID(),
    room_id: room.id,
    user_id: userId,
    display_name: who.name,
    colour: who.colour,
    icon: who.icon,
    started_at: iso(nowMs),
    finished_at: null,
    rounds_done: 0,
    total_score: 0,
    tie_ms: tieTotal(room, []),
    round_scores: Array.from({ length: room.round_count }, () => null),
  };
  const inserted = await insertAttemptRow(client, row);
  const { error } = inserted;
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const raced = await attemptFor(client, room.id, userId);
      if (raced) return { ok: true, attempt: raced, created: false };
    }
    throw dbError(error, "asyncRoom");
  }
  await recordAsyncEvent(client, {
    room_id: room.id,
    kind: room.kind,
    attempt_id: row.id,
    user_id: userId,
    round_number: 0,
    event: "attempt_started",
    at: row.started_at,
  });
  // A Daily archive replay (Plus) is not a Daily played: archive.server.ts records daily_archive_played instead.
  if (asyncMode(room.kind) === "daily" && !isArchiveKind(room.kind))
    recordEvents({ event: "daily_started", playerId: userId, mode: "daily", roomId: room.id, props: { kind: room.kind } });
  return { ok: true, attempt: inserted.row, created: true };
}

/**
 * Stores a finished attempt whose rounds were played elsewhere (friend challenges made from a
 * finished room, challenge.server.ts): the room's own stored results, copied as they are (never
 * regraded), each round's start set so the time from start to receipt is what that player used,
 * and a round with no stored answer stored as missed (0). Its board columns are computed exactly as
 * a played attempt's are. Records no beta event (nobody played it here).
 */
export async function importFinishedAttempt(
  client: Db,
  room: AsyncRoomRow,
  who: { userId: string; name: string; colour: number | null; icon: string | null },
  rounds: readonly (Omit<AsyncResultRow, "id" | "room_id" | "attempt_id" | "user_id"> | null)[],
  nowMs: number,
): Promise<AsyncAttemptRow> {
  const attempt: AsyncAttemptRow = {
    id: crypto.randomUUID(),
    room_id: room.id,
    user_id: who.userId,
    display_name: who.name,
    colour: who.colour,
    icon: who.icon,
    started_at: iso(nowMs),
    finished_at: null,
    rounds_done: 0,
    total_score: 0,
    tie_ms: tieTotal(room, []),
    round_scores: Array.from({ length: room.round_count }, () => null),
  };
  const { error } = await insertAttemptRow(client, attempt);
  if (error) throw dbError(error, "asyncRoom");
  const rows: AsyncResultRow[] = Array.from({ length: room.round_count }, (_, i) => {
    const stored = rounds[i];
    const base = {
      id: crypto.randomUUID(),
      room_id: room.id,
      attempt_id: attempt.id,
      user_id: who.userId,
      round_number: i + 1,
    };
    return stored
      ? { ...stored, ...base }
      : {
          ...base,
          started_at: iso(nowMs),
          answered: false,
          answered_at: null,
          missed: true,
          answer: null,
          is_correct: false,
          ms_remaining: 0,
          reaction_avg_ms: null,
          correct_count: null,
          errors: null,
          extra: { missed: true },
          score: 0,
        };
  });
  const { error: resultError } = await insertAsyncResults(client, rows);
  if (resultError) throw dbError(resultError, "asyncRoom");
  return refreshAttempt(client, room, attempt, rows, nowMs, false);
}

/** The tie-break rounds of an async room (every round dealt is stamped tieRev; tieBreak.ts). */
function tieRounds(room: AsyncRoomRow): TieRound[] {
  return room.puzzles_public.map((puzzle) => tieRoundFor(puzzle));
}

/** The room tie-break's time used over every round: a round with no stored answer counts its whole clock. */
function tieTotal(room: AsyncRoomRow, rows: readonly AsyncResultRow[]): number {
  return tieRounds(room).reduce((sum, round, index) => {
    const row = rows.find((r) => r.round_number === index + 1 && r.answered && !r.missed);
    return sum + roundTimeUsedMs(row ? asRoundResult(row) : undefined, round);
  }, 0);
}

/** A round is done once graded or missed. */
const done = (row: AsyncResultRow | undefined) => !!row && (row.answered || row.missed);

/** Recomputes the attempt's board columns from its stored results (the only writer of them). */
async function refreshAttempt(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  rows: readonly AsyncResultRow[],
  nowMs: number,
  record = true,
): Promise<AsyncAttemptRow> {
  const scores = Array.from({ length: room.round_count }, (_, i) => {
    const row = rows.find((r) => r.round_number === i + 1);
    return done(row) ? row!.score : null;
  });
  const roundsDone = scores.filter((s) => s !== null).length;
  const finished = roundsDone >= room.round_count;
  const next = {
    rounds_done: roundsDone,
    total_score: scores.reduce<number>((sum, s) => sum + (s ?? 0), 0),
    tie_ms: tieTotal(room, rows),
    round_scores: scores,
    finished_at: attempt.finished_at ?? (finished ? iso(nowMs) : null),
  };
  await updateAttempt(client, attempt.id, attempt.user_id, next);
  if (record && finished && !attempt.finished_at)
    await recordAsyncEvent(client, {
      room_id: room.id,
      kind: room.kind,
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      round_number: 0,
      event: "attempt_finished",
      at: next.finished_at!,
    });
  // A Score Attack's finish is recorded by the tournaments code (tournament_finished), never as a Daily or challenge.
  if (record && finished && !attempt.finished_at && !isArchiveKind(room.kind) && asyncMode(room.kind) !== "tournament")
    recordEvents({
      event: asyncMode(room.kind) === "daily" ? "daily_finished" : "challenge_played",
      playerId: attempt.user_id,
      mode: asyncMode(room.kind),
      score: next.total_score,
      completed: true,
      roomId: room.id,
      props: { kind: room.kind, rounds: roundsDone },
    });
  return { ...attempt, ...next };
}

/**
 * Rounds started but never answered once they stop taking answers score 0, as a player with no
 * answer in a room does (missed), and are recorded as abandoned.
 */
async function closeMissedRounds(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  rows: AsyncResultRow[],
  nowMs: number,
): Promise<boolean> {
  let changed = false;
  for (const row of rows) {
    if (done(row)) continue;
    const puzzle = room.puzzles_public[row.round_number - 1];
    if (asyncReceipt(puzzle, msOf(row.started_at), nowMs) !== "closed") continue;
    const { data } = await updateOpenAsyncResult(client, attempt.id, row.round_number, {
      missed: true,
      score: 0,
      is_correct: false,
      ms_remaining: 0,
      extra: { missed: true },
    });
    if (!data) continue;
    Object.assign(row, {
      missed: true,
      score: 0,
      is_correct: false,
      ms_remaining: 0,
      extra: { missed: true },
    });
    changed = true;
    await recordAsyncEvent(client, {
      room_id: room.id,
      kind: room.kind,
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      round_number: row.round_number,
      event: "round_abandoned",
      reason: "no_answer",
      at: iso(asyncRoundWindow(puzzle, msOf(row.started_at)).closesAt),
    });
  }
  return changed;
}

/** The caller's own view of their attempt (missed rounds closed first). */
export async function attemptView(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  nowMs: number,
): Promise<{ view: AsyncAttemptView; attempt: AsyncAttemptRow }> {
  const rows = await resultsOf(client, attempt.id);
  let current = attempt;
  if (await closeMissedRounds(client, room, attempt, rows, nowMs))
    current = await refreshAttempt(client, room, attempt, rows, nowMs);
  const view: AsyncAttemptView = {
    roomId: room.id,
    attemptId: attempt.id,
    roundCount: room.round_count,
    rounds: room.round_order.map((type, i) => {
      const row = rows.find((r) => r.round_number === i + 1);
      return {
        round: i + 1,
        type,
        startedAt: row ? msOf(row.started_at) : null,
        score: done(row) ? row!.score : null,
        missed: !!row?.missed,
      };
    }),
    finished: current.rounds_done >= room.round_count,
    total: current.total_score,
    closesAt: msOf(room.closes_at),
  };
  return { view, attempt: current };
}

/* ----------------------------------------------------------------- rounds */

/**
 * Starts the caller's round (or returns the start already stored, so a reload continues on the
 * same clock). Rounds go in order; no round starts once the room has closed. Returns the round's
 * public half only: the puzzle reaches the phone here and nowhere earlier.
 */
export async function startAsyncRound(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
  nowMs: number,
): Promise<{ ok: true; puzzle: PuzzleData; startedAt: number } | { ok: false; message: string }> {
  const pub = room.puzzles_public[round - 1];
  if (!pub || !Number.isInteger(round)) return { ok: false, message: "That round doesn’t exist." };
  const rows = await resultsOf(client, attempt.id);
  if (await closeMissedRounds(client, room, attempt, rows, nowMs))
    await refreshAttempt(client, room, attempt, rows, nowMs);
  const mine = rows.find((r) => r.round_number === round);
  if (mine) {
    if (done(mine)) return { ok: false, message: "You’ve played that round." };
    return { ok: true, puzzle: pub, startedAt: msOf(mine.started_at) };
  }
  for (let earlier = 1; earlier < round; earlier++)
    if (!done(rows.find((r) => r.round_number === earlier)))
      return { ok: false, message: "Play the earlier rounds first." };
  if (nowMs >= msOf(room.closes_at) || retiredClosed(room)) return { ok: false, message: "This challenge has closed." };
  const row: AsyncResultRow = {
    id: crypto.randomUUID(),
    room_id: room.id,
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    round_number: round,
    started_at: iso(nowMs),
    answered: false,
    answered_at: null,
    missed: false,
    answer: null,
    is_correct: false,
    ms_remaining: 0,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score: 0,
  };
  const { error } = await insertAsyncResults(client, row);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const raced = (await resultsOf(client, attempt.id)).find((r) => r.round_number === round);
      if (raced && !done(raced))
        return { ok: true, puzzle: pub, startedAt: msOf(raced.started_at) };
      return { ok: false, message: "You’ve played that round." };
    }
    throw dbError(error, "asyncRoom");
  }
  await recordAsyncEvent(client, {
    room_id: room.id,
    kind: room.kind,
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    round_number: round,
    event: "round_started",
    at: row.started_at,
  });
  recordEvents({
    event: "game_started",
    playerId: attempt.user_id,
    game: pub.type,
    mode: asyncMode(room.kind),
    roomId: room.id,
    // A Daily archive replay (Plus) keeps the daily mode and is marked, so it is counted apart from real Daily games.
    props: isArchiveKind(room.kind) ? { round, archive: true } : { round },
  });
  return { ok: true, puzzle: pub, startedAt: nowMs };
}

/**
 * The room's grading of an async answer: gradeRoomAnswer on the player's own round start, read as the room phase it
 * stands for by the round engine (src/lib/round/receipt.ts phaseReceiptOf: in time, the puzzle phase from the stored
 * start; late, a reveal-phase answer with 0 ms left).
 */
export async function gradeAsyncAnswer(
  puzzle: PuzzleData,
  startedAt: number,
  nowMs: number,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
) {
  const { gradeRoomAnswer } = await import("./roomGrade.server");
  const receipt = asyncReceipt(puzzle, startedAt, nowMs);
  return {
    receipt,
    ...gradeRoomAnswer(puzzle, phaseReceiptOf(puzzle, { startedAt, nowMs }), answer, msRemaining, extra),
  };
}

/** Grades and stores the caller's answer for a round they started; the first stored answer stands. */
export async function submitAsyncAnswer(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  input: {
    round: number;
    answer: string;
    msRemaining: number;
    extra?: SubmitExtra | undefined;
    /** How it was played (lib/inputType.ts), for the analytics event only; never graded. */
    inputType?: unknown;
  },
  nowMs: number,
): Promise<
  { ok: true; alreadySubmitted?: boolean; score?: number } | { ok: false; message: string }
> {
  const rows = await resultsOf(client, attempt.id);
  const row = rows.find((r) => r.round_number === input.round);
  if (!row) return { ok: false, message: "That round hasn’t started." };
  if (done(row)) return { ok: true, alreadySubmitted: true };
  const pub = room.puzzles_public[input.round - 1];
  if (!pub) return { ok: false, message: "That round doesn’t exist." };
  const startedAt = msOf(row.started_at);
  if (asyncReceipt(pub, startedAt, nowMs) === "closed") {
    await closeMissedRounds(client, room, attempt, rows, nowMs);
    await refreshAttempt(client, room, attempt, rows, nowMs);
    return { ok: false, message: "That round is over." };
  }
  const puzzle = mergePuzzle(pub, (await privateHalf(client, room.id, input.round)) ?? undefined);
  const { receipt, graded, clamped, serverMs, msLeft } = await gradeAsyncAnswer(
    puzzle,
    startedAt,
    nowMs,
    String(input.answer ?? ""),
    input.msRemaining,
    input.extra,
  );
  if (clamped)
    console.warn(
      `async_submit: time claim ${input.msRemaining}ms beyond server ${Math.round(serverMs)}ms (room ${room.id}, round ${input.round})`,
    );
  const values = {
    answered: true,
    answered_at: iso(nowMs),
    // The stored result's columns come from the round engine (src/lib/round/result.ts), the same as a room's.
    ...resultColumns(graded),
    extra: graded.extra ?? null,
  };
  const { data } = await updateOpenAsyncResult(client, attempt.id, input.round, values);
  if (!data) return { ok: true, alreadySubmitted: true };
  Object.assign(row, values);
  await recordAsyncEvent(client, {
    room_id: room.id,
    kind: room.kind,
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    round_number: input.round,
    event: "round_finished",
    reason: receipt === "puzzle" && msLeft > 0 ? "answered" : "timeout",
    at: values.answered_at,
  });
  recordEvents({
    event: "game_finished",
    playerId: attempt.user_id,
    game: puzzle.type,
    mode: asyncMode(room.kind),
    score: graded.score,
    completed: graded.isCorrect,
    durationMs: playedMs(puzzleTimeLimitMs(puzzle), msLeft, graded.extra as Record<string, unknown> | null | undefined),
    roomId: room.id,
    inputType: input.inputType,
    props: isArchiveKind(room.kind) ? { round: input.round, archive: true } : { round: input.round },
  });
  await refreshAttempt(client, room, attempt, rows, nowMs);
  return { ok: true, score: graded.score };
}

/**
 * The lock on a round's solution (asyncRoom.ts SolutionLock) while the room's window is open, or null once it has
 * closed or when the round has nothing private (arcade runs, the games whose answers are all on screen).
 */
export function solutionLockFor(
  room: Pick<AsyncRoomRow, "kind" | "closes_at">,
  priv: Record<string, unknown> | null | undefined,
  nowMs: number,
): SolutionLock | null {
  if (!(nowMs < msOf(room.closes_at))) return null;
  // A Daily archive replay: its day closed long ago, so its solutions are already out.
  if (isArchiveKind(room.kind)) return null;
  if (!priv || Object.keys(priv).every((key) => key === "type")) return null;
  return { kind: solutionLockKind(room.kind), unlocksAt: room.closes_at };
}

/**
 * A stored result's `extra` while its round's solution is locked: every entry named for a field of the private half is
 * left out, at any depth (some graders keep the minimum or the par beside the player's own figures: Gradient's and
 * Skid's `minMoves`, Forage's `par`, Brimful's `boards[].minMoves`), so a result row never carries what the lock
 * withholds. Everything else is kept.
 */
export function lockedExtra(
  extra: Record<string, unknown> | null,
  priv: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!extra || !priv) return extra;
  const hidden = new Set(Object.keys(priv).filter((key) => key !== "type"));
  const cut = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(cut);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) if (!hidden.has(key)) out[key] = cut(inner);
    return out;
  };
  return cut(extra) as Record<string, unknown>;
}

/**
 * The reveal of one of the caller's rounds: their stored result and its summary, only once that result is stored
 * (graded or missed), never another player's answer. The full puzzle and the correct answer only once the room's window
 * has closed (SolutionLock); before that the public half, the summary worked out from it alone, and `solutionLock`.
 */
export async function asyncRoundReveal(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
  nowMs: number,
): Promise<
  | {
      ok: true;
      puzzle: PuzzleData;
      result: RoundResultRow;
      missed: boolean;
      summary: string;
      detail: string[];
      correctAnswer: string | null;
      solutionLock: SolutionLock | null;
      /** The look the round was played in (async_results.look; display only, for the player's own replay). */
      look: unknown;
    }
  | { ok: false; message: string }
> {
  const row = (await resultsOf(client, attempt.id)).find((r) => r.round_number === round);
  if (!done(row)) return { ok: false, message: "That round isn’t over yet." };
  const pub = room.puzzles_public[round - 1];
  if (!pub) return { ok: false, message: "That round doesn’t exist." };
  const priv = await privateHalf(client, room.id, round);
  const solutionLock = solutionLockFor(room, priv, nowMs);
  // Locked: the summary and every line below see the public half only, so nothing private can ride out in them.
  const puzzle = solutionLock ? pub : mergePuzzle(pub, priv ?? undefined);
  const stored = asRoundResult(row!);
  const result = solutionLock ? { ...stored, extra: lockedExtra(stored.extra, priv) } : stored;
  const definition = puzzleDef(puzzle.type);
  let summary = row!.missed ? "No answer" : "—";
  let detail: string[] = [];
  if (!row!.missed)
    try {
      ({ summary, detail } = definition.roundSummary(result, puzzle));
    } catch (err) {
      // A summary that needs the solution has none while it is locked.
      if (!solutionLock) console.error(`[async-reveal] summary failed for ${puzzle.type}`, err);
    }
  let correctAnswer: string | null = null;
  if (!solutionLock)
    try {
      correctAnswer = definition.correctAnswer(puzzle);
    } catch (err) {
      console.error(`[async-reveal] answer failed for ${puzzle.type}`, err);
    }
  const look = (row as { look?: unknown }).look ?? null;
  return { ok: true, puzzle, result, missed: row!.missed, summary, detail, correctAnswer, solutionLock, look };
}

/** The live round's public and private halves, only while the caller's own round takes answers. */
export async function liveRoundPuzzle(
  client: Db,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
  nowMs: number,
): Promise<{ pub: PuzzleData; priv: () => Promise<Record<string, unknown> | undefined> } | null> {
  const row = (await resultsOf(client, attempt.id)).find((r) => r.round_number === round);
  if (!row || done(row)) return null;
  const pub = room.puzzles_public[round - 1];
  // Word checks only while the clock runs (as rooms: never once late answers are all that's left).
  if (!pub || asyncReceipt(pub, msOf(row.started_at), nowMs) !== "puzzle") return null;
  return { pub, priv: async () => (await privateHalf(client, room.id, round)) ?? undefined };
}
