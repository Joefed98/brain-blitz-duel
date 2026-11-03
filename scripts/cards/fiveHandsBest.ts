/**
 * Five Hands' exact best arrangement (fiveHandsRev 3's report, the flawless bot and cards-check): the rules leave one
 * freedom, the order within each round of five turns (each row takes exactly one of the round's five cards), so an
 * arrangement is four permutations of five. A branch-and-bound search over them, started from the sim's witness (its
 * hill climb) and bounded per row by its best hand with any one card from each round still to come, returns the most
 * hand points perfect play can make on a deck and the taps that make them. Scripts only, never shipped.
 *
 * fiveHandsRev 3's bonus column: rows fill evenly, so column 0 holds the five dealt cards and column k round k's five
 * cards whatever the placement; the best column is fixed by the deck and adds to the best rows independently
 * (`column`, `columnPoints`; `total` includes it).
 */
import { FH_ROWS, fhColumn, fhDeal, fhRowHand, fhStartCard, fhYours } from "../../src/lib/arcade/cards/fiveHands";

export interface FhBest {
  /** The rows' best hand points plus the best column's. */
  total: number;
  rowsTotal: number;
  /** The best column (its five cards are fixed by the deck) and its points. */
  column: number;
  columnPoints: number;
  /** Each turn's row (what perfect play taps). */
  taps: number[];
  rows: number[][];
}

const PERMS: number[][] = [];
(function build(prefix: number[]) {
  if (prefix.length === 5) {
    PERMS.push(prefix.slice());
    return;
  }
  for (let i = 0; i < 5; i++) if (!prefix.includes(i)) build([...prefix, i]);
})([]);

export function fhBest(seed: number, rev = 3): FhBest {
  const deal = fhDeal(seed, rev);
  const deck = deal.deck;
  const round = (g: number) => [0, 1, 2, 3, 4].map((k) => fhYours(deck, g * 5 + k));
  const R = [0, 1, 2, 3].map(round);
  const pts = (row: readonly number[]) => fhRowHand(row, rev).points;
  let best = deal.witness.reduce((a, row) => a + pts(row), 0);
  let bestPerm: number[][] = [0, 1, 2, 3].map((g) => deal.witness.map((row) => R[g]!.indexOf(row[g + 1]!)));
  const rowBound = (row: number[], g: number): number => {
    if (g === 4) return pts(row);
    let m = 0;
    for (const c of R[g]!) {
      row.push(c);
      m = Math.max(m, rowBound(row, g + 1));
      row.pop();
      if (m >= 50) break;
    }
    return m;
  };
  const rows: number[][] = Array.from({ length: FH_ROWS }, (_, r) => [fhStartCard(deck, r)]);
  const perm: number[][] = [];
  const dfs = (g: number) => {
    if (g === 3) {
      // The last round: a 5 × 5 table of each row's hand with each card, the best assignment over the 120 orders.
      const v = rows.map((row) => R[3]!.map((c) => pts([...row, c])));
      for (const p of PERMS) {
        let t = 0;
        for (let r = 0; r < FH_ROWS; r++) t += v[r]![p[r]!]!;
        if (t > best) {
          best = t;
          bestPerm = [...perm.map((x) => x.slice()), p.slice()];
        }
      }
      return;
    }
    for (const p of PERMS) {
      for (let r = 0; r < FH_ROWS; r++) rows[r]!.push(R[g]![p[r]!]!);
      let bound = 0;
      for (let r = 0; r < FH_ROWS; r++) bound += rowBound(rows[r]!, g + 1);
      if (bound > best) {
        perm.push(p);
        dfs(g + 1);
        perm.pop();
      }
      for (let r = 0; r < FH_ROWS; r++) rows[r]!.pop();
    }
  };
  dfs(0);
  const taps: number[] = [];
  for (let g = 0; g < 4; g++) for (let k = 0; k < 5; k++) taps.push(bestPerm[g]!.indexOf(k));
  const out = Array.from({ length: FH_ROWS }, (_, r) => [fhStartCard(deck, r), ...[0, 1, 2, 3].map((g) => R[g]![bestPerm[g]![r]!]!)]);
  let column = 0;
  let columnPoints = -1;
  for (let k = 0; k < 5; k++) {
    const p = pts(fhColumn(out, k));
    if (p > columnPoints) {
      columnPoints = p;
      column = k;
    }
  }
  return { total: best + columnPoints, rowsTotal: best, column, columnPoints, taps, rows: out };
}
