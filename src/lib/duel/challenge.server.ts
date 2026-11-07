/**
 * Friend challenges on the server (22 Oct 2026; challenge.ts has the shared rules). A challenge is
 * an async room (asyncRoom.server.ts) of kind "challenge" under "challenge:<CODE>", plus its row in
 * `challenges`. Everything a player does inside it (starting rounds, answering, reveals, word and
 * move checks) goes through the async room's own calls, so a challenge round is graded exactly as a
 * room's (and practice's): gradeRoomAnswer on that player's own round start.
 *
 * - Dealt once on the server from a seed and stored (rule 5): every friend gets the same rounds,
 *   puzzles and arcade seeds. One made from a finished room stores that room's own puzzles and
 *   copies its players' stored results as finished attempts (never regraded).
 * - One attempt per device (the async room's unique index), at most CHALLENGE_MAX_PLAYERS (here and
 *   a database trigger), no attempt or round starts after the link's seven days.
 * - The earlier players' "finished" pings come from their stored receipt times, released only once
 *   the caller's own clock has passed them; their results only once the caller's own result for
 *   that round is stored, and never their answers (challenge.ts rivalRow).
 *
 * The database client is passed in, so scripts/challenge-check.ts drives this exact code with an
 * in-memory stand-in.
 */
import {
  asRoundResult,
  attemptFor,
  attemptsIn,
  attemptView,
  createAsyncRoom,
  importFinishedAttempt,
  resultsOf,
  roomById,
  roomByKey,
  startAttempt,
  type AsyncAttemptRow,
  type AsyncResultRow,
  type AsyncRoomRow,
} from "./asyncRoom.server";
import { asyncReceipt } from "./asyncRoom";
import { awardRoundsFor } from "./awardRounds";
import { gameIndexOf, recordChallengeEvent } from "./betaRecord.server";
import {
  CHALLENGE_CODE_ALPHABET,
  CHALLENGE_CODE_LENGTH,
  CHALLENGE_MAX_PLAYERS,
  CHALLENGE_OPEN_MS,
  CHALLENGE_ROOM_KIND,
  challengeCategories,
  challengeRoomKey,
  pingElapsedMs,
  rivalRow,
  validChallengeRounds,
  type ChallengeFinalBoard,
  type ChallengeInfo,
  type ChallengePlayer,
  type ChallengeRoster,
  type ChallengeRoundBoard,
  type ChallengeSummary,
} from "./challenge";
import { generatePuzzle } from "./generate.server";
import { randomBelow } from "./random";
import { isLiveType, puzzleDef, puzzlePrepMs, puzzleTimeLimitMs } from "./registry";
import { mergePuzzle } from "./secrets";
import { newRoomSeed, pickRoundOrder } from "./selection";
import { isSettingsRoom, readRoomSettings } from "./roomSettings";
import { roomTieRounds, stampTieRev } from "./tieBreak";
import type { UnblockBankRow } from "./unblock.server";
import type {
  DuelPlayerRow,
  DuelRow,
  PlayerRoundDetail,
  PuzzleCategory,
  PuzzleData,
  PuzzleType,
  RoundResultRow,
  StoredPuzzleType,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Challenges one device may make in an hour, counted from `challenges` (needs no other migration). */
export const CHALLENGE_CREATE_PER_HOUR = 10;

export interface ChallengeRow {
  room_id: string;
  code: string;
  created_by: string;
  source: "play" | "room";
  source_duel_id: string | null;
  source_game_index: number | null;
  selected_categories: string[];
  round_count: number;
  created_at: string;
  expires_at: string;
}

const iso = (ms: number) => new Date(ms).toISOString();
const msOf = (stamp: string | null | undefined) => (stamp ? Date.parse(stamp) : Number.NaN);

type Who = { name: string; colour: number | null; icon: string | null };
type Fail = { ok: false; message: string; full?: boolean; closed?: boolean };

/* ------------------------------------------------------------------ deal */

/**
 * A challenge's games from its seed: the room's own draw for the creator's categories (selection.ts,
 * no category twice in a row, no game twice), cut to `rounds`, or drawn again on derived seeds and
 * appended (still no game twice) when more rounds are asked for than the room deals. Never more
 * rounds than the categories hold games.
 */
export function challengeRoundOrder(
  categories: readonly PuzzleCategory[],
  rounds: number,
  seed: number,
): PuzzleType[] {
  const order = pickRoundOrder({ categories, seed }).slice(0, rounds);
  for (let k = 1; order.length < rounds && k <= 12; k++) {
    const more = pickRoundOrder({
      categories,
      seed: (seed + k * 0x9e37_79b1) & 0x7fff_ffff,
      recent: [order],
    });
    for (const type of more) if (order.length < rounds && !order.includes(type)) order.push(type);
  }
  return order;
}

/** Deals one challenge: the order, then every puzzle on the challenge's seed, as a room's start does. */
export function dealChallenge(input: {
  categories: readonly PuzzleCategory[];
  rounds: number;
  seed: number;
  unblockRow?: UnblockBankRow | null;
}): { roundOrder: PuzzleType[]; puzzles: PuzzleData[] } {
  const roundOrder = challengeRoundOrder(input.categories, input.rounds, input.seed);
  return {
    roundOrder,
    puzzles: roundOrder.map((type) =>
      stampTieRev(
        generatePuzzle(type, { unblockRow: input.unblockRow ?? null, bankSeed: input.seed }),
      ),
    ),
  };
}

function newCode(): string {
  let code = "";
  for (let i = 0; i < CHALLENGE_CODE_LENGTH; i++)
    code += CHALLENGE_CODE_ALPHABET[randomBelow(CHALLENGE_CODE_ALPHABET.length)];
  return code;
}

/** How many challenges this device made in the last hour (the database-side half of the rate limit). */
export async function challengesMadeLastHour(
  client: any,
  userId: string,
  nowMs: number,
): Promise<number> {
  const { data, error } = await client
    .from("challenges")
    .select("created_at")
    .eq("created_by", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { created_at: string }[]).filter(
    (row) => nowMs - msOf(row.created_at) < 3_600_000,
  ).length;
}

/** Stores a dealt challenge under a fresh code (a clash with an existing code draws again). */
async function storeChallenge(
  client: any,
  input: {
    userId: string;
    seed: number;
    puzzles: PuzzleData[];
    nowMs: number;
    source: "play" | "room";
    sourceDuelId?: string | null;
    sourceGameIndex?: number | null;
    categories: readonly string[];
  },
): Promise<{ room: AsyncRoomRow; meta: ChallengeRow }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode();
    const room = await createAsyncRoom(client, {
      kind: CHALLENGE_ROOM_KIND,
      key: challengeRoomKey(code),
      day: null,
      seed: input.seed,
      puzzles: input.puzzles,
      opensAt: input.nowMs,
      closesAt: input.nowMs + CHALLENGE_OPEN_MS,
      createdBy: input.userId,
    });
    // createAsyncRoom hands back the stored room when the key is taken: that's someone else's challenge.
    if (
      room.created_by !== input.userId ||
      Number(room.seed) !== input.seed ||
      msOf(room.opens_at) !== input.nowMs
    )
      continue;
    const meta: ChallengeRow = {
      room_id: room.id,
      code,
      created_by: input.userId,
      source: input.source,
      source_duel_id: input.sourceDuelId ?? null,
      source_game_index: input.sourceGameIndex ?? null,
      selected_categories: [...input.categories],
      round_count: input.puzzles.length,
      created_at: iso(input.nowMs),
      expires_at: room.closes_at,
    };
    const { error } = await client.from("challenges").insert(meta);
    if (error) throw new Error(error.message);
    return { room, meta };
  }
  throw new Error("Couldn’t find a free challenge code.");
}

