/**
 * When stored logs and answers may be served for replays. Other players' runs
 * leave the server only once a round has closed for EVERYONE: the reveal phase
 * still accepts a lagging phone's answer (the submit server function takes "puzzle" and
 * "reveal"), so replays wait for the results screen ("result") or later.
 */
import type { DuelRow } from "@/lib/duel/types";

export const REPLAY_OPEN_PHASES = ["result", "standings", "winner_reveal"] as const;

export function replayRoundClosed(
  room: Pick<DuelRow, "status" | "current_round" | "phase">,
  round: number,
): boolean {
  if (!Number.isInteger(round) || round < 1) return false;
  if (room.status === "finished") return true;
  if (room.status !== "in_progress") return false;
  if (room.current_round > round) return true;
  return (
    room.current_round === round && (REPLAY_OPEN_PHASES as readonly string[]).includes(room.phase)
  );
}

/** The whole game's replays (the podium): only once the room has finished. */
export function replayGameClosed(room: Pick<DuelRow, "status">): boolean {
  return room.status === "finished";
}

/** The largest stored answer a replay will carry (the intro demos' allowance). */
export const REPLAY_MAX_ANSWER_CHARS = 400_000;
