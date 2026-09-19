/**
 * Round selection for a room.
 *
 * Categories split into a CORE pool that is always drawn from and an OPT-IN
 * pool (number, memory) the host switches on in the lobby. Retired types are
 * never drawn. A room's six rounds are always six different types.
 *
 * The draw is weighted against what the host's group has just played, so four
 * rooms in a row come close to twenty-four different games.
 */

import { shuffled, weightedPick } from "./random";
import {
  CORE_CATEGORIES,
  CORE_SIXTH_WEIGHTS,
  puzzleDef,
  typesInCategory,
} from "./registry";
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
  /** Host opt-in: the number category joins the pool. */
  addMaths?: boolean;
  /** Host opt-in: the memory category joins the pool. */
  addMemory?: boolean;
}

/** One type from a category, avoiding types already drawn and recent rooms. */
function pickType(
  category: PuzzleCategory,
  taken: readonly PuzzleType[],
  recent: RecentRounds,
): PuzzleType | null {
  const all = shuffled(typesInCategory(category)).filter((type) => !taken.includes(type));
  if (all.length === 0) return null;
  const lastRoom = recent[0] ?? [];
  // A type played in the previous room is out — provided enough remain.
  const eligible = all.filter(
    (type) => !(lastRoom.includes(type) && all.length - 1 >= EXCLUDE_MIN_ALTERNATIVES),
  );
  const options = eligible.length > 0 ? eligible : all;
  return weightedPick(options, (type) => recencyWeight(type, recent));
}

/** Draws the room's round order. */
export function pickRoundOrder(options: RoundSelectionOptions = {}): PuzzleType[] {
  const rounds = options.rounds ?? TOTAL_ROUNDS;
  const recent = (options.recent ?? []).slice(0, RECENT_WEIGHTS.length);
  const recentCategories = recent.map((order) =>
    order.map((type) => puzzleDef(type)?.category).filter(Boolean),
  ) as PuzzleCategory[][];

  const optIns: PuzzleCategory[] = [
    ...(options.addMaths ? (["number"] as const) : []),
    ...(options.addMemory ? (["memory"] as const) : []),
  ];
  const pool = [...CORE_CATEGORIES, ...optIns].filter(
    (category) => typesInCategory(category).length > 0,
  );

  // As many different categories as the pool allows, weighted by recency.
  const remaining = shuffled(pool);
  const categories: PuzzleCategory[] = [];
  while (categories.length < rounds && remaining.length > 0) {
    const chosen = weightedPick(remaining, (category) =>
      recencyWeight(category, recentCategories),
    );
    categories.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  const types: PuzzleType[] = [];
  for (const category of categories) {
    const type = pickType(category, types, recent);
    if (type) types.push(type);
  }

  // Not enough categories to fill the room (no opt-ins): the remaining rounds
  // come from core categories weighted toward logic and pattern.
  while (types.length < rounds) {
    const candidates = CORE_CATEGORIES.filter((category) =>
      typesInCategory(category).some((type) => !types.includes(type)),
    );
    if (candidates.length === 0) break;
    const category = weightedPick(
      candidates,
      (c) => (CORE_SIXTH_WEIGHTS[c] ?? 0.05) * recencyWeight(c, recentCategories),
    );
    const type = pickType(category, types, recent);
    if (!type) break;
    types.push(type);
  }

  return shuffled(types);
}
