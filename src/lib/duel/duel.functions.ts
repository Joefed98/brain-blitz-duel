import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { puzzleDurationMs } from "./registry";
import { buildDuelPuzzles, checkAnswer, generateRoomCode } from "./puzzles";
import { mergePuzzle, splitPuzzle } from "./secrets";
import {
  scoreGoNoGo,
  scoreNumberHunt,
  scoreReaction,
  scoreRound,
  scoreStroop,
} from "./scoring";
import {
  GONOGO_ITEMS,
  INTRO_MS,
  NEXT_ROUND_AUTO_MS,
  NUMHUNT_COUNT,
  REACTION_PENALTY_MS,
  REVEAL_MS,
  ROUND_MS,
  STROOP_ITEMS,
  TOTAL_ROUNDS,
  type DuelPhase,
  type DuelPlayerRow,
  type DuelRow,
  type PuzzleData,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Server-only helpers                                                        */
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

async function getDuel(client: any, duelId: string): Promise<DuelRow> {
  const { data, error } = await client.from("duels").select("*").eq("id", duelId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That duel no longer exists.");
  return data as DuelRow;
}

async function getPlayers(client: any, duelId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", duelId)
    .order("player_slot");
  if (error) throw new Error(error.message);
  return (data ?? []) as DuelPlayerRow[];
}

/** Throws unless the caller has a player row in this duel. */
async function requireParticipant(
  client: any,
  duelId: string,
  userId: string,
): Promise<DuelPlayerRow> {
  const { data } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", duelId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You are not part of this duel.");
  return data as DuelPlayerRow;
}

async function privatePuzzles(client: any, duelId: string): Promise<Record<string, unknown>[]> {
  const { data } = await client
    .from("duel_secrets")
    .select("puzzles_private")
    .eq("duel_id", duelId)
    .maybeSingle();
  return (data?.puzzles_private ?? []) as Record<string, unknown>[];
}

async function insertPlayer(
  client: any,
  duelId: string,
  slot: number,
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await client.from("duel_players").insert({
    duel_id: duelId,
    player_slot: slot,
    user_id: userId,
    display_name: cleanName(displayName),
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

/** Opens round 1 as soon as the duel has both players. Idempotent. */
async function startIfReady(client: any, duelId: string): Promise<void> {
  const players = await getPlayers(client, duelId);
  if (players.length < 2) return;
  const startedAt = nowIso();
  await client
    .from("duels")
    .update({
      status: "in_progress",
      current_round: 1,
      phase: "intro",
      phase_started_at: startedAt,
      round_started_at: startedAt,
    })
    .eq("id", duelId)
    .eq("status", "waiting");
}

/** Guarded so two phones calling at the same moment can never skip a screen. */
async function setPhase(
  client: any,
  duelId: string,
  round: number,
  from: DuelPhase,
  to: DuelPhase,
): Promise<void> {
  await client
    .from("duels")
    .update({ phase: to, phase_started_at: nowIso() })
    .eq("id", duelId)
    .eq("current_round", round)
    .eq("phase", from);
}

async function createDuelRow(
  client: any,
  userId: string,
  displayName: string,
): Promise<DuelRow> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { roundOrder, puzzles } = buildDuelPuzzles();
    const split = puzzles.map(splitPuzzle);
    const { data, error } = await client
      .from("duels")
      .insert({
        room_code: generateRoomCode(),
        status: "waiting",
        round_order: roundOrder,
        puzzles_public: JSON.parse(JSON.stringify(split.map((s) => s.pub))),
        current_round: 0,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) continue; // room code collision
      throw new Error(error.message);
    }

    const duel = data as DuelRow;
    const { error: secretError } = await client.from("duel_secrets").insert({
      duel_id: duel.id,
      puzzles_private: JSON.parse(JSON.stringify(split.map((s) => s.priv))),
    });
    if (secretError) throw new Error(secretError.message);

    await insertPlayer(client, duel.id, 1, userId, displayName);
    return duel;
  }
  throw new Error("Could not create a duel right now. Please try again.");
}

function roundHasEnded(duel: DuelRow, round: number): boolean {
  if (duel.status === "finished") return true;
  if (duel.current_round > round) return true;
  return duel.current_round === round && (duel.phase === "reveal" || duel.phase === "result");
}

/* -------------------------------------------------------------------------- */
/*  Server functions — the only way any of the three tables is written         */
/* -------------------------------------------------------------------------- */

export const createDuelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const duel = await createDuelRow(client, context.userId, data.displayName);
    return { duelId: duel.id, roomCode: duel.room_code };
  });

