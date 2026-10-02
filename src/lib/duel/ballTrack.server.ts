import { BALL_TRACK_BANK } from "./ballTrackBank.server";
import { BT_COLS, BT_ROWS } from "./ballTrack";
import type { BallTrackPuzzleData } from "./types";

/** Draws one pre-proven board from the bank (built by scripts/ball-track-bank.ts). */
export function generateBallTrack(): BallTrackPuzzleData {
  const entry = BALL_TRACK_BANK[Math.floor(Math.random() * BALL_TRACK_BANK.length)]!;
  return {
    type: "balltrack",
    cols: BT_COLS,
    rows: BT_ROWS,
    tiles: entry.tiles,
    start: entry.start,
    exit: entry.exit,
    minRemovals: entry.min,
    solution: [...entry.solution],
  };
}
