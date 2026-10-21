/**
 * What a room's final screen shares (ShareResultButton → shareResult): the text, the link and the
 * results card's data. Built only from what the final screen already shows every player — place,
 * totals, the top three's names, the round games and the room code — never an answer, a puzzle, a
 * board or a round's details (share-check proves no answer reaches it).
 */
import { APP_NAME } from "@/lib/brand";
import { gameRecord } from "@/lib/duel/deviceHistory";
import { ordinal } from "@/lib/duel/ordinal";
import { standings } from "@/lib/duel/scoring";
import { roomTieRounds } from "@/lib/duel/tieBreak";
import {
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
 * The shared link: always the room's own, with ?ref=share. Where it leads is decided when it's
 * opened, not when it's shared (JoinFromLink → shareRef.ts shareLinkJoinable): straight to the lobby
 * while a newcomer can join, else the home with the welcome card. So friends who open it after the
 * host presses Play again join the next game.
 */
export function roomShareLink(origin: string, roomCode: string): string {
  return `${origin.replace(/\/+$/, "")}/duel/${roomCode}?ref=${SHARE_REF}`;
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
  const link = roomShareLink(input.origin, duel.room_code);
  return {
    title: `${APP_NAME} results`,
    lines: [roomShareLine(record.place, rounds, record.points)],
    link,
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
