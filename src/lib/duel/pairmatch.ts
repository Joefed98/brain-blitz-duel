/**
 * Pair Match rules. The phone sends the flip sequence it made; the server walks
 * the same list through `replayPairs`, so the pair count and the flip count are
 * both worked out server-side.
 */

import { PAIR_CARDS, PAIR_PAIRS, type PairCard } from "./types";

export function sameCard(a: PairCard | undefined, b: PairCard | undefined): boolean {
  return !!a && !!b && a.shape === b.shape && a.colour === b.colour;
}

/** Card indices in the order they were turned over. */
export function encodePairFlips(flips: number[]): string {
  return flips.join(",");
}

export function decodePairFlips(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < PAIR_CARDS);
}

export interface PairReplay {
  solved: boolean;
  pairs: number;
  /** How many individual cards were turned over. */
  flips: number;
  /** Turn-over attempts — two cards each. */
  tries: number;
  matched: number[];
}

export function replayPairs(cards: PairCard[], flips: number[]): PairReplay {
  const matched = new Set<number>();
  let tries = 0;
  let used = 0;
  let first: number | null = null;

  for (const card of flips) {
    if (matched.has(card)) continue;
    if (first === null) {
      first = card;
      used += 1;
      continue;
    }
    if (card === first) continue;
    used += 1;
    tries += 1;
    if (sameCard(cards[first], cards[card])) {
      matched.add(first);
      matched.add(card);
    }
    first = null;
  }

  return {
    solved: matched.size >= PAIR_PAIRS * 2,
    pairs: matched.size / 2,
    flips: used,
    tries,
    matched: [...matched].sort((a, b) => a - b),
  };
}
