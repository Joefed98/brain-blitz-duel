/**
 * Rainbow Bridge's level deals (the Strategy overhaul's stage 3, 15 Nov 2026; docs/arcade-standard/inkbridge.md
 * "Levels (stage 3)"): each level beyond Normal deals inkRev 15 from its own proved deal, built by
 * `bun scripts/ink-big-deal.ts --rev=15 --level=<level>` (every seed's levels proved under the level's rules and its
 * perfect run exactly 200 through the server replay of the level; ink-levels-check re-proves them).
 */
import type { InkDiff } from "@/lib/arcade/inkBridge";
import { inkHillsEasyDealSeed } from "./inkHillsDealEasy.server";
import { inkHillsHardDealSeed } from "./inkHillsDealHard.server";
import { inkHillsExpertDealSeed } from "./inkHillsDealExpert.server";

/** The level seed a room seed deals on inkRev 15 at `level`. */
export function inkLevelDealSeed(level: InkDiff, roomSeed: number): number {
  return level === "easy" ? inkHillsEasyDealSeed(roomSeed) : level === "hard" ? inkHillsHardDealSeed(roomSeed) : inkHillsExpertDealSeed(roomSeed);
}
