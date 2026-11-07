import { supabase } from "@/integrations/supabase/client";
import { inputTypeField } from "@/lib/inputType";
import { APP_BUILD_ID } from "@/lib/appVersion";
import { trackSubmission } from "@/lib/appUpdate";

import {
  advancePhaseFn,
  checkWordFn,
  checkMovesFn,
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
  setPlayerLookFn,
  setRoomModesFn,
  setRoomSettingsFn,
  disbandRoomFn,
  checkHostPresenceFn,
  startRoomFn,
  submitAnswerFn,
  type SubmitExtra,
} from "./duel.functions";
import type { MovesView } from "./moves";
import type { LinkRoomState } from "./roomLink";
import { ensureSession } from "./session";
import { rememberLook, rememberedLook, type PlayerLook } from "./playerLook";
import type { DuelPlayerRow, DuelRow, RoundResultRow, RoundRevealData } from "./types";
import type { PuzzleCategory } from "./types";
import type { RoomSettings } from "./roomSettings";
import type { ScoringMode } from "./scoringMode";

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
  // The colour and icon this device last chose, used when free (playerLook.ts).
  const result = await createRoomFn({ data: { displayName, look: rememberedLook() } });
  return { roomCode: result.roomCode };
}

export async function joinRoomByCode(
  roomCode: string,
  displayName: string,
  /** How the player got here: the home screen's code boxes or a room link (beta recording only). */
  via?: "code" | "link",
): Promise<{ roomCode: string }> {
  await ensureSession();
  const result = await joinRoomFn({
    data: { roomCode, displayName, look: rememberedLook(), ...(via ? { via } : {}) },
  });
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

/**
 * Host only, in the lobby: the room's categories and round count (roomSettings.ts) and, once the room row has the
 * column, its scoring (scoringMode.ts; left out before the migration).
 */
export async function setRoomSettings(roomId: string, settings: RoomSettings, scoring?: ScoringMode): Promise<void> {
  const result = await setRoomSettingsFn({
    data: { roomId, picks: [...settings.picks], rounds: settings.rounds, ...(scoring ? { scoring } : {}) },
  });
  if (!result.ok) throw new DuelError(result.message);
}

/** In the lobby: change my colour and/or icon; the device remembers the choice for the next room. */
export async function setPlayerLook(roomId: string, look: Partial<PlayerLook>): Promise<void> {
  const result = await setPlayerLookFn({ data: { roomId, ...look } });
  if (!result.ok) throw new DuelError(result.message);
  rememberLook(look);
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
  // The build id lets the server log answers from stale copies; no reload starts
  // while the answer is on its way.
  await trackSubmission(
    submitAnswerFn({
      data: {
        roomId: params.duelId,
        roundNumber: params.roundNumber,
        answer: params.answer,
        msRemaining: params.msRemaining,
        extra: params.extra ?? {},
        clientVersion: APP_BUILD_ID,
        ...inputTypeField(),
      },
    }),
  );
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

/** Strikeout, Cryptogrid and Swapword: the server's view of the board after these moves. */
export async function checkMoves(
  duelId: string,
  roundNumber: number,
  moves: string,
): Promise<MovesView | null> {
  return (await checkMovesFn({ data: { roomId: duelId, roundNumber, moves } })) as MovesView | null;
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
