/**
 * Matchmaker's perfect-memory sweep under the human limits (D3, 22 Nov 2026): the proof that a board can be finished at
 * 200 by the best human (0.25 s to react, 0.15 s to move: one flip each 0.4 s; a third flip skips the turn-back wait).
 * Shared and pure: the level deal keeps only Hard and Expert boards it proves (attentionLevels.server.ts), and
 * d3-attention-proof.ts grades the same flips through the server.
 *
 * The sweep turns the cards over in board order, two at a time. A card whose partner it has seen is matched at once (a
 * person who knows where the partner is never misses it, so it makes no memory miss); a pair it discovers as the second
 * card of a try is kept for later, except the gold pair, matched as soon as both cards are known; once every card has
 * been seen, it matches all the kept pairs in a row (its longest streak).
 */
import { sameCard } from "./pairmatch";
import type { PairCard } from "./types";

export const PAIR_SWEEP_FLIP_MS = 400;

export interface PairSweep {
  /** The flips, in order (board indices). */
  flips: number[];
  /** Round-clock ms of the last flip, and of the gold pair's match (null if never). */
  doneMs: number;
  goldMs: number | null;
}

export function pairSweep(cards: readonly PairCard[], gold: PairCard | undefined): PairSweep {
  const flips: number[] = [];
  const seen = new Set<number>();
  const matched = new Set<number>();
  let goldMs: number | null = null;
  const flip = (i: number) => flips.push(i);
  const partnerSeen = (i: number) => [...seen].find((k) => k !== i && !matched.has(k) && sameCard(cards[k], cards[i]));
  const match = (a: number, b: number) => {
    flip(a);
    flip(b);
    matched.add(a).add(b);
    if (goldMs === null && gold && sameCard(gold, cards[a])) goldMs = flips.length * PAIR_SWEEP_FLIP_MS;
  };
  const goldKnown = () => {
    if (goldMs !== null || !gold) return null;
    const both = [...seen].filter((k) => !matched.has(k) && sameCard(gold, cards[k]));
    return both.length === 2 ? both : null;
  };
  for (let a = 0; a < cards.length; a++) {
    if (seen.has(a) || matched.has(a)) continue;
    const twin = partnerSeen(a);
    if (twin !== undefined) {
      seen.add(a);
      match(a, twin);
      continue;
    }
    seen.add(a);
    let b = a + 1;
    while (b < cards.length && (seen.has(b) || matched.has(b))) b++;
    if (b >= cards.length) break;
    seen.add(b);
    if (sameCard(cards[a], cards[b])) match(a, b);
    else {
      flip(a);
      flip(b);
    }
    const g = goldKnown();
    if (g) match(g[0]!, g[1]!);
  }
  // Every card seen: the kept pairs in a row (the gold pair first if it is still to match).
  const left = [...seen].filter((k) => !matched.has(k)).sort((x, y) => Number(!!gold && sameCard(gold, cards[y])) - Number(!!gold && sameCard(gold, cards[x])));
  for (const k of left) {
    if (matched.has(k)) continue;
    const twin = left.find((j) => j !== k && !matched.has(j) && sameCard(cards[j], cards[k]));
    if (twin !== undefined) match(k, twin);
  }
  return { flips, doneMs: flips.length * PAIR_SWEEP_FLIP_MS, goldMs };
}
