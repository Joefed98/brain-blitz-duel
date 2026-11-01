import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staleSubmissionNote } from "@/lib/appVersion";

import type { SubmitExtra } from "./grade";
import type { PuzzleData } from "./types";

/* -------------------------------------------------------------------------- */
/*  Async rooms (21 Oct 2026; asyncRoom.server.ts): the calls a player makes    */
/*  inside any async room (the daily challenge now, friend challenges later).   */
/*  Each acts only on the caller's own attempt, found by their device id.       */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** The room and the caller's attempt in it, or a message. */
async function mine(client: any, roomId: string, userId: string) {
  const { roomById, attemptFor } = await import("./asyncRoom.server");
  const room = await roomById(client, String(roomId ?? ""));
  if (!room) return { error: "That challenge no longer exists." } as const;
  const attempt = await attemptFor(client, room.id, userId);
  if (!attempt) return { error: "You haven't started this challenge." } as const;
  return { room, attempt } as const;
}

/** The caller's attempt: each round's start, stored score and whether it was missed (their own only). */
export const asyncAttemptFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return { ok: false as const, message: found.error };
    const { attemptView } = await import("./asyncRoom.server");
    const { view } = await attemptView(client, found.room, found.attempt, Date.now());
    return { ok: true as const, view, serverNow: Date.now() };
  });

/**
 * Starts the caller's next round on the server's clock (or returns the start already stored), and
 * only now sends that round's puzzle (its public half).
 */
export const asyncRoundStartFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return { ok: false as const, message: found.error };
    const { startAsyncRound } = await import("./asyncRoom.server");
    return startAsyncRound(client, found.room, found.attempt, Number(data.roundNumber), Date.now());
  });

/** Grades the caller's answer exactly as a room does, timed from their own round start. */
export const asyncSubmitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roomId: string;
      roundNumber: number;
      answer: string;
      msRemaining: number;
      extra?: SubmitExtra;
      clientVersion?: string;
      /** How the round was played (lib/inputType.ts); stored beside the result, never graded. */
      inputType?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const nowMs = Date.now();
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return { ok: false as const, message: found.error };
    const staleNote = staleSubmissionNote(
      "async_submit",
      data.clientVersion,
      `async room ${found.room.id}, round ${data.roundNumber}`,
    );
    if (staleNote) console.warn(staleNote);
    const { submitAsyncAnswer } = await import("./asyncRoom.server");
    const outcome = await submitAsyncAnswer(
      client,
      found.room,
      found.attempt,
      {
        round: Number(data.roundNumber),
        answer: String(data.answer ?? ""),
        msRemaining: Number(data.msRemaining),
        extra: data.extra,
      },
      nowMs,
    );
    if (outcome.ok && !("alreadySubmitted" in outcome && outcome.alreadySubmitted)) {
      const { recordInputType } = await import("./inputType.server");
      await recordInputType(client, "async_results", { attempt_id: found.attempt.id, round_number: Number(data.roundNumber) }, data.inputType);
    }
    return outcome;
  });

/** One of the caller's finished rounds in full (the reveal and the results screen); never anyone else's. */
export const asyncRevealFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return { ok: false as const, message: found.error };
    const { asyncRoundReveal } = await import("./asyncRoom.server");
    const reveal = await asyncRoundReveal(
      client,
      found.room,
      found.attempt,
      Number(data.roundNumber),
    );
    if (!reveal.ok) return reveal;
    // Serialised as JSON text, as practice's grade is, so the RPC boundary sees plain strings.
    return { ok: true as const, json: JSON.stringify(reveal) };
  });

/** Word puzzles in the caller's live round: the verdict only (the room's checkWordFn, per player). */
export const asyncCheckWordFn = createServerFn({ method: "POST" })
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
    const over = { valid: false as const, points: 0, word: "", reason: "That round is over." };
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return over;
    const { liveRoundPuzzle } = await import("./asyncRoom.server");
    const live = await liveRoundPuzzle(
      client,
      found.room,
      found.attempt,
      Number(data.roundNumber),
      Date.now(),
    );
    if (!live) return over;
    const { checkRoundWord } = await import("./wordCheck.server");
    return checkRoundWord(live.pub, live.priv, data);
  });

/** Strikeout, Cryptogrid and Swapword in the caller's live round: only what the board may show next. */
export const asyncCheckMovesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number; moves: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return null;
    const { liveRoundPuzzle } = await import("./asyncRoom.server");
    const live = await liveRoundPuzzle(
      client,
      found.room,
      found.attempt,
      Number(data.roundNumber),
      Date.now(),
    );
    if (!live) return null;
    const pub = live.pub as PuzzleData;
    if (pub.type !== "strikeout" && pub.type !== "codeword" && pub.type !== "swapword") return null;
    const { mergePuzzle } = await import("./secrets");
    const { checkPuzzleMoves } = await import("./moves.server");
    return checkPuzzleMoves(mergePuzzle(pub, await live.priv()), data.moves);
  });
