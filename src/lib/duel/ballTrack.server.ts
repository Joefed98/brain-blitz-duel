import { gameDisplayName } from "./gameNames";
import { BALL_TRACK_BANK_V7 } from "./ballTrackBankV7.server";
import type { BallTrackPuzzleData } from "./types";
import { BT_REV_RUSH } from "@/lib/arcade/ballTrack";

/** Draws one pre-proven course from the bank (built by scripts/ball-track-bank.ts). */
export function generateBallTrack(): BallTrackPuzzleData {
  // btRev 7 (expansion E6): the 13-row board with gold marbles, boosters and crossovers, from its own proved bank
  // (scripts/ball-track-bank.ts --v7). Older rounds keep their stored course (btRev 4–6: the 12-row bank).
  const index = Math.floor(Math.random() * BALL_TRACK_BANK_V7.length);
  const entry = BALL_TRACK_BANK_V7[index];
  if (!entry) throw new Error(`${gameDisplayName("balltrack")} bank is empty`);
  return {
    type: "balltrack",
    seed: index + 1,
    course: structuredClone(entry.course),
    tier: entry.tier,
    par: entry.par,
    playbook: entry.playbook,
    // Rev 2 only adds options (turning occupied tubes, switch points), so every banked playbook still proves the course;
    // rev 3 plays rev 2 on the Oct 2026 score bands; rev 4 plays rev 3 on the taller board; rev 7 adds the expansion.
    btRev: BT_REV_RUSH,
  };
}
