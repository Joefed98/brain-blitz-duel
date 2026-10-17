/**
 * Podium awards (17 Oct 2026; presentation only). After the last round the final screen shows up
 * to four fun awards, each only when someone earned it:
 *  - Fastest Finger: the quickest correct (or round-topping) puzzle finish, as a share of that
 *    round's clock so a 30 s and a 100 s puzzle compare fairly. Arcade runs and Flash's reaction
 *    rounds don't count: they have no finish time to compare.
 *  - Perfectionist: the most perfect 150s (at least one).
 *  - Comeback Kid: the biggest climb, from the lowest place held after any earlier round to the
 *    final place, of at least 2 places.
 *  - So Close: the most near misses (nearMiss.ts, the line the results screen shows).
 *
 * Who gets each: players who didn't win come first (the winner already has the podium; a winner
 * gets an award only when no one else earned it), then the better figure, then whoever has fewer
 * awards so far, then the better final place, then the lower slot (the earlier join). Everything
 * here comes from the stored results every player can read once the rounds have ended, and
 * nothing depends on who is looking or on the order rows arrive in, so every phone shows the same
 * awards. Nothing is stored and nothing reads or writes a round, score or timing.
 */
import { nearMiss } from "./nearMiss";
import { ordinal } from "./ordinal";
import { MAX_ROUND_SCORE, standings, type TieRounds } from "./scoring";
import type { DuelPlayerRow, PuzzleType, RoundResultRow, StoredPuzzleType } from "./types";

export type AwardId = "fastest" | "perfect" | "comeback" | "close";

export interface PodiumAward {
  id: AwardId;
  title: string;
  slot: number;
  /** One line saying why. */
  line: string;
}

/** What the awards need to know about each round, in order (round 1 first). */
export interface AwardRound {
  type: StoredPuzzleType;
  /** Display name ("Box Six"). */
  name: string;
  /** The round's answer clock, ms (puzzleTimeLimitMs). */
  timeLimitMs: number;
  /** Arcade runs and Flash's reaction rounds have no finish time to compare. */
  timed: boolean;
}

export const AWARD_TITLES: Record<AwardId, string> = {
  perfect: "Perfectionist",
  fastest: "Fastest Finger",
  comeback: "Comeback Kid",
  close: "So Close",
};

/** The order awards are handed out in (and shown). */
const AWARD_ORDER: readonly AwardId[] = ["perfect", "fastest", "comeback", "close"];

/** The fewest places a Comeback Kid must climb. */
export const COMEBACK_MIN_PLACES = 2;

interface Candidate {
  slot: number;
  /** Compared in order; lower is better. */
  key: number[];
  line: string;
}

function fastest(players: DuelPlayerRow[], results: RoundResultRow[], rounds: readonly AwardRound[]): Candidate[] {
  const best = new Map<number, Candidate>();
  rounds.forEach((round, index) => {
    if (!round.timed || !(round.timeLimitMs > 0)) return;
    const number = index + 1;
    const rows = results.filter(
      (r) => r.round_number === number && players.some((p) => p.player_slot === r.player_slot),
    );
    const top = Math.max(0, ...rows.map((r) => r.score));
    for (const row of rows) {
      if (row.reaction_avg_ms !== null) continue;
      if (!row.is_correct && !(row.score > 0 && row.score === top)) continue;
      const elapsed = Math.max(0, Math.min(round.timeLimitMs, round.timeLimitMs - row.ms_remaining));
      const share = Math.round((elapsed / round.timeLimitMs) * 1e6);
      const candidate = {
        slot: row.player_slot,
        key: [share, elapsed, number],
        line: `${round.name} in ${(elapsed / 1000).toFixed(1)}s`,
      };
      const held = best.get(row.player_slot);
      if (!held || compare(candidate.key, held.key) < 0) best.set(row.player_slot, candidate);
    }
  });
  return [...best.values()];
}

function perfect(players: DuelPlayerRow[], results: RoundResultRow[], rounds: readonly AwardRound[]): Candidate[] {
  return players.flatMap((p) => {
    const perfects = results
      .filter((r) => r.player_slot === p.player_slot && r.round_number <= rounds.length && r.score >= MAX_ROUND_SCORE)
      .sort((a, b) => a.round_number - b.round_number);
    if (!perfects.length) return [];
    const only = rounds[perfects[0]!.round_number - 1];
    return [
      {
        slot: p.player_slot,
        key: [-perfects.length],
        line:
          perfects.length === 1
            ? `A perfect ${MAX_ROUND_SCORE} in ${only?.name ?? `round ${perfects[0]!.round_number}`}`
            : `${perfects.length} perfect ${MAX_ROUND_SCORE}s`,
      },
    ];
  });
}

