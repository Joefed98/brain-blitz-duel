import { supabase } from "@/integrations/supabase/client";

import {
  advancePhaseFn,
  createRoomFn,
  heartbeatFn,
  joinRoomFn,
  leaveRoomFn,
  markReadyFn,
  rematchFn,
  removePlayerFn,
  revealAnswerFn,
  startRoomFn,
  submitAnswerFn,
  type SubmitExtra,
} from "./duel.functions";
import { ensureSession } from "./session";
import type { DuelPlayerRow, DuelRow, RoundResultRow, RoundRevealData } from "./types";

export class DuelError extends Error {}

/* -------------------------------------------------------------------------- */
/*  Reads — row level security limits these to rooms this device is part of     */
/* -------------------------------------------------------------------------- */

export async function fetchDuelByCode(roomCode: string): Promise<DuelRow | null> {
  const { data, error } = await supabase
    .from("duels")
    .select("*")
    .eq("room_code", roomCode.toUpperCase())
    .maybeSingle();
  if (error) throw new DuelError(error.message);
  return (data as DuelRow | null) ?? null;
}

export async function fetchDuelById(duelId: string): Promise<DuelRow | null> {
  const { data, error } = await supabase.from("duels").select("*").eq("id", duelId).maybeSingle();
  if (error) throw new DuelError(error.message);
  return (data as DuelRow | null) ?? null;
}

export async function fetchPlayers(duelId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await supabase
    .from("duel_players")
    .select("*")
    .eq("duel_id", duelId)
    .order("player_slot");
  if (error) throw new DuelError(error.message);
  return (data ?? []) as DuelPlayerRow[];
}

export async function fetchResults(duelId: string): Promise<RoundResultRow[]> {
  const { data, error } = await supabase.from("round_results").select("*").eq("duel_id", duelId);
  if (error) throw new DuelError(error.message);
  return (data ?? []) as RoundResultRow[];
}

/* -------------------------------------------------------------------------- */
/*  Writes — every one goes through a server function                          */
/* -------------------------------------------------------------------------- */

export async function createRoom(displayName: string): Promise<{ roomCode: string }> {
  await ensureSession();
  const result = await createRoomFn({ data: { displayName } });
  return { roomCode: result.roomCode };
}

export async function joinRoomByCode(
  roomCode: string,
  displayName: string,
): Promise<{ roomCode: string }> {
  await ensureSession();
  const result = await joinRoomFn({ data: { roomCode, displayName } });
  if (!result.ok) throw new DuelError(result.message);
  return { roomCode: result.roomCode };
}

export async function startRoom(roomId: string): Promise<void> {
  const result = await startRoomFn({ data: { roomId } });
  if (!result.ok) throw new DuelError(result.message);
}

export async function removePlayer(roomId: string, slot: number): Promise<void> {
  const result = await removePlayerFn({ data: { roomId, slot } });
  if (!result.ok) throw new DuelError(result.message);
}

export async function leaveRoom(roomId: string): Promise<void> {
  await leaveRoomFn({ data: { roomId } });
}

export async function advancePhase(roomId: string): Promise<void> {
  await advancePhaseFn({ data: { roomId } });
}

export async function submitAnswer(params: {
  duelId: string;
  roundNumber: number;
  answer: string;
  msRemaining: number;
  extra?: SubmitExtra;
}): Promise<void> {
  await submitAnswerFn({
    data: {
      roomId: params.duelId,
      roundNumber: params.roundNumber,
      answer: params.answer,
      msRemaining: params.msRemaining,
      extra: params.extra ?? {},
    },
  });
}

export async function markReady(roomId: string, roundNumber: number): Promise<void> {
  await markReadyFn({ data: { roomId, roundNumber } });
}

export async function heartbeat(roomId: string): Promise<void> {
  await heartbeatFn({ data: { roomId } });
}

/** The correct answer for a finished round, fetched only at reveal time. */
export async function fetchRevealPuzzle(
  duelId: string,
  roundNumber: number,
): Promise<RoundRevealData | null> {
  const result = await revealAnswerFn({ data: { roomId: duelId, roundNumber } });
  return result.ok ? (result.data as RoundRevealData) : null;
}

/** Host only: makes the next room and brings everyone along. */
export async function ensureRematch(roomId: string): Promise<{ roomCode: string }> {
  const result = await rematchFn({ data: { roomId } });
  if (!result.ok) throw new DuelError(result.message);
  return { roomCode: result.roomCode };
}
