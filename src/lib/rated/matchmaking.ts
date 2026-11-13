/**
 * Rated matchmaking rules (wave 3, W3b; docs/rated/matchmaking-interface.md). Pure: shared by the phone (W3c's
 * screens) and the server (rated.server.ts), and proved by scripts/rated-matchmaking-check.ts. Nothing here touches
 * a deal, a grade, a score or a stamp: rated matches are ordinary rooms dealt from the room picks with today's live
 * stamps ("Classic"), and every result is the server's own grading.
 */
import { RATED_CHOICES_ON, RATED_FORMATS_ON } from "@/config/matchmakingConfig";
import { RATED_PLAY_FOR_EVERYONE } from "@/config/ratedConfig";
import { isPlayable, puzzleInfo } from "@/lib/duel/catalogue";
import { stampSignature, dealtSignature } from "@/lib/duel/dealSignature";
import {
  ARCADE_PICKS,
  PUZZLE_PICKS,
  ROOM_PICKS,
  ROOM_PRESETS,
  pickTypes,
  type RoomPick,
  type RoomSettings,
} from "@/lib/duel/roomSettings";
import type { PuzzleType } from "@/lib/duel/types";

/* ------------------------------------------------------------------ formats and choices */

export type RatedFormat = keyof typeof RATED_FORMATS_ON;
export type RatedChoice = keyof typeof RATED_CHOICES_ON;

export const RATED_FORMATS = Object.keys(RATED_FORMATS_ON) as RatedFormat[];
export const RATED_CHOICES = Object.keys(RATED_CHOICES_ON) as RatedChoice[];

/** Games a match deals: best of N plays N games (all of them; the match is the games won). W3d owns ffa4 / ffa8. */
export const FORMAT_GAMES: Readonly<Record<RatedFormat, number>> = { bo3: 3, bo5: 5, bo7: 7, ffa4: 3, ffa8: 3 };
/** Players a match seats. */
export const FORMAT_PLAYERS: Readonly<Record<RatedFormat, number>> = { bo3: 2, bo5: 2, bo7: 2, ffa4: 4, ffa8: 8 };

/** The game mode every rated game deals until wave 3.5: Classic (today's live deal, nothing pinned). */
export const RATED_GAME_MODE = "classic" as const;
export type RatedGameMode = typeof RATED_GAME_MODE;

export const isRatedFormat = (value: unknown): value is RatedFormat =>
  typeof value === "string" && (RATED_FORMATS as string[]).includes(value);
export const isRatedChoice = (value: unknown): value is RatedChoice =>
  typeof value === "string" && (RATED_CHOICES as string[]).includes(value);

/** A single-category choice (a room pick) rather than Mixed / All puzzles / All arcade. */
export function singlePickOf(choice: RatedChoice): RoomPick | null {
  return (ROOM_PICKS as readonly string[]).includes(choice) ? (choice as RoomPick) : null;
}

/** The switches as they stand (the config, or a check's own). */
export interface RatedSwitches {
  forEveryone: boolean;
  formats: Readonly<Record<RatedFormat, boolean>>;
  choices: Readonly<Record<RatedChoice, boolean>>;
}
export const RATED_SWITCHES: RatedSwitches = {
  forEveryone: RATED_PLAY_FOR_EVERYONE,
  formats: RATED_FORMATS_ON,
  choices: RATED_CHOICES_ON,
};

/** Why this format and choice can't be queued for (null: they can). The server's own answer, whatever a phone sends. */
export function ratedOptionRefusal(format: unknown, choice: unknown, switches: RatedSwitches = RATED_SWITCHES): string | null {
  if (!isRatedFormat(format)) return "That match type doesn’t exist.";
  if (!isRatedChoice(choice)) return "That choice doesn’t exist.";
  if (!switches.formats[format]) return "That match type isn’t open yet.";
  if (!switches.choices[choice]) return "That choice isn’t open yet.";
  return null;
}

