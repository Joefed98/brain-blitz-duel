/**
 * Ball Tracker's level deals (Strategy overhaul stage 3, 15 Nov 2026; docs/arcade-standard/balltrack.md "Levels"): the
 * proved course list each level beyond Normal deals from (built by scripts/balltrack-level-deal.ts; every course reaches
 * 200 with the boosted oracle through the server replay, balltrack-levels-check). Normal deals btRev 8's bank list
 * (ballTrackDealV8.server.ts), exactly as before levels.
 */
import type { BtCourse } from "@/lib/arcade/ballTrack";
import type { Level } from "@/lib/levels/levels";
import { BT_EASY_DEAL } from "./ballTrackDealEasy.server";
import { BT_EXPERT_DEAL } from "./ballTrackDealExpert.server";
import { BT_HARD_DEAL } from "./ballTrackDealHard.server";

/** A level's proved course list (empty for Normal, which deals the bank). */
export function btLevelDeal(level: Level): readonly BtCourse[] {
  return level === "easy" ? BT_EASY_DEAL : level === "hard" ? BT_HARD_DEAL : level === "expert" ? BT_EXPERT_DEAL : [];
}
