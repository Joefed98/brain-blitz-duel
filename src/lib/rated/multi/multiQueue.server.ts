/**
 * 4- and 8-player matches inside W3b's queue and settling (wave 3, W3d). Server only. W3b's `pollQueue` hands an ffa
 * searcher here, and its `settleMatch` hands a finished ffa match here; both use W3b's own data functions and
 * `createLiveMatch` (an ordinary started room, the same deals for every player), so nothing about the deal, timing or
 * grading differs from a 1v1.
 *
 * Recorded seats (after 15 s) are parked: a 4- or 8-player match has one set of deals, so its recorded seats must be the
 * other players of one earlier match on the same deals (W3b stores each settled match's runs, `rated:<match>:<user>`),
 * which needs W3b's recorded matches to hold more than one recorded seat (docs/rated/multiplayer.md, open question).
 * Until then a short group keeps searching, labelled with its wait.
 */
import { claimQueue, readWaiting, type RatedMatchPlayerRow, type RatedMatchRow } from "@/lib/data/rated.server";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import { FORMAT_PLAYERS, RATED_GAME_MODE, bandFor, gameVersionOf, isRatedChoice, isRatedFormat, type QueueEntry } from "@/lib/rated/matchmaking";
import type { RatedSettlement } from "@/lib/rated/ratingsAdapter.server";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";

import { groupFor } from "./queue";
import { finalPlacings, isMultiSize, type GameScore } from "./rules";

type Poll = { state: "searching"; waitedMs: number; band: number } | { state: "matched" };

/** W3b's pollQueue for an ffa searcher: a full group of live players makes the match through W3b's createLiveMatch. */
export async function pollMultiQueue(
  client: Db,
  me: QueueEntry,
  nowMs: number,
  createLiveMatch: (input: { matchId: string; format: QueueEntry["format"]; choice: QueueEntry["choice"]; players: QueueEntry[]; rematchOf: null }) => Promise<void>,
): Promise<Poll> {
  const size = FORMAT_PLAYERS[me.format];
  const waitedMs = nowMs - me.joinedAtMs;
  const { data: rows } = await readWaiting(client, me.format, me.choice);
  const waiting = (rows ?? [])
    .map((r): QueueEntry | null =>
      isRatedFormat(r.format) && isRatedChoice(r.choice)
        ? { userId: r.user_id, format: r.format, choice: r.choice, rating: r.rating, joinedAtMs: Date.parse(r.joined_at), placement: r.placement }
        : null,
    )
    .filter((e): e is QueueEntry => e !== null);
  const group = groupFor(me, waiting, size, nowMs);
  if (group) {
    const matchId = crypto.randomUUID();
    const { data: claimed } = await claimQueue(client, { users: group.map((g) => g.userId), matchId, format: me.format, choice: me.choice });
    if (claimed) {
      await createLiveMatch({ matchId, format: me.format, choice: me.choice, players: group, rematchOf: null });
      const { recordEvents } = await import("@/lib/data/events.server");
      recordEvents({ event: "multiplayer_match_started", props: { size, live_seats: size, recorded_seats: 0 } });
      return { state: "matched" };
    }
  }
  return { state: "searching", waitedMs, band: bandFor(waitedMs) };
}

/**
 * W3b's settlement for a 4- or 8-player match (its `RatedSettlement`, what the result screens read): each player's
 * stored scores and stored server grades (`extras`, W3a's gradeExtras: the server's own flag, `extra.flagged`) by slot,
 * and the final placings from the stored scores (rules.ts `finalPlacings`: points, then total score, level shared).
 * W3b's settleMatch then takes the same path as a 1v1: `toRatingsResult` (which reads the placings), W3a's
 * finishRatedMatch through `ratingsReady()`, markSettled and the stored runs. A match that started while its size was
 * on is always settled, whatever the switch says now.
 */
export function multiSettlement(input: {
  match: RatedMatchRow;
  players: RatedMatchPlayerRow[];
  puzzles: PuzzleData[];
  results: RoundResultRow[];
  finishedAt: string;
}): RatedSettlement {
  const size = FORMAT_PLAYERS[input.match.format as QueueEntry["format"]];
  if (!isMultiSize(size) || !isRatedChoice(input.match.choice)) throw new Error("Not a 4- or 8-player match.");
  const rowOf = (slot: number, i: number) => input.results.find((r) => r.player_slot === slot && r.round_number === i + 1);
  const seatOf = (slot: number) => `slot:${slot}`;
  const games: GameScore[][] = input.puzzles.map((_, i) => input.players.map((p) => ({ seatId: seatOf(p.slot), score: rowOf(p.slot, i)?.score ?? 0 })));
  const placings = finalPlacings(size, input.players.map((p) => seatOf(p.slot)), games);
  const placeOf = new Map(placings.map((p) => [p.seatId, p.place]));
  return {
    matchId: input.match.id,
    format: input.match.format as RatedSettlement["format"],
    choice: input.match.choice as RatedSettlement["choice"],
    gameMode: RATED_GAME_MODE,
    kind: "live",
    rematchOf: input.match.rematch_of,
    finishedAt: input.finishedAt,
    players: input.players.map((p) => {
      const scores = input.puzzles.map((_, i) => rowOf(p.slot, i)?.score ?? 0);
      const extras = input.puzzles.map((_, i) => {
        const extra = rowOf(p.slot, i)?.extra;
        return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : null;
      });
      return { userId: p.user_id, slot: p.slot, ratingBefore: p.rating_before, placement: p.placement, scores, timesMs: scores.map(() => 0), extras, gamesWon: 0, total: scores.reduce((a, b) => a + b, 0) };
    }),
    games: input.puzzles.map((p) => ({ type: p.type, signature: gameVersionOf(p), winner: "draw" as const })),
    winner: "draw",
    recorded: null,
    ratings: null,
    placings: Object.fromEntries(input.players.map((p) => [p.user_id, placeOf.get(seatOf(p.slot)) ?? input.players.length])),
  };
}

/** One `multiplayer_match_finished` per live player once W3a has recorded the match (not on a duplicate). */
export function recordMultiFinished(s: RatedSettlement): void {
  if (!s.placings || !s.ratings?.ok || s.ratings.status !== "recorded") return;
  const size = FORMAT_PLAYERS[s.format];
  recordEvents(
    s.players.map((p) => ({ event: "multiplayer_match_finished" as const, playerId: p.userId, props: { size, placing: s.placings![p.userId] ?? s.players.length } })),
  );
}