/**
 * Makes a challenge from the Play tab: deals the creator's categories and round count, stores it,
 * and starts the creator's own attempt (they play it first, alone). The caller has already checked
 * the name and the per-device rate limit.
 */
export async function createChallenge(
  client: any,
  userId: string,
  input: { categories: unknown; rounds: unknown; who: Who },
  nowMs: number,
): Promise<{ ok: true; code: string; roomId: string } | Fail> {
  if (!validChallengeRounds(input.rounds)) return { ok: false, message: "Pick how many rounds." };
  if ((await challengesMadeLastHour(client, userId, nowMs)) >= CHALLENGE_CREATE_PER_HOUR)
    return { ok: false, message: "That’s a lot of challenges. Try again in a while." };
  const categories = challengeCategories(input.categories);
  const seed = newRoomSeed();
  let unblockRow: UnblockBankRow | null = null;
  if (challengeRoundOrder(categories, input.rounds, seed).includes("unblock")) {
    const { drawUnblockRow } = await import("./unblock.server");
    unblockRow = await drawUnblockRow(client);
  }
  const { puzzles } = dealChallenge({ categories, rounds: input.rounds, seed, unblockRow });
  if (puzzles.length === 0) return { ok: false, message: "Pick at least one category." };
  const { room, meta } = await storeChallenge(client, {
    userId,
    seed,
    puzzles,
    nowMs,
    source: "play",
    categories,
  });
  const started = await startAttempt(client, room, userId, input.who, nowMs);
  if (!started.ok) return started;
  await recordChallengeEvent(client, {
    room_id: room.id,
    code: meta.code,
    user_id: userId,
    event: "created",
    source: "play",
  });
  console.log(
    `[challenge] ${meta.code} seed=${seed} order=${puzzles.map((p) => p.type).join(",")}`,
  );
  return { ok: true, code: meta.code, roomId: room.id };
}

