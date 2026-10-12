/**
 * Server-only Checkout generator. Every stage's board and target come from the
 * seed; an exhaustive search over every dart sequence proves at least one route
 * exists and stores the fewest darts. Stages 1–2 reject targets with very few
 * routes (keeps them learnable); stages 3–5 reject targets that always taking
 * the biggest dart that fits would finish.
 */
import {
  CHECKOUT_REV,
  CHECKOUT_STANDARD,
  checkoutGreedySolves,
  encodeCheckoutDarts,
  searchCheckout,
} from "./checkout";
import { seededRng, type SeededRng } from "./seededRng";
import type { CheckoutPuzzleData, CheckoutStageData } from "./types";

/** Stages 1–2 need at least this many distinct routes. */
export const CHECKOUT_MIN_ROUTES = 50;

export const CHECKOUT_TARGETS: readonly (readonly [number, number])[] = [
  [40, 100],
  [60, 120],
  [200, 400],
  [200, 400],
  [80, 170],
];

/** 20 distinct, irregularly spaced values from 5 to 60. */
function unevenValues(rng: SeededRng): number[] {
  const pool = rng.shuffle(Array.from({ length: 56 }, (_, i) => i + 5));
  return pool.slice(0, 20);
}

function boardFor(rng: SeededRng, index: number): Omit<CheckoutStageData, "target"> {
  if (index === 0) return { wedges: [...CHECKOUT_STANDARD], maxDarts: 3, finish: 2 };
  if (index === 1)
    return {
      wedges: rng.shuffle(Array.from({ length: 20 }, (_, i) => i + 1)),
      maxDarts: 3,
      finish: 2,
    };
  if (index === 2) return { wedges: unevenValues(rng), maxDarts: 3, finish: 2 };
  if (index === 3) return { wedges: unevenValues(rng), maxDarts: 3, finish: 3, quad: true };
  const wedges = rng.shuffle(Array.from({ length: 20 }, (_, i) => i + 1));
  // Two negative wedges, never next to each other.
  const first = rng.below(20);
  let second = rng.below(20);
  while (Math.abs(second - first) <= 1 || Math.abs(second - first) >= 19) second = rng.below(20);
  wedges[first] = -wedges[first]!;
  wedges[second] = -wedges[second]!;
  return { wedges, maxDarts: 4, exactDarts: true, finish: 2 };
}

function buildStage(
  rng: SeededRng,
  index: number,
): { stage: CheckoutStageData; minDarts: number; route: string } {
  const [lo, hi] = CHECKOUT_TARGETS[index]!;
  for (let attempt = 0; attempt < 400; attempt++) {
    const board = boardFor(rng, index);
    const stage: CheckoutStageData = { ...board, target: rng.int(lo, hi) };
    const found = searchCheckout(stage);
    if (found.minDarts === null || !found.route) continue;
    if (index <= 1 && found.routes < CHECKOUT_MIN_ROUTES) continue;
    if (index >= 2 && checkoutGreedySolves(stage)) continue;
    return { stage, minDarts: found.minDarts, route: encodeCheckoutDarts(found.route) };
  }
  throw new Error(`Checkout: no stage ${index + 1} board found`);
}

export function generateCheckout(seed: number): CheckoutPuzzleData {
  const rng = seededRng(seed);
  const built = Array.from({ length: 5 }, (_, index) => buildStage(rng, index));
  return {
    type: "checkout",
    checkoutRev: CHECKOUT_REV,
    stages: built.map((b) => b.stage),
    minDarts: built.map((b) => b.minDarts),
    routes: built.map((b) => b.route),
  };
}
