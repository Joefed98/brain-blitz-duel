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
import { asyncReceipt, asyncRoundWindow, type AsyncAttemptView } from "./asyncRoom";
import { recordAsyncEvent, recordRoundRecordsFor, roundRecords } from "./betaRecord.server";
import { puzzleDef, puzzleTimeLimitMs } from "./registry";
import { roundTimeUsedMs, type TieRound } from "./scoring";
import { tieRoundFor } from "./tieBreak";
import type { SubmitExtra } from "./grade";
import type { PuzzleData, RoundResultRow } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const UNIQUE_VIOLATION = "23505";

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

export async function roomByKey(client: any, key: string): Promise<AsyncRoomRow | null> {
  const { data, error } = await client
    .from("async_rooms")
    .select("*")
    .eq("room_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AsyncRoomRow | null) ?? null;
}

export async function roomById(client: any, id: string): Promise<AsyncRoomRow | null> {
  const { data, error } = await client.from("async_rooms").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AsyncRoomRow | null) ?? null;
}

/**
 * Stores a newly dealt room under its key, once: when two callers race, the first insert wins and
 * both get that room (the loser's deal is never stored or sent). The private halves are stored
 * before the room is returned to anyone.
 */
export async function createAsyncRoom(
  client: any,
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
  const { error } = await client.from("async_rooms").insert(row);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const existing = await roomByKey(client, input.key);
      if (existing) return existing;
    }
    throw new Error(error.message);
  }
  const { error: secretError } = await client.from("async_room_secrets").insert({
    room_id: id,
    puzzles_private: JSON.parse(JSON.stringify(split.map((s) => s.priv))),
  });
  if (secretError && secretError.code !== UNIQUE_VIOLATION) throw new Error(secretError.message);
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
  client: any,
  roomId: string,
  round: number,
): Promise<Record<string, unknown> | null> {
  const { data } = await client
    .from("async_room_secrets")
    .select("puzzles_private")
    .eq("room_id", roomId)
    .maybeSingle();
  const list = (data?.puzzles_private ?? null) as Record<string, unknown>[] | null;
  return list?.[round - 1] ?? null;
}

/* --------------------------------------------------------------- attempts */

export async function attemptFor(
  client: any,
  roomId: string,
  userId: string,
): Promise<AsyncAttemptRow | null> {
  const { data, error } = await client
    .from("async_attempts")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AsyncAttemptRow | null) ?? null;
}

export async function attemptsIn(client: any, roomId: string): Promise<AsyncAttemptRow[]> {
  const { data, error } = await client.from("async_attempts").select("*").eq("room_id", roomId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AsyncAttemptRow[];
}

async function resultsOf(client: any, attemptId: string): Promise<AsyncResultRow[]> {
  const { data, error } = await client
    .from("async_results")
    .select("*")
    .eq("attempt_id", attemptId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AsyncResultRow[]).sort((a, b) => a.round_number - b.round_number);
}

/**
 * The caller's one attempt in a room: created on the first start, the same row ever after (the
 * unique index decides a race). `created` is false when the device had already started.
 */
export async function startAttempt(
  client: any,
  room: AsyncRoomRow,
  userId: string,
  who: { name: string; colour: number | null; icon: string | null },
  nowMs: number,
): Promise<
  { ok: true; attempt: AsyncAttemptRow; created: boolean } | { ok: false; message: string }
> {
  const existing = await attemptFor(client, room.id, userId);
  if (existing) return { ok: true, attempt: existing, created: false };
  if (nowMs >= msOf(room.closes_at)) return { ok: false, message: "This challenge has closed." };
  if (nowMs < msOf(room.opens_at))
    return { ok: false, message: "This challenge hasn't opened yet." };
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
  const { error } = await client.from("async_attempts").insert(row);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const raced = await attemptFor(client, room.id, userId);
      if (raced) return { ok: true, attempt: raced, created: false };
    }
    throw new Error(error.message);
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
  return { ok: true, attempt: row, created: true };
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
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  rows: readonly AsyncResultRow[],
  nowMs: number,
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
  await client
    .from("async_attempts")
    .update(next)
    .eq("id", attempt.id)
    .eq("user_id", attempt.user_id);
  if (finished && !attempt.finished_at)
    await recordAsyncEvent(client, {
      room_id: room.id,
      kind: room.kind,
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      round_number: 0,
      event: "attempt_finished",
      at: next.finished_at!,
    });
  return { ...attempt, ...next };
}

/**
 * Rounds started but never answered once they stop taking answers score 0, as a player with no
 * answer in a room does (missed), and are recorded as abandoned.
 */