/**
 * Makes (or finds) the challenge for a finished room's game: the room's own stored puzzles, and every
 * player of that room as a finished attempt with their stored results (copied, never regraded), so
 * friends play the same set against them. Any player of the room may ask; one challenge per game
 * (a second ask, from anyone in it, gets the same code).
 */
export async function createChallengeFromRoom(
  client: any,
  userId: string,
  duelId: string,
  nowMs: number,
): Promise<{ ok: true; code: string; roomId: string; created: boolean } | Fail> {
  const { data: duel } = await client.from("duels").select("*").eq("id", duelId).maybeSingle();
  if (!duel) return { ok: false, message: "That room no longer exists." };
  const room = duel as DuelRow;
  if (room.status !== "finished") return { ok: false, message: "Finish the game first." };
  const { data: playerRows } = await client.from("duel_players").select("*").eq("duel_id", room.id);
  const players = ((playerRows ?? []) as DuelPlayerRow[]).sort(
    (a, b) => a.player_slot - b.player_slot,
  );
  if (!players.some((p) => p.user_id === userId))
    return { ok: false, message: "Only this room’s players can do that." };
  const gameIndex = gameIndexOf(room);
  const { data: existing } = await client
    .from("challenges")
    .select("*")
    .eq("source_duel_id", room.id)
    .eq("source_game_index", gameIndex)
    .maybeSingle();
  if (existing)
    return {
      ok: true,
      code: (existing as ChallengeRow).code,
      roomId: (existing as ChallengeRow).room_id,
      created: false,
    };

  const order = room.round_order ?? [];
  const pub = (room.puzzles_public ?? []) as PuzzleData[];
  if (
    !pub.length ||
    pub.length !== (room.round_count || order.length) ||
    !pub.every((p) => isLiveType(p.type))
  )
    return { ok: false, message: "This game can’t be turned into a challenge." };
  if ((await challengesMadeLastHour(client, userId, nowMs)) >= CHALLENGE_CREATE_PER_HOUR)
    return { ok: false, message: "That’s a lot of challenges. Try again in a while." };
  const { data: secretRow } = await client
    .from("duel_secrets")
    .select("puzzles_private")
    .eq("duel_id", room.id)
    .maybeSingle();
  const priv = (secretRow?.puzzles_private ?? []) as Record<string, unknown>[];
  const puzzles = pub.map((p, i) => mergePuzzle(p, priv[i]));
  const { data: resultRows } = await client
    .from("round_results")
    .select("*")
    .eq("duel_id", room.id);
  const results = (resultRows ?? []) as RoundResultRow[];
  const seed =
    Number((room as unknown as { seed?: number }).seed ?? newRoomSeed()) || newRoomSeed();

  const { room: stored, meta } = await storeChallenge(client, {
    userId,
    seed,
    puzzles,
    nowMs,
    source: "room",
    sourceDuelId: room.id,
    sourceGameIndex: gameIndex,
    // A room saved with settings lists its categories (Arcade for any arcade group), as older rooms do.
    categories: isSettingsRoom(room.selected_categories)
      ? readRoomSettings(room.selected_categories).categories
      : (room.selected_categories ?? []),
  });
  // Every player of the game: anyone who answered a round, and anyone still in it.
  const imported = players.filter(
    (p) => p.status !== "left" || results.some((r) => r.player_slot === p.player_slot),
  );
  for (const [index, player] of imported.entries()) {
    const rounds = puzzles.map((puzzle, i) => {
      const row = results.find(
        (r) => r.player_slot === player.player_slot && r.round_number === i + 1,
      );
      if (!row) return null;
      const answeredAt = msOf(row.submitted_at);
      const limit = puzzleTimeLimitMs(puzzle);
      // The time from the round's start to this answer's receipt, as the room's clock counted it.
      const used = puzzlePrepMs(puzzle) + Math.max(0, limit - Math.max(0, row.ms_remaining));
      return {
        round_number: i + 1,
        started_at: iso((Number.isFinite(answeredAt) ? answeredAt : nowMs) - used),
        answered: true,
        answered_at: iso(Number.isFinite(answeredAt) ? answeredAt : nowMs),
        missed: false,
        answer: row.answer,
        is_correct: row.is_correct,
        ms_remaining: row.ms_remaining,
        reaction_avg_ms: row.reaction_avg_ms,
        correct_count: row.correct_count,
        errors: row.errors,
        extra: row.extra,
        score: row.score,
      } satisfies Omit<AsyncResultRow, "id" | "room_id" | "attempt_id" | "user_id">;
    });
    // Room slot order is kept (started a millisecond apart), so the challenge lists them as the room did.
    await importFinishedAttempt(
      client,
      stored,
      {
        userId: player.user_id,
        name: (player.display_name ?? "").trim().slice(0, 14) || "Player",
        colour: typeof player.colour === "number" ? player.colour : null,
        icon: player.icon ?? null,
      },
      rounds,
      nowMs + index,
    );
  }
  await recordChallengeEvent(client, {
    room_id: stored.id,
    code: meta.code,
    user_id: userId,
    event: "created",
    source: "room",
  });
  console.log(
    `[challenge] ${meta.code} from room ${room.room_code} game ${gameIndex}: ${imported.length} players`,
  );
  return { ok: true, code: meta.code, roomId: stored.id, created: true };
}