export const joinDuelFn = createServerFn({ method: "POST" })
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
    if (!found) return { ok: false as const, message: "No duel found with that code." };

    const duel = found as DuelRow;
    const players = await getPlayers(client, duel.id);
    const mine = players.find((p) => p.user_id === context.userId);
    if (!mine) {
      if (players.length >= 2) {
        return { ok: false as const, message: "That duel already has two players." };
      }
      if (duel.status !== "waiting") {
        return { ok: false as const, message: "That duel has already started." };
      }
      const slot = players.some((p) => p.player_slot === 1) ? 2 : 1;
      await insertPlayer(client, duel.id, slot, context.userId, data.displayName);
    }

    await startIfReady(client, duel.id);
    return { ok: true as const, duelId: duel.id, roomCode: duel.room_code };
  });

/**
 * The single place the duel's phase, round and status change. Idempotent: it
 * decides from the stored timestamps what (if anything) is due next, and every
 * write is guarded on the round and phase it is moving away from.
 */
export const advancePhaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { duelId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.duelId, context.userId);
    const duel = await getDuel(client, data.duelId);

    if (duel.status === "waiting") {
      await startIfReady(client, duel.id);
      return { ok: true };
    }
    if (duel.status !== "in_progress") return { ok: true };

    const round = duel.current_round;
    if (round < 1) return { ok: true };

    const stamp = duel.phase_started_at ?? duel.round_started_at;
    const phaseStart = stamp ? Date.parse(stamp) : Date.now();
    const elapsed = Date.now() - phaseStart;
    const puzzle = duel.puzzles_public[round - 1];

    if (duel.phase === "intro") {
      if (elapsed >= INTRO_MS) await setPhase(client, duel.id, round, "intro", "puzzle");
      return { ok: true };
    }

    if (duel.phase === "puzzle") {
      const { count } = await client
        .from("round_results")
        .select("id", { count: "exact", head: true })
        .eq("duel_id", duel.id)
        .eq("round_number", round);
      const bothIn = (count ?? 0) >= 2;
      const timeUp = elapsed > puzzleDurationMs(puzzle) + 800;
      if (bothIn || timeUp) await setPhase(client, duel.id, round, "puzzle", "reveal");
      return { ok: true };
    }

    if (duel.phase === "reveal") {
      if (elapsed >= REVEAL_MS) await setPhase(client, duel.id, round, "reveal", "result");
      return { ok: true };
    }

    // result
    const players = await getPlayers(client, duel.id);
    const bothReady = players.length === 2 && players.every((p) => p.ready_round >= round);
    if (!bothReady && elapsed < NEXT_ROUND_AUTO_MS) return { ok: true };

    if (round >= TOTAL_ROUNDS) {
      await client
        .from("duels")
        .update({ status: "finished" })
        .eq("id", duel.id)
        .eq("current_round", round)
        .eq("phase", "result");
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
      .eq("id", duel.id)
      .eq("current_round", round)
      .eq("phase", "result");
    return { ok: true };
  });

export interface SubmitExtra {
  reactionAvgMs?: number | undefined;
  correctCount?: number | undefined;
  errors?: number | undefined;
}

/**
 * Checks the answer against the stored puzzle content and scores it on the
 * server. Clients never send `is_correct` or `score`.
 */
