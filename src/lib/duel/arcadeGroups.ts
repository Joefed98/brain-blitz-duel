/**
 * Arcade groups (30 Oct 2026; Practice browsing, tile borders and, since 31 Oct 2026, the room settings sheet's
 * arcade chips, roomSettings.ts): the arcade games split into
 * Retro, Sports, Cards & Board, Action and Strategy on the Practice tab's Arcade side, and each arcade tile's
 * border takes its group's colour. Strategy (1 Nov 2026) was split out of Action: Coral Pop, Gemstone, Ball
 * Tracker, Tilt, Rainbow Bridge and High Rise moved, the rest of Action stayed. A room saved with the Action pick
 * before the split still deals both groups' games (roomSettings.ts `GROUPS_TOKEN`). Arcade rounds, the daily
 * arcade and scoring never read this: Arcade stays one category there.
 *
 * Games are listed by registry id. Ids not registered yet (the new Sports and Cards & Board games) are
 * listed so their sessions only need to register the game; every reader skips an id the registry lacks.
 */
import { PUZZLE_REGISTRY, isRetired } from "./registry";
import type { PuzzleType } from "./types";

export type ArcadeGroup = "retro" | "sports" | "cards" | "action" | "strategy";

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
    // Blockfall (1 Nov 2026).
    games: ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "orbit", "cross", "pinball", "blockfall"],
  },
  {
    id: "sports",
    label: "Sports",
    colour: "#4CC24A",
    glow: false,
    // Flightpath, Swish, then the new games (not registered yet).
    // Alley Roll (1 Nov 2026).
    games: ["bullseye", "bintoss", "minigolf", "pool", "curling", "homerun", "freekick", "racing", "alleyroll"],
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
    // Slice, Roofbound, Grappler, Ricochet (the ninja wall-climb, back from retirement on ricoRev 2, 1 Nov 2026), Bastion
    // (bastionRev 2, 1 Nov 2026).
    games: ["slice", "flip", "swing", "ricochet", "bastion"],
  },
  {
    id: "strategy",
    label: "Strategy",
    // A blue-leaning violet: clear of Retro's cyan, Sports' green, Cards & Board's pink and Action's red,
    // and of Pattern's purple and Word's blue beside it in the room settings sheet; 6.3:1 on #0B0B0F.
    colour: "#8E80FF",
    glow: false,
    // Tilt, Gemstone, High Rise, Coral Pop, Rainbow Bridge, Ball Tracker (their order in Action).
    games: ["tilt", "matchup", "skyline", "bubble", "inkbridge", "balltrack"],
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
