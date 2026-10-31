/**
 * Arcade groups (30 Oct 2026; Practice browsing and tile borders only): the arcade games split into
 * Retro, Sports, Cards & Board and Action on the Practice tab's Arcade side, and each arcade tile's
 * border takes its group's colour. Rooms, the room category picker, arcade rounds, the daily arcade and
 * scoring never read this: Arcade stays one category everywhere else.
 *
 * Games are listed by registry id. Ids not registered yet (the new Sports and Cards & Board games) are
 * listed so their sessions only need to register the game; every reader skips an id the registry lacks.
 */
import { PUZZLE_REGISTRY, isRetired } from "./registry";
import type { PuzzleType } from "./types";

export type ArcadeGroup = "retro" | "sports" | "cards" | "action";

export interface ArcadeGroupInfo {
  id: ArcadeGroup;
  label: string;
  /** The group's colour (the `--group-*` token in styles.css). */
  colour: string;
  /** Retro's tiles and dots carry a soft glow in its colour. */
  glow: boolean;
  /** Registry ids, in browsing order. */
  games: readonly string[];
}

export const ARCADE_GROUPS: readonly ArcadeGroupInfo[] = [
  {
    id: "retro",
    label: "Retro",
    colour: "#36E2F5",
    glow: true,
    // Hover, Breaker, Rally, Wavefront, Fission, Tempo, Meteor, Orbit, Jaywalk, Pinball.
    games: ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "orbit", "cross", "pinball"],
  },
  {
    id: "sports",
    label: "Sports",
    colour: "#4CC24A",
    glow: false,
    // Flightpath, Swish, then the new games (not registered yet).
    games: ["bullseye", "bintoss", "minigolf", "pool", "curling", "homerun", "freekick", "racing"],
  },
  {
    id: "cards",
    label: "Cards & Board",
    colour: "#FF5C93",
    glow: false,
    // All new (not registered yet).
    games: ["minesweeper", "freecell", "mahjong", "tripeaks", "pokersquares", "fivehands"],
  },
  {
    id: "action",
    label: "Action",
    colour: "#FF4D4D",
    glow: false,
    // Slice, Tilt, Gemstone, High Rise, Coral Pop, Roofbound, Rainbow Bridge, Ball Tracker, Grappler.
    games: ["slice", "tilt", "matchup", "skyline", "bubble", "flip", "inkbridge", "balltrack", "swing"],
  },
];

const BY_ID = new Map(ARCADE_GROUPS.map((g) => [g.id, g]));
const GROUP_OF = new Map<string, ArcadeGroup>(ARCADE_GROUPS.flatMap((g) => g.games.map((t) => [t, g.id] as const)));

export function arcadeGroupInfo(group: ArcadeGroup): ArcadeGroupInfo {
  return BY_ID.get(group)!;
}

/** The group a game id belongs to; null for a game in no group (puzzles, retired arcade games). */
export function arcadeGroupOf(type: string): ArcadeGroup | null {
  return GROUP_OF.get(type) ?? null;
}

/** True when the registry has this id. */
export function isRegisteredType(type: string): type is PuzzleType {
  return Object.prototype.hasOwnProperty.call(PUZZLE_REGISTRY, type);
}

/** A group's games the registry has and rooms deal (active arcade games), in the group's order. */
export function arcadeGroupTypes(group: ArcadeGroup): PuzzleType[] {
  return arcadeGroupInfo(group).games.filter(
    (t): t is PuzzleType => isRegisteredType(t) && !isRetired(t) && PUZZLE_REGISTRY[t].category === "arcade",
  );
}
