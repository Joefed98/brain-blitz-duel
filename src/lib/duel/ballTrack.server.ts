import { gameDisplayName } from "./gameNames";
import { BALL_TRACK_BANK } from "./ballTrackBank.server";
import type { BallTrackPuzzleData } from "./types";
import { BT_REV } from "@/lib/arcade/ballTrack";

/** Draws one pre-proven course from the bank (built by scripts/ball-track-bank.ts). */
export function generateBallTrack(): BallTrackPuzzleData {
  const index = Math.floor(Math.random() * BALL_TRACK_BANK.length);
  const entry = BALL_TRACK_BANK[index];
  if (!entry) throw new Error(`${gameDisplayName("balltrack")} bank is empty`);
  return {
    type: "balltrack",
    seed: index + 1,
    course: structuredClone(entry.course),
    tier: entry.tier,
    par: entry.par,
    playbook: entry.playbook,
    // Rev 2 only adds options (turning occupied tubes, switch points), so every banked playbook still proves the course.
    btRev: BT_REV,
  };
}
