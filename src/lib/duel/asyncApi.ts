/**
 * The phone's side of the async-room and daily calls (21 Oct 2026): each makes sure the device has
 * its anonymous session first, as the room API does (api.ts). Nothing here grades or stores.
 */
import { APP_BUILD_ID } from "@/lib/appVersion";

import {
  asyncAttemptFn,
  asyncCheckMovesFn,
  asyncCheckWordFn,
  asyncRevealFn,
  asyncRoundStartFn,
  asyncSubmitFn,
} from "./asyncRoom.functions";
import { dailyBoardFn, dailyStartFn, dailyStatusFn } from "./daily.functions";
import type { AsyncAttemptView } from "./asyncRoom";
import type { DailyBoardView, DailyKind, DailyStatus } from "./daily";
import type { SubmitExtra } from "./grade";
import type { MovesView } from "./moves";
import type { PuzzleData, RoundResultRow } from "./types";
import { ensureSession } from "./session";

export async function dailyStatus(): Promise<DailyStatus> {
  // No session is started for this: a visitor who never plays stays signed out.
  return (await dailyStatusFn()) as DailyStatus;
}

export async function startDaily(
  kind: DailyKind,
  displayName: string,
  look: { colour?: number | null; icon?: string | null },
): Promise<
  | { ok: true; roomId: string; created: boolean }
  | { ok: false; message: string; nameRefused?: boolean }
> {
  await ensureSession();
  return (await dailyStartFn({
    data: { kind, displayName, colour: look.colour ?? null, icon: look.icon ?? null },
  })) as never;
}

export async function dailyBoard(
  kind: DailyKind,
  day: "today" | "yesterday",
): Promise<DailyBoardView> {
  await ensureSession();
  return (await dailyBoardFn({ data: { kind, day } })) as DailyBoardView;
}

export async function asyncAttempt(roomId: string): Promise<AsyncAttemptView | null> {
  await ensureSession();
  const result = (await asyncAttemptFn({ data: { roomId } })) as {
    ok: boolean;
    view?: AsyncAttemptView;
  };
  return result.ok && result.view ? result.view : null;
}

export async function startAsyncRound(
  roomId: string,
  roundNumber: number,
): Promise<{ ok: true; puzzle: PuzzleData; startedAt: number } | { ok: false; message: string }> {
  await ensureSession();
  return (await asyncRoundStartFn({ data: { roomId, roundNumber } })) as never;
}

export interface AsyncSendPayload {
  duelId: string;
  roundNumber: number;
  answer: string;
  msRemaining: number;
  extra?: SubmitExtra;
}

/** The room sender's transport for an async round (roomSend.ts retries a send that throws). */
export async function submitAsyncAnswer(payload: AsyncSendPayload): Promise<unknown> {
  await ensureSession();
  return asyncSubmitFn({
    data: {
      roomId: payload.duelId,
      roundNumber: payload.roundNumber,
      answer: payload.answer,
      msRemaining: payload.msRemaining,
      ...(payload.extra ? { extra: payload.extra } : {}),
      clientVersion: APP_BUILD_ID,
    },
  });
}

export interface AsyncReveal {
  puzzle: PuzzleData;
  result: RoundResultRow;
  missed: boolean;
  summary: string;
  detail: string[];
  correctAnswer: string | null;
}

export async function asyncReveal(
  roomId: string,
  roundNumber: number,
): Promise<AsyncReveal | null> {
  await ensureSession();
  const result = (await asyncRevealFn({ data: { roomId, roundNumber } })) as {
    ok: boolean;
    json?: string;
  };
  if (!result.ok || !result.json) return null;
  try {
    return JSON.parse(result.json) as AsyncReveal;
  } catch {
    return null;
  }
}

export async function asyncCheckWord(
  roomId: string,
  roundNumber: number,
  word: string,
  found: string[],
  path?: number[],
) {
  await ensureSession();
  return asyncCheckWordFn({ data: { roomId, roundNumber, word, found, path: path ?? [] } });
}

export async function asyncCheckMoves(
  roomId: string,
  roundNumber: number,
  moves: string,
): Promise<MovesView | null> {
  await ensureSession();
  return (await asyncCheckMovesFn({ data: { roomId, roundNumber, moves } })) as MovesView | null;
}
