/**
 * Server side of the round reveal (revealAnswerFn). The correct answer leaves
 * the server once the round has ended; other players' answers only once the
 * round has closed for everyone, i.e. late answers are no longer accepted.
 *
 * The submit server function still takes a lagging phone's answer during the
 * reveal phase (answerWindow.ts), so during that phase the reveal carries only
 * the caller's own detail, plus, for arcade rounds, where each other player's
 * run ended on the reveal track and their stored score, used only to place their
 * marker on the reveal's chart and never drawn (a
 * progress number and a score, never their answer). The
 * phone fetches again on the results screen, where everything is open. The
 * round_results read policy (duel_round_ended) follows the same cutoff.
 *
 * A caller with no answer in yet gets no answer detail at all until the cutoff
 * (only the public puzzle, `awaitingAnswer`): the correct answer and the
 * private solution would let a lagging (or modified) phone send them as its
 * late answer. Once their own answer is stored, or the cutoff passes, the
 * reveal is as above; the phone fetches again on either.
 *
 * The database client is passed in, so scripts/reveal-window-check.ts drives
 * this exact code with an in-memory stand-in.
 */
import { puzzleDef, puzzleName } from "./registry";
import { isRemovedType, removedRoundScore } from "./removedGames";
import { mergePuzzle } from "./secrets";
import { othersAnswersReadable } from "./answerWindow";
import type {
  DuelRow,
  PlayerRoundDetail,
  PuzzleData,
  RoundResultRow,
  RoundRevealData,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The round is over for display: the correct answer may be shown. */
export function roundHasEnded(room: DuelRow, round: number): boolean {
  if (room.status === "finished") return true;
  if (room.current_round > round) return true;
  return (
    room.current_round === round &&
    (room.phase === "reveal" ||
      room.phase === "result" ||
      room.phase === "standings" ||
      room.phase === "winner_reveal")
  );
}

export type RevealResponse = { ok: true; data: RoundRevealData } | { ok: false; message: string };

export async function loadRoundReveal(
  client: any,
  room: DuelRow,
  roundNumber: number,
  mySlot: number,
): Promise<RevealResponse> {
  if (!roundHasEnded(room, roundNumber)) {
    return { ok: false, message: "That round has not finished yet." };
  }
  const pub = room.puzzles_public[roundNumber - 1];
  if (!pub) return { ok: false, message: "Unknown round." };
  const { data: resultRows, error } = await client
    .from("round_results")
    .select("*")
    .eq("duel_id", room.id)
    .eq("round_number", roundNumber)
    .order("player_slot");
  if (error) throw new Error(error.message);
  const rows = (resultRows ?? []) as RoundResultRow[];
  const open = othersAnswersReadable(room, roundNumber);
  // No answer in yet and late answers still accepted: nothing beyond the public
  // puzzle the phone already holds, and the private solution is never read.
  if (!open && !rows.some((row) => row.player_slot === mySlot)) {
    return {
      ok: true,
      data: {
        puzzle: pub as PuzzleData,
        correctAnswer: null,
        players: [],
        partial: true,
        awaitingAnswer: true,
      },
    };
  }
  const { data: secretRow } = await client
    .from("duel_secrets")
    .select("puzzles_private")
    .eq("duel_id", room.id)
    .maybeSingle();
  const priv = ((secretRow?.puzzles_private ?? []) as Record<string, unknown>[])[roundNumber - 1];
  const puzzle = mergePuzzle(pub, priv);
  const shown = open ? rows : rows.filter((row) => row.player_slot === mySlot);
  // A deleted game (removedGames.ts): its name and each stored score, nothing recomputed.
  if (isRemovedType(puzzle.type)) {
    const players: PlayerRoundDetail[] = shown.map((result) => ({
      playerSlot: result.player_slot,
      summary: `${puzzleName(puzzle.type)} · ${removedRoundScore(result)}${removedRoundScore(result) === 1 ? " point" : " points"}`,
      detail: [],
    }));
    return { ok: true, data: { puzzle, correctAnswer: null, players, ...(open ? {} : { partial: true, progress: [] }) } };
  }
  const definition = puzzleDef(puzzle.type);
  // A reveal must never break the round: a summary that throws falls back.
  const players: PlayerRoundDetail[] = shown.map((result) => {
    try {
      return { playerSlot: result.player_slot, ...definition.roundSummary(result, puzzle) };
    } catch (err) {
      console.error(`[reveal] summary failed for ${puzzle.type}`, err);
      return { playerSlot: result.player_slot, summary: "—", detail: [] as string[] };
    }
  });
  let correctAnswer: RoundRevealData["correctAnswer"] = null;
  try {
    correctAnswer = definition.correctAnswer(puzzle);
  } catch (err) {
    console.error(`[reveal] answer failed for ${puzzle.type}`, err);
  }
  if (open) return { ok: true, data: { puzzle, correctAnswer, players } };
  const progress: NonNullable<RoundRevealData["progress"]> = [];
  for (const row of rows) {
    if (row.player_slot === mySlot) continue;
    const axis = (
      (row.extra as Record<string, unknown> | null)?.["reveal"] as { axis?: unknown } | undefined
    )?.axis as { value?: unknown; max?: unknown; label?: unknown } | undefined;
    if (!axis || typeof axis.value !== "number") continue;
    progress.push({
      playerSlot: row.player_slot,
      axis: {
        value: axis.value,
        max: typeof axis.max === "number" ? axis.max : null,
        label: typeof axis.label === "string" ? axis.label : "",
      },
      // The stored score alone, only to place the marker on the reveal's chart (ArcadeScoreChart
      // draws no figure for anyone); never the answer.
      score: row.score,
    });
  }
  return { ok: true, data: { puzzle, correctAnswer, players, partial: true, progress } };
}
