/**
 * Counterweight's level deals (balanceLevels.ts): Normal, Easy and Expert on balanceRev 5; Hard is today's
 * generateBalance exactly. Server only.
 *
 * Every scale is built from the room seed's Math.random (as today's), proved balanced, both sides used, and (where the
 * level asks) with exactly one balanced arrangement (balancedArrangements, an exhaustive search). Expert keeps only
 * scales a person-like solver (`personSolveScale`) balances within its budget of trial hangs, so every Expert board can
 * be worked out from the screen without the readout.
 */
import { BAL_LEVELS_EASY_PEGS, BAL_PEGS, BAL_REV2_TIME_MS, BAL_REV2_WIDE_PEGS, pegDistance, pegIsLeft, scalePegs, scaleSolved } from "./balance";
import { BALANCE_NORMAL, BALANCE_REV_LEVELS, type BalanceLevelScale, type BalanceLevelSettings } from "./balanceLevels";
import { balancedArrangements, generateBalance } from "./numberRounds.server";
import { randInt, shuffled } from "./random";
import type { BalancePuzzleData, BalanceScale } from "./types";

/** Trial hangs the person-like solver may spend on one scale (Expert keeps only scales it balances within this). */
export const BALANCE_PERSON_BUDGET = 40;

/**
 * A person-like solver for one scale, seeing only what the screen shows on Expert (the fixed weights, the tray, the
 * notch distances; no readout): it hangs the heaviest weight first, tries notches in the order that brings the beam
 * closest to level, and drops a line of thought as soon as the weights left could not make up the difference even at
 * the far notches (a sum a person does in their head). Each weight hung is one trial; it gives up past `budget`.
 * Returns the trials it used, or null when it did not balance the scale within the budget.
 */
export function personSolveScale(scale: BalanceScale, budget = BALANCE_PERSON_BUDGET): number | null {
  const pegs = scalePegs(scale);
  const free = Array.from({ length: pegs }, (_, p) => p).filter((p) => !scale.fixed.some((f) => f.peg === p));
  const order = scale.tray.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w || a.i - b.i);
  const maxDist = pegs / 2;
  let diff = 0; // right − left
  for (const f of scale.fixed) diff += (pegIsLeft(f.peg, pegs) ? -1 : 1) * f.w * pegDistance(f.peg, pegs);
  const used = new Set<number>();
  let trials = 0;
  const go = (k: number, d: number): boolean => {
    if (k === order.length) return d === 0;
    const rest = order.slice(k).reduce((s, x) => s + x.w, 0);
    if (Math.abs(d) > rest * maxDist) return false;
    const w = order[k]!.w;
    const options = free
      .filter((p) => !used.has(p))
      .map((p) => ({ p, next: d + (pegIsLeft(p, pegs) ? -1 : 1) * w * pegDistance(p, pegs) }))
      .sort((a, b) => Math.abs(a.next) - Math.abs(b.next) || a.p - b.p);
    for (const { p, next } of options) {
      if (trials >= budget) return false;
      trials++;
      used.add(p);
      if (go(k + 1, next)) return true;
      used.delete(p);
    }
    return false;
  };
  return go(0, diff) ? trials : null;
}

export function buildLevelScale(spec: BalanceLevelScale, person: boolean): { scale: BalanceScale; solution: number[] } | null {
  const notches = spec.pegs;
  const own = notches === BAL_PEGS ? {} : { pegs: notches };
  const maxW = spec.maxW ?? 9;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const pegs = shuffled(Array.from({ length: notches }, (_, p) => p)).slice(0, spec.loose + spec.fixed);
    const fixed = pegs.slice(0, spec.fixed).map((peg) => ({ peg, w: randInt(1, maxW) }));
    const solution = pegs.slice(spec.fixed);
    const tray = solution.map(() => randInt(1, maxW));
    const scale: BalanceScale = { fixed, tray, ...own };
    if (!scaleSolved(scale, solution)) continue;
    const sides = new Set(pegs.map((p) => p < notches / 2));
    if (sides.size < 2) continue;
    if (spec.unique && balancedArrangements(scale) !== 1) continue;
    const order = shuffled(tray.map((_, i) => i));
    const dealt: BalanceScale = { fixed, tray: order.map((i) => tray[i]!), ...own };
    if (person && personSolveScale(dealt) === null) continue;
    return { scale: dealt, solution: order.map((i) => solution[i]!) };
  }
  return null;
}

/** The level's settings: Normal's own, or the registry entry's (gameLevelSettings). */
export function generateBalanceLevel(settings: BalanceLevelSettings | null): BalancePuzzleData {
  const use = settings ?? BALANCE_NORMAL;
  if (use.today) return generateBalance();
  const specs = use.scales ?? BALANCE_NORMAL.scales!;
  const spare = use.spare ?? BALANCE_NORMAL.spare!;
  for (let attempt = 0; attempt < 200; attempt++) {
    const built = specs.map((spec) => buildLevelScale(spec, use.hide === true || use.person === true));
    if (built.some((b) => b === null)) continue;
    const scales = built.map((b) => b!.scale);
    return {
      type: "balance",
      scales,
      solutions: built.map((b) => b!.solution),
      timeLimitMs: BAL_REV2_TIME_MS,
      balanceRev: BALANCE_REV_LEVELS,
      placeLimits: scales.map((scale, i) => scale.tray.length + (spare[i] ?? spare[spare.length - 1]!)),
      ...(use.hide ? { hideBalance: true } : {}),
      ...(use.fullByS ? { speedFullByS: use.fullByS } : {}),
    };
  }
  throw new Error("Counterweight: no level board found");
}

/** Notch counts a level scale may have (6, 8 or 10). */
export const BALANCE_LEVEL_NOTCHES = [BAL_LEVELS_EASY_PEGS, BAL_PEGS, BAL_REV2_WIDE_PEGS] as const;