/* -------------------------------------------------------------- lookups */

export async function challengeByCode(
  client: any,
  code: string,
): Promise<{ room: AsyncRoomRow; meta: ChallengeRow } | null> {
  const room = await roomByKey(client, challengeRoomKey(code));
  if (!room || room.kind !== CHALLENGE_ROOM_KIND) return null;
  const { data: meta } = await client
    .from("challenges")
    .select("*")
    .eq("room_id", room.id)
    .maybeSingle();
  if (!meta) return null;
  return { room, meta: meta as ChallengeRow };
}

export async function challengeById(
  client: any,
  roomId: string,
): Promise<{ room: AsyncRoomRow; meta: ChallengeRow } | null> {
  const room = await roomById(client, roomId);
  if (!room || room.kind !== CHALLENGE_ROOM_KIND) return null;
  const { data: meta } = await client
    .from("challenges")
    .select("*")
    .eq("room_id", room.id)
    .maybeSingle();
  return meta ? { room, meta: meta as ChallengeRow } : null;
}

/** Every attempt in start order: a player's slot is their place in it (stable as later players join). */
function slotted(attempts: readonly AsyncAttemptRow[]): (AsyncAttemptRow & { slot: number })[] {
  return [...attempts]
    .sort((a, b) => msOf(a.started_at) - msOf(b.started_at) || a.id.localeCompare(b.id))
    .map((a, i) => ({ ...a, slot: i + 1 }));
}

const asPlayer = (a: AsyncAttemptRow & { slot: number }): ChallengePlayer => ({
  slot: a.slot,
  name: a.display_name,
  colour: a.colour,
  icon: a.icon,
});

/** The earlier players for an attempt: those whose attempts had finished when it started. */
function earlierThan(all: readonly (AsyncAttemptRow & { slot: number })[], mine: AsyncAttemptRow) {
  const start = msOf(mine.started_at);
  return all.filter(
    (a) => a.id !== mine.id && a.finished_at !== null && msOf(a.finished_at) <= start,
  );
}