/** Whether rated play is open to this tester (or not): everyone once Joe flips the switch, testers until then. */
export function ratedPlayOpenFor(isTester: boolean, switches: RatedSwitches = RATED_SWITCHES): boolean {
  return switches.forEveryone || isTester;
}

/**
 * Who may queue: with RATED_PLAY_FOR_EVERYONE on, everyone, guests included (a new player taps Play and plays with no
 * sign-up, placement first; their ratings carry to their account when they sign up, the same player id). While it is
 * off, only accounts on the tester list.
 */
export function ratedAccessFor(player: { account: boolean; tester: boolean }, switches: RatedSwitches = RATED_SWITCHES): boolean {
  if (switches.forEveryone) return true;
  return player.account && player.tester;
}

/** What the phone may offer (only what is switched on). */
export function openOptions(switches: RatedSwitches = RATED_SWITCHES): { formats: RatedFormat[]; choices: RatedChoice[] } {
  return {
    formats: RATED_FORMATS.filter((f) => switches.formats[f]),
    choices: RATED_CHOICES.filter((c) => switches.choices[c]),
  };
}

/** The room picks a choice deals from (Mixed and the two "All" choices are the room presets). */
export function choicePicks(choice: RatedChoice): RoomPick[] {
  if (choice === "mixed") return [...ROOM_PRESETS[0]!.picks];
  if (choice === "puzzles") return [...PUZZLE_PICKS];
  if (choice === "arcade") return [...ARCADE_PICKS];
  return [choice as RoomPick];
}

/** The room settings a match deals with (roomDeal.ts `dealRoomRounds`, the room seed). */
export function matchSettings(format: RatedFormat, choice: RatedChoice): RoomSettings {
  const pool = choicePool(choice);
  return { picks: choicePicks(choice), rounds: FORMAT_GAMES[format], ...(pool ? { pool } : {}) };
}

/**
 * The rated pool a choice keeps to: All puzzles only puzzles, All arcade only arcade games (a game listed also in a
 * pick of the other pool, Pull! in Sports, would make the match's pools disagree and leave it unrated). Mixed and a
 * single pick deal every game their picks hold.
 */
export function choicePool(choice: RatedChoice): "puzzles" | "arcade" | null {
  return choice === "puzzles" ? "puzzles" : choice === "arcade" ? "arcade" : null;
}

/** Whether a game belongs to a choice (a recorded run's games must). */
export function typeFitsChoice(type: string, choice: RatedChoice): boolean {
  const picks = choicePicks(choice);
  const pool = choicePool(choice);
  if (pool && isPlayable(type) && (puzzleInfo(type).category === "arcade") !== (pool === "arcade")) return false;
  return picks.some((pick) => (pickTypes(pick, picks) as string[]).includes(type));
}

/* ------------------------------------------------------------------ the queue */

/** The band starts at ±50 … */
export const BAND_START = 50;
/** … and widens by 50 … */
export const BAND_STEP = 50;
/** … every 2 s … */
export const BAND_STEP_MS = 2_000;
/** … to ±200 … */
export const BAND_MAX = 200;
/** … and at 8 s the player gets a recorded run instead. */
export const RECORDED_AFTER_MS = 8_000;

/** The rating band a player waiting `waitMs` accepts: ±50, ±100 from 2 s, ±150 from 4 s, ±200 from 6 s. */
export function bandFor(waitMs: number): number {
  const steps = Math.floor(Math.max(0, waitMs) / BAND_STEP_MS);
  return Math.min(BAND_MAX, BAND_START + BAND_STEP * steps);
}

/** Whether a player waiting `waitMs` moves on to a recorded run. */
export function recordedDue(waitMs: number): boolean {
  return waitMs >= RECORDED_AFTER_MS;
}

/** One waiting player as the queue holds them. */
export interface QueueEntry {
  userId: string;
  format: RatedFormat;
  choice: RatedChoice;
  /** The rating the match will move (W3a's matchRating: a single-category choice blends that category's in). */
  rating: number;
  joinedAtMs: number;
  /**
   * Still in placement (W3a). Joe, 11 Nov 2026: two placement players searching at the same time may be matched live
   * with each other (the normal widening); a placed player never with a placement player; otherwise at 8 s a beginner's
   * recorded run.
   */
  placement: boolean;
}

