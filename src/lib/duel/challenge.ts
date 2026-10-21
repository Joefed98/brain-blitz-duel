/**
 * Friend challenges (22 Oct 2026), shared by the phone and the server: a set of rounds one player
 * deals and plays alone (or a finished room's set, with that room's players already on it), which
 * friends then play from a link at their own time, on their own clock, against the earlier players'
 * stored results. Built on the async-room engine (asyncRoom.ts, asyncRoom.server.ts): a challenge is
 * an async room of kind "challenge" under the key "challenge:<CODE>". Pure: callers pass "now".
 *
 * - Up to CHALLENGE_MAX_PLAYERS attempts per challenge (one per device); the link lasts
 *   CHALLENGE_DAYS from creation (no round starts after it).
 * - The earlier players are the attempts that had finished when the caller's own attempt started
 *   (the room's players, for a challenge made from a room): a fixed set for the whole run.
 * - During a round the phone hears only which earlier players had finished by now on their own
 *   clocks ("finished ✓", the room's pings), never how they did. A round's results (scores,
 *   verdicts, summaries) arrive only once the caller's own result for that round is stored, and
 *   only for that round and the ones before it, as a room's do after its round closes. Answers never
 *   leave the server: an earlier player's row reaches the phone as rivalRow() shapes it.
 */
import { finishedBeforeBuzzer } from "./buzzer";
import { normaliseCategories } from "./categories";
import { puzzlePrepMs, puzzleTimeLimitMs, typesInCategory } from "./registry";
import { roomRoundCount } from "./selection";
import { ordinal } from "./ordinal";
import type { AwardRound } from "./podiumAwards";
import type { TieRound } from "./scoring";
import type {
  PlayerRoundDetail,
  PuzzleCategory,
  PuzzleData,
  RoundResultRow,
  StoredPuzzleType,
} from "./types";

/** The async room kind a challenge is stored as (async_rooms.kind). */
export const CHALLENGE_ROOM_KIND = "challenge";
/** Attempts a challenge takes, the creator's (and an imported room's players) included. */
export const CHALLENGE_MAX_PLAYERS = 20;
/** How long a challenge link stays open. */
export const CHALLENGE_DAYS = 7;
export const CHALLENGE_OPEN_MS = CHALLENGE_DAYS * 86_400_000;
/** The fewest and most rounds a challenge deals (async_rooms.round_count is 1–10). */
export const CHALLENGE_MIN_ROUNDS = 3;
export const CHALLENGE_MAX_ROUNDS = 10;
/** The query a challenge link carries (?ref=challenge), so an arrival from it can be counted. */
export const CHALLENGE_REF = "challenge";

/** Challenge codes: 6 letters and digits that can't be misread (no I, L, O, 0, 1). */
export const CHALLENGE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CHALLENGE_CODE_LENGTH = 6;
const CODE_RE = new RegExp(`^[${CHALLENGE_CODE_ALPHABET}]{${CHALLENGE_CODE_LENGTH}}$`);

export function isChallengeCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

/** A code typed or pasted any way: upper-cased, everything else dropped. */
export function challengeCodeFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return isChallengeCode(code) ? code : null;
}

/** "challenge:K7QM2X": one async room per challenge (async_rooms.room_key, unique). */
export function challengeRoomKey(code: string): string {
  return `${CHALLENGE_ROOM_KIND}:${code}`;
}

