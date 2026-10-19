/**
 * When a room's puzzle phase ends without everyone's answer (19 Oct 2026, room flow only; no game's
 * play, scoring or grading changes).
 *
 * A puzzle's time-out sends the round's draft at the end of the phase (puzzleDurationMs) and the
 * room moves on 800 ms later. An arcade run is played on its own clock, from the moment its stage
 * mounts: a stage that mounts more than ARCADE_PHASE_SLACK_MS (3 s) after the phase change (a slow
 * phone, a realtime update arriving late, Letterfall waiting for its dictionary) was still running
 * at the phase's end, so the time-out sent its last draft and the run was cut short (#115's audit,
 * item 6). Arcade rounds now wait ARCADE_LATE_RUN_MS longer for a run still being played: the
 * phone's time-out comes that much later (the stage's own finish usually arrives first) and the
 * room, phone and server alike, closes the phase that much later. A run that mounts up to
 * ARCADE_PHASE_SLACK_MS + ARCADE_LATE_RUN_MS (8 s) late now ends on its own; a later one still
 * sends its draft. Rounds where every player has answered move on at once, as before.
 *
 * room-late-run-check proves the timings; the server (duel.functions.ts advance) and the room page
 * both read roomPuzzleCloseMs.
 */
import { puzzleDurationMs, usesArcadeClock } from "./registry";
import type { PuzzleData } from "./types";

/** Extra time an arcade round's phase waits for a run that is still being played. */
export const ARCADE_LATE_RUN_MS = 5000;
/** The room moves on this long after the time-out, so the time-out's draft is in first. */
export const ROOM_CLOSE_GRACE_MS = 800;

function lateRunMs(puzzle: PuzzleData | undefined): number {
  return puzzle && usesArcadeClock(puzzle.type) ? ARCADE_LATE_RUN_MS : 0;
}

/** Ms after the puzzle phase starts at which a phone with no answer sends its draft. */
export function roomTimeoutMs(puzzle: PuzzleData | undefined): number {
  return puzzleDurationMs(puzzle) + lateRunMs(puzzle);
}

/** Ms after the puzzle phase starts past which the room moves to the reveal without every answer. */
export function roomPuzzleCloseMs(puzzle: PuzzleData | undefined): number {
  return roomTimeoutMs(puzzle) + ROOM_CLOSE_GRACE_MS;
}
