/**
 * Room flow rules shared by the server (which decides) and the phones (which
 * show the same counts). Presentation pacing only: nothing here touches
 * grading, scoring or what a round contains.
 */
import {
  DISCONNECT_MS,
  FINISH_NOW_AWAY_MS,
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  type DuelPhase,
  type DuelPlayerRow,
} from "./types";

/** The between-round screens every player can tap Continue on. */
export type ContinuePhase = "result" | "standings";

export function isContinuePhase(
  phase: DuelPhase | string | null | undefined,
): phase is ContinuePhase {
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
export function allIntroReady(
  players: readonly DuelPlayerRow[],
  round: number,
  now: number,
): boolean {
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

/** How long a between-round screen waits at most. */
export function betweenScreenTimerMs(phase: ContinuePhase): number {
  return phase === "result" ? NEXT_ROUND_AUTO_MS : STANDINGS_MS;
}

/**
 * Whether a results or standings screen should move on now: its timer has run
 * out, everyone it waits for has tapped Continue, or (older clients) the host
 * pressed Next.
 */
export function betweenScreenDue(
  phase: ContinuePhase,
  elapsedMs: number,
  players: readonly DuelPlayerRow[],
  round: number,
  now: number,
  hostNext = false,
): boolean {
  return (
    hostNext || elapsedMs >= betweenScreenTimerMs(phase) || allContinued(players, round, phase, now)
  );
}

/** Unseen by the server for more than `awayMs`. */
function awayFor(player: DuelPlayerRow, now: number, awayMs: number): boolean {
  const seen = Date.parse(player.last_seen_at);
  return !(Number.isFinite(seen) && now - seen <= awayMs);
}

/**
 * The players other than `userId` who are gone: tapped Leave, or stopped
 * sending heartbeats (unseen for more than `awayMs`, DISCONNECT_MS unless a
 * rated room asks for its earlier banner).
 */
export function absentRivals(
  players: readonly DuelPlayerRow[],
  userId: string,
  now: number,
  awayMs: number = DISCONNECT_MS,
): DuelPlayerRow[] {
  return players.filter(
    (p) => p.user_id !== userId && (p.status === "left" || awayFor(p, now, awayMs)),
  );
}

/**
 * Whether the dropout banner shows: the caller is still here and every other
 * player has left or been unseen for more than `awayMs` (DISCONNECT_MS in an
 * ordinary room, RATED_AWAY_MS in a rated one).
 */
export function everyoneElseAway(
  players: readonly DuelPlayerRow[],
  userId: string,
  now: number,
  awayMs: number = DISCONNECT_MS,
): boolean {
  const me = players.find((p) => p.user_id === userId);
  if (!me || me.status === "left") return false;
  const others = players.filter((p) => p.user_id !== userId);
  return others.length > 0 && others.every((p) => p.status === "left" || awayFor(p, now, awayMs));
}

/**
 * "Finish now": allowed once the caller is the only player still here. The
 * caller must not have left, and everyone else must have left or been unseen
 * for FINISH_NOW_AWAY_MS (45 s). The server also refuses it in rated and
 * tournament rooms (finishGame's `matchRoom`).
 */
export function canFinishNow(
  players: readonly DuelPlayerRow[],
  userId: string,
  now: number,
): boolean {
  return everyoneElseAway(players, userId, now, FINISH_NOW_AWAY_MS);
}

/**
 * Whole seconds until Finish now is offered (0 once it is): the latest-seen
 * absent player's last sign of life plus FINISH_NOW_AWAY_MS. Players who
 * tapped Leave don't hold it back.
 */
export function finishNowInSeconds(
  players: readonly DuelPlayerRow[],
  userId: string,
  now: number,
): number {
  if (canFinishNow(players, userId, now)) return 0;
  const seen = players
    .filter((p) => p.user_id !== userId && p.status !== "left")
    .map((p) => Date.parse(p.last_seen_at))
    .filter(Number.isFinite);
  if (seen.length === 0) return 0;
  return Math.max(0, Math.ceil((Math.max(...seen) + FINISH_NOW_AWAY_MS - now) / 1000));
}

/**
 * The recorded outcome of a room that ended through "Finish now": the one
 * player still in the room wins, and everyone stored as left forfeited. The
 * final screen and the "previous games" history both read this, so they always
 * agree. Null for any other finish. Stored round scores are not involved.
 */
export function forfeitOutcome(
  room: { status: string; phase: DuelPhase | string | null; disbanded_at: string | null },
  players: readonly DuelPlayerRow[],
): { winner: DuelPlayerRow; forfeited: DuelPlayerRow[] } | null {
  if (!endedByForfeit(room)) return null;
  const remaining = players.filter((p) => p.status !== "left");
  if (remaining.length !== 1) return null;
  return { winner: remaining[0]!, forfeited: players.filter((p) => p.status === "left") };
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