/**
 * Whether two waiting players can be paired now: the same format and the same choice, two different players,
 * both in placement or both placed (never one of each), and ratings within the wider of their two bands (the longer
 * waiter has widened further).
 */
export function canPair(a: QueueEntry, b: QueueEntry, nowMs: number): boolean {
  if (a.userId === b.userId) return false;
  if (a.format !== b.format || a.choice !== b.choice) return false;
  // Placement only with placement, placed only with placed (Joe, 11 Nov 2026).
  if (a.placement !== b.placement) return false;
  const band = Math.max(bandFor(nowMs - a.joinedAtMs), bandFor(nowMs - b.joinedAtMs));
  return Math.abs(a.rating - b.rating) <= band;
}

/** The best partner for `me` among the waiting: the nearest rating, then the longest wait, then the user id. */
export function bestPartner(me: QueueEntry, waiting: readonly QueueEntry[], nowMs: number): QueueEntry | null {
  let best: QueueEntry | null = null;
  for (const other of waiting) {
    if (!canPair(me, other, nowMs)) continue;
    if (!best) {
      best = other;
      continue;
    }
    const d = Math.abs(other.rating - me.rating) - Math.abs(best.rating - me.rating);
    if (d < 0 || (d === 0 && (other.joinedAtMs < best.joinedAtMs || (other.joinedAtMs === best.joinedAtMs && other.userId < best.userId))))
      best = other;
  }
  return best;
}

/* ------------------------------------------------------------------ recorded runs */

/** A recorded run is from the last 14 days … */
export const RECORDED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/** … and is used at most 5 times a (UK) day. */
export const RECORDED_DAILY_USES = 5;
/** A rated run is "near enough" within the queue's widest band; past it the fallback pool is tried first. */
export const RECORDED_NEAR = BAND_MAX;

export type RecordedSource = "rated" | "room" | "daily" | "practice";

/** A stored game's score over time: [ms since the game's puzzle phase started, score then], rising in time. */
export type ScoreTimeline = readonly (readonly [number, number])[];

/** One game of a recorded run, as stored. */
export interface RecordedGame {
  type: string;
  /** The game version the run was dealt under (`gameVersionOf` of the stored puzzle). */
  signature: string;
  /** The server's stored score. */
  score: number;
  /** When the run's answer was stored (ms into the game), null when it reached the buzzer. */
  finishMs: number | null;
  /** The server-made timeline (timeline.server.ts), null when the game has none. Its last point is `score`. */
  timeline: ScoreTimeline | null;
  /** The server's replay flagged the stored run (its `extra.flagged`): the whole run is never played against. */
  flagged?: boolean;
}

/** A run that could be played against. */
export interface RecordedCandidate {
  /** Unique per run: rated:<match>:<user>, room:<duel>:<slot>, daily:<attempt>, practice:<…>. */
  key: string;
  source: RecordedSource;
  ownerId: string;
  /** The owner's rating for this choice when known (a rated run's own; a fallback owner's current, or null). */
  ownerRating: number | null;
  /** Rated runs: the format and choice they were played in. */
  format: RatedFormat | null;
  choice: RatedChoice | null;
  games: readonly RecordedGame[];
  recordedAtMs: number;
  /** Times it has been played against today (UK day). */
  usesToday: number;
}

export interface RecordedContext {
  viewerId: string;
  rating: number;
  format: RatedFormat;
  choice: RatedChoice;
  /** The owner of the viewer's last recorded opponent (never the same player twice in a row). */
  lastOwnerId: string | null;
  nowMs: number;
  /** Placement: only beginners' runs (owner rating at most `beginnerMax`, or unrated). */
  beginnerMax?: number | null;
  /** The game version a game deals today (dealtSignature); a check can stand in. */
  liveSignature?: (type: string) => string;
}

