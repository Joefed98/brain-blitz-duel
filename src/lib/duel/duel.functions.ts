import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { type SubmitExtra } from "./grade";
import { normaliseCategories, STANDARD_CATEGORIES } from "./categories";
import { puzzleDef, puzzleDurationMs, puzzleRevealMs, typesInCategory } from "./registry";
import { generateRoomCode } from "./puzzles";
import { linkRoomState } from "./roomLink";
import { mergePuzzle, splitPuzzle } from "./secrets";
import { allContinued, allIntroReady, betweenScreenDue, isContinuePhase } from "./roomFlow";
import {
  finishGame,
  forfeitRecord,
  leaveBetweenRoundScreen,
  recordContinue,
  recordForfeitInHistory,
  setPhase,
} from "./roomPhase.server";
import { DUEL_START_MS, ROUND_TITLE_MS, WINNER_REVEAL_MS } from "./startPresentation";
import {
  INACTIVE_AFTER_MISSED,
  INTRO_MS,
  INTRO_WAIT_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  TOTAL_ROUNDS,
  MAX_ROUNDS,
  type DuelPhase,
  type DuelPlayerRow,
  type DuelRow,
  type PuzzleData,
  type PuzzleType,
  type PuzzleCategory,
  type RoundResultRow,
} from "./types";

/** How many of the host's recent rooms feed the repeat-avoiding draw. */
const RECENT_ROOMS = 3;
/** How many of the host's recent rooms' banked boards a new room avoids. */
const RECENT_BANK_ROOMS = 20;

/* -------------------------------------------------------------------------- */
/*  Server-only helpers                                                        */
/*                                                                             */
/*  The tables are still named duels / duel_players / duel_secrets — a room is  */
/*  simply a duel with two to ten players.                                      */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const UNIQUE_VIOLATION = "23505";

