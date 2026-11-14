/**
 * What the 4- and 8-player screens read (wave 3, W3d), for W3c's format slot (src/components/rated/formatScreens.tsx).
 * W3c's `RatedResult` is a 1v1's (me and them), so the final screen and the standings between games read every seat
 * here, from the same server calls W3c's binding makes: W3b's `ratedSettleFn` (its public settlement: each player's
 * stored scores, the stored placings and W3a's answer for every player) and `ratedMatchFn` (names and guest tags), and,
 * between games, the room's own results (the phone's RLS reads, as the room's round results screen). Nothing here works
 * out a rating, a place the server didn't store or Joules.
 *
 * The real binding is behind W3c's `ratedBackend()` gate: under automation it stays off unless the page allows it, and a
 * check stands in with `setMultiViewPort` (ignored in a production build).
 */
import type { CardLook } from "@/design/identity";
import type { RatedPlayerChange } from "@/lib/data/ratings";
import type { RankView } from "@/lib/rated/tierDisplay";

import { finalPlacings, isMultiSize, standingsAfter, type GameScore, type MultiSize, type StandingRow } from "./rules";

/** One seat as the screens draw it. */
export interface MultiSeatInfo {
  seatId: string;
  userId: string | null;
  name: string;
  guest: boolean;
  recorded: boolean;
  you: boolean;
  card: CardLook | null;
  rank: RankView | null;
  /** Left the match (W3b's leaving rule, Joe 12 Nov 2026): placed below everyone who stayed, no Joules. */
  left: boolean;
}

export interface MultiFinalData {
  size: MultiSize;
  rows: StandingRow[];
  seats: MultiSeatInfo[];
  /** Each live player's rating change by seat id (W3a's answer: moved players only). */
  changes: Map<string, number>;
  /** W3b's forfeit: who left, in the order they went (empty for a match played out by everyone). */
  leavers: string[];
}

export interface MultiStandingsData {
  size: MultiSize;
  game: number;
  games: number;
  rows: StandingRow[];
  seats: MultiSeatInfo[];
  headline: { gameType: string; winnerName: string; yourPlace: number; yourPoints: number };
  next: { gameType: string } | null;
}

/** The match's players as W3b's match view names them. */
export interface ViewPlayer {
  userId: string;
  slot: number;
  displayName: string;
  guest: boolean;
}

/** W3b's public settlement, the parts read here. */
export interface SettledView {
  format: string;
  players: { userId: string; slot: number; scores: number[] }[];
  games: { type: string }[];
  placings?: Record<string, number> | null;
  ending?: { kind: "forfeit"; leavers: string[] } | null;
  ratings: { ok: true; players: Pick<RatedPlayerChange, "playerId" | "moved" | "joulz" | "tier">[] } | { ok: false } | null;
}

export const seatIdOf = (slot: number) => `slot:${slot}`;
export const sizeOfFormat = (format: string): MultiSize | null => (format === "ffa4" ? 4 : format === "ffa8" ? 8 : null);

function seatsOf(players: readonly ViewPlayer[], meId: string, extra?: (p: ViewPlayer) => Partial<MultiSeatInfo>): MultiSeatInfo[] {
  return players
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((p) => ({
      seatId: seatIdOf(p.slot),
      userId: p.userId,
      name: p.displayName,
      guest: p.guest,
      recorded: false,
      you: p.userId === meId,
      card: null,
      rank: null,
      left: false,
      ...(extra?.(p) ?? {}),
    }));
}

/**
 * The final screen from the stored settlement: the placings by the same rule the server stored them with (rules.ts),
 * each moved player's change (W3a's before and after, rounded as W3c rounds the 1v1's) and tier.
 */
