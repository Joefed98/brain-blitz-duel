/**
 * Round selection for a room.
 *
 * Categories are host-selected in the lobby. Retired types are never drawn.
 * A room plays 6 rounds (7 with all seven categories) shared between the
 * selected categories, in a seeded order with no category twice in a row.
 * Arcade-only rooms play ARCADE_ONLY_ROUNDS different arcade games instead.
 *
 * The draw is weighted against what the host's group has just played, so four
 * rooms in a row come close to twenty-four different games.
 */

import { randomBelow, shuffled, weightedPick, withSeededRandom } from "./random";
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

/** Rounds in a room: 6, or 7 when all seven categories are selected. */
export function roundCountFor(categoryCount: number): number {
  if (categoryCount <= 0) return 0;
  return categoryCount >= 7 ? 7 : 6;
}

/** An arcade-only room plays this many different arcade games. */
export const ARCADE_ONLY_ROUNDS = 5;
/** Keeps the arcade-only game draw independent of the category-order stream. */
const ARCADE_DRAW_SALT = 0x5a17_c0de;

/** True when Arcade is the only selected category with games. */
export function isArcadeOnly(categories: readonly PuzzleCategory[]): boolean {
  const chosen = playableCategories(categories);
  return chosen.length === 1 && chosen[0] === "arcade";
}

function playableCategories(categories: readonly PuzzleCategory[]): PuzzleCategory[] {
  return normaliseCategories(categories).filter((category) => typesInCategory(category).length > 0);
}

/**
 * Rounds a room with these categories will play: the lobby and the draw both
 * read this, so the count shown before Start is the count dealt.
 */
export function roomRoundCount(categories: readonly PuzzleCategory[]): number {
  if (isArcadeOnly(categories)) return Math.min(ARCADE_ONLY_ROUNDS, typesInCategory("arcade").length);
  return roundCountFor(playableCategories(categories).length);
}

/** True when no two neighbouring rounds share a category. */
function noAdjacentRepeats(order: readonly PuzzleCategory[]): boolean {
  for (let i = 1; i < order.length; i++) if (order[i] === order[i - 1]) return false;
  return true;
}

/**
 * The room's category order, driven only by the room seed.
 * Shares the rounds out (6 per room, 7 with all seven categories; 4 categories
 * get two extras on two different random categories, 5 get one random extra),
 * then shuffles with Fisher–Yates until no category plays twice in a row —
 * uniform over all valid orders. One-category rooms repeat that category.
 */
export function categoryOrderFor(
  categories: readonly PuzzleCategory[],
  seed: number,
): PuzzleCategory[] {
  const chosen = playableCategories(categories);
  const n = chosen.length;
  if (n === 0) return [];
  const rng = seededRng(seed);
  const total = roomRoundCount(chosen);
  const base = Math.floor(total / n);
  const pool: PuzzleCategory[] = [];
  for (const category of chosen) for (let k = 0; k < base; k++) pool.push(category);
  // Extras go to distinct categories, each equally likely.
  const remaining = [...chosen];
  for (let extra = total - base * n; extra > 0; extra--) {
    const index = Math.floor(rng() * remaining.length);
    pool.push(remaining.splice(index, 1)[0]!);
  }
  if (n === 1) return pool;
  for (;;) {
    const order = [...pool];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (noAdjacentRepeats(order)) return order;
  }
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

/** Draws the room's round order; no game repeats within a room. */
export function pickRoundOrder(options: RoundSelectionOptions = {}): PuzzleType[] {
  const recent = (options.recent ?? []).slice(0, RECENT_WEIGHTS.length);
  const seed = options.seed ?? newRoomSeed();
  const order = categoryOrderFor(options.categories ?? [], seed);
  const draw = () => {
    const types: PuzzleType[] = [];
    for (const category of order) {
      const type = pickType(category, types, recent);
      if (type) types.push(type);
    }
    return types;
  };
  // Arcade-only rooms draw their games from the room seed too, so the whole
  // order is fixed by it; other rooms keep their unseeded per-category draw.
  return isArcadeOnly(options.categories ?? []) ? withSeededRandom(seed ^ ARCADE_DRAW_SALT, draw) : draw();
}