function cleanName(name: string): string {
  const trimmed = (name ?? "").trim().slice(0, 14);
  return trimmed.length > 0 ? trimmed : "Player";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function nowIso(): string {
  return new Date().toISOString();
}

async function getRoom(client: any, roomId: string): Promise<DuelRow> {
  const { data, error } = await client.from("duels").select("*").eq("id", roomId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That room no longer exists.");
  return data as DuelRow;
}

async function getPlayers(client: any, roomId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", roomId)
    .order("player_slot");
  if (error) throw new Error(error.message);
  return (data ?? []) as DuelPlayerRow[];
}

/** Players still in the room (anyone who has not tapped Leave). */
function present(players: DuelPlayerRow[]): DuelPlayerRow[] {
  return players.filter((p) => p.status !== "left");
}

/** Players whose answers the room waits for. */
function activePlayers(players: DuelPlayerRow[]): DuelPlayerRow[] {
  return players.filter((p) => p.status === "active");
}

/** Throws unless the caller has a player row in this room. */
async function requireParticipant(
  client: any,
  roomId: string,
  userId: string,
): Promise<DuelPlayerRow> {
  const { data } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You are not part of this room.");
  return data as DuelPlayerRow;
}

async function privatePuzzles(client: any, roomId: string): Promise<Record<string, unknown>[]> {
  const { data } = await client
    .from("duel_secrets")
    .select("puzzles_private")
    .eq("duel_id", roomId)
    .maybeSingle();
  return (data?.puzzles_private ?? []) as Record<string, unknown>[];
}

async function insertPlayer(
  client: any,
  roomId: string,
  slot: number,
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await client.from("duel_players").insert({
    duel_id: roomId,
    player_slot: slot,
    user_id: userId,
    display_name: cleanName(displayName),
    status: "active",
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

function firstFreeSlot(players: DuelPlayerRow[], maxPlayers: number): number | null {
  const taken = new Set(present(players).map((p) => p.player_slot));
  for (let slot = 1; slot <= maxPlayers; slot++) if (!taken.has(slot)) return slot;
  return null;
}

/**
 * Everyone active has tapped READY: pull the intro's start stamp back so only
 * the 3-2-1 countdown is left. Guarded on the stamp itself, so a burst of taps
 * shifts the round forward exactly once.
 */
async function startIntroCountdown(client: any, room: DuelRow, round: number): Promise<void> {
  const cutoff = new Date(Date.now() - INTRO_WAIT_MS).toISOString();
  await client
    .from("duels")
    .update({ phase_started_at: cutoff })
    .eq("id", room.id)
    .eq("current_round", round)
    .eq("phase", "intro")
    .gt("phase_started_at", cutoff);
}

async function createRoomRow(
  client: any,
  userId: string,
  displayName: string,
  categories: readonly PuzzleCategory[] = STANDARD_CATEGORIES,
): Promise<DuelRow> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await client
      .from("duels")
      .insert({
        room_code: generateRoomCode(),
        status: "waiting",
        host_user_id: userId,
        max_players: MAX_PLAYERS,
        round_count: TOTAL_ROUNDS,
        round_order: [],
        selected_categories: categories,

        puzzles_public: [],
        current_round: 0,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) continue; // room code collision
      throw new Error(error.message);
    }

    const room = data as DuelRow;
    await insertPlayer(client, room.id, 1, userId, displayName);
    return room;
  }
  throw new Error("Could not create a room right now. Please try again.");
}

function roundHasEnded(room: DuelRow, round: number): boolean {
  if (room.status === "finished") return true;
  if (room.current_round > round) return true;
  return (
    room.current_round === round &&
    (room.phase === "reveal" || room.phase === "result" || room.phase === "standings" || room.phase === "winner_reveal")
  );
}

/** How many answers are in for a round. */
async function submissionCount(client: any, roomId: string, round: number): Promise<number> {
  const { count } = await client
    .from("round_results")
    .select("id", { count: "exact", head: true })
    .eq("duel_id", roomId)
    .eq("round_number", round);
  return count ?? 0;
}

/** Slots that answered a round. */
async function answeredSlots(client: any, roomId: string, round: number): Promise<Set<number>> {
  const { data } = await client
    .from("round_results")
    .select("player_slot")
    .eq("duel_id", roomId)
    .eq("round_number", round);
  return new Set(((data ?? []) as { player_slot: number }[]).map((r) => r.player_slot));
}

/**
 * A player who has answered nothing for two rounds in a row stops holding the
 * room up. Any later answer puts them straight back to active.
 */
async function markInactivity(client: any, roomId: string, round: number): Promise<void> {
  if (round < INACTIVE_AFTER_MISSED) return;
  const players = activePlayers(await getPlayers(client, roomId));
  if (players.length === 0) return;
  const recent = await Promise.all(
    Array.from({ length: INACTIVE_AFTER_MISSED }, (_, i) =>
      answeredSlots(client, roomId, round - i),
    ),
  );
  const missing = players.filter((p) => recent.every((slots) => !slots.has(p.player_slot)));
  for (const player of missing) {
    await client.from("duel_players").update({ status: "inactive" }).eq("id", player.id);
  }
}

/**
 * The opening Go / No-Go item of the host's most recent room that played the
 * type, so the next room never opens on the same symbol.
 */
async function previousGoNoGoFirst(
  client: any,
  room: DuelRow,
  hostUserId: string | null,
): Promise<unknown> {
  if (!hostUserId) return null;
  const { data } = await client
    .from("duels")
    .select("puzzles_public")
    .eq("host_user_id", hostUserId)
    .neq("id", room.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_ROOMS);
  for (const row of (data ?? []) as { puzzles_public: unknown }[]) {
    const puzzles = Array.isArray(row.puzzles_public) ? row.puzzles_public : [];
    for (const puzzle of puzzles as { type?: string; items?: unknown[] }[]) {
      if (puzzle?.type === "gonogo" && Array.isArray(puzzle.items) && puzzle.items.length > 0) {
        return puzzle.items[0] ?? null;
      }
    }
  }
  return null;
}

/**
 * The round orders of the host's last three tournaments, including this room.
 */
async function recentRoundOrders(
  client: any,
  room: DuelRow,
  hostUserId: string | null,
): Promise<PuzzleType[][]> {
  const orders: PuzzleType[][] = [];

  if (hostUserId) {
    const { data } = await client
      .from("duels")
      .select("round_order, tournament_history, status, id, created_at")
      .eq("host_user_id", hostUserId)
      .order("created_at", { ascending: false })
      .limit(15);
    const tournaments: { date: string; order: PuzzleType[] }[] = [];
    for (const row of (data ?? []) as DuelRow[]) {
      if (row.status === "finished" && row.round_order?.length && !row.disbanded_at)
        tournaments.push({ date: row.phase_started_at ?? row.created_at, order: row.round_order });
      for (const entry of row.tournament_history ?? [])
        if (entry.round_order?.length)
          tournaments.push({ date: entry.date, order: entry.round_order });
    }
    tournaments.sort((a, b) => b.date.localeCompare(a.date));
    orders.push(...tournaments.map((entry) => entry.order));
  }

  // Repeated orders represent separate tournaments and still count toward recency.
  return orders.slice(0, RECENT_ROOMS);
}

/** Keep the last ten Word Match draws across rooms and rematches, keyed to the host. */
async function recentWordMatchWords(client: any, hostUserId: string | null): Promise<string[]> {
  if (!hostUserId) return [];
  const { data } = await client.from("duels")
    .select("puzzles_public, tournament_history, status, phase_started_at, created_at")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false }).limit(30);
  const runs: { date: string; words: string[] }[] = [];
  for (const row of data ?? []) {
    const prompts = (puzzles: unknown) => Array.isArray(puzzles)
      ? puzzles.flatMap((p: { type?: string; items?: { prompt?: string }[] }) =>
          p?.type === "wordmatch" && Array.isArray(p.items)
            ? p.items.map((item) => item.prompt).filter((word): word is string => typeof word === "string") : [])
      : [];
    if (row.status !== "waiting") runs.push({ date: row.phase_started_at ?? row.created_at, words: prompts(row.puzzles_public) });
    for (const entry of row.tournament_history ?? [])
      runs.push({ date: entry.date, words: Array.isArray(entry.word_match_words) ? entry.word_match_words : [] });
  }
  return runs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).flatMap((run) => run.words);
}

