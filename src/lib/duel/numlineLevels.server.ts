/**
 * Server-only: Ballpark's levels (Number overhaul stage 3, 15 Nov 2026; docs/number-overhaul.md "Stage 3"). Normal is
 * today's game (numline.server.ts `generateNumline`, untouched); Easy, Hard and Expert deal their own three lines of
 * five numbers each, on the same rules, clock and scoring (every placement scores by its distance), so the grader and
 * stage need nothing new but Expert's hidden end label (`hideEnd` on a line, numline.ts `numlineHiddenEnd`).
 *
 * Settings (gameLevels.ts `numline`): `lines`, three line ids from LINES below, in play order ("today-third" is today's
 * third line, −50 to 50 or 0 to 1,000 from the seed); `hideEnd`, Expert's top end label hidden until half the line's
 * numbers are placed. Deterministic from the seed.
 */
import {
  bigProductItem,
  decimalItem,
  fill,
  fractionItem,
  gcd,
  MINUS,
  mixedLargeItem,
  mixedSymmetricItem,
  negativeItem,
  percentItem,
  percentOfItem,
  powerItem,
  productItem,
  rational,
  rootItem,
  squareItem,
  divisionItem,
  sup,
  type Item,
  type Maker,
} from "./numline.server";
import { NUMLINE_REV, NUMLINE_REV2_TIME_MS } from "./numline";
import { seededRng, type SeededRng } from "./seededRng";
import type { NumlinePuzzleData, NumlineStageData, NumlineValue } from "./types";

export type NumlineLineId =
  | "easy-10"
  | "easy-100"
  | "easy-1"
  | "hard-1"
  | "hard-sym-100"
  | "hard-1000"
  | "today-1"
  | "today-100"
  | "today-third"
  | "expert-10000";

export interface NumlineLevelSettings {
  lines: readonly NumlineLineId[];
  hideEnd?: boolean;
}

const thousands = (n: number) => n.toLocaleString("en-GB");

/* ------------------------------------------------------------------ Easy */

function wholeTen(rng: SeededRng): Item {
  const n = rng.int(1, 9);
  return { text: String(n), value: rational(n) };
}

function halfTen(rng: SeededRng): Item {
  const n = rng.int(0, 9);
  return { text: `${n}.5`, value: rational(2 * n + 1, 2) };
}

function sumTen(rng: SeededRng): Item {
  const a = rng.int(1, 6);
  const b = rng.int(1, 9 - a);
  return { text: `${a} + ${b}`, value: rational(a + b) };
}

function wholeHundred(rng: SeededRng): Item {
  const n = rng.int(4, 96);
  return { text: String(n), value: rational(n) };
}

function tensSum(rng: SeededRng): Item {
  const a = 10 * rng.int(1, 7);
  const b = rng.int(2, 25);
  return { text: `${a} + ${b}`, value: rational(a + b) };
}

function halfOf(rng: SeededRng): Item {
  const of = 2 * rng.int(4, 49);
  return { text: `half of ${of}`, value: rational(of / 2) };
}

function simpleFraction(rng: SeededRng): Item {
  const [num, den] = rng.pick([
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
  ] as const);
  return { text: `${num}/${den}`, value: rational(num, den) };
}

function tenthsDecimal(rng: SeededRng): Item {
  const n = rng.int(1, 9);
  return { text: `0.${n}`, value: rational(n, 10) };
}

function tensPercent(rng: SeededRng): Item {
  const n = 10 * rng.int(1, 9);
  return { text: `${n}%`, value: rational(n, 100) };
}

/* ------------------------------------------------------------------ Hard */

function hardFraction(rng: SeededRng): Item {
  for (;;) {
    const den = rng.int(11, 19);
    const num = rng.int(1, den - 1);
    if (gcd(num, den) !== 1) continue;
    return { text: `${num}/${den}`, value: rational(num, den) };
  }
}

function thousandthsDecimal(rng: SeededRng): Item {
  const n = rng.int(20, 980);
  if (n % 10 === 0) return thousandthsDecimal(rng);
  return { text: `0.${String(n).padStart(3, "0")}`, value: rational(n, 1000) };
}

function fractionOfFraction(rng: SeededRng): Item {
  const a = rng.pick([2, 3, 4, 5] as const);
  const pick = rng.pick([3, 4, 5, 6, 7, 8] as const);
  const b = pick === a ? pick + 1 : pick;
  const top = rng.int(1, a - 1) || 1;
  return { text: `${top}/${a} of 1/${b}`, value: rational(top, a * b) };
}

function hardNegative(rng: SeededRng): Item {
  switch (rng.below(3)) {
    case 0: {
      const a = rng.int(3, 12);
      const b = rng.int(3, 9);
      return { text: `${MINUS}${a} × ${b}`, value: rational(-a * b) };
    }
    case 1: {
      const a = rng.int(10, 40);
      const b = rng.int(4, 12);
      const c = rng.int(4, 11);
      return { text: `${a} ${MINUS} ${b} × ${c}`, value: rational(a - b * c) };
    }
    default: {
      const den = rng.pick([3, 4, 5, 6, 7, 8]);
      let num = rng.int(1, den - 1);
      while (gcd(num, den) !== 1) num = rng.int(1, den - 1);
      const of = den * rng.int(6, 20);
      return { text: `${MINUS}${num}/${den} of ${of}`, value: rational(-num * of, den) };
    }
  }
}

function symmetricPower(rng: SeededRng): Item {
  const [base, exp] = rng.pick([
    [2, 5],
    [2, 6],
    [3, 3],
    [3, 4],
    [4, 3],
    [9, 2],
    [7, 2],
    [8, 2],
  ] as const);
  const negative = rng.below(2) === 0;
  const odd = exp % 2 === 1;
  if (!negative) return { text: `${base}${sup(exp)}`, value: rational(base ** exp) };
  return odd
    ? { text: `(${MINUS}${base})${sup(exp)}`, value: rational(-(base ** exp)) }
    : { text: `${MINUS}${base}${sup(exp)}`, value: rational(-(base ** exp)) };
}

