/**
 * Rated 4- and 8-player matches: the rules (wave 3, session W3d; docs/rated/multiplayer.md, mockups 08–10). Pure,
 * shared by the phone and the server; nothing here reads a clock, a database or a random number.
 *
 * - Filling (mockup 08): wait up to FILL_WAIT_MS for live players (W3b's queue widens as it does for 1v1), then fill
 *   every empty seat with a recorded run, labelled, never the same player twice in one match (`fillPlan`).
 * - Playing (mockup 09): everyone plays the same deals; each game gives placing points by place in that game
 *   (8 players: 10, 7, 5, 4, 3, 2, 1, 0; 4 players: 5, 3, 1, 0), level scores sharing the place and its higher
 *   points (the rooms' Placings table, scoringMode.ts `placingTable`, the same numbers).
 * - Final placings (mockup 10): most points first, level points split by the total score, still level the place is
 *   shared (ranking.ts `placesOf`, the one ranking; no time tie-break here).
 * - Ratings: each placing is a win against everyone below and a loss against everyone above (a draw against a shared
 *   place), every pair weighted 1 / (size − 1), so the whole match moves a rating about as much as one 1v1
 *   (decided 11 Nov 2026). Recorded seats are opponents only: their owners' ratings never move.
 * - Joules: 1.5 times the best-of-3 amounts (150 a win, 100 a loss; docs/economy/economy-design.md): 225 for a
 *   placing in the top half, 150 otherwise. Live players only.
 * - Podium Regular (C2's catalogue, `podium-regular`): a live player's finish in places 1–3 counts.
 */
import { placesOf } from "@/lib/duel/ranking";
import { placingTable } from "@/lib/duel/scoringMode";

export type MultiSize = 4 | 8;
export const MULTI_SIZES: readonly MultiSize[] = [4, 8];
export const isMultiSize = (value: unknown): value is MultiSize => value === 4 || value === 8;

/** How long the queue waits for live players before recorded runs fill the empty seats. */
export const FILL_WAIT_MS = 15_000;

/** Placing points by place, best first. */
export function multiPointsTable(size: MultiSize): readonly number[] {
  return placingTable(size);
}

/** The points for a place (1 = first) in a match of `size`. */
export function multiPoints(size: MultiSize, place: number): number {
  return multiPointsTable(size)[place - 1] ?? 0;
}

/* ------------------------------------------------------------------ seats and filling */

/** One seat in a match: a live player, or a recorded run of a real player (labelled "Recorded run"). */
export interface MultiSeat {
  /** Unique in the match. */
  seatId: string;
  /** The player whose seat it is (the recorded run's owner for a recorded seat). */
  playerId: string;
  name: string;
  recorded: boolean;
}

/** A recorded run W3b offers for this match: one real player's runs on every one of this match's deals. */
export interface RecordedCandidate {
  playerId: string;
  name: string;
  /** The deal keys the player has a run on (W3b's own key for a deal). */
  dealKeys: readonly string[];
  /** W3b's own id for the run set; carried, never read here. */
  runId: string;
}

export type FillPlan =
  | { kind: "full"; seats: MultiSeat[] }
  | { kind: "wait"; seats: MultiSeat[]; msLeft: number }
  | { kind: "filled"; seats: MultiSeat[]; recorded: RecordedCandidate[] }
  /** Not enough distinct recorded players with runs on these deals: W3b keeps widening. */
  | { kind: "short"; seats: MultiSeat[]; missing: number };

/**
 * The seats for a filling match. `live` are the players in the queue's match so far (in join order), `candidates` the
 * recorded runs W3b offers, best first (its widening order). Before FILL_WAIT_MS the match waits for live players;
 * after it every empty seat takes the next candidate whose player isn't already in the match (live or recorded) and
 * who has a run on every deal. A full live match never takes a recorded run.
 */
export function fillPlan(input: {
  size: MultiSize;
  live: readonly { playerId: string; name: string }[];
  waitedMs: number;
  dealKeys: readonly string[];
  candidates: readonly RecordedCandidate[];
}): FillPlan {
  const seen = new Set<string>();
  const seats: MultiSeat[] = [];
  for (const p of input.live) {
    if (seen.has(p.playerId) || seats.length >= input.size) continue;
    seen.add(p.playerId);
    seats.push({ seatId: `live:${p.playerId}`, playerId: p.playerId, name: p.name, recorded: false });
  }
  if (seats.length >= input.size) return { kind: "full", seats };
  if (input.waitedMs < FILL_WAIT_MS) return { kind: "wait", seats, msLeft: FILL_WAIT_MS - Math.max(0, input.waitedMs) };
  const recorded: RecordedCandidate[] = [];
  for (const c of input.candidates) {
    if (seats.length >= input.size) break;
    if (seen.has(c.playerId)) continue;
    if (!input.dealKeys.every((k) => c.dealKeys.includes(k))) continue;
    seen.add(c.playerId);
    recorded.push(c);
    seats.push({ seatId: `rec:${c.runId}`, playerId: c.playerId, name: c.name, recorded: true });
  }
  if (seats.length < input.size) return { kind: "short", seats, missing: input.size - seats.length };
  return { kind: "filled", seats, recorded };
}

/** True when no player holds two seats (the rule `fillPlan` keeps). */
export function noPlayerTwice(seats: readonly MultiSeat[]): boolean {
  return new Set(seats.map((s) => s.playerId)).size === seats.length;
}

/* ------------------------------------------------------------------ games and standings */

/** One seat's result in one game (the stored round score). A seat with no result scores 0. */
export interface GameScore {
  seatId: string;
  score: number;
}

export interface GamePlacing {
  seatId: string;
  score: number;
  place: number;
  points: number;
}