/** Banked boards (puzzleBank.server.ts) from the host's recent rooms, so a new room skips them. */
async function recentBankKeys(client: any, hostUserId: string | null): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!hostUserId) return keys;
  const { data } = await client.from("duels")
    .select("puzzles_public")
    .eq("host_user_id", hostUserId)
    .order("created_at", { ascending: false }).limit(RECENT_BANK_ROOMS);
  const { bankKey } = await import("./puzzleBank.server");
  for (const row of data ?? []) {
    if (!Array.isArray(row.puzzles_public)) continue;
    for (const puzzle of row.puzzles_public) {
      const key = bankKey(puzzle);
      if (key) keys.add(key);
    }
  }
  return keys;
}

/* -------------------------------------------------------------------------- */
/*  Server functions — the only way any of the tables is written               */
/* -------------------------------------------------------------------------- */

export const createRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    // Remember the host's category choices from their last room.
    const { data: previous } = await client
      .from("duels")
      .select("selected_categories")
      .eq("host_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const room = await createRoomRow(
      client,
      context.userId,
      data.displayName,
      normaliseCategories(previous?.selected_categories),
    );
    return { roomId: room.id, roomCode: room.room_code };
  });

/**
 * What a visitor who is not (yet) in a room may know about it from its link:
 * whether it can be joined, and nothing else (no puzzles, answers or names).
 */
export const roomPreviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomCode: string }) => input)
  .handler(async ({ data }) => {
    const client = await db();
    const code = String(data.roomCode ?? "").trim().toUpperCase().slice(0, 8);
    const { data: found } = await client
      .from("duels")
      .select("id, status, disbanded_at, max_players")
      .eq("room_code", code)
      .maybeSingle();
    if (!found) return { found: false as const };
    const room = found as Pick<DuelRow, "id" | "status" | "disbanded_at" | "max_players">;
    const players = present(await getPlayers(client, room.id));
    return {
      found: true as const,
      roomCode: code,
      state: linkRoomState(room),
      playerCount: players.length,
      maxPlayers: room.max_players ?? MAX_PLAYERS,
    };
  });

