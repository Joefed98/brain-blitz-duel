/**
 * Practice as a recorded-run source (wave 3, W3b; Joe, 11 Nov 2026): the deal of each graded Practice play that C1a
 * counts (src/lib/duel/practice.functions.ts gradePracticeRun → its onCounted), stored so another player can be dealt
 * exactly that puzzle and play against that run (supabase/migrations/20261114200200_matchmaking_practice_and_forget.sql).
 * Server only, best effort: it never changes or delays the grade (never awaited by it, and it never throws).
 */
import type { PuzzleData } from "@/lib/duel/types";
import type { Db } from "@/lib/data/db.server";

export interface PracticeDealInput {
  playId: number;
  userId: string;
  puzzle: PuzzleData;
  graded: { score: number; storedMs: number; reactionAvgMs: number | null; answer: string; extra?: Record<string, unknown> | null };
}

/** Whether the grade's own replay flagged the run (arcade runs carry `extra.flagged`). */
export function gradeFlagged(extra: unknown): boolean {
  return typeof extra === "object" && extra !== null && (extra as { flagged?: unknown }).flagged === true;
}

export async function storePracticeDeal(client: Db, input: PracticeDealInput): Promise<void> {
  try {
    const { insertPracticeDeal } = await import("@/lib/data/rated.server");
    const { asJson } = await import("@/lib/data/db.server");
    const { error } = await insertPracticeDeal(client, {
      play_id: input.playId,
      user_id: input.userId,
      game: input.puzzle.type,
      puzzle: asJson(input.puzzle),
      answer: input.graded.answer,
      score: input.graded.score,
      ms_remaining: input.graded.storedMs,
      reaction_avg_ms: input.graded.reactionAvgMs,
      flagged: gradeFlagged(input.graded.extra),
      // The server's own stored grade (the same extra practice_plays.breakdown keeps), handed to W3a as gradeExtras.
      extra: input.graded.extra ? asJson(input.graded.extra) : null,
    });
    if (error) console.warn(`[practice-deal] play=${input.playId}: ${error.message}`);
  } catch (error) {
    console.warn(`[practice-deal] play=${input.playId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
