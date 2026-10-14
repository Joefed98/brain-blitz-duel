import { randInt, randomBelow, shuffled } from "./random";
import { BAL_PEGS, BAL_REV2_TIME_MS, BAL_REV2_WIDE_PEGS, scalePegs, scaleSolved, type Placement } from "./balance";
import { countValidPaths, initSumHunt, sumHuntTargets } from "./sumHunt";
import type { BalancePuzzleData, BalanceScale, SumHuntPuzzleData } from "./types";

export function generateSumHunt(): SumHuntPuzzleData {
  for (let attempt = 0; attempt < 20; attempt++) {
    const seed = randInt(1, 2_000_000_000);
    const target = sumHuntTargets(seed)[0]!;
    const paths = countValidPaths(initSumHunt(seed, target).board, target, 4);
    if (paths >= 1 && paths <= 3) {
      return { type: "sumhunt", seed, target };
    }
  }
  return { type: "sumhunt", seed: 12345, target: sumHuntTargets(12345)[0]! };
}

/** Every placement of the tray onto empty pegs; true if any balances. */
function anyBalanced(scale: BalanceScale): boolean {
  const free = Array.from({ length: scalePegs(scale) }, (_, p) => p).filter((p) => !scale.fixed.some((f) => f.peg === p));
  const placement: Placement = scale.tray.map(() => null);
  const used = new Set<number>();
  const go = (i: number): boolean => {
    if (i === scale.tray.length) return scaleSolved(scale, placement);
    for (const peg of free) {
      if (used.has(peg)) continue;
      used.add(peg);
      placement[i] = peg;
      if (go(i + 1)) return true;
      used.delete(peg);
    }
    placement[i] = null;
    return false;
  };
  return go(0);
}

/**
 * Distinct balanced arrangements of the tray (equal weights swapped count once).
 * Counterweight balanceRev 1 (13 Oct 2026) keeps only small scales with exactly
 * one, so hanging weights at random rarely balances them.
 */
export function balancedArrangements(scale: BalanceScale): number {
  const free = Array.from({ length: scalePegs(scale) }, (_, p) => p).filter((p) => !scale.fixed.some((f) => f.peg === p));
  const placement: Placement = scale.tray.map(() => null);
  const used = new Set<number>();
  const seen = new Set<string>();
  const go = (i: number) => {
    if (i === scale.tray.length) {
      if (scaleSolved(scale, placement)) seen.add(placement.map((peg, k) => `${peg}:${scale.tray[k]}`).sort().join(","));
      return;
    }
    for (const peg of free) {
      if (used.has(peg)) continue;
      used.add(peg);
      placement[i] = peg;
      go(i + 1);
      used.delete(peg);
    }
    placement[i] = null;
  };
  go(0);
  return seen.size;
}

function buildScale(loose: number, fixedCount: number, unique = false, notches = BAL_PEGS): { scale: BalanceScale; solution: number[] } {
  // Only a 10-notch scale stores its notch count; every 8-notch scale stays byte-for-byte as before.
  const wide = notches === BAL_REV2_WIDE_PEGS ? { pegs: BAL_REV2_WIDE_PEGS } : {};
  for (let attempt = 0; attempt < 20000; attempt++) {
    const pegs = shuffled(Array.from({ length: notches }, (_, p) => p)).slice(0, loose + fixedCount);
    const fixed = pegs.slice(0, fixedCount).map((peg) => ({ peg, w: randInt(1, 9) }));
    const solution = pegs.slice(fixedCount);
    const tray = solution.map(() => randInt(1, 9));
    const scale: BalanceScale = { fixed, tray, ...wide };
    if (!scaleSolved(scale, solution)) continue;
    // The loose weights must not already sit on one side only trivially: require both sides used.
    const sides = new Set([...pegs].map((p) => p < notches / 2));
    if (sides.size < 2 || !anyBalanced(scale)) continue;
    if (unique && balancedArrangements(scale) !== 1) continue;
    // Shuffle the tray order so the solution isn't the tray order.
    const order = shuffled(tray.map((_, i) => i));
    return {
      scale: { fixed, tray: order.map((i) => tray[i]!), ...wide },
      solution: order.map((i) => solution[i]!),
    };
  }
  return {
    scale: { fixed: [{ peg: 1, w: 2 }], tray: [1, 4 + randomBelow(1)] },
    solution: [5, 4],
  };
}

/**
 * Counterweight. The two small scales have exactly one balanced arrangement; balanceRev 2 (14 Oct 2026)
 * adds a fourth, wider scale: 10 notches, three fixed weights and five to hang, with 120 s for the round.
 * The rev and hang limits are stamped by moveLimits.server.ts.
 */
export function generateBalance(): BalancePuzzleData {
  const built = [buildScale(2, 1, true), buildScale(3, 2, true), buildScale(4, 3), buildScale(5, 3, false, BAL_REV2_WIDE_PEGS)];
  return {
    type: "balance",
    scales: built.map((b) => b.scale),
    solutions: built.map((b) => b.solution),
    timeLimitMs: BAL_REV2_TIME_MS,
  };
}