export const joinRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomCode: string; displayName: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const code = (data.roomCode ?? "").trim().toUpperCase();
    const { data: found } = await client
      .from("duels")
      .select("*")
      .eq("room_code", code)
      .maybeSingle();
    if (!found) return { ok: false as const, message: "No room found with that code." };

    const room = found as DuelRow;
    if (room.disbanded_at) return { ok: false as const, message: "This room has been disbanded." };
    const players = await getPlayers(client, room.id);
    const mine = players.find((p) => p.user_id === context.userId);

    if (mine) {
      if (mine.status === "left") {
        if (room.status !== "waiting")
          return { ok: false as const, message: "Game already started." };
        await client.from("duel_players").update({ status: "active" }).eq("id", mine.id);
      }
      return { ok: true as const, roomId: room.id, roomCode: room.room_code };
    }

    if (room.status !== "waiting") {
      return { ok: false as const, message: "Game already started." };
    }
    const slot = firstFreeSlot(players, room.max_players ?? MAX_PLAYERS);
    if (slot === null) {
      return { ok: false as const, message: `That room is full (${room.max_players} players).` };
    }
    await insertPlayer(client, room.id, slot, context.userId, data.displayName);
    return { ok: true as const, roomId: room.id, roomCode: room.room_code };
  });

/** Host only: generates the rounds and opens the shared, unskippable start screen. */
export const startRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can start the game." };
    }
    if (room.status !== "waiting") return { ok: true as const };
    const players = present(await getPlayers(client, room.id));
    if (players.length < MIN_PLAYERS) {
      return { ok: false as const, message: "You need at least two players." };
    }

    const { buildRoomPuzzles } = await import("./generate.server");
    const { drawUnblockRow } = await import("./unblock.server");
    const unblockRow = await drawUnblockRow(client);
    const recent = await recentRoundOrders(client, room, room.host_user_id);
    const recentWords = await recentWordMatchWords(client, room.host_user_id);
    const lastGoNoGoFirst = await previousGoNoGoFirst(client, room, room.host_user_id);
    const recentBanked = await recentBankKeys(client, room.host_user_id);
    const categories = normaliseCategories(room.selected_categories);
    if (!categories.some((category) => typesInCategory(category).length > 0))
      return {
        ok: false as const,
        message: "Choose at least one category with active games.",
      };
    // Rounds shared between the selected categories (roomRoundCount), ordered by this room's seed.
    const { newRoomSeed } = await import("./selection");
    const roomSeed = newRoomSeed();
    const { roundOrder, puzzles } = buildRoomPuzzles({
      seed: roomSeed,
      recent,
      categories,
      previousGoNoGoFirst: lastGoNoGoFirst as never,
      unblockRow,
      recentWordMatchWords: recentWords,
      recentBankKeys: recentBanked,
    });
    console.log(
      `[room-selection] room=${room.room_code} seed=${roomSeed} categories=${categories.join(",")} recentRooms=${recent.length} order=${roundOrder.join(",")}`,
    );

    const split = puzzles.map(splitPuzzle);
    const startedAt = nowIso();

    const { data: claimed } = await client
      .from("duels")
      .update({
        round_order: roundOrder,
        round_count: roundOrder.length,
        puzzles_public: JSON.parse(JSON.stringify(split.map((s) => s.pub))),
        status: "in_progress",
        current_round: 1,
        phase: "starting",
        phase_started_at: startedAt,
        round_started_at: startedAt,
      })
      .eq("id", room.id)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();

    if (claimed) {
      const { error } = await client.from("duel_secrets").upsert({
        duel_id: room.id,
        puzzles_private: JSON.parse(JSON.stringify(split.map((s) => s.priv))),
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

/** Host only, in the lobby: chooses the round categories. */
export const setRoomModesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; categories: PuzzleCategory[] }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can change this." };
    }
    if (room.status !== "waiting") {
      return { ok: false as const, message: "The game has already started." };
    }
    if (
      !Array.isArray(data.categories) ||
      data.categories.length === 0 ||
      normaliseCategories(data.categories).length !== new Set(data.categories).size
    )
      return { ok: false as const, message: "Choose at least one valid category." };
    const categories = normaliseCategories(data.categories);
    await client
      .from("duels")
      .update({ selected_categories: categories })
      .eq("id", room.id)
      .eq("status", "waiting");
    console.log(`[room-selection] room=${room.room_code} categories=${categories.join(",")}`);

    return { ok: true as const };
  });