/** What a challenge link shows this device before playing. */
export async function challengeInfo(
  client: any,
  code: string,
  userId: string | null,
  nowMs: number,
): Promise<ChallengeInfo> {
  const found = await challengeByCode(client, code);
  if (!found) return { found: false };
  const { room, meta } = found;
  const attempts = await attemptsIn(client, room.id);
  let mine = userId ? (attempts.find((a) => a.user_id === userId) ?? null) : null;
  if (mine) mine = (await attemptView(client, room, mine, nowMs)).attempt;
  const closed = nowMs >= msOf(room.closes_at);
  const state = mine
    ? mine.finished_at || closed
      ? "done"
      : "continue"
    : closed
      ? "closed"
      : attempts.length >= CHALLENGE_MAX_PLAYERS
        ? "full"
        : "play";
  return {
    found: true,
    code: meta.code,
    roomId: room.id,
    creatorName: attempts.find((a) => a.user_id === meta.created_by)?.display_name ?? null,
    isCreator: userId === meta.created_by,
    roundCount: room.round_count,
    players: attempts.length,
    maxPlayers: CHALLENGE_MAX_PLAYERS,
    expiresAt: msOf(room.closes_at),
    state,
    roundsDone: mine?.rounds_done ?? 0,
    fromRoom: meta.source === "room",
  };
}

/** Starts (or continues) this device's one attempt on a challenge: closed after seven days, full at 20. */
export async function startChallenge(
  client: any,
  code: string,
  userId: string,
  who: Who,
  nowMs: number,
): Promise<{ ok: true; roomId: string; created: boolean } | Fail> {
  const found = await challengeByCode(client, code);
  if (!found) return { ok: false, message: "That challenge doesn’t exist." };
  const { room } = found;
  const existing = await attemptFor(client, room.id, userId);
  if (existing) return { ok: true, roomId: room.id, created: false };
  if (nowMs >= msOf(room.closes_at))
    return { ok: false, message: "This challenge has ended.", closed: true };
  if ((await attemptsIn(client, room.id)).length >= CHALLENGE_MAX_PLAYERS)
    return {
      ok: false,
      message: `This challenge is full (${CHALLENGE_MAX_PLAYERS} players).`,
      full: true,
    };
  try {
    const started = await startAttempt(client, room, userId, who, nowMs);
    if (!started.ok) return started;
    return { ok: true, roomId: room.id, created: started.created };
  } catch (err) {
    // The database's cap (a racing 21st start).
    if (/challenge_full/.test(err instanceof Error ? err.message : String(err)))
      return {
        ok: false,
        message: `This challenge is full (${CHALLENGE_MAX_PLAYERS} players).`,
        full: true,
      };
    throw err;
  }
}

/** The earlier players this attempt plays against (fixed at its start), and its own slot. */
export async function challengeRoster(
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
): Promise<ChallengeRoster> {
  const all = slotted(await attemptsIn(client, room.id));
  const me = all.find((a) => a.id === attempt.id)!;
  return {
    mySlot: me.slot,
    myName: me.display_name,
    players: [...earlierThan(all, attempt), me].sort((a, b) => a.slot - b.slot).map(asPlayer),
  };
}

/**
 * The earlier players who had finished `round` by now on the caller's own clock: their slots only,
 * and only while the caller's round is live. A ping's moment is the time from that player's round
 * start to their answer's receipt; it is released once the caller's own round has run that long.
 */
export async function challengePings(
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
  nowMs: number,
): Promise<number[]> {
  const puzzle = room.puzzles_public[round - 1];
  if (!puzzle) return [];
  const { data } = await client
    .from("async_results")
    .select("*")
    .eq("room_id", room.id)
    .eq("round_number", round);
  const rows = (data ?? []) as AsyncResultRow[];
  const mine = rows.find((r) => r.attempt_id === attempt.id);
  if (!mine || mine.answered || mine.missed) return [];
  const myStart = msOf(mine.started_at);
  if (asyncReceipt(puzzle, myStart, nowMs) === "closed") return [];
  const elapsed = nowMs - myStart;
  const all = slotted(await attemptsIn(client, room.id));
  const slots: number[] = [];
  for (const other of earlierThan(all, attempt)) {
    const row = rows.find((r) => r.attempt_id === other.id);
    if (!row) continue;
    const at = pingElapsedMs(puzzle, {
      ...row,
      in_time:
        !!row.answered_at &&
        asyncReceipt(puzzle, msOf(row.started_at), msOf(row.answered_at)) === "puzzle",
    });
    if (at !== null && at <= elapsed) slots.push(other.slot);
  }
  return slots.sort((a, b) => a - b);
}