export function multiFinalFrom(settled: SettledView, players: readonly ViewPlayer[], meId: string): MultiFinalData | null {
  const size = sizeOfFormat(settled.format);
  if (!size) return null;
  const answer = settled.ratings && settled.ratings.ok ? settled.ratings.players : [];
  const changeOf = new Map(answer.map((c) => [c.playerId, c]));
  const leavers = settled.ending?.kind === "forfeit" ? settled.ending.leavers : [];
  const seats = seatsOf(players, meId, (p) => {
    const c = changeOf.get(p.userId);
    return {
      rank: c?.moved && c.tier.after && c.joulz.after !== null ? { ...c.tier.after, rating: c.joulz.after } : null,
      left: leavers.includes(p.userId),
    };
  });
  const scoresOf = new Map(settled.players.map((p) => [p.slot, p.scores]));
  const games: GameScore[][] = settled.games.map((_, i) => players.map((p) => ({ seatId: seatIdOf(p.slot), score: scoresOf.get(p.slot)?.[i] ?? 0 })));
  const byPoints = finalPlacings(size, seats.map((s) => s.seatId), games);
  // The places the server stored (W3d's points-then-total order with W3b's leaver rule) when it has them.
  const userOf = new Map(players.map((p) => [seatIdOf(p.slot), p.userId]));
  const stored = settled.placings ?? null;
  const placeOf = (seatId: string, fallback: number) => stored?.[userOf.get(seatId) ?? ""] ?? fallback;
  const rows = byPoints
    .map((r) => ({ ...r, place: placeOf(r.seatId, r.place) }))
    .sort((a, b) => a.place - b.place);
  const changes = new Map<string, number>();
  for (const p of players) {
    const c = changeOf.get(p.userId);
    if (c?.moved && c.joulz.before !== null && c.joulz.after !== null) changes.set(seatIdOf(p.slot), Math.round(c.joulz.after) - Math.round(c.joulz.before));
  }
  return { size, rows, seats, changes, leavers: [...leavers] };
}

/** The standings after the games played so far, from the room's stored results (a missing row scores 0). */
export function multiStandingsFrom(input: {
  format: string;
  players: readonly ViewPlayer[];
  /** The match's games in order. */
  gameTypes: readonly string[];
  results: readonly { player_slot: number; round_number: number; score: number | null }[];
  meId: string;
  /** Players who have left the match (the room marks their seat `left`): below everyone who stayed, tagged. */
  leftUserIds?: readonly string[];
}): MultiStandingsData | null {
  const size = sizeOfFormat(input.format);
  if (!size) return null;
  const played = Math.min(input.gameTypes.length, Math.max(0, ...input.results.map((r) => r.round_number)));
  if (played < 1) return null;
  const left = new Set(input.leftUserIds ?? []);
  const seats = seatsOf(input.players, input.meId, (p) => ({ left: left.has(p.userId) }));
  const scoreOf = (slot: number, round: number) => input.results.find((r) => r.player_slot === slot && r.round_number === round)?.score ?? 0;
  const games: GameScore[][] = Array.from({ length: played }, (_, i) => input.players.map((p) => ({ seatId: seatIdOf(p.slot), score: scoreOf(p.slot, i + 1) })));
  // The players who stayed in their standings order and places; leavers after them (W3b's rule).
  const goneSeat = new Set(seats.filter((s) => s.left).map((s) => s.seatId));
  const all = standingsAfter(size, seats.map((s) => s.seatId), games);
  const stayers = all.filter((r) => !goneSeat.has(r.seatId));
  const rows = [
    ...stayers.map((r) => ({ ...r, place: 1 + stayers.filter((o) => o.place < r.place).length })),
    ...all.filter((r) => goneSeat.has(r.seatId)).map((r) => ({ ...r, place: stayers.length + 1 })),
  ];
  const mine = rows.find((r) => seats.find((s) => s.seatId === r.seatId)?.you);
  const winner = rows.slice().sort((a, b) => (a.gamePlace ?? 99) - (b.gamePlace ?? 99))[0];
  return {
    size,
    game: played,
    games: input.gameTypes.length,
    rows,
    seats,
    headline: {
      gameType: input.gameTypes[played - 1] ?? "",
      winnerName: seats.find((s) => s.seatId === winner?.seatId)?.name ?? "",
      yourPlace: mine?.gamePlace ?? 0,
      yourPoints: mine?.gamePoints ?? 0,
    },
    next: played < input.gameTypes.length ? { gameType: input.gameTypes[played]! } : null,
  };
}

