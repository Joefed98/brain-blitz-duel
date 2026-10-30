import { gameDisplayName } from "./gameNames";
import { BALL_TRACK_BANK_V7 } from "./ballTrackBankV7.server";
import type { BallTrackPuzzleData } from "./types";
import { BT_REV_STD } from "@/lib/arcade/ballTrack";
import { BT_V8_DEAL } from "./ballTrackDealV8.server";

/** Draws one pre-proven course from the bank (built by scripts/ball-track-bank.ts). */
export function generateBallTrack(): BallTrackPuzzleData {
  // btRev 7 (expansion E6): the 13-row board with gold marbles, boosters and crossovers, from its own proved bank
  // (scripts/ball-track-bank.ts --v7). Older rounds keep their stored course (btRev 4–6: the 12-row bank).
  // btRev 8 deals only the bank courses on its deal list (BT_V8_DEAL: every one reaches 200; the courses on which
  // not every marble can be routed home through a booster are left out). The same one draw picks from the list.
  const index = BT_V8_DEAL[Math.floor(Math.random() * BT_V8_DEAL.length)]!;
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
    // btRev 8 (the arcade scoring standard, 29 Oct 2026): btRev 7's play on the same bank, scored to 200 on BT_STD.
    btRev: BT_REV_STD,
  };
}
