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

import type { Db } from "@/lib/data/db.server";
import { readPlayer, readPlayers } from "@/lib/data/players.server";
import { readResultsOfRounds } from "@/lib/data/results.server";
import { readPrivatePuzzles, readRoom } from "@/lib/data/rooms.server";
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

async function load(client: Db, roomId: string, userId: string) {
  const { data: me } = await readPlayer(client, roomId, userId);
  if (!me) return null;
  const { data: room } = await readRoom(client, roomId);
  if (!room) return null;
  return room;
}

async function buildRounds(client: Db, room: DuelRow, rounds: number[]): Promise<ReplayRound[]> {
  const { data: playerRows } = await readPlayers(client, room.id);
  const players: DuelPlayerRow[] = playerRows ?? [];
  const secrets = (await readPrivatePuzzles(client, room.id)).data;
  const { data: resultRows } = await readResultsOfRounds(client, room.id, rounds);
  const results: RoundResultRow[] = resultRows ?? [];
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
  client: Db,
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
  client: Db,
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