async function closeMissedRounds(
  client: any,
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
    const { data } = await client
      .from("async_results")
      .update({
        missed: true,
        score: 0,
        is_correct: false,
        ms_remaining: 0,
        extra: { missed: true },
      })
      .eq("attempt_id", attempt.id)
      .eq("round_number", row.round_number)
      .eq("answered", false)
      .eq("missed", false)
      .select()
      .maybeSingle();
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
  client: any,
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
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
  nowMs: number,
): Promise<{ ok: true; puzzle: PuzzleData; startedAt: number } | { ok: false; message: string }> {
  const pub = room.puzzles_public[round - 1];
  if (!pub || !Number.isInteger(round)) return { ok: false, message: "Unknown round." };
  const rows = await resultsOf(client, attempt.id);
  if (await closeMissedRounds(client, room, attempt, rows, nowMs))
    await refreshAttempt(client, room, attempt, rows, nowMs);
  const mine = rows.find((r) => r.round_number === round);
  if (mine) {
    if (done(mine)) return { ok: false, message: "You've played that round." };
    return { ok: true, puzzle: pub, startedAt: msOf(mine.started_at) };
  }
  for (let earlier = 1; earlier < round; earlier++)
    if (!done(rows.find((r) => r.round_number === earlier)))
      return { ok: false, message: "Play the earlier rounds first." };
  if (nowMs >= msOf(room.closes_at)) return { ok: false, message: "This challenge has closed." };
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
  const { error } = await client.from("async_results").insert(row);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const raced = (await resultsOf(client, attempt.id)).find((r) => r.round_number === round);
      if (raced && !done(raced))
        return { ok: true, puzzle: pub, startedAt: msOf(raced.started_at) };
      return { ok: false, message: "You've played that round." };
    }
    throw new Error(error.message);
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
  return { ok: true, puzzle: pub, startedAt: nowMs };
}

/** The room's grading of an async answer: gradeRoomAnswer on the player's own round start. */
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
    ...gradeRoomAnswer(
      puzzle,
      // In time: the round's own puzzle phase from its stored start; late: a reveal-phase answer (0 ms left).
      { phase: receipt === "puzzle" ? "puzzle" : "reveal", phaseStartedAt: iso(startedAt), nowMs },
      answer,
      msRemaining,
      extra,
    ),
  };
}

/** Grades and stores the caller's answer for a round they started; the first stored answer stands. */
export async function submitAsyncAnswer(
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  input: { round: number; answer: string; msRemaining: number; extra?: SubmitExtra | undefined },
  nowMs: number,
): Promise<
  { ok: true; alreadySubmitted?: boolean; score?: number } | { ok: false; message: string }
> {
  const rows = await resultsOf(client, attempt.id);
  const row = rows.find((r) => r.round_number === input.round);
  if (!row) return { ok: false, message: "That round hasn't started." };
  if (done(row)) return { ok: true, alreadySubmitted: true };
  const pub = room.puzzles_public[input.round - 1];
  if (!pub) return { ok: false, message: "Unknown round." };
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
    answer: graded.answer || null,
    is_correct: graded.isCorrect,
    ms_remaining: graded.storedMs,
    reaction_avg_ms: graded.reactionAvgMs,
    correct_count: graded.correctCount,
    errors: graded.errors,
    extra: graded.extra ?? null,
    score: graded.score,
  };
  const { data } = await client
    .from("async_results")
    .update(values)
    .eq("attempt_id", attempt.id)
    .eq("round_number", input.round)
    .eq("answered", false)
    .eq("missed", false)
    .select()
    .maybeSingle();
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
  await refreshAttempt(client, room, attempt, rows, nowMs);
  return { ok: true, score: graded.score };
}

/**
 * The reveal of one of the caller's rounds: the full puzzle, their stored result and its summary,
 * only once that result is stored (graded or missed). Never another player's answer.
 */
export async function asyncRoundReveal(
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
): Promise<
  | {
      ok: true;
      puzzle: PuzzleData;
      result: RoundResultRow;
      missed: boolean;
      summary: string;
      detail: string[];
      correctAnswer: string | null;
    }
  | { ok: false; message: string }
> {
  const row = (await resultsOf(client, attempt.id)).find((r) => r.round_number === round);
  if (!done(row)) return { ok: false, message: "That round isn't finished yet." };
  const pub = room.puzzles_public[round - 1];
  if (!pub) return { ok: false, message: "Unknown round." };
  const puzzle = mergePuzzle(pub, (await privateHalf(client, room.id, round)) ?? undefined);
  const result = asRoundResult(row!);
  const definition = puzzleDef(puzzle.type);
  let summary = row!.missed ? "No answer" : "—";
  let detail: string[] = [];
  if (!row!.missed)
    try {
      ({ summary, detail } = definition.roundSummary(result, puzzle));
    } catch (err) {
      console.error(`[async-reveal] summary failed for ${puzzle.type}`, err);
    }
  let correctAnswer: string | null = null;
  try {
    correctAnswer = definition.correctAnswer(puzzle);
  } catch (err) {
    console.error(`[async-reveal] answer failed for ${puzzle.type}`, err);
  }
  return { ok: true, puzzle, result, missed: row!.missed, summary, detail, correctAnswer };
}

/** The live round's public and private halves, only while the caller's own round takes answers. */
export async function liveRoundPuzzle(
  client: any,
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