/** Host only, in the lobby: takes a player out of the room. */
export const removePlayerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; slot: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can remove players." };
    }
    if (room.status !== "waiting") {
      return { ok: false as const, message: "The game has already started." };
    }
    await client
      .from("duel_players")
      .delete()
      .eq("duel_id", room.id)
      .eq("player_slot", data.slot)
      .neq("user_id", context.userId);
    return { ok: true as const };
  });

/** Leaving the room. A departing host closes the room. */
export const leaveRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await getRoom(client, data.roomId);
    await client
      .from("duel_players")
      .update({ status: "left" })
      .eq("duel_id", room.id)
      .eq("user_id", context.userId);

    if (room.host_user_id === context.userId)
      await client
        .from("duels")
        .update({ disbanded_at: nowIso(), status: "finished" })
        .eq("id", room.id);
    return { ok: true as const };
  });

export const disbandRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId)
      return { ok: false as const, message: "Only the host can disband this room." };
    await client
      .from("duels")
      .update({ disbanded_at: nowIso(), status: "finished" })
      .eq("id", room.id);
    return { ok: true as const };
  });

export const checkHostPresenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    await client.rpc("disband_stale_room", { p_room_id: data.roomId });
    return { ok: true as const };
  });

/**
 * The single place the room's phase, round and status change. Idempotent: it
 * decides from the stored timestamps what (if anything) is due next, and every
 * write is guarded on the round and phase it is moving away from.
 */
export const advancePhaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; hostNext?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.status !== "in_progress") return { ok: true };

    const round = room.current_round;
    if (round < 1) return { ok: true };

    const stamp = room.phase_started_at ?? room.round_started_at;
    const phaseStart = stamp ? Date.parse(stamp) : Date.now();
    const elapsed = Date.now() - phaseStart;
    const puzzle = room.puzzles_public[round - 1];
    const players = await getPlayers(client, room.id);
    const waitingOn = activePlayers(players);

    if (room.phase === "starting") {
      if (elapsed < DUEL_START_MS) return { ok: true };
      // Fixed deadlines preserve the same title position after reconnects.
      const titleAt = new Date(phaseStart + DUEL_START_MS).toISOString();
      const { error } = await client
        .from("duels")
        .update({ phase: "round_title", phase_started_at: titleAt, round_started_at: titleAt })
        .eq("id", room.id)
        .eq("status", "in_progress")
        .eq("current_round", round)
        .eq("phase", "starting")
        .eq("phase_started_at", stamp);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (room.phase === "round_title") {
      if (elapsed < ROUND_TITLE_MS) return { ok: true };
      const introAt = new Date(phaseStart + ROUND_TITLE_MS).toISOString();
      const { error } = await client
        .from("duels")
        .update({ phase: "intro", phase_started_at: introAt, round_started_at: introAt })
        .eq("id", room.id)
        .eq("status", "in_progress")
        .eq("current_round", round)
        .eq("phase", "round_title")
        .eq("phase_started_at", stamp);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (room.phase === "intro") {
      if (elapsed < INTRO_WAIT_MS && allIntroReady(players, round, Date.now())) {
        await startIntroCountdown(client, room, round);
        return { ok: true };
      }
      if (elapsed >= INTRO_MS) await setPhase(client, room.id, round, "intro", "puzzle");
      return { ok: true };
    }

    if (room.phase === "puzzle") {
      const answered = await submissionCount(client, room.id, round);
      const allIn = waitingOn.length > 0 && answered >= waitingOn.length;
      const timeUp = elapsed > puzzleDurationMs(puzzle) + 800;
      if (allIn || timeUp) await setPhase(client, room.id, round, "puzzle", "reveal");
      return { ok: true };
    }

    if (room.phase === "reveal") {
      if (elapsed >= puzzleRevealMs(puzzle)) {
        await setPhase(client, room.id, round, "reveal", "result");
        await markInactivity(client, room.id, round);
      }
      return { ok: true };
    }

    if (room.phase === "winner_reveal") {
      // Timer-driven only: the host cannot skip the reveal.
      if (elapsed < WINNER_REVEAL_MS) return { ok: true };
      await client
        .from("duels")
        .update({ status: "finished" })
        .eq("id", room.id)
        .eq("status", "in_progress")
        .eq("current_round", round)
        .eq("phase", "winner_reveal");
      return { ok: true };
    }

    const hostNext = data.hostNext === true && context.userId === room.host_user_id;

    if (!isContinuePhase(room.phase)) return { ok: true };
    // The timer is the most a between-round screen waits; it ends early once
    // every connected active player has tapped Continue.
    if (!betweenScreenDue(room.phase, elapsed, players, round, Date.now(), hostNext))
      return { ok: true };
    await leaveBetweenRoundScreen(client, room, round);
    return { ok: true };
  });