/** A game's version: its stamps with the room's tie stamp left out (a room puzzle carries tieRev, practice none). */
export function gameVersionOf(puzzle: object): string {
  return stampSignature(puzzle)
    .split(" ")
    .filter((part) => part && !part.startsWith("tieRev="))
    .join(" ");
}

/** Why a run can't be played against (null: it can). */
export function recordedRefusal(c: RecordedCandidate, ctx: RecordedContext): string | null {
  const live = ctx.liveSignature ?? dealtSignature;
  const games = FORMAT_GAMES[ctx.format];
  if (c.ownerId === ctx.viewerId) return "own";
  if (ctx.lastOwnerId && c.ownerId === ctx.lastOwnerId) return "same_owner_twice";
  if (ctx.nowMs - c.recordedAtMs > RECORDED_WINDOW_MS || c.recordedAtMs > ctx.nowMs) return "too_old";
  if (c.usesToday >= RECORDED_DAILY_USES) return "used_up";
  if (c.games.some((g) => g.flagged === true)) return "flagged";
  if (c.games.length !== games) return "wrong_length";
  // A run holding a retired game is never played against (catalogue.ts isPlayable, 13 Nov 2026).
  if (!c.games.every((g) => isPlayable(g.type))) return "retired";
  if (c.source === "rated" && (c.format !== ctx.format || c.choice !== ctx.choice)) return "other_format";
  if (!c.games.every((g) => typeFitsChoice(g.type, ctx.choice))) return "other_choice";
  if (!c.games.every((g) => g.signature === live(g.type))) return "old_version";
  if (ctx.beginnerMax != null && c.ownerRating != null && c.ownerRating > ctx.beginnerMax) return "not_beginner";
  return null;
}

function ratingGap(c: RecordedCandidate, rating: number, unrated: number): number {
  return Math.abs((c.ownerRating ?? unrated) - rating);
}

function nearest(pool: readonly RecordedCandidate[], rating: number, unrated: number): RecordedCandidate | null {
  let best: RecordedCandidate | null = null;
  for (const c of pool) {
    if (!best) {
      best = c;
      continue;
    }
    const d = ratingGap(c, rating, unrated) - ratingGap(best, rating, unrated);
    if (d < 0 || (d === 0 && (c.recordedAtMs > best.recordedAtMs || (c.recordedAtMs === best.recordedAtMs && c.key < best.key))))
      best = c;
  }
  return best;
}

export interface RecordedChoice {
  candidate: RecordedCandidate;
  /** From rooms, the Daily or Practice (no rated run near enough); its owner's rating never moves. */
  fallback: boolean;
}

/**
 * The run to play against: the nearest-rated eligible rated run within RECORDED_NEAR; when none is near enough, the
 * nearest eligible fallback run (rooms, the Daily, Practice); when there is none of those either, the nearest rated
 * run however far. An unrated owner counts as `unratedAs` (W3a's starting rating). Null: nothing fits.
 */
export function chooseRecordedRun(
  candidates: readonly RecordedCandidate[],
  ctx: RecordedContext,
  unratedAs: number,
): RecordedChoice | null {
  const ok = candidates.filter((c) => recordedRefusal(c, ctx) === null);
  const rated = ok.filter((c) => c.source === "rated");
  const near = rated.filter((c) => ratingGap(c, ctx.rating, unratedAs) <= RECORDED_NEAR);
  const pickNear = nearest(near, ctx.rating, unratedAs);
  if (pickNear) return { candidate: pickNear, fallback: false };
  const pickFallback = nearest(ok.filter((c) => c.source !== "rated"), ctx.rating, unratedAs);
  if (pickFallback) return { candidate: pickFallback, fallback: true };
  const pickFar = nearest(rated, ctx.rating, unratedAs);
  return pickFar ? { candidate: pickFar, fallback: false } : null;
}

