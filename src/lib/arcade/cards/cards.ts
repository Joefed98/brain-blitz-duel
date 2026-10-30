/**
 * Cards & Board: the one card model FreeCell, TriPeaks and Poker Squares share (sims and server replay; no drawing).
 *
 * A card is an integer 0–51: suit × 13 + (rank − 1), ranks 1 (Ace) to 13 (King), suits in the order spades, hearts,
 * diamonds, clubs (hearts and diamonds red). Shuffles use the engine's seeded PRNG only.
 */
import { rngBelow } from "../engine";

export const SUITS = 4;
export const RANKS = 13;
export const DECK = 52;
/** No card (an empty cell or square). */
export const NO_CARD = -1;

export const SUIT_GLYPHS = ["♠", "♥", "♦", "♣"] as const;
export const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export function cardOf(suit: number, rank: number): number {
  return suit * RANKS + (rank - 1);
}

export function suitOf(card: number): number {
  return Math.floor(card / RANKS);
}

export function rankOf(card: number): number {
  return (card % RANKS) + 1;
}

/** Hearts and diamonds. */
export function isRed(card: number): boolean {
  const s = suitOf(card);
  return s === 1 || s === 2;
}

export function cardLabel(card: number): string {
  if (card < 0) return "—";
  return `${RANK_LABELS[rankOf(card)]}${SUIT_GLYPHS[suitOf(card)]}`;
}

/** A fresh deck (0…51) shuffled by Fisher–Yates on the seeded PRNG; returns the deck and the PRNG's next state. */
export function shuffledDeck(seed: number): { deck: number[]; rng: number } {
  const deck = Array.from({ length: DECK }, (_, i) => i);
  let rng = seed | 0;
  for (let i = DECK - 1; i > 0; i--) {
    const r = rngBelow(rng, i + 1);
    rng = r.state;
    const t = deck[i]!;
    deck[i] = deck[r.value]!;
    deck[r.value] = t;
  }
  return { deck, rng };
}

/** FNV-1a over a list of integers: the checkpoints' checksum. */
export function hashInts(values: readonly number[], start = 0x811c9dc5): number {
  let h = start >>> 0;
  for (const v of values) {
    h ^= v & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (v >>> 16) & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
