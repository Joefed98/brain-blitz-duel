/**
 * When a round takes answers, and when other players' answers may be read.
 * The two never overlap: a lagging phone's answer is accepted through the
 * reveal phase ("puzzle" and "reveal"), and no other player's answer leaves
 * the server (reveal, replays) or the database (the round_results read policy,
 * public.duel_round_ended) until the results screen ("result") or later.
 */
import { REPLAY_OPEN_PHASES, replayRoundClosed } from "@/lib/replay/access";
import type { DuelPhase, DuelRow } from "./types";

/** Phases in which submit_answer still takes the current round's answer. */
export const ANSWER_PHASES = ["puzzle", "reveal"] as const satisfies readonly DuelPhase[];

/** Phases in which the current round's answers are readable by every room member. */
export const OPEN_ANSWER_PHASES = REPLAY_OPEN_PHASES;

export function acceptsAnswers(
  room: Pick<DuelRow, "status" | "current_round" | "phase">,
  round: number,
): boolean {
  return (
    room.status === "in_progress" &&
    room.current_round === round &&
    (ANSWER_PHASES as readonly string[]).includes(room.phase)
  );
}

/** Late answers are no longer accepted, so other players' answers may be read. */
export function othersAnswersReadable(
  room: Pick<DuelRow, "status" | "current_round" | "phase">,
  round: number,
): boolean {
  return replayRoundClosed(room, round);
}
