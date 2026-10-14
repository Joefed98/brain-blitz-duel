/**
 * Server-only Ballpark generator. Each line gets five items whose exact values
 * (rationals, plus a whole-number square root where an item has one) are
 * spread one per fifth of the line and kept at least 3% of the line from every
 * labelled tick. Deterministic from the seed it is given; no item needs a
 * calculator to estimate.
 */
import {
  NUMLINE_ITEMS,
  NUMLINE_REV,
  NUMLINE_REV2_TIME_MS,
  NUMLINE_TICK_GAP,
  numlineShare,
  numlineTicks,
  numlineValue,
} from "./numline";
import { seededRng, type SeededRng } from "./seededRng";
import type { NumlinePuzzleData, NumlineStageData, NumlineValue } from "./types";

interface Item {
  text: string;
  value: NumlineValue;
}

const MINUS = "−";
const SUPERSCRIPT = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const sup = (n: number) =>
  String(n)
    .split("")
    .map((d) => SUPERSCRIPT[Number(d)])
    .join("");
const signed = (n: number) => (n < 0 ? `${MINUS}${-n}` : String(n));

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

const rational = (num: number, den = 1): NumlineValue => {
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g, rootCoef: 0, root: 0 };
};

const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));

/* --------------------------- Stage 1: 0 to 1 --------------------------- */

function fractionItem(rng: SeededRng): Item {
  for (;;) {
    const den = rng.int(2, 12);
    const num = rng.int(1, den - 1);
    if (gcd(num, den) !== 1) continue;
    return { text: `${num}/${den}`, value: rational(num, den) };
  }
}

function decimalItem(rng: SeededRng): Item {
  const hundredths = rng.int(3, 97);
  return { text: `0.${String(hundredths).padStart(2, "0")}`, value: rational(hundredths, 100) };
}

function percentItem(rng: SeededRng): Item {
  const percent = rng.int(3, 97);
  return { text: `${percent}%`, value: rational(percent, 100) };
}

/* -------------------------- Stage 2: 0 to 100 -------------------------- */

function productItem(rng: SeededRng): Item {
  const a = rng.int(3, 12);
  const b = rng.int(3, 12);
  const c = rng.int(1, 19);
  const plus = rng.below(2) === 0;
  return {
    text: `${a} × ${b} ${plus ? "+" : MINUS} ${c}`,
    value: rational(a * b + (plus ? c : -c)),
  };
}

function percentOfItem(rng: SeededRng): Item {
  const percent = rng.pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90]);
  const of = 20 * rng.int(2, 10);
  return { text: `${percent}% of ${of}`, value: rational(percent * of, 100) };
}

function squareItem(rng: SeededRng): Item {
  const base = rng.int(2, 9);
  const shift = rng.int(0, 2) === 0 ? 0 : rng.int(1, 15);
  const plus = rng.below(2) === 0;
  const text = shift ? `${base}${sup(2)} ${plus ? "+" : MINUS} ${shift}` : `${base}${sup(2)}`;
  return { text, value: rational(base * base + (plus ? shift : -shift)) };
}

function divisionItem(rng: SeededRng): Item {
  const d = rng.int(3, 12);
  const r = rng.int(3, 97);
  return { text: `${d * r} ÷ ${d}`, value: rational(r) };
}

/* ---------------------- Stage 3: −50 to 50 or 0 to 1,000 ---------------------- */

function negativeItem(rng: SeededRng): Item {
  switch (rng.below(4)) {
    case 0: {
      const a = rng.int(2, 9);
      const b = rng.int(2, 9);
      return { text: `${MINUS}${a} × ${b}`, value: rational(-a * b) };
    }
    case 1: {
      const a = rng.int(2, 20);
      const b = rng.int(3, 9);
      const c = rng.int(3, 9);
      return { text: `${a} ${MINUS} ${b} × ${c}`, value: rational(a - b * c) };
    }
    case 2: {
      const [base, exp] = rng.pick([
        [2, 3],
        [2, 5],
        [3, 3],
        [2, 4],
        [4, 2],
        [5, 2],
        [6, 2],
      ] as const);
      const odd = exp % 2 === 1;
      // (−2)⁵ = −32; −2⁴ = −16 (the power binds first).
      return odd
        ? { text: `(${MINUS}${base})${sup(exp)}`, value: rational(-(base ** exp)) }
        : { text: `${MINUS}${base}${sup(exp)}`, value: rational(-(base ** exp)) };
    }
    default: {
      const den = rng.pick([2, 3, 4, 5]);
      let num = rng.int(1, den - 1);
      while (gcd(num, den) !== 1) num = rng.int(1, den - 1);
      const of = den * rng.int(4, 12);
      return { text: `${MINUS}${num}/${den} of ${of}`, value: rational(-num * of, den) };
    }
  }
}