/** "Recorded run · 2 h ago": the run's real age. */
export function recordedAgeLabel(recordedAtMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - recordedAtMs) / 60_000));
  let age: string;
  if (minutes < 1) age = "just now";
  else if (minutes < 60) age = `${minutes} min ago`;
  else if (minutes < 48 * 60) age = `${Math.floor(minutes / 60)} h ago`;
  else age = `${Math.floor(minutes / (24 * 60))} days ago`;
  return `Recorded run · ${age}`;
}

/* ------------------------------------------------------------------ playback and the hidden finish */

/** The opponent's live score is hidden for the final 20 % of each game's time, until the game's result. */
export const HIDDEN_FINISH_SHARE = 0.2;

/** Whether the opponent's score is hidden `elapsedMs` into a game of `limitMs` (before its result). */
export function opponentScoreHidden(elapsedMs: number, limitMs: number): boolean {
  return elapsedMs >= limitMs * (1 - HIDDEN_FINISH_SHARE);
}

/** What a recorded game shows `elapsedMs` into it, during play. */
export interface RecordedView {
  /** The score the run had reached by then (null: nothing to show, a game without a timeline or the hidden finish). */
  score: number | null;
  /** The run had stored its answer by then (its real pace). */
  finished: boolean;
  hidden: boolean;
}

/**
 * A recorded game at `elapsedMs` (during play, before the game's result): with a timeline, the last point at or
 * before then (never a point the run hadn't reached); without one, nothing until the game's end (the result shows
 * the stored score). Hidden in the final 20 %.
 */
export function recordedViewAt(game: RecordedGame, elapsedMs: number, limitMs: number): RecordedView {
  const finished = game.finishMs !== null && elapsedMs >= game.finishMs;
  if (opponentScoreHidden(elapsedMs, limitMs)) return { score: null, finished, hidden: true };
  if (!game.timeline) return { score: null, finished, hidden: false };
  let score: number | null = null;
  for (const [ms, value] of game.timeline) {
    if (ms > elapsedMs) break;
    score = value;
  }
  return { score: score ?? 0, finished, hidden: false };
}

/** Whether a stored timeline is honest: rising in time, inside the game, ending on the stored score. */
export function timelineValid(timeline: ScoreTimeline, score: number, limitMs: number): boolean {
  if (timeline.length === 0) return false;
  let last = -1;
  for (const [ms, value] of timeline) {
    if (!Number.isInteger(ms) || !Number.isFinite(value) || ms < last || ms < 0 || ms > limitMs) return false;
    last = ms;
  }
  return timeline[timeline.length - 1]![1] === score;
}

/* ------------------------------------------------------------------ the result */

/** One game between two sides: each side's stored score and time used (the room tie-break's). */
export interface GameScores {
  a: number;
  b: number;
  aTimeMs: number;
  bTimeMs: number;
}

export type Side = "a" | "b" | "draw";

/** A game's winner: the higher score; a level score is a drawn game (W3a's rule, so the shown result and the rating agree). */
export function gameWinner(g: GameScores): Side {
  if (g.a !== g.b) return g.a > g.b ? "a" : "b";
  return "draw";
}

export interface MatchOutcome {
  winsA: number;
  winsB: number;
  totalA: number;
  totalB: number;
  winner: Side;
}

/** Best of N: the most games won; level on games, the higher total; then less time used in all; then a draw. */
export function matchOutcome(games: readonly GameScores[]): MatchOutcome {
  let winsA = 0;
  let winsB = 0;
  let totalA = 0;
  let totalB = 0;
  let timeA = 0;
  let timeB = 0;
  for (const g of games) {
    const w = gameWinner(g);
    if (w === "a") winsA++;
    else if (w === "b") winsB++;
    totalA += g.a;
    totalB += g.b;
    timeA += g.aTimeMs;
    timeB += g.bTimeMs;
  }
  let winner: Side = "draw";
  if (winsA !== winsB) winner = winsA > winsB ? "a" : "b";
  else if (totalA !== totalB) winner = totalA > totalB ? "a" : "b";
  else if (timeA !== timeB) winner = timeA < timeB ? "a" : "b";
  return { winsA, winsB, totalA, totalB, winner };
}

