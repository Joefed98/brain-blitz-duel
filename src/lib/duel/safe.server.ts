/**
 * Server-only generation for Safe Cracker.
 *
 * A combination is drawn first, then four clues it satisfies. The set is kept
 * only when a brute-force sweep of all 10,000 combinations finds exactly one
 * solution AND removing any single clue leaves more than one — so every clue
 * on the card matters.
 */

import { randomBelow, shuffled } from "./random";
import { clueHolds, clueText, safeSolutions, type SafeClue } from "./safe";
import { SAFE_CLUE_COUNT, SAFE_DIALS, type SafePuzzleData } from "./types";

type Candidate = Omit<SafeClue, "text">;

/** Every clue template that is true for this combination. */
function candidatesFor(dials: number[]): SafeClue[] {
  const raw: Candidate[] = [];
  for (let a = 0; a < SAFE_DIALS; a++) {
    raw.push({ kind: "even", a }, { kind: "odd", a }, { kind: "prime", a }, { kind: "square", a });
    for (let b = 0; b < SAFE_DIALS; b++) {
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
    .map((clue) => ({ ...clue, text: clueText(clue) }))
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