function rootItem(rng: SeededRng, symmetric: boolean): Item {
  if (symmetric) {
    for (;;) {
      const n = rng.int(10, 2000);
      if (isSquare(n)) continue;
      const negative = rng.below(2) === 0;
      return {
        text: `${negative ? MINUS : ""}√${n}`,
        value: { num: 0, den: 1, rootCoef: negative ? -1 : 1, root: n },
      };
    }
  }
  for (;;) {
    const n = rng.int(2, 94);
    if (isSquare(n)) continue;
    return { text: `100√${n}`, value: { num: 0, den: 1, rootCoef: 100, root: n } };
  }
}

function mixedSymmetricItem(rng: SeededRng): Item {
  const base = rng.int(3, 7);
  const shift = rng.int(10, 60);
  return { text: `${base}${sup(2)} ${MINUS} ${shift}`, value: rational(base * base - shift) };
}

function powerItem(rng: SeededRng): Item {
  const [base, exp] = rng.pick([
    [2, 8],
    [2, 9],
    [3, 5],
    [3, 6],
    [5, 4],
    [6, 3],
    [7, 3],
    [9, 3],
    [4, 4],
    [5, 3],
    [8, 3],
  ] as const);
  return { text: `${base}${sup(exp)}`, value: rational(base ** exp) };
}

function bigProductItem(rng: SeededRng): Item {
  const a = rng.int(11, 39);
  const b = rng.int(11, 39);
  return { text: `${a} × ${b}`, value: rational(a * b) };
}

function mixedLargeItem(rng: SeededRng): Item {
  if (rng.below(2) === 0) {
    const den = rng.pick([3, 6, 7, 8, 9, 12]);
    let num = rng.int(1, den - 1);
    while (gcd(num, den) !== 1) num = rng.int(1, den - 1);
    return { text: `${num}/${den} of 1,000`, value: rational(num * 1000, den) };
  }
  const d = rng.pick([3, 6, 7, 9, 11, 13]);
  const shift = rng.int(1, 6) * 100;
  return { text: `1,000 ÷ ${d} + ${shift}`, value: rational(1000 + shift * d, d) };
}

/* ------------------------------- Assembly ------------------------------ */

type Maker = (rng: SeededRng) => Item;

function fill(
  rng: SeededRng,
  stage: Pick<NumlineStageData, "lo" | "hi">,
  makers: readonly Maker[],
): Item[] {
  const ticks = numlineTicks(stage);
  for (let attempt = 0; attempt < 200; attempt++) {
    const bins: (Item | null)[] = Array.from({ length: NUMLINE_ITEMS }, () => null);
    const seen = new Set<string>();
    // The makers in a seeded order, so each kind shows up before any repeats.
    const order = rng.shuffle(makers);
    let tries = 0;
    while (bins.some((b) => b === null) && tries < 400) {
      const make = order[tries % order.length]!;
      tries += 1;
      const item = make(rng);
      const share = numlineShare(stage, numlineValue(item.value));
      if (!(share > 0 && share < 1)) continue;
      if (ticks.some((t) => Math.abs(t - share) < NUMLINE_TICK_GAP)) continue;
      const bin = Math.min(NUMLINE_ITEMS - 1, Math.floor(share * NUMLINE_ITEMS));
      if (bins[bin] || seen.has(item.text)) continue;
      seen.add(item.text);
      bins[bin] = item;
    }
    if (bins.every(Boolean)) return rng.shuffle(bins as Item[]);
  }
  throw new Error("Ballpark: could not spread a line");
}

export function generateNumline(seed: number): NumlinePuzzleData {
  const rng = seededRng(seed);
  const symmetric = rng.below(2) === 0;
  const lines: { stage: Pick<NumlineStageData, "lo" | "hi">; makers: Maker[] }[] = [
    { stage: { lo: 0, hi: 1 }, makers: [fractionItem, fractionItem, decimalItem, percentItem] },
    { stage: { lo: 0, hi: 100 }, makers: [productItem, percentOfItem, squareItem, divisionItem] },
    symmetric
      ? {
          stage: { lo: -50, hi: 50 },
          makers: [negativeItem, negativeItem, (r) => rootItem(r, true), mixedSymmetricItem],
        }
      : {
          stage: { lo: 0, hi: 1000 },
          makers: [powerItem, bigProductItem, (r) => rootItem(r, false), mixedLargeItem],
        },
  ];
  const stages: NumlineStageData[] = [];
  const values: NumlineValue[][] = [];
  for (const line of lines) {
    const items = fill(rng, line.stage, line.makers);
    stages.push({ ...line.stage, items: items.map((item) => item.text) });
    values.push(items.map((item) => item.value));
  }
  return { type: "numline", numlineRev: NUMLINE_REV, timeLimitMs: NUMLINE_REV2_TIME_MS, stages, values };
}
