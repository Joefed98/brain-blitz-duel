import { supabase } from "@/integrations/supabase/client";

import { buildDuelPuzzles, checkAnswer, generateRoomCode } from "./puzzles";
import { scoreRound } from "./scoring";
import { getSessionToken } from "./session";
import {
  COUNTDOWN_MS,
  TOTAL_ROUNDS,
  type DuelPlayerRow,
  type DuelRow,
  type PuzzleData,
  type RoundResultRow,
} from "./types";

export class DuelError extends Error {}

function asDuel(row: unknown): DuelRow {
  return row as DuelRow;
}

export async function createDuel(displayName: string): Promise<DuelRow> {
  const { roundOrder, puzzles } = buildDuelPuzzles();

  for (let attempt = 0; attempt < 8; attempt++) {
    const roomCode = generateRoomCode();
    const { data, error } = await supabase
      .from("duels")
      .insert({
        room_code: roomCode,
        status: "waiting",
        round_order: roundOrder,
        puzzles: JSON.parse(JSON.stringify(puzzles)),
        current_round: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") continue; // room code collision, retry
      throw new DuelError(error.message);
    }

    const duel = asDuel(data);
    await joinAsPlayer(duel.id, 1, displayName);
    return duel;
  }
  throw new DuelError("Could not create a duel right now. Please try again.");
}

async function joinAsPlayer(duelId: string, slot: number, displayName: string) {
  const { error } = await supabase.from("duel_players").insert({
    duel_id: duelId,
    player_slot: slot,
    display_name: displayName,
    session_token: getSessionToken(),
  });
  if (error) throw new DuelError(error.message);
}

export async function fetchDuelByCode(roomCode: string): Promise<DuelRow | null> {
  const { data, error } = await supabase
    .from("duels")
    .select()
    .eq("room_code", roomCode.toUpperCase())
    .maybeSingle();
  if (error) throw new DuelError(error.message);
  return data ? asDuel(data) : null;
}

export async function fetchDuelById(duelId: string): Promise<DuelRow | null> {
  const { data, error } = await supabase.from("duels").select().eq("id", duelId).maybeSingle();
  if (error) throw new DuelError(error.message);
  return data ? asDuel(data) : null;
}

export async function fetchPlayers(duelId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await supabase
    .from("duel_players")
    .select()
    .eq("duel_id", duelId)
    .order("player_slot");
  if (error) throw new DuelError(error.message);
  return (data ?? []) as DuelPlayerRow[];
}

export async function fetchResults(duelId: string): Promise<RoundResultRow[]> {
  const { data, error } = await supabase.from("round_results").select().eq("duel_id", duelId);
  if (error) throw new DuelError(error.message);
  return (data ?? []) as RoundResultRow[];
}

/** Join an existing duel by code, or rejoin one this browser already belongs to. */
export async function joinDuelByCode(roomCode: string, displayName: string): Promise<DuelRow> {
  const duel = await fetchDuelByCode(roomCode);
  if (!duel) throw new DuelError("No duel found with that code.");

  const players = await fetchPlayers(duel.id);
  const token = getSessionToken();
  const mine = players.find((p) => p.session_token === token);
  if (mine) return duel;

  if (players.length >= 2) throw new DuelError("That duel already has two players.");
  if (duel.status !== "waiting") throw new DuelError("That duel has already started.");

  const slot = players.some((p) => p.player_slot === 1) ? 2 : 1;
  await joinAsPlayer(duel.id, slot, displayName);
  return duel;
}

/** Make sure this browser is a player in the given duel (used for rematches). */
export async function ensureJoined(duelId: string, displayName: string): Promise<void> {
  const players = await fetchPlayers(duelId);
  const token = getSessionToken();
  if (players.some((p) => p.session_token === token)) return;
  if (players.length >= 2) throw new DuelError("That duel already has two players.");
  const slot = players.some((p) => p.player_slot === 1) ? 2 : 1;
  await joinAsPlayer(duelId, slot, displayName);
}

/** Slot 1 kicks off the 3-2-1 countdown once both players are present. */
export async function startDuel(duelId: string): Promise<void> {
  const startAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
  await supabase
    .from("duels")
    .update({ status: "in_progress", current_round: 1, round_started_at: startAt })
    .eq("id", duelId)
    .eq("status", "waiting");
}

export async function submitAnswer(params: {
  duelId: string;
  playerSlot: number;
  roundNumber: number;
  puzzle: PuzzleData;
  answer: string;
  msRemaining: number;
}): Promise<void> {
  const isCorrect = params.answer.length > 0 && checkAnswer(params.puzzle, params.answer);
  const msRemaining = Math.max(0, Math.round(params.msRemaining));
  const { error } = await supabase.from("round_results").insert({
    duel_id: params.duelId,
    player_slot: params.playerSlot,
    round_number: params.roundNumber,
    answer: params.answer || null,
    is_correct: isCorrect,
    ms_remaining: msRemaining,
    score: scoreRound(isCorrect, msRemaining),
  });
  // Unique violation just means we already submitted this round.
  if (error && error.code !== "23505") throw new DuelError(error.message);
}

export async function markReady(playerId: string, roundNumber: number): Promise<void> {
  await supabase.from("duel_players").update({ ready_round: roundNumber }).eq("id", playerId);
}

export async function heartbeat(playerId: string): Promise<void> {
  await supabase
    .from("duel_players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", playerId);
}

/** Slot 1 advances the shared duel state so both phones move together. */
export async function advanceRound(duel: DuelRow): Promise<void> {
  if (duel.current_round >= TOTAL_ROUNDS) {
    await supabase
      .from("duels")
      .update({ status: "finished" })
      .eq("id", duel.id)
      .eq("status", "in_progress");
    return;
  }
  await supabase
    .from("duels")
    .update({
      current_round: duel.current_round + 1,
      round_started_at: new Date(Date.now() + 800).toISOString(),
    })
    .eq("id", duel.id)
    .eq("current_round", duel.current_round);
}

/**
 * Create (or discover) the rematch duel for a finished duel. The first player
 * to tap "Play again" creates it; the other is auto-joined.
 */
export async function ensureRematch(duel: DuelRow, displayName: string): Promise<DuelRow> {
  const fresh = await fetchDuelById(duel.id);
  if (fresh?.next_duel_id) {
    await ensureJoined(fresh.next_duel_id, displayName);
    const next = await fetchDuelById(fresh.next_duel_id);
    if (!next) throw new DuelError("Rematch duel is unavailable.");
    return next;
  }

  const rematch = await createDuel(displayName);
  const { data, error } = await supabase
    .from("duels")
    .update({ next_duel_id: rematch.id })
    .eq("id", duel.id)
    .is("next_duel_id", null)
    .select()
    .maybeSingle();

  if (error) throw new DuelError(error.message);

  if (!data) {
    // Opponent won the race — use their rematch instead.
    await supabase.from("duels").delete().eq("id", rematch.id);
    const current = await fetchDuelById(duel.id);
    if (!current?.next_duel_id) throw new DuelError("Could not start a rematch.");
    await ensureJoined(current.next_duel_id, displayName);
    const next = await fetchDuelById(current.next_duel_id);
    if (!next) throw new DuelError("Rematch duel is unavailable.");
    return next;
  }

  return rematch;
}
