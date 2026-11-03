/**
 * Games in two categories (3 Nov 2026): a game has one *main* category (its registry `category`, and for an
 * arcade game its group in arcadeGroups.ts), which decides every count, colour and tile border, and may be
 * listed *also in* one more room pick (a puzzle category or an arcade group). "Also in" does two things only:
 *
 *  - Practice lists the game in that pick's section too (on the other side of the Puzzles | Arcade switch when
 *    the pick is there); the side counts, Recently played and the tile stay on its main category.
 *  - A room whose picks include that pick deals it from that pick's pool, but only when the room did not also
 *    pick its main category: a room with both counts the game once, under its main category (Mixed holds Speed,
 *    so Pull! is a Speed game there). Either way a room never deals the same game twice (roomDeal.ts).
 *
 * The daily, challenges, legacy rooms (selection.ts `pickRoundOrder`) and scoring never read this.
 *
 * The first and only crossover: Pull! (`clayshoot`, Speed) is also in the Sports arcade group.
 */
import type { ArcadeGroup } from "./arcadeGroups";
import { PUZZLE_REGISTRY, isRetired } from "./registry";
import type { PuzzleCategory, PuzzleType } from "./types";

/** A room pick or Practice section: a puzzle category (not Arcade) or an arcade group. */
export type AlsoInPick = Exclude<PuzzleCategory, "arcade"> | ArcadeGroup;

/** Registry id → the one other pick it is listed in. */
export const ALSO_IN: Readonly<Partial<Record<PuzzleType, AlsoInPick>>> = {
  clayshoot: "sports",
};

/** The extra pick a game is listed in, or null. */
export function alsoInOf(type: string): AlsoInPick | null {
  return ALSO_IN[type as PuzzleType] ?? null;
}

/** The active (registered, not retired) games listed also in this pick, in ALSO_IN order. */
export function typesAlsoIn(pick: AlsoInPick): PuzzleType[] {
  return (Object.keys(ALSO_IN) as PuzzleType[]).filter(
    (t) => ALSO_IN[t] === pick && Object.prototype.hasOwnProperty.call(PUZZLE_REGISTRY, t) && !isRetired(t),
  );
}
