/**
 * The daily challenge on the server (21 Oct 2026; daily.ts has the shared rules): today's two
 * async rooms, dealt on the first start of the UK day and stored, the boards and each device's
 * status. Never dealt per device: the first caller of the day deals and stores the room under its
 * unique key, and every later caller (and the racing loser) plays that stored room.
 *
 * - Daily Puzzle: one active game from each puzzle category, ordered and drawn by the room's
 *   selection (selection.ts pickRoundOrder, no category twice in a row); Daily Arcade: the first
 *   three of an arcade-only draw (no game twice). Retired games are never drawn (typesInCategory),
 *   Letterfall included. Yesterday's games are the draw's "previous room", so none repeats when its
 *   category has others left (EXCLUDE_MIN_ALTERNATIVES), and yesterday's banked boards are skipped.
 */
import {
  DAILY_COUNT_MIN,
  DAILY_BOARD_TOP,
  DAILY_PUZZLE_CATEGORIES,
  DAILY_ROOM_KIND,
  DAILY_ROUNDS,
  dailyRoomKey,
  rankBoard,
  shiftDayKey,
  shownPlayerCount,
  ukDayKey,
  ukDayWindow,
  type DailyBoardView,
  type DailyKind,
  type DailyState,
  type DailyStatus,
} from "./daily";
import {
  attemptFor,
  attemptsIn,
  attemptView,
  createAsyncRoom,
  roomByKey,
  type AsyncAttemptRow,
  type AsyncRoomRow,
} from "./asyncRoom.server";
import { generatePuzzle } from "./generate.server";
import { pickRoundOrder, newRoomSeed } from "./selection";
import { stampTieRev } from "./tieBreak";
import type { UnblockBankRow } from "./unblock.server";
import type { PuzzleData, PuzzleType } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export { DAILY_COUNT_MIN };

/** A daily's games from its seed: Daily Puzzle one per puzzle category, Daily Arcade three arcade games. */
export function dailyRoundOrder(
  kind: DailyKind,
  seed: number,
  recent: readonly (readonly string[])[],
): PuzzleType[] {
  const categories = kind === "puzzle" ? DAILY_PUZZLE_CATEGORIES : (["arcade"] as const);
  return pickRoundOrder({ categories, recent: recent as never, seed }).slice(0, DAILY_ROUNDS[kind]);
}

/** Deals one daily from its seed: the order, then every puzzle, as a room's start does. */
export function dealDaily(
  kind: DailyKind,
  input: {
    seed: number;
    /** Yesterday's round order (the draw's "previous room"), then older ones. */
    recent?: readonly (readonly string[])[];
    unblockRow?: UnblockBankRow | null;
    recentBankKeys?: ReadonlySet<string>;
  },
): { roundOrder: PuzzleType[]; puzzles: PuzzleData[] } {
  const roundOrder = dailyRoundOrder(kind, input.seed, input.recent ?? []);
  return {
    roundOrder,
    puzzles: roundOrder.map((type) =>
      stampTieRev(
        generatePuzzle(type, {
          unblockRow: input.unblockRow ?? null,
          bankSeed: input.seed,
          recentBankKeys: input.recentBankKeys,
        }),
      ),
    ),
  };
}

export async function dailyRoom(
  client: any,
  kind: DailyKind,
  day: string,
): Promise<AsyncRoomRow | null> {
  return roomByKey(client, dailyRoomKey(kind, day));
}

/** Today's room for a daily, dealt and stored now if no one has started it yet. */
export async function ensureDailyRoom(
  client: any,
  kind: DailyKind,
  nowMs: number,
  createdBy: string | null,
): Promise<AsyncRoomRow> {
  const day = ukDayKey(nowMs);
  const existing = await dailyRoom(client, kind, day);
  if (existing) return existing;
  const yesterday = await dailyRoom(client, kind, shiftDayKey(day, -1));
  const recentBankKeys = new Set<string>();
  if (yesterday) {
    const { bankKey } = await import("./puzzleBank.server");
    for (const puzzle of yesterday.puzzles_public ?? []) {
      const key = bankKey(puzzle as never);
      if (key) recentBankKeys.add(key);
    }
  }
  const seed = newRoomSeed();
  let unblockRow: UnblockBankRow | null = null;
  const recent = yesterday ? [yesterday.round_order] : [];
  if (dailyRoundOrder(kind, seed, recent).includes("unblock")) {
    const { drawUnblockRow } = await import("./unblock.server");
    unblockRow = await drawUnblockRow(client);
  }
  const { puzzles } = dealDaily(kind, {
    seed,
    recent,
    unblockRow,
    recentBankKeys,
  });
  const { opensAt, closesAt } = ukDayWindow(day);
  console.log(`[daily] ${kind} ${day} seed=${seed} order=${puzzles.map((p) => p.type).join(",")}`);
  return createAsyncRoom(client, {
    kind: DAILY_ROOM_KIND[kind],
    key: dailyRoomKey(kind, day),
    day,
    seed,
    puzzles,
    opensAt,
    closesAt,
    createdBy,
  });
}

