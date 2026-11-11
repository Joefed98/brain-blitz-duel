/**
 * The Joulz Championship's Knockout bracket (wave 4, W4c; docs/tournaments/events.md "Knockout"). Pure.
 *
 * - The month's top 64 Score Attack players qualify, seeded by their place there (seed 1 = 1st).
 * - The bracket is the smallest power of two that holds them (2 … 64). Seeds sit in the standard order (1 v 64,
 *   32 v 33, …), so the top seeds meet last; a seed past the qualifiers is a bye, and the seed facing it goes through
 *   without playing.
 * - Each match is a best of 3; the winner goes through. A level match goes to the higher seed.
 * - The semi-final losers play for 3rd (a third-place match in the final's round).
 * - Places: 1 and 2 from the final, 3 and 4 from the third-place match, 5 for every quarter-final loser (5th–8th),
 *   then 9, 17, 33 for the rounds before.
 */

export const MAX_BRACKET = 64;

/** The bracket for `n` qualifiers: the smallest power of two ≥ n, at least 2, at most 64. */
export function bracketSize(n: number): number {
  let size = 2;
  while (size < Math.min(Math.max(n, 2), MAX_BRACKET)) size *= 2;
  return size;
}

export const bracketRounds = (size: number) => Math.round(Math.log2(size));

/** The seeds in bracket order: [1, 8, 4, 5, 2, 7, 3, 6] for 8 (each adjacent pair one first-round match). */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap((s) => [s, n - s]);
  }
  return order;
}

/** "Final", "Semi-finals", "Quarter-finals", else "Last 16" / "Last 32" / "Last 64". */
export function roundName(size: number, round: number): string {
  const left = size / 2 ** (round - 1);
  if (left === 2) return "Final";
  if (left === 4) return "Semi-finals";
  if (left === 8) return "Quarter-finals";
  return `Last ${left}`;
}

export type KoStage = "knockout" | "third_place";

export interface KoMatch {
  stage: KoStage;
  round: number;
  /** Position in its round, 0-based; a winner goes to slot ⌊slot / 2⌋ of the next round, side slot % 2. */
  slot: number;
  /** The seed numbers in it (null: a bye or not yet known). */
  seedA: number | null;
  seedB: number | null;
  /** The winning seed once decided. */
  winner: number | null;
}

/** Round 1: every pair in seed order, a seed above `qualifiers` a bye (null). */
export function firstRound(qualifiers: number): KoMatch[] {
  const size = bracketSize(qualifiers);
  const order = seedOrder(size);
  const seat = (s: number) => (s <= qualifiers ? s : null);
  const out: KoMatch[] = [];
  for (let i = 0; i < size; i += 2) out.push({ stage: "knockout", round: 1, slot: i / 2, seedA: seat(order[i]!), seedB: seat(order[i + 1]!), winner: null });
  return out;
}

/** A match decided without playing: one side a bye (or both, which sends a bye on). */
export function isWalkover(m: Pick<KoMatch, "seedA" | "seedB">): boolean {
  return m.seedA === null || m.seedB === null;
}

/** A walkover's winner (the one seed in it), or null for two byes. */
export function walkoverWinner(m: Pick<KoMatch, "seedA" | "seedB">): number | null {
  return m.seedA ?? m.seedB ?? null;
}

/** A played match's winner from the match result: side a, b, or a level match to the higher seed (lower number). */
export function playedWinner(m: Pick<KoMatch, "seedA" | "seedB">, side: "a" | "b" | "draw"): number {
  if (side === "a") return m.seedA!;
  if (side === "b") return m.seedB!;
  return Math.min(m.seedA!, m.seedB!);
}

/** The next round from a decided round (its matches in slot order). */
export function nextRound(decided: readonly KoMatch[]): KoMatch[] {
  const round = decided[0]!.round + 1;
  const out: KoMatch[] = [];
  for (let i = 0; i < decided.length; i += 2)
    out.push({ stage: "knockout", round, slot: i / 2, seedA: decided[i]!.winner, seedB: decided[i + 1]?.winner ?? null, winner: null });
  return out;
}

/** The match's loser (null for a walkover or before it's decided). */
export function loserOf(m: KoMatch): number | null {
  if (m.winner === null || isWalkover(m)) return null;
  return m.winner === m.seedA ? m.seedB : m.seedA;
}

/** The third-place match from the two semi-finals (null when the bracket has none or a semi was a walkover). */
export function thirdPlaceMatch(semis: readonly KoMatch[]): KoMatch | null {
  if (semis.length !== 2) return null;
  const a = loserOf(semis[0]!);
  const b = loserOf(semis[1]!);
  if (a === null && b === null) return null;
  return { stage: "third_place", round: semis[0]!.round + 1, slot: 0, seedA: a, seedB: b, winner: null };
}

/**
 * Every seed's final place once the bracket is done: final winner 1, loser 2; third-place match winner 3, loser 4
 * (a lone semi loser takes 3rd); quarter-final losers 5; earlier rounds' losers 9, 17, 33.
 */
export function finalPlaces(size: number, matches: readonly KoMatch[]): Map<number, number> {
  const places = new Map<number, number>();
  const rounds = bracketRounds(size);
  for (const m of matches) {
    if (m.stage !== "knockout") continue;
    const loser = loserOf(m);
    if (loser === null) continue;
    const left = size / 2 ** (m.round - 1);
    if (m.round === rounds) places.set(loser, 2);
    else if (left > 4) places.set(loser, left / 2 + 1);
  }
  const final = matches.find((m) => m.stage === "knockout" && m.round === rounds);
  if (final?.winner != null) places.set(final.winner, 1);
  const third = matches.find((m) => m.stage === "third_place");
  if (third?.winner != null) {
    places.set(third.winner, 3);
    const l = loserOf(third);
    if (l !== null) places.set(l, 4);
  }
  return places;
}
