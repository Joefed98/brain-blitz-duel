import { gameDisplayName } from "./gameNames";
import { BALL_TRACK_BANK_TALL } from "./ballTrackBankTall.server";
import type { BallTrackPuzzleData } from "./types";
import { BT_REV_TARGET, BT_REV_STRICT } from "@/lib/arcade/ballTrack";

/** Draws one pre-proven course from the bank (built by scripts/ball-track-bank.ts). */
export function generateBallTrack(): BallTrackPuzzleData {
  // btRev 4 (taller worlds, batch 3): the 12-row board, from its own proved bank (scripts/ball-track-bank.ts --tall);
  // each course carries `rows`. btRev 3 rounds dealt from BALL_TRACK_BANK keep their stored 9-row course.
  const index = Math.floor(Math.random() * BALL_TRACK_BANK_TALL.length);
  const entry = BALL_TRACK_BANK_TALL[index];
  if (!entry) throw new Error(`${gameDisplayName("balltrack")} bank is empty`);
  return {
    type: "balltrack",
    seed: index + 1,
    course: structuredClone(entry.course),
    tier: entry.tier,
    par: entry.par,
    playbook: entry.playbook,
    // Rev 2 only adds options (turning occupied tubes, switch points), so every banked playbook still proves the course;
    // rev 3 plays rev 2 on the Oct 2026 score bands; rev 4 plays rev 3 on the taller board.
    btRev: BT_REV_STRICT,
  };
}
