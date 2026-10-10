/**
 * Round selection for a room.
 *
 * Categories are host-selected in the lobby. Retired types are never drawn.
 * A room plays one round per selected category, in a seeded random order.
 *
 * The draw is weighted against what the host's group has just played, so four
 * rooms in a row come close to twenty-four different games.
 */

import { randomBelow, shuffled, weightedPick } from "./random";
import { typesInCategory } from "./registry";
import type { PuzzleCategory, PuzzleType } from "./types";
import { normaliseCategories } from "./categories";

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
  categories?: readonly PuzzleCategory[];
  /** Round orders of the host's last rooms, most recent first. */
  recent?: RecentRounds;
  /** Room seed for the category order; drawn fresh when omitted. */
  seed?: number;
}

/** Room seeds are 31-bit non-negative integers. */
export function newRoomSeed(): number {
  return randomBelow(0x8000_0000);
}

/** mulberry32: a small, well-mixed PRNG for the seeded category order. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/**
 * The room's category order: one round per selected category, as a uniform
 * Fisher–Yates permutation driven only by the room seed. Every order is
 * equally likely and any category (arcade included) can open the room.
 */
export function categoryOrderFor(
  categories: readonly PuzzleCategory[],
  seed: number,
): PuzzleCategory[] {
  const order = normaliseCategories(categories).filter(
    (category) => typesInCategory(category).length > 0,
  );
  const rng = seededRng(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
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

/** Draws the room's round order: exactly one game from each selected category. */
export function pickRoundOrder(options: RoundSelectionOptions = {}): PuzzleType[] {
  const recent = (options.recent ?? []).slice(0, RECENT_WEIGHTS.length);
  const order = categoryOrderFor(options.categories ?? [], options.seed ?? newRoomSeed());
  const types: PuzzleType[] = [];
  for (const category of order) {
    const type = pickType(category, types, recent);
    if (type) types.push(type);
  }
  return types;
}