function symmetricRoot(rng: SeededRng): Item {
  for (;;) {
    const n = rng.int(20, 9900);
    if (Number.isInteger(Math.sqrt(n))) continue;
    const negative = rng.below(2) === 0;
    return { text: `${negative ? MINUS : ""}√${thousands(n)}`, value: { num: 0, den: 1, rootCoef: negative ? -1 : 1, root: n } };
  }
}

function hardFractionOfThousand(rng: SeededRng): Item {
  for (;;) {
    const den = rng.pick([7, 11, 13, 17, 19]);
    const num = rng.int(1, den - 1);
    if (gcd(num, den) !== 1) continue;
    return { text: `${num}/${den} of 1,000`, value: rational(num * 1000, den) };
  }
}

/* ------------------------------------------------------------------ Expert's 0 to 10,000 */

function hugeProduct(rng: SeededRng): Item {
  const a = rng.int(23, 99);
  const b = rng.int(23, 99);
  return { text: `${a} × ${b}`, value: rational(a * b) };
}

function hugePower(rng: SeededRng): Item {
  const [base, exp] = rng.pick([
    [2, 10],
    [2, 11],
    [2, 12],
    [2, 13],
    [3, 7],
    [3, 8],
    [4, 5],
    [4, 6],
    [5, 5],
    [6, 5],
    [7, 4],
    [8, 4],
    [9, 4],
    [12, 3],
    [15, 3],
    [17, 3],
    [21, 3],
  ] as const);
  return { text: `${base}${sup(exp)}`, value: rational(base ** exp) };
}

function hugeRoot(rng: SeededRng): Item {
  for (;;) {
    const n = rng.int(2, 99);
    if (Number.isInteger(Math.sqrt(n))) continue;
    return { text: `1,000√${n}`, value: { num: 0, den: 1, rootCoef: 1000, root: n } };
  }
}

function hugeFraction(rng: SeededRng): Item {
  for (;;) {
    const den = rng.pick([3, 6, 7, 9, 11, 12, 13]);
    const num = rng.int(1, den - 1);
    if (gcd(num, den) !== 1) continue;
    return { text: `${num}/${den} of 10,000`, value: rational(num * 10000, den) };
  }
}

function hugePercentOf(rng: SeededRng): Item {
  const percent = rng.int(3, 97);
  const of = 1000 * rng.int(2, 10);
  if ((percent * of) / 100 >= 10000) return hugePercentOf(rng);
  return { text: `${percent}% of ${thousands(of)}`, value: rational((percent * of) / 100) };
}

/* ------------------------------------------------------------------ The lines */

type Line = { stage: Pick<NumlineStageData, "lo" | "hi">; makers: Maker[] };

const TODAY_SYMMETRIC: Line = {
  stage: { lo: -50, hi: 50 },
  makers: [negativeItem, negativeItem, (r) => rootItem(r, true), mixedSymmetricItem],
};
const TODAY_LARGE: Line = {
  stage: { lo: 0, hi: 1000 },
  makers: [powerItem, bigProductItem, (r) => rootItem(r, false), mixedLargeItem],
};

const LINES: Record<Exclude<NumlineLineId, "today-third">, Line> = {
  "easy-10": { stage: { lo: 0, hi: 10 }, makers: [wholeTen, halfTen, sumTen] },
  "easy-100": { stage: { lo: 0, hi: 100 }, makers: [wholeHundred, tensSum, halfOf] },
  "easy-1": { stage: { lo: 0, hi: 1 }, makers: [simpleFraction, tenthsDecimal, tensPercent] },
  "hard-1": { stage: { lo: 0, hi: 1 }, makers: [hardFraction, hardFraction, thousandthsDecimal, fractionOfFraction] },
  "hard-sym-100": { stage: { lo: -100, hi: 100 }, makers: [hardNegative, hardNegative, symmetricPower, symmetricRoot] },
  "hard-1000": { stage: { lo: 0, hi: 1000 }, makers: [powerItem, (r) => rootItem(r, false), hardFractionOfThousand, bigProductItem] },
  "today-1": { stage: { lo: 0, hi: 1 }, makers: [fractionItem, fractionItem, decimalItem, percentItem] },
  "today-100": { stage: { lo: 0, hi: 100 }, makers: [productItem, percentOfItem, squareItem, divisionItem] },
  "expert-10000": { stage: { lo: 0, hi: 10000 }, makers: [hugeProduct, hugePower, hugeRoot, hugeFraction, hugePercentOf] },
};

/** A level's three lines dealt from the seed (never called at Normal, which is today's generateNumline). */
export function generateNumlineLevel(seed: number, settings: NumlineLevelSettings): NumlinePuzzleData {
  const rng = seededRng(seed);
  const symmetric = rng.below(2) === 0;
  const stages: NumlineStageData[] = [];
  const values: NumlineValue[][] = [];
  for (const id of settings.lines) {
    const line = id === "today-third" ? (symmetric ? TODAY_SYMMETRIC : TODAY_LARGE) : LINES[id];
    const items = fill(rng, line.stage, line.makers);
    stages.push({ ...line.stage, items: items.map((item) => item.text), ...(settings.hideEnd ? { hideEnd: "hi" as const } : {}) });
    values.push(items.map((item) => item.value));
  }
  return { type: "numline", numlineRev: NUMLINE_REV, timeLimitMs: NUMLINE_REV2_TIME_MS, stages, values };
}