/**
 * Best of N stops as soon as it is decided: one side has won a majority of the games (2 of 3, 3 of 5, 4 of 7), so it
 * can't be caught (2–0 or 2–1 in a best of 3; 3–0 or 3–1 in a best of 5). A drawn game counts for nobody, so a best
 * of 5 at 2–0 with two drawn games still plays game 5. This is W3a's rule (src/lib/rated/match.ts: a game after the
 * decision, or a short match that isn't decided, is refused), so the room and the rating always agree.
 */
export function matchClinched(games: readonly GameScores[], totalGames: number): boolean {
  const { winsA, winsB } = matchOutcome(games);
  const need = Math.floor(totalGames / 2) + 1;
  return winsA >= need || winsB >= need;
}

/* ------------------------------------------------------------------ rematch */

/** Both players accept within 8 s of the match's end. */
export const REMATCH_WINDOW_MS = 8_000;

export function rematchOpen(finishedAtMs: number, nowMs: number): boolean {
  return nowMs >= finishedAtMs && nowMs - finishedAtMs <= REMATCH_WINDOW_MS;
}

/** A rematch starts when both accepts landed inside the window. */
export function rematchAgreed(finishedAtMs: number, acceptsMs: readonly (number | null)[]): boolean {
  return acceptsMs.length >= 2 && acceptsMs.every((at) => at !== null && rematchOpen(finishedAtMs, at));
}

/* ------------------------------------------------------------------ abuse */

/** Queue joins a player may make: 30 every 10 minutes (rate_limits bucket `rated-queue`). */
export const RATED_QUEUE_LIMIT = { bucket: "rated-queue", max: 30, windowSeconds: 600 } as const;
/** Queue polls (about one a second while searching, the opponent's score during a game): 900 every 10 minutes. */
export const RATED_POLL_LIMIT = { bucket: "rated-poll", max: 900, windowSeconds: 600 } as const;

/** The types a list of rounds holds, for messages and checks. */
export function typesOf(games: readonly { type: string }[]): PuzzleType[] {
  return games.map((g) => g.type as PuzzleType);
}

/* ------------------------------------------------------------------ the wait after set-up leaves (13 Nov 2026) */

export interface AbortCooldown {
  /** When the player may search again (server ms). */
  untilMs: number;
  /** Set-up leaves counted in the window. */
  aborts: number;
}

/**
 * The wait a player's set-up leaves add (pure): `abortTimesMs` are the leaves' times, any order. Null when there is no
 * wait now (none counted, the first is free, or the wait has passed).
 */
export function abortCooldown(
  abortTimesMs: readonly number[],
  nowMs: number,
  ladder: { periodMs: number; waitsMs: readonly number[] },
): AbortCooldown | null {
  const counted = abortTimesMs.filter((t) => Number.isFinite(t) && t <= nowMs && nowMs - t < ladder.periodMs);
  if (counted.length === 0) return null;
  const wait = ladder.waitsMs[Math.min(counted.length, ladder.waitsMs.length) - 1] ?? 0;
  if (wait <= 0) return null;
  const untilMs = Math.max(...counted) + wait;
  return untilMs > nowMs ? { untilMs, aborts: counted.length } : null;
}

/* ------------------------------------------------------------------ leaving a match (Joe, 12 Nov 2026) */

/** A dropped player's grace once the first game's intro has appeared: back within it, play carries on. */
export const DEPARTURE_GRACE_MS = 20_000;

export interface DeparturePlayer {
  userId: string;
  /** The latest heartbeat (or join / READY) the server holds, ms; null for none. */
  lastSeenMs: number | null;
  /** Their own Leave, ms; null when they never pressed it. */
  leftAtMs: number | null;
  /** Found gone for good (a 4- or 8-player match carrying on without them): when they went, ms. */
  goneAtMs: number | null;
}

export interface Departure {
  userId: string;
  /** When they went: their Leave, else their last heartbeat. */
  atMs: number;
}

