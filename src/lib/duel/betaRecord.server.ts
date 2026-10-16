/**
 * Beta recording (docs/beta-sql.md, gaps G2–G4): append-only rows that let the
 * beta queries see how rooms and practice are used. Server-only; the client is
 * the service-role Supabase client (or the in-memory stand-in in
 * scripts/*-check.ts). Tables: room_events, room_joins and practice_plays
 * (migrations 20261016130000–20261016130200), RLS on with no client access.
 *
 * Never part of play: nothing here is read back by any game, score, timing or
 * replay path. Every write is best-effort: an error (the migration not applied
 * yet, the database down, a duplicate) is logged and play carries on, and a
 * slow write is abandoned after RECORD_TIMEOUT_MS.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The longest a recording write may hold up the server function it rides on. */
export const RECORD_TIMEOUT_MS = 1_500;

const UNIQUE_VIOLATION = "23505";

/** Which game in the room a row belongs to: the Play again count before it (0 = the first game). */
export function gameIndexOf(room: { tournament_history?: readonly unknown[] | null }): number {
  return Array.isArray(room.tournament_history) ? room.tournament_history.length : 0;
}

/** Runs one recording write; logs and swallows every failure, never waits past the timeout. */
async function bestEffort(
  label: string,
  write: () => PromiseLike<{ error?: any } | null | undefined>,
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
export async function recordRoomEvent(client: any, row: RoomEventRow): Promise<void> {
  await bestEffort(`room_events ${row.event} room=${row.duel_id} round=${row.round_number}`, () =>
    client.from("room_events").insert({ reason: null, ...row }),
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

export async function recordJoin(client: any, row: RoomJoinRow): Promise<void> {
  await bestEffort(`room_joins room=${row.duel_id} slot=${row.player_slot}`, () =>
    client.from("room_joins").insert({ rejoin: false, ...row }),
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
  client: any,
  makeRow: (userId: string | null) => PracticePlayRow,
  userId?: () => Promise<string | null>,
): Promise<void> {
  await bestEffort("practice_plays", async () => {
    const row = makeRow(await (userId ?? (() => callerUserId(client)))());
    return client.from("practice_plays").insert(row);
  });
}

/**
 * The caller's device id (anonymous auth user) from the bearer token the app
 * attaches to every server call (auth-attacher.ts), or null without one.
 * Practice stays open to callers without a session: this never throws.
 */
export async function callerUserId(client: any): Promise<string | null> {
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