export type { SubmitExtra };

/**
 * Checks the answer against the stored puzzle content and scores it on the
 * server. Clients never send `is_correct` or `score`.
 */
export const submitAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roomId: string;
      roundNumber: number;
      answer: string;
      msRemaining: number;
      extra?: SubmitExtra;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.status !== "in_progress" || room.current_round !== data.roundNumber) {
      return { ok: false as const, message: "That round is over." };
    }
    if (room.phase !== "puzzle" && room.phase !== "reveal") {
      return { ok: false as const, message: "That round is over." };
    }

    const existing = await client
      .from("round_results")
      .select("id")
      .eq("duel_id", room.id)
      .eq("player_slot", player.player_slot)
      .eq("round_number", data.roundNumber)
      .maybeSingle();
    if (existing.data) return { ok: true as const, alreadySubmitted: true };

    const pub = room.puzzles_public[data.roundNumber - 1];
    if (!pub) return { ok: false as const, message: "That round is over." };
    const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
    const puzzle: PuzzleData = mergePuzzle(pub, priv);

    // The player's own measurement stands unless it is impossible for the clock.
    const { puzzleTimeLimitMs, puzzlePrepMs } = await import("./registry");
    const { trustedMsRemaining } = await import("./grade");
    const limitMs = puzzleTimeLimitMs(puzzle);
    const startedAt = Date.parse(room.phase_started_at ?? room.round_started_at ?? "");
    const serverMs = Number.isFinite(startedAt)
      ? limitMs - (Date.now() - startedAt - puzzlePrepMs(puzzle))
      : limitMs;
    const { ms: trustedMs, clamped } = trustedMsRemaining(data.msRemaining, serverMs, limitMs);
    if (clamped) {
      console.warn(
        `submit_answer: time claim ${data.msRemaining}ms beyond server ${Math.round(serverMs)}ms (room ${room.id}, round ${data.roundNumber})`,
      );
    }

    const { gradeAnswer } = await import("./generate.server");
    const { answer, isCorrect, score, reactionAvgMs, correctCount, errors, extra, storedMs } =
      gradeAnswer(puzzle, data.answer, trustedMs, data.extra, Number.isFinite(startedAt) ? serverMs : undefined);

    const { error } = await client.from("round_results").insert({
      duel_id: room.id,
      player_slot: player.player_slot,
      round_number: data.roundNumber,
      answer: answer || null,
      is_correct: isCorrect,
      ms_remaining: storedMs,
      reaction_avg_ms: reactionAvgMs,
      correct_count: correctCount,
      errors,
      extra,
      score,
    });
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

    // Answering again brings a player who had gone quiet back into the room.
    if (player.status !== "active") {
      await client.from("duel_players").update({ status: "active" }).eq("id", player.id);
    }

    /**
     * The round is over the moment the last active player's answer lands — no
     * waiting for the clock. `setPhase` is guarded on the round and the phase it
     * moves away from, so this and a timer expiry arriving together cannot
     * double-advance.
     */
    const players = await getPlayers(client, room.id);
    const waitingOn = activePlayers(players).length || 1;
    const answered = await submissionCount(client, room.id, data.roundNumber);
    if (answered >= waitingOn) {
      await setPhase(client, room.id, data.roundNumber, "puzzle", "reveal");
    }
    return { ok: true as const };
  });

/**
 * "READY" on the round intro. Stored per player per round so a refresh comes
 * back with the right state, and the round starts as soon as every active
 * player is in.
 */
export const readyUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    const round = clamp(data.roundNumber, 1, MAX_ROUNDS);
    if (room.status !== "in_progress" || room.current_round !== round || room.phase !== "intro") {
      return { ok: true as const };
    }

    await client
      .from("duel_players")
      .update({ intro_ready_round: round, status: "active" })
      .eq("id", player.id)
      .lt("intro_ready_round", round);

    const players = await getPlayers(client, room.id);
    if (allIntroReady(players, round, Date.now())) await startIntroCountdown(client, room, round);
    return { ok: true as const };
  });

