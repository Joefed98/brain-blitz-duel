/**
 * Round selection for a room: six different categories, one type from each,
 * shuffled — drawn once, server-side, when the host starts the room.
 *
 * The draw is weighted against what the host's group has just played, so four
 * rooms in a row come close to twenty-four different games.
 */

import { shuffled, weightedPick } from "./random";
import { puzzleCategories, puzzleDef, typesInCategory } from "./registry";
import { TOTAL_ROUNDS, type PuzzleCategory, type PuzzleType } from "./types";

/**
 * How much a category or type is down-weighted by how recently it was seen:
 * the previous room, two rooms ago, three rooms ago.
 */
export const RECENT_WEIGHTS = [0.25, 0.5, 0.75] as const;
/** A type from the previous room is skipped when its category has this many alternatives. */
export const EXCLUDE_MIN_ALTERNATIVES = 3;

/** Round orders of recent rooms, most recent first. */
export type RecentRounds = readonly (readonly PuzzleType[])[];

/** 1.0 unless the value appears in one of the recent rooms. */
function recencyWeight<T>(value: T, seen: readonly (readonly T[])[]): number {
  for (let index = 0; index < seen.length && index < RECENT_WEIGHTS.length; index++) {
    if (seen[index]!.includes(value)) return RECENT_WEIGHTS[index]!;
  }
  return 1;
}

export interface RoundSelectionOptions {
  rounds?: number;
  /** Round orders of the host's last rooms, most recent first. */
  recent?: RecentRounds;
  /** "No maths" is on: the number category is left out of the draw. */
  noMaths?: boolean;
}

/** Draws the room's round order. */
export function pickRoundOrder(options: RoundSelectionOptions = {}): PuzzleType[] {
  const rounds = options.rounds ?? TOTAL_ROUNDS;
  const recent = (options.recent ?? []).slice(0, RECENT_WEIGHTS.length);
  const recentCategories = recent.map((order) =>
    order.map((type) => puzzleDef(type)?.category).filter(Boolean),
  ) as PuzzleCategory[][];

  const pool = puzzleCategories().filter(
    (category) => !(options.noMaths && category === "number"),
  );

  // Six different categories, each weighted by how recently it was played.
  const remaining = shuffled(pool);
  const categories: PuzzleCategory[] = [];
  while (categories.length < rounds && remaining.length > 0) {
    const chosen = weightedPick(remaining, (category) =>
      recencyWeight(category, recentCategories),
    );
    categories.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  const types = categories.map((category) => {
    const all = shuffled(typesInCategory(category));
    const lastRoom = recent[0] ?? [];
    // A type played in the previous room is out — provided enough remain.
    const eligible = all.filter(
      (type) => !(lastRoom.includes(type) && all.length - 1 >= EXCLUDE_MIN_ALTERNATIVES),
    );
    const options_ = eligible.length > 0 ? eligible : all;
    return weightedPick(options_, (type) => recencyWeight(type, recent));
  });

  return shuffled(types);
}
