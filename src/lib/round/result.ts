/**
 * The round engine's stored result (B6, docs/round-engine/plan.md): the columns a graded answer becomes, the same in
 * a room's round_results row and an async round's async_results row (and later a rated match's row). Each mode adds
 * its own keys (a room's duel_id, slot and round; an async round's answered flags) and writes through its data layer.
 * Pure.
 *
 * `extra` is passed through exactly as graded: a room stores it as it is (asJson), an async round as `?? null`, as
 * before, so each mode keeps its own last step.
 */
import type { Graded } from "@/lib/duel/grade";

export interface ResultColumns {
  answer: string | null;
  is_correct: boolean;
  ms_remaining: number;
  reaction_avg_ms: number | null;
  correct_count: number | null;
  errors: number | null;
  extra: Graded["extra"];
  score: number;
}

export function resultColumns(graded: Graded): ResultColumns {
  return {
    answer: graded.answer || null,
    is_correct: graded.isCorrect,
    ms_remaining: graded.storedMs,
    reaction_avg_ms: graded.reactionAvgMs,
    correct_count: graded.correctCount,
    errors: graded.errors,
    extra: graded.extra,
    score: graded.score,
  };
}