/** The link a challenge is shared as: always this challenge's own page, with ?ref=challenge. */
export function challengeLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/challenge?code=${code}&ref=${CHALLENGE_REF}`;
}

/** The round counts the create screen offers: 3, the room lobby's own count for the categories (6, or 7 with all seven), and 10. */
export function challengeRoundChoices(categories: readonly PuzzleCategory[]): number[] {
  const most = Math.min(CHALLENGE_MAX_ROUNDS, challengePoolSize(categories));
  return [
    ...new Set(
      [CHALLENGE_MIN_ROUNDS, roomRoundCount(categories), CHALLENGE_MAX_ROUNDS].map((n) =>
        Math.min(n, most),
      ),
    ),
  ]
    .filter((n) => n >= 1)
    .sort((a, b) => a - b);
}

export function validChallengeRounds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= CHALLENGE_MIN_ROUNDS &&
    value <= CHALLENGE_MAX_ROUNDS
  );
}

/* ---------------------------------------------------------- what the phone gets */

/** One player on a challenge, as every phone may see them (no device id, no result). */
export interface ChallengePlayer {
  slot: number;
  name: string;
  colour: number | null;
  icon: string | null;
}

export type ChallengeState =
  | "play"
  | "continue"
  | "done"
  /** The link has expired. */
  | "closed"
  /** CHALLENGE_MAX_PLAYERS have played and this device hasn't. */
  | "full";

/** What a challenge link shows before playing (challengeInfo). */
export type ChallengeInfo =
  | { found: false }
  | {
      found: true;
      code: string;
      roomId: string;
      /** The creator's name on the board (null while unknown). */
      creatorName: string | null;
      isCreator: boolean;
      roundCount: number;
      /** Players who have started it, this device included. */
      players: number;
      maxPlayers: number;
      expiresAt: number;
      state: ChallengeState;
      /** Rounds this device has played (for Continue). */
      roundsDone: number;
      fromRoom: boolean;
    };

/** The earlier players a run plays against, fixed when the attempt started, and this device's slot. */
export interface ChallengeRoster {
  mySlot: number;
  myName: string;
  players: ChallengePlayer[];
}

/** A round's results for the caller once their own is stored: that round and every one before it. */
export interface ChallengeRoundBoard {
  round: number;
  mySlot: number;
  /** The earlier players and the caller. */
  players: ChallengePlayer[];
  /** Rounds 1..round, everyone's; the caller's own in full, the others' as rivalRow() leaves them. */
  results: RoundResultRow[];
  /** This round's summary and detail for every player with a result. */
  details: PlayerRoundDetail[];
  /** The room tie-break's clocks (null for a room played before the stamp). */
  tie: TieRound[] | null;
  /** "Best: 17 moves" style answer line for the result header, when short. */
  correctAnswer: string | null;
}

/** The final board: every finished attempt (podium, awards, Share). */
export interface ChallengeFinalBoard {
  code: string;
  mySlot: number;
  players: ChallengePlayer[];
  results: RoundResultRow[];
  roundOrder: StoredPuzzleType[];
  awardRounds: AwardRound[];
  tie: TieRound[] | null;
  isCreator: boolean;
  creatorName: string | null;
  expiresAt: number;
}

/** A challenge on the creator's Profile: who has played it and how they did against the creator. */
export interface ChallengeSummary {
  code: string;
  roundCount: number;
  createdAt: number;
  expiresAt: number;
  /** The creator's own total, or null until they finish. */
  myTotal: number | null;
  /** Everyone else, in the order they started: a total once finished. */
  friends: { name: string; total: number | null; finished: boolean }[];
}

/* -------------------------------------------------------------- the rules */

/** Fields of a stored result row the phone may see for another player (no answer). */
type RivalSource = Pick<
  RoundResultRow,
  | "round_number"
  | "is_correct"
  | "ms_remaining"
  | "reaction_avg_ms"
  | "correct_count"
  | "errors"
  | "extra"
  | "score"
>;

/**
 * Another player's stored row as it may leave the server, once the caller's own round is over: the
 * score, verdict and timing figures the leaderboard, standings, awards and near-miss lines read, and
 * the reveal's progress axis (to place their marker on the arcade chart); never the answer, and of
 * `extra` only plain numbers and true/false (no word lists, boards, logs or text).
 */
export function rivalRow(row: RivalSource, slot: number, roomId: string): RoundResultRow {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row.extra ?? {}))
    if ((typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean")
      extra[key] = value;
  const axis = (
    (row.extra ?? {}) as { reveal?: { axis?: { value?: unknown; max?: unknown; label?: unknown } } }
  ).reveal?.axis;
  if (axis && typeof axis.value === "number")
    extra["reveal"] = {
      axis: {
        value: axis.value,
        max: typeof axis.max === "number" ? axis.max : null,
        label: typeof axis.label === "string" ? axis.label : "",
      },
      lines: [],
      tiles: [],
      outcome: "time",
    };
  return {
    id: `${roomId}-${slot}-${row.round_number}`,
    duel_id: roomId,
    player_slot: slot,
    round_number: row.round_number,
    answer: null,
    is_correct: row.is_correct,
    ms_remaining: row.ms_remaining,
    reaction_avg_ms: row.reaction_avg_ms,
    correct_count: row.correct_count,
    errors: row.errors,
    extra: Object.keys(extra).length ? extra : null,
    score: row.score,
    submitted_at: "",
  };
}

/**
 * When an earlier player's "finished ✓" ping shows in a round: the time from their round's start to
 * their answer's receipt (their own clock), or null when they didn't finish before the buzzer
 * (buzzer.ts, the room's rule: received in time with at least a second left on the round's own
 * clock, measured by the server at receipt; a time-out's draft, a late answer, a missed round or an
 * arcade run played to the end never pings).
 */
export function pingElapsedMs(
  puzzle: PuzzleData | undefined,
  row: {
    answered: boolean;
    missed: boolean;
    started_at: string;
    answered_at: string | null;
    in_time: boolean;
  },
): number | null {
  if (!row.answered || row.missed || !row.answered_at || !row.in_time) return null;
  const elapsed = Date.parse(row.answered_at) - Date.parse(row.started_at);
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const leftAtReceipt = puzzlePrepMs(puzzle) + puzzleTimeLimitMs(puzzle) - elapsed;
  return finishedBeforeBuzzer(puzzle, "puzzle", leftAtReceipt) ? elapsed : null;
}

/** "Sam beat you 612–580", "You beat Sam 612–580", "You and Sam drew 600–600", "Sam is playing". */
export function challengeResultLine(
  friend: { name: string; total: number | null; finished: boolean },
  myTotal: number | null,
): string {
  const name = friend.name.trim() || "Player";
  if (!friend.finished || friend.total === null) return `${name} is playing`;
  if (myTotal === null) return `${name} scored ${friend.total}`;
  if (friend.total > myTotal) return `${name} beat you ${friend.total}–${myTotal}`;
  if (friend.total < myTotal) return `You beat ${name} ${myTotal}–${friend.total}`;
  return `You and ${name} drew ${myTotal}–${friend.total}`;
}

/** The share text for a challenge (shareResult adds "Play: <link>"). */
export function challengeShareLines(input: {
  kind: "invite" | "result";
  total: number;
  rounds: number;
  place?: number | null;
  players?: number;
}): string[] {
  if (input.kind === "result" && input.place && input.players && input.players > 1)
    return [
      `I came ${ordinal(input.place)} of ${input.players} in a ${input.rounds}-round challenge – ${input.total} pts. Can you beat it?`,
    ];
  return [`I scored ${input.total} in a ${input.rounds}-round challenge – can you beat me?`];
}

/** "Ends in 5d" / "Ends in 3h" / "Ended". */
export function challengeEndsIn(expiresAt: number, nowMs: number): string {
  const left = expiresAt - nowMs;
  if (left <= 0) return "Ended";
  const hours = Math.ceil(left / 3_600_000);
  return hours > 48 ? `Ends in ${Math.ceil(left / 86_400_000)}d` : `Ends in ${hours}h`;
}

/** The creator's categories, as the room lobby keeps them (unknown names dropped, standard when none). */
export function challengeCategories(value: unknown): PuzzleCategory[] {
  return normaliseCategories(value);
}

/** Distinct active games the categories hold: a challenge never deals one game twice. */
export function challengePoolSize(categories: readonly PuzzleCategory[]): number {
  return normaliseCategories(categories).reduce(
    (sum, category) => sum + typesInCategory(category).length,
    0,
  );
}
