import { randInt, randomBelow, shuffled } from "./random";
import { BAL_PEGS, scaleSolved, type Placement } from "./balance";
import { countValidPaths, initSumHunt } from "./sumHunt";
import type { BalancePuzzleData, BalanceScale, SumHuntPuzzleData } from "./types";

export function generateSumHunt(): SumHuntPuzzleData {
  for (let attempt = 0; attempt < 200; attempt++) {
    const seed = randInt(1, 2_000_000_000);
    const target = 10;
    if (countValidPaths(initSumHunt(seed, target).board, target, 3) >= 3) {
      return { type: "sumhunt", seed, target };
    }
  }
  return { type: "sumhunt", seed: 12345, target: 10 };
}

/** Every placement of the tray onto empty pegs; true if any balances. */
function anyBalanced(scale: BalanceScale): boolean {
  const free = Array.from({ length: BAL_PEGS }, (_, p) => p).filter((p) => !scale.fixed.some((f) => f.peg === p));
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

function buildScale(loose: number, fixedCount: number): { scale: BalanceScale; solution: number[] } {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const pegs = shuffled(Array.from({ length: BAL_PEGS }, (_, p) => p)).slice(0, loose + fixedCount);
    const fixed = pegs.slice(0, fixedCount).map((peg) => ({ peg, w: randInt(1, 9) }));
    const solution = pegs.slice(fixedCount);
    const tray = solution.map(() => randInt(1, 9));
    const scale: BalanceScale = { fixed, tray };
    if (!scaleSolved(scale, solution)) continue;
    // The loose weights must not already sit on one side only trivially: require both sides used.
    const sides = new Set([...pegs].map((p) => p < 4));
    if (sides.size < 2 || !anyBalanced(scale)) continue;
    // Shuffle the tray order so the solution isn't the tray order.
    const order = shuffled(tray.map((_, i) => i));
    return {
      scale: { fixed, tray: order.map((i) => tray[i]!) },
      solution: order.map((i) => solution[i]!),
    };
  }
  return {
    scale: { fixed: [{ peg: 1, w: 2 }], tray: [1, 4 + randomBelow(1)] },
    solution: [5, 4],
  };
}

export function generateBalance(): BalancePuzzleData {
  const built = [buildScale(2, 1), buildScale(3, 2), buildScale(4, 3)];
  return { type: "balance", scales: built.map((b) => b.scale), solutions: built.map((b) => b.solution) };
}
