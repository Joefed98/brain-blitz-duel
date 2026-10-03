import { BALL_TRACK_BANK } from "./ballTrackBank.server";
import type { BallTrackPuzzleData } from "./types";

/** Draws one pre-proven course from the bank (built by scripts/ball-track-bank.ts). */
export function generateBallTrack(): BallTrackPuzzleData {
  const index = Math.floor(Math.random() * BALL_TRACK_BANK.length);
  const entry = BALL_TRACK_BANK[index];
  if (!entry) throw new Error("Ball Track bank is empty");
  return {
    type: "balltrack",
    seed: index + 1,
    course: structuredClone(entry.course),
    tier: entry.tier,
    par: entry.par,
    playbook: entry.playbook,
  };
}
