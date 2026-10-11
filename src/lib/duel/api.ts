import { supabase } from "@/integrations/supabase/client";

import {
  advancePhaseFn,
  checkWordFn,
  checkGroupFn,
  createRoomFn,
  heartbeatFn,
  joinRoomFn,
  leaveRoomFn,
  continueFn,
  finishNowFn,
  roomPreviewFn,
  readyUpFn,
  rematchFn,
  removePlayerFn,
  revealAnswerFn,
  setRoomModesFn,
  disbandRoomFn,
  checkHostPresenceFn,
  startRoomFn,
  submitAnswerFn,
  type SubmitExtra,
} from "./duel.functions";
import type { LinkRoomState } from "./roomLink";
import { ensureSession } from "./session";
import type { DuelPlayerRow, DuelRow, RoundResultRow, RoundRevealData } from "./types";
import type { PuzzleCategory } from "./types";

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

export async function setRoomModes(
  roomId: string,
  categories: PuzzleCategory[],
): Promise<void> {
  const result = await setRoomModesFn({ data: { roomId, categories } });
  if (!result.ok) throw new DuelError(result.message);
}

export async function disbandRoom(roomId: string): Promise<void> {
  const result = await disbandRoomFn({ data: { roomId } });
  if (!result.ok) throw new DuelError(result.message);
}

export async function checkHostPresence(roomId: string): Promise<void> {
  await checkHostPresenceFn({ data: { roomId } });
}

export async function removePlayer(roomId: string, slot: number): Promise<void> {
  const result = await removePlayerFn({ data: { roomId, slot } });
  if (!result.ok) throw new DuelError(result.message);
}

export async function leaveRoom(roomId: string): Promise<void> {
  await leaveRoomFn({ data: { roomId } });
}

export async function advancePhase(roomId: string, hostNext = false): Promise<void> {
  await advancePhaseFn({ data: { roomId, hostNext } });
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

/** Tapping READY on the round intro. */
export async function readyUp(roomId: string, roundNumber: number): Promise<void> {
  await readyUpFn({ data: { roomId, roundNumber } });
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

/** Word puzzles: asks the server whether one submitted word or rung counts. */
export async function checkWord(
  duelId: string,
  roundNumber: number,
  word: string,
  found: string[],
  path?: number[],
): Promise<{ valid: boolean; points: number; word: string; reason?: string }> {
  return checkWordFn({
    data: { roomId: duelId, roundNumber, word, found, path: path ?? [] },
  });
}

/** Groups: validates one selected set against the private answer. */
export async function checkGroup(
  duelId: string,
  roundNumber: number,
  indices: number[],
): Promise<{ valid: boolean; groupIndex?: number; theme?: string }> {
  return checkGroupFn({ data: { roomId: duelId, roundNumber, indices } });
}

/** "Continue" on the round results or standings screen. */
export async function continueOn(
  roomId: string,
  roundNumber: number,
  phase: "result" | "standings",
): Promise<void> {
  await continueFn({ data: { roomId, roundNumber, phase } });
}

/** The last player still in the game ends it as a win. */
export async function finishNow(roomId: string): Promise<void> {
  const result = await finishNowFn({ data: { roomId } });
  if (!result.ok) throw new DuelError(result.message);
}

export type RoomPreview =
  | { found: false }
  | {
      found: true;
      roomCode: string;
      state: LinkRoomState;
      playerCount: number;
      maxPlayers: number;
    };

/** What a room link says to someone who is not in the room yet. */
export async function fetchRoomPreview(roomCode: string): Promise<RoomPreview> {
  await ensureSession();
  return (await roomPreviewFn({ data: { roomCode } })) as RoomPreview;
}

/** Host only: resets this room for another tournament. */
export async function ensureRematch(roomId: string): Promise<{ roomCode: string }> {
  const result = await rematchFn({ data: { roomId } });
  if (!result.ok) throw new DuelError(result.message);
  return { roomCode: result.roomCode };
}
