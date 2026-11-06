/**
 * This device's own room history (Profile, Tournaments, the Play tab's "Rejoin" row). Device
 * storage only: nothing here is sent anywhere, read by grading, or written to the room.
 *
 * Why on the device: the server cannot answer "how did this device do?" for every game. Play again
 * resets the room in place (restart_duel_room deletes the round results and the players who left,
 * keeping only the winner's name and score), so a device's places in earlier games of a room are
 * gone from the server. The room screen therefore records each finished game it shows, keyed by
 * room and game number, with the place and points the final screen shows (standings, or a "Finish
 * now" forfeit). Games before this was added, games this device left before the end and games on
 * another device are not counted.
 */
import { useEffect } from "react";

import { forfeitOutcome } from "./roomFlow";
import { standings, totalScore } from "./scoring";
import { roomTieRounds } from "./tieBreak";
import { TOTAL_ROUNDS, type DuelPlayerRow, type DuelRow, type RoundResultRow } from "./types";

export interface RoomRecord {
  /** `${duel id}:${game number in the room}`: one record per finished game. */
  key: string;
  code: string;
  /** When this device first saw the game finished (ms). */
  at: number;
  /** Players still in the room at the end. */
  players: number;
  /** Final place (1 = won, ties share), or null when this device had left or forfeited. */
  place: number | null;
  points: number;
}

const HISTORY_KEY = "duelz-room-history:v1";
const LAST_ROOM_KEY = "duelz-last-room:v1";
const KEEP = 200;
let memory: RoomRecord[] | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function valid(value: unknown): value is RoomRecord {
  const r = value as RoomRecord;
  return (
    !!r &&
    typeof r.key === "string" &&
    typeof r.code === "string" &&
    Number.isFinite(r.at) &&
    Number.isFinite(r.players) &&
    Number.isFinite(r.points) &&
    (r.place === null || Number.isFinite(r.place))
  );
}

/** Every recorded game, newest first. */
export function readRoomHistory(): RoomRecord[] {
  if (memory) return memory;
  try {
    const raw = JSON.parse(storage()?.getItem(HISTORY_KEY) ?? "[]") as unknown;
    memory = Array.isArray(raw) ? raw.filter(valid).sort((a, b) => b.at - a.at) : [];
  } catch {
    memory = [];
  }
  return memory;
}

/** Adds or refreshes one game (its first-seen time is kept). */
export function recordRoomGame(record: RoomRecord): void {
  const history = readRoomHistory();
  const before = history.find((r) => r.key === record.key);
  const next = { ...record, at: before?.at ?? record.at };
  if (before && JSON.stringify(before) === JSON.stringify(next)) return;
  memory = [next, ...history.filter((r) => r.key !== record.key)]
    .sort((a, b) => b.at - a.at)
    .slice(0, KEEP);
  try {
    storage()?.setItem(HISTORY_KEY, JSON.stringify(memory));
  } catch {
    /* session-only when storage is blocked */
  }
}

export interface RoomStats {
  played: number;
  wins: number;
  /** Top-three finishes in rooms of three or more (where the room shows a podium). */
  podiums: number;
}

export function roomStats(history: readonly RoomRecord[]): RoomStats {
  return {
    played: history.length,
    wins: history.filter((r) => r.place === 1).length,
    podiums: history.filter((r) => r.players >= 3 && r.place !== null && r.place <= 3).length,
  };
}

/** The place and points this device's player finished a game with (as the final screen shows). */
export function gameRecord(
  duel: DuelRow,
  players: readonly DuelPlayerRow[],
  results: RoundResultRow[],
  me: DuelPlayerRow,
): RoomRecord {
  const inRoom = players.filter((p) => p.status !== "left");
  const forfeit = forfeitOutcome(duel, players);
  const table = standings(
    [...players],
    results,
    duel.round_count ?? TOTAL_ROUNDS,
    undefined,
    roomTieRounds(duel.puzzles_public),
  );
  const place = forfeit
    ? forfeit.winner.user_id === me.user_id
      ? 1
      : null
    : me.status === "left"
      ? null
      : (table.find((row) => row.slot === me.player_slot)?.position ?? null);
  return {
    key: `${duel.id}:${duel.tournament_history?.length ?? 0}`,
    code: duel.room_code,
    at: Date.now(),
    players: Math.max(inRoom.length, forfeit ? 1 : 0),
    place,
    points: totalScore(results, me.player_slot),
  };
}

/* --------------------------------------------------------------- the last room */

export interface LastRoom {
  code: string;
  at: number;
}

export function readLastRoom(): LastRoom | null {
  try {
    const raw = JSON.parse(storage()?.getItem(LAST_ROOM_KEY) ?? "null") as LastRoom | null;
    return raw && typeof raw.code === "string" && /^[A-Z0-9]{4}$/.test(raw.code) ? raw : null;
  } catch {
    return null;
  }
}

export function rememberLastRoom(code: string): void {
  try {
    const current = readLastRoom();
    if (current?.code === code) return;
    storage()?.setItem(LAST_ROOM_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* storage is a nicety */
  }
}

/**
 * The room screen's one hook: remembers the room this device is in (for "Rejoin your last room")
 * and records each finished game it shows. Never changes what the room screen draws.
 */
export function useDeviceRoomRecord(state: {
  duel: DuelRow | null;
  players: DuelPlayerRow[];
  results: RoundResultRow[];
  me: DuelPlayerRow | null;
}): void {
  const { duel, players, results, me } = state;
  const member = !!duel && !!me && me.status !== "left";
  useEffect(() => {
    if (member && duel) rememberLastRoom(duel.room_code);
  }, [member, duel?.room_code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!duel || !me || duel.status !== "finished" || duel.disbanded_at) return;
    recordRoomGame(gameRecord(duel, players, results, me));
  }, [duel, players, results, me]);
}
