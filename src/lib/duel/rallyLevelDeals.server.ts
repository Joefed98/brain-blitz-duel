/**
 * Rally's deal (rallyRev 14, D5's ladder; built by `bun scripts/rally-level-deal.ts`, do not edit): placeholder.
 */
import type { Level } from "@/lib/levels/levels";

export const RALLY_LEVEL_DEALS: Readonly<Record<Level, readonly number[]>> = { easy: [], normal: [], hard: [], expert: [] };

/** The seed a room seed deals on rallyRev 14 at a level (Normal when none is asked). */
export function rallyLevelDealSeed(level: Level | null | undefined, roomSeed: number): number {
  const list = RALLY_LEVEL_DEALS[level ?? "normal"] ?? RALLY_LEVEL_DEALS.normal;
  const n = list.length;
  if (!n) return roomSeed;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
