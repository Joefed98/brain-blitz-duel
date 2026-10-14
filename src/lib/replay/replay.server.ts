/**
 * Server side of round replays (display only): reads the stored puzzle and the
 * round winner's stored answer, and only once the round has closed for every
 * player (access.ts). The client never reads another player's answer for a
 * replay any other way. The database client is passed in, so
 * scripts/replay-access-check.ts can drive this exact code with a stub.
 */
import { mergePuzzle } from "@/lib/duel/secrets";
import { isRemovedType } from "@/lib/duel/removedGames";
import type { DuelPlayerRow, DuelRow, PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { replayGameClosed, replayRoundClosed, REPLAY_MAX_ANSWER_CHARS } from "./access";
import { roundWinnerSlot, runnerUpScore } from "./pick";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Plain JSON (round_results.extra), so the server function's result stays serialisable. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface ReplayWinner {
  slot: number;
  name: string;
  score: number;
  isCorrect: boolean;
  /** The stored answer (an engine run string, a move list, a tap log…). */
  answer: string | null;
  extra: { [key: string]: Json } | null;
  reactionAvgMs: number | null;
  msRemaining: number;
}

export interface ReplayRound {
  round: number;
  puzzle: PuzzleData;
  winner: ReplayWinner | null;
  /** The best score in the round apart from the winner's. */
  runnerUp: number;
  /** Players who answered the round. */
  answered: number;
}

export type ReplayResponse<T> = { ok: true; data: T } | { ok: false; message: string };

async function load(client: any, roomId: string, userId: string) {
  const { data: me } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!me) return null;
  const { data: room } = await client.from("duels").select("*").eq("id", roomId).maybeSingle();
  if (!room) return null;
  return room as DuelRow;
}

async function buildRounds(client: any, room: DuelRow, rounds: number[]): Promise<ReplayRound[]> {
  const { data: playerRows } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", room.id)
    .order("player_slot");
  const players = (playerRows ?? []) as DuelPlayerRow[];
  const { data: secretRow } = await client
    .from("duel_secrets")
    .select("puzzles_private")
    .eq("duel_id", room.id)
    .maybeSingle();
  const secrets = (secretRow?.puzzles_private ?? []) as Record<string, unknown>[];
  const { data: resultRows } = await client
    .from("round_results")
    .select("*")
    .eq("duel_id", room.id)
    .in("round_number", rounds);
  const results = (resultRows ?? []) as RoundResultRow[];
  const out: ReplayRound[] = [];
  for (const round of rounds) {
    const pub = room.puzzles_public[round - 1];
    if (!pub) continue;
    // Rounds of deleted games (removedGames.ts) keep only their name and stored score: no replay.
    if (isRemovedType((pub as { type?: unknown }).type)) continue;
    const puzzle = mergePuzzle(pub, secrets[round - 1]);
    const slot = roundWinnerSlot(players, results, round);
    const row =
      slot === null
        ? null
        : (results.find((r) => r.round_number === round && r.player_slot === slot) ?? null);
    const answer = row?.answer && row.answer.length <= REPLAY_MAX_ANSWER_CHARS ? row.answer : null;
    out.push({
      round,
      puzzle,
      winner:
        row && slot !== null
          ? {
              slot,
              name: players.find((p) => p.player_slot === slot)?.display_name ?? "Player",
              score: row.score,
              isCorrect: row.is_correct,
              answer,
              extra: (row.extra ?? null) as { [key: string]: Json } | null,
              reactionAvgMs: row.reaction_avg_ms,
              msRemaining: row.ms_remaining,
            }
          : null,
      runnerUp: slot === null ? 0 : runnerUpScore(results, round, slot),
      answered: results.filter((r) => r.round_number === round).length,
    });
  }
  return out;
}

/** One closed round's replay (the results screen). */
export async function loadRoundReplay(
  client: any,
  userId: string,
  input: { roomId: string; roundNumber: number },
): Promise<ReplayResponse<ReplayRound | null>> {
  const room = await load(client, input.roomId, userId);
  if (!room) return { ok: false, message: "You are not part of this room." };
  if (!replayRoundClosed(room, input.roundNumber))
    return { ok: false, message: "That round has not closed yet." };
  const [round] = await buildRounds(client, room, [input.roundNumber]);
  return { ok: true, data: round ?? null };
}

/** Every round of a finished game (the podium's play of the game). */
export async function loadGameReplays(
  client: any,
  userId: string,
  input: { roomId: string },
): Promise<ReplayResponse<ReplayRound[]>> {
  const room = await load(client, input.roomId, userId);
  if (!room) return { ok: false, message: "You are not part of this room." };
  if (!replayGameClosed(room)) return { ok: false, message: "The game has not finished yet." };
  const count = Math.min(
    room.puzzles_public.length,
    room.round_count ?? room.puzzles_public.length,
  );
  const rounds = Array.from({ length: count }, (_, i) => i + 1);
  return { ok: true, data: await buildRounds(client, room, rounds) };
}
