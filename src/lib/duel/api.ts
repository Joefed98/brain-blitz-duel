import { supabase } from "@/integrations/supabase/client";
import { inputTypeField } from "@/lib/inputType";
import { APP_BUILD_ID } from "@/lib/appVersion";
import { trackSubmission } from "@/lib/appUpdate";
import { POLICIES, fetchFor, supabaseRead } from "@/lib/net/request";
import {
  readOwnAnswers,
  readRoomById,
  readRoomByCode,
  readReleasedRounds,
  readRoomPlayers,
  readRoomResultRows,
} from "@/lib/data/roomReads";

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
import { OwnAnswers, ROOM_RESULT_COLUMNS, type RoomResultRow } from "./roomResults";
import type { LinkRoomState } from "./roomLink";
import { ensureSession } from "./session";
import { rememberLook, rememberedLook, type PlayerLook } from "./playerLook";
import type { DuelPlayerRow, DuelRow, PuzzleData, RoundResultRow, RoundRevealData } from "./types";
import type { PuzzleCategory } from "./types";
import type { RoomSettings } from "./roomSettings";
import type { ScoringMode } from "./scoringMode";

export class DuelError extends Error {}

/* -------------------------------------------------------------------------- */
/*  Reads — row level security limits these to rooms this device is part of     */
/* -------------------------------------------------------------------------- */

export async function fetchDuelByCode(roomCode: string): Promise<DuelRow | null> {
  const { data, error } = await supabaseRead((signal) =>
    readRoomByCode(supabase, roomCode.toUpperCase(), signal),
  );
  if (error) throw new DuelError(error.message);
  return data ?? null;
}

export async function fetchDuelById(duelId: string): Promise<DuelRow | null> {
  const { data, error } = await supabaseRead((signal) => readRoomById(supabase, duelId, signal));
  if (error) throw new DuelError(error.message);
  return data ?? null;
}

/**
 * The room's released rounds, in order, as far as they run unbroken from round 1 (Security C1a: a new room's rounds are
 * readable one at a time, from each round's intro). [] when none are, or the read fails (the next phase change asks again).
 */
export async function fetchReleasedRounds(duelId: string): Promise<PuzzleData[]> {
  try {
    const { data, error } = await supabaseRead((signal) => readReleasedRounds(supabase, duelId, signal));
    if (error || !data) return [];
    const out: PuzzleData[] = [];
    for (const row of [...data].sort((a, b) => a.round_number - b.round_number)) {
      if (row.round_number !== out.length + 1 || !row.puzzle || typeof row.puzzle !== "object") break;
      out.push(row.puzzle as PuzzleData);
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchPlayers(duelId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await supabaseRead((signal) => readRoomPlayers(supabase, duelId, signal));
  if (error) throw new DuelError(error.message);
  return data ?? [];
}

/** This device's own stored answers, fetched once a row (roomResults.ts). */
const ownAnswers = new OwnAnswers();

/**
 * The room's results: every row's scores, verdicts, times and `extra`, without the stored answers (an arcade
 * run's input log; roomResults.ts), plus `mySlot`'s own answers, each fetched once.
 */
export async function fetchResults(duelId: string, mySlot: number | null): Promise<RoundResultRow[]> {
  const { data, error } = await supabaseRead((signal) =>
    readRoomResultRows(supabase, duelId, ROOM_RESULT_COLUMNS, signal),
  );
  if (error) throw new DuelError(error.message);
  const rows: RoomResultRow[] = data ?? [];
  const missing = ownAnswers.missing(rows, mySlot);
  if (missing.length > 0) {
    const own = await supabaseRead((signal) => readOwnAnswers(supabase, missing, signal));
    // A failed fetch leaves those answers out this time (the next refetch asks again).
    if (!own.error) ownAnswers.remember(own.data ?? []);
  }
  return ownAnswers.attach(rows, mySlot);
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
  // A refused name carries the backend's three suggestions (names.server.ts) for the screen to offer.
  if (!result.ok) throw Object.assign(new DuelError(result.message), { suggestions: "suggestions" in result ? result.suggestions : undefined });
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
  await checkHostPresenceFn({ data: { roomId }, fetch: fetchFor(POLICIES.step) });
}

export async function removePlayer(roomId: string, slot: number): Promise<void> {
  const result = await removePlayerFn({ data: { roomId, slot } });
  if (!result.ok) throw new DuelError(result.message);
}

export async function leaveRoom(roomId: string): Promise<void> {
  await leaveRoomFn({ data: { roomId } });
}

export async function advancePhase(roomId: string, hostNext = false): Promise<void> {
  await advancePhaseFn({ data: { roomId, hostNext }, fetch: fetchFor(POLICIES.step) });
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
      // A send past its limit fails like a dropped one, so the room's sender sends it again (roomSend.ts).
      fetch: fetchFor(POLICIES.submit),
    }),
  );
}

/** Tapping READY on the round intro. */
export async function readyUp(roomId: string, roundNumber: number): Promise<void> {
  await readyUpFn({ data: { roomId, roundNumber }, fetch: fetchFor(POLICIES.step) });
}

/**
 * This device's heartbeat. The reply carries the room's last-seen times by user id (presence.server.ts, Speed fix 3),
 * or none for a device that isn't one of the room's players.
 */
export async function heartbeat(roomId: string): Promise<Record<string, string> | null> {
  const reply = (await heartbeatFn({ data: { roomId }, fetch: fetchFor(POLICIES.heartbeat) })) as { seen?: Record<string, string> };
  return reply?.seen ?? null;
}

/** The correct answer for a finished round, fetched only at reveal time. */
export async function fetchRevealPuzzle(
  duelId: string,
  roundNumber: number,
): Promise<RoundRevealData | null> {
  const result = await revealAnswerFn({ data: { roomId: duelId, roundNumber }, fetch: fetchFor(POLICIES.read) });
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
    fetch: fetchFor(POLICIES.read),
  });
}

/** Strikeout, Cryptogrid and Swapword: the server's view of the board after these moves. */
export async function checkMoves(
  duelId: string,
  roundNumber: number,
  moves: string,
): Promise<MovesView | null> {
  return (await checkMovesFn({ data: { roomId: duelId, roundNumber, moves }, fetch: fetchFor(POLICIES.read) })) as MovesView | null;
}

/** "Continue" on the round results or standings screen. */
export async function continueOn(
  roomId: string,
  roundNumber: number,
  phase: "result" | "standings",
): Promise<void> {
  await continueFn({ data: { roomId, roundNumber, phase }, fetch: fetchFor(POLICIES.step) });
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
  return (await roomPreviewFn({ data: { roomCode }, fetch: fetchFor(POLICIES.read) })) as RoomPreview;
}

/** Host only: resets this room for another tournament. */
export async function ensureRematch(roomId: string): Promise<{ roomCode: string }> {
  const result = await rematchFn({ data: { roomId } });
  if (!result.ok) throw new DuelError(result.message);
  return { roomCode: result.roomCode };
}