/**
 * "Continue" on the round results or standings. Stored per player as a rising
 * mark (roomFlow.continueMark) so a refresh comes back with the right state;
 * the screen moves on as soon as every connected active player is in, and
 * never later than its timer.
 */
export const continueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number; phase: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    const round = clamp(data.roundNumber, 1, MAX_ROUNDS);
    if (
      room.status !== "in_progress" ||
      room.current_round !== round ||
      !isContinuePhase(room.phase) ||
      room.phase !== data.phase
    ) {
      return { ok: true as const };
    }
    await recordContinue(client, player.id, round, room.phase);

    const players = await getPlayers(client, room.id);
    if (allContinued(players, round, room.phase, Date.now()))
      await leaveBetweenRoundScreen(client, room, round);
    return { ok: true as const };
  });

/**
 * "Finish now": the last player still here ends the game. Everyone who had
 * left or dropped out is stored as left, and the room finishes outside the
 * winner reveal, which is how screens recognise a forfeit (roomFlow.endedByForfeit).
 * Stored rounds and scores are untouched.
 */
export const finishNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    const players = await getPlayers(client, room.id);
    const result = await finishGame(client, room, players, context.userId, Date.now());
    if (!result.ok) return { ok: false as const, message: result.message };
    return { ok: true as const };
  });

export const heartbeatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await client
      .from("duel_players")
      .update({ last_seen_at: nowIso() })
      .eq("duel_id", data.roomId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** The answer for one round — only ever returned once that round has ended. */
export const revealAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (!roundHasEnded(room, data.roundNumber)) {
      return { ok: false as const, message: "That round has not finished yet." };
    }
    const pub = room.puzzles_public[data.roundNumber - 1];
    if (!pub) return { ok: false as const, message: "Unknown round." };
    const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
    const puzzle = mergePuzzle(pub, priv);
    const definition = puzzleDef(puzzle.type);
    const { data: resultRows, error } = await client
      .from("round_results")
      .select("*")
      .eq("duel_id", room.id)
      .eq("round_number", data.roundNumber)
      .order("player_slot");
    if (error) throw new Error(error.message);
    // A reveal must never break the round: a summary that throws falls back.
    const players = ((resultRows ?? []) as RoundResultRow[]).map((result) => {
      try {
        return { playerSlot: result.player_slot, ...definition.roundSummary(result, puzzle) };
      } catch (err) {
        console.error(`[reveal] summary failed for ${puzzle.type}`, err);
        return { playerSlot: result.player_slot, summary: "—", detail: [] as string[] };
      }
    });
    let correctAnswer: ReturnType<typeof definition.correctAnswer> = null as never;
    try {
      correctAnswer = definition.correctAnswer(puzzle);
    } catch (err) {
      console.error(`[reveal] answer failed for ${puzzle.type}`, err);
    }
    return {
      ok: true as const,
      data: {
        puzzle,
        correctAnswer,
        players,
      },
    };
  });

/**
 * "Play again": atomically reset this room; keep the code and archive its winner.
 */
export const rematchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const me = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Waiting for the host to play again." };
    }
    // A host who left (and forfeited) can't restart: the reset removes left players.
    if (me.status === "left") return { ok: false as const, message: "You left this game." };
    // Read a forfeit's outcome before the reset clears statuses and results.
    const { data: resultRows } = await client.from("round_results").select("*").eq("duel_id", room.id);
    const forfeit = forfeitRecord(
      room,
      await getPlayers(client, room.id),
      (resultRows ?? []) as RoundResultRow[],
    );
    const { data: restarted, error } = await client.rpc("restart_duel_room", {
      p_room_id: room.id,
      p_host_id: context.userId,
    });
    if (error || !restarted) return { ok: false as const, message: "Could not play again yet." };
    if (forfeit && !(await recordForfeitInHistory(client, room.id, forfeit)))
      console.warn(`[rematch] room=${room.room_code}: forfeit winner not recorded in history`);
    return { ok: true as const, roomId: room.id, roomCode: room.room_code };
  });

