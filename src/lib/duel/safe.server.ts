/**
 * Server-only generation for Safe Cracker.
 *
 * A combination is drawn first, then four clues it satisfies. The set is kept
 * only when a brute-force sweep of all 10,000 combinations finds exactly one
 * solution AND removing any single clue leaves more than one — so every clue
 * on the card matters.
 */

import { randomBelow, shuffled } from "./random";
import { clueHolds, clueText, safeSolutions, SAFE_SHAPE_TODAY, type SafeClue, type SafeShape } from "./safe";
import type { SafeLevel } from "./logicLevels";
import { SAFE_CLUE_COUNT, SAFE_DIALS, type SafePuzzleData } from "./types";

type Candidate = Omit<SafeClue, "text">;

/** Every clue template that is true for this combination. */
function candidatesFor(dials: number[], shape: SafeShape = SAFE_SHAPE_TODAY): SafeClue[] {
  const raw: Candidate[] = [];
  for (let a = 0; a < shape.dials; a++) {
    raw.push({ kind: "even", a }, { kind: "odd", a }, { kind: "prime", a }, { kind: "square", a });
    for (let b = 0; b < shape.dials; b++) {
      if (a === b) continue;
      raw.push({ kind: "greater", a, b }, { kind: "less", a, b });
      raw.push({ kind: "diff2", a, b, value: dials[a]! - dials[b]! });
      if (dials[a]! > 0) raw.push({ kind: "double", a, b });
      if (a < b) {
        raw.push({ kind: "sum2", a, b, value: dials[a]! + dials[b]! });
        raw.push({ kind: "differby", a, b, value: Math.abs(dials[a]! - dials[b]!) });
      }
    }
  }
  raw.push({ kind: "alldiff" });
  raw.push({ kind: "sumall", value: dials.reduce((sum, digit) => sum + digit, 0) });

  const clues = raw
    .map((clue) => ({ ...clue, text: clueText(clue, shape) }))
    .filter((clue) => clueHolds(clue, dials))
    // Trivial clues make for a dull card: "differ by exactly 0" and "− 0".
    .filter((clue) => !((clue.kind === "differby" || clue.kind === "diff2") && clue.value === 0));

  const unique = new Map<string, SafeClue>();
  for (const clue of clues) if (!unique.has(clue.text)) unique.set(clue.text, clue);
  return [...unique.values()];
}

export function generateSafe(): SafePuzzleData {
  for (let attempt = 0; attempt < 4000; attempt++) {
    const combination = Array.from({ length: SAFE_DIALS }, () => randomBelow(10));
    const pool = shuffled(candidatesFor(combination));
    if (pool.length < SAFE_CLUE_COUNT) continue;

    const clues = pool.slice(0, SAFE_CLUE_COUNT);
    // Exactly one combination may satisfy the whole card.
    if (safeSolutions(clues, 2).length !== 1) continue;

    // And every clue must pull its weight: drop one, and the answer stops being unique.
    const necessary = clues.every(
      (_, index) =>
        safeSolutions(
          clues.filter((__, other) => other !== index),
          2,
        ).length > 1,
    );
    if (!necessary) continue;

    return { type: "safe", clues, combination };
  }
  throw new Error("Safe Cracker generator could not build a uniquely solvable card");
}

/** The kinds an Easy card uses: parity, order and a pair's sum (no primes, squares or differences). */
const SIMPLE_KINDS = new Set<SafeClue["kind"]>(["even", "odd", "greater", "less", "sum2"]);
/** Hard and Expert weight their cards towards these (each listed twice in the draw's pool). */
const NUMBER_KINDS = new Set<SafeClue["kind"]>(["prime", "square", "differby", "diff2", "alldiff"]);

/**
 * A level's card (the Logic overhaul's levels, logicLevels.ts): the level's dials, range and clue count, from the
 * level's kinds; kept only when the search finds exactly one combination and every clue is needed (dropping any one
 * allows a second). The shape rides on the puzzle (`dialCount`, `dialMax`, `tries`, `timeLimitMs`).
 */
export function generateSafeLevel(level: SafeLevel): SafePuzzleData {
  const shape: SafeShape = { dials: level.dials, max: level.max, tries: level.tries };
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const combination = Array.from({ length: shape.dials }, () => randomBelow(shape.max + 1));
    let pool = candidatesFor(combination, shape);
    if (level.kinds === "simple") pool = pool.filter((c) => SIMPLE_KINDS.has(c.kind));
    else pool = [...pool, ...pool.filter((c) => NUMBER_KINDS.has(c.kind))];
    pool = shuffled(pool);
    const clues: SafeClue[] = [];
    for (const clue of pool) {
      if (clues.length >= level.clues) break;
      if (!clues.some((c) => c.text === clue.text)) clues.push(clue);
    }
    if (clues.length < level.clues) continue;
    if (safeSolutions(clues, 2, shape).length !== 1) continue;
    const necessary = clues.every((_, index) => safeSolutions(clues.filter((__, other) => other !== index), 2, shape).length > 1);
    if (!necessary) continue;
    return { type: "safe", clues, combination, dialCount: shape.dials, dialMax: shape.max, tries: shape.tries, timeLimitMs: level.timeMs };
  }
  throw new Error("Safe Cracker generator could not build a uniquely solvable card for the level");
}