const doneRow = (row: AsyncResultRow | undefined) => !!row && (row.answered || row.missed);

/** Everyone's stored rows as the phone may see them: the caller's in full, the others' without answers. */
function boardRows(
  room: AsyncRoomRow,
  rows: readonly AsyncResultRow[],
  people: readonly (AsyncAttemptRow & { slot: number })[],
  me: AsyncAttemptRow,
  throughRound: number,
): { rows: RoundResultRow[]; full: Map<string, RoundResultRow> } {
  const out: RoundResultRow[] = [];
  const full = new Map<string, RoundResultRow>();
  for (const person of people)
    for (const row of rows) {
      // A missed round has no stored answer: as in a room, no row ("No answer").
      if (row.attempt_id !== person.id || !row.answered || row.round_number > throughRound)
        continue;
      const whole = { ...asRoundResult(row), player_slot: person.slot, duel_id: room.id };
      full.set(`${person.slot}:${row.round_number}`, whole);
      out.push(person.id === me.id ? whole : rivalRow(row, person.slot, room.id));
    }
  return {
    rows: out.sort((a, b) => a.round_number - b.round_number || a.player_slot - b.player_slot),
    full,
  };
}

/**
 * A round's leaderboard and standings for the caller, once their own result for it is stored: the
 * earlier players' and the caller's results for that round and the ones before (no answers), and
 * this round's summaries (what a room's results screen shows).
 */
export async function challengeRoundBoard(
  client: any,
  room: AsyncRoomRow,
  attempt: AsyncAttemptRow,
  round: number,
): Promise<{ ok: true; board: ChallengeRoundBoard } | Fail> {
  const pub = room.puzzles_public[round - 1];
  if (!pub) return { ok: false, message: "That round doesn’t exist." };
  const mineRows = await resultsOf(client, attempt.id);
  if (!doneRow(mineRows.find((r) => r.round_number === round)))
    return { ok: false, message: "That round isn’t over yet." };
  const all = slotted(await attemptsIn(client, room.id));
  const people = [...earlierThan(all, attempt), all.find((a) => a.id === attempt.id)!].sort(
    (a, b) => a.slot - b.slot,
  );
  const { data } = await client.from("async_results").select("*").eq("room_id", room.id);
  const { rows, full } = boardRows(room, (data ?? []) as AsyncResultRow[], people, attempt, round);
  const { data: secret } = await client
    .from("async_room_secrets")
    .select("puzzles_private")
    .eq("room_id", room.id)
    .maybeSingle();
  const puzzle = mergePuzzle(
    pub,
    ((secret?.puzzles_private ?? []) as Record<string, unknown>[])[round - 1],
  );
  const definition = puzzleDef(puzzle.type);
  const details: PlayerRoundDetail[] = [];
  for (const person of people) {
    const row = full.get(`${person.slot}:${round}`);
    if (!row) continue;
    try {
      details.push({ playerSlot: person.slot, ...definition.roundSummary(row, puzzle) });
    } catch (err) {
      console.error(`[challenge] summary failed for ${puzzle.type}`, err);
      details.push({ playerSlot: person.slot, summary: "—", detail: [] });
    }
  }
  let correctAnswer: string | null = null;
  try {
    correctAnswer = definition.correctAnswer(puzzle);
  } catch {
    /* no answer line */
  }
  const me = people.find((p) => p.id === attempt.id)!;
  return {
    ok: true,
    board: {
      round,
      mySlot: me.slot,
      players: people.map(asPlayer),
      results: rows,
      details,
      tie: roomTieRounds(room.puzzles_public),
      correctAnswer,
    },
  };
}

/**
 * The final board for a caller who has finished: every finished attempt (the podium, awards and the
 * round scores a podium row opens), no answers. Records the beta count of a friend's finish.
 */