/** One game's places and points: level scores share the place and its (higher) points. */
export function gamePlacings(size: MultiSize, seats: readonly string[], scores: readonly GameScore[]): GamePlacing[] {
  const byId = new Map(scores.map((s) => [s.seatId, Math.max(0, Math.round(s.score))]));
  const rows = seats.map((seatId) => ({ seatId, score: byId.get(seatId) ?? 0 }));
  return rows.map((row) => {
    const place = 1 + rows.filter((o) => o.score > row.score).length;
    return { ...row, place, points: multiPoints(size, place) };
  });
}

export interface StandingRow {
  seatId: string;
  /** Placing points so far. */
  points: number;
  /** Total score so far (the tie-break). */
  total: number;
  place: number;
  /** Place after the game before (null after the first game). */
  previousPlace: number | null;
  /** This game's placing points and place (null before any game). */
  gamePoints: number | null;
  gamePlace: number | null;
}

function ranked(seats: readonly string[], totals: Map<string, { points: number; total: number }>) {
  const rows = seats.map((seatId, index) => ({ seatId, index, ...(totals.get(seatId) ?? { points: 0, total: 0 }), timeMs: 0 }));
  return placesOf(rows, (a, b) => a.index - b.index);
}

/**
 * The standings after `games.length` games: points, totals, places, the movement since the game before and the last
 * game's points. Sorted best first (shared places keep the seats' order).
 */
export function standingsAfter(
  size: MultiSize,
  seats: readonly string[],
  games: readonly (readonly GameScore[])[],
): StandingRow[] {
  const totals = new Map<string, { points: number; total: number }>(seats.map((s) => [s, { points: 0, total: 0 }]));
  let previous: Map<string, number> | null = null;
  let last: GamePlacing[] | null = null;
  for (let g = 0; g < games.length; g++) {
    if (g === games.length - 1 && g > 0) previous = new Map(ranked(seats, totals).map(({ row, place }) => [row.seatId, place]));
    last = gamePlacings(size, seats, games[g]!);
    for (const p of last) {
      const t = totals.get(p.seatId)!;
      t.points += p.points;
      t.total += p.score;
    }
  }
  const lastById = new Map((last ?? []).map((p) => [p.seatId, p]));
  return ranked(seats, totals).map(({ row, place }) => ({
    seatId: row.seatId,
    points: row.points,
    total: row.total,
    place,
    previousPlace: previous?.get(row.seatId) ?? null,
    gamePoints: lastById.get(row.seatId)?.points ?? null,
    gamePlace: lastById.get(row.seatId)?.place ?? null,
  }));
}

/** "up" / "down" / "same" since the game before (null after the first game). */
export function movement(row: StandingRow): "up" | "down" | "same" | null {
  if (row.previousPlace === null) return null;
  return row.place < row.previousPlace ? "up" : row.place > row.previousPlace ? "down" : "same";
}

/** The final placings: the standings after every game. */
export function finalPlacings(size: MultiSize, seats: readonly string[], games: readonly (readonly GameScore[])[]) {
  return standingsAfter(size, seats, games);
}

/* ------------------------------------------------------------------ ratings */

/** Each pair's weight: the whole match moves a rating about as much as one 1v1. */
export const pairWeight = (size: number) => 1 / Math.max(1, size - 1);

export interface RatedPair {
  /** Seat ids; `a` is the better place (or the earlier seat of a shared place). */
  a: string;
  b: string;
  /** For `a`: 1 a win, 0.5 a draw (a shared place). */
  result: 1 | 0.5;
  weight: number;
}

/**
 * Every pair of seats once, as one result each: the better placing beats the worse, a shared place is a draw. Recorded
 * seats are in the pairs (they are real opponents) but are not rated (`ratedSeats`).
 */
export function ratingPairs(placings: readonly { seatId: string; place: number }[], size: number): RatedPair[] {
  const pairs: RatedPair[] = [];
  const w = pairWeight(size);
  const sorted = [...placings].sort((x, y) => x.place - y.place);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      pairs.push({ a: a.seatId, b: b.seatId, result: a.place === b.place ? 0.5 : 1, weight: w });
    }
  }
  return pairs;
}

/** Seats whose ratings move: live players only. */
export const ratedSeats = (seats: readonly MultiSeat[]) => seats.filter((s) => !s.recorded);

/* ------------------------------------------------------------------ Joules and badges */

/** The best-of-3 amounts (docs/economy/economy-design.md, "Joules and pacing"). */
export const BEST_OF_3_JOULES = { win: 150, loss: 100 } as const;
/** 4 or 8 players: 1.5 times. */
export const MULTI_JOULES_FACTOR = 1.5;
export const MULTI_JOULES = {
  win: Math.round(BEST_OF_3_JOULES.win * MULTI_JOULES_FACTOR),
  loss: Math.round(BEST_OF_3_JOULES.loss * MULTI_JOULES_FACTOR),
} as const;

/** A placing in the top half (beats at least as many as beat it) counts as a win for Joules. */
export const multiWin = (size: MultiSize, place: number) => place <= size / 2;

export function multiJoules(size: MultiSize, place: number): number {
  return multiWin(size, place) ? MULTI_JOULES.win : MULTI_JOULES.loss;
}

/** C2's Podium Regular counts a live player's finish in places 1–3. */
export const PODIUM_REGULAR_BADGE = "podium-regular";
export const countsForPodiumRegular = (seat: MultiSeat, place: number) => !seat.recorded && place <= 3;

/* ------------------------------------------------------------------ words */

const ORD = ["th", "st", "nd", "rd"];
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (ORD[n % 10] ?? "th");
  return `${n}${suffix}`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const countWord = (n: number) => WORDS[n] ?? String(n);
