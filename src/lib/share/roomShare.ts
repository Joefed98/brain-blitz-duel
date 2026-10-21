/**
 * What a room's final screen shares (ShareResultButton → shareResult): the text, the link and the
 * results card's data. Built only from what the final screen already shows every player — place,
 * totals, the top three's names, the round games and the room code — never an answer, a puzzle, a
 * board or a round's details (share-check proves no answer reaches it).
 */
import { APP_NAME } from "@/lib/brand";
import { gameRecord } from "@/lib/duel/deviceHistory";
import { ordinal } from "@/lib/duel/ordinal";
import { linkRoomState } from "@/lib/duel/roomLink";
import { standings } from "@/lib/duel/scoring";
import { roomTieRounds } from "@/lib/duel/tieBreak";
import {
  MAX_PLAYERS,
  TOTAL_ROUNDS,
  type DuelPlayerRow,
  type DuelRow,
  type RoundResultRow,
  type StoredPuzzleType,
} from "@/lib/duel/types";

/** The query a shared link carries, so an arrival from it can be counted (shareRef.ts). */
export const SHARE_REF = "share";

export interface RoomShareTop {
  place: number;
  name: string;
  total: number;
}

export interface RoomShareData {
  title: string;
  /** The message lines (shareResult adds "Play: <link>"). */
  lines: string[];
  link: string;
  /** True when the link is the room's own (joinable right now), false for the app's home. */
  linksRoom: boolean;
  /** The sharer's place (ties share it), or null after leaving or a forfeit loss. */
  place: number | null;
  total: number;
  players: number;
  rounds: number;
  /** The top three as the podium shows them (ties share a place, so there may be fewer distinct places). */
  top: RoomShareTop[];
  /** The round games in order (their icons on the card). */
  games: StoredPuzzleType[];
  roomCode: string;
  /** For the beta recording: which room and which game in it. */
  duelId: string;
  gameIndex: number;
}

/**
 * "Joinable": a newcomer opening the room's link could join it right now — the room is in its lobby
 * (waiting for the next game, not disbanded; roomLink.ts linkRoomState) with a seat free. A finished
 * room is never joinable, even before Play again: its link only says "This game has finished", so a
 * share from the final screen links the app's home.
 */
export function roomJoinable(
  duel: Pick<DuelRow, "status" | "disbanded_at" | "max_players">,
  players: readonly DuelPlayerRow[],
): boolean {
  if (linkRoomState(duel) !== "lobby") return false;
  const seated = players.filter((p) => p.status !== "left").length;
  return seated < (duel.max_players ?? MAX_PLAYERS);
}

/** The shared link: the room's link while a newcomer can join it, else the app's home; both carry ?ref=share. */
export function roomShareLink(origin: string, roomCode: string, joinable: boolean): string {
  const base = origin.replace(/\/+$/, "");
  return joinable ? `${base}/duel/${roomCode}?ref=${SHARE_REF}` : `${base}/?ref=${SHARE_REF}`;
}

/** "I came 2nd in a 6-round Duelz room – 612 pts." (or "I played …" without a place). */
export function roomShareLine(place: number | null, rounds: number, total: number): string {
  const room = `a ${rounds}-round ${APP_NAME} room`;
  const pts = `${total} pts`;
  return place ? `I came ${ordinal(place)} in ${room} – ${pts}.` : `I played ${room} – ${pts}.`;
}

export function roomShareData(input: {
  duel: DuelRow;
  players: readonly DuelPlayerRow[];
  results: RoundResultRow[];
  me: DuelPlayerRow;
  origin: string;
}): RoomShareData {
  const { duel, players, results, me } = input;
  const record = gameRecord(duel, players, results, me);
  const rounds = duel.round_count ?? (duel.round_order?.length || TOTAL_ROUNDS);
  const table = standings(
    [...players],
    results,
    rounds,
    undefined,
    roomTieRounds(duel.puzzles_public),
  );
  const joinable = roomJoinable(duel, players);
  const link = roomShareLink(input.origin, duel.room_code, joinable);
  return {
    title: `${APP_NAME} results`,
    lines: [roomShareLine(record.place, rounds, record.points)],
    link,
    linksRoom: joinable,
    place: record.place,
    total: record.points,
    players: record.players,
    rounds,
    top: table
      .filter((row) => row.position <= 3)
      .slice(0, 3)
      .map((row) => ({ place: row.position, name: row.name, total: row.total })),
    games: [...(duel.round_order ?? [])].slice(0, rounds),
    roomCode: duel.room_code,
    duelId: duel.id,
    gameIndex: duel.tournament_history?.length ?? 0,
  };
}