function comeback(
  players: DuelPlayerRow[],
  results: RoundResultRow[],
  rounds: readonly AwardRound[],
  finalPlace: ReadonlyMap<number, number>,
  tie: TieRounds,
): Candidate[] {
  if (rounds.length < 2) return [];
  // The lowest place each player held after any round before the last (the latest such round).
  const lowest = new Map<number, { place: number; round: number }>();
  for (let round = 1; round < rounds.length; round++)
    for (const row of standings(players, results, round, new Map(), tie)) {
      const held = lowest.get(row.slot);
      if (!held || row.position >= held.place) lowest.set(row.slot, { place: row.position, round });
    }
  return players.flatMap((p) => {
    const from = lowest.get(p.player_slot);
    const to = finalPlace.get(p.player_slot);
    if (!from || to === undefined) return [];
    const climb = from.place - to;
    if (climb < COMEBACK_MIN_PLACES) return [];
    return [
      {
        slot: p.player_slot,
        key: [-climb],
        line: `From ${ordinal(from.place)} after round ${from.round} to ${ordinal(to)}`,
      },
    ];
  });
}

function close(players: DuelPlayerRow[], results: RoundResultRow[], rounds: readonly AwardRound[]): Candidate[] {
  return players.flatMap((p) => {
    const misses = rounds.flatMap((round, index) => {
      const row = results.find((r) => r.player_slot === p.player_slot && r.round_number === index + 1);
      const line = row ? nearMiss(round.type as PuzzleType, row.extra as Record<string, unknown> | null) : null;
      return line ? [{ round: index + 1, name: round.name, line }] : [];
    });
    if (!misses.length) return [];
    const last = misses[misses.length - 1]!;
    return [
      {
        slot: p.player_slot,
        key: [-misses.length],
        line:
          misses.length === 1
            ? `${last.name}: ${last.line}`
            : `${misses.length} near misses, last in ${last.name}: ${last.line}`,
      },
    ];
  });
}

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * The room's awards, in the order they are shown. `players` are the players still in the room
 * (as the podium ranks them); `rounds` describe the room's rounds in order.
 */
export function podiumAwards(
  players: readonly DuelPlayerRow[],
  results: readonly RoundResultRow[],
  rounds: readonly AwardRound[],
  tie?: TieRounds,
): PodiumAward[] {
  const inRoom = [...players].filter((p) => p.status !== "left").sort((a, b) => a.player_slot - b.player_slot);
  const rows = [...results].sort((a, b) => a.round_number - b.round_number || a.player_slot - b.player_slot);
  if (inRoom.length < 2 || rounds.length === 0) return [];
  const final = standings(inRoom, rows, rounds.length, new Map(), tie);
  const finalPlace = new Map(final.map((row) => [row.slot, row.position]));
  const candidates: Record<AwardId, Candidate[]> = {
    perfect: perfect(inRoom, rows, rounds),
    fastest: fastest(inRoom, rows, rounds),
    comeback: comeback(inRoom, rows, rounds, finalPlace, tie),
    close: close(inRoom, rows, rounds),
  };
  const given = new Map<number, number>();
  const awards: PodiumAward[] = [];
  for (const id of AWARD_ORDER) {
    const ranked = [...candidates[id]].sort(
      (a, b) =>
        Number(finalPlace.get(a.slot) === 1) - Number(finalPlace.get(b.slot) === 1) ||
        compare(a.key, b.key) ||
        (given.get(a.slot) ?? 0) - (given.get(b.slot) ?? 0) ||
        (finalPlace.get(a.slot) ?? 99) - (finalPlace.get(b.slot) ?? 99) ||
        a.slot - b.slot,
    );
    const pick = ranked[0];
    if (!pick) continue;
    given.set(pick.slot, (given.get(pick.slot) ?? 0) + 1);
    awards.push({ id, title: AWARD_TITLES[id], slot: pick.slot, line: pick.line });
  }
  return awards;
}
