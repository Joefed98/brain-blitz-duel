/**
 * A rated match's stakes (phase 2 step 3, Joe 14 Nov 2026): what a player's Joulz Rating moves by for a win and for a
 * loss, "Win +N · Lose −N". Server only; read-only (nothing is written). The phone never works a rating out: it shows
 * these numbers or nothing.
 *
 *   matchStakes      a matched 1v1 (live or recorded): exact for this opponent and format. The win is the match won
 *                    outright on its dealt games (2–0 in a best of 3) and the loss the same games lost, each built through
 *                    the settle's own path (buildMatchResult, toRatingsResult) and worked out by the ratings engine's
 *                    previewRatedMatch, the same read and applyMatch recordRatedMatch applies. So settling that win or
 *                    that loss now applies exactly these changes (stakes-check proves it on a real database).
 *   estimateStakes   before matching (the Play page): the same against an opponent rated exactly as the player
 *                    (their own state mirrored), for the chosen format and choice.
 *
 * No stakes (null, the line hidden): a player still in placement (no Joulz Rating yet, or one this match would only
 * reveal), a match frozen against this opponent today, a format or choice the ratings engine doesn't rate, a player
 * who isn't in the match.
 *
 * The figure is the change the result screen shows: the rounded rating after less the rounded rating before
 * (w3Binding's `change`).
 */
import type { RatedMatchResult, RatedPlayerChange } from "@/lib/data/ratings";
import { readRatedMatch, readMatchPlayers } from "@/lib/data/rated.server";
import { readRoom } from "@/lib/data/rooms.server";
import type { Db } from "@/lib/data/db.server";
import { ACTIVE_PUZZLE_TYPES } from "@/lib/duel/catalogue";
import type { PuzzleData, RoundResultRow } from "@/lib/duel/types";

import { FORMAT_GAMES, type RatedChoice, type RatedFormat } from "./matchmaking";
import { poolAndCategory, ratingsFormat, toRatingsResult } from "./ratingsAdapter.server";
import { previewRatedMatch } from "./ratings.server";
import { buildMatchResult } from "./rated.server";

export interface Stakes {
  /** The Joulz Rating change for a win (0 or more). */
  win: number;
  /** The change for a loss (0 or less). */
  loss: number;
}

/** The change a result screen shows for this player, or null when there is no stake to show. */
export function stakeOf(change: RatedPlayerChange | undefined): number | null {
  if (!change || change.side !== "live" || change.frozen) return null;
  const { before, after } = change.joulz;
  if (before === null || after === null || change.placement.justFinished) return null;
  return Math.round(after) - Math.round(before);
}

const DUELS: readonly RatedFormat[] = ["bo3", "bo5", "bo7"];
const RATED_CHOICES_FOR_STAKES: readonly RatedChoice[] = ["mixed", "puzzles", "arcade"];

/** The games that decide a best of N outright (2 of 3, 3 of 5, 4 of 7). */
export const decidingGames = (format: RatedFormat): number => Math.floor(FORMAT_GAMES[format] / 2) + 1;

/** A settled match as the settle would build it, with `winner` winning every one of `games` (1–0 each). */
function outrightResult(input: Parameters<typeof buildMatchResult>[0], winnerId: string, nowMs: number): RatedMatchResult | null {
  const s = buildMatchResult(input);
  const n = input.puzzles.length;
  const forViewer = (id: string) => Array.from({ length: n }, () => (id === winnerId ? 1 : 0));
  for (const p of s.players) {
    p.scores = forViewer(p.userId);
    p.extras = p.extras.map(() => null);
  }
  if (s.recorded) {
    s.recorded.scores = forViewer(s.recorded.ownerId);
    s.recorded.extras = s.recorded.extras.map(() => null);
  }
  s.finishedAt = new Date(nowMs).toISOString();
  return toRatingsResult(s);
}

/** A matched 1v1's stakes for `userId` (see the file's comment). */
export async function matchStakes(client: Db, matchId: string, userId: string, nowMs: number = Date.now()): Promise<Stakes | null> {
  const { data: match } = await readRatedMatch(client, matchId);
  if (!match || !DUELS.includes(match.format as RatedFormat) || match.status !== "playing" || !match.duel_id) return null;
  if (!RATED_CHOICES_FOR_STAKES.includes(match.choice as RatedChoice)) return null;
  const { data: players } = await readMatchPlayers(client, matchId);
  if (!players?.some((p) => p.user_id === userId)) return null;
  const { data: room } = await readRoom(client, match.duel_id);
  const dealt = Array.isArray(room?.puzzles_public) ? (room.puzzles_public as unknown as PuzzleData[]) : [];
  const puzzles = dealt.slice(0, decidingGames(match.format as RatedFormat));
  if (puzzles.length < decidingGames(match.format as RatedFormat)) return null;
  const opponent = match.kind === "recorded" ? match.recorded_owner : players.find((p) => p.user_id !== userId)?.user_id;
  if (!opponent) return null;
  const base = { match, players, puzzles, results: [] as RoundResultRow[], finishedAt: new Date(nowMs).toISOString() };
  const change = async (winner: string) => {
    const result = outrightResult(base, winner, nowMs);
    const changes = result ? await previewRatedMatch(client, result, nowMs) : null;
    return stakeOf(changes?.find((c) => c.playerId === userId));
  };
  const win = await change(userId);
  const loss = await change(opponent);
  return win === null || loss === null ? null : { win, loss };
}

/** A representative live game of each pool (the estimate's games; only the pool moves the Joulz Rating). */
function sampleGame(pool: "puzzles" | "arcade"): string | null {
  return ACTIVE_PUZZLE_TYPES.find((t) => poolAndCategory(t)?.pool === pool) ?? null;
}

/** The estimate before matching: against an opponent rated exactly as the player (see the file's comment). */
export async function estimateStakes(client: Db, userId: string, format: RatedFormat, choice: RatedChoice, nowMs: number = Date.now()): Promise<Stakes | null> {
  if (!DUELS.includes(format) || !RATED_CHOICES_FOR_STAKES.includes(choice)) return null;
  const pools = Array.from({ length: decidingGames(format) }, (_, i) =>
    choice === "mixed" ? (i % 2 === 0 ? "puzzles" : "arcade") : choice === "arcade" ? "arcade" : "puzzles",
  );
  const games = pools.map((pool) => sampleGame(pool));
  if (games.some((g) => !g)) return null;
  const twin = crypto.randomUUID();
  const build = (winner: string): RatedMatchResult => ({
    matchId: crypto.randomUUID(),
    format: ratingsFormat(format),
    choice: choice as RatedMatchResult["choice"],
    players: [
      { playerId: userId, side: "live" },
      { playerId: twin, side: "live" },
    ],
    games: games.map((type) => {
      const pc = poolAndCategory(type!)!;
      return { type: type!, pool: pc.pool, category: pc.category, version: "classic", signature: "", scores: { [userId]: winner === userId ? 1 : 0, [twin]: winner === twin ? 1 : 0 } };
    }),
    rematchOf: null,
    finishedAt: new Date(nowMs).toISOString(),
  });
  const change = async (winner: string) => stakeOf((await previewRatedMatch(client, build(winner), nowMs, { id: twin, as: userId }))?.find((c) => c.playerId === userId));
  const win = await change(userId);
  const loss = await change(twin);
  return win === null || loss === null ? null : { win, loss };
}
