/**
 * Server-only Checkout generator. Every stage's board and target come from the
 * seed; an exhaustive search over every dart sequence proves at least one route
 * exists and stores the fewest darts. Stages 1–2 reject targets with very few
 * routes (keeps them learnable); stages 3–5 reject targets that always taking
 * the biggest dart that fits would finish.
 */
import { numberDepthDealt } from "./numberDepth";
import {
  CHECKOUT_REV,
  CHECKOUT_REV_BIG_FINISH,
  CHECKOUT_STANDARD,
  checkoutBustFreeOrder,
  checkoutBustIndex,
  checkoutDartValue,
  checkoutFinisher,
  checkoutGreedySolves,
  checkoutOptions,
  checkoutValid,
  encodeCheckoutDarts,
  searchCheckout,
  type CheckoutDart,
} from "./checkout";
import type { CheckoutBoardPlan, CheckoutLevelSettings } from "./numberLevels";
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
  bigFinish = false,
): { stage: CheckoutStageData; minDarts: number; route: string } {
  const [lo, hi] = CHECKOUT_TARGETS[index]!;
  for (let attempt = 0; attempt < 400; attempt++) {
    const board = boardFor(rng, index);
    // checkoutRev 2: the board also takes a big finish, in its search, route count and greedy test alike.
    const stage: CheckoutStageData = { ...board, target: rng.int(lo, hi), ...(bigFinish ? { bigFinish: true } : {}) };
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
  // depthRev 1 (numberDepth.ts) deals checkoutRev 2's big finish; a check pinned before it gets rev 1's boards.
  const bigFinish = numberDepthDealt();
  const built = Array.from({ length: 5 }, (_, index) => buildStage(rng, index, bigFinish));
  return {
    type: "checkout",
    checkoutRev: bigFinish ? CHECKOUT_REV_BIG_FINISH : CHECKOUT_REV,
    stages: built.map((b) => b.stage),
    minDarts: built.map((b) => b.minDarts),
    routes: built.map((b) => b.route),
  };
}

/* ------------------------------------------------------------------ levels (stage 3, 15 Nov 2026) */

function wedgesFor(rng: SeededRng, plan: CheckoutBoardPlan): number[] {
  const wedges =
    plan.wedges === "standard"
      ? [...CHECKOUT_STANDARD]
      : plan.wedges === "shuffled"
        ? rng.shuffle(Array.from({ length: 20 }, (_, i) => i + 1))
        : unevenValues(rng);
  if (plan.negatives) {
    const first = rng.below(20);
    let second = rng.below(20);
    while (Math.abs(second - first) <= 1 || Math.abs(second - first) >= 19) second = rng.below(20);
    wedges[first] = -wedges[first]!;
    wedges[second] = -wedges[second]!;
  }
  return wedges;
}

/** Most setup darts the person-like solver weighs at each step (the biggest values that still fit, plus the negatives). */
export const CHECKOUT_PERSON_SETUP = 12;
/** Most dart lists the person-like solver tries on one board before giving up. */
export const CHECKOUT_PERSON_BUDGET = 6000;

/**
 * The person-like solver (Joe's rule: Expert must be humanly possible): a player's checkout-table approach, a bounded
 * search. They look at the darts that can finish (the finishing ring, or a big finish), biggest first, and for each
 * work back what the earlier darts must make, at each dart weighing only the CHECKOUT_PERSON_SETUP biggest values that
 * still fit what is left (and any negative wedge), at most CHECKOUT_PERSON_BUDGET lists in all; a route counts only in
 * an order that never busts. `tries` is how many lists were weighed before the route was found (the fairness kit reads
 * it as thinking time).
 */
export function checkoutPersonFinds(stage: CheckoutStageData): { found: boolean; route: CheckoutDart[] | null; tries: number } {
  const options = checkoutOptions(stage);
  const value = (d: CheckoutDart) => checkoutDartValue(stage, d);
  const finishers = options.filter((d) => checkoutFinisher(stage, d)).sort((a, b) => value(b) - value(a));
  const byValue = [...options].sort((a, b) => value(b) - value(a));
  const negatives = byValue.filter((d) => value(d) < 0);
  const deepest = negatives.length ? -value(negatives[negatives.length - 1]!) : 0;
  /** The darts weighed next: the biggest values up to `cap` (one dart per value), then the negatives. */
  const setupFor = (cap: number, below: number): CheckoutDart[] => {
    const out: CheckoutDart[] = [];
    const seen = new Set<number>();
    for (const d of byValue) {
      const v = value(d);
      if (v <= 0 || v > cap || v > below || seen.has(v)) continue;
      seen.add(v);
      out.push(d);
      if (out.length >= CHECKOUT_PERSON_SETUP) break;
    }
    for (const d of negatives) if (value(d) <= below) out.push(d);
    return out;
  };
  let tries = 0;
  const lengths = stage.exactDarts ? [stage.maxDarts] : Array.from({ length: stage.maxDarts }, (_, i) => i + 1);
  for (const length of lengths)
    for (const fin of finishers) {
      const picked: CheckoutDart[] = [];
      let found: CheckoutDart[] | null = null;
      // Earlier darts in non-increasing value (their order never changes a sum; the throw order is made bust-free).
      const walk = (left: number, rest: number, below: number): void => {
        if (found || tries >= CHECKOUT_PERSON_BUDGET) return;
        if (left === 0) {
          tries++;
          if (rest !== 0) return;
          const route = checkoutBustFreeOrder(stage, [...picked, fin]);
          if (checkoutValid(stage, route, true)) found = route;
          return;
        }
        for (const d of setupFor(rest + deepest * (left - 1), below)) {
          if (found) return;
          picked.push(d);
          walk(left - 1, rest - value(d), value(d));
          picked.pop();
        }
      };
      walk(length - 1, stage.target - value(fin), Number.POSITIVE_INFINITY);
      if (found) return { found: true, route: found, tries };
      if (tries >= CHECKOUT_PERSON_BUDGET) return { found: false, route: null, tries };
    }
  return { found: false, route: null, tries };
}

function buildLevelStage(rng: SeededRng, plan: CheckoutBoardPlan, person: boolean): { stage: CheckoutStageData; minDarts: number; route: string } {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const stage: CheckoutStageData = {
      wedges: wedgesFor(rng, plan),
      target: rng.int(plan.target[0], plan.target[1]),
      maxDarts: plan.maxDarts,
      ...(plan.exact ? { exactDarts: true } : {}),
      finish: plan.finish,
      ...(plan.anyRing ? { anyRing: true } : {}),
      ...(plan.quad ? { quad: true } : {}),
      bigFinish: true,
    };
    const found = searchCheckout(stage);
    if (found.minDarts === null || !found.route) continue;
    if (plan.minRoutes && found.routes < plan.minRoutes) continue;
    if (plan.notGreedy && checkoutGreedySolves(stage)) continue;
    // Proven: a route exists and it can be thrown in an order that never busts.
    const route = checkoutBustFreeOrder(stage, found.route);
    if (checkoutBustIndex(stage, route.slice(0, -1)) >= 0 || !checkoutValid(stage, route, true)) continue;
    if (person && !checkoutPersonFinds(stage).found) continue;
    return { stage, minDarts: found.minDarts, route: encodeCheckoutDarts(found.route) };
  }
  throw new Error("Checkout: no level board found");
}

/** A level's round from the seed (checkoutRev 4): one board per plan, each proven by the exhaustive search. */
export function generateCheckoutLevel(seed: number, settings: CheckoutLevelSettings, rev: number): CheckoutPuzzleData {
  const rng = seededRng((seed ^ 0x636b6c76) >>> 0);
  const built = (settings.boards ?? []).map((plan) => buildLevelStage(rng, plan, settings.person === true));
  return {
    type: "checkout",
    checkoutRev: rev,
    stages: built.map((b) => b.stage),
    minDarts: built.map((b) => b.minDarts),
    routes: built.map((b) => b.route),
  };
}
