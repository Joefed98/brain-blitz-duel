import { supabase } from "@/integrations/supabase/client";

import {
  advancePhaseFn,
  createDuelFn,
  heartbeatFn,
  joinDuelFn,
  markReadyFn,
  rematchFn,
  revealAnswerFn,
  submitAnswerFn,
  type SubmitExtra,
} from "./duel.functions";
import { ensureSession } from "./session";
import type { DuelPlayerRow, DuelRow, PuzzleData, RoundResultRow } from "./types";

export class DuelError extends Error {}

/* -------------------------------------------------------------------------- */
/*  Reads — row level security limits these to duels this device is part of    */
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

export async function createDuel(displayName: string): Promise<{ roomCode: string }> {
  await ensureSession();
  const result = await createDuelFn({ data: { displayName } });
  return { roomCode: result.roomCode };
}

export async function joinDuelByCode(
  roomCode: string,
  displayName: string,
): Promise<{ roomCode: string }> {
  await ensureSession();
  const result = await joinDuelFn({ data: { roomCode, displayName } });
  if (!result.ok) throw new DuelError(result.message);
  return { roomCode: result.roomCode };
}

export async function advancePhase(duelId: string): Promise<void> {
  await advancePhaseFn({ data: { duelId } });
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
      duelId: params.duelId,
      roundNumber: params.roundNumber,
      answer: params.answer,
      msRemaining: params.msRemaining,
      extra: params.extra ?? {},
    },
  });
}

export async function markReady(duelId: string, roundNumber: number): Promise<void> {
  await markReadyFn({ data: { duelId, roundNumber } });
}

export async function heartbeat(duelId: string): Promise<void> {
  await heartbeatFn({ data: { duelId } });
}

/** The correct answer for a finished round, fetched only at reveal time. */
export async function fetchRevealPuzzle(
  duelId: string,
  roundNumber: number,
): Promise<PuzzleData | null> {
  const result = await revealAnswerFn({ data: { duelId, roundNumber } });
  return result.ok ? (result.puzzle as PuzzleData) : null;
}

export async function ensureRematch(
  duelId: string,
  displayName: string,
): Promise<{ roomCode: string }> {
  const result = await rematchFn({ data: { duelId, displayName } });
  if (!result.ok) throw new DuelError(result.message);
  return { roomCode: result.roomCode };
}