export const submitAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      duelId: string;
      roundNumber: number;
      answer: string;
      msRemaining: number;
      extra?: SubmitExtra;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.duelId, context.userId);
    const duel = await getDuel(client, data.duelId);

    if (duel.status !== "in_progress" || duel.current_round !== data.roundNumber) {
      return { ok: false as const, message: "That round is over." };
    }
    if (duel.phase !== "puzzle" && duel.phase !== "reveal") {
      return { ok: false as const, message: "That round is over." };
    }

    const existing = await client
      .from("round_results")
      .select("id")
      .eq("duel_id", duel.id)
      .eq("player_slot", player.player_slot)
      .eq("round_number", data.roundNumber)
      .maybeSingle();
    if (existing.data) return { ok: true as const, alreadySubmitted: true };

    const pub = duel.puzzles_public[data.roundNumber - 1];
    if (!pub) return { ok: false as const, message: "That round is over." };
    const priv = (await privatePuzzles(client, duel.id))[data.roundNumber - 1];
    const puzzle: PuzzleData = mergePuzzle(pub, priv);

    const extra = data.extra ?? {};
    const answer = typeof data.answer === "string" ? data.answer.slice(0, 200) : "";
    const ms = clamp(data.msRemaining, 0, ROUND_MS);

    let isCorrect = false;
    let score = 0;
    let reactionAvgMs: number | null = null;
    let correctCount: number | null = null;
    let errors: number | null = null;
    let storedMs = ms;

    switch (puzzle.type) {
      case "reaction": {
        reactionAvgMs = clamp(extra.reactionAvgMs ?? REACTION_PENALTY_MS, 0, 5_000);
        isCorrect = true;
        score = scoreReaction(reactionAvgMs);
        storedMs = 0;
        break;
      }
      case "gonogo": {
        correctCount = clamp(extra.correctCount ?? 0, 0, GONOGO_ITEMS);
        reactionAvgMs =
          extra.reactionAvgMs === undefined || extra.reactionAvgMs === null
            ? null
            : clamp(extra.reactionAvgMs, 0, 5_000);
        isCorrect = correctCount >= GONOGO_ITEMS;
        score = scoreGoNoGo(correctCount, reactionAvgMs);
        storedMs = 0;
        break;
      }
      case "stroop": {
        correctCount = clamp(extra.correctCount ?? 0, 0, STROOP_ITEMS);
        isCorrect = correctCount >= STROOP_ITEMS;
        score = scoreStroop(correctCount, ms);
        break;
      }
      case "numhunt": {
        const reached = Number.parseInt(answer.split(",")[0] ?? "0", 10);
        errors = clamp(extra.errors ?? 0, 0, 99);
        const finished = Number.isFinite(reached) && reached >= NUMHUNT_COUNT;
        isCorrect = finished;
        score = scoreNumberHunt(finished, ms, errors);
        break;
      }
      default: {
        isCorrect = answer.length > 0 && checkAnswer(puzzle, answer);
        score = scoreRound(isCorrect, ms);
      }
    }

    const { error } = await client.from("round_results").insert({
      duel_id: duel.id,
      player_slot: player.player_slot,
      round_number: data.roundNumber,
      answer: answer || null,
      is_correct: isCorrect,
      ms_remaining: storedMs,
      reaction_avg_ms: reactionAvgMs,
      correct_count: correctCount,
      errors,
      score,
    });
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    return { ok: true as const };
  });

export const markReadyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { duelId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.duelId, context.userId);
    await client
      .from("duel_players")
      .update({ ready_round: clamp(data.roundNumber, 0, TOTAL_ROUNDS) })
      .eq("duel_id", data.duelId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const heartbeatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { duelId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await client
      .from("duel_players")
      .update({ last_seen_at: nowIso() })
      .eq("duel_id", data.duelId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** The answer for one round — only ever returned once that round has ended. */
export const revealAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { duelId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.duelId, context.userId);
    const duel = await getDuel(client, data.duelId);
    if (!roundHasEnded(duel, data.roundNumber)) {
      return { ok: false as const, message: "That round has not finished yet." };
    }
    const pub = duel.puzzles_public[data.roundNumber - 1];
    if (!pub) return { ok: false as const, message: "Unknown round." };
    const priv = (await privatePuzzles(client, duel.id))[data.roundNumber - 1];
    return { ok: true as const, puzzle: mergePuzzle(pub, priv) };
  });

/** "Play again": the first caller creates the rematch, the second joins it. */
export const rematchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { duelId: string; displayName: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.duelId, context.userId);
    const duel = await getDuel(client, data.duelId);

    if (duel.next_duel_id) {
      const next = await getDuel(client, duel.next_duel_id);
      const players = await getPlayers(client, next.id);
      if (!players.some((p) => p.user_id === context.userId)) {
        if (players.length >= 2) {
          return { ok: false as const, message: "That rematch is already full." };
        }
        const slot = players.some((p) => p.player_slot === 1) ? 2 : 1;
        await insertPlayer(client, next.id, slot, context.userId, data.displayName);
      }
      await startIfReady(client, next.id);
      return { ok: true as const, duelId: next.id, roomCode: next.room_code };
    }

    const rematch = await createDuelRow(client, context.userId, data.displayName);
    const { data: claimed } = await client
      .from("duels")
      .update({ next_duel_id: rematch.id })
      .eq("id", duel.id)
      .is("next_duel_id", null)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      // The opponent won the race — use their rematch instead.
      await client.from("duels").delete().eq("id", rematch.id);
      const current = await getDuel(client, duel.id);
      if (!current.next_duel_id) {
        return { ok: false as const, message: "Could not start a rematch." };
      }
      const next = await getDuel(client, current.next_duel_id);
      const players = await getPlayers(client, next.id);
      if (!players.some((p) => p.user_id === context.userId)) {
        const slot = players.some((p) => p.player_slot === 1) ? 2 : 1;
        await insertPlayer(client, next.id, slot, context.userId, data.displayName);
      }
      await startIfReady(client, next.id);
      return { ok: true as const, duelId: next.id, roomCode: next.room_code };
    }

    return { ok: true as const, duelId: rematch.id, roomCode: rematch.room_code };
  });
