import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { type SubmitExtra } from "./grade";
import { puzzleDef, puzzleDurationMs, puzzleRevealMs } from "./registry";
import { generateRoomCode } from "./puzzles";
import { mergePuzzle, splitPuzzle } from "./secrets";
import {
  INACTIVE_AFTER_MISSED,
  INTRO_MS,
  INTRO_WAIT_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  TOTAL_ROUNDS,
  type DuelPhase,
  type DuelPlayerRow,
  type DuelRow,
  type PuzzleData,
  type PuzzleType,
  type RoundResultRow,
} from "./types";

/** How many of the host's recent rooms feed the repeat-avoiding draw. */
const RECENT_ROOMS = 3;

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

/** Guarded so several phones calling at the same moment can never skip a screen. */
async function setPhase(
  client: any,
  roomId: string,
  round: number,
  from: DuelPhase,
  to: DuelPhase,
): Promise<void> {
  await client
    .from("duels")
    .update({ phase: to, phase_started_at: nowIso() })
    .eq("id", roomId)
    .eq("current_round", round)
    .eq("phase", from);
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

/** True once every active player is ready for this round's intro. */
function allIntroReady(players: DuelPlayerRow[], round: number): boolean {
  const waitingOn = activePlayers(players);
  return waitingOn.length > 0 && waitingOn.every((p) => p.intro_ready_round >= round);
}

async function createRoomRow(
  client: any,
  userId: string,
  displayName: string,
  noMaths = false,
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
        no_maths: noMaths,
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
    (room.phase === "reveal" || room.phase === "result" || room.phase === "standings")
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
 * The round orders of the host's last few rooms, most recent first — plus the
 * room a rematch came from. Selection uses these to avoid repeats.
 */
async function recentRoundOrders(
  client: any,
  room: DuelRow,
  hostUserId: string | null,
): Promise<PuzzleType[][]> {
  const orders: PuzzleType[][] = [];

  const { data: source } = await client
    .from("duels")
    .select("round_order")
    .eq("next_duel_id", room.id)
    .maybeSingle();
  const fromRematch = (source?.round_order ?? []) as PuzzleType[];
  if (fromRematch.length > 0) orders.push(fromRematch);

  if (hostUserId) {
    const { data } = await client
      .from("duels")
      .select("round_order")
      .eq("host_user_id", hostUserId)
      .eq("status", "finished")
      .neq("id", room.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_ROOMS);
    for (const row of (data ?? []) as { round_order: PuzzleType[] }[]) {
      const order = row.round_order ?? [];
      if (order.length > 0) orders.push(order);
    }
  }

  // De-duplicate while keeping "most recent first" order.
  const seen = new Set<string>();
  const unique: PuzzleType[][] = [];
  for (const order of orders) {
    const key = order.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(order);
  }
  return unique.slice(0, RECENT_ROOMS);
}

/* -------------------------------------------------------------------------- */
/*  Server functions — the only way any of the tables is written               */
/* -------------------------------------------------------------------------- */

export const createRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await createRoomRow(client, context.userId, data.displayName);
    return { roomId: room.id, roomCode: room.room_code };
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
    const players = await getPlayers(client, room.id);
    const mine = players.find((p) => p.user_id === context.userId);

    if (mine) {
      if (mine.status === "left") {
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

/** Host only: generates the six rounds and opens the Round 1 intro. */
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
    const recent = await recentRoundOrders(client, room, room.host_user_id);
    const noMaths = room.no_maths === true;
    const { roundOrder, puzzles } = buildRoomPuzzles({
      rounds: room.round_count ?? TOTAL_ROUNDS,
      recent,
      noMaths,
    });
    console.log(
      `[room-selection] room=${room.room_code} noMaths=${noMaths} recentRooms=${recent.length} order=${roundOrder.join(",")}`,
    );
    const split = puzzles.map(splitPuzzle);
    const startedAt = nowIso();

    const { data: claimed } = await client
      .from("duels")
      .update({
        round_order: roundOrder,
        puzzles_public: JSON.parse(JSON.stringify(split.map((s) => s.pub))),
        status: "in_progress",
        current_round: 1,
        phase: "intro",
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

/** Host only, in the lobby: turns the "No maths" setting on or off. */
export const setNoMathsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; noMaths: boolean }) => input)
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
    const noMaths = data.noMaths === true;
    await client
      .from("duels")
      .update({ no_maths: noMaths })
      .eq("id", room.id)
      .eq("status", "waiting");
    console.log(`[room-selection] room=${room.room_code} noMaths toggled to ${noMaths}`);
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

/** Leaving the room. A host who leaves the lobby hands over to the next player. */
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

    if (room.host_user_id === context.userId && room.status === "waiting") {
      const remaining = present(await getPlayers(client, room.id)).sort((a, b) =>
        a.joined_at < b.joined_at ? -1 : 1,
      );
      const next = remaining[0];
      if (next) {
        await client.from("duels").update({ host_user_id: next.user_id }).eq("id", room.id);
      }
    }
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

    if (room.phase === "intro") {
      if (elapsed < INTRO_WAIT_MS && allIntroReady(players, round)) {
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

    const hostNext = data.hostNext === true && context.userId === room.host_user_id;

    if (room.phase === "result") {
      if (!hostNext && elapsed < NEXT_ROUND_AUTO_MS) return { ok: true };
      if (round >= (room.round_count ?? TOTAL_ROUNDS)) {
        await client
          .from("duels")
          .update({ status: "finished" })
          .eq("id", room.id)
          .eq("current_round", round)
          .eq("phase", "result");
        return { ok: true };
      }
      await setPhase(client, room.id, round, "result", "standings");
      return { ok: true };
    }

    if (room.phase !== "standings" || (!hostNext && elapsed < STANDINGS_MS)) {
      return { ok: true };
    }

    if (round >= (room.round_count ?? TOTAL_ROUNDS)) {
      await client
        .from("duels")
        .update({ status: "finished" })
        .eq("id", room.id)
        .eq("current_round", round)
        .eq("phase", "standings");
      return { ok: true };
    }

    const startedAt = nowIso();
    await client
      .from("duels")
      .update({
        current_round: round + 1,
        phase: "intro",
        phase_started_at: startedAt,
        round_started_at: startedAt,
      })
      .eq("id", room.id)
      .eq("current_round", round)
      .eq("phase", "standings");
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
      gradeAnswer(puzzle, data.answer, trustedMs, data.extra);

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

export const markReadyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    await client
      .from("duel_players")
      .update({ ready_round: clamp(data.roundNumber, 0, TOTAL_ROUNDS) })
      .eq("duel_id", data.roomId)
      .eq("user_id", context.userId);
    return { ok: true };
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
    const round = clamp(data.roundNumber, 1, TOTAL_ROUNDS);
    if (room.status !== "in_progress" || room.current_round !== round || room.phase !== "intro") {
      return { ok: true as const };
    }

    await client
      .from("duel_players")
      .update({ intro_ready_round: round, status: "active" })
      .eq("id", player.id)
      .lt("intro_ready_round", round);

    const players = await getPlayers(client, room.id);
    if (allIntroReady(players, round)) await startIntroCountdown(client, room, round);
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
    const players = ((resultRows ?? []) as RoundResultRow[]).map((result) => ({
      playerSlot: result.player_slot,
      ...definition.roundSummary(result, puzzle),
    }));
    return {
      ok: true as const,
      data: {
        puzzle,
        correctAnswer: definition.correctAnswer(puzzle),
        players,
      },
    };
  });

/**
 * "Play again": the host makes a fresh room and brings everyone still in this
 * one along. Every other phone follows `next_duel_id` automatically.
 */
export const rematchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.next_duel_id) {
      const next = await getRoom(client, room.next_duel_id);
      return { ok: true as const, roomId: next.id, roomCode: next.room_code };
    }
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Waiting for the host to start a new room." };
    }

    const players = present(await getPlayers(client, room.id)).sort(
      (a, b) => a.player_slot - b.player_slot,
    );
    const host = players.find((p) => p.user_id === context.userId);
    const rest = players.filter((p) => p.user_id !== context.userId);

    const fresh = await createRoomRow(
      client,
      context.userId,
      host?.display_name ?? "Player",
      room.no_maths === true,
    );
    let slot = 2;
    for (const player of rest) {
      if (slot > MAX_PLAYERS) break;
      await insertPlayer(client, fresh.id, slot, player.user_id, player.display_name);
      slot++;
    }

    const { data: claimed } = await client
      .from("duels")
      .update({ next_duel_id: fresh.id })
      .eq("id", room.id)
      .is("next_duel_id", null)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      await client.from("duels").delete().eq("id", fresh.id);
      const current = await getRoom(client, room.id);
      if (!current.next_duel_id) {
        return { ok: false as const, message: "Could not start a new room." };
      }
      const next = await getRoom(client, current.next_duel_id);
      return { ok: true as const, roomId: next.id, roomCode: next.room_code };
    }

    return { ok: true as const, roomId: fresh.id, roomCode: fresh.room_code };
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

    if (pub?.type === "wordhunt") {
      const { checkWordHuntPath } = await import("./wordHunt.server");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordHuntPath(pub.grid, path, found);
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