export type DepartureVerdict =
  /** Nobody gone (or the match already decided: it ends on its result). */
  | { kind: "none" }
  /** Left during set-up (before the first game's intro): no rating, no Joules, not a placement match. */
  | { kind: "abort"; leavers: Departure[] }
  /** Away past the grace before the match was decided: the match ends now as a loss for each leaver. */
  | { kind: "forfeit"; leavers: Departure[] }
  /** A 4- or 8-player match: these players are gone for good, the rest play on. */
  | { kind: "gone"; leavers: Departure[] };

/** When a player went: their own Leave, else their last heartbeat. */
export function awaySinceMs(p: DeparturePlayer): number | null {
  return p.leftAtMs ?? p.lastSeenMs;
}

/**
 * Who has left a live match, and what follows (pure; the server calls it on every heartbeat and poll). Set-up is
 * everything before `introAtMs`, the first game's intro: a player who pressed Leave in it, or whose absence began in it
 * and lasted past the grace (never connected counts), aborts the match. After it, a player away for more than the
 * grace (a Leave starts the clock too) forfeits, unless the match is already decided. In a 1v1 the match then ends; in a
 * 4- or 8-player match it carries on until fewer than two players stay. If everyone is gone, the player seen last stays.
 */
export function departureVerdict(input: {
  nowMs: number;
  introAtMs: number;
  players: readonly DeparturePlayer[];
  /** The match is already won (a best of N's majority): nobody forfeits; it ends on its result. */
  decided: boolean;
  graceMs?: number;
}): DepartureVerdict {
  const grace = input.graceMs ?? DEPARTURE_GRACE_MS;
  const away = (p: DeparturePlayer) => awaySinceMs(p) ?? input.introAtMs - grace - 1;
  const departures = (list: readonly DeparturePlayer[]): Departure[] =>
    [...list].map((p) => ({ userId: p.userId, atMs: p.goneAtMs ?? away(p) })).sort((a, b) => a.atMs - b.atMs || (a.userId < b.userId ? -1 : 1));
  const keepOne = (gone: DeparturePlayer[]) => {
    if (gone.length < input.players.length) return gone;
    const last = [...gone].sort((a, b) => away(b) - away(a) || (a.userId < b.userId ? -1 : 1))[0]!;
    return gone.filter((p) => p !== last);
  };
  const live = input.players.filter((p) => p.goneAtMs === null);
  const setupLeavers = live.filter((p) => {
    const since = away(p);
    if (p.leftAtMs !== null && p.leftAtMs < input.introAtMs) return true;
    return since < input.introAtMs && input.nowMs - since > grace;
  });
  if (setupLeavers.length > 0 && input.players.every((p) => p.goneAtMs === null)) return { kind: "abort", leavers: departures(keepOne(setupLeavers)) };
  if (input.decided) return { kind: "none" };
  const newlyGone = live.filter((p) => input.nowMs - away(p) > grace);
  if (newlyGone.length === 0) return { kind: "none" };
  const before = input.players.filter((p) => p.goneAtMs !== null);
  const all = keepOne([...before, ...newlyGone]);
  const stayers = input.players.length - all.length;
  if (input.players.length <= 2 || stayers < 2) return { kind: "forfeit", leavers: departures(all) };
  return { kind: "gone", leavers: departures(newlyGone.filter((p) => all.includes(p))) };
}

/**
 * Final places with leavers (4 and 8 players): the players who stayed keep their places among themselves (1, 2, 2, 4
 * style), then the leavers below them, the latest leaver highest, level departures sharing a place.
 */
export function placeWithLeavers(stayerPlaces: Readonly<Record<string, number>>, leavers: readonly Departure[]): Record<string, number> {
  const out: Record<string, number> = { ...stayerPlaces };
  const base = Object.keys(stayerPlaces).length;
  const latestFirst = [...leavers].sort((a, b) => b.atMs - a.atMs);
  latestFirst.forEach((l, i) => {
    const ahead = latestFirst.filter((x) => x.atMs > l.atMs).length;
    out[l.userId] = base + (i === 0 ? 1 : ahead + 1);
  });
  return out;
}