const msOf = (stamp: string | null | undefined) => (stamp ? Date.parse(stamp) : Number.NaN);

/** Who is on a room's board: finished attempts, and every attempt once the room has closed. */
function boardAttempts(
  room: AsyncRoomRow,
  attempts: readonly AsyncAttemptRow[],
  nowMs: number,
): AsyncAttemptRow[] {
  const closed = nowMs >= msOf(room.closes_at);
  return attempts.filter((a) => closed || a.finished_at !== null);
}

function ranked(room: AsyncRoomRow, attempts: readonly AsyncAttemptRow[], nowMs: number) {
  return rankBoard(
    boardAttempts(room, attempts, nowMs).map((a) => ({
      id: a.id,
      total: a.total_score,
      tieMs: Number(a.tie_ms),
      finishedAt: a.finished_at ? msOf(a.finished_at) : msOf(room.closes_at),
      attempt: a,
    })),
  );
}

/**
 * A daily's board for a day. Open once the caller has finished that day's attempt, or once the day
 * has closed; until then only their own line and (from DAILY_COUNT_MIN players) the count. Names
 * as the players set them; no answers, round scores or times of anyone else ever.
 */
export async function dailyBoard(
  client: any,
  kind: DailyKind,
  day: string,
  userId: string,
  nowMs: number,
): Promise<DailyBoardView> {
  const room = await dailyRoom(client, kind, day);
  if (!room)
    return { day, open: nowMs >= ukDayWindow(day).closesAt, count: null, rows: [], me: null };
  const attempts = await attemptsIn(client, room.id);
  let mine = attempts.find((a) => a.user_id === userId) ?? null;
  // The caller's own missed rounds are closed first, so their line is current.
  if (mine) mine = (await attemptView(client, room, mine, nowMs)).attempt;
  const all = attempts.map((a) => (mine && a.id === mine.id ? mine : a));
  const board = ranked(room, all, nowMs);
  const closed = nowMs >= msOf(room.closes_at);
  const open = closed || !!mine?.finished_at;
  const myEntry = mine ? board.find((e) => e.id === mine!.id) : undefined;
  return {
    day,
    open,
    count: shownPlayerCount(board.length),
    rows: open
      ? board.slice(0, DAILY_BOARD_TOP).map((e) => ({
          rank: e.rank,
          name: e.attempt.display_name,
          total: e.total,
          colour: e.attempt.colour,
          icon: e.attempt.icon,
          isMe: e.id === mine?.id,
        }))
      : [],
    me: mine
      ? {
          rank: myEntry?.rank ?? null,
          total: mine.total_score,
          rounds: mine.round_scores,
          finished: !!mine.finished_at,
          name: mine.display_name,
        }
      : null,
  };
}

async function stateFor(
  client: any,
  kind: DailyKind,
  day: string,
  userId: string,
  nowMs: number,
): Promise<DailyState> {
  const room = await dailyRoom(client, kind, day);
  if (!room) return { state: "play" };
  const mine = await attemptFor(client, room.id, userId);
  if (!mine) return { state: "play" };
  const { attempt } = await attemptView(client, room, mine, nowMs);
  if (!attempt.finished_at) return { state: "continue", roundsDone: attempt.rounds_done };
  const board = ranked(room, await attemptsIn(client, room.id), nowMs);
  return {
    state: "done",
    total: attempt.total_score,
    rank: board.find((e) => e.id === attempt.id)?.rank ?? null,
    count: shownPlayerCount(board.length),
  };
}

/** Both dailies' state for this device today; `available: false` before the migration is applied. */
export async function dailyStatus(
  client: any,
  userId: string | null,
  nowMs: number,
): Promise<DailyStatus> {
  const day = ukDayKey(nowMs);
  const { closesAt } = ukDayWindow(day);
  const base = { day, closesAt };
  // The tables must exist: any read error (no table yet) hides the daily everywhere.
  const probe = await client
    .from("async_rooms")
    .select("id")
    .eq("room_key", dailyRoomKey("puzzle", day))
    .maybeSingle();
  if (probe?.error)
    return { available: false, ...base, puzzle: { state: "play" }, arcade: { state: "play" } };
  const { challengesAvailable } = await import("./challenge.server");
  return {
    available: true,
    challenges: await challengesAvailable(client).catch(() => false),
    ...base,
    puzzle: userId ? await stateFor(client, "puzzle", day, userId, nowMs) : { state: "play" },
    arcade: userId ? await stateFor(client, "arcade", day, userId, nowMs) : { state: "play" },
  };
}