export async function challengeFinalBoard(
  client: any,
  found: { room: AsyncRoomRow; meta: ChallengeRow },
  attempt: AsyncAttemptRow,
  nowMs: number,
): Promise<{ ok: true; board: ChallengeFinalBoard } | Fail> {
  const { room, meta } = found;
  const fresh = (await attemptFor(client, room.id, attempt.user_id)) ?? attempt;
  const { attempt: current } = await attemptView(client, room, fresh, nowMs);
  if (!current.finished_at && nowMs < msOf(room.closes_at))
    return { ok: false, message: "Finish your rounds first." };
  const all = slotted(await attemptsIn(client, room.id));
  const people = all.filter(
    (a) => a.finished_at !== null || a.id === attempt.id || nowMs >= msOf(room.closes_at),
  );
  const { data } = await client.from("async_results").select("*").eq("room_id", room.id);
  const { rows } = boardRows(
    room,
    (data ?? []) as AsyncResultRow[],
    people,
    current,
    room.round_count,
  );
  // A friend's finish: not the creator, and not a room player whose results were copied in when a
  // room's challenge was made (those attempts are written in the same call, as the room opens).
  const imported = meta.source === "room" && msOf(current.started_at) - msOf(room.opens_at) < 1000;
  if (attempt.user_id !== meta.created_by && current.finished_at && !imported)
    await recordChallengeEvent(client, {
      room_id: room.id,
      code: meta.code,
      user_id: attempt.user_id,
      event: "friend_finished",
    });
  return {
    ok: true,
    board: {
      code: meta.code,
      mySlot: people.find((p) => p.id === attempt.id)!.slot,
      players: people.map(asPlayer),
      results: rows,
      roundOrder: room.round_order as StoredPuzzleType[],
      awardRounds: awardRoundsFor({
        round_order: room.round_order as StoredPuzzleType[],
        puzzles_public: room.puzzles_public,
        round_count: room.round_count,
      }),
      tie: roomTieRounds(room.puzzles_public),
      isCreator: attempt.user_id === meta.created_by,
      creatorName: all.find((a) => a.user_id === meta.created_by)?.display_name ?? null,
      expiresAt: msOf(room.closes_at),
    },
  };
}

/**
 * The creator's challenges for Profile: those this device made, plus the codes the device remembers
 * (a room's challenge another player of that room made first), newest first. Each friend's total
 * once they have finished; the creator's own.
 */
export async function myChallenges(
  client: any,
  userId: string,
  codes: readonly string[],
  nowMs: number,
): Promise<ChallengeSummary[]> {
  const { data } = await client.from("challenges").select("*").eq("created_by", userId);
  const metas = new Map<string, ChallengeRow>(
    ((data ?? []) as ChallengeRow[]).map((m) => [m.code, m]),
  );
  for (const code of codes.slice(0, 20)) {
    if (metas.has(code)) continue;
    const { data: row } = await client
      .from("challenges")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (row) metas.set(code, row as ChallengeRow);
  }
  const list = [...metas.values()]
    .sort((a, b) => msOf(b.created_at) - msOf(a.created_at))
    .slice(0, 12);
  const out: ChallengeSummary[] = [];
  for (const meta of list) {
    const attempts = slotted(await attemptsIn(client, meta.room_id));
    const mine = attempts.find((a) => a.user_id === userId);
    out.push({
      code: meta.code,
      roundCount: meta.round_count,
      createdAt: msOf(meta.created_at),
      expiresAt: msOf(meta.expires_at),
      myTotal: mine?.finished_at ? mine.total_score : null,
      friends: attempts
        .filter((a) => a.user_id !== userId)
        .map((a) => ({
          name: a.display_name,
          finished: a.finished_at !== null || nowMs >= msOf(meta.expires_at),
          total: a.finished_at !== null || nowMs >= msOf(meta.expires_at) ? a.total_score : null,
        })),
    });
  }
  return out;
}

/** Whether challenges are available: the migration's table exists (any read error hides them). */
export async function challengesAvailable(client: any): Promise<boolean> {
  const probe = await client
    .from("challenges")
    .select("room_id")
    .eq("code", "AAAAAA")
    .maybeSingle();
  return !probe?.error;
}