/* ------------------------------------------------------------------ the port */

export interface MultiViewPort {
  final(matchId: string): Promise<MultiFinalData | null>;
  standings(matchId: string): Promise<MultiStandingsData | null>;
}

let override: MultiViewPort | null | undefined;

/** Checks only: stands in for the server (null: none; undefined: the real binding). Ignored in a production build. */
export function setMultiViewPort(port: MultiViewPort | null | undefined): void {
  if (import.meta.env.PROD) return;
  override = port;
}

let bound: Promise<MultiViewPort | null> | null = null;

export function multiViewPort(): Promise<MultiViewPort | null> {
  if (override !== undefined && !import.meta.env.PROD) return Promise.resolve(override);
  bound ??= (async () => {
    const { ratedBackend } = await import("@/lib/rated/backend");
    // W3c's gate: no rated server under automation unless the page allows it, never a check override in production.
    if (!(await ratedBackend())) return null;
    return bindMultiView();
  })().catch(() => null);
  return bound;
}

async function bindMultiView(): Promise<MultiViewPort> {
  const rated = await import("@/lib/rated/rated.functions");
  const { currentUserId } = await import("@/lib/duel/session");
  const { identityBackend } = await import("@/lib/identity/backend");
  const { lookOf } = await import("@/lib/rated/w3Binding");
  const { supabase } = await import("@/integrations/supabase/client");
  const { readRoomById, readRoomResultRows } = await import("@/lib/data/roomReads");
  const me = async () => (await currentUserId()) ?? "";

  async function withCards(seats: MultiSeatInfo[]): Promise<MultiSeatInfo[]> {
    const id = await identityBackend();
    return Promise.all(
      seats.map(async (s) => {
        if (s.guest || !s.userId || !id) return s;
        const card = await id.getPublicCard(s.userId).catch(() => null);
        if (!card) return s;
        const loadout = card.loadout ?? null;
        return { ...s, name: card.username ?? s.name, card: lookOf(loadout, loadout?.avatar?.colour ?? null) };
      }),
    );
  }

  return {
    async final(matchId) {
      const [settled, view, meId] = await Promise.all([
        rated.ratedSettleFn({ data: { matchId } }),
        rated.ratedMatchFn({ data: { matchId } }),
        me(),
      ]);
      if (settled.state !== "settled" || !view) return null;
      const data = multiFinalFrom(settled.result, view.players, meId);
      return data ? { ...data, seats: await withCards(data.seats) } : null;
    },
    async standings(matchId) {
      const [view, meId] = await Promise.all([rated.ratedMatchFn({ data: { matchId } }), me()]);
      if (!view?.roomId) return null;
      const signal = new AbortController().signal;
      const [room, results] = await Promise.all([
        readRoomById(supabase, view.roomId, signal),
        readRoomResultRows(supabase, view.roomId, "player_slot, round_number, score", signal),
      ]);
      const { readRoomPlayers } = await import("@/lib/data/roomReads");
      const roomPlayers = await readRoomPlayers(supabase, view.roomId, signal);
      if (!room.data) return null;
      const data = multiStandingsFrom({
        format: view.format,
        players: view.players,
        // The game types from the stored round order (Security C1a: a new room's puzzles arrive round by round).
        gameTypes: (room.data.round_order ?? []) as readonly string[],
        results: (results.data ?? []) as unknown as { player_slot: number; round_number: number; score: number | null }[],
        meId,
        leftUserIds: (roomPlayers.data ?? []).filter((p) => p.status === "left").map((p) => p.user_id),
      });
      return data ? { ...data, seats: await withCards(data.seats) } : null;
    },
  };
}

export { isMultiSize };
