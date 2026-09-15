import { randInt } from "./random";
import { NUMBER_CLIMB_LENGTH, type NumberClimbPuzzleData } from "./types";

export function buildNumberClimb(): NumberClimbPuzzleData {
  for (let attempt = 0; attempt < 300; attempt++) {
    const digits: number[] = [];
    for (let i = 0; i < NUMBER_CLIMB_LENGTH; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const next = randInt(0, 9);
        if (next === digits[i - 1]) continue;
        const a = digits[i - 2];
        const b = digits[i - 1];
        if (a !== undefined && b !== undefined) {
          if (b === a + 1 && next === b + 1) continue;
          if (b === a - 1 && next === b - 1) continue;
        }
        digits.push(next);
        break;
      }
    }
    if (digits.length !== NUMBER_CLIMB_LENGTH) continue;
    const groups = [0, 3, 6, 9].map((index) => digits.slice(index, index + 3).join(""));
    if (new Set(groups).size === groups.length) {
      const value = digits.join("");
      return { type: "numclimb", digits: value, answerDigits: value };
    }
  }
  return { type: "numclimb", digits: "492715836041", answerDigits: "492715836041" };
}

export function numberClimbSpan(answer: string, expected: string): number {
  const clean = answer.replace(/[^0-9]/g, "").slice(0, NUMBER_CLIMB_LENGTH);
  let span = 0;
  while (span < clean.length && clean[span] === expected[span]) span++;
  return span;
}