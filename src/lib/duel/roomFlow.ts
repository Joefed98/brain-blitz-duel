/**
 * Room flow rules shared by the server (which decides) and the phones (which
 * show the same counts). Presentation pacing only: nothing here touches
 * grading, scoring or what a round contains.
 */
import { DISCONNECT_MS, type DuelPhase, type DuelPlayerRow } from "./types";

/** The between-round screens every player can tap Continue on. */
export type ContinuePhase = "result" | "standings";

export function isContinuePhase(phase: DuelPhase | string | null | undefined): phase is ContinuePhase {
  return phase === "result" || phase === "standings";
}

/**
 * A player's Continue tap is stored in `duel_players.ready_round` (otherwise
 * unused) as one rising mark per screen: round r's results are 2r, its
 * standings 2r + 1. A mark at or past the screen's own means "continued".
 * The rematch reset puts it back to 0.
 */
export function continueMark(round: number, phase: ContinuePhase): number {
  return round * 2 + (phase === "standings" ? 1 : 0);
}

export function hasContinued(player: DuelPlayerRow, round: number, phase: ContinuePhase): boolean {
  return player.ready_round >= continueMark(round, phase);
}

/** Seen by the server within the disconnect window. */
export function isConnected(player: DuelPlayerRow, now: number): boolean {
  const seen = Date.parse(player.last_seen_at);
  return Number.isFinite(seen) && now - seen <= DISCONNECT_MS;
}

/**
 * Who a Ready or Continue screen waits for: active players who are still
 * connected. Someone who has dropped out never holds the room; the screen's
 * own timer is always the maximum wait.
 */
export function waitedOn(players: readonly DuelPlayerRow[], now: number): DuelPlayerRow[] {
  return players.filter((p) => p.status === "active" && isConnected(p, now));
}

/** True once every player the intro waits for has tapped Ready. */
export function allIntroReady(players: readonly DuelPlayerRow[], round: number, now: number): boolean {
  const waiting = waitedOn(players, now);
  return waiting.length > 0 && waiting.every((p) => p.intro_ready_round >= round);
}

/** True once every player the screen waits for has tapped Continue. */
export function allContinued(
  players: readonly DuelPlayerRow[],
  round: number,
  phase: ContinuePhase,
  now: number,
): boolean {
  const waiting = waitedOn(players, now);
  return waiting.length > 0 && waiting.every((p) => hasContinued(p, round, phase));
}

/**
 * The players other than `userId` who started this game with them and are now
 * gone: tapped Leave, or stopped sending heartbeats.
 */
export function absentRivals(players: readonly DuelPlayerRow[], userId: string, now: number): DuelPlayerRow[] {
  return players.filter((p) => p.user_id !== userId && (p.status === "left" || !isConnected(p, now)));
}

/**
 * "Finish now": allowed once the caller is the only player still here. The
 * caller must not have left, and everyone else must have left or dropped out.
 */
export function canFinishNow(players: readonly DuelPlayerRow[], userId: string, now: number): boolean {
  const me = players.find((p) => p.user_id === userId);
  if (!me || me.status === "left") return false;
  const others = players.filter((p) => p.user_id !== userId);
  return others.length > 0 && others.every((p) => p.status === "left" || !isConnected(p, now));
}

/**
 * A room that ended through "Finish now" (rather than the timed winner reveal
 * or the old final standings, or a disband). The players who were gone at that
 * moment are stored as left; the one who stayed is shown the win.
 */
export function endedByForfeit(room: {
  status: string;
  phase: DuelPhase | string | null;
  disbanded_at: string | null;
}): boolean {
  return (
    room.status === "finished" &&
    !room.disbanded_at &&
    room.phase !== "winner_reveal" &&
    room.phase !== "standings"
  );
}
