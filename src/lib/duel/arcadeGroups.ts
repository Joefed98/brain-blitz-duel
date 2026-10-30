/**
 * Arcade groups (30 Oct 2026, presentation only): a subset of the Arcade category shown together, with its own colour
 * on game tiles (`data-group` on GameIcon, `--group-*` in polish-layout/theme.css). The first is Sports (Home Run Derby,
 * Free Kick, Racing). Rooms, draws, scoring and the category counts are unchanged: these games are Arcade games.
 */
import type { PuzzleType } from "./types";

export type ArcadeGroup = "sports";

export const ARCADE_GROUPS: Readonly<Partial<Record<PuzzleType, ArcadeGroup>>> = {
  homerun: "sports",
  freekick: "sports",
  racing: "sports",
};

export const ARCADE_GROUP_NAMES: Readonly<Record<ArcadeGroup, string>> = { sports: "Sports" };

export function arcadeGroupOf(type: string): ArcadeGroup | null {
  return ARCADE_GROUPS[type as PuzzleType] ?? null;
}
