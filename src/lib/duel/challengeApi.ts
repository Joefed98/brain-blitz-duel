/**
 * The phone's side of the friend-challenge calls (22 Oct 2026): each makes sure the device has its
 * anonymous session first, as the room and daily APIs do. Nothing here grades or stores; the rounds
 * themselves go through asyncApi.ts.
 */
import {
  challengeFinalFn,
  challengeFollowupFn,
  challengeFromRoomFn,
  challengeInfoFn,
  challengePingsFn,
  challengeRosterFn,
  challengeRoundBoardFn,
  challengeStatusFn,
  createChallengeFn,
  myChallengesFn,
  startChallengeFn,
} from "./challenge.functions";
import type {
  ChallengeFinalBoard,
  ChallengeInfo,
  ChallengeRoster,
  ChallengeRoundBoard,
  ChallengeSummary,
} from "./challenge";
import type { PuzzleCategory } from "./types";
import { ensureSession } from "./session";

type Started =
  | { ok: true; code: string; roomId: string }
  | { ok: false; message: string; nameRefused?: boolean };

export async function challengeStatus(): Promise<boolean> {
  // No session is started for this: a visitor who never plays stays signed out.
  return ((await challengeStatusFn()) as { available: boolean }).available === true;
}

export async function createChallenge(input: {
  categories: PuzzleCategory[];
  rounds: number;
  displayName: string;
  colour?: number | null;
  icon?: string | null;
}): Promise<Started> {
  await ensureSession();
  return (await createChallengeFn({
    data: { ...input, colour: input.colour ?? null, icon: input.icon ?? null },
  })) as Started;
}

export async function challengeFromRoom(duelId: string): Promise<Started> {
  await ensureSession();
  return (await challengeFromRoomFn({ data: { duelId } })) as Started;
}

export async function challengeInfo(code: string, opened = false): Promise<ChallengeInfo> {
  await ensureSession();
  return (await challengeInfoFn({ data: { code, opened } })) as ChallengeInfo;
}

export async function startChallenge(
  code: string,
  displayName: string,
  look: { colour?: number | null; icon?: string | null },
): Promise<
  | { ok: true; roomId: string; created: boolean }
  | { ok: false; message: string; nameRefused?: boolean; full?: boolean; closed?: boolean }
> {
  await ensureSession();
  return (await startChallengeFn({
    data: { code, displayName, colour: look.colour ?? null, icon: look.icon ?? null },
  })) as never;
}

export async function challengeRoster(roomId: string): Promise<ChallengeRoster | null> {
  await ensureSession();
  return (await challengeRosterFn({ data: { roomId } })) as ChallengeRoster | null;
}

export async function challengePings(roomId: string, roundNumber: number): Promise<number[]> {
  await ensureSession();
  return ((await challengePingsFn({ data: { roomId, roundNumber } })) as number[] | null) ?? [];
}

function parsed<T>(result: { ok: boolean; json?: string }): T | null {
  if (!result.ok || !result.json) return null;
  try {
    return JSON.parse(result.json) as T;
  } catch {
    return null;
  }
}

export async function challengeRoundBoard(
  roomId: string,
  roundNumber: number,
): Promise<ChallengeRoundBoard | null> {
  await ensureSession();
  return parsed<ChallengeRoundBoard>(
    (await challengeRoundBoardFn({ data: { roomId, roundNumber } })) as never,
  );
}

export async function challengeFinal(roomId: string): Promise<ChallengeFinalBoard | null> {
  await ensureSession();
  return parsed<ChallengeFinalBoard>((await challengeFinalFn({ data: { roomId } })) as never);
}

export async function myChallenges(codes: string[]): Promise<ChallengeSummary[]> {
  await ensureSession();
  return ((await myChallengesFn({ data: { codes } })) as ChallengeSummary[] | null) ?? [];
}

/** Fire-and-forget: a friend's first room or daily after a challenge (beta). */
export function sendChallengeFollowup(kind: "room" | "daily", code: string | null): void {
  void (async () => {
    try {
      await ensureSession();
      await challengeFollowupFn({ data: { kind, code } });
    } catch {
      /* beta counts never get in the way */
    }
  })();
}
