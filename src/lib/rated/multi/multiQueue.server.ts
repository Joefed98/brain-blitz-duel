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
import { FORMAT_PLAYERS, bandFor, gameVersionOf, isRatedChoice, isRatedFormat, type QueueEntry } from "@/lib/rated/matchmaking";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";

import { finishMultiMatch, type MultiFinish } from "./multi.server";
import { groupFor, ratedPoolOf } from "./queue";
import { isMultiSize, type MultiSeat } from "./rules";

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
 * W3b's settleMatch for an ffa match: the seats from the match's players, every game's stored scores by slot, the final
 * placings, W3a's recordRatedMatch (through finishMultiMatch) and the finish events. A match that started while its
 * size was on is always finished, whatever the switch says now.
 */
export async function settleMultiMatch(input: {
  match: RatedMatchRow;
  players: RatedMatchPlayerRow[];
  puzzles: PuzzleData[];
  results: RoundResultRow[];
  finishedAt: string;
}): Promise<MultiFinish> {
  const size = FORMAT_PLAYERS[input.match.format as QueueEntry["format"]];
  if (!isMultiSize(size) || !isRatedChoice(input.match.choice) || !["mixed", "puzzles", "arcade"].includes(input.match.choice))
    throw new Error("Not a 4- or 8-player match.");
  // W3a's result carries player ids, never names.
  const seats: MultiSeat[] = input.players.map((p) => ({ seatId: `slot:${p.slot}`, playerId: p.user_id, name: "", recorded: false }));
  const games = input.puzzles.map((puzzle, i) => ({
    type: puzzle.type,
    ...ratedPoolOf(puzzle.type),
    signature: gameVersionOf(puzzle),
    scores: input.players.map((p) => ({
      seatId: `slot:${p.slot}`,
      score: input.results.find((r) => r.player_slot === p.slot && r.round_number === i + 1)?.score ?? 0,
    })),
  }));
  return finishMultiMatch(
    { matchId: input.match.id, size, choice: input.match.choice as "mixed" | "puzzles" | "arcade", seats, games, finishedAt: input.finishedAt },
    { switches: { ffa4: true, ffa8: true } },
  );
}