/**
 * Word puzzles: checks one submitted word or rung while the round is running. The
 * dictionary stays on the server; only the verdict travels back.
 */
export const checkWordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roomId: string;
      roundNumber: number;
      word: string;
      found: string[];
      path?: number[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.status !== "in_progress" || room.current_round !== data.roundNumber) {
      return { valid: false as const, points: 0, word: "", reason: "That round is over." };
    }
    const pub = room.puzzles_public[data.roundNumber - 1];
    const found = Array.isArray(data.found) ? data.found.slice(0, 200).map(String) : [];

    if (pub?.type === "letterwheel") {
      const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
      const puzzle = mergePuzzle(pub, priv);
      if (puzzle.type !== "letterwheel") return { valid: false as const, points: 0, word: "" };
      const { checkLetterWheelWord } = await import("./letterWheel");
      const { isWord } = await import("./dictionary.server");
      const word = String(data.word ?? "").trim().toLowerCase();
      return checkLetterWheelWord(puzzle.words ?? [], word, found, word.length >= 3 && isWord(word));
    }
    if (pub?.type === "wordsearch") {
      // Matched against the private placements; only the verdict goes back.
      const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
      const puzzle = mergePuzzle(pub, priv);
      if (puzzle.type !== "wordsearch") return { valid: false as const, points: 0, word: "" };
      const { checkWordSearchPath } = await import("./wordSearch");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordSearchPath(puzzle.placements ?? [], puzzle.size, path, found);
    }
    if (pub?.type === "wordhunt") {
      const { checkWordHuntPath } = await import("./wordHunt.server");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordHuntPath(pub.grid, path, found);
    }
    if (pub?.type === "tilegrid") {
      const { checkTileGridWord } = await import("./tileGrid.server");
      return checkTileGridWord(String(data.word ?? ""));
    }
    if (pub?.type === "wordslide") {
      const { checkWordSlideRow } = await import("./wordSlide.server");
      return checkWordSlideRow(String(data.word ?? ""));
    }
    if (pub?.type === "ladder") {
      const { checkLadderRung } = await import("./wordLadder.server");
      const previous = found.at(-1) ?? pub.startWord;
      return { ...checkLadderRung(previous, String(data.word ?? "")), points: 0 };
    }
    if (!pub || pub.type !== "wordsmith") {
      return { valid: false as const, points: 0, word: "", reason: "Not this round." };
    }

    const { checkWordsmithWord } = await import("./wordsmith.server");
    return checkWordsmithWord(pub.letters, String(data.word ?? ""), found);
  });

/**
 * Strikeout, Cryptogrid and Swapword: replays the player's moves so far against
 * the private puzzle and returns only what the board may show next.
 */
export const checkMovesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number; moves: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (
      room.status !== "in_progress" ||
      room.current_round !== data.roundNumber ||
      room.phase !== "puzzle"
    )
      return null;
    const pub = room.puzzles_public[data.roundNumber - 1];
    if (!pub || (pub.type !== "strikeout" && pub.type !== "codeword" && pub.type !== "swapword")) return null;
    const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
    const { checkPuzzleMoves } = await import("./moves.server");
    return checkPuzzleMoves(mergePuzzle(pub, priv), data.moves);
  });

/** Groups only: validates four selected tile indices without revealing either partition. */
export const checkGroupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number; indices: number[] }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (
      room.status !== "in_progress" ||
      room.current_round !== data.roundNumber ||
      room.phase !== "puzzle"
    )
      return { valid: false as const };

    const pub = room.puzzles_public[data.roundNumber - 1];
    if (!pub || pub.type !== "groups") return { valid: false as const };
    const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
    const puzzle = mergePuzzle(pub, priv);
    if (puzzle.type !== "groups") return { valid: false as const };
    const { matchGroupsSelection } = await import("./groups.server");
    const indices = Array.isArray(data.indices) ? data.indices.slice(0, 4).map(Number) : [];
    const groupIndex = matchGroupsSelection(puzzle, indices);
    if (groupIndex === null) return { valid: false as const };
    return {
      valid: true as const,
      groupIndex,
      theme: puzzle.groups?.[groupIndex]?.theme ?? "Group",
    };
  });
