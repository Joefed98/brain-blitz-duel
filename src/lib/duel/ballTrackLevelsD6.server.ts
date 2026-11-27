/**
 * Ball Tracker's D6 level deals (btRev 9, 27 Nov 2026; BT_D6_LEVELS in src/lib/arcade/ballTrack.ts): each level's proved
 * course list, built by scripts/balltrack-d6-deal.ts (every course reaches 200 with the boosted oracle through btRev 9's
 * server replay; d6-strategy-levels-check re-proves them). Server-only.
 */
import type { BtCourse } from "@/lib/arcade/ballTrack";
import { BT_D6_EASY_DEAL } from "./ballTrackDealD6Easy.server";
import { BT_D6_EXPERT_DEAL } from "./ballTrackDealD6Expert.server";
import { BT_D6_HARD_DEAL } from "./ballTrackDealD6Hard.server";

/** A D6 level's proved course list. */
export function btD6LevelDeal(level: "easy" | "hard" | "expert"): readonly BtCourse[] {
  return level === "easy" ? BT_D6_EASY_DEAL : level === "hard" ? BT_D6_HARD_DEAL : BT_D6_EXPERT_DEAL;
}
